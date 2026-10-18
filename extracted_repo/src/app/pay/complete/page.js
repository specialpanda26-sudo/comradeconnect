"use client";

import GlassCard from "@/components/GlassCard";

// Card/Bank buyers land here after IntaSend's hosted checkout, per the
// redirect_url set in /api/pay/stkpush. This page is just a waiting/confirmation
// screen — the webhook (src/app/api/pay/webhook/route.js) is what actually
// creates the ticket, so it may take a few seconds to show up on My Tickets.
export default function PayCompletePage() {
  return (
    <main className="px-4 pt-16 text-center">
      <GlassCard className="p-6 max-w-[420px] mx-auto">
        <p className="text-[18px] font-medium mb-2">Payment received</p>
        <p className="text-[13px] text-tertiary mb-6">
          We're confirming your payment with Ogolla Pay — this usually takes a few
          seconds. Your ticket will appear on My Tickets once it's done.
        </p>
        <a
          href="/my-tickets"
          className="inline-block rounded-button bg-ink px-5 py-3 text-[14px] font-medium text-white"
        >
          Go to My Tickets
        </a>
      </GlassCard>
    </main>
  );
}
