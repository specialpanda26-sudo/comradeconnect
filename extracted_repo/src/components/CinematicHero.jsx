"use client";

import { useRef, useState, useEffect } from "react";

// Floating 3D glass ticket — tilts toward touch/mouse/gyroscope, with
// parallax-depth brand marks drifting behind it at different speeds.
export default function CinematicHero() {
  const wrapRef = useRef(null);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setReady(true), 80);
    return () => clearTimeout(t);
  }, []);

  function updateFromPoint(clientX, clientY) {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const px = (clientX - rect.left) / rect.width;
    const py = (clientY - rect.top) / rect.height;
    setTilt({ x: (py - 0.5) * -14, y: (px - 0.5) * 14 });
  }

  useEffect(() => {
    function onOrientation(e) {
      if (e.beta == null || e.gamma == null) return;
      setTilt({
        x: Math.max(-14, Math.min(14, (e.beta - 45) * -0.3)),
        y: Math.max(-14, Math.min(14, e.gamma * 0.3)),
      });
    }
    window.addEventListener("deviceorientation", onOrientation);
    return () => window.removeEventListener("deviceorientation", onOrientation);
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative h-[260px] mb-2 flex items-center justify-center overflow-hidden rounded-[32px]"
      style={{ perspective: "1200px" }}
      onMouseMove={(e) => updateFromPoint(e.clientX, e.clientY)}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) updateFromPoint(t.clientX, t.clientY);
      }}
    >
      {/* Parallax depth layers — drift opposite to tilt, slower than the card */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none select-none flex items-center justify-center text-[64px] font-medium"
        style={{ transform: `translate(${tilt.y * -1.2}px, ${tilt.x * -1.2}px)`, transition: "transform 0.3s ease-out" }}
      >
        MTAA
      </div>
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none select-none flex items-center justify-center text-[48px] font-medium translate-x-16 translate-y-10"
        style={{ transform: `translate(${tilt.y * -0.7 + 64}px, ${tilt.x * -0.7 + 40}px)`, transition: "transform 0.3s ease-out" }}
      >
        VIBES
      </div>

      {/* The floating glass ticket itself */}
      <div
        className={`glass-deep relative w-[220px] rounded-card p-5 ${ready ? "animate-cardIn3d" : "opacity-0"}`}
        style={{
          transformStyle: "preserve-3d",
          transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
          transition: "transform 0.25s cubic-bezier(0.16,1,0.3,1)",
          boxShadow: `${tilt.y * -1.5}px ${tilt.x * 1.5}px 40px rgba(0,0,0,0.18)`,
        }}
      >
        <div style={{ transform: "translateZ(24px)" }}>
          <p className="text-[11px] text-tertiary mb-1">General admission</p>
          <p className="text-[16px] font-medium mb-3">Nairobi Fashion Week</p>
          <div className="h-px w-full bg-black/10 mb-3" style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(0,0,0,0.15) 0 4px, transparent 4px 8px)" }} />
          <p className="text-[20px] font-medium">KSh 1,500</p>
        </div>
        <div
          className="absolute -bottom-3 -right-3 h-16 w-16 rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(255,255,255,0.6), transparent 70%)",
            transform: "translateZ(10px)",
          }}
        />
      </div>
    </div>
  );
}
