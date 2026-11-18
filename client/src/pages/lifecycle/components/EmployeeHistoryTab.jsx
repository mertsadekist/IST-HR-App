import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import * as employeesApi from '@api/employeesApi';

const show = (v) => (v === null || v === undefined || v === '' ? '—' : String(v));

/**
 * Everything recorded about this person, newest first: who did what and when,
 * and for edits the fields that changed, before → after. Bank numbers are
 * masked. Entries start from when record history was switched on.
 */
export default function EmployeeHistoryTab({ employee, t }) {
  const [state, setState] = useState({ id: null, rows: [] });

  useEffect(() => {
    let off = false;
    employeesApi.getHistory(employee.id)
      .then(({ data }) => { if (!off) setState({ id: employee.id, rows: data }); })
      .catch(() => { if (!off) setState({ id: employee.id, rows: [] }); });
    return () => { off = true; };
  }, [employee.id]);

  if (state.id !== employee.id) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;
  if (!state.rows.length) return <p className="text-sm text-surface-400 text-center py-8">{t('history.empty')}</p>;
  return (
    <div className="space-y-3">
      <ol className="relative border-s border-surface-200 ms-2 space-y-4">
        {state.rows.map((r) => (
          <li key={r.id} className="ms-4">
            <span className="absolute -start-1.5 mt-1.5 w-3 h-3 rounded-full bg-brand-500 border-2 border-white" />
            <p className="text-sm text-surface-800"><span className="font-medium">{r.action}</span> <span className="text-surface-400 text-xs">· {r.module}</span></p>
            <p className="text-xs text-surface-500">{String(r.created_at).replace('T', ' ').slice(0, 16)} · {r.user_name}</p>
            {r.changes?.length > 0 ? (
              <table className="mt-1.5 text-xs">
                <tbody>
                  {r.changes.map((c, i) => (
                    <tr key={i}>
                      <td className="pe-3 py-0.5 text-surface-500 font-mono">{t(`history.field.${c.field}`, { defaultValue: c.field })}</td>
                      <td className="pe-2 py-0.5 text-red-600 line-through">{show(c.from)}</td>
                      <td className="py-0.5 text-emerald-700">→ {show(c.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : r.detail && <p className="text-xs text-surface-600 mt-0.5">{r.detail}</p>}
          </li>
        ))}
      </ol>
      <p className="text-[11px] text-surface-400">{t('history.note')}</p>
    </div>
  );
}
