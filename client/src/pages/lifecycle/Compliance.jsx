import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { ShieldCheck, ChevronLeft, ChevronRight, Loader2, Save } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import AttentionList from '@components/compliance/AttentionList';
import * as complianceApi from '@api/complianceApi';

const KIND_TONE = {
  wps_late: 'bg-red-50 text-red-700', salary_month_end: 'bg-surface-100 text-surface-700',
  emiratisation_midyear: 'bg-violet-50 text-violet-700', emiratisation_yearend: 'bg-violet-50 text-violet-700',
  document_expiry: 'bg-amber-50 text-amber-800', company_document_expiry: 'bg-amber-50 text-amber-800',
  training_expiry: 'bg-sky-50 text-sky-800', settlement_due: 'bg-red-50 text-red-700',
  last_working_day: 'bg-surface-100 text-surface-700', holiday: 'bg-rose-50 text-rose-700',
};
const money = (n) => Number(n || 0).toLocaleString();

/**
 * Compliance: what needs attention, the month's deadlines in one list, and
 * Emiratisation per company against the year's target, with the statutory
 * figures an admin keeps current.
 */
export default function Compliance() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const [tab, setTab] = useState('attention');
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><ShieldCheck className="text-brand-600" /> {t('compliance.title')}</h1>
        <p className="text-sm text-surface-500 mt-1">{t('compliance.subtitle')}</p>
      </div>
      <div className="flex gap-1 border-b border-surface-100">
        {['attention', 'calendar', 'emiratisation'].map((tb) => (
          <button key={tb} type="button" onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === tb ? 'border-brand-600 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>{t(`compliance.tab_${tb}`)}</button>
        ))}
      </div>
      {tab === 'attention' && <AttentionList t={t} />}
      {tab === 'calendar' && <ComplianceCalendar t={t} />}
      {tab === 'emiratisation' && <Emiratisation t={t} isAdmin={isAdmin} />}
    </div>
  );
}

