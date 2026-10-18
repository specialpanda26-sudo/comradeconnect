"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS = {
  events: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v1a2 2 0 0 0 0 4v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1a2 2 0 0 0 0-4V9Z" />
      <path d="M13 5v2M13 11v2M13 17v2" />
    </svg>
  ),
  tickets: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <path d="M9 6v12" strokeDasharray="2 2" />
      <circle cx="9" cy="12" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  sell: (active) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </svg>
  ),
};

const TABS = [
  { href: "/events", label: "Events", icon: "events" },
  { href: "/my-tickets", label: "My tickets", icon: "tickets" },
  { href: "/dashboard", label: "Sell", icon: "sell" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 glass rounded-t-2xl">
      <div className="flex justify-around py-2">
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 px-4 py-1 text-[11px] font-medium transition-transform duration-200 ${
                active ? "text-ink scale-105" : "text-tertiary"
              }`}
            >
              {ICONS[tab.icon](active)}
              {tab.label}
            </Link>
          );
        })}
      </div>
      <p className="pb-1 text-center text-[10px] text-tertiary">Powered by Ogolla Tech</p>
    </nav>
  );
}
