import { useEffect, useMemo, useState } from 'react';
import { History, UserPlus, FileText, Laptop, Plane } from 'lucide-react';
import dayjs from 'dayjs';
import Card from '@components/ui/Card';
import EmptyState from '@components/ui/EmptyState';
import * as employeesApi from '@api/employeesApi';

const SOURCES = {
  Onboarding: { icon: UserPlus, color: 'bg-emerald-100 text-emerald-700' },
  Document: { icon: FileText, color: 'bg-blue-100 text-blue-700' },
  Asset: { icon: Laptop, color: 'bg-amber-100 text-amber-700' },
  Leave: { icon: Plane, color: 'bg-brand-100 text-brand-700' },
};

function sourceLabel(t, s) {
  switch (s) {
    case 'Onboarding': return t('empProfile.src_onboarding');
    case 'Document': return t('empProfile.src_document');
    case 'Asset': return t('empProfile.src_asset');
    case 'Leave': return t('empProfile.src_leave');
    default: return s;
  }
}

/**
 * Everything recorded about the employee, newest first: onboarding milestones,
 * documents, assets handed over or returned, and leave. Same data as the
 * "Export Record" PDF, readable on screen.
 */
export default function EmployeeTimelineTab({ employee, t }) {
  const [items, setItems] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== employee.id;
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    let alive = true;
    const id = employee.id;
    employeesApi.getEmployeeHistory(id)
      .then(({ data }) => { if (alive) setItems([...(data?.timeline || [])].reverse()); })
      .catch(() => { if (alive) setItems([]); })
      .finally(() => { if (alive) setLoadedFor(id); });
    return () => { alive = false; };
  }, [employee.id]);

  const counts = useMemo(() => items.reduce((m, x) => ({ ...m, [x.source]: (m[x.source] || 0) + 1 }), {}), [items]);
  const shown = filter === 'all' ? items : items.filter((x) => x.source === filter);
  // Grouped by year so a long record stays scannable.
  const byYear = useMemo(() => shown.reduce((m, x) => {
    const y = dayjs(x.occurred_at).format('YYYY');
    (m[y] = m[y] || []).push(x);
    return m;
  }, {}), [shown]);

  if (loading) return <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>;
  if (!items.length) {
    return <Card><EmptyState icon={<History className="w-6 h-6 text-surface-400" />} title={t('empProfile.tl_none')} description={t('empProfile.tl_none_desc')} /></Card>;
  }

  const chip = (value, text, n) => (
    <button key={value} type="button" onClick={() => setFilter(value)} aria-pressed={filter === value}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${filter === value ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-surface-200 text-surface-600 hover:bg-surface-50'}`}>
      {text} <span className="opacity-70">({n})</span>
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {chip('all', t('empProfile.tl_all'), items.length)}
        {Object.keys(SOURCES).filter((s) => counts[s]).map((s) => chip(s, sourceLabel(t, s), counts[s]))}
      </div>

      {Object.keys(byYear).sort().reverse().map((y) => (
        <div key={y}>
          <p className="text-xs font-bold text-surface-400 mb-2">{y}</p>
          <ol className="relative border-s border-surface-200 ms-3 space-y-3">
            {byYear[y].map((x, i) => {
              const S = SOURCES[x.source] || SOURCES.Document;
              const Icon = S.icon;
              return (
                <li key={`${x.occurred_at}-${i}`} className="ms-6">
                  <span className={`absolute -start-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white ${S.color}`}>
                    <Icon size={12} />
                  </span>
                  <div className="bg-white border border-surface-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      <span className="font-semibold text-surface-900">{x.type || sourceLabel(t, x.source)}</span>
                      <span className="text-surface-400">· {sourceLabel(t, x.source)}</span>
                      <span className="ms-auto text-surface-400 whitespace-nowrap">{dayjs(x.occurred_at).format('MMM D, YYYY')}</span>
                    </div>
                    {x.description && <p className="text-xs text-surface-600 mt-1 break-words">{x.description}</p>}
                    {x.actor && <p className="text-[11px] text-surface-400 mt-0.5">{t('empProfile.tl_by', { name: x.actor })}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      ))}
    </div>
  );
}
