"use client";

import { useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import Link from "next/link";

// Sits at the top of every page (mounted once in layout.js). Draws the
// wordmark in with an SVG stroke animation on first load, then shrinks and
// sticks to a compact top spot as the page scrolls — the "well placed
// logo" the rest of the UI is designed around.
export default function AnimatedLogo() {
  const [drawn, setDrawn] = useState(false);
  const { scrollY } = useScroll();
  const scale = useTransform(scrollY, [0, 120], [1, 0.72]);
  const opacity = useTransform(scrollY, [0, 120], [1, 0.94]);

  useEffect(() => {
    const t = setTimeout(() => setDrawn(true), 60);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="sticky top-0 z-30 flex justify-center pt-4 pb-2 pointer-events-none">
      <motion.div style={{ scale, opacity }} className="pointer-events-auto origin-top">
        <Link href="/" className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" aria-hidden="true">
            <motion.path
              d="M4 20 L9 8 L14 20 L19 8 L24 20"
              stroke="#111111"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: drawn ? 1 : 0 }}
              transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.circle
              cx="14"
              cy="4"
              r="2"
              fill="#dc2626"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: drawn ? 1 : 0, opacity: drawn ? 1 : 0 }}
              transition={{ delay: 0.7, duration: 0.35, ease: "backOut" }}
            />
          </svg>
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: drawn ? 1 : 0, x: drawn ? 0 : -6 }}
            transition={{ delay: 0.5, duration: 0.4 }}
            className="text-[18px] font-medium tracking-[-0.3px]"
          >
            mtaa vibes
          </motion.span>
        </Link>
      </motion.div>
    </div>
  );
}
