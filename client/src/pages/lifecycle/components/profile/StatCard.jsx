const TONES = {
  default: 'text-surface-900',
  brand: 'text-brand-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  red: 'text-red-600',
};

/** One figure with its label, used across the profile tabs. Clickable when `onClick` is given. */
export function StatCard({ label, value, sub, tone = 'default', icon: Icon, onClick }) {
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag type={onClick ? 'button' : undefined} onClick={onClick}
      className={`text-start w-full bg-white rounded-xl border border-surface-200 p-4 ${onClick ? 'hover:border-brand-300 hover:shadow-sm transition cursor-pointer' : ''}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-surface-400">{label}</p>
        {Icon && <Icon size={16} className="text-brand-500 shrink-0" />}
      </div>
      <p className={`text-xl font-bold mt-1.5 tabular-nums ${TONES[tone] || TONES.default}`}>{value}</p>
      {sub && <p className="text-[11px] text-surface-500 mt-0.5 truncate">{sub}</p>}
    </Tag>
  );
}
