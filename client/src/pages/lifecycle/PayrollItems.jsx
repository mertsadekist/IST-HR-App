import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { HandCoins, Plus, Loader2, Trash2, Lock } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import * as payApi from '@api/payrollApi';
import * as employeesApi from '@api/employeesApi';
import { confirmDelete } from '@utils/confirm';
import { money } from '@utils/payslipLines';

const apiErr = (e, f) => e?.response?.data?.error || f;
const CATEGORIES = ['Bonus', 'Commission', 'Allowance', 'Reimbursement', 'Overtime', 'Deduction', 'Other'];
const CATEGORY_KIND = { Bonus: 'earning', Commission: 'earning', Allowance: 'earning', Reimbursement: 'earning', Overtime: 'earning', Deduction: 'deduction' };

function categoryLabel(t, c) {
  switch (c) {
    case 'Bonus': return t('payroll_items.cat_bonus');
    case 'Commission': return t('payroll_items.cat_commission');
    case 'Allowance': return t('payroll_items.cat_allowance');
    case 'Reimbursement': return t('payroll_items.cat_reimbursement');
    case 'Overtime': return t('payroll_items.cat_overtime');
    case 'Deduction': return t('payroll_items.cat_deduction');
    default: return t('payroll_items.cat_other');
  }
}
const loanStatusLabel = (t, s) => ({
  Active: t('payroll_items.loan_active'), Settled: t('payroll_items.loan_settled'), Cancelled: t('payroll_items.loan_cancelled'),
})[s] || s;

/**
 * Loans, salary advances and one-time pay items (bonus, commission, a one-off
 * deduction). All of them reach the employee through the monthly payroll run:
 * instalments come off automatically from the start month, one-time items are
 * paid or deducted in the month they are entered for.
 */
