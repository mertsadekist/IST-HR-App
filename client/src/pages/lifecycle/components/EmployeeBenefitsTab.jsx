import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { Loader2, Plus, Trash2, Save, Plane, HeartPulse } from 'lucide-react';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import * as benefitsApi from '@api/benefitsApi';
import { confirmDelete } from '@utils/confirm';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white';
const label = 'text-[11px] font-semibold text-surface-600';
const RELATIONS = ['Spouse', 'Child', 'Parent', 'Other'];
const money = (n) => (n == null ? '—' : Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

/**
 * A person's benefits: their medical insurance (policy, category, card,
 * dependents) and the air ticket (entitlement, when the next falls due, and
 * each one used — a booked ticket or cash paid through payroll).
 */
export default function EmployeeBenefitsTab({ employee, t, canEdit }) {
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const [reload, setReload] = useState(0);
  const key = `${employee.id}:${reload}`;
  const [state, setState] = useState({ key: null, data: null });
  const [policies, setPolicies] = useState([]);
  const [ins, setIns] = useState(null);
  const [ticket, setTicket] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    let off = false;
    benefitsApi.getEmployeeBenefits(employee.id)
      .then(({ data }) => { if (!off) setState({ key, data }); })
      .catch(() => { if (!off) setState({ key, data: { insurance: null, ticket: null, usages: [] } }); });
    return () => { off = true; };
  }, [employee.id, key]);

  useEffect(() => {
    if (!canEdit) return undefined;
    let off = false;
    benefitsApi.getPolicies().then(({ data }) => { if (!off) setPolicies(data.filter((p) => p.company_id === employee.company_id)); }).catch(() => {});
    return () => { off = true; };
  }, [canEdit, employee.company_id]);

  const d = state.key === key ? state.data : null;
  const run = async (fn, ok, after) => {
    try { await fn(); toast.success(ok); after?.(); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  if (!d) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;

  const insForm = ins || (d.insurance
    ? { ...d.insurance, premium: d.insurance.premium ?? '', start_date: d.insurance.start_date || '', end_date: d.insurance.end_date || '' }
    : { policy_id: '', category: '', card_number: '', start_date: '', end_date: '', premium: '', dependents: [] });
  const setI = (patch) => setIns({ ...insForm, ...patch });
  const ticketForm = ticket || (d.ticket ? { ...d.ticket, max_amount: d.ticket.max_amount ?? '', destination: d.ticket.destination || '' }
    : { frequency_months: 12, ticket_class: 'Economy', destination: '', max_amount: '', dependents_count: 0, start_from: '' });
  const setT = (patch) => setTicket({ ...ticketForm, ...patch });

  return (
    <div className="space-y-6">
      {/* Insurance */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><HeartPulse size={16} className="text-rose-500" /> {t('benefits.insurance')}</h4>
        {!canEdit ? (
          d.insurance ? (
            <p className="text-sm text-surface-700">{d.insurance.provider} · {d.insurance.category || '—'} · {d.insurance.card_number || '—'}</p>
          ) : <p className="text-xs text-surface-400">{t('benefits.no_insurance')}</p>
        ) : (
          <div className="rounded-xl border border-surface-200 p-3 space-y-2">
            {policies.length === 0 && <p className="text-xs text-amber-700">{t('benefits.no_policies_hint')}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div><span className={label}>{t('benefits.policy')}</span>
                <select value={insForm.policy_id} onChange={(e) => setI({ policy_id: e.target.value })} className={input}>
                  <option value="">—</option>{policies.map((p) => <option key={p.id} value={p.id}>{p.provider}{p.policy_number ? ` · ${p.policy_number}` : ''} ({p.end_date})</option>)}
                </select></div>
              <div><span className={label}>{t('benefits.category')}</span><input value={insForm.category || ''} onChange={(e) => setI({ category: e.target.value })} className={input} /></div>
              <div><span className={label}>{t('benefits.card_number')}</span><input value={insForm.card_number || ''} onChange={(e) => setI({ card_number: e.target.value })} className={input} /></div>
              <div><span className={label}>{t('benefits.from')}</span><input type="date" value={insForm.start_date || ''} onChange={(e) => setI({ start_date: e.target.value })} className={input} /></div>
              <div><span className={label}>{t('benefits.to')}</span><input type="date" value={insForm.end_date || ''} onChange={(e) => setI({ end_date: e.target.value })} className={input} /></div>
              <div><span className={label}>{t('benefits.premium')}</span><input type="number" min="0" value={insForm.premium} onChange={(e) => setI({ premium: e.target.value })} className={input} /></div>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center"><span className={label}>{t('benefits.dependents')}</span>
                <button type="button" className="ms-auto text-xs text-brand-700 inline-flex items-center gap-1" onClick={() => setI({ dependents: [...(insForm.dependents || []), { name: '', relation: 'Spouse', dob: '', card_number: '' }] })}><Plus size={12} /> {t('benefits.add_dependent')}</button></div>
              {(insForm.dependents || []).map((dep, i) => (
                <div key={i} className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-center">
                  <input value={dep.name} onChange={(e) => setI({ dependents: insForm.dependents.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} placeholder={t('benefits.dep_name')} className={`${input} sm:col-span-2`} />
                  <select value={dep.relation} onChange={(e) => setI({ dependents: insForm.dependents.map((x, j) => (j === i ? { ...x, relation: e.target.value } : x)) })} className={input}>
                    {RELATIONS.map((r) => <option key={r} value={r}>{t(`benefits.relation.${r.toLowerCase()}`)}</option>)}
                  </select>
                  <input type="date" value={dep.dob || ''} onChange={(e) => setI({ dependents: insForm.dependents.map((x, j) => (j === i ? { ...x, dob: e.target.value } : x)) })} className={input} title={t('benefits.dob')} />
                  <button type="button" onClick={() => setI({ dependents: insForm.dependents.filter((_, j) => j !== i) })} className="p-1 text-surface-400 hover:text-red-600 justify-self-start" aria-label={t('common.delete')}><Trash2 size={14} /></button>
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              {d.insurance && <Button size="sm" variant="ghost" onClick={() => run(() => benefitsApi.saveInsurance(employee.id, { remove: true }), t('benefits.removed'), () => setIns(null))}>{t('benefits.remove')}</Button>}
              <Button size="sm" onClick={() => run(() => benefitsApi.saveInsurance(employee.id, insForm), t('benefits.saved'), () => setIns(null))}><Save size={14} /> {t('common.save')}</Button>
            </div>
          </div>
        )}
      </section>

      {/* Air ticket */}
      <section className="space-y-2">
        <h4 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><Plane size={16} className="text-sky-600" /> {t('benefits.ticket')}
          {d.next_ticket_due && <Badge variant={d.next_ticket_due <= dayjs().format('YYYY-MM-DD') ? 'success' : 'info'} className="text-[10px] ms-1">{t('benefits.next_due', { date: d.next_ticket_due })}</Badge>}
        </h4>
        {canEdit ? (
          <div className="rounded-xl border border-surface-200 p-3 space-y-2">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <div><span className={label}>{t('benefits.every')}</span>
                <select value={ticketForm.frequency_months} onChange={(e) => setT({ frequency_months: Number(e.target.value) })} className={input}>
                  <option value={12}>{t('benefits.months', { n: 12 })}</option><option value={24}>{t('benefits.months', { n: 24 })}</option>
                </select></div>
              <div><span className={label}>{t('benefits.class')}</span>
                <select value={ticketForm.ticket_class} onChange={(e) => setT({ ticket_class: e.target.value })} className={input}>
                  {['Economy', 'Premium Economy', 'Business'].map((c) => <option key={c} value={c}>{t(`benefits.cls.${c.toLowerCase().replace(' ', '_')}`)}</option>)}
                </select></div>
              <div><span className={label}>{t('benefits.destination')}</span><input value={ticketForm.destination} onChange={(e) => setT({ destination: e.target.value })} className={input} /></div>
              <div><span className={label}>{t('benefits.cap')}</span><input type="number" min="0" value={ticketForm.max_amount} onChange={(e) => setT({ max_amount: e.target.value })} className={input} /></div>
              <div><span className={label}>{t('benefits.dependents_count')}</span><input type="number" min="0" max="10" value={ticketForm.dependents_count} onChange={(e) => setT({ dependents_count: e.target.value })} className={input} /></div>
              <div><span className={label}>{t('benefits.start_from')}</span><input type="date" value={ticketForm.start_from} onChange={(e) => setT({ start_from: e.target.value })} className={input} /></div>
            </div>
            <div className="flex justify-end gap-2">
              {d.ticket && <Button size="sm" variant="ghost" onClick={() => run(() => benefitsApi.saveTicket(employee.id, { remove: true }), t('benefits.removed'), () => setTicket(null))}>{t('benefits.remove')}</Button>}
              <Button size="sm" onClick={() => run(() => benefitsApi.saveTicket(employee.id, ticketForm), t('benefits.saved'), () => setTicket(null))}><Save size={14} /> {t('common.save')}</Button>
            </div>
          </div>
        ) : d.ticket ? (
          <p className="text-sm text-surface-700">{t('benefits.ticket_line', { n: d.ticket.frequency_months, cls: d.ticket.ticket_class, dest: d.ticket.destination || '—' })}</p>
        ) : <p className="text-xs text-surface-400">{t('benefits.no_ticket')}</p>}

        {d.ticket && (
          <div className="space-y-1.5">
            <div className="flex items-center"><span className={label}>{t('benefits.usages')}</span>
              {canEdit && !usage && <button type="button" className="ms-auto text-xs text-brand-700 inline-flex items-center gap-1" onClick={() => setUsage({ used_on: '', mode: 'Ticket', amount: '', period: dayjs().add(1, 'month').format('YYYY-MM'), notes: '' })}><Plus size={12} /> {t('benefits.record_use')}</button>}</div>
            {usage && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end rounded-xl border border-surface-200 p-2">
                <input type="date" value={usage.used_on} onChange={(e) => setUsage((p) => ({ ...p, used_on: e.target.value }))} className={input} title={t('benefits.used_on')} />
                <select value={usage.mode} onChange={(e) => setUsage((p) => ({ ...p, mode: e.target.value }))} className={input}>
                  <option value="Ticket">{t('benefits.mode_ticket')}</option><option value="Cash">{t('benefits.mode_cash')}</option>
                </select>
                <input type="number" min="0" value={usage.amount} onChange={(e) => setUsage((p) => ({ ...p, amount: e.target.value }))} placeholder={t('benefits.amount')} className={input} />
                {usage.mode === 'Cash' ? <input type="month" value={usage.period} onChange={(e) => setUsage((p) => ({ ...p, period: e.target.value }))} className={input} title={t('benefits.pay_in')} /> : <span />}
                <div className="flex gap-1 justify-end">
                  <Button size="sm" variant="secondary" onClick={() => setUsage(null)}>{t('common.cancel')}</Button>
                  <Button size="sm" onClick={() => run(() => benefitsApi.addTicketUsage(employee.id, usage), t('benefits.saved'), () => setUsage(null))}>{t('common.save')}</Button>
                </div>
              </div>
            )}
            {d.usages.length === 0 ? <p className="text-xs text-surface-400">{t('benefits.no_usages')}</p> : (
              <ul className="text-sm divide-y divide-surface-50">
                {d.usages.map((u) => (
                  <li key={u.id} className="py-1.5 flex items-center gap-2">
                    <span className="text-xs text-surface-500 w-24">{u.used_on}</span>
                    <span className="flex-1">{u.mode === 'Cash' ? t('benefits.cash_line', { amount: money(u.amount), period: u.paid_in || '—' }) : t('benefits.ticket_used', { amount: money(u.amount) })}</span>
                    {isAdmin && <button type="button" onClick={async () => { if ((await confirmDelete(u.used_on)).isConfirmed) run(() => benefitsApi.deleteTicketUsage(u.id), t('benefits.removed')); }} className="p-1 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={13} /></button>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
