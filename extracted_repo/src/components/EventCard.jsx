"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import GlassCard from "./GlassCard";
import PriceDisplay from "./PriceDisplay";
import LiveDot from "./LiveDot";

// Small category → emoji map for the branded fallback card (no poster_url).
const CATEGORY_ICON = {
  fashion: "👗",
  dressing: "🎭",
  dance: "💃",
  campus: "🎓",
  club: "🎧",
  art: "🎨",
  other: "✦",
};

// Highest tier present on the event drives the card's tier styling —
// mirrors the general/vip/premium theming already used on TicketQR.
function highestTier(tiers) {
  if (!tiers?.length) return "general";
  if (tiers.some((t) => t.tier_name === "premium")) return "premium";
  if (tiers.some((t) => t.tier_name === "vip")) return "vip";
  return "general";
}

const TIER_BADGE = {
  vip: { label: "VIP", icon: "👑", className: "tier-badge-gold" },
  premium: { label: "Premium", icon: "⭐", className: "tier-badge-diamond" },
};

// event: { id, title, venue, event_date, poster_url, category, lowestPrice, oldPrice, bulkDiscounts, isLive, event_tiers }
export default function EventCard({ event, onSelect }) {
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [hovering, setHovering] = useState(false);

  const date = new Date(event.event_date);
  const dateLabel = date.toLocaleDateString("en-KE", {
    day: "numeric",
    month: "short",
  });
  const timeLabel = date.toLocaleTimeString("en-KE", {
    hour: "2-digit",
    minute: "2-digit",
  });

  const tier = highestTier(event.event_tiers);
  const badge = TIER_BADGE[tier];

  function handleMove(clientX, clientY) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const maxTilt = 6;
    setTilt({
      x: (py - 0.5) * -maxTilt,
      y: (px - 0.5) * maxTilt,
    });
  }

  function resetTilt() {
    setHovering(false);
    setTilt({ x: 0, y: 0 });
  }

  return (
    <motion.div
      ref={cardRef}
      onMouseEnter={() => setHovering(true)}
      onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
      onMouseLeave={resetTilt}
      onTouchStart={() => setHovering(true)}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) handleMove(t.clientX, t.clientY);
      }}
      onTouchEnd={resetTilt}
      animate={{
        y: hovering ? -6 : 0,
        rotateX: tilt.x,
        rotateY: tilt.y,
      }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      style={{ transformStyle: "preserve-3d", perspective: "800px" }}
      className="w-full"
    >
      <GlassCard
        as="button"
        onClick={() => onSelect?.(event)}
        className={`w-full text-left overflow-hidden relative transition-shadow duration-300 ${
          hovering ? "shadow-[0_20px_45px_rgba(0,0,0,0.16)]" : ""
        } ${tier === "vip" ? "ticket-tier-vip" : tier === "premium" ? "ticket-tier-premium" : ""}`}
      >
        {/* Poster — fixed 3:4 aspect ratio so mismatched upload sizes never distort */}
        <div className="relative w-full aspect-[3/4] overflow-hidden">
          {event.poster_url ? (
            <>
              <div
                className="absolute inset-0 bg-gray-300 transition-transform duration-500 ease-out"
                style={{
                  backgroundImage: `url(${event.poster_url})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  transform: hovering ? "scale(1.08)" : "scale(1)",
                }}
              />
              {/* Bottom gradient so title/date overlays (elsewhere) stay readable
                  regardless of poster brightness */}
              <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/55 to-transparent pointer-events-none" />
            </>
          ) : (
            // Branded fallback for events with no poster — gradient + category icon + title
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-gradient-to-br from-ink via-[#2a2a2a] to-accentRed/70 px-4 text-center">
              <span className="text-[32px]">{CATEGORY_ICON[event.category] ?? "✦"}</span>
              <span className="text-[13px] font-medium text-white/90 line-clamp-2">
                {event.title}
              </span>
            </div>
          )}

          {/* Glare/sheen sweep on hover, reusing the existing holo-sweep keyframe */}
          {hovering && (
            <div className="holo-sweep absolute inset-0 pointer-events-none" />
          )}

          {/* Tier badge — diagonal ribbon across the top-right corner */}
          {badge && (
            <div
              className={`absolute top-3 -right-9 w-32 rotate-45 py-1 text-center text-[10px] font-semibold tracking-wide ${badge.className}`}
            >
              {badge.icon} {badge.label}
            </div>
          )}

          {event.isLive && (
            <div className="absolute top-3 left-3 rounded-chip bg-black/40 backdrop-blur-sm px-2.5 py-1">
              <LiveDot />
            </div>
          )}
        </div>

        <div className="p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] font-medium text-tertiary">
              {dateLabel} · {timeLabel}
            </span>
          </div>
          <h3 className="text-[16px] font-medium tracking-[-0.3px] mb-0.5">
            {event.title}
          </h3>
          <p className="text-[13px] text-secondary mb-3">{event.venue}</p>

          <PriceDisplay price={event.lowestPrice} oldPrice={event.oldPrice} />

          {event.bulkDiscounts?.length > 0 && (
            <div className="flex gap-2 mt-3 flex-wrap">
              {event.bulkDiscounts.map((b) => (
                <span
                  key={b.label}
                  className="rounded-lg bg-black/[0.04] px-2.5 py-1 text-[12px] font-medium text-secondary"
                >
                  {b.label} -{b.discount_percent}%
                </span>
              ))}
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}
