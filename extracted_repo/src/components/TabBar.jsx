"use client";

// Reusable scrollable tab strip — Section 2 "Tabs" of the build prompt.
// Used by: event feed category filter, My Tickets (Upcoming/Past/All),
// and the organizer Guest List modal (All/Paid/Used).
//
// tabs: [{ value, label }]
// orientation: "horizontal" (default, mobile) | "vertical" (desktop rail)

export default function TabBar({ tabs, activeTab, onChange, orientation = "horizontal" }) {
  const isVertical = orientation === "vertical";

  return (
    <div
      className={
        isVertical
          ? "flex flex-col gap-2 overflow-y-auto no-scrollbar"
          : "flex gap-2 overflow-x-auto no-scrollbar snap-x-proximity px-4"
      }
    >
      {tabs.map((tab) => {
        const isActive = tab.value === activeTab;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={[
              "relative shrink-0 snap-start rounded-chip px-4 py-2 text-[13px] font-medium transition-transform duration-200",
              isVertical ? "text-left" : "",
              isActive
                ? "bg-ink text-white scale-105"
                : "glass text-secondary",
            ].join(" ")}
          >
            {tab.label}
            {isActive && (
              <span
                className={
                  isVertical
                    ? "absolute left-0 top-1/2 -translate-y-1/2 h-4 w-[2px] bg-ink rounded-full animate-tabUnderline"
                    : "absolute -bottom-1 left-1/2 -translate-x-1/2 h-[2px] w-6 bg-ink rounded-full animate-tabUnderline"
                }
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
