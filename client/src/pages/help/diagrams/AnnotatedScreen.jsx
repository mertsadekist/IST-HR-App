/**
 * Stylised, brand-coloured mockup of an app screen (sidebar + topbar + content)
 * with numbered callouts, plus an HTML legend mapping each number to a localized
 * label. Labels render as HTML (not inside SVG) so Arabic/RTL display correctly.
 *
 * props.items: [{ n: 1, label: '…' }, …]  (up to ~6 callouts)
 */
const SPOTS = [
  { x: 150, y: 70 },   // 1 — top content
  { x: 360, y: 70 },   // 2
  { x: 150, y: 140 },  // 3
  { x: 360, y: 140 },  // 4
  { x: 150, y: 205 },  // 5
  { x: 360, y: 205 },  // 6
];

export default function AnnotatedScreen({ items = [] }) {
  const spots = items.slice(0, SPOTS.length);
  return (
    <div className="rounded-xl border border-surface-200 bg-surface-50/60 p-4">
      <svg viewBox="0 0 480 260" className="w-full h-auto" role="img" aria-label="Screen layout">
        {/* window */}
        <rect x="6" y="6" width="468" height="248" rx="12" fill="#ffffff" stroke="#e2e8f0" />
        {/* sidebar */}
        <rect x="6" y="6" width="86" height="248" rx="12" fill="#1D1245" />
        <rect x="18" y="26" width="62" height="9" rx="4" fill="#ffffff" opacity="0.85" />
        {[58, 78, 98, 118, 138, 158, 178].map((y) => (
          <rect key={y} x="18" y={y} width="62" height="7" rx="3" fill="#ffffff" opacity="0.25" />
        ))}
        {/* topbar */}
        <rect x="92" y="6" width="382" height="34" fill="#ffffff" stroke="#eef2f7" />
        <rect x="104" y="17" width="120" height="12" rx="6" fill="#eef2f7" />
        <circle cx="452" cy="23" r="7" fill="#ede9fe" />
        {/* content cards */}
        {[58, 128, 198].map((y) => (
          <g key={y}>
            <rect x="108" y={y} width="160" height="56" rx="8" fill="#f8fafc" stroke="#eef2f7" />
            <rect x="296" y={y} width="160" height="56" rx="8" fill="#f8fafc" stroke="#eef2f7" />
          </g>
        ))}
        {/* numbered callouts */}
        {spots.map((it, i) => {
          const s = SPOTS[i];
          return (
            <g key={it.n}>
              <circle cx={s.x} cy={s.y} r="13" fill="#6D28D9" />
              <text x={s.x} y={s.y + 4} textAnchor="middle" fontSize="13" fontWeight="700" fill="#ffffff">{it.n}</text>
            </g>
          );
        })}
      </svg>
      {items.length > 0 && (
        <ol className="mt-3 space-y-1.5">
          {items.map((it) => (
            <li key={it.n} className="flex items-start gap-2 text-sm text-surface-600">
              <span className="mt-0.5 w-5 h-5 shrink-0 rounded-full bg-brand-600 text-white text-[11px] font-bold flex items-center justify-center">{it.n}</span>
              <span>{it.label}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
