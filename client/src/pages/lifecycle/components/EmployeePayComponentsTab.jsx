import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'react-toastify';
import Button from '@components/ui/Button';
import * as payApi from '@api/payrollApi';
import { componentLabel, money } from '@utils/payslipLines';

const blank = { component_code: 'HOUSING', amount: '', effective_from: '', effective_to: '' };

/**
 * What an employee's allowances are made of: housing, transport, and so on.
 *
 * The contract total (full salary) is not edited here. Pay changes go through a
 * salary review; this only labels the allowance part of it for the payslip, and
 * says plainly when the listed amounts no longer add up to it.
 *
 * `canEdit` mirrors authorize('admin','hr_manager') on the save route; the
 * accountant can read it.
 */
export default function EmployeePayComponentsTab({ employee, t, canEdit }) {
  const [data, setData] = useState(null);
  const [rows, setRows] = useState([]);
  const [types, setTypes] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);
  const [saving, setSaving] = useState(false);
  const loading = loadedFor !== employee.id;

  useEffect(() => {
    let cancelled = false;
    const id = employee.id;
    Promise.all([payApi.getEmployeeComponents(id), payApi.getComponentTypes()])
      .then(([c, ty]) => {
        if (cancelled) return;
        setData(c.data);
        setRows((c.data.components || []).map((r) => ({
          component_code: r.component_code, amount: String(r.amount),
          effective_from: r.effective_from || '', effective_to: r.effective_to || '',
        })));
        setTypes(ty.data || []);
        setLoadedFor(id);
      })
      .catch(() => {
        if (cancelled) return;
        toast.error(t('pay_components.load_failed'));
        setData(null); setLoadedFor(id);
      });
    return () => { cancelled = true; };
  }, [employee.id, t]);

  const set = (i, patch) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const listed = Math.round(rows.reduce((s, r) => s + (Number(r.amount) || 0), 0) * 100) / 100;
  const allowances = Number(data?.allowances || 0);
  const matches = rows.length === 0 || listed === allowances;

  const save = async () => {
    setSaving(true);
    try {
      await payApi.saveEmployeeComponents(employee.id, rows
        .filter((r) => r.amount !== '')
        .map((r) => ({ ...r, amount: Number(r.amount), effective_from: r.effective_from || null, effective_to: r.effective_to || null })));
      toast.success(t('pay_components.saved'));
    } catch (e) {
      toast.error(e?.response?.data?.error || t('pay_components.save_failed'));
    } finally { setSaving(false); }
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;
  if (!data) return null;

  const input = 'w-full text-xs bg-white border border-surface-200 rounded-lg p-2 disabled:bg-surface-50';
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          [t('pay_components.basic'), data.basic_salary],
          [t('pay_components.full'), data.full_salary],
          [t('pay_components.allowances'), data.allowances],
        ].map(([label, value]) => (
          <div key={label} className="p-3 bg-surface-50 rounded-xl">
            <p className="text-[11px] text-surface-400">{label}</p>
            <p className="font-semibold text-surface-800 font-mono">{money(value)}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-surface-500">{t('pay_components.intro')}</p>

      <div className="space-y-2">
        {rows.length === 0 && <p className="text-xs text-surface-400 italic">{t('pay_components.none')}</p>}
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-2 sm:grid-cols-[1.4fr_1fr_1fr_1fr_auto] gap-2 items-center">
            <select disabled={!canEdit} value={r.component_code} onChange={(e) => set(i, { component_code: e.target.value })} className={input}
              aria-label={t('pay_components.component')}>
              {types.map((ty) => <option key={ty.code} value={ty.code}>{componentLabel(t, ty.code)}</option>)}
            </select>
            <input disabled={!canEdit} type="number" min="0" step="0.01" value={r.amount} onChange={(e) => set(i, { amount: e.target.value })}
              className={input} placeholder={t('pay_components.amount')} aria-label={t('pay_components.amount')} />
            <input disabled={!canEdit} type="date" value={r.effective_from} onChange={(e) => set(i, { effective_from: e.target.value })}
              className={input} title={t('pay_components.from')} aria-label={t('pay_components.from')} />
            <input disabled={!canEdit} type="date" value={r.effective_to} onChange={(e) => set(i, { effective_to: e.target.value })}
              className={input} title={t('pay_components.to')} aria-label={t('pay_components.to')} />
            {canEdit ? (
              <button type="button" onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
                className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('pay_components.remove')}><Trash2 size={14} /></button>
            ) : <span />}
          </div>
        ))}
      </div>

      {rows.length > 0 && (
        <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs ${matches ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-900'}`}>
          {matches ? <CheckCircle2 size={14} className="mt-0.5 shrink-0" /> : <AlertTriangle size={14} className="mt-0.5 shrink-0" />}
          <span>{matches
            ? t('pay_components.matches', { total: money(listed) })
            : t('pay_components.mismatch', { listed: money(listed), allowances: money(allowances) })}</span>
        </div>
      )}

      {canEdit && (
        <div className="flex justify-between gap-2">
          <Button size="sm" variant="secondary" onClick={() => setRows((list) => [...list, { ...blank, component_code: types[0]?.code || 'HOUSING' }])}>
            <Plus size={14} /> {t('pay_components.add')}
          </Button>
          <Button size="sm" onClick={save} loading={saving}>{t('common.save')}</Button>
        </div>
      )}
    </div>
  );
}
