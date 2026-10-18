"use client";

import { useEffect, useState } from "react";

function getParts(target) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  const seconds = Math.floor((diff % 60000) / 1000);
  return { days, hours, minutes, seconds, done: diff <= 0 };
}

function Digit({ value, label }) {
  const padded = String(value).padStart(2, "0");
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-10 h-11 rounded-lg bg-ink text-white overflow-hidden shadow-soft">
        <span
          key={padded}
          className="absolute inset-0 flex items-center justify-center text-[18px] font-medium animate-fadeSlide"
        >
          {padded}
        </span>
        <div className="absolute inset-x-0 top-1/2 h-px bg-black/30" />
      </div>
      <span className="text-[9px] text-tertiary">{label}</span>
    </div>
  );
}

// Departure-board style countdown to an event's start time.
export default function FlipCountdown({ eventDate }) {
  const [parts, setParts] = useState(() => getParts(eventDate));

  useEffect(() => {
    const id = setInterval(() => setParts(getParts(eventDate)), 1000);
    return () => clearInterval(id);
  }, [eventDate]);

  if (parts.done) {
    return <p className="text-[12px] font-medium text-accentGreen">Event is live now</p>;
  }

  return (
    <div className="flex gap-2">
      <Digit value={parts.days} label="days" />
      <Digit value={parts.hours} label="hrs" />
      <Digit value={parts.minutes} label="min" />
      <Digit value={parts.seconds} label="sec" />
    </div>
  );
}
