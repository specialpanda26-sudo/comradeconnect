"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import TabBar from "./TabBar";

const TABS = [
  { value: "all", label: "All" },
  { value: "paid", label: "Paid" },
  { value: "used", label: "Used" },
];

export default function GuestListModal({ eventId, onClose }) {
  const [tickets, setTickets] = useState([]);
  const [status, setStatus] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("tickets")
        .select("*, tier:event_tiers(tier_name)")
        .eq("event_id", eventId)
        .order("created_at", { ascending: false });
      setTickets(data ?? []);
    }
    load();
  }, [eventId]);

  const filtered = useMemo(() => {
    return tickets.filter((t) => {
      const matchesStatus = status === "all" || t.status === status;
      const matchesSearch = !search || t.buyer_phone.includes(search);
      return matchesStatus && matchesSearch;
    });
  }, [tickets, status, search]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30">
      <div className="glass w-full max-w-[480px] max-h-[85vh] overflow-y-auto rounded-t-[28px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[18px] font-medium">Guest list</h2>
          <button onClick={onClose} className="glass h-8 w-8 rounded-full text-secondary">×</button>
        </div>

        <input
          placeholder="Search by phone number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full glass rounded-2xl px-4 py-3 text-[14px] mb-4 outline-none"
        />

        <div className="mb-4 -mx-5 px-5">
          <TabBar tabs={TABS} activeTab={status} onChange={setStatus} />
        </div>

        <div className="flex flex-col gap-2">
          {filtered.map((t) => (
            <div key={t.id} className="flex items-center justify-between glass rounded-2xl px-4 py-3">
              <div>
                <p className="text-[13px] font-medium">{t.buyer_name || t.buyer_phone}</p>
                <p className="text-[11px] text-tertiary capitalize">
                  {t.tier?.tier_name} × {t.quantity}
                </p>
              </div>
              <span className="text-[11px] font-medium text-secondary capitalize">{t.status}</span>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-[13px] text-tertiary text-center py-6">No guests match this filter.</p>
          )}
        </div>
      </div>
    </div>
  );
}
