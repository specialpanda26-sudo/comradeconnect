import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { pointsToKsh } from "@/lib/constants";
import { rateLimit, getClientIp } from "@/lib/rateLimit";

const VALID_METHODS = ["M-PESA", "CARD-PAYMENT", "BANK-PAYMENT"];

// PAGE D of the build prompt. Initiates payment via IntaSend (never surfaced
// by name to the buyer — UI says "Ogolla Pay"). M-Pesa pushes an STK prompt
// straight to the buyer's phone via the Collection API; Card and Bank use
// the Checkout API instead, which returns a hosted payment URL to redirect
// the buyer to. Either way, `pending_payments` is written up front so the
// webhook (which is what actually finalizes the ticket) has everything it
// needs regardless of which method was used.
export async function POST(req) {
  // Cheap abuse guard — repeated STK pushes to the same/random numbers cost
  // real money and annoy real people. See src/lib/rateLimit.js for caveats
  // (in-memory, per-instance — replace with Upstash before real traffic).
  const ip = getClientIp(req);
  const { ok, retryAfterMs } = rateLimit(`stkpush:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!ok) {
    return NextResponse.json(
      { error: "Too many payment attempts. Please wait a moment and try again." },
      { status: 429, headers: { "Retry-After": String(Math.ceil(retryAfterMs / 1000)) } }
    );
  }

  const {
    amount,
    phoneNumber,
    email,
    firstName,
    lastName,
    method = "M-PESA",
    eventId,
    tierId,
    quantity,
    referralCode,
    pointsRedeemed,
  } = await req.json();

  if (!amount || !eventId || !tierId || !VALID_METHODS.includes(method)) {
    return NextResponse.json({ error: "Missing or invalid required fields" }, { status: 400 });
  }
  if (method === "M-PESA" && !phoneNumber) {
    return NextResponse.json({ error: "Phone number is required for M-Pesa" }, { status: 400 });
  }
  if (method !== "M-PESA" && !email) {
    return NextResponse.json({ error: "Email is required for card/bank payment" }, { status: 400 });
  }

  // Never trust a client-sent discounted total — recompute the redemption server-side.
  const discount = pointsRedeemed ? pointsToKsh(pointsRedeemed) : 0;
  const finalAmount = Math.max(amount - discount, 1);

  const apiRef = `MTAAVIBES-${eventId}-${Date.now()}`;
  const db = supabaseAdmin();

  let invoiceId;
  let redirectUrl = null;

  if (method === "M-PESA") {
    const intasendRes = await fetch(
      `${process.env.INTASEND_BASE_URL}/api/v1/payment/collection/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          public_key: process.env.INTASEND_PUBLISHABLE_KEY,
          amount: finalAmount,
          phone_number: phoneNumber,
          currency: "KES",
          api_ref: apiRef,
          method: "M-PESA",
        }),
      }
    );

    if (!intasendRes.ok) {
      const errText = await intasendRes.text();
      console.error("IntaSend collection error:", errText);
      return NextResponse.json({ error: "Payment initiation failed" }, { status: 502 });
    }

    const invoice = await intasendRes.json();
    invoiceId = invoice.invoice?.invoice_id ?? invoice.id;
  } else {
    // Card / Bank — hosted checkout redirect. See README "Payments" section.
    const intasendRes = await fetch(`${process.env.INTASEND_BASE_URL}/api/v1/checkout/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        public_key: process.env.INTASEND_PUBLISHABLE_KEY,
        amount: finalAmount,
        currency: "KES",
        email,
        first_name: firstName || "Mtaa",
        last_name: lastName || "Vibes",
        host: process.env.NEXT_PUBLIC_SITE_URL,
        redirect_url: `${process.env.NEXT_PUBLIC_SITE_URL}/pay/complete`,
        api_ref: apiRef,
        method,
      }),
    });

    if (!intasendRes.ok) {
      const errText = await intasendRes.text();
      console.error("IntaSend checkout error:", errText);
      return NextResponse.json({ error: "Payment initiation failed" }, { status: 502 });
    }

    const checkout = await intasendRes.json();
    invoiceId = checkout.id ?? checkout.invoice?.invoice_id;
    redirectUrl = checkout.url;

    if (!redirectUrl) {
      console.error("IntaSend checkout response missing url:", checkout);
      return NextResponse.json({ error: "Payment initiation failed" }, { status: 502 });
    }
  }

  // Stash everything the webhook will need to complete the ticket + points logic.
  await db.from("pending_payments").insert({
    api_ref: apiRef,
    invoice_id: invoiceId,
    event_id: eventId,
    tier_id: tierId,
    quantity,
    buyer_phone: phoneNumber || email, // buyer_phone doubles as a buyer identifier for card/bank
    amount_paid: finalAmount,
    referral_code: referralCode ?? null,
    points_redeemed: pointsRedeemed ?? 0,
  });

  return NextResponse.json({ invoiceId, redirectUrl });
}
