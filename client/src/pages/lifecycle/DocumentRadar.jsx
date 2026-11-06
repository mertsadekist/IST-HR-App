import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Radar, AlertTriangle, CalendarClock, CalendarRange, UserX, Loader2, ArrowRight } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import * as employeesApi from '@api/employeesApi';
import { EMPLOYEE_DOC_TYPES, docTypeLabel, expiryBadge } from '@utils/employeeDocs';

const WINDOWS = ['attention', 'expired', '30', '90', 'all'];

/**
 * Document Radar: every employee passport, residence visa, Emirates ID and
 * labour card with a recorded expiry, soonest first — and the people who have
 * no dated record of a document they must hold. The same dates drive the
 * 90/60/30/14/7/1-day notifications.
 */
export default function DocumentRadar() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  // Loading is derived, not set: the result remembers which entity it was
  // fetched for, so switching company shows the spinner until its own answer.
  const scopeKey = currentCompanyId ?? 'all';
  const [result, setResult] = useState({ key: null, data: null });
  const loading = result.key !== scopeKey;
  const data = result.data;
  const [windowKey, setWindowKey] = useState('attention');
  const [docType, setDocType] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    employeesApi.getDocumentRadar(currentCompanyId ? { company_id: currentCompanyId } : {})
      .then(({ data: d }) => { if (!cancelled) setResult({ key: scopeKey, data: d }); })
      .catch(() => {
        if (cancelled) return;
        toast.error(t('docRadar.load_failed'));
        setResult({ key: scopeKey, data: null });
      });
    return () => { cancelled = true; };
  }, [currentCompanyId, scopeKey, t]);

  const q = search.trim().toLowerCase();
  const matchesName = (name) => !q || String(name || '').toLowerCase().includes(q);

  const items = useMemo(() => (data?.items || []).filter((d) => {
    if (docType && d.doc_type !== docType) return false;
    if (!matchesName(d.employee_name)) return false;
    switch (windowKey) {
      case 'expired': return d.days_left < 0;
      case '30': return d.days_left >= 0 && d.days_left <= 30;
      case '90': return d.days_left >= 0 && d.days_left <= 90;
      case 'attention': return d.days_left <= 90;
      default: return true;
    }
  }), [data, docType, windowKey, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = useMemo(() => (data?.missing || []).filter((p) =>
    matchesName(p.employee_name) && (!docType || p.missing.includes(docType))),
  [data, docType, q]); // eslint-disable-line react-hooks/exhaustive-deps

  const counts = data?.counts || {};
  const stats = [
    { key: 'expired', icon: AlertTriangle, label: t('docRadar.stat_expired'), value: counts.expired, tone: 'text-red-600 bg-red-50' },
    { key: '30', icon: CalendarClock, label: t('docRadar.stat_30'), value: counts.within_30, tone: 'text-amber-600 bg-amber-50' },
    { key: '90', icon: CalendarRange, label: t('docRadar.stat_90'), value: counts.within_90, tone: 'text-blue-600 bg-blue-50' },
    { key: 'missing', icon: UserX, label: t('docRadar.stat_missing'), value: counts.employees_missing, tone: 'text-surface-600 bg-surface-100' },
  ];
  const windowLabel = (w) => ({
    attention: t('docRadar.win_attention'), expired: t('docRadar.win_expired'),
    30: t('docRadar.win_30'), 90: t('docRadar.win_90'), all: t('docRadar.win_all'),
  })[w];
  const showCompany = !currentCompanyId;
  const profileLink = (id) => `/employees?open=${id}&tab=documents`;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
          <Radar className="text-brand-600" /> {t('docRadar.title')}
        </h1>
        <p className="text-sm text-surface-500 mt-1">{t('docRadar.subtitle')}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.key} className="!p-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${s.tone}`}><Icon size={18} /></div>
                <div>
                  <p className="text-2xl font-bold text-surface-900">{loading ? '–' : Number(s.value || 0)}</p>
                  <p className="text-xs text-surface-500">{s.label}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="!p-4">
        <div className="flex flex-col md:flex-row gap-3 md:items-center">
          <div className="flex flex-wrap gap-1">
            {WINDOWS.map((w) => (
              <button key={w} type="button" onClick={() => setWindowKey(w)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  windowKey === w ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
                {windowLabel(w)}
              </button>
            ))}
          </div>
          <select value={docType} onChange={(e) => setDocType(e.target.value)}
            className="text-xs bg-white border border-surface-200 rounded-lg p-2 md:w-48" aria-label={t('empDocs.doc_type')}>
            <option value="">{t('docRadar.all_types')}</option>
            {EMPLOYEE_DOC_TYPES.map((type) => <option key={type} value={type}>{docTypeLabel(t, type)}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('docRadar.search')}
            className="text-xs bg-white border border-surface-200 rounded-lg p-2 md:w-56" aria-label={t('docRadar.search')} />
        </div>
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100">
          <h2 className="text-sm font-semibold text-surface-900">{t('docRadar.tracked_title')}</h2>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        ) : items.length === 0 ? (
          <p className="text-center py-10 text-sm text-surface-400">{t('docRadar.tracked_empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-surface-50 text-surface-600">
                  <th className="p-3 text-start font-semibold">{t('docRadar.employee')}</th>
                  {showCompany && <th className="p-3 text-start font-semibold">{t('docRadar.company')}</th>}
                  <th className="p-3 text-start font-semibold">{t('empDocs.doc_type')}</th>
                  <th className="p-3 text-start font-semibold">{t('empDocs.doc_number')}</th>
                  <th className="p-3 text-start font-semibold">{t('empDocs.expiry_date')}</th>
                  <th className="p-3 text-start font-semibold">{t('docRadar.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {items.map((d) => {
                  const badge = expiryBadge(t, d.days_left);
                  return (
                    <tr key={d.id} className="hover:bg-surface-50/60">
                      <td className="p-3">
                        <Link to={profileLink(d.employee_id)} className="font-medium text-brand-700 hover:underline">{d.employee_name}</Link>
                      </td>
                      {showCompany && <td className="p-3 text-surface-600">{d.company_name}</td>}
                      <td className="p-3 text-surface-800">{d.doc_type ? docTypeLabel(t, d.doc_type) : d.category}</td>
                      <td className="p-3 font-mono text-surface-700">{d.doc_number || '—'}</td>
                      <td className="p-3 text-surface-800 whitespace-nowrap">{d.expiry_date}</td>
                      <td className="p-3"><Badge variant={badge.variant} className="text-[10px]">{badge.text}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="px-4 py-3 border-b border-surface-100">
          <h2 className="text-sm font-semibold text-surface-900">{t('docRadar.missing_title')}</h2>
          <p className="text-xs text-surface-500 mt-0.5">{t('docRadar.missing_desc')}</p>
        </div>
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        ) : missing.length === 0 ? (
          <p className="text-center py-10 text-sm text-surface-400">{t('docRadar.missing_empty')}</p>
        ) : (
          <ul className="divide-y divide-surface-100">
            {missing.map((p) => (
              <li key={p.employee_id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2">
                <div className="sm:w-56 shrink-0">
                  <p className="text-sm font-medium text-surface-900">{p.employee_name}</p>
                  {showCompany && <p className="text-[11px] text-surface-500">{p.company_name}</p>}
                </div>
                <div className="flex flex-wrap gap-1 flex-1">
                  {p.missing.map((type) => <Badge key={type} variant="warning" className="text-[10px]">{docTypeLabel(t, type)}</Badge>)}
                </div>
                <Link to={profileLink(p.employee_id)} className="text-xs font-medium text-brand-700 flex items-center gap-1 shrink-0">
                  {t('docRadar.add_documents')} <ArrowRight size={12} className="rtl:rotate-180" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