export default function PayrollItems() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isAdmin = user?.role === 'admin';
  const canCloseLoan = ['admin', 'hr_manager'].includes(user?.role);
  const [tab, setTab] = useState('loans');
  const [period, setPeriod] = useState(dayjs().format('YYYY-MM'));
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey((k) => k + 1);

  // Data is tagged with what it was loaded for, so loading is derived rather
  // than set inside the effect.
  const loansKey = `${currentCompanyId ?? 'all'}:${reloadKey}`;
  const adjKey = `${currentCompanyId ?? 'all'}:${period}:${reloadKey}`;
  const [loans, setLoans] = useState({ key: null, rows: [] });
  const [adjs, setAdjs] = useState({ key: null, rows: [] });
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    let off = false;
    const params = currentCompanyId ? { company_id: currentCompanyId } : {};
    payApi.getLoans(params)
      .then(({ data }) => { if (!off) setLoans({ key: loansKey, rows: data }); })
      .catch(() => { if (!off) { setLoans({ key: loansKey, rows: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [loansKey, currentCompanyId, t]);

  useEffect(() => {
    let off = false;
    const params = { period, ...(currentCompanyId ? { company_id: currentCompanyId } : {}) };
    payApi.getAdjustments(params)
      .then(({ data }) => { if (!off) setAdjs({ key: adjKey, rows: data }); })
      .catch(() => { if (!off) { setAdjs({ key: adjKey, rows: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [adjKey, period, currentCompanyId, t]);

  useEffect(() => {
    let off = false;
    employeesApi.getEmployees({ ...(currentCompanyId ? { company_id: currentCompanyId } : {}), status: 'Active,Onboarding', limit: 500 })
      .then(({ data }) => { if (!off) setEmployees(data.data || data || []); })
      .catch(() => { if (!off) setEmployees([]); });
    return () => { off = true; };
  }, [currentCompanyId]);

  // ── New loan ──
  const blankLoan = { employee_id: '', type: 'Loan', principal: '', instalment: '', start_period: dayjs().add(1, 'month').format('YYYY-MM'), reason: '' };
  const [loanForm, setLoanForm] = useState(null);
  const [busy, setBusy] = useState(false);
  const saveLoan = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await payApi.createLoan({ ...loanForm, principal: Number(loanForm.principal), instalment: Number(loanForm.instalment) });
      toast.success(t('payroll_items.loan_created'));
      setLoanForm(null); reload();
    } catch (err) { toast.error(apiErr(err, t('common.operation_failed'))); }
    finally { setBusy(false); }
  };
  const months = (l) => (Number(l.instalment) > 0 ? Math.ceil(Number(l.principal) / Number(l.instalment)) : 0);

  // ── Close a loan early ──
  const [closeDlg, setCloseDlg] = useState(null); // { loan, status, note }
  const closeLoan = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await payApi.closeLoan(closeDlg.loan.id, closeDlg.status, closeDlg.note.trim());
      toast.success(t('payroll_items.loan_closed'));
      setCloseDlg(null); reload();
    } catch (err) { toast.error(apiErr(err, t('common.operation_failed'))); }
    finally { setBusy(false); }
  };

  // ── New one-time item ──
  const blankAdj = { employee_id: '', period, category: 'Bonus', kind: 'earning', label: '', amount: '', note: '' };
  const [adjForm, setAdjForm] = useState(null);
  const saveAdj = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await payApi.createAdjustment({ ...adjForm, amount: Number(adjForm.amount) });
      toast.success(data.needs_regenerate ? t('payroll_items.adj_added_regenerate') : t('payroll_items.adj_added'));
      setAdjForm(null); reload();
    } catch (err) { toast.error(apiErr(err, t('common.operation_failed'))); }
    finally { setBusy(false); }
  };
  const delAdj = async (a) => {
    const c = await confirmDelete(a.label);
    if (!c.isConfirmed) return;
    try {
      const { data } = await payApi.deleteAdjustment(a.id);
      toast.success(data.needs_regenerate ? t('payroll_items.adj_deleted_regenerate') : t('common.deleted'));
      reload();
    } catch (err) { toast.error(apiErr(err, t('common.operation_failed'))); }
  };

  const adjTotals = useMemo(() => adjs.rows.reduce((s, a) => {
    s[a.kind] += a.amount; return s;
  }, { earning: 0, deduction: 0 }), [adjs.rows]);

  const input = 'w-full text-sm bg-white border border-surface-200 rounded-xl px-3 py-2';
  const field = (label, el) => <label className="block"><span className="block text-xs font-medium text-surface-600 mb-1">{label}</span>{el}</label>;
  const employeeSelect = (value, onChange) => (
    <select required value={value} onChange={onChange} className={input}>
      <option value="">{t('payroll_items.choose_employee')}</option>
      {employees.map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
    </select>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><HandCoins className="text-brand-600" /> {t('payroll_items.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('payroll_items.subtitle')}</p>
        </div>
        {tab === 'loans'
          ? <Button onClick={() => setLoanForm(blankLoan)}><Plus size={16} /> {t('payroll_items.new_loan')}</Button>
          : <Button onClick={() => setAdjForm({ ...blankAdj, period })}><Plus size={16} /> {t('payroll_items.new_item')}</Button>}
      </div>

      <div className="flex gap-1 border-b border-surface-200">
        {['loans', 'items'].map((k) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-4 py-2 text-sm font-semibold border-b-2 -mb-px ${tab === k ? 'border-brand-600 text-brand-600' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>
            {k === 'loans' ? t('payroll_items.tab_loans') : t('payroll_items.tab_items')}
          </button>
        ))}
      </div>

      {tab === 'loans' ? (
        <Card className="!p-0 overflow-x-auto">
          {loans.key !== loansKey ? (
            <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
          ) : loans.rows.length === 0 ? (
            <p className="text-center py-10 text-sm text-surface-400">{t('payroll_items.no_loans')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                <th className="text-start p-3">{t('payroll_items.employee')}</th>
                <th className="text-start p-3">{t('payroll_items.type')}</th>
                <th className="p-3">{t('payroll_items.amount')}</th>
                <th className="p-3">{t('payroll_items.instalment')}</th>
                <th className="p-3">{t('payroll_items.from_month')}</th>
                <th className="p-3">{t('payroll_items.repaid')}</th>
                <th className="p-3">{t('payroll_items.outstanding')}</th>
                <th className="text-start p-3">{t('payroll_items.status')}</th>
                <th className="p-3" />
              </tr></thead>
              <tbody>{loans.rows.map((l) => (
                <tr key={l.id} className="border-t border-surface-50">
                  <td className="p-3">
                    {l.employee_name}
                    {l.reason && <span className="block text-[11px] text-surface-400">{l.reason}</span>}
                  </td>
                  <td className="p-3">{l.type === 'Advance' ? t('payroll_items.type_advance') : t('payroll_items.type_loan')}</td>
                  <td className="p-3 text-center font-mono">{money(l.principal)}</td>
                  <td className="p-3 text-center font-mono">{money(l.instalment)}<span className="block text-[10px] text-surface-400">{t('payroll_items.months', { count: months(l) })}</span></td>
                  <td className="p-3 text-center">{l.start_period}</td>
                  <td className="p-3 text-center font-mono">
                    {money(l.repaid)}
                    {l.in_progress > 0 && <span className="block text-[10px] text-amber-600">{t('payroll_items.in_progress', { amount: money(l.in_progress) })}</span>}
                  </td>
                  <td className="p-3 text-center font-mono font-semibold">{money(l.status === 'Active' ? l.outstanding : 0)}</td>
                  <td className="p-3">
                    <Badge variant={l.status === 'Active' ? 'brand' : l.status === 'Settled' ? 'success' : 'inactive'} className="text-[10px]">{loanStatusLabel(t, l.status)}</Badge>
                    {l.close_note && <span className="block text-[10px] text-surface-400">{l.close_note}</span>}
                  </td>
                  <td className="p-3 text-end">
                    {l.status === 'Active' && canCloseLoan && (
                      <Button size="sm" variant="secondary" onClick={() => setCloseDlg({ loan: l, status: 'Settled', note: '' })}>{t('payroll_items.close')}</Button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </Card>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-2" aria-label={t('payroll_items.month')} />
            <span className="text-sm text-surface-600">{t('payroll_items.total_paid')}: <b className="text-emerald-700 font-mono">{money(adjTotals.earning)}</b></span>
            <span className="text-sm text-surface-600">{t('payroll_items.total_deducted')}: <b className="text-red-600 font-mono">{money(adjTotals.deduction)}</b></span>
          </div>
          <Card className="!p-0 overflow-x-auto">
            {adjs.key !== adjKey ? (
              <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
            ) : adjs.rows.length === 0 ? (
              <p className="text-center py-10 text-sm text-surface-400">{t('payroll_items.no_items', { period })}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                  <th className="text-start p-3">{t('payroll_items.employee')}</th>
                  <th className="text-start p-3">{t('payroll_items.category')}</th>
                  <th className="text-start p-3">{t('payroll_items.description')}</th>
                  <th className="p-3">{t('payroll_items.amount')}</th>
                  <th className="text-start p-3">{t('payroll_items.status')}</th>
                  <th className="p-3" />
                </tr></thead>
                <tbody>{adjs.rows.map((a) => (
                  <tr key={a.id} className="border-t border-surface-50">
                    <td className="p-3">{a.employee_name}</td>
                    <td className="p-3">{categoryLabel(t, a.category)}</td>
                    <td className="p-3">{a.label}{a.note && <span className="block text-[11px] text-surface-400">{a.note}</span>}</td>
                    <td className={`p-3 text-center font-mono ${a.kind === 'earning' ? 'text-emerald-700' : 'text-red-600'}`}>{a.kind === 'earning' ? '+' : '−'}{money(a.amount)}</td>
                    <td className="p-3">
                      {a.settlement_id
                        ? <Badge variant="success" className="text-[10px]"><Lock size={10} /> {t('payroll_items.in_settlement')}</Badge>
                        : a.locked
                        ? <Badge variant="success" className="text-[10px]"><Lock size={10} /> {t('payroll_items.in_run', {
                          status: t(`payroll_runs.st_${String(a.run_status).toLowerCase().replace(/\s+/g, '_')}`, a.run_status) })}</Badge>
                        : a.run_status === 'Draft'
                          ? <Badge variant="info" className="text-[10px]">{t('payroll_items.in_draft')}</Badge>
                          : <Badge variant="pending" className="text-[10px]">{t('payroll_items.waiting_run')}</Badge>}
                    </td>
                    <td className="p-3 text-end">
                      {isAdmin && !a.locked && (
                        <button type="button" onClick={() => delAdj(a)} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}</tbody>
              </table>
            )}
          </Card>
        </div>
      )}

      {/* New loan or advance */}
      <Modal open={!!loanForm} onClose={() => setLoanForm(null)} title={t('payroll_items.new_loan')} size="md">
        {loanForm && (
          <form onSubmit={saveLoan} className="space-y-3">
            {field(t('payroll_items.employee'), employeeSelect(loanForm.employee_id, (e) => setLoanForm((f) => ({ ...f, employee_id: e.target.value }))))}
            <div className="grid grid-cols-2 gap-3">
              {field(t('payroll_items.type'), (
                <select value={loanForm.type} onChange={(e) => setLoanForm((f) => ({ ...f, type: e.target.value }))} className={input}>
                  <option value="Loan">{t('payroll_items.type_loan')}</option>
                  <option value="Advance">{t('payroll_items.type_advance')}</option>
                </select>
              ))}
              {field(t('payroll_items.from_month'), <input type="month" required value={loanForm.start_period} onChange={(e) => setLoanForm((f) => ({ ...f, start_period: e.target.value }))} className={input} />)}
              {field(t('payroll_items.amount'), <input type="number" min="0.01" step="0.01" required value={loanForm.principal} onChange={(e) => setLoanForm((f) => ({ ...f, principal: e.target.value }))} className={input} />)}
              {field(t('payroll_items.instalment'), <input type="number" min="0.01" step="0.01" required value={loanForm.instalment} onChange={(e) => setLoanForm((f) => ({ ...f, instalment: e.target.value }))} className={input} />)}
            </div>
            {Number(loanForm.principal) > 0 && Number(loanForm.instalment) > 0 && (
              <p className="text-xs text-surface-500">{t('payroll_items.plan_preview', { count: months(loanForm), last: loanForm.start_period ? dayjs(`${loanForm.start_period}-01`).add(months(loanForm) - 1, 'month').format('YYYY-MM') : '' })}</p>
            )}
            {field(t('payroll_items.reason'), <input value={loanForm.reason} maxLength={500} onChange={(e) => setLoanForm((f) => ({ ...f, reason: e.target.value }))} className={input} />)}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setLoanForm(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={busy}>{t('common.save')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Close a loan early */}
      <Modal open={!!closeDlg} onClose={() => setCloseDlg(null)} title={t('payroll_items.close_title')} size="md">
        {closeDlg && (
          <form onSubmit={closeLoan} className="space-y-3">
            <p className="text-sm text-surface-600">{t('payroll_items.close_hint', { name: closeDlg.loan.employee_name, amount: money(closeDlg.loan.outstanding) })}</p>
            {field(t('payroll_items.status'), (
              <select value={closeDlg.status} onChange={(e) => setCloseDlg((d) => ({ ...d, status: e.target.value }))} className={input}>
                <option value="Settled">{t('payroll_items.close_settled')}</option>
                <option value="Cancelled">{t('payroll_items.close_cancelled')}</option>
              </select>
            ))}
            {field(t('payroll_items.note'), <textarea rows={2} required value={closeDlg.note} onChange={(e) => setCloseDlg((d) => ({ ...d, note: e.target.value }))} className={input} />)}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setCloseDlg(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={busy} disabled={!closeDlg.note.trim()}>{t('payroll_items.close')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* New one-time item */}
      <Modal open={!!adjForm} onClose={() => setAdjForm(null)} title={t('payroll_items.new_item')} size="md">
        {adjForm && (
          <form onSubmit={saveAdj} className="space-y-3">
            {field(t('payroll_items.employee'), employeeSelect(adjForm.employee_id, (e) => setAdjForm((f) => ({ ...f, employee_id: e.target.value }))))}
            <div className="grid grid-cols-2 gap-3">
              {field(t('payroll_items.month'), <input type="month" required value={adjForm.period} onChange={(e) => setAdjForm((f) => ({ ...f, period: e.target.value }))} className={input} />)}
              {field(t('payroll_items.category'), (
                <select value={adjForm.category} onChange={(e) => setAdjForm((f) => ({ ...f, category: e.target.value, kind: CATEGORY_KIND[e.target.value] || f.kind }))} className={input}>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
                </select>
              ))}
              {adjForm.category === 'Other' && field(t('payroll_items.kind'), (
                <select value={adjForm.kind} onChange={(e) => setAdjForm((f) => ({ ...f, kind: e.target.value }))} className={input}>
                  <option value="earning">{t('payroll_items.kind_earning')}</option>
                  <option value="deduction">{t('payroll_items.kind_deduction')}</option>
                </select>
              ))}
              {field(t('payroll_items.amount'), <input type="number" min="0.01" step="0.01" required value={adjForm.amount} onChange={(e) => setAdjForm((f) => ({ ...f, amount: e.target.value }))} className={input} />)}
            </div>
            {field(t('payroll_items.description'), <input required maxLength={150} placeholder={t('payroll_items.description_ph')} value={adjForm.label} onChange={(e) => setAdjForm((f) => ({ ...f, label: e.target.value }))} className={input} />)}
            {field(t('payroll_items.note'), <input maxLength={500} value={adjForm.note} onChange={(e) => setAdjForm((f) => ({ ...f, note: e.target.value }))} className={input} />)}
            <p className="text-[11px] text-surface-400">{t('payroll_items.item_hint')}</p>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="secondary" onClick={() => setAdjForm(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={busy}>{t('common.save')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
