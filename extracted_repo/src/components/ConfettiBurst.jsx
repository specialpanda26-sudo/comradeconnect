"use client";

import { useEffect, useRef } from "react";

const COLORS = ["#111111", "#dc2626", "#16a34a", "#ffffff"];

// Fires a short confetti burst from the center of the screen. No dependency —
// a small canvas physics loop that cleans itself up. Mount with `trigger`
// toggled true (e.g. on successful payment) to fire once.
export default function ConfettiBurst({ trigger }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!trigger) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    ctx.scale(dpr, dpr);

    const originX = window.innerWidth / 2;
    const originY = window.innerHeight / 2.5;

    const particles = Array.from({ length: 90 }, () => {
      const angle = Math.random() * Math.PI * 2;
      const speed = 3 + Math.random() * 6;
      return {
        x: originX,
        y: originY,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 2,
        size: 4 + Math.random() * 4,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        rotation: Math.random() * 360,
        spin: (Math.random() - 0.5) * 20,
        life: 0,
      };
    });

    let frame;
    function tick() {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
      let alive = false;
      for (const p of particles) {
        p.life += 1;
        if (p.life > 90) continue;
        alive = true;
        p.vy += 0.15; // gravity
        p.x += p.vx;
        p.y += p.vy;
        p.rotation += p.spin;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.globalAlpha = Math.max(0, 1 - p.life / 90);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
      if (alive) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [trigger]);

  if (!trigger) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 z-[60]"
    />
  );
}
