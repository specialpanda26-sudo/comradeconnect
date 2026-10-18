// Reusable star rating. Read-only display mode (`value`, fractional allowed
// for averages) or interactive input mode (`onChange` provided).
export default function StarRating({ value = 0, onChange, size = 16 }) {
  const stars = [1, 2, 3, 4, 5];
  const interactive = typeof onChange === "function";

  return (
    <div className="flex items-center gap-0.5">
      {stars.map((n) => {
        const filled = value >= n;
        const half = !filled && value >= n - 0.5;
        return (
          <button
            key={n}
            type="button"
            disabled={!interactive}
            onClick={() => onChange?.(n)}
            className={interactive ? "cursor-pointer" : "cursor-default"}
            style={{ fontSize: size, lineHeight: 1 }}
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
          >
            <span className={filled || half ? "text-amber-400" : "text-black/15"}>★</span>
          </button>
        );
      })}
    </div>
  );
}
