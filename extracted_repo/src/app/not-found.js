import Link from "next/link";
import GlassCard from "@/components/GlassCard";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] items-center justify-center px-4">
      <GlassCard className="w-full max-w-sm p-8 text-center">
        <p className="text-[13px] font-medium text-tertiary mb-2">404</p>
        <h1 className="text-[20px] font-medium tracking-[-0.3px] mb-2">
          This page went off the guest list
        </h1>
        <p className="text-[13px] text-secondary mb-6">
          The page you're looking for doesn't exist or may have moved.
        </p>
        <Link
          href="/events"
          className="inline-block rounded-button bg-ink px-5 py-3 text-[14px] font-medium text-white"
        >
          Browse events
        </Link>
      </GlassCard>
    </main>
  );
}
