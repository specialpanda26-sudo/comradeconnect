"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { useBuyerSession } from "@/lib/useBuyerSession";
import { normalizePhone, phoneVariants } from "@/lib/constants";
import TabBar from "@/components/TabBar";
import GlassCard from "@/components/GlassCard";
import ReferralCard from "@/components/ReferralCard";

const TABS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "past", label: "Past" },
  { value: "all", label: "All" },
];

export default function MyTicketsPage() {
  const { phone, loading: sessionLoading } = useBuyerSession();
  const [tab, setTab] = useState("upcoming");
  const [tickets, setTickets] = useState([]);
  const [referral, setReferral] = useState(null);

  useEffect(() => {
    if (!phone) return;
    const normalized = normalizePhone(phone);

    async function load() {
      const { data } = await supabase
        .from("tickets")
        .select("*, event:events(title, poster_url, event_date, venue)")
        .in("buyer_phone", phoneVariants(normalized))
        .order("paid_at", { ascending: false });
      setTickets(data ?? []);

      // Points balance = sum(earn) - sum(redeem) from points_ledger
      const { data: ledger } = await supabase
        .from("points_ledger")
        .select("type, amount")
        .in("phone", phoneVariants(normalized));
      const balance = (ledger ?? []).reduce(
        (acc, row) => acc + (row.type === "earn" ? row.amount : -row.amount),
        0
      );

      const { data: existingReferral } = await supabase
        .from("referrals")
        .select("referral_code")
        .in("referrer_phone", phoneVariants(normalized))
        .limit(1)
        .maybeSingle();

      const code = existingReferral?.referral_code ?? normalized.slice(-6);
      const { count: friendsReferred } = await supabase
        .from("referrals")
        .select("id", { count: "exact", head: true })
        .in("referrer_phone", phoneVariants(normalized))
        .eq("reward_status", "earned");

      setReferral({
        code,
        link: `${window.location.origin}/events?ref=${code}`,
        pointsBalance: balance,
        friendsReferred: friendsReferred ?? 0,
      });
    }
    load();
  }, [phone]);

  const filtered = useMemo(() => {
    const now = new Date();
    return tickets.filter((t) => {
      if (tab === "all") return true;
      const eventDate = new Date(t.event?.event_date);
      return tab === "upcoming" ? eventDate >= now : eventDate < now;
    });
  }, [tickets, tab]);

  if (sessionLoading) {
    return <main className="px-4 pt-10 text-center text-[13px] text-tertiary">Loading…</main>;
  }

  if (!phone) {
    return (
      <main className="px-4 pt-10 text-center">
        <p className="text-[14px] text-secondary mb-4">
          Verify your phone number to see your tickets.
        </p>
        <Link
          href="/verify?redirect=/my-tickets"
          className="inline-block rounded-button bg-ink px-5 py-3 text-[14px] font-medium text-white"
        >
          Verify phone
        </Link>
      </main>
    );
  }

  return (
    <main className="px-4 pt-5">
      <h1 className="text-[18px] font-medium mb-4">My tickets</h1>

      <div className="mb-5 -mx-4">
        <TabBar tabs={TABS} activeTab={tab} onChange={setTab} />
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10">
          <p className="text-[14px] text-secondary mb-4">No tickets yet</p>
          <Link
            href="/events"
            className="inline-block rounded-button bg-ink px-5 py-3 text-[14px] font-medium text-white"
          >
            Browse events
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-3">
        {filtered.map((ticket) => (
          <GlassCard key={ticket.id} className="p-3">
            <Link href={`/ticket/${ticket.id}`} className="flex items-center gap-3">
              <div
                className="h-14 w-14 shrink-0 rounded-2xl bg-gray-300 bg-cover bg-center"
                style={ticket.event?.poster_url ? { backgroundImage: `url(${ticket.event.poster_url})` } : undefined}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-medium truncate">{ticket.event?.title}</p>
                <p className="text-[12px] text-tertiary truncate">{ticket.event?.venue}</p>
              </div>
              <span
                className={`rounded-chip px-2.5 py-1 text-[11px] font-medium ${
                  ticket.status === "used" ? "bg-black/5 text-tertiary" : "bg-accentGreen/10 text-accentGreen"
                }`}
              >
                {ticket.status === "used" ? "Used" : "Paid"}
              </span>
            </Link>
            {ticket.status === "used" && (
              <Link
                href={`/event/${ticket.event_id}?review=${ticket.id}`}
                className="mt-2 inline-block text-[12px] font-medium text-secondary underline underline-offset-2"
              >
                Leave a review
              </Link>
            )}
          </GlassCard>
        ))}
      </div>

      {referral && <ReferralCard referral={referral} />}
    </main>
  );
}
