export default function SearchBar({ value, onChange, placeholder = "Search events…" }) {
  return (
    <div className="glass flex items-center gap-2 rounded-2xl px-4 py-3">
      <span className="text-tertiary">⌕</span>
      <input
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent text-[14px] outline-none placeholder:text-tertiary"
      />
    </div>
  );
}
