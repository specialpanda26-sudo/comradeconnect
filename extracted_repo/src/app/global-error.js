"use client";

import GlassCard from "@/components/GlassCard";

export default function GlobalError({ error, reset }) {
  return (
    <html lang="en">
      <body className="flex min-h-screen items-center justify-center bg-page px-4 font-sans text-ink">
        <GlassCard className="w-full max-w-sm p-8 text-center">
          <p className="text-[13px] font-medium text-accentRed mb-2">Something went wrong</p>
          <h1 className="text-[18px] font-medium tracking-[-0.3px] mb-2">
            We hit a snag loading that
          </h1>
          <p className="text-[13px] text-secondary mb-6">
            Nothing's lost — try again, and it should sort itself out.
          </p>
          <button
            onClick={() => reset()}
            className="w-full rounded-button bg-ink py-3 text-[14px] font-medium text-white"
          >
            Try again
          </button>
        </GlassCard>
      </body>
    </html>
  );
}
