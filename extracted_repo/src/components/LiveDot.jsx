export default function LiveDot({ label = "Live now" }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-accentRed">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full bg-accentRed animate-pulseRing" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-accentRed" />
      </span>
      {label}
    </span>
  );
}
