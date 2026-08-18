import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import api from '@api/axios';
import * as appApi from '@api/applicationsApi';
import AssessmentPanel from './AssessmentPanel';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { confirmAction } from '@utils/confirm';
import { Users, RefreshCw, Loader2, Download, Star, CalendarClock, ClipboardCheck, ArrowRightCircle, CircleDot, Ban } from 'lucide-react';
import dayjs from 'dayjs';

const STAGES = ['New Application', 'CV Screening', 'Shortlisted', 'HR Review', 'Phone Screening', 'First Interview', 'Technical Interview', 'Final Interview', 'Offer Preparation', 'Offer Sent', 'Offer Accepted', 'Offer Rejected', 'Hired', 'Rejected', 'Archived'];
const ITYPES = ['Phone', 'Online', 'In-person', 'Technical', 'Final'];
const RECS = ['Strong Hire', 'Hire', 'Neutral', 'No Hire', 'Strong No Hire'];
const apiErr = (e, f) => e?.response?.data?.error || e?.response?.data?.missing?.join(' · ') || e?.response?.data?.errors?.[0]?.message || f;
const stageVariant = (s) => s === 'Hired' ? 'success' : (s === 'Rejected' || s === 'Offer Rejected') ? 'danger' : s === 'Shortlisted' ? 'info' : 'warning';
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const stage = (t, s) => t(`applicants.stage.${slug(s)}`, s);
const itype = (t, s) => t(`applicants.itype.${slug(s)}`, s);
const rec = (t, s) => t(`applicants.rec.${slug(s)}`, s);

export default function Applicants() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [vacancies, setVacancies] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ vacancy_id: '', stage: '', search: '' });
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);

  const loadVacancies = async () => {
    try { const { data } = await api.get('/vacancies', { params: { limit: 100 } }); setVacancies(data.data || []); } catch { /* ignore */ }
  };
  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data } = await appApi.list(params);
      setRows(data);
    } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadVacancies(); /* eslint-disable-next-line */ }, [currentCompanyId]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId, filters.vacancy_id, filters.stage]);

  const openDetail = async (id) => { setOpenId(id); setDetail(null); try { const { data } = await appApi.get(id); setDetail(data); } catch { toast.error(t('applicants.load_app_failed')); } };
  const reload = async () => { if (openId) { const { data } = await appApi.get(openId); setDetail(data); } load(); };

  const downloadCV = async (id, name) => {
    try {
      const res = await appApi.downloadCV(id);
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a'); a.href = url; a.download = name || 'cv'; a.click(); URL.revokeObjectURL(url);
    } catch (e) { toast.error(apiErr(e, t('applicants.no_cv'))); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('applicants.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('applicants.subtitle')}</p>
        </div>
        <Button variant="secondary" onClick={load}><RefreshCw size={14} /> {t('common.refresh')}</Button>
      </div>

      <div className="flex gap-2 flex-wrap">
        <select value={filters.vacancy_id} onChange={(e) => setFilters((f) => ({ ...f, vacancy_id: e.target.value }))} className="text-sm border border-surface-200 rounded-lg px-3 py-2">
          <option value="">{t('applicants.all_vacancies')}</option>
          {vacancies.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
        </select>
        <select value={filters.stage} onChange={(e) => setFilters((f) => ({ ...f, stage: e.target.value }))} className="text-sm border border-surface-200 rounded-lg px-3 py-2">
          <option value="">{t('applicants.all_stages')}</option>{STAGES.map((s) => <option key={s} value={s}>{stage(t, s)}</option>)}
        </select>
        <form onSubmit={(e) => { e.preventDefault(); load(); }} className="flex-1 min-w-[180px] max-w-xs">
          <input placeholder={t('applicants.search_ph')} value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2" />
        </form>
        <Badge variant="brand">{rows.length} {t('applicants.count')}</Badge>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Users className="w-6 h-6 text-surface-400" />} title={t('applicants.no_applicants')} description={t('applicants.no_applicants_desc')} /></Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <Card key={r.id} hover className="!p-4 cursor-pointer" onClick={() => openDetail(r.id)}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">{(r.first_name?.[0] || '?')}{(r.last_name?.[0] || '')}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-surface-900">{r.first_name} {r.last_name}</span>
                    <Badge variant={stageVariant(r.stage)} className="text-[10px]">{stage(t, r.stage)}</Badge>
                    {r.source && <span className="text-[10px] px-2 py-0.5 rounded bg-surface-100 text-surface-500">{r.source}</span>}
                    {r.rating != null && <span className="text-[10px] text-amber-500 inline-flex items-center gap-0.5"><Star size={11} /> {r.rating}</span>}
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5">{r.vacancy_title} · {r.email} · {t('applicants.applied')} {dayjs(r.created_at).format('MMM D, YYYY')}</p>
                </div>
                {r.cv_file_name && <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); downloadCV(r.id, r.cv_file_name); }}><Download size={13} /> CV</Button>}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!openId} onClose={() => { setOpenId(null); setDetail(null); }}
        title={detail ? `${detail.candidate?.first_name} ${detail.candidate?.last_name} — ${detail.vacancy?.title || ''}` : t('applicants.loading')} size="xl">
        {!detail ? <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 text-brand-600 animate-spin" /></div> : <Detail detail={detail} reload={reload} downloadCV={downloadCV} />}
      </Modal>
    </div>
  );
}

