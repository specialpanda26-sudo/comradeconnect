// Background texture layer — Section 3 of the build prompt.
// Scattered, near-invisible words that give the page energy without competing
// with the glass cards on top. Pure decoration: pointer-events off, aria-hidden.

const WORDS = [
  "MTAA",
  "VIBES",
  "DANCE",
  "STYLE",
  "HYPE",
  "KENYA",
  "FASHION",
  "YOUTH",
  "TURNUP",
];

// Fixed scatter so layout doesn't jump between renders. Tweak freely.
const POSITIONS = [
  { top: "6%", left: "8%", size: "56px", delay: "0s" },
  { top: "14%", left: "62%", size: "48px", delay: "1.2s" },
  { top: "30%", left: "22%", size: "64px", delay: "2.4s" },
  { top: "42%", left: "75%", size: "52px", delay: "0.6s" },
  { top: "58%", left: "10%", size: "60px", delay: "1.8s" },
  { top: "68%", left: "55%", size: "48px", delay: "3s" },
  { top: "80%", left: "30%", size: "56px", delay: "0.9s" },
  { top: "88%", left: "70%", size: "50px", delay: "2.1s" },
  { top: "20%", left: "88%", size: "44px", delay: "1.5s" },
];

export default function FloatingBrands() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none select-none"
    >
      {POSITIONS.map((pos, i) => (
        <span
          key={WORDS[i % WORDS.length] + i}
          className="absolute font-medium text-[#111] animate-floatBrand"
          style={{
            top: pos.top,
            left: pos.left,
            fontSize: pos.size,
            opacity: 0.04,
            animationDelay: pos.delay,
          }}
        >
          {WORDS[i % WORDS.length]}
        </span>
      ))}
    </div>
  );
}
