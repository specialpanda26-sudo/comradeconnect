"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import GlassCard from "@/components/GlassCard";
import CreateEventForm from "@/components/CreateEventForm";
import GuestListModal from "@/components/GuestListModal";
import IdVerificationForm from "@/components/IdVerificationForm";

export default function DashboardPage() {
  const [user, setUser] = useState(null);
  const [userLoading, setUserLoading] = useState(true);
  const [verification, setVerification] = useState(null);
  const [events, setEvents] = useState([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [guestListEventId, setGuestListEventId] = useState(null);
  const [organizerStats, setOrganizerStats] = useState(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setUserLoading(false);
      if (!user) return;

      const { data: v } = await supabase
        .from("organizer_verifications")
        .select("*")
        .eq("organizer_id", user.id)
        .maybeSingle();
      setVerification(v);

      const { data: ev } = await supabase
        .from("events")
        .select("*, tickets(amount_paid, commission_paid, organizer_paid), payouts(amount, status, held_until)")
        .eq("organizer_id", user.id)
        .order("created_at", { ascending: false });
      setEvents(ev ?? []);

      // Same public-facing organizer_stats view buyers see on PurchaseSheet —
      // shown here too so organizers know what their track record looks like.
      const { data: stats } = await supabase
        .from("organizer_stats")
        .select("events_count, refund_rate_percent")
        .eq("organizer_id", user.id)
        .maybeSingle();
      setOrganizerStats(stats);
    }
    load();
  }, []);

  if (userLoading) {
    return (
      <main className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-black/10 border-t-ink" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="px-4 pt-10 text-center">
        <p className="text-[14px] text-secondary mb-4">Sign in to manage your events.</p>
        <a href="/login" className="inline-block rounded-button bg-ink px-5 py-3 text-[14px] font-medium text-white">
          Sign in
        </a>
      </main>
    );
  }

  const isVerified = verification?.status === "approved";

  const totals = events.reduce(
    (acc, e) => {
      acc.eventsCount += 1;
      const sold = e.tickets?.reduce((s, t) => s + 1, 0) ?? 0;
      const earnings = e.tickets?.reduce((s, t) => s + (t.organizer_paid ?? 0), 0) ?? 0;
      acc.ticketsSold += sold;
      acc.earnings += earnings;
      return acc;
    },
    { eventsCount: 0, ticketsSold: 0, earnings: 0 }
  );

  return (
    <main className="px-4 pt-5">
      <h1 className="text-[18px] font-medium mb-1">Dashboard</h1>
      {organizerStats && organizerStats.events_count > 0 && (
        <p className="text-[12px] text-tertiary mb-5">
          🏅 Your public track record: {organizerStats.events_count} event
          {organizerStats.events_count === 1 ? "" : "s"} hosted
          {organizerStats.refund_rate_percent === 0
            ? " · 0 refund disputes"
            : ` · ${organizerStats.refund_rate_percent}% refund rate`}{" "}
          — buyers see this before they check out.
        </p>
      )}

      {!isVerified && (
        <GlassCard className="p-5 mb-6">
          <p className="text-[14px] font-medium mb-1">Verify your account to start selling tickets</p>
          <p className="text-[12px] text-tertiary mb-4">
            Upload the front and back of your national ID. Files are stored privately in
            Supabase Storage and only visible to you and the review team.
          </p>
          <span className="rounded-chip bg-black/5 px-3 py-1 text-[11px] font-medium text-secondary mb-4 inline-block">
            {verification?.status ?? "Not started"}
          </span>
          <IdVerificationForm
            organizerId={user.id}
            verification={verification}
            onSubmitted={(row) => setVerification(row)}
          />
        </GlassCard>
      )}

      <div className="grid grid-cols-3 gap-3 mb-6">
        <GlassCard className="p-4">
          <p className="text-[11px] text-tertiary mb-1">Events</p>
          <p className="text-[20px] font-medium">{totals.eventsCount}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] text-tertiary mb-1">Tickets sold</p>
          <p className="text-[20px] font-medium">{totals.ticketsSold}</p>
        </GlassCard>
        <GlassCard className="p-4">
          <p className="text-[11px] text-tertiary mb-1">Earnings</p>
          <p className="text-[20px] font-medium">KSh {totals.earnings.toLocaleString()}</p>
        </GlassCard>
      </div>

      <button
        onClick={() => setShowCreateForm(true)}
        className="w-full rounded-button bg-ink py-3 text-[14px] font-medium text-white mb-6"
      >
        + Create event
      </button>

      <p className="text-[14px] font-medium mb-3">My events</p>
      <div className="flex flex-col gap-3">
        {events.map((e) => {
          const sold = e.tickets?.length ?? 0;
          const revenue = e.tickets?.reduce((s, t) => s + t.amount_paid, 0) ?? 0;
          const commission = e.tickets?.reduce((s, t) => s + t.commission_paid, 0) ?? 0;
          const net = revenue - commission;

          // Escrow summary: how much of this event's earnings are still held
          // vs cleared/paid out. Payout rows are created per-sale by the
          // webhook, held until the event date, then released by the
          // /api/admin/release-payouts cron job.
          const payouts = e.payouts ?? [];
          const held = payouts.filter((p) => p.status === "pending").reduce((s, p) => s + p.amount, 0);
          const released = payouts.filter((p) => p.status === "released").reduce((s, p) => s + p.amount, 0);
          const paidOut = payouts.filter((p) => p.status === "paid").reduce((s, p) => s + p.amount, 0);

          return (
            <GlassCard key={e.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[14px] font-medium">{e.title}</p>
                <span className="rounded-chip bg-black/5 px-2.5 py-1 text-[11px] font-medium text-secondary capitalize">
                  {e.status}
                </span>
              </div>
              <p className="text-[12px] text-tertiary mb-2">
                {sold} sold · revenue KSh {revenue.toLocaleString()} · commission KSh {commission.toLocaleString()} · net KSh {net.toLocaleString()}
              </p>
              {payouts.length > 0 && (
                <div className="flex gap-2 flex-wrap mb-3">
                  {held > 0 && (
                    <span className="rounded-lg bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700">
                      🔒 KSh {held.toLocaleString()} held until event date
                    </span>
                  )}
                  {released > 0 && (
                    <span className="rounded-lg bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                      ✅ KSh {released.toLocaleString()} released
                    </span>
                  )}
                  {paidOut > 0 && (
                    <span className="rounded-lg bg-black/5 px-2.5 py-1 text-[11px] font-medium text-secondary">
                      💸 KSh {paidOut.toLocaleString()} paid out
                    </span>
                  )}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => setGuestListEventId(e.id)}
                  className="rounded-lg bg-black/5 px-3 py-1.5 text-[12px] font-medium text-secondary"
                >
                  Guest list
                </button>
                <a href="/scan" className="rounded-lg bg-black/5 px-3 py-1.5 text-[12px] font-medium text-secondary">
                  Scan tickets
                </a>
                <button className="rounded-lg bg-black/5 px-3 py-1.5 text-[12px] font-medium text-secondary">
                  Edit
                </button>
                <button className="rounded-lg bg-black/5 px-3 py-1.5 text-[12px] font-medium text-secondary">
                  {e.status === "paused" ? "Resume" : "Pause"}
                </button>
              </div>
            </GlassCard>
          );
        })}
      </div>

      {showCreateForm && (
        <CreateEventForm
          organizerId={user.id}
          onClose={() => setShowCreateForm(false)}
          onCreated={(event) => setEvents((prev) => [event, ...prev])}
        />
      )}
      {guestListEventId && (
        <GuestListModal eventId={guestListEventId} onClose={() => setGuestListEventId(null)} />
      )}
    </main>
  );
}
