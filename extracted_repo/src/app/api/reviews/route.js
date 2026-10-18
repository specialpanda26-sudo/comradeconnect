import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { normalizePhone } from "@/lib/constants";

// Reviews are only ever written here (never a direct client insert — see the
// RLS policy in schema.sql). Buyer identity comes from a verified Supabase
// phone-auth session (Authorization: Bearer <access_token>, from /verify),
// not a client-supplied phone field — so a review can't be spoofed just by
// typing someone else's number in a request body.
export async function POST(req) {
  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Verify your phone number to leave a review" }, { status: 401 });
  }

  const { ticketId, rating, comment } = await req.json();

  if (!ticketId || !rating) {
    return NextResponse.json({ error: "Missing ticketId or rating" }, { status: 400 });
  }
  if (rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Rating must be between 1 and 5" }, { status: 400 });
  }

  const db = supabaseAdmin();

  const { data: userData, error: authError } = await db.auth.getUser(token);
  if (authError || !userData?.user?.phone) {
    return NextResponse.json({ error: "Invalid or expired session — please verify again" }, { status: 401 });
  }
  const verifiedPhone = normalizePhone(userData.user.phone);

  const { data: ticket } = await db
    .from("tickets")
    .select("id, event_id, buyer_phone, status")
    .eq("id", ticketId)
    .single();

  if (!ticket || normalizePhone(ticket.buyer_phone) !== verifiedPhone) {
    return NextResponse.json({ error: "This ticket isn't linked to your verified phone number" }, { status: 403 });
  }
  if (ticket.status !== "used") {
    return NextResponse.json(
      { error: "You can only review an event after your ticket has been scanned at the door" },
      { status: 403 }
    );
  }

  const { data: review, error } = await db
    .from("event_reviews")
    .insert({
      event_id: ticket.event_id,
      ticket_id: ticket.id,
      buyer_phone: ticket.buyer_phone,
      rating,
      comment: comment?.slice(0, 500) || null,
    })
    .select()
    .single();

  if (error) {
    // Unique constraint on ticket_id — one review per ticket.
    if (error.code === "23505") {
      return NextResponse.json({ error: "You've already reviewed this event" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ review });
}
