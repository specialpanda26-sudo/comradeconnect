import { NextResponse } from "next/server";

// Optional — lets the frontend poll while waiting on the STK prompt,
// in case the webhook is delayed. See PAGE D of the build prompt.
export async function POST(req) {
  const { invoiceId } = await req.json();

  const res = await fetch(`${process.env.INTASEND_BASE_URL}/api/v1/payment/status/`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.INTASEND_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ invoice_id: invoiceId }),
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Status check failed" }, { status: 502 });
  }

  const data = await res.json();
  return NextResponse.json(data);
}
