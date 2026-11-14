import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { Activity, Loader2, Search } from 'lucide-react';
import Card from '@components/ui/Card';
import * as attendanceApi from '@api/attendanceApi';

// Order on the board, and the colour of each state.
const STATES = ['not_in', 'late', 'in', 'expected', 'on_leave', 'absent', 'rest', 'no_schedule'];
const TONE = {
  not_in: 'bg-red-50 text-red-700 border-red-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  in: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  expected: 'bg-sky-50 text-sky-700 border-sky-200',
  on_leave: 'bg-violet-50 text-violet-700 border-violet-200',
  absent: 'bg-red-50 text-red-700 border-red-200',
  rest: 'bg-surface-50 text-surface-500 border-surface-200',
  no_schedule: 'bg-surface-50 text-surface-500 border-surface-200',
};
const REFRESH_MS = 60_000;

/**
 * Today, live: who is in, who is late, who has not arrived though their shift
 * has started, who is on leave or resting. Refreshes every minute from the door
 * feed. The feed keeps first and latest punch only, so someone who punched is
 * shown as in, with the time they were last seen.
 */
export default function AttendanceBoard() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [tick, setTick] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${tick}`;
  const [state, setState] = useState({ key: null, data: null });
  const [filter, setFilter] = useState('');
  const [q, setQ] = useState('');

  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let off = false;
    attendanceApi.live()
      .then(({ data }) => { if (!off) setState({ key, data }); })
      .catch(() => { if (!off) setState((s) => ({ key, data: s.data })); });
    return () => { off = true; };
  }, [key]);

  const data = state.data;
  const people = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (data?.people || [])
      .filter((p) => (!filter || p.state === filter) && (!needle || `${p.name} ${p.department || ''}`.toLowerCase().includes(needle)))
      .sort((a, b) => STATES.indexOf(a.state) - STATES.indexOf(b.state) || a.name.localeCompare(b.name));
  }, [data, filter, q]);
  const clock = data ? `${String(Math.floor(data.now / 3600)).padStart(2, '0')}:${String(Math.floor((data.now % 3600) / 60)).padStart(2, '0')}` : '';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><Activity className="text-brand-600" /> {t('att_board.title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('att_board.subtitle')}</p>
        </div>
        {data && <span className="ms-auto text-xs text-surface-500">{t('att_board.as_of', { date: data.date, time: clock })}</span>}
      </div>

      {!data ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {STATES.map((s) => (
              <button key={s} type="button" onClick={() => setFilter(filter === s ? '' : s)}
                className={`text-start rounded-xl border px-3 py-2 transition ${TONE[s]} ${filter === s ? 'ring-2 ring-brand-400' : ''}`}>
                <span className="block text-2xl font-bold">{data.counts[s] || 0}</span>
                <span className="text-[11px]">{t(`att_board.state.${s}`)}</span>
              </button>
            ))}
          </div>

          <div className="relative max-w-sm">
            <Search size={14} className="absolute start-3 top-1/2 -translate-y-1/2 text-surface-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('att_board.search')}
              className="w-full text-sm bg-white border border-surface-200 rounded-xl ps-8 pe-3 py-2" />
          </div>

          <Card className="!p-0 overflow-hidden">
            {people.length === 0 ? (
              <p className="text-sm text-surface-500 text-center py-8">{t('att_board.empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-50 text-surface-500 text-xs">
                    <tr>
                      <th className="text-start p-3">{t('att_board.col.person')}</th>
                      <th className="text-start p-3">{t('att_board.col.state')}</th>
                      <th className="text-start p-3">{t('att_board.col.shift')}</th>
                      <th className="text-start p-3">{t('att_board.col.first_in')}</th>
                      <th className="text-start p-3">{t('att_board.col.last_seen')}</th>
                      <th className="text-start p-3">{t('att_board.col.note')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {people.map((p) => (
                      <tr key={p.id} className="border-t border-surface-50">
                        <td className="p-3">
                          <span className="text-surface-800">{p.name}</span>
                          {p.department && <span className="block text-[11px] text-surface-400">{p.department}</span>}
                        </td>
                        <td className="p-3"><span className={`inline-block rounded-lg border px-2 py-0.5 text-[11px] ${TONE[p.state]}`}>{t(`att_board.state.${p.state}`)}</span></td>
                        <td className="p-3 font-mono text-xs text-surface-600">
                          {p.expected_in ? `${p.expected_in}–${p.expected_out}` : '—'}
                          {(p.shift_source === 'shift' || p.shift_source === 'day_off') && <span className="ms-1 text-[10px] text-brand-600 font-sans">{t('att_board.override')}</span>}
                        </td>
                        <td className="p-3 font-mono text-xs">{p.check_in || '—'}{p.late_minutes ? <span className="text-amber-700 font-sans"> (+{p.late_minutes} {t('att_board.min')})</span> : ''}</td>
                        <td className="p-3 font-mono text-xs">{p.last_seen || '—'}</td>
                        <td className="p-3 text-xs text-surface-500">{p.leave_type || p.holiday || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
          <p className="text-[11px] text-surface-400">{t('att_board.footnote')}</p>
        </>
      )}
    </div>
  );
}
