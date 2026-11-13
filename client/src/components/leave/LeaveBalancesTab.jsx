import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { Plus, Upload, CalendarClock, Banknote, Trash2, Loader2, Settings2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import * as leaveApi from '@api/leaveApi';
import { confirmDelete } from '@utils/confirm';

const apiErr = (e, f) => e?.response?.data?.error || f;
const n = (v) => Number(v || 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1 bg-white';
const label = 'text-xs font-semibold text-surface-700';
const KIND_VARIANT = { Opening: 'info', Adjustment: 'brand', 'Carry Forward': 'success', Lapse: 'inactive', Encashment: 'warning' };
const kindKey = (k) => k.toLowerCase().replace(/\s+/g, '_');

/**
 * Leave balances for a year: what each person has left of each type, and the
 * ledger behind it — opening balances (typed or imported), corrections,
 * carry-forward and lapse at year end, and days paid out (encashed).
 */
export default function LeaveBalancesTab({ t, types = [], employees = [], onSetEntitlement }) {
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [year, setYear] = useState(dayjs().year());
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${year}:${reload}`;
  const [state, setState] = useState({ key: null, summary: null, ledger: [] });
  const [modal, setModal] = useState(null); // 'adjust' | 'import' | 'yearend' | 'encash'
  const refresh = () => setReload((r) => r + 1);

  useEffect(() => {
    let off = false;
    Promise.all([leaveApi.getBalanceSummary({ year }), leaveApi.getAdjustments({ year })])
      .then(([s, l]) => { if (!off) setState({ key, summary: s.data, ledger: l.data }); })
      .catch(() => { if (!off) { setState({ key, summary: { types: [], employees: [] }, ledger: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, year, t]);

  const remove = async (a) => {
    if (!(await confirmDelete(`${a.kind} · ${a.employee_name}`)).isConfirmed) return;
    try { await leaveApi.deleteAdjustment(a.id); toast.success(t('leave_x.removed')); refresh(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };

  const s = state.key === key ? state.summary : null;
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white">
          {[-2, -1, 0, 1].map((k) => <option key={k} value={dayjs().year() + k}>{dayjs().year() + k}</option>)}
        </select>
        <div className="ms-auto flex gap-2 flex-wrap">
          <Button size="sm" variant="secondary" onClick={onSetEntitlement}><Settings2 size={14} /> {t('leave.set_entitlement')}</Button>
          <Button size="sm" variant="secondary" onClick={() => setModal('import')}><Upload size={14} /> {t('leave_x.import_opening')}</Button>
          <Button size="sm" variant="secondary" onClick={() => setModal('yearend')}><CalendarClock size={14} /> {t('leave_x.year_end')}</Button>
          <Button size="sm" variant="secondary" onClick={() => setModal('encash')}><Banknote size={14} /> {t('leave_x.encash')}</Button>
          <Button size="sm" onClick={() => setModal('adjust')}><Plus size={14} /> {t('leave_x.adjust')}</Button>
        </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        {!s ? (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        ) : s.employees.length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-8">{t('leave.no_balances')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs">
                <tr>
                  <th className="text-start p-3">{t('leave.th_employee')}</th>
                  {s.types.map((tp) => <th key={tp.id} className="p-3 text-center">{tp.name}</th>)}
                </tr>
              </thead>
              <tbody>
                {s.employees.map((e) => (
                  <tr key={e.id} className="border-t border-surface-50">
                    <td className="p-3 text-surface-800">{e.name}</td>
                    {s.types.map((tp) => {
                      const b = e.balances[tp.id];
                      return (
                        <td key={tp.id} className="p-3 text-center"
                          title={b ? t('leave_x.balance_tip', { entitled: n(b.entitled), adjusted: n(b.adjusted), used: n(b.used) }) : undefined}>
                          {b?.remaining == null ? '—' : (
                            <span className={`font-semibold ${b.remaining < 0 ? 'text-red-600' : 'text-brand-700'}`}>{n(b.remaining)}</span>
                          )}
                          {b && Number(b.adjusted) !== 0 && <span className="block text-[10px] text-surface-400">{Number(b.adjusted) > 0 ? '+' : ''}{n(b.adjusted)}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="!p-0 overflow-hidden">
        <div className="p-3 border-b border-surface-100"><h3 className="font-semibold text-surface-800 text-sm">{t('leave_x.ledger_title', { year })}</h3></div>
        {(state.key === key ? state.ledger : []).length === 0 ? (
          <p className="text-sm text-surface-500 text-center py-6">{t('leave_x.ledger_empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs">
                <tr>
                  <th className="text-start p-3">{t('leave.th_employee')}</th>
                  <th className="text-start p-3">{t('leave.th_type')}</th>
                  <th className="text-start p-3">{t('leave_x.kind')}</th>
                  <th className="p-3 text-end">{t('leave_x.days')}</th>
                  <th className="text-start p-3">{t('leave_x.reason')}</th>
                  <th className="text-start p-3">{t('leave_x.by')}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {state.ledger.map((a) => (
                  <tr key={a.id} className="border-t border-surface-50">
                    <td className="p-3">{a.employee_name}</td>
                    <td className="p-3">{a.leave_type_name}</td>
                    <td className="p-3">
                      <Badge variant={KIND_VARIANT[a.kind]} className="text-[10px]">{t(`leave_x.kind_${kindKey(a.kind)}`)}</Badge>
                      {a.expires_on && <span className="block text-[10px] text-surface-400">{t('leave_x.expires', { date: a.expires_on })}</span>}
                    </td>
                    <td className={`p-3 text-end font-mono ${a.days < 0 ? 'text-red-600' : 'text-emerald-700'}`}>{a.days > 0 ? '+' : ''}{n(a.days)}</td>
                    <td className="p-3 text-xs text-surface-600">{a.reason}</td>
                    <td className="p-3 text-xs text-surface-500">{a.created_by_name || '—'}<span className="block">{String(a.created_at).slice(0, 10)}</span></td>
                    <td className="p-3 text-end">
                      {isAdmin && (
                        <button type="button" onClick={() => remove(a)} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal === 'adjust' && <AdjustModal t={t} year={year} types={types} employees={employees} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === 'import' && <ImportModal t={t} year={year} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === 'yearend' && <YearEndModal t={t} year={year} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
      {modal === 'encash' && <EncashModal t={t} year={year} types={types} employees={employees} onClose={() => setModal(null)} onDone={() => { setModal(null); refresh(); }} />}
    </div>
  );
}

function EmployeeTypeFields({ t, form, set, types, employees }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div><label className={label}>{t('leave.th_employee')} *</label>
        <select value={form.employee_id} onChange={set('employee_id')} className={input}>
          <option value="">{t('leave.select')}</option>
          {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
        </select></div>
      <div><label className={label}>{t('leave.th_type')} *</label>
        <select value={form.leave_type_id} onChange={set('leave_type_id')} className={input}>
          <option value="">{t('leave.select')}</option>
          {types.filter((tp) => !tp.deducts_from_leave_type_id).map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
        </select></div>
    </div>
  );
}

function AdjustModal({ t, year, types, employees, onClose, onDone }) {
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', kind: 'Adjustment', days: '', reason: '', year });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      await leaveApi.addAdjustment({ ...form, employee_id: Number(form.employee_id), leave_type_id: Number(form.leave_type_id), days: Number(form.days), year: Number(form.year) });
      toast.success(t('leave_x.adjusted'));
      onDone();
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('leave_x.adjust')} size="md">
      <div className="space-y-3">
        <EmployeeTypeFields t={t} form={form} set={set} types={types} employees={employees} />
        <div className="grid grid-cols-3 gap-3">
          <div><label className={label}>{t('leave_x.kind')}</label>
            <select value={form.kind} onChange={set('kind')} className={input}>
              <option value="Adjustment">{t('leave_x.kind_adjustment')}</option>
              <option value="Opening">{t('leave_x.kind_opening')}</option>
            </select></div>
          <div><label className={label}>{t('leave_x.days')} *</label>
            <input type="number" step="0.5" value={form.days} onChange={set('days')} className={input} placeholder={form.kind === 'Adjustment' ? '-2 / 3' : '12'} /></div>
          <div><label className={label}>{t('leave.th_year')}</label>
            <input type="number" value={form.year} onChange={set('year')} className={input} /></div>
        </div>
        <div><label className={label}>{t('leave_x.reason')} *</label>
          <input value={form.reason} onChange={set('reason')} maxLength={500} className={input} /></div>
        <p className="text-[11px] text-surface-500">{t('leave_x.adjust_hint')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function ImportModal({ t, year, onClose, onDone }) {
  const [csv, setCsv] = useState('');
  const [check, setCheck] = useState(null);
  const [busy, setBusy] = useState(false);
  const readFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => { setCsv(String(r.result || '')); setCheck(null); };
    r.readAsText(f);
  };
  const run = async (dry) => {
    setBusy(true);
    try {
      const { data } = await leaveApi.importOpening({ csv, year, dry_run: dry });
      if (dry || data.errors.length) setCheck(data);
      else { toast.success(t('leave_x.imported', { n: data.imported })); onDone(); }
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('leave_x.import_opening')} size="lg">
      <div className="space-y-3">
        <p className="text-xs text-surface-600">{t('leave_x.import_hint', { year })}</p>
        <pre className="text-[11px] bg-surface-50 rounded-lg p-2 text-surface-600 overflow-x-auto">employee,leave type,days,reason{'\n'}name@company.ae,Annual Leave,12.5,Balance from previous system</pre>
        <input type="file" accept=".csv,text/csv" onChange={readFile} className="block text-sm" />
        <textarea rows={6} value={csv} onChange={(e) => { setCsv(e.target.value); setCheck(null); }} className={`${input} font-mono text-xs`} />
        {check && (
          <div className={`text-xs rounded-lg p-3 ${check.errors.length ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>
            <p className="font-semibold">{t('leave_x.import_ready', { n: check.ready })}</p>
            {check.errors.length > 0 && (
              <ul className="mt-1 space-y-0.5 max-h-40 overflow-y-auto">
                {check.errors.map((er) => <li key={`${er.line}-${er.error}`}>{t('leave_x.line', { n: er.line })}: {er.error}</li>)}
              </ul>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => run(true)} loading={busy} disabled={!csv.trim()}>{t('leave_x.check')}</Button>
          <Button onClick={() => run(false)} loading={busy} disabled={!check || check.errors.length > 0 || !check.ready}>{t('leave_x.import')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function YearEndModal({ t, year, onClose, onDone }) {
  const [mode, setMode] = useState('carry'); // carry | lapse
  const fromYear = mode === 'carry' ? year - 1 : year;
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(false);
  const call = (dry) => (mode === 'carry'
    ? leaveApi.carryForward({ from_year: fromYear, dry_run: dry })
    : leaveApi.lapseCarried({ year, dry_run: dry }));
  const preview = async () => {
    setBusy(true);
    try { const { data } = await call(true); setRows(data.rows); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } finally { setBusy(false); }
  };
  const apply = async () => {
    setBusy(true);
    try { await call(false); toast.success(t('leave_x.year_end_done')); onDone(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('leave_x.year_end')} size="lg">
      <div className="space-y-3">
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
          {['carry', 'lapse'].map((m) => (
            <button key={m} type="button" onClick={() => { setMode(m); setRows(null); }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500'}`}>
              {m === 'carry' ? t('leave_x.carry_title', { from: year - 1, to: year }) : t('leave_x.lapse_title', { year })}
            </button>
          ))}
        </div>
        <p className="text-xs text-surface-600">{mode === 'carry' ? t('leave_x.carry_hint') : t('leave_x.lapse_hint')}</p>
        {rows && (
          rows.length === 0 ? <p className="text-sm text-surface-500">{mode === 'carry' ? t('leave_x.carry_none') : t('leave_x.lapse_none')}</p> : (
            <div className="max-h-72 overflow-y-auto border border-surface-100 rounded-lg">
              <table className="w-full text-xs">
                <thead className="bg-surface-50 text-surface-500 sticky top-0">
                  {mode === 'carry' ? (
                    <tr><th className="text-start p-2">{t('leave.th_employee')}</th><th className="text-start p-2">{t('leave.th_type')}</th><th className="p-2 text-end">{t('leave_x.unused')}</th><th className="p-2 text-end">{t('leave_x.carried')}</th><th className="p-2">{t('leave_x.expires_col')}</th></tr>
                  ) : (
                    <tr><th className="text-start p-2">{t('leave.th_employee')}</th><th className="text-start p-2">{t('leave.th_type')}</th><th className="p-2 text-end">{t('leave_x.carried')}</th><th className="p-2 text-end">{t('leave_x.used_by_expiry')}</th><th className="p-2 text-end">{t('leave_x.lapsed')}</th></tr>
                  )}
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-t border-surface-50">
                      <td className="p-2">{r.employee_name}</td><td className="p-2">{r.leave_type_name}</td>
                      {mode === 'carry' ? (<>
                        <td className="p-2 text-end">{n(r.remaining)}</td><td className="p-2 text-end font-semibold">{n(r.days)}</td><td className="p-2 text-center">{r.expires_on || '—'}</td>
                      </>) : (<>
                        <td className="p-2 text-end">{n(r.carried)}</td><td className="p-2 text-end">{n(r.used_by_expiry)}</td><td className="p-2 text-end font-semibold">{n(r.lapsed)}</td>
                      </>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={preview} loading={busy}>{t('leave_x.preview')}</Button>
          <Button onClick={apply} loading={busy} disabled={!rows || rows.length === 0}>{t('leave_x.apply')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function EncashModal({ t, year, types, employees, onClose, onDone }) {
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', days: '', period: dayjs().add(1, 'month').format('YYYY-MM'), reason: '', year });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await leaveApi.encash({ ...form, employee_id: Number(form.employee_id), leave_type_id: Number(form.leave_type_id), days: Number(form.days), year: Number(form.year) });
      toast.success(data.needs_regenerate ? t('leave_x.encashed_regenerate', { amount: n(data.amount) }) : t('leave_x.encashed', { amount: n(data.amount) }));
      onDone();
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } finally { setSaving(false); }
  };
  return (
    <Modal open onClose={onClose} title={t('leave_x.encash')} size="md">
      <div className="space-y-3">
        <EmployeeTypeFields t={t} form={form} set={set} types={types} employees={employees} />
        <div className="grid grid-cols-3 gap-3">
          <div><label className={label}>{t('leave_x.days')} *</label><input type="number" min="0" step="0.5" value={form.days} onChange={set('days')} className={input} /></div>
          <div><label className={label}>{t('leave_x.from_balance_of')}</label><input type="number" value={form.year} onChange={set('year')} className={input} /></div>
          <div><label className={label}>{t('leave_x.pay_in')} *</label><input type="month" value={form.period} onChange={set('period')} className={input} /></div>
        </div>
        <div><label className={label}>{t('leave_x.reason')} *</label><input value={form.reason} onChange={set('reason')} maxLength={500} className={input} /></div>
        <p className="text-[11px] text-surface-500">{t('leave_x.encash_hint')}</p>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button onClick={save} loading={saving}>{t('leave_x.encash')}</Button>
        </div>
      </div>
    </Modal>
  );
}
