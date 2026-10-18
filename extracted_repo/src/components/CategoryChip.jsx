"use client";

import { motion } from "framer-motion";

export default function CategoryChip({ label, active = false, onClick }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      animate={{ scale: active ? 1.05 : 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 17 }}
      className={[
        "rounded-chip px-3 py-1.5 text-[12px] font-medium",
        active ? "bg-ink text-white" : "glass text-secondary",
      ].join(" ")}
    >
      {label}
    </motion.button>
  );
}
