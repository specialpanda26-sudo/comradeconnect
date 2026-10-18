import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";
import { COMMISSION_RATE, REFERRAL_POINTS_PER_SIGNUP } from "@/lib/constants";

// PAGE D of the build prompt. Configure this URL as the webhook/callback
// URL in the IntaSend dashboard, and set the same value there and in
// INTASEND_WEBHOOK_CHALLENGE below (IntaSend echoes it back in every
// webhook payload's `challenge` field — see docs/BUILD_PROMPT.md).
function isGenuineIntaSendRequest(challenge) {
  const expected = process.env.INTASEND_WEBHOOK_CHALLENGE;
  if (!expected || !challenge) return false;

  const a = Buffer.from(String(challenge));
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so guard that first —
  // still safe since a length check alone doesn't leak the secret's content.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req) {
  const payload = await req.json();
  const invoice = payload.invoice ?? payload;

  if (!isGenuineIntaSendRequest(invoice.challenge)) {
    console.error("Webhook challenge mismatch — rejecting request");
    return NextResponse.json({ error: "Invalid challenge" }, { status: 401 });
  }

  const db = supabaseAdmin();

  if (invoice.state !== "COMPLETE") {
    console.log("Payment not complete, ignoring:", invoice.state);
    return NextResponse.json({ received: true });
  }

  const { data: pending } = await db
    .from("pending_payments")
    .select("*")
    .eq("api_ref", invoice.api_ref)
    .single();

  if (!pending) {
    console.error("No pending payment found for api_ref:", invoice.api_ref);
    return NextResponse.json({ error: "Unknown api_ref" }, { status: 404 });
  }

  // Idempotency guard — IntaSend (like most webhook senders) can and will
  // retry a delivery (timeouts, non-2xx responses, etc). Without this check
  // a retried COMPLETE event would insert a second ticket, double-credit
  // commission/payout, and double-award referral points for the same sale.
  const { data: existingTicket } = await db
    .from("tickets")
    .select("id")
    .eq("transaction_id", invoice.invoice_id)
    .maybeSingle();

  if (existingTicket) {
    console.log("Ticket already exists for transaction_id, skipping:", invoice.invoice_id);
    return NextResponse.json({ received: true, duplicate: true });
  }

  const amountPaid = pending.amount_paid;
  const commissionPaid = Math.round(amountPaid * COMMISSION_RATE);
  const organizerPaid = amountPaid - commissionPaid;
  const qrCode = crypto.randomUUID();

  const { data: ticket } = await db
    .from("tickets")
    .insert({
      event_id: pending.event_id,
      tier_id: pending.tier_id,
      buyer_phone: pending.buyer_phone,
      quantity: pending.quantity,
      amount_paid: amountPaid,
      commission_paid: commissionPaid,
      organizer_paid: organizerPaid,
      transaction_id: invoice.invoice_id,
      qr_code: qrCode,
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .select()
    .single();

  const { data: event } = await db
    .from("events")
    .select("organizer_id, sold_tickets, event_date")
    .eq("id", pending.event_id)
    .single();

  await db
    .from("events")
    .update({ sold_tickets: (event?.sold_tickets ?? 0) + pending.quantity })
    .eq("id", pending.event_id);

  // Escrow-style hold: funds sit as 'pending' until the event date passes,
  // so a buyer whose event never happens (no-show organizer, cancellation)
  // isn't paying out a scam before anyone finds out. release-payouts flips
  // these to 'released' once held_until is in the past; the actual M-Pesa
  // transfer is still a manual/admin step after that (mpesa_receipt + 'paid').
  await db.from("payouts").insert({
    event_id: pending.event_id,
    organizer_id: event?.organizer_id,
    amount: organizerPaid,
    status: "pending",
    held_until: event?.event_date ?? null,
  });

  if (pending.points_redeemed > 0) {
    await db.from("points_ledger").insert({
      phone: pending.buyer_phone,
      type: "redeem",
      amount: pending.points_redeemed,
      reason: "redeemed_at_checkout",
      ticket_id: ticket?.id,
    });
  }

  if (pending.referral_code) {
    const { data: referral } = await db
      .from("referrals")
      .select("*")
      .eq("referral_code", pending.referral_code)
      .single();

    if (referral && referral.reward_status === "pending") {
      await db
        .from("referrals")
        .update({
          referred_phone: pending.buyer_phone,
          referred_ticket_id: ticket?.id,
          reward_status: "earned",
        })
        .eq("id", referral.id);

      await db.from("points_ledger").insert({
        phone: referral.referrer_phone,
        type: "earn",
        amount: REFERRAL_POINTS_PER_SIGNUP,
        reason: "referral_signup",
        referral_id: referral.id,
      });
    }
  }

  return NextResponse.json({ received: true });
}
