import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Loader2, Plus, Trash2, Send, Save, Undo2 } from 'lucide-react';
import Modal from '@components/ui/Modal';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import * as reviewsApi from '@api/reviewsApi';
import { RECOMMENDATIONS, recKey, reviewStatusKey, reviewStatusVariant as statusVariant } from '@utils/reviews';

const SCALE = [1, 2, 3, 4, 5];
const area = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white';

function Stars({ value, onChange, disabled }) {
  return (
    <div className="inline-flex gap-1">
      {SCALE.map((n) => (
        <button key={n} type="button" disabled={disabled} onClick={() => onChange?.(value === n ? null : n)}
          className={`w-7 h-7 rounded-lg text-xs font-semibold border ${Number(value) >= n ? 'bg-brand-600 text-white border-brand-600' : 'bg-white text-surface-400 border-surface-200'} ${disabled ? 'cursor-default' : 'hover:border-brand-400'}`}>
          {n}
        </button>
      ))}
    </div>
  );
}

/**
 * One appraisal. Whoever's turn it is (employee, then manager, then HR) edits
 * their part and submits it on; everyone else reads what they are allowed to.
 */
export default function ReviewForm({ t, id, onClose, onChanged }) {
  const [reload, setReload] = useState(0);
  const key = `${id}:${reload}`;
  const [state, setState] = useState({ key: null, r: null, form: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    reviewsApi.getReview(id)
      .then(({ data }) => { if (!off) setState({ key, r: data, form: { ...data, goals: data.goals.map((g) => ({ ...g })) } }); })
      .catch(() => { if (!off) setState({ key, r: null, form: null }); });
    return () => { off = true; };
  }, [id, key]);

  const r = state.key === key ? state.r : null;
  const form = state.form;
  const set = (patch) => setState((s) => ({ ...s, form: { ...s.form, ...patch } }));
  const setGoal = (i, patch) => setState((s) => ({ ...s, form: { ...s.form, goals: s.form.goals.map((g, j) => (j === i ? { ...g, ...patch } : g)) } }));
  const editing = r?.editing;

  const payload = () => {
    if (editing === 'self') return { goals: form.goals.map(({ title, weight, self_score, comment }) => ({ title, weight, self_score, comment })), self_rating: form.self_rating, self_comments: form.self_comments };
    if (editing === 'manager') return { goals: form.goals.map(({ id: gid, manager_score }) => ({ id: gid, manager_score })), manager_rating: form.manager_rating, manager_comments: form.manager_comments, manager_recommendation: form.manager_recommendation };
    return { final_rating: form.final_rating ?? form.manager_rating, final_recommendation: form.final_recommendation ?? form.manager_recommendation, hr_comments: form.hr_comments };
  };
  const run = async (fn, ok) => {
    setBusy(true);
    try { await fn(); toast.success(ok); setReload((n) => n + 1); onChanged?.(); return true; }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); return false; }
    finally { setBusy(false); }
  };
  const save = () => run(() => reviewsApi.saveReview(id, payload()), t('reviews.saved'));
  const submit = async () => {
    setBusy(true);
    try {
      await reviewsApi.saveReview(id, payload());
      await reviewsApi.submitReview(id);
      toast.success(t('reviews.submitted'));
      onChanged?.();
      onClose();
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(false); }
  };
  const sendBack = (to) => run(() => reviewsApi.returnReview(id, to), t('reviews.returned'));

  return (
    <Modal open onClose={onClose} size="lg" title={r ? `${r.employee_name} · ${r.cycle_name}` : t('reviews.review')}>
      {!r || !form ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 flex-wrap text-xs text-surface-500">
            <Badge variant={statusVariant(r.status)}>{t(`reviews.status.${reviewStatusKey(r.status)}`)}</Badge>
            <span>{t('reviews.period', { from: r.period_start, to: r.period_end })}</span>
            {r.manager_name && <span>· {t('reviews.manager', { name: r.manager_name })}</span>}
            {editing && <span className="ms-auto text-brand-700 font-medium">{t(`reviews.your_turn_${editing}`)}</span>}
          </div>

          {/* Goals */}
          <div>
            <div className="flex items-center mb-2">
              <h4 className="text-sm font-semibold text-surface-800">{t('reviews.goals')}</h4>
              {editing === 'self' && form.goals.length < 10 && (
                <Button size="sm" variant="secondary" className="ms-auto"
                  onClick={() => set({ goals: [...form.goals, { title: '', weight: '', self_score: null, comment: '' }] })}><Plus size={14} /> {t('reviews.add_goal')}</Button>
              )}
            </div>
            {form.goals.length === 0 ? <p className="text-xs text-surface-400">{editing === 'self' ? t('reviews.no_goals_self') : t('reviews.no_goals')}</p> : (
              <div className="space-y-2">
                {form.goals.map((g, i) => (
                  <div key={g.id || `new-${i}`} className="rounded-xl border border-surface-200 p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      {editing === 'self' ? (
                        <>
                          <input value={g.title} onChange={(e) => setGoal(i, { title: e.target.value })} placeholder={t('reviews.goal_title')} maxLength={200} className={`${area} flex-1`} />
                          <input type="number" min="0" max="100" value={g.weight ?? ''} onChange={(e) => setGoal(i, { weight: e.target.value })} placeholder="%" className={`${area} !w-20`} title={t('reviews.weight')} />
                          <button type="button" onClick={() => set({ goals: form.goals.filter((_, j) => j !== i) })} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>
                        </>
                      ) : (
                        <p className="text-sm font-medium text-surface-800 flex-1">{g.title}{g.weight != null && <span className="text-xs text-surface-400 ms-2">{g.weight}%</span>}</p>
                      )}
                    </div>
                    <div className="flex gap-4 flex-wrap items-center text-xs text-surface-600">
                      {(editing === 'self' || g.self_score != null) && (
                        <span className="inline-flex items-center gap-2">{t('reviews.self_score')}
                          <Stars value={g.self_score} disabled={editing !== 'self'} onChange={(v) => setGoal(i, { self_score: v })} /></span>
                      )}
                      {(editing === 'manager' || g.manager_score != null) && (
                        <span className="inline-flex items-center gap-2">{t('reviews.manager_score')}
                          <Stars value={g.manager_score} disabled={editing !== 'manager'} onChange={(v) => setGoal(i, { manager_score: v })} /></span>
                      )}
                    </div>
                    {editing === 'self' ? (
                      <input value={g.comment || ''} onChange={(e) => setGoal(i, { comment: e.target.value })} placeholder={t('reviews.goal_comment')} maxLength={1000} className={area} />
                    ) : g.comment && <p className="text-xs text-surface-500">{g.comment}</p>}
                  </div>
                ))}
              </div>
            )}
            {(r.score_self != null || r.score_manager != null) && (
              <p className="text-xs text-surface-500 mt-2">
                {r.score_self != null && t('reviews.weighted_self', { n: r.score_self })}
                {r.score_self != null && r.score_manager != null && ' · '}
                {r.score_manager != null && t('reviews.weighted_manager', { n: r.score_manager })}
              </p>
            )}
          </div>

          {/* Self part */}
          {(editing === 'self' || form.self_rating != null || form.self_comments) && (
            <Part title={t('reviews.self_part')}>
              <Stars value={form.self_rating} disabled={editing !== 'self'} onChange={(v) => set({ self_rating: v })} />
              {editing === 'self' ? <textarea rows={3} value={form.self_comments || ''} onChange={(e) => set({ self_comments: e.target.value })} placeholder={t('reviews.self_comments_ph')} className={area} />
                : form.self_comments && <p className="text-sm text-surface-700 whitespace-pre-wrap">{form.self_comments}</p>}
            </Part>
          )}

          {/* Manager part */}
          {(editing === 'manager' || form.manager_rating != null || form.manager_comments) && (
            <Part title={t('reviews.manager_part')}>
              <Stars value={form.manager_rating} disabled={editing !== 'manager'} onChange={(v) => set({ manager_rating: v })} />
              {editing === 'manager' ? (
                <>
                  <textarea rows={3} value={form.manager_comments || ''} onChange={(e) => set({ manager_comments: e.target.value })} placeholder={t('reviews.manager_comments_ph')} className={area} />
                  <RecSelect t={t} value={form.manager_recommendation} onChange={(v) => set({ manager_recommendation: v })} />
                </>
              ) : (
                <>
                  {form.manager_comments && <p className="text-sm text-surface-700 whitespace-pre-wrap">{form.manager_comments}</p>}
                  {form.manager_recommendation && <p className="text-xs text-surface-500">{t('reviews.recommendation')}: {t(`reviews.rec.${recKey(form.manager_recommendation)}`)}</p>}
                </>
              )}
            </Part>
          )}

          {/* HR part */}
          {(editing === 'hr' || form.final_rating != null) && (
            <Part title={t('reviews.final_part')}>
              <Stars value={form.final_rating ?? (editing === 'hr' ? form.manager_rating : null)} disabled={editing !== 'hr'} onChange={(v) => set({ final_rating: v })} />
              {editing === 'hr' ? (
                <>
                  <RecSelect t={t} value={form.final_recommendation ?? form.manager_recommendation} onChange={(v) => set({ final_recommendation: v })} />
                  <textarea rows={2} value={form.hr_comments || ''} onChange={(e) => set({ hr_comments: e.target.value })} placeholder={t('reviews.hr_comments_ph')} className={area} />
                </>
              ) : (
                <>
                  {form.final_recommendation && <p className="text-xs text-surface-500">{t('reviews.recommendation')}: {t(`reviews.rec.${recKey(form.final_recommendation)}`)}</p>}
                  {form.hr_comments && <p className="text-sm text-surface-700 whitespace-pre-wrap">{form.hr_comments}</p>}
                </>
              )}
            </Part>
          )}

          <div className="flex gap-2 flex-wrap justify-end border-t border-surface-100 pt-4">
            {r.roles?.isHR && r.cycle_status === 'Open' && ['Manager Review', 'HR Review'].includes(r.status) && (
              <Button size="sm" variant="ghost" onClick={() => sendBack('Self Review')} disabled={busy}><Undo2 size={14} /> {t('reviews.back_to_employee')}</Button>
            )}
            {r.roles?.isHR && r.cycle_status === 'Open' && r.status === 'HR Review' && r.manager_name && (
              <Button size="sm" variant="ghost" onClick={() => sendBack('Manager Review')} disabled={busy}><Undo2 size={14} /> {t('reviews.back_to_manager')}</Button>
            )}
            {editing && (
              <>
                <Button size="sm" variant="secondary" onClick={save} loading={busy}><Save size={14} /> {t('reviews.save_draft')}</Button>
                <Button size="sm" onClick={submit} loading={busy}><Send size={14} /> {editing === 'hr' ? t('reviews.finalize') : t('reviews.submit')}</Button>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

function Part({ title, children }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-surface-800">{title}</h4>
      {children}
    </div>
  );
}

function RecSelect({ t, value, onChange }) {
  return (
    <select value={value || ''} onChange={(e) => onChange(e.target.value || null)} className={area}>
      <option value="">{t('reviews.recommendation_ph')}</option>
      {RECOMMENDATIONS.map((rc) => <option key={rc} value={rc}>{t(`reviews.rec.${recKey(rc)}`)}</option>)}
    </select>
  );
}
