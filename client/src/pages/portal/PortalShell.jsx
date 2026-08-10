/**
 * The banner every portal page opens with.
 *
 * The employee's portal is four separate pages rather than one long scroll, so
 * each needs to say plainly which one you are on. The stat chips carry the two
 * or three numbers that page is actually about — a headline, not a summary of
 * the whole portal.
 */
export default function PortalShell({ icon: Icon, title, subtitle, stats = [], actions, children }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-20 -translate-x-20" />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
            <Icon className="text-white" size={26} />
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && <p className="text-brand-200 text-sm mt-0.5">{subtitle}</p>}
          </div>
          <div className="ms-auto flex items-center gap-3 flex-wrap">
            {stats.map((s, i) => (
              <div key={i} className="text-center bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                <span className="block text-2xl font-bold text-white">{s.value}</span>
                <span className="text-xs text-brand-200">{s.label}</span>
              </div>
            ))}
            {actions}
          </div>
        </div>
      </div>
      {children}
    </div>
  );
}
