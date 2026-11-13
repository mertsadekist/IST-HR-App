import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { Timer, ScanSearch, Plus, Loader2, Check, X, Trash2, Lock } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import * as otApi from '@api/overtimeApi';
import * as employeesApi from '@api/employeesApi';
import { confirmDelete } from '@utils/confirm';
import { money } from '@utils/payslipLines';

const apiErr = (e, f) => e?.response?.data?.error || f;
const hm = (m) => (m ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}` : '—');
const toMin = (v) => {
  // "1:30" or "1.5" (hours) → minutes
  const s = String(v || '').trim();
  if (!s) return 0;
  if (s.includes(':')) { const [h, m] = s.split(':'); return (Number(h) || 0) * 60 + (Number(m) || 0); }
  return Math.round((Number(s) || 0) * 60);
};
const statusVariant = { Pending: 'pending', Approved: 'success', Rejected: 'inactive' };

/**
 * Overtime: found in the door attendance (or entered by HR), approved — for fewer
 * minutes if the evening was not work — and then paid by the payroll run of its
 * month at the legal rates. Nothing is paid until approved.
 */
export default function Overtime() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const canDecide = ['admin', 'hr_manager'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const [period, setPeriod] = useState(dayjs().subtract(dayjs().date() < 5 ? 1 : 0, 'month').format('YYYY-MM'));
  const [status, setStatus] = useState('');
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${period}:${status}:${reload}`;
  const [state, setState] = useState({ key: null, rows: [], rates: null });
  const [busy, setBusy] = useState(false);
  const [approveDlg, setApproveDlg] = useState(null); // { row, normal, night, rest, note }
  const [addForm, setAddForm] = useState(null);
  const [employees, setEmployees] = useState([]);
  const refresh = () => setReload((r) => r + 1);

  useEffect(() => {
    let off = false;
    const params = { period, ...(status ? { status } : {}), ...(currentCompanyId ? { company_id: currentCompanyId } : {}) };
    otApi.getOvertime(params)
      .then(({ data }) => { if (!off) setState({ key, rows: data.rows, rates: data.rates }); })
      .catch(() => { if (!off) { setState({ key, rows: [], rates: null }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, period, status, currentCompanyId, t]);

  const totals = useMemo(() => state.rows.reduce((s, r) => {
    if (r.status === 'Pending') s.pending += 1;
    if (r.status === 'Approved') {
      s.minutes += (r.approved_normal || 0) + (r.approved_night || 0) + (r.approved_rest || 0);
      s.amount += Number(r.amount || 0);
    }
    return s;
  }, { pending: 0, minutes: 0, amount: 0 }), [state.rows]);

  const act = async (fn, okMsg) => {
    setBusy(true);
    try {
      const { data } = await fn();
      toast.success(data?.needs_regenerate ? t('overtime.done_regenerate') : okMsg);
      setApproveDlg(null); setAddForm(null); refresh();
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
    finally { setBusy(false); }
  };

  const detect = async () => {
    if (!currentCompanyId) { toast.error(t('overtime.select_company')); return; }
    setBusy(true);
    try {
      const { data } = await otApi.detectOvertime(period, { company_id: currentCompanyId });
      toast.success(t('overtime.detected', { created: data.created, scanned: data.scanned }));
      refresh();
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
    finally { setBusy(false); }
  };

  const openAdd = () => {
    setAddForm({ employee_id: '', work_date: '', normal: '', night: '', rest: '', reason: '' });
    employeesApi.getEmployees({ ...(currentCompanyId ? { company_id: currentCompanyId } : {}), status: 'Active,Onboarding,Offboarding', limit: 500 })
      .then(({ data }) => setEmployees(data.data || data || [])).catch(() => setEmployees([]));
  };
  const remove = async (r) => {
    const c = await confirmDelete(`${r.employee_name} ${r.work_date}`);
    if (c.isConfirmed) act(() => otApi.deleteOvertime(r.id), t('common.deleted'));
  };

  const input = 'w-full text-sm bg-white border border-surface-200 rounded-xl px-3 py-2';
  const field = (label, el) => <label className="block"><span className="block text-xs font-medium text-surface-600 mb-1">{label}</span>{el}</label>;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><Timer className="text-brand-600" /> {t('overtime.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('overtime.subtitle')}</p>
        </div>
        {canDecide && (
          <div className="flex gap-2">
            <Button variant="secondary" onClick={openAdd}><Plus size={16} /> {t('overtime.add')}</Button>
            <Button onClick={detect} loading={busy}><ScanSearch size={16} /> {t('overtime.detect')}</Button>
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-2" aria-label={t('overtime.month')} />
        <div className="flex gap-1">
          {['', 'Pending', 'Approved', 'Rejected'].map((s) => (
            <button key={s || 'all'} type="button" onClick={() => setStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium ${status === s ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
              {s === '' ? t('overtime.all') : s === 'Pending' ? t('overtime.st_pending') : s === 'Approved' ? t('overtime.st_approved') : t('overtime.st_rejected')}
            </button>
          ))}
        </div>
        <span className="text-sm text-surface-600 ms-auto">
          {t('overtime.summary', { pending: totals.pending, hours: hm(totals.minutes), amount: money(totals.amount) })}
        </span>
      </div>
      {state.rates && (
        <p className="text-xs text-surface-500">{t('overtime.rates_note', { normal: state.rates.normal, night: state.rates.night, rest: state.rates.rest })}</p>
      )}

      <Card className="!p-0 overflow-x-auto">
        {state.key !== key ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        ) : state.rows.length === 0 ? (
          <p className="text-center py-10 text-sm text-surface-400">{t('overtime.none', { period })}</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
              <th className="text-start p-3">{t('overtime.employee')}</th>
              <th className="text-start p-3">{t('overtime.date')}</th>
              <th className="p-3">{t('overtime.punches')}</th>
              <th className="p-3">{t('overtime.normal')}</th>
              <th className="p-3">{t('overtime.night')}</th>
              <th className="p-3">{t('overtime.rest')}</th>
              <th className="p-3">{t('overtime.amount')}</th>
              <th className="text-start p-3">{t('overtime.status')}</th>
              <th className="p-3" />
            </tr></thead>
            <tbody>{state.rows.map((r) => {
              const approved = r.status === 'Approved';
              const cell = (found, ok) => (approved && ok !== found
                ? <span><s className="text-surface-300">{hm(found)}</s> {hm(ok)}</span> : hm(approved ? ok : found));
              return (
                <tr key={r.id} className="border-t border-surface-50">
                  <td className="p-3">{r.employee_name}
                    {r.source === 'Manual' && <Badge variant="inactive" className="text-[9px] ms-1">{t('overtime.manual')}</Badge>}
                    {r.reason && <span className="block text-[11px] text-surface-400">{r.reason}</span>}
                  </td>
                  <td className="p-3 whitespace-nowrap">{r.work_date}</td>
                  <td className="p-3 text-center text-xs text-surface-500 font-mono">{r.check_in ? `${r.check_in.slice(0, 5)}–${(r.check_out || '').slice(0, 5)}` : '—'}</td>
                  <td className="p-3 text-center font-mono">{cell(r.normal_minutes, r.approved_normal)}</td>
                  <td className="p-3 text-center font-mono">{cell(r.night_minutes, r.approved_night)}</td>
                  <td className="p-3 text-center font-mono">{cell(r.rest_minutes, r.approved_rest)}</td>
                  <td className="p-3 text-center font-mono" title={r.explanation}>{r.status === 'Rejected' ? '—' : money(r.amount)}</td>
                  <td className="p-3">
                    <Badge variant={statusVariant[r.status]} className="text-[10px]">
                      {r.locked && <Lock size={10} />} {r.status === 'Pending' ? t('overtime.st_pending') : r.status === 'Approved' ? t('overtime.st_approved') : t('overtime.st_rejected')}
                    </Badge>
                    {r.decision_note && <span className="block text-[10px] text-surface-400">{r.decision_note}</span>}
                  </td>
                  <td className="p-3 text-end whitespace-nowrap">
                    {canDecide && !r.locked && r.status !== 'Approved' && (
                      <button type="button" className="p-1.5 text-emerald-600 hover:text-emerald-700" aria-label={t('overtime.approve')} title={t('overtime.approve')}
                        onClick={() => setApproveDlg({ row: r, normal: hm(r.normal_minutes).replace('—', '0:00'), night: hm(r.night_minutes).replace('—', '0:00'), rest: hm(r.rest_minutes).replace('—', '0:00'), note: '' })}>
                        <Check size={15} />
                      </button>
                    )}
                    {canDecide && !r.locked && r.status !== 'Rejected' && (
                      <button type="button" className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('overtime.reject')} title={t('overtime.reject')}
                        onClick={() => act(() => otApi.rejectOvertime(r.id), t('overtime.rejected'))}>
                        <X size={15} />
                      </button>
                    )}
                    {isAdmin && !r.locked && (
                      <button type="button" className="p-1.5 text-surface-300 hover:text-red-600" aria-label={t('common.delete')} onClick={() => remove(r)}><Trash2 size={14} /></button>
                    )}
                  </td>
                </tr>
              );
            })}</tbody>
          </table>
        )}
      </Card>

      {/* Approve, possibly for fewer minutes */}
      <Modal open={!!approveDlg} onClose={() => setApproveDlg(null)} title={t('overtime.approve_title')} size="md">
        {approveDlg && (
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            act(() => otApi.approveOvertime(approveDlg.row.id, {
              normal_minutes: toMin(approveDlg.normal), night_minutes: toMin(approveDlg.night), rest_minutes: toMin(approveDlg.rest),
              note: approveDlg.note.trim() || undefined,
            }), t('overtime.approved'));
          }}>
            <p className="text-sm text-surface-600">{t('overtime.approve_hint', { name: approveDlg.row.employee_name, date: approveDlg.row.work_date })}</p>
            <div className="grid grid-cols-3 gap-3">
              {field(t('overtime.normal'), <input value={approveDlg.normal} onChange={(e) => setApproveDlg((d) => ({ ...d, normal: e.target.value }))} className={input} />)}
              {field(t('overtime.night'), <input value={approveDlg.night} onChange={(e) => setApproveDlg((d) => ({ ...d, night: e.target.value }))} className={input} />)}
              {field(t('overtime.rest'), <input value={approveDlg.rest} onChange={(e) => setApproveDlg((d) => ({ ...d, rest: e.target.value }))} className={input} />)}
            </div>
            <p className="text-[11px] text-surface-400">{t('overtime.time_format')}</p>
            {field(t('overtime.note'), <input value={approveDlg.note} maxLength={500} onChange={(e) => setApproveDlg((d) => ({ ...d, note: e.target.value }))} className={input} />)}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setApproveDlg(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={busy}>{t('overtime.approve')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Enter by hand */}
      <Modal open={!!addForm} onClose={() => setAddForm(null)} title={t('overtime.add')} size="md">
        {addForm && (
          <form className="space-y-3" onSubmit={(e) => {
            e.preventDefault();
            act(() => otApi.addOvertime({
              employee_id: addForm.employee_id, work_date: addForm.work_date, reason: addForm.reason,
              normal_minutes: toMin(addForm.normal), night_minutes: toMin(addForm.night), rest_minutes: toMin(addForm.rest),
            }), t('overtime.added'));
          }}>
            {field(t('overtime.employee'), (
              <select required value={addForm.employee_id} onChange={(e) => setAddForm((f) => ({ ...f, employee_id: e.target.value }))} className={input}>
                <option value="">{t('overtime.choose_employee')}</option>
                {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
              </select>
            ))}
            {field(t('overtime.date'), <input type="date" required value={addForm.work_date} onChange={(e) => setAddForm((f) => ({ ...f, work_date: e.target.value }))} className={input} />)}
            <div className="grid grid-cols-3 gap-3">
              {field(t('overtime.normal'), <input placeholder="0:00" value={addForm.normal} onChange={(e) => setAddForm((f) => ({ ...f, normal: e.target.value }))} className={input} />)}
              {field(t('overtime.night'), <input placeholder="0:00" value={addForm.night} onChange={(e) => setAddForm((f) => ({ ...f, night: e.target.value }))} className={input} />)}
              {field(t('overtime.rest'), <input placeholder="0:00" value={addForm.rest} onChange={(e) => setAddForm((f) => ({ ...f, rest: e.target.value }))} className={input} />)}
            </div>
            <p className="text-[11px] text-surface-400">{t('overtime.time_format')}</p>
            {field(t('overtime.reason'), <input required maxLength={500} value={addForm.reason} onChange={(e) => setAddForm((f) => ({ ...f, reason: e.target.value }))} className={input} />)}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setAddForm(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={busy}>{t('common.save')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