function ComplianceCalendar({ t }) {
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const key = `${currentCompanyId ?? 'all'}:${month}`;
  const [state, setState] = useState({ key: null, events: [] });

  useEffect(() => {
    let off = false;
    complianceApi.getCalendar(month)
      .then(({ data }) => { if (!off) setState({ key, events: data.events }); })
      .catch(() => { if (!off) setState({ key, events: [] }); });
    return () => { off = true; };
  }, [key, month]);

  const byDate = useMemo(() => {
    const m = new Map();
    for (const e of state.events) { if (!m.has(e.date)) m.set(e.date, []); m.get(e.date).push(e); }
    return [...m.entries()];
  }, [state.events]);
  const shift = (k) => setMonth(dayjs(`${month}-01`).add(k, 'month').format('YYYY-MM'));
  const label = (e) => t(`compliance.kind.${e.kind}`, { period: e.period ? dayjs(`${e.period}-01`).format('MMMM YYYY') : '' });

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center gap-2 p-3 border-b border-surface-100">
        <button type="button" onClick={() => shift(-1)} className="p-1.5 rounded-lg hover:bg-surface-100" aria-label={t('compliance.prev')}><ChevronLeft size={16} className="rtl:rotate-180" /></button>
        <span className="font-semibold text-surface-800 min-w-[120px] text-center">{dayjs(`${month}-01`).format('MMMM YYYY')}</span>
        <button type="button" onClick={() => shift(1)} className="p-1.5 rounded-lg hover:bg-surface-100" aria-label={t('compliance.next')}><ChevronRight size={16} className="rtl:rotate-180" /></button>
      </div>
      {state.key !== key ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : byDate.length === 0 ? (
        <p className="text-sm text-surface-400 text-center py-8">{t('compliance.calendar_empty')}</p>
      ) : (
        <ul className="divide-y divide-surface-50">
          {byDate.map(([date, events]) => (
            <li key={date} className="flex gap-4 px-4 py-3">
              <div className="w-14 shrink-0 text-center">
                <span className="block text-xl font-bold text-surface-900">{dayjs(date).date()}</span>
                <span className="text-[11px] text-surface-400">{dayjs(date).format('ddd')}</span>
              </div>
              <div className="flex-1 space-y-1">
                {events.map((e, i) => {
                  const body = (
                    <span className="inline-flex items-center gap-2 flex-wrap">
                      <span className={`rounded px-1.5 py-0.5 text-[11px] ${KIND_TONE[e.kind] || 'bg-surface-100 text-surface-700'}`}>{label(e)}</span>
                      {e.title && <span className="text-sm text-surface-700">{e.title}</span>}
                    </span>
                  );
                  return <div key={i}>{e.link ? <Link to={e.link} className="hover:underline">{body}</Link> : body}</div>;
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-surface-400 px-4 py-2 border-t border-surface-50">{t('compliance.calendar_hint')}</p>
    </Card>
  );
}

function Emiratisation({ t, isAdmin }) {
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [year, setYear] = useState(dayjs().year());
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${year}:${reload}`;
  const [state, setState] = useState({ key: null, data: null });
  const [edit, setEdit] = useState({ key: 'emiratisation_target_percent', year: dayjs().year(), value: '', note: '' });

  useEffect(() => {
    let off = false;
    complianceApi.getEmiratisation(year)
      .then(({ data }) => { if (!off) setState({ key, data }); })
      .catch(() => { if (!off) setState({ key, data: null }); });
    return () => { off = true; };
  }, [key, year]);

  const save = async () => {
    try { await complianceApi.setLawValue(edit); toast.success(t('compliance.law_saved')); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const d = state.key === key ? state.data : null;
  const input = 'text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className={input}>
          {[-1, 0, 1, 2].map((k) => <option key={k} value={dayjs().year() + k}>{dayjs().year() + k}</option>)}
        </select>
        {d && (
          <span className="text-sm text-surface-600">
            {t('compliance.emi_rule', { pct: d.target_percent ?? '—', fine: money(d.fine_per_year), min: d.min_headcount ?? '—' })}
          </span>
        )}
      </div>
      <Card className="!p-0 overflow-hidden">
        {!d ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div> : (
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
              <th className="text-start p-3">{t('compliance.col.company')}</th><th className="p-3">{t('compliance.col.headcount')}</th>
              <th className="p-3">{t('compliance.col.nationals')}</th><th className="p-3">{t('compliance.col.required')}</th>
              <th className="p-3">{t('compliance.col.gap')}</th><th className="p-3 text-end">{t('compliance.col.fine')}</th>
            </tr></thead>
            <tbody>
              {d.companies.map((c) => (
                <tr key={c.company_id} className="border-t border-surface-50">
                  <td className="p-3">{c.company_name}{!c.applies && <Badge variant="inactive" className="text-[10px] ms-1.5">{t('compliance.not_applicable')}</Badge>}</td>
                  <td className="p-3 text-center">{c.headcount}</td>
                  <td className="p-3 text-center">{c.nationals} <span className="text-[11px] text-surface-400">({c.actual_percent}%)</span></td>
                  <td className="p-3 text-center">{c.applies ? c.required : '—'}</td>
                  <td className={`p-3 text-center font-semibold ${c.gap > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{c.applies ? c.gap : '—'}</td>
                  <td className="p-3 text-end font-mono">{c.gap > 0 ? money(c.fine) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <p className="text-[11px] text-surface-500">{t('compliance.emi_hint')}</p>

      {d && (
        <Card className="!p-4 space-y-3">
          <h3 className="text-sm font-semibold text-surface-800">{t('compliance.law_title')}</h3>
          <table className="w-full text-xs">
            <thead className="text-surface-500"><tr><th className="text-start py-1">{t('compliance.law_key')}</th><th className="py-1">{t('compliance.law_year')}</th><th className="py-1 text-end">{t('compliance.law_value')}</th><th className="text-start py-1 ps-3">{t('compliance.law_note')}</th></tr></thead>
            <tbody>
              {d.law.map((l) => (
                <tr key={`${l.key}:${l.year}`} className="border-t border-surface-50">
                  <td className="py-1.5">{t(`compliance.law.${l.key}`)}</td><td className="py-1.5 text-center">{l.year}</td>
                  <td className="py-1.5 text-end font-mono">{money(l.value)}</td><td className="py-1.5 ps-3 text-surface-500">{l.note || ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {isAdmin && (
            <div className="flex gap-2 flex-wrap items-center pt-2 border-t border-surface-100">
              <select value={edit.key} onChange={(e) => setEdit((p) => ({ ...p, key: e.target.value }))} className={input}>
                {['emiratisation_target_percent', 'emiratisation_fine_per_year', 'emiratisation_min_headcount'].map((k) => <option key={k} value={k}>{t(`compliance.law.${k}`)}</option>)}
              </select>
              <input type="number" value={edit.year} onChange={(e) => setEdit((p) => ({ ...p, year: e.target.value }))} className={`${input} w-24`} />
              <input type="number" value={edit.value} onChange={(e) => setEdit((p) => ({ ...p, value: e.target.value }))} placeholder={t('compliance.law_value')} className={`${input} w-32`} />
              <input value={edit.note} onChange={(e) => setEdit((p) => ({ ...p, note: e.target.value }))} placeholder={t('compliance.law_note_ph')} className={`${input} flex-1 min-w-[180px]`} />
              <Button size="sm" onClick={save}><Save size={14} /> {t('common.save')}</Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
