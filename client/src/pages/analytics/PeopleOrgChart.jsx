import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { ChevronDown, ChevronRight, Loader2, Search, UserCircle2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import * as employeesApi from '@api/employeesApi';

/** Nest people under their managers; anyone whose manager is not listed is a root. */
function buildTree(rows) {
  const byId = new Map(rows.map((r) => [r.id, { ...r, reports: [] }]));
  const roots = [];
  for (const n of byId.values()) {
    if (n.manager_employee_id && byId.has(n.manager_employee_id) && n.manager_employee_id !== n.id) byId.get(n.manager_employee_id).reports.push(n);
    else roots.push(n);
  }
  const byName = (a, b) => String(a.name).localeCompare(String(b.name));
  const sortDeep = (list) => { list.sort(byName); list.forEach((n) => sortDeep(n.reports)); return list; };
  return sortDeep(roots).sort((a, b) => b.reports.length - a.reports.length || byName(a, b));
}
const countAll = (n) => n.reports.reduce((s, r) => s + 1 + countAll(r), 0);

/**
 * The organization as people: who reports to whom, drawn from each employee's
 * direct manager. Anyone without a manager sits at the top level, so gaps in the
 * reporting lines are visible rather than hidden.
 */
export default function PeopleOrgChart({ t }) {
  const { currentCompanyId } = useSelector((s) => s.entity);
  const key = currentCompanyId ?? 'all';
  const [state, setState] = useState({ key: null, rows: [] });
  const [open, setOpen] = useState(() => new Set());
  const [q, setQ] = useState('');

  useEffect(() => {
    let off = false;
    employeesApi.getOrgPeople(currentCompanyId ? { company_id: currentCompanyId } : {})
      .then(({ data }) => { if (!off) setState({ key, rows: data || [] }); })
      .catch(() => { if (!off) setState({ key, rows: [] }); });
    return () => { off = true; };
  }, [key, currentCompanyId]);

  const tree = useMemo(() => buildTree(state.rows), [state.rows]);
  const managed = state.rows.filter((r) => r.manager_employee_id).length;
  const term = q.trim().toLowerCase();
  // When searching, show every branch that contains a match.
  const matches = (n) => !term || n.name.toLowerCase().includes(term) || n.reports.some(matches);
  const toggle = (id) => setOpen((s) => { const x = new Set(s); if (x.has(id)) x.delete(id); else x.add(id); return x; });

  const Node = ({ n, depth }) => {
    if (!matches(n)) return null;
    const expanded = term ? true : open.has(n.id) || depth === 0;
    const total = countAll(n);
    return (
      <li>
        <div className="flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-surface-50" style={{ paddingInlineStart: `${depth * 22 + 8}px` }}>
          {n.reports.length ? (
            <button type="button" onClick={() => toggle(n.id)} className="text-surface-400 hover:text-surface-700" aria-label={n.name}>
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} className="rtl:rotate-180" />}
            </button>
          ) : <span className="w-[14px]" />}
          <UserCircle2 size={18} className={n.reports.length ? 'text-brand-600' : 'text-surface-300'} />
          <Link to={`/employees?open=${n.id}`} className="text-sm font-medium text-surface-900 hover:text-brand-700 truncate">{n.name}</Link>
          <span className="text-xs text-surface-500 truncate">{[n.job_title, n.department_name].filter(Boolean).join(' · ')}</span>
          {n.short_code && <Badge variant="inactive" className="text-[9px]">{n.short_code}</Badge>}
          {n.status !== 'Active' && <Badge variant="warning" className="text-[9px]">{n.status}</Badge>}
          {total > 0 && <span className="ms-auto text-[11px] text-surface-400 whitespace-nowrap">{t('org.reports_count', { direct: n.reports.length, total })}</span>}
        </div>
        {expanded && n.reports.length > 0 && (
          <ul>{n.reports.map((r) => <Node key={r.id} n={r} depth={depth + 1} />)}</ul>
        )}
      </li>
    );
  };

  if (state.key !== key) return <div className="flex justify-center py-12"><Loader2 className="w-7 h-7 text-brand-600 animate-spin" /></div>;
  return (
    <Card className="!p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute top-1/2 -translate-y-1/2 start-3 text-surface-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('org.search')}
            className="text-sm border border-surface-200 rounded-lg ps-8 pe-3 py-2 w-64" aria-label={t('org.search')} />
        </div>
        <span className="text-xs text-surface-500">{t('org.coverage', { managed, total: state.rows.length })}</span>
      </div>
      {state.rows.length === 0 ? (
        <p className="text-sm text-surface-400 py-6 text-center">{t('org.none')}</p>
      ) : (
        <ul className="divide-y divide-surface-50">{tree.map((n) => <Node key={n.id} n={n} depth={0} />)}</ul>
      )}
      {managed < state.rows.length && <p className="text-[11px] text-surface-400">{t('org.coverage_hint')}</p>}
    </Card>
  );
}
