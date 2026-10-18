export default function PriceDisplay({ price, oldPrice, currency = "KSh" }) {
  const discountPct =
    oldPrice && oldPrice > price
      ? Math.round(((oldPrice - price) / oldPrice) * 100)
      : null;

  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[20px] font-medium tracking-[-0.3px]">
        {currency} {price.toLocaleString()}
      </span>
      {oldPrice && oldPrice > price && (
        <span className="text-[13px] text-tertiary line-through">
          {currency} {oldPrice.toLocaleString()}
        </span>
      )}
      {discountPct && (
        <span className="rounded-chip bg-accentRed/10 px-2 py-0.5 text-[11px] font-medium text-accentRed">
          -{discountPct}%
        </span>
      )}
    </div>
  );
}
