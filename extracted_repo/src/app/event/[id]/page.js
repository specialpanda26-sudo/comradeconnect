"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { useBuyerSession } from "@/lib/useBuyerSession";
import GlassCard from "@/components/GlassCard";
import PriceDisplay from "@/components/PriceDisplay";
import PurchaseSheet from "@/components/PurchaseSheet";
import StarRating from "@/components/StarRating";
import ReviewForm from "@/components/ReviewForm";

export default function EventDetailPage({ params }) {
  const searchParams = useSearchParams();
  const reviewTicketId = searchParams.get("review"); // deep-linked from my-tickets: "leave a review"
  const { phone, accessToken } = useBuyerSession();

  const [event, setEvent] = useState(null);
  const [organizerStats, setOrganizerStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [showPurchase, setShowPurchase] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    async function load() {
      const { data: ev } = await supabase
        .from("events")
        .select("*, event_tiers(*), bulk_discounts(*)")
        .eq("id", params.id)
        .single();
      if (ev) {
        setEvent({
          ...ev,
          tiers: ev.event_tiers,
          lowestPrice: Math.min(...(ev.event_tiers?.map((t) => t.price) ?? [0])),
          bulkDiscounts: ev.bulk_discounts,
        });

        const { data: stats } = await supabase
          .from("organizer_stats")
          .select("events_count, refund_rate_percent")
          .eq("organizer_id", ev.organizer_id)
          .maybeSingle();
        setOrganizerStats(stats);
      }

      const { data: rv } = await supabase
        .from("event_reviews")
        .select("rating, comment, created_at")
        .eq("event_id", params.id)
        .order("created_at", { ascending: false });
      setReviews(rv ?? []);
    }
    load();
  }, [params.id]);

  if (!event) {
    return <main className="px-4 pt-10 text-center text-[13px] text-tertiary">Loading event…</main>;
  }

  const avgRating = reviews.length
    ? reviews.reduce((s, r) => s + r.rating, 0) / reviews.length
    : null;

  const date = new Date(event.event_date);
  const dateLabel = date.toLocaleDateString("en-KE", { weekday: "long", day: "numeric", month: "long" });
  const timeLabel = date.toLocaleTimeString("en-KE", { hour: "2-digit", minute: "2-digit" });

  return (
    <main className="pb-32">
      <div
        className="h-56 w-full bg-cover bg-center bg-gray-300"
        style={event.poster_url ? { backgroundImage: `url(${event.poster_url})` } : undefined}
      />

      <div className="px-4 pt-5">
        <h1 className="text-[22px] font-medium tracking-[-0.4px] mb-1">{event.title}</h1>
        <p className="text-[13px] text-secondary mb-1">{dateLabel} · {timeLabel}</p>
        <p className="text-[13px] text-secondary mb-3">{event.venue}</p>

        <div className="flex items-center gap-3 mb-4 flex-wrap">
          {avgRating !== null && (
            <div className="flex items-center gap-1.5">
              <StarRating value={avgRating} size={15} />
              <span className="text-[12px] text-tertiary">
                {avgRating.toFixed(1)} ({reviews.length} review{reviews.length === 1 ? "" : "s"})
              </span>
            </div>
          )}
          {organizerStats && organizerStats.events_count > 0 && (
            <span className="text-[12px] text-tertiary">
              🏅 {organizerStats.events_count} event{organizerStats.events_count === 1 ? "" : "s"} hosted
              {organizerStats.refund_rate_percent === 0
                ? " · 0 refund disputes"
                : ` · ${organizerStats.refund_rate_percent}% refund rate`}
            </span>
          )}
        </div>

        {event.description && (
          <p className="text-[14px] text-secondary mb-5 whitespace-pre-wrap">{event.description}</p>
        )}

        <GlassCard className="p-4 mb-6">
          <p className="text-[11px] text-tertiary mb-1">From</p>
          <PriceDisplay price={event.lowestPrice} />
        </GlassCard>

        {reviewTicketId && phone && !reviewSubmitted && (
          <div className="mb-6">
            <ReviewForm
              ticketId={reviewTicketId}
              accessToken={accessToken}
              onSubmitted={(review) => {
                setReviewSubmitted(true);
                setReviews((prev) => [review, ...prev]);
              }}
            />
          </div>
        )}
        {reviewTicketId && !phone && !reviewSubmitted && (
          <div className="mb-6 rounded-2xl bg-black/[0.03] p-4 text-center">
            <p className="text-[13px] text-secondary mb-3">Verify your phone to leave a review.</p>
            <Link
              href={`/verify?redirect=${encodeURIComponent(`/event/${params.id}?review=${reviewTicketId}`)}`}
              className="inline-block rounded-button bg-ink px-5 py-2.5 text-[13px] font-medium text-white"
            >
              Verify phone
            </Link>
          </div>
        )}
        {reviewSubmitted && (
          <p className="mb-6 text-[13px] text-accentGreen">Thanks for the review! 🎉</p>
        )}

        <p className="text-[14px] font-medium mb-3">
          {reviews.length > 0 ? "Reviews" : "No reviews yet"}
        </p>
        <div className="flex flex-col gap-3">
          {reviews.map((r, i) => (
            <GlassCard key={i} className="p-3">
              <div className="flex items-center justify-between mb-1">
                <StarRating value={r.rating} size={13} />
                <span className="text-[11px] text-tertiary">
                  {new Date(r.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
                </span>
              </div>
              {r.comment && <p className="text-[13px] text-secondary">{r.comment}</p>}
            </GlassCard>
          ))}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 border-t border-black/5 bg-white/80 backdrop-blur-lg p-4">
        <button
          onClick={() => setShowPurchase(true)}
          className="w-full rounded-button bg-ink py-3.5 text-[15px] font-medium text-white"
        >
          Get tickets — from KSh {event.lowestPrice}
        </button>
      </div>

      {showPurchase && (
        <PurchaseSheet
          event={event}
          pointsBalance={0}
          referralCode={typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("ref") : null}
          onClose={() => setShowPurchase(false)}
          onSubmit={async (payload) => {
            const res = await fetch("/api/pay/stkpush", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error("Payment initiation failed");
            return res.json();
          }}
        />
      )}
    </main>
  );
}
