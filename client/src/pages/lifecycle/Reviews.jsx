import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { ClipboardCheck, Plus, Rocket, Lock, Trash2, Loader2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import ReviewForm from '@components/reviews/ReviewForm';
import * as reviewsApi from '@api/reviewsApi';
import { confirmDelete } from '@utils/confirm';
import { recKey, reviewStatusKey, reviewStatusVariant } from '@utils/reviews';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1 bg-white';
const cycleVariant = { Draft: 'inactive', Open: 'info', Closed: 'success' };

/**
 * Appraisal cycles. HR creates one, launches it (a review for every current
 * employee of the company), follows it stage by stage, finalizes each review
 * and closes the cycle. The final rating shows in salary reviews.
 */
export default function Reviews() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isAdmin = user?.role === 'admin';
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${reload}`;
  const [state, setState] = useState({ key: null, cycles: [] });
  const [selected, setSelected] = useState(null);
  const [reviews, setReviews] = useState({ id: null, rows: [] });
  const [openReview, setOpenReview] = useState(null);
  const [newCycle, setNewCycle] = useState(null);
  const refresh = () => setReload((n) => n + 1);

  useEffect(() => {
    let off = false;
    reviewsApi.getCycles()
      .then(({ data }) => { if (!off) setState({ key, cycles: data }); })
      .catch(() => { if (!off) { setState({ key, cycles: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, t]);

  useEffect(() => {
    if (!selected) return undefined;
    let off = false;
    reviewsApi.getCycleReviews(selected)
      .then(({ data }) => { if (!off) setReviews({ id: `${selected}:${reload}`, rows: data }); })
      .catch(() => { if (!off) setReviews({ id: `${selected}:${reload}`, rows: [] }); });
    return () => { off = true; };
  }, [selected, reload]);

  const act = async (fn, ok) => {
    try { await fn(); toast.success(ok); refresh(); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const remove = async (c) => {
    if (!(await confirmDelete(`"${c.name}"`)).isConfirmed) return;
    if (selected === c.id) setSelected(null);
    act(() => reviewsApi.deleteCycle(c.id), t('reviews.cycle_deleted'));
  };

  const cycles = state.key === key ? state.cycles : null;
  const rows = reviews.id === `${selected}:${reload}` ? reviews.rows : null;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><ClipboardCheck className="text-brand-600" /> {t('reviews.title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('reviews.subtitle')}</p>
        </div>
        <Button className="ms-auto" onClick={() => setNewCycle({ name: '', period_start: '', period_end: '', self_due: '', manager_due: '' })}><Plus size={16} /> {t('reviews.new_cycle')}</Button>
      </div>

      {!cycles ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : cycles.length === 0 ? (
        <Card><p className="text-sm text-surface-500 text-center py-6">{t('reviews.no_cycles')}</p></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {cycles.map((c) => (
            <Card key={c.id} className={`!p-4 cursor-pointer ${selected === c.id ? 'ring-2 ring-brand-400' : ''}`} onClick={() => setSelected(c.id)}>
              <div className="flex items-center gap-2">
                <p className="font-semibold text-surface-900 flex-1 truncate">{c.name}</p>
                <Badge variant={cycleVariant[c.status]} className="text-[10px]">{t(`reviews.cycle_status.${c.status.toLowerCase()}`)}</Badge>
              </div>
              <p className="text-xs text-surface-500 mt-0.5">{c.company_name} · {t('reviews.period', { from: c.period_start, to: c.period_end })}</p>
              {c.status !== 'Draft' && (
                <p className="text-xs text-surface-600 mt-2">
                  {t('reviews.progress', { self: c.at_self, manager: c.at_manager, hr: c.at_hr, done: c.completed, total: c.total })}
                </p>
              )}
              <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                {c.status === 'Draft' && <Button size="sm" onClick={() => act(() => reviewsApi.launchCycle(c.id), t('reviews.launched'))}><Rocket size={14} /> {t('reviews.launch')}</Button>}
                {c.status === 'Open' && <Button size="sm" variant="secondary" onClick={() => act(() => reviewsApi.closeCycle(c.id), t('reviews.closed'))}><Lock size={14} /> {t('reviews.close')}</Button>}
                {isAdmin && <button type="button" onClick={() => remove(c)} className="ms-auto p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      {selected && (
        <Card className="!p-0 overflow-hidden">
          {!rows ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-brand-600 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-surface-500 text-center py-6">{t('reviews.not_launched')}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-surface-500 text-xs">
                  <tr>
                    <th className="text-start p-3">{t('reviews.col.employee')}</th>
                    <th className="text-start p-3">{t('reviews.col.manager')}</th>
                    <th className="text-start p-3">{t('reviews.col.stage')}</th>
                    <th className="p-3">{t('reviews.col.self')}</th>
                    <th className="p-3">{t('reviews.col.manager_rating')}</th>
                    <th className="p-3">{t('reviews.col.final')}</th>
                    <th className="text-start p-3">{t('reviews.recommendation')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} onClick={() => setOpenReview(r.id)} className="border-t border-surface-50 hover:bg-surface-50/60 cursor-pointer">
                      <td className="p-3">{r.employee_name}{r.department && <span className="block text-[11px] text-surface-400">{r.department}</span>}</td>
                      <td className="p-3 text-xs text-surface-500">{r.manager_name || '—'}</td>
                      <td className="p-3"><Badge variant={reviewStatusVariant(r.status)} className="text-[10px]">{t(`reviews.status.${reviewStatusKey(r.status)}`)}</Badge></td>
                      <td className="p-3 text-center">{r.self_rating ?? '—'}</td>
                      <td className="p-3 text-center">{r.manager_rating ?? '—'}</td>
                      <td className="p-3 text-center font-semibold text-brand-700">{r.final_rating ?? '—'}</td>
                      <td className="p-3 text-xs">{(r.final_recommendation || r.manager_recommendation) ? t(`reviews.rec.${recKey(r.final_recommendation || r.manager_recommendation)}`) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {openReview && <ReviewForm t={t} id={openReview} onClose={() => setOpenReview(null)} onChanged={refresh} />}
      {newCycle && (
        <Modal open onClose={() => setNewCycle(null)} title={t('reviews.new_cycle')} size="md">
          <div className="space-y-3">
            <div><label className="text-xs font-semibold text-surface-700">{t('reviews.f.name')} *</label>
              <input value={newCycle.name} onChange={(e) => setNewCycle((p) => ({ ...p, name: e.target.value }))} placeholder={t('reviews.f.name_ph')} className={input} /></div>
            <div className="grid grid-cols-2 gap-3">
              {['period_start', 'period_end', 'self_due', 'manager_due'].map((k) => (
                <div key={k}><label className="text-xs font-semibold text-surface-700">{t(`reviews.f.${k}`)}{k.startsWith('period') ? ' *' : ''}</label>
                  <input type="date" value={newCycle[k]} onChange={(e) => setNewCycle((p) => ({ ...p, [k]: e.target.value }))} className={input} /></div>
              ))}
            </div>
            <p className="text-[11px] text-surface-500">{t('reviews.new_cycle_hint')}</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setNewCycle(null)}>{t('common.cancel')}</Button>
              <Button onClick={async () => {
                try { await reviewsApi.createCycle(newCycle); toast.success(t('reviews.cycle_created')); setNewCycle(null); refresh(); }
                catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
              }}>{t('common.save')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