function Detail({ detail, reload, downloadCV }) {
  const { t } = useTranslation();
  const c = detail.candidate || {};
  const [stg, setStg] = useState(detail.stage);
  const terminal = ['Hired', 'Rejected', 'Archived'].includes(detail.stage);

  const moveStage = async () => { try { await appApi.moveStage(detail.id, { stage: stg }); toast.success(t('applicants.moved_to', { stage: stage(t, stg) })); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  const rate = async (n) => { try { await appApi.rate(detail.id, { rating: n }); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  const reject = async () => { const r = window.prompt(t('applicants.rejection_reason')); if (!r) return; try { await appApi.reject(detail.id, { reason: r }); toast.success(t('applicants.rejected')); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  const convert = async () => {
    const ok = await confirmAction(t('applicants.onboarding_q'), t('applicants.onboarding_desc'));
    if (!ok?.isConfirmed) return;
    try { const { data } = await appApi.convert(detail.id); toast.success(t('applicants.onboarding_created', { id: data.onboarding_id })); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap p-3 bg-surface-50 rounded-xl">
        <Badge variant={stageVariant(detail.stage)}>{stage(t, detail.stage)}</Badge>
        <span className="text-sm text-surface-600">{c.email} · {c.phone}</span>
        <div className="ml-auto flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => rate(n)} title={t('applicants.rate_n', { n })}><Star size={15} className={n <= (detail.rating || 0) ? 'text-amber-400 fill-amber-400' : 'text-surface-300'} /></button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Candidate + actions */}
        <div className="space-y-3">
          <div className="text-sm text-surface-600 space-y-1">
            {c.current_job_title && <p><span className="text-surface-400">{t('applicants.current_role')}</span> {c.current_job_title}</p>}
            {detail.years_experience && <p><span className="text-surface-400">{t('applicants.experience')}</span> {detail.years_experience} {t('applicants.yrs')}</p>}
            {detail.expected_salary && <p><span className="text-surface-400">{t('applicants.expected_salary')}</span> {detail.expected_salary}</p>}
            {detail.notice_period && <p><span className="text-surface-400">{t('applicants.notice')}</span> {detail.notice_period}</p>}
            {detail.linkedin_url && <p><a href={detail.linkedin_url} target="_blank" rel="noreferrer" className="text-brand-600 underline">LinkedIn</a></p>}
            {detail.source && <p><span className="text-surface-400">{t('applicants.source')}</span> {detail.source}{detail.utm_campaign ? ` / ${detail.utm_campaign}` : ''}</p>}
            {detail.heard_about_us && (
              <p><span className="text-surface-400">{t('applicants.heard_about_us')}</span> {t(`careers.hau_${detail.heard_about_us.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`, detail.heard_about_us)}
                {detail.referrer_name ? ` — ${detail.referrer_name}` : ''}</p>
            )}
            {detail.cover_letter && <p className="text-xs bg-surface-50 rounded-lg p-2 mt-1 whitespace-pre-line">{detail.cover_letter}</p>}
          </div>
          {c.cv_file_name && <Button size="sm" variant="secondary" onClick={() => downloadCV(detail.id, c.cv_file_name)}><Download size={13} /> {t('applicants.download_cv')}</Button>}

          {!terminal && (
            <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-surface-100">
              <select value={stg} onChange={(e) => setStg(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-2 py-1.5">
                {STAGES.map((s) => <option key={s} value={s}>{stage(t, s)}</option>)}
              </select>
              <Button size="sm" onClick={moveStage}><CircleDot size={13} /> {t('applicants.move')}</Button>
              <Button size="sm" variant="danger" onClick={reject}><Ban size={13} /> {t('applicants.reject')}</Button>
              <Button size="sm" onClick={convert}><ArrowRightCircle size={13} /> {t('applicants.to_onboarding')}</Button>
            </div>
          )}
          {detail.onboarding_id && <p className="text-xs text-emerald-600">{t('applicants.linked_onboarding', { id: detail.onboarding_id })}</p>}

          <InterviewForm applicationId={detail.id} reload={reload} />
          <EvalForm applicationId={detail.id} reload={reload} />
          <AssessmentPanel applicationId={detail.id} hasInterview={detail.interviews?.length > 0} />
        </div>

        {/* Interviews + evaluations + timeline */}
        <div className="space-y-3">
          {detail.interviews?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1.5">{t('applicants.interviews')}</h4>
              {detail.interviews.map((iv) => (
                <div key={iv.id} className="text-sm border border-surface-100 rounded-lg p-2 mb-1.5">
                  <div className="flex items-center gap-2"><Badge variant="info" className="text-[10px]">{itype(t, iv.type)}</Badge><Badge variant={iv.status === 'Completed' ? 'success' : 'warning'} className="text-[10px]">{iv.status}</Badge>{iv.recommendation && <span className="text-[10px] text-surface-500">{rec(t, iv.recommendation)}</span>}</div>
                  <p className="text-xs text-surface-400 mt-0.5">{iv.scheduled_at ? dayjs(iv.scheduled_at).format('MMM D, HH:mm') : '—'} · {iv.interviewers || ''}</p>
                </div>
              ))}
            </div>
          )}
          {detail.evaluations?.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1.5">{t('applicants.evaluations')}</h4>
              {detail.evaluations.map((ev) => (
                <div key={ev.id} className="text-sm border border-surface-100 rounded-lg p-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{t('applicants.overall')} {ev.overall ?? '—'}/5</span>
                    {ev.recommendation && <Badge variant="info" className="text-[10px]">{rec(t, ev.recommendation)}</Badge>}
                    <span className="text-[10px] text-surface-400">{t('applicants.by')} {ev.evaluator_name}</span>
                  </div>
                  {ev.feedback && <p className="text-xs text-surface-500 mt-0.5">{ev.feedback}</p>}
                </div>
              ))}
            </div>
          )}
          <div>
            <h4 className="text-xs font-semibold text-surface-500 uppercase mb-1.5">{t('applicants.activity')}</h4>
            <div className="space-y-1 max-h-44 overflow-auto pr-1">
              {detail.events?.map((e) => (
                <div key={e.id} className="flex items-start gap-2 text-xs"><CircleDot size={10} className="text-brand-400 mt-1 shrink-0" /><div><span className="text-surface-700">{e.detail}</span><span className="text-surface-400"> · {e.user_name} · {dayjs(e.created_at).format('MMM D, HH:mm')}</span></div></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InterviewForm({ applicationId, reload }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: 'Online' });
  const save = async () => {
    try { await appApi.scheduleInterview(applicationId, form); toast.success(t('applicants.interview_scheduled')); setOpen(false); setForm({ type: 'Online' }); reload(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><CalendarClock size={13} /> {t('applicants.schedule_interview')}</Button>;
  return (
    <div className="p-3 rounded-xl border border-surface-100 bg-surface-50/50 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className="text-sm border border-surface-200 rounded-lg px-2 py-1.5">{ITYPES.map((x) => <option key={x} value={x}>{itype(t, x)}</option>)}</select>
        <input type="datetime-local" onChange={(e) => setForm((f) => ({ ...f, scheduled_at: e.target.value.replace('T', ' ') + ':00' }))} className="text-sm border border-surface-200 rounded-lg px-2 py-1.5" />
        <input placeholder={t('applicants.interviewers_ph')} onChange={(e) => setForm((f) => ({ ...f, interviewers: e.target.value }))} className="text-sm border border-surface-200 rounded-lg px-2 py-1.5" />
        <input placeholder={t('applicants.meeting_link_ph')} onChange={(e) => setForm((f) => ({ ...f, meeting_link: e.target.value }))} className="text-sm border border-surface-200 rounded-lg px-2 py-1.5" />
      </div>
      <div className="flex gap-2"><Button size="sm" onClick={save}>{t('applicants.schedule')}</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button></div>
    </div>
  );
}

function EvalForm({ applicationId, reload }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ overall: 3, recommendation: 'Hire' });
  const save = async () => {
    try { await appApi.evaluate(applicationId, form); toast.success(t('applicants.eval_saved')); setOpen(false); reload(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };
  if (!open) return <Button size="sm" variant="ghost" onClick={() => setOpen(true)}><ClipboardCheck size={13} /> {t('applicants.add_evaluation')}</Button>;
  const fields = [['overall', t('applicants.overall')], ['skills_match', t('applicants.f_skills')], ['experience_match', t('applicants.f_experience')], ['communication', t('applicants.f_communication')], ['cultural_fit', t('applicants.f_culture')]];
  return (
    <div className="p-3 rounded-xl border border-surface-100 bg-surface-50/50 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {fields.map(([k, label]) => (
          <label key={k} className="text-xs text-surface-600">{label}
            <select value={form[k] ?? ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-2 py-1 mt-0.5">
              <option value="">—</option>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        ))}
        <label className="text-xs text-surface-600">{t('applicants.recommendation')}
          <select value={form.recommendation} onChange={(e) => setForm((f) => ({ ...f, recommendation: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-2 py-1 mt-0.5">
            {RECS.map((r) => <option key={r} value={r}>{rec(t, r)}</option>)}
          </select>
        </label>
      </div>
      <textarea placeholder={t('applicants.feedback_ph')} rows={2} onChange={(e) => setForm((f) => ({ ...f, feedback: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-2 py-1.5" />
      <div className="flex gap-2"><Button size="sm" onClick={save}>{t('common.save')}</Button><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>{t('common.cancel')}</Button></div>
    </div>
  );
}
