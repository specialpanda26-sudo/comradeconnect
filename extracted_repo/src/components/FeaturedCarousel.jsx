"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

const GRADIENTS = [
  "linear-gradient(135deg, #1a1a2e, #16213e, #0f3460)",
  "linear-gradient(135deg, #2d132c, #801336, #c72c41)",
  "linear-gradient(135deg, #0f2027, #203a43, #2c5364)",
  "linear-gradient(135deg, #3a1c71, #d76d77, #ffaf7b)",
  "linear-gradient(135deg, #232526, #414345)",
  "linear-gradient(135deg, #134e5e, #71b280)",
];

export default function FeaturedCarousel() {
  const [events, setEvents] = useState([]);
  const [stack, setStack] = useState([]);
  const dragX = useRef(0);
  const startX = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("events")
        .select("id, title, venue, poster_url, event_date")
        .eq("status", "live")
        .order("event_date", { ascending: true })
        .limit(6);
      if (data?.length) {
        setEvents(data);
        setStack(data.map((_, i) => i));
      }
    }
    load();
  }, []);

  if (events.length === 0) return null;

  function onStart(x) {
    startX.current = x;
    setDragging(true);
  }
  function onMove(x) {
    if (startX.current === null) return;
    setOffset(x - startX.current);
  }
  function onEnd() {
    if (Math.abs(offset) > 80) {
      setStack((s) => [...s.slice(1), s[0]]);
    }
    setOffset(0);
    startX.current = null;
    setDragging(false);
  }

  return (
    <div className="mb-10">
      <h2 className="text-[17px] font-medium mb-4 px-0">Featured drops</h2>
      <div className="relative flex items-center justify-center h-[240px]">
        {stack.slice(0, 4).map((idx, pos) => {
          const e = events[idx];
          const isTop = pos === 0;
          const scale = 1 - pos * 0.05;
          const yOff = pos * 10;
          const rot = isTop ? offset / 15 : 0;
          const x = isTop ? offset : 0;
          return (
            <div
              key={e.id}
              onMouseDown={isTop ? (ev) => onStart(ev.clientX) : undefined}
              onMouseMove={isTop && dragging ? (ev) => onMove(ev.clientX) : undefined}
              onMouseUp={isTop ? onEnd : undefined}
              onMouseLeave={isTop && dragging ? onEnd : undefined}
              onTouchStart={isTop ? (ev) => onStart(ev.touches[0].clientX) : undefined}
              onTouchMove={isTop ? (ev) => onMove(ev.touches[0].clientX) : undefined}
              onTouchEnd={isTop ? onEnd : undefined}
              className="absolute w-[220px] h-[220px] rounded-card overflow-hidden shadow-soft cursor-grab active:cursor-grabbing select-none"
              style={{
                transform: `translate(${x}px, ${yOff}px) rotate(${rot}deg) scale(${scale})`,
                zIndex: 10 - pos,
                background: e.poster_url ? `url(${e.poster_url}) center/cover` : GRADIENTS[idx % GRADIENTS.length],
                transition: dragging && isTop ? "none" : "transform 0.35s cubic-bezier(0.34,1.56,0.64,1)",
              }}
            >
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4 text-left">
                <p className="text-[13px] font-medium text-white leading-tight">{e.title}</p>
                <p className="text-[11px] text-white/75">{e.venue}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-center text-[11px] text-tertiary mt-3">Swipe to browse</p>
    </div>
  );
}
