import { BookUser, Stamp, IdCard, BadgeCheck, HeartPulse, ShieldAlert, Plus, Eye, BellRing } from 'lucide-react';
import { docTypeLabel } from '@utils/employeeDocs';
import { expiryTier, tierLabel, TIER_STYLES, currentByType, expiryAlerts } from './profileUtils';

// Shown in this order; the first three are expected for every employee.
const CARDS = [
  { type: 'Passport', icon: BookUser, required: true },
  { type: 'Residence Visa', icon: Stamp, required: true },
  { type: 'Emirates ID', icon: IdCard, required: true },
  { type: 'Labour Card', icon: BadgeCheck },
  { type: 'Health Insurance', icon: HeartPulse },
];

/** Banner listing every document that is expired or expires within 90 days. */
export function ExpiryAlerts({ docs, t, onOpen }) {
  const alerts = expiryAlerts(docs);
  if (!alerts.length) return null;
  const worst = expiryTier(alerts[0].days_left).tone;
  const frame = worst === 'red' ? 'border-red-200 bg-red-50' : worst === 'orange' ? 'border-orange-200 bg-orange-50' : 'border-amber-200 bg-amber-50';

  return (
    <div className={`rounded-2xl border ${frame} p-4`}>
      <div className="flex items-center gap-2 mb-2">
        <BellRing size={17} className={worst === 'red' ? 'text-red-600' : 'text-amber-600'} />
        <h3 className="text-sm font-bold text-surface-900">{t('empProfile.alerts_title', { count: alerts.length })}</h3>
        <span className="text-[11px] text-surface-500 hidden sm:inline">· {t('empProfile.alerts_hint')}</span>
      </div>
      <ul className="space-y-1.5">
        {alerts.map((d) => {
          const tier = expiryTier(d.days_left);
          const name = d.doc_type ? docTypeLabel(t, d.doc_type) : d.file_name;
          const text = d.days_left < 0
            ? t('empProfile.alert_expired', { doc: name, date: d.expiry_date, n: Math.abs(d.days_left) })
            : d.days_left === 0
              ? t('empProfile.alert_today', { doc: name, date: d.expiry_date })
              : t('empProfile.alert_upcoming', { doc: name, date: d.expiry_date, n: d.days_left });
          return (
            <li key={d.id}>
              <button type="button" onClick={() => onOpen(d)}
                className="w-full flex items-center gap-2.5 rounded-lg bg-white/70 hover:bg-white px-3 py-2 text-start transition">
                <span className={`w-2 h-2 rounded-full shrink-0 ${TIER_STYLES[tier.tone].dot}`} />
                <span className="flex-1 text-xs text-surface-800">
                  {text}
                  {d.doc_number && <span className="font-mono text-surface-500"> · {d.doc_number}</span>}
                </span>
                <span className={`shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 ${TIER_STYLES[tier.tone].pill}`}>{tierLabel(t, d.days_left)}</span>
                <Eye size={14} className="text-surface-400 shrink-0" />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Passport, residence visa, Emirates ID, labour card and health insurance at a
 * glance: number, expiry, days left and the reminder step it has reached.
 * A card opens the document; a missing required one points to the Documents tab.
 */
export default function IdentityDocuments({ docs, loading, t, onOpen, onAdd }) {
  const current = currentByType(docs);
  const cards = CARDS.filter((c) => c.required || current[c.type]);

  return (
    <div className="rounded-2xl border border-surface-200 bg-white p-4 sm:p-5 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <ShieldAlert size={17} className="text-brand-600" />
        <h3 className="text-sm font-bold text-surface-900">{t('empProfile.id_title')}</h3>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-5 gap-3">
        {cards.map(({ type, icon: Icon }) => {
          const d = current[type];
          if (loading) return <div key={type} className="h-[118px] rounded-xl bg-surface-100 animate-pulse" />;
          if (!d) {
            return (
              <button key={type} type="button" onClick={onAdd}
                className="rounded-xl border-2 border-dashed border-surface-200 p-3.5 text-start hover:border-brand-300 hover:bg-brand-50/30 transition">
                <div className="flex items-center gap-2 text-surface-400">
                  <Icon size={18} />
                  <span className="text-xs font-semibold">{docTypeLabel(t, type)}</span>
                </div>
                <p className="text-sm font-semibold text-red-600 mt-3">{t('empProfile.id_missing')}</p>
                <p className="text-[11px] text-surface-400 mt-1 flex items-center gap-1"><Plus size={12} /> {t('empProfile.id_add')}</p>
              </button>
            );
          }
          const tier = expiryTier(d.days_left);
          const st = TIER_STYLES[tier.tone];
          // Bar = share of the 90-day reminder window still left (full when further out).
          const pct = d.days_left == null ? 100 : Math.max(0, Math.min(100, Math.round((d.days_left / 90) * 100)));
          return (
            <button key={type} type="button" onClick={() => onOpen(d)}
              className={`rounded-xl border p-3.5 text-start hover:shadow-md transition group ${st.card}`}>
              <div className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-surface-600">
                  <Icon size={18} className="text-brand-600" />
                  <span className="text-xs font-semibold">{docTypeLabel(t, type)}</span>
                </span>
                <Eye size={14} className="text-surface-300 group-hover:text-brand-600" />
              </div>
              <p className="font-mono text-[15px] font-bold text-surface-900 mt-2 truncate" dir="ltr" title={d.doc_number || ''}>
                {d.doc_number || <span className="font-sans text-xs font-normal text-surface-400">{t('empProfile.id_no_number')}</span>}
              </p>
              <div className="flex items-center justify-between gap-2 mt-1.5">
                <span className="text-[11px] text-surface-500">
                  {d.expiry_date ? <>{t('empProfile.id_expires')} <span className="font-semibold text-surface-700 tabular-nums">{d.expiry_date}</span></> : t('empDocs.no_expiry')}
                </span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ring-1 whitespace-nowrap ${st.pill}`}>
                  {tier.key === 'valid' ? t('empProfile.days_left', { n: d.days_left }) : tierLabel(t, d.days_left)}
                </span>
              </div>
              {d.expiry_date && (
                <div className="h-1 rounded-full bg-surface-100 mt-2.5 overflow-hidden">
                  <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${pct}%` }} />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
