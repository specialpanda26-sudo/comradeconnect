"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { QRCodeSVG } from "qrcode.react";

// ticket: { id, qr_code, event: { title, venue, event_date }, tier_name, amount_paid, transaction_id }
export default function TicketQR({ ticket }) {
  const date = new Date(ticket.event.event_date);
  const cardRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  // Tier-based border/glow — gold for VIP, purple for premium, neutral glass
  // for general. Uses the .ticket-glow-* variants (no ::before) so they don't
  // clash with .ticket-perforation's own ::before dotted edge; the holo-sweep
  // ::after gets a matching tier tint via .tier-gold / .tier-purple.
  const tierClass =
    ticket.tier_name === "vip"
      ? "ticket-glow-vip tier-gold"
      : ticket.tier_name === "premium"
      ? "ticket-glow-premium tier-purple"
      : "glass";

  function handleMove(clientX, clientY) {
    const el = cardRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    const maxTilt = 10;
    setTilt({
      x: (py - 0.5) * -maxTilt,
      y: (px - 0.5) * maxTilt,
    });
  }

  function handleMouseMove(e) {
    handleMove(e.clientX, e.clientY);
  }

  function handleTouchMove(e) {
    const t = e.touches[0];
    if (t) handleMove(t.clientX, t.clientY);
  }

  function resetTilt() {
    setTilt({ x: 0, y: 0 });
  }

  return (
    <motion.div
      ref={cardRef}
      id="ticket-card"
      initial={{ opacity: 0, rotateY: -90 }}
      animate={{
        opacity: 1,
        rotateY: tilt.y,
        rotateX: tilt.x,
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onMouseMove={handleMouseMove}
      onMouseLeave={resetTilt}
      onTouchMove={handleTouchMove}
      onTouchEnd={resetTilt}
      transition={{
        opacity: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
        rotateY: { type: "spring", stiffness: 200, damping: 20 },
        rotateX: { type: "spring", stiffness: 200, damping: 20 },
        scale: { duration: 0.2 },
      }}
      style={{
        transformStyle: "preserve-3d",
        perspective: "1000px",
        boxShadow: `${tilt.y * -1.2}px ${tilt.x * 1.2}px 32px rgba(0,0,0,0.18)`,
      }}
      className={`ticket-perforation holo-sweep ${tierClass} mx-auto max-w-[380px] rounded-card p-6 text-center cursor-grab active:cursor-grabbing select-none`}
    >
      <div
        className="flex justify-center mb-5"
        style={{ transform: "translateZ(30px)" }}
      >
        <QRCodeSVG value={ticket.qr_code} size={180} />
      </div>

      <div style={{ transform: "translateZ(20px)" }}>
        <h2 className="text-[18px] font-medium mb-1">{ticket.event.title}</h2>
        <p className="text-[13px] text-secondary mb-3">
          {date.toLocaleDateString("en-KE", { day: "numeric", month: "short", year: "numeric" })}
          {" · "}
          {ticket.event.venue}
        </p>

        <p className="text-[14px] font-medium mb-1 capitalize">
          {ticket.tier_name === "vip" && "👑 "}
          {ticket.tier_name === "premium" && "⭐ "}
          {ticket.tier_name} admission
        </p>
        <p className="text-[16px] font-medium mb-3">KSh {ticket.amount_paid.toLocaleString()}</p>
        <p className="font-mono text-[12px] text-tertiary mb-4">{ticket.transaction_id}</p>

        <span className="inline-flex items-center gap-1.5 rounded-chip bg-accentGreen/10 px-3 py-1 text-[12px] font-medium text-accentGreen">
          ✓ Paid via M-Pesa
        </span>

        <p className="mt-5 text-[10px] text-tertiary">Powered by Ogolla Tech</p>
      </div>
    </motion.div>
  );
}
