"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import TicketQR from "@/components/TicketQR";
import FlipCountdown from "@/components/FlipCountdown";
import ConfettiBurst from "@/components/ConfettiBurst";

export default function TicketPage({ params }) {
  const [ticket, setTicket] = useState(null);
  const [celebrate, setCelebrate] = useState(false);
  const cardWrapperRef = useRef(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tickets")
        .select("*, event:events(title, venue, event_date), tier:event_tiers(tier_name)")
        .eq("id", params.id)
        .single();

      if (data) {
        setTicket({ ...data, tier_name: data.tier?.tier_name });
        // Landing on a freshly minted ticket page is the payoff moment —
        // small celebratory burst, once, on load.
        setCelebrate(true);
        setTimeout(() => setCelebrate(false), 1500);
      }
    }
    load();
  }, [params.id]);

  async function handleDownload() {
    const html2canvas = (await import("html2canvas")).default;
    const node = document.getElementById("ticket-card");
    if (!node) return;
    const canvas = await html2canvas(node);
    const link = document.createElement("a");
    link.download = `mtaa-vibes-ticket-${params.id}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }

  if (!ticket) {
    return <main className="px-4 pt-10 text-center text-[13px] text-tertiary">Loading ticket…</main>;
  }

  return (
    <main className="px-4 pt-8" ref={cardWrapperRef}>
      <ConfettiBurst trigger={celebrate} />
      <TicketQR ticket={ticket} />

      <div className="mx-auto mt-6 max-w-[380px] text-center">
        <p className="text-[12px] text-tertiary mb-2">Doors open in</p>
        <div className="flex justify-center">
          <FlipCountdown eventDate={ticket.event.event_date} />
        </div>
      </div>

      <div className="mx-auto mt-6 flex max-w-[380px] gap-3">
        <button
          onClick={handleDownload}
          className="flex-1 rounded-button bg-ink py-3 text-[14px] font-medium text-white"
        >
          Download ticket
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `Here's my ticket for ${ticket.event.title} 🎟️ ${typeof window !== "undefined" ? window.location.href : ""}`
          )}`}
          target="_blank"
          rel="noreferrer"
          className="flex-1 rounded-button border border-ink py-3 text-center text-[14px] font-medium"
        >
          Share to WhatsApp
        </a>
      </div>
    </main>
  );
}
