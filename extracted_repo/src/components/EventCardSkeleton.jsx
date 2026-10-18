// Shimmering placeholder shown in the event feed while data loads — mirrors
// EventCard's layout so there's no shape jump when real cards swap in.
export default function EventCardSkeleton() {
  return (
    <div className="glass rounded-card overflow-hidden">
      <div className="aspect-[3/4] w-full shimmer-bg animate-shimmer" />
      <div className="p-4">
        <div className="h-3 w-24 rounded shimmer-bg animate-shimmer mb-2" />
        <div className="h-4 w-40 rounded shimmer-bg animate-shimmer mb-2" />
        <div className="h-3 w-28 rounded shimmer-bg animate-shimmer mb-4" />
        <div className="h-4 w-20 rounded shimmer-bg animate-shimmer" />
      </div>
    </div>
  );
}
