"use client";

import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

// Wraps any button/link content with a subtle magnetic pull toward the
// cursor and a ripple that spawns from the click point. `as` lets it render
// as a Link (pass Next's <Link> component) or a plain button.
// tone: "dark" (black bg, white ripple) | "light" (outlined, dark ripple)
export default function RippleButton({
  as: Tag = "button",
  tone = "dark",
  className = "",
  children,
  onClick,
  ...props
}) {
  const ref = useRef(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 300, damping: 20, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 300, damping: 20, mass: 0.4 });

  function handleMouseMove(e) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const relX = e.clientX - rect.left - rect.width / 2;
    const relY = e.clientY - rect.top - rect.height / 2;
    x.set(relX * 0.15);
    y.set(relY * 0.15);
  }

  function handleMouseLeave() {
    x.set(0);
    y.set(0);
  }

  function spawnRipple(e) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const dot = document.createElement("span");
    const size = Math.max(rect.width, rect.height);
    dot.className = "ripple-dot";
    dot.style.width = `${size}px`;
    dot.style.height = `${size}px`;
    dot.style.left = `${(e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`;
    dot.style.top = `${(e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`;
    ref.current?.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  }

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY, display: "inline-block" }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="inline-block"
    >
      <Tag
        onClick={(e) => {
          spawnRipple(e);
          onClick?.(e);
        }}
        className={`magnetic-btn ${tone} ${className}`}
        {...props}
      >
        {children}
      </Tag>
    </motion.div>
  );
}
