import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '@components/ui/Modal';
import Button from '@components/ui/Button';
import * as payApi from '@api/payrollApi';
import * as employeesApi from '@api/employeesApi';

const field = 'w-full text-sm border border-surface-200 rounded-lg px-2 py-1.5 bg-white';
const CATEGORIES = { earning: ['Bonus', 'Commission', 'Correction', 'Other'], deduction: ['Correction', 'Other'] };
const blank = () => ({ employee_id: '', kind: 'earning', category: 'Bonus', label: '', amount: '' });

/**
 * An extra run inside a month (bonus, commission, correction). Only the lines
 * entered here are paid; the run then goes through submit and approval.
 */
export default function OffCycleModal({ open, onClose, onCreated, period: initialPeriod, companyId, t }) {
  const [period, setPeriod] = useState(initialPeriod);
  const [title, setTitle] = useState('');
  const [lines, setLines] = useState([blank()]);
  const [people, setPeople] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let off = false;
    employeesApi.getEmployees({ limit: 500, company_id: companyId }).then(({ data }) => {
      if (!off) setPeople((data.data || []).filter((p) => p.status !== 'Exited').map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })));
    }).catch(() => {});
    return () => { off = true; };
  }, [open, companyId]);

  const setLine = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const total = lines.reduce((s, l) => s + (l.kind === 'deduction' ? -1 : 1) * (Number(l.amount) || 0), 0);

  const save = async () => {
    setBusy(true);
    try {
      const { data } = await payApi.createOffCycle({
        period, title, company_id: companyId,
        lines: lines.map((l) => ({ ...l, employee_id: Number(l.employee_id), amount: Number(l.amount) })),
      });
      toast.success(t('off_cycle.created', { count: data.employee_count }));
      setTitle(''); setLines([blank()]);
      onCreated?.(data);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={t('off_cycle.title')} size="xl">
      <div className="space-y-3">
        <p className="text-xs text-surface-500">{t('off_cycle.desc')}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className={field} />
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t('off_cycle.run_title')} className={`${field} sm:col-span-2`} />
        </div>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-center">
              <select value={l.employee_id} onChange={(e) => setLine(i, { employee_id: e.target.value })} className={`${field} sm:col-span-3`}>
                <option value="">{t('off_cycle.employee')}</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <select value={l.kind} onChange={(e) => setLine(i, { kind: e.target.value, category: CATEGORIES[e.target.value][0] })} className={`${field} sm:col-span-2`}>
                <option value="earning">{t('off_cycle.earning')}</option>
                <option value="deduction">{t('off_cycle.deduction')}</option>
              </select>
              <select value={l.category} onChange={(e) => setLine(i, { category: e.target.value })} className={`${field} sm:col-span-2`}>
                {CATEGORIES[l.kind].map((c) => <option key={c} value={c}>{t(`off_cycle.cat_${c.toLowerCase()}`)}</option>)}
              </select>
              <input value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} placeholder={t('off_cycle.label')} className={`${field} sm:col-span-3`} />
              <input type="number" min="0" step="0.01" value={l.amount} onChange={(e) => setLine(i, { amount: e.target.value })} placeholder={t('off_cycle.amount')} className={`${field} sm:col-span-1`} />
              <button type="button" onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))} disabled={lines.length === 1}
                className="p-1.5 text-surface-400 hover:text-red-600 disabled:opacity-30 justify-self-start" aria-label={t('common.delete')}><Trash2 size={14} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setLines((ls) => [...ls, blank()])} className="text-xs text-brand-700 inline-flex items-center gap-1"><Plus size={12} /> {t('off_cycle.add_line')}</button>
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-surface-100">
          <span className="text-sm text-surface-600">{t('off_cycle.net_total')}: <b>{total.toFixed(2)}</b></span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button onClick={save} loading={busy}>{t('off_cycle.create')}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
