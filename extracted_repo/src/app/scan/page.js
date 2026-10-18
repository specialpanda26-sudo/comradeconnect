"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function ScanPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null); // { state: 'invalid'|'valid'|'used'|'pending', ticket? }

  async function handleValidate() {
    const { data: ticket } = await supabase
      .from("tickets")
      .select("*, event:events(title), tier:event_tiers(tier_name)")
      .eq("qr_code", code)
      .single();

    if (!ticket) {
      setResult({ state: "invalid" });
      return;
    }

    if (ticket.status === "used") {
      setResult({ state: "used", ticket });
      return;
    }

    if (ticket.status === "pending") {
      setResult({ state: "pending", ticket });
      return;
    }

    // status === 'paid' → mark as used
    await supabase
      .from("tickets")
      .update({ status: "used", used_at: new Date().toISOString() })
      .eq("id", ticket.id);

    setResult({ state: "valid", ticket });
  }

  return (
    <main className="px-4 pt-8">
      <h1 className="text-[18px] font-medium mb-4">Scan tickets</h1>

      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter QR code or scan"
        className="glass w-full rounded-2xl px-4 py-3 text-[14px] mb-3 outline-none"
      />
      <button
        onClick={handleValidate}
        className="w-full rounded-button bg-ink py-3 text-[14px] font-medium text-white mb-6"
      >
        Validate
      </button>

      {result?.state === "invalid" && (
        <div className="text-center text-accentRed">
          <p className="text-[24px] font-medium">✕ Fake ticket</p>
        </div>
      )}
      {result?.state === "valid" && (
        <div className="text-center text-accentGreen">
          <p className="text-[24px] font-medium">✓ Valid — let them in</p>
          <p className="text-[13px] text-secondary mt-2">
            {result.ticket.event?.title} · {result.ticket.tier?.tier_name} × {result.ticket.quantity}
          </p>
        </div>
      )}
      {result?.state === "used" && (
        <div className="text-center text-orange-500">
          <p className="text-[24px] font-medium">⚠ Already scanned</p>
          <p className="text-[13px] text-secondary mt-2">
            Used at {new Date(result.ticket.used_at).toLocaleString("en-KE")}
          </p>
        </div>
      )}
      {result?.state === "pending" && (
        <div className="text-center text-secondary">
          <p className="text-[24px] font-medium">Payment pending</p>
        </div>
      )}
    </main>
  );
}
