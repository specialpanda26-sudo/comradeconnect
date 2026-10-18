import Link from "next/link";
import RippleButton from "@/components/RippleButton";
import FeaturedCarousel from "@/components/FeaturedCarousel";
import CinematicHero from "@/components/CinematicHero";

const MARQUEE = [
  "Fashion",
  "Dressing Comp",
  "Dance",
  "Campus Night",
  "Club Night",
  "Art & Culture",
  "Vibes",
  "Kenya",
];

export default function LandingPage() {
  return (
    <main className="px-4 pt-2">
      <div className="relative -mx-4 px-4 pt-6 pb-10 mb-2 gradient-mesh rounded-b-[32px] overflow-hidden">
        <div className="flex justify-end mb-4">
          <span className="rounded-chip bg-ink px-3 py-1 text-[11px] font-medium text-white">
            beta
          </span>
        </div>

        <CinematicHero />

        <h1 className="text-[24px] font-medium tracking-[-0.3px] mb-2 max-w-[320px] animate-fadeSlide">
          Kenyan events, zero stress
        </h1>
        <p className="text-[14px] text-secondary mb-6 max-w-[320px] animate-fadeSlide">
          Fashion shows, dressing competitions, dance events, campus nights &
          club events. Pay with M-Pesa. Get instant QR tickets.
        </p>

        <div className="flex gap-3">
          <RippleButton
            as={Link}
            href="/events"
            tone="dark"
            className="glass-btn rounded-button bg-ink px-5 py-3 text-[14px] font-medium text-white inline-block"
          >
            Browse events
          </RippleButton>
          <RippleButton
            as={Link}
            href="/dashboard"
            tone="light"
            className="glass-btn rounded-button border border-ink px-5 py-3 text-[14px] font-medium inline-block"
          >
            Sell tickets
          </RippleButton>
        </div>
      </div>

      <div className="no-scrollbar flex gap-6 overflow-x-auto whitespace-nowrap text-[14px] text-tertiary mb-10">
        {[...MARQUEE, ...MARQUEE].map((item, i) => (
          <span key={i}>{item}</span>
        ))}
      </div>

      <FeaturedCarousel />

      <footer className="mt-16 mb-6 text-center">
        <div className="flex justify-center gap-4 text-[12px] text-secondary mb-3">
          <Link href="/events">Events</Link>
          <Link href="/dashboard">Sell tickets</Link>
          <Link href="/my-tickets">My tickets</Link>
        </div>
        <p className="text-[11px] text-tertiary">
          © {new Date().getFullYear()} Mtaa Vibes · Made in Kenya 🇰🇪
        </p>
      </footer>
    </main>
  );
}
