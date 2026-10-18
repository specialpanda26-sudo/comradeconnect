import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase";

// Escrow release job — call this on a schedule (e.g. a daily Vercel Cron
// hitting this URL, or Supabase pg_cron via `net.http_post`) with header
// `x-admin-secret: <ADMIN_API_SECRET>`. It does NOT move any money itself;
// IntaSend has no payout API wired up here, so this only flips escrowed
// payouts from 'pending' to 'released' once the event date has passed,
// meaning "safe to send now" for whoever runs the manual M-Pesa transfer
// and then marks the row 'paid' (with mpesa_receipt) in Supabase.
//
// Set ADMIN_API_SECRET in your environment before wiring up the cron job —
// this route rejects every request until that's configured.
function isAuthorized(req) {
  const expected = process.env.ADMIN_API_SECRET;
  const provided = req.headers.get("x-admin-secret");
  if (!expected || !provided) return false;

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function POST(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();

  const { data: released, error } = await db
    .from("payouts")
    .update({ status: "released", released_at: new Date().toISOString() })
    .eq("status", "pending")
    .lte("held_until", new Date().toISOString())
    .select("id, event_id, organizer_id, amount");

  if (error) {
    console.error("release-payouts failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    released_count: released?.length ?? 0,
    released_amount: released?.reduce((s, p) => s + p.amount, 0) ?? 0,
    payouts: released ?? [],
  });
}

// Lets you sanity-check what WOULD release, without actually releasing it.
export async function GET(req) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const db = supabaseAdmin();
  const { data: due, error } = await db
    .from("payouts")
    .select("id, event_id, organizer_id, amount, held_until")
    .eq("status", "pending")
    .lte("held_until", new Date().toISOString());

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ due_count: due?.length ?? 0, payouts: due ?? [] });
}
