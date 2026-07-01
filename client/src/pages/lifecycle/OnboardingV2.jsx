import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as obApi from '@api/onboardingV2Api';
import { previewTemplate } from '@api/emailApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { confirmAction } from '@utils/confirm';
import {
  UserPlus, RefreshCw, Loader2, Check, Lock, Upload, FileText, Send, ChevronRight,
  ShieldCheck, Sparkles, CircleDot, Ban, ArrowRight, Eye, Mail,
} from 'lucide-react';
import dayjs from 'dayjs';
import SendDocumentModal from '@components/email/SendDocumentModal';
import { getCompany } from '@api/companiesApi';
import { companyLetterhead } from '@utils/letterhead';
import { buildOfferLetterHtml } from '@utils/offerLetter';
import { OFFER_PRESETS } from '@/data/offerPresets';

async function resolveCompanyLh(companyId) {
  if (!companyId) return null;
  try { const { data } = await getCompany(companyId); return companyLetterhead(data); }
  catch { return null; }
}

const STAGES = [
  'DRAFT', 'CV_UPLOADED', 'UNDER_HR_REVIEW', 'HR_APPROVED', 'OFFER_SENT', 'OFFER_ACCEPTED',
  'SIGNED_OFFER_UPLOADED', 'DOCUMENTS_COLLECTION', 'VISA_RESIDENCY', 'BANK_DETAILS',
  'READY_FOR_EMPLOYMENT', 'COMPLETED',
];
const idx = (s) => STAGES.indexOf(s);
const stg = (t, s) => t(`ob.stage.${String(s || '').toLowerCase()}`, s);
const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

function stageBadge(t, stage) {
  if (stage === 'REJECTED' || stage === 'CANCELLED') return <Badge variant="danger">{stg(t, stage)}</Badge>;
  if (stage === 'COMPLETED') return <Badge variant="success">{stg(t, stage)}</Badge>;
  return <Badge variant="warning">{stg(t, stage)}</Badge>;
}
function apiErr(e, fallback) {
  const d = e?.response?.data;
  if (d?.missing?.length) return d.missing.join(' · ');
  if (d?.errors?.length) return d.errors.map((x) => x.message).join(' · ');
  return d?.error || fallback;
}

export default function OnboardingV2() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState('');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { loadRecords(); /* eslint-disable-next-line */ }, [currentCompanyId, stageFilter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (stageFilter) params.stage = stageFilter;
      if (search) params.search = search;
      const { data } = await obApi.list(params);
      setRecords(data);
    } catch { toast.error(t('ob.load_failed')); }
    finally { setLoading(false); }
  };

  const openDetail = async (id) => {
    setOpenId(id); setDetailLoading(true);
    try { const { data } = await obApi.get(id); setDetail(data); }
    catch { toast.error(t('ob.load_one_failed')); }
    finally { setDetailLoading(false); }
  };
  const reload = async () => { if (openId) { const { data } = await obApi.get(openId); setDetail(data); } loadRecords(); };

  const handleAdd = async () => {
    try {
      const { data } = await obApi.create({ company_id: currentCompanyId || undefined });
      toast.success(t('ob.created'));
      await loadRecords();
      openDetail(data.id);
    } catch (e) { toast.error(apiErr(e, t('ob.create_failed'))); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('ob.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('ob.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={loadRecords}><RefreshCw size={14} /> {t('common.refresh')}</Button>
          <Button onClick={handleAdd}><UserPlus size={16} /> {t('ob.add_employee')}</Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <form onSubmit={(e) => { e.preventDefault(); loadRecords(); }} className="flex-1 min-w-[200px] max-w-xs">
          <Input placeholder={t('ob.search_ph')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </form>
        <select value={stageFilter} onChange={(e) => setStageFilter(e.target.value)}
          className="text-xs bg-white border border-surface-200 rounded-lg px-3 py-2">
          <option value="">{t('ob.all_stages')}</option>
          {STAGES.concat(['REJECTED', 'CANCELLED']).map((s) => <option key={s} value={s}>{stg(t, s)}</option>)}
        </select>
        <Badge variant="brand">{records.length} {t('ob.records')}</Badge>
      </div>

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3 mb-2" /><div className="h-3 bg-surface-100 rounded w-2/3" /></div>)}</div>
      ) : records.length === 0 ? (
        <Card><EmptyState icon={<UserPlus className="w-6 h-6 text-surface-400" />} title={t('ob.no_records')} description={t('ob.no_records_desc')} /></Card>
      ) : (
        <div className="space-y-3">
          {records.map((r) => {
            const ci = idx(r.stage);
            const pct = ci >= 0 ? Math.round(((ci + 1) / STAGES.length) * 100) : 0;
            return (
              <Card key={r.id} hover className="!p-4 cursor-pointer" onClick={() => openDetail(r.id)}>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">
                    {(r.first_name?.[0] || '?')}{(r.last_name?.[0] || '')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-surface-900">{[r.first_name, r.last_name].filter(Boolean).join(' ') || t('ob.unnamed')}</h3>
                      {stageBadge(t, r.stage)}
                      {r.short_code && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-surface-100 text-surface-600">{r.short_code}</span>}
                    </div>
                    <p className="text-xs text-surface-400 mt-0.5">{r.email || '—'} · {t('ob.started')} {dayjs(r.started_at).format('MMM D, YYYY')}</p>
                  </div>
                  <div className="w-44">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-surface-500">{Math.max(ci + 1, 0)}/{STAGES.length} {t('ob.stages')}</span>
                      <span className="font-semibold text-brand-600">{pct}%</span>
                    </div>
                    <div className="w-full bg-surface-100 rounded-full h-2">
                      <div className="bg-brand-gradient h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-surface-300" />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <Modal open={!!openId} onClose={() => { setOpenId(null); setDetail(null); }}
        title={detail ? t('ob.modal_title', { name: [detail.profile?.first_name, detail.profile?.last_name].filter(Boolean).join(' ') || t('recruitment.candidate', 'Candidate') }) : t('ob.loading')}
        size="xl">
        {detailLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /></div>
        ) : detail ? (
          <DetailView detail={detail} reload={reload} />
        ) : null}
      </Modal>
    </div>
  );
}

// ───────────────────────────── Detail view ─────────────────────────────
function DetailView({ detail, reload }) {
  const { t } = useTranslation();
  const stage = detail.stage;
  const ci = idx(stage);
  const terminal = ['REJECTED', 'CANCELLED', 'COMPLETED'].includes(stage);
  const completeness = detail.profile?.profile_completeness || 0;

  const advance = async () => {
    try {
      const { data } = await obApi.advance(detail.id);
      if (data.stage === 'COMPLETED') toast.success(t('ob.completed_toast'));
      else toast.success(t('ob.advanced_to', { stage: stg(t, data.stage) }));
      reload();
    } catch (e) { toast.error(apiErr(e, t('ob.cannot_advance'))); }
  };

  return (
    <div className="space-y-4">
      {/* Header summary */}
      <div className="flex items-center gap-4 p-3 bg-surface-50 rounded-xl flex-wrap">
        <div>{stageBadge(t, stage)}</div>
        <div className="text-xs text-surface-500">{t('ob.stage_n_of', { n: Math.max(ci + 1, 0), total: STAGES.length })}</div>
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-[10px] font-bold"
            style={{ background: `conic-gradient(#7c3aed ${completeness * 3.6}deg, #e9d5ff 0deg)` }}>
            <span className="w-7 h-7 rounded-full bg-white flex items-center justify-center">{completeness}%</span>
          </div>
          <span className="text-xs text-surface-500">{t('ob.profile')}</span>
        </div>
        {!terminal && (
          <div className="ml-auto flex items-center gap-2">
            {detail.missing_requirements?.length > 0 && (
              <span className="text-[11px] text-amber-600 max-w-[280px] truncate" title={detail.missing_requirements.join(' · ')}>
                {t('ob.requirements_pending', { n: detail.missing_requirements.length })}
              </span>
            )}
            <Button size="sm" onClick={advance} disabled={!detail.can_advance}>
              <ArrowRight size={14} /> {t('ob.advance')}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_1fr] gap-4">
        {/* Stage rail */}
        <div className="space-y-1">
          {STAGES.map((s, i) => {
            const done = i < ci || stage === 'COMPLETED';
            const current = i === ci;
            return (
              <div key={s} className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs ${current ? 'bg-brand-50 text-brand-700 font-semibold' : done ? 'text-emerald-600' : 'text-surface-400'}`}>
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${done ? 'bg-emerald-100' : current ? 'bg-brand-100' : 'bg-surface-100'}`}>
                  {done ? <Check size={11} /> : current ? <CircleDot size={11} /> : i + 1}
                </span>
                {stg(t, s)}
              </div>
            );
          })}
          {terminal && stage !== 'COMPLETED' && (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-red-600 font-semibold"><Ban size={12} /> {stg(t, stage)}</div>
          )}
        </div>

        {/* Active panel */}
        <div className="min-w-0">
          {detail.rejection_reason && terminal && stage !== 'COMPLETED' && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-xs">{t('ob.reason')} {detail.rejection_reason}</div>
          )}
          {(stage === 'DRAFT' || stage === 'CV_UPLOADED' || stage === 'UNDER_HR_REVIEW') && <ProfilePanel detail={detail} reload={reload} />}
          {stage === 'UNDER_HR_REVIEW' && <ReviewPanel detail={detail} reload={reload} />}
          {['HR_APPROVED', 'OFFER_SENT', 'OFFER_ACCEPTED'].includes(stage) && <OffersPanel detail={detail} reload={reload} />}
          {['OFFER_ACCEPTED', 'SIGNED_OFFER_UPLOADED'].includes(stage) && <SignedOfferPanel detail={detail} reload={reload} />}
          {['SIGNED_OFFER_UPLOADED', 'DOCUMENTS_COLLECTION'].includes(stage) && <DocumentsPanel detail={detail} reload={reload} />}
          {stage === 'VISA_RESIDENCY' && <VisaPanel detail={detail} reload={reload} />}
          {stage === 'BANK_DETAILS' && <BankPanel detail={detail} reload={reload} />}
          {['READY_FOR_EMPLOYMENT', 'COMPLETED'].includes(stage) && (
            <div className="p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm flex items-center gap-2 flex-wrap">
              <ShieldCheck size={18} />
              {stage === 'COMPLETED' ? (
                <span className="flex items-center gap-2 flex-wrap">
                  {t('ob.completed_msg')}
                  <Link to="/employees" className="underline font-semibold text-emerald-800 inline-flex items-center gap-1">{t('ob.view_in_employees')} <ChevronRight size={13} /></Link>
                </span>
              ) : t('ob.ready_msg')}
            </div>
          )}

          <EventsTimeline events={detail.events} />
        </div>
      </div>
    </div>
  );
}

// ───────────────────────────── Profile panel ─────────────────────────────
const PROFILE_FIELDS = [
  ['first_name', 'ob.f_first_name'], ['last_name', 'ob.f_last_name'], ['email', 'ob.f_email'], ['phone', 'ob.f_phone'],
  ['nationality', 'ob.f_nationality'], ['current_job_title', 'ob.f_current_title'], ['address', 'ob.f_address'], ['date_of_birth', 'ob.f_dob'],
];
function ProfilePanel({ detail, reload }) {
  const { t } = useTranslation();
  const p = detail.profile || {};
  const extracted = p.extracted_fields ? (typeof p.extracted_fields === 'string' ? JSON.parse(p.extracted_fields || '{}') : p.extracted_fields) : {};
  const fromProfile = () => Object.fromEntries(PROFILE_FIELDS.map(([k]) => {
    let v = p[k] || '';
    if (k === 'date_of_birth' && v) v = String(v).slice(0, 10);
    return [k, v];
  }));
  const [form, setForm] = useState(fromProfile);
  const [saving, setSaving] = useState(false);
  const cvRef = useRef(null);

  useEffect(() => {
    setForm(fromProfile());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detail.id, p.updated_at, p.profile_completeness, p.cv_file_id]);

  const uploadCV = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('cv', file);
    const tId = toast.loading(t('ob.uploading_cv'));
    try {
      const { data } = await obApi.uploadCV(detail.id, fd);
      toast.update(tId, { render: t('ob.cv_parsed', { pct: data.profile_completeness }), type: 'success', isLoading: false, autoClose: 2500 });
      reload();
    } catch (err) { toast.update(tId, { render: apiErr(err, t('ob.cv_failed')), type: 'error', isLoading: false, autoClose: 3000 }); }
    finally { e.target.value = ''; }
  };
  const save = async () => {
    setSaving(true);
    try { await obApi.updateProfile(detail.id, form); toast.success(t('ob.profile_saved')); reload(); }
    catch (e) { toast.error(apiErr(e, t('ob.save_profile_failed'))); }
    finally { setSaving(false); }
  };
  const verify = async () => {
    try { await obApi.verifyProfile(detail.id); toast.success(t('ob.profile_verified')); reload(); }
    catch (e) { toast.error(apiErr(e, t('ob.verify_failed'))); }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-brand-50 border border-brand-100">
        <div className="flex items-center gap-2 text-sm text-brand-700"><Sparkles size={16} /> {t('ob.upload_cv_hint')}</div>
        <input ref={cvRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={uploadCV} />
        <Button size="sm" variant="secondary" onClick={() => cvRef.current?.click()}><Upload size={14} /> {t('ob.upload_cv')}</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {PROFILE_FIELDS.map(([k, label]) => (
          <div key={k}>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-xs font-semibold text-surface-700">{t(label)}</label>
              {extracted[k] && <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-600 font-medium">AI</span>}
            </div>
            <input type={k === 'date_of_birth' ? 'date' : 'text'} value={form[k] || ''}
              onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-brand-200" />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={save} loading={saving}>{t('ob.save_profile')}</Button>
        {detail.stage === 'UNDER_HR_REVIEW' && (
          <Button size="sm" variant="secondary" onClick={verify} disabled={p.profile_verified}>
            <ShieldCheck size={14} /> {p.profile_verified ? t('ob.verified') : t('ob.verify_profile')}
          </Button>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────── HR review panel ─────────────────────────────
function ReviewPanel({ detail, reload }) {
  const { t } = useTranslation();
  const [note, setNote] = useState('');
  const decLabel = (d) => ({ Approved: t('ob.dec_approved'), Rejected: t('ob.dec_rejected'), 'More Info': t('ob.dec_more_info') }[d] || d);
  const decide = async (decision) => {
    let body = { decision, note };
    if (decision === 'Rejected') {
      const res = await confirmAction(t('ob.reject_title'), t('ob.reject_desc'));
      if (!res?.isConfirmed) return;
      if (!note.trim()) { toast.error(t('ob.rejection_required')); return; }
      body.rejection_reason = note;
    }
    try { await obApi.review(detail.id, body); toast.success(t('ob.candidate_decided', { decision: decLabel(decision) })); reload(); }
    catch (e) { toast.error(apiErr(e, t('ob.review_failed'))); }
  };
  return (
    <div className="mt-4 p-3 rounded-xl border border-surface-100 bg-surface-50/50 space-y-2">
      <h4 className="text-sm font-semibold text-surface-800">{t('ob.hr_decision')}</h4>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder={t('ob.note_ph')}
        className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2" />
      <div className="flex gap-2">
        <Button size="sm" onClick={() => decide('Approved')}>{t('ob.approve')}</Button>
        <Button size="sm" variant="danger" onClick={() => decide('Rejected')}>{t('ob.reject')}</Button>
        <Button size="sm" variant="ghost" onClick={() => decide('More Info')}>{t('ob.request_info')}</Button>
      </div>
    </div>
  );
}

// ───────────────────────────── Offers panel ─────────────────────────────
const OFFER_FORM = [
  ['job_title', 'ob.of_job_title', 'text', true], ['department', 'ob.of_department', 'text'], ['work_location', 'ob.of_work_location', 'text', true],
  ['employment_type', 'ob.of_employment_type', 'select'], ['reporting_manager', 'ob.of_reporting_manager', 'text'],
  ['joining_date', 'ob.of_joining_date', 'date', true], ['basic_salary', 'ob.of_basic_salary', 'number', true],
  ['offer_expiry_date', 'ob.of_offer_expiry', 'date', true], ['probation_period', 'ob.of_probation', 'text'],
  ['working_hours', 'ob.of_working_hours', 'text'], ['notice_period', 'ob.of_notice', 'text'],
  ['commission_structure', 'ob.of_commission', 'text'], ['leave_policy', 'ob.of_leave_policy', 'text'],
  ['benefits', 'ob.of_benefits', 'text'], ['visa_responsibility', 'ob.of_visa', 'text'], ['medical_insurance', 'ob.of_medical', 'text'],
];
const EMP_TYPES = ['Full-time', 'Part-time', 'Contract', 'Temporary'];
function OffersPanel({ detail, reload }) {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ employment_type: 'Full-time' });
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(null);
  const [sendDoc, setSendDoc] = useState(null);
  const offers = detail.offers || [];
  const last = offers[offers.length - 1];
  const hasOpenOffer = offers.some((o) => ['Draft', 'Sent', 'Accepted'].includes(o.status));
  const canCreate = ['HR_APPROVED', 'OFFER_SENT'].includes(detail.stage) && !hasOpenOffer;
  const offerStatus = (s) => t(`ob.os_${String(s || '').toLowerCase()}`, s);

  const openForm = () => {
    if (showForm) { setShowForm(false); return; }
    if (last) {
      const prefill = { employment_type: last.employment_type || 'Full-time' };
      OFFER_FORM.forEach(([k]) => {
        let v = last[k];
        if (v == null) return;
        if ((k === 'joining_date' || k === 'offer_expiry_date')) v = String(v).slice(0, 10);
        prefill[k] = v;
      });
      setForm(prefill);
    }
    setShowForm(true);
  };

  const create = async () => {
    setSaving(true);
    try { await obApi.createOffer(detail.id, form); toast.success(t('ob.offer_created')); setShowForm(false); setForm({ employment_type: 'Full-time' }); reload(); }
    catch (e) { toast.error(apiErr(e, t('ob.create_offer_failed'))); }
    finally { setSaving(false); }
  };
  const applyPreset = (preset) => {
    const { key, label, ...fields } = preset;
    setForm((f) => ({ ...f, employment_type: 'Full-time', ...fields }));
  };
  const buildOfferEmailData = (o) => ({
    candidate_name: o.candidate_name || [detail.profile?.first_name, detail.profile?.last_name].filter(Boolean).join(' ') || 'Candidate',
    company: detail.company_name || '', offer_number: o.offer_number, job_title: o.job_title, department: o.department,
    reporting_manager: o.reporting_manager, work_location: o.work_location, employment_type: o.employment_type,
    joining_date: o.joining_date ? dayjs(o.joining_date).format('MMM D, YYYY') : '', basic_salary: o.basic_salary,
    allowances: o.allowances, commission_structure: o.commission_structure, probation_period: o.probation_period,
    working_hours: o.working_hours, leave_policy: o.leave_policy, benefits: o.benefits, visa_responsibility: o.visa_responsibility,
    medical_insurance: o.medical_insurance, notice_period: o.notice_period,
    offer_expiry_date: o.offer_expiry_date ? dayjs(o.offer_expiry_date).format('MMM D, YYYY') : '', additional_terms: o.additional_terms,
  });
  const previewEmail = async (o) => {
    setPreview({ loading: true, offerNumber: o.offer_number });
    try {
      const { data } = await previewTemplate({ templateType: 'employment_offer', data: buildOfferEmailData(o) });
      setPreview({ loading: false, subject: data.subject, html: data.html, offerNumber: o.offer_number, offer: o });
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); setPreview(null); }
  };
  const send = async (o) => { try { await obApi.sendOffer(o.id); toast.success(t('ob.offer_sent_toast', { num: o.offer_number })); reload(); } catch (e) { toast.error(apiErr(e, t('ob.send_failed'))); } };
  const respond = async (o, response) => {
    let body = { response };
    if (response === 'Rejected') { const reason = window.prompt(t('ob.rejection_reason_prompt')); if (!reason) return; body.rejection_reason = reason; }
    try { await obApi.respondOffer(o.id, body); toast.success(t('ob.offer_response', { response: response === 'Accepted' ? t('ob.accepted_btn') : t('ob.rejected_btn') })); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-surface-800">{t('ob.offers_title')} <span className="text-surface-400 font-normal">{t('ob.offers_total', { n: detail.total_offers || 0 })}</span></h4>
        {canCreate
          ? <Button size="sm" onClick={openForm}>{showForm ? t('common.cancel') : (last && last.status === 'Rejected' ? t('ob.create_new_offer') : t('ob.create_offer'))}</Button>
          : hasOpenOffer && <span className="text-[11px] text-surface-400">{t('ob.close_offer_first')}</span>}
      </div>
      {last && last.status === 'Rejected' && canCreate && !showForm && (
        <p className="text-[11px] text-amber-600">{t('ob.prev_rejected', { num: last.offer_number })}{last.rejection_reason ? ` (“${last.rejection_reason}”)` : ''}</p>
      )}

      {showForm && (
        <div className="p-3 rounded-xl border border-surface-100 bg-surface-50/50 space-y-3">
          <div>
            <label className="text-xs font-semibold text-surface-700 block mb-1">{t('ob.use_preset')}</label>
            <div className="flex flex-wrap gap-1.5">
              {OFFER_PRESETS.map((p) => (
                <button key={p.key} type="button" onClick={() => applyPreset(p)}
                  className="text-xs px-2.5 py-1 rounded-lg border border-surface-200 bg-white hover:bg-brand-50 hover:border-brand-200 hover:text-brand-700 transition-colors">
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {OFFER_FORM.map(([k, label, type, req]) => (
              <div key={k}>
                <label className="text-xs font-semibold text-surface-700">{t(label)}{req && <span className="text-red-500"> *</span>}</label>
                {type === 'select' ? (
                  <select value={form[k] || 'Full-time'} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 mt-1">
                    {EMP_TYPES.map((o) => <option key={o} value={o}>{t(`ob.et_${slug(o)}`, o)}</option>)}
                  </select>
                ) : (
                  <input type={type} value={form[k] || ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 mt-1" />
                )}
              </div>
            ))}
          </div>
          <div>
            <label className="text-xs font-semibold text-surface-700">{t('ob.of_additional_terms')}</label>
            <textarea value={form.additional_terms || ''} onChange={(e) => setForm((f) => ({ ...f, additional_terms: e.target.value }))} rows={8}
              className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 mt-1 font-mono" />
          </div>
          <Button size="sm" onClick={create} loading={saving}>{t('ob.save_draft_offer')}</Button>
        </div>
      )}

      {offers.length === 0 ? (
        <p className="text-xs text-surface-400">{t('ob.no_offers')}</p>
      ) : offers.map((o) => (
        <div key={o.id} className="p-3 rounded-xl border border-surface-100 flex items-center gap-3 flex-wrap">
          <FileText size={16} className="text-brand-500" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">{o.offer_number}</span>
              <Badge variant={o.status === 'Accepted' ? 'success' : o.status === 'Rejected' ? 'danger' : o.status === 'Sent' ? 'warning' : 'info'}>{offerStatus(o.status)}</Badge>
              <span className="text-[10px] text-surface-400">v{o.version}</span>
            </div>
            <p className="text-xs text-surface-500">{o.job_title} · {o.work_location} · {t('ob.joins')} {o.joining_date ? dayjs(o.joining_date).format('MMM D, YYYY') : '—'} · {t('ob.basic')} {o.basic_salary || '—'}</p>
            {o.rejection_reason && <p className="text-[11px] text-red-500 mt-0.5">{t('ob.rejected_label')} {o.rejection_reason}</p>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => previewEmail(o)} title={t('ob.offer_email_preview')}><Eye size={13} /> {t('ob.preview')}</Button>
          {o.status === 'Draft' && <Button size="sm" onClick={() => send(o)}><Send size={13} /> {t('common.submit')}</Button>}
          {o.status === 'Sent' && (
            <div className="flex gap-1.5">
              <Button size="sm" onClick={() => respond(o, 'Accepted')}>{t('ob.accepted_btn')}</Button>
              <Button size="sm" variant="danger" onClick={() => respond(o, 'Rejected')}>{t('ob.rejected_btn')}</Button>
            </div>
          )}
        </div>
      ))}

      {/* Offer email preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} title={`${t('ob.offer_email_preview')}${preview?.offerNumber ? ` — ${preview.offerNumber}` : ''}`} size="lg">
        {preview?.loading ? (
          <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 text-brand-600 animate-spin" /></div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm bg-surface-50 rounded-lg px-3 py-2">
              <Mail size={15} className="text-brand-500" />
              <span className="text-surface-500">{t('ob.subject')}</span>
              <span className="font-medium text-surface-800">{preview.subject}</span>
            </div>
            <p className="text-[11px] text-surface-400">{t('ob.preview_note')}</p>
            <div className="border border-surface-100 rounded-xl overflow-hidden">
              <iframe title="offer-email" srcDoc={preview.html} className="w-full" style={{ height: '60vh', border: 0 }} sandbox="" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button size="sm" variant="secondary" onClick={async () => {
                const lh = await resolveCompanyLh(detail.company_id);
                const html = lh ? buildOfferLetterHtml(preview.offer, { companyName: detail.company_name, candidateName: detail.candidate_name }) : preview.html;
                setSendDoc({ html, title: `Employment Offer ${preview.offerNumber || ''}`.trim(), lh });
              }}>
                <Send size={13} /> {t('ob.send_as_pdf')}
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      {/* Send offer as PDF (cover email + attachment) */}
      <SendDocumentModal
        open={!!sendDoc}
        onClose={() => setSendDoc(null)}
        title={sendDoc?.title || 'Employment Offer'}
        getHtml={() => sendDoc?.html || ''}
        rtl={false}
        letterhead={sendDoc?.lh || null}
        defaultTo={detail.email || detail.candidate_email || ''}
        defaultToName={detail.candidate_name || ''}
        relatedModule="Onboarding"
        relatedId={detail.id || ''}
        companyId={detail.company_id || ''}
      />
    </div>
  );
}

// ───────────────────────────── Signed offer panel ─────────────────────────────
function SignedOfferPanel({ detail, reload }) {
  const { t } = useTranslation();
  const so = detail.signed_offer;
  const ref = useRef(null);
  const upload = async (e) => {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file);
    try { await obApi.uploadSignedOffer(detail.id, fd); toast.success(t('ob.signed_offer_uploaded')); reload(); }
    catch (err) { toast.error(apiErr(err, t('ob.upload_failed'))); } finally { e.target.value = ''; }
  };
  const verify = async (status) => { try { await obApi.verifySignedOffer(detail.id, { status }); toast.success(t('ob.signed_offer_x', { status })); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  return (
    <div className="mt-4 p-3 rounded-xl border border-surface-100 space-y-2">
      <h4 className="text-sm font-semibold text-surface-800">{t('ob.signed_offer')}</h4>
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant={so?.verification_status === 'Verified' ? 'success' : so?.verification_status === 'Rejected' ? 'danger' : 'info'}>{so?.verification_status || t('ob.not_uploaded')}</Badge>
        <input ref={ref} type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg" onChange={upload} />
        <Button size="sm" variant="secondary" onClick={() => ref.current?.click()}><Upload size={13} /> {t('ob.upload_signed')}</Button>
        {so?.file_id && so.verification_status !== 'Verified' && (
          <>
            <Button size="sm" onClick={() => verify('Verified')}>{t('ob.verify')}</Button>
            <Button size="sm" variant="danger" onClick={() => verify('Rejected')}>{t('ob.reject')}</Button>
          </>
        )}
      </div>
      <p className="text-[11px] text-surface-400">{t('ob.signed_hint')}</p>
    </div>
  );
}

// ───────────────────────────── Documents panel ─────────────────────────────
function DocumentsPanel({ detail, reload }) {
  const { t } = useTranslation();
  const docs = detail.documents || [];
  const uploadFor = async (doc, file) => {
    const fd = new FormData(); fd.append('file', file);
    try { await obApi.uploadDocument(doc.id, fd); toast.success(t('ob.doc_uploaded', { label: doc.label })); reload(); }
    catch (e) { toast.error(apiErr(e, t('ob.upload_failed'))); }
  };
  const verify = async (doc, status) => { try { await obApi.verifyDocument(doc.id, { status }); toast.success(t('ob.doc_status', { label: doc.label, status })); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  const statusVariant = (s) => ({ Verified: 'success', Rejected: 'danger', Expired: 'danger', Pending: 'warning', Uploaded: 'warning' }[s] || 'info');
  if (!docs.length) return <p className="text-xs text-surface-400 mt-4">{t('ob.docs_hint')}</p>;
  return (
    <div className="mt-4 space-y-2">
      <h4 className="text-sm font-semibold text-surface-800">{t('ob.required_docs')}</h4>
      {docs.map((d) => (
        <div key={d.id} className="p-2.5 rounded-lg border border-surface-100 flex items-center gap-3 flex-wrap">
          <span className="text-sm flex-1 min-w-0">{d.label} {d.required ? <span className="text-[10px] text-red-500">{t('ob.required')}</span> : <span className="text-[10px] text-surface-400">{t('ob.optional')}</span>}</span>
          <Badge variant={statusVariant(d.status)}>{d.status}</Badge>
          <label className="cursor-pointer text-xs bg-surface-100 hover:bg-surface-200 px-2 py-1 rounded-lg">
            <Upload size={12} className="inline" /> {t('ob.file')}
            <input type="file" className="hidden" onChange={(e) => e.target.files?.[0] && uploadFor(d, e.target.files[0])} />
          </label>
          {d.status !== 'Verified' && <Button size="sm" onClick={() => verify(d, 'Verified')}>{t('ob.verify')}</Button>}
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── Visa panel ─────────────────────────────
function VisaPanel({ detail, reload }) {
  const { t } = useTranslation();
  const steps = detail.visa_steps || [];
  const seed = async () => { try { await obApi.seedVisa(detail.id); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  const update = async (step, patch) => { try { await obApi.updateVisaStep(step.id, patch); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  const skip = async () => {
    const r = await confirmAction(t('ob.visa_skip_q'), t('ob.visa_skip_desc'));
    if (!r?.isConfirmed) return;
    try { await obApi.advance(detail.id, { visa_not_applicable: true }); toast.success(t('ob.visa_skipped')); reload(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };
  const ST = ['Not Started', 'In Progress', 'Submitted', 'Approved', 'Completed', 'Rejected'];
  return (
    <div className="mt-4 space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-surface-800">{t('ob.visa_title')}</h4>
        <div className="flex gap-2">
          {!steps.length && <Button size="sm" variant="secondary" onClick={seed}>{t('ob.init_steps')}</Button>}
          <Button size="sm" variant="ghost" onClick={skip}>{t('ob.not_applicable')}</Button>
        </div>
      </div>
      {steps.map((s) => (
        <div key={s.id} className="p-2.5 rounded-lg border border-surface-100 flex items-center gap-3 flex-wrap">
          <span className="text-sm flex-1 min-w-0">{s.label}{s.required ? <span className="text-[10px] text-red-500 ml-1">{t('ob.required')}</span> : ''}</span>
          <input placeholder={t('ob.ref_ph')} defaultValue={s.reference_number || ''} onBlur={(e) => e.target.value !== (s.reference_number || '') && update(s, { reference_number: e.target.value })}
            className="text-xs border border-surface-200 rounded-lg px-2 py-1 w-28" />
          <select value={s.status} onChange={(e) => update(s, { status: e.target.value })} className="text-xs border border-surface-200 rounded-lg px-2 py-1">
            {ST.map((o) => <option key={o} value={o}>{t(`ob.vs_${slug(o)}`, o)}</option>)}
          </select>
        </div>
      ))}
    </div>
  );
}

// ───────────────────────────── Bank panel ─────────────────────────────
const BANK_FIELDS = [['bank_name', 'ob.bk_bank_name', true], ['account_holder_name', 'ob.bk_holder', true], ['account_number', 'ob.bk_account', true], ['iban', 'ob.bk_iban', true], ['swift_code', 'ob.bk_swift'], ['branch_name', 'ob.bk_branch']];
const TRANSFER_METHODS = ['Bank Transfer', 'WPS', 'Cheque', 'Cash'];
function BankPanel({ detail, reload }) {
  const { t } = useTranslation();
  const b = detail.bank || {};
  const [form, setForm] = useState({
    bank_name: b.bank_name || '', account_holder_name: b.account_holder_name || '', account_number: b.account_number || '',
    iban: b.iban || '', swift_code: b.swift_code || '', branch_name: b.branch_name || '', transfer_method: b.transfer_method || 'Bank Transfer',
  });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await obApi.saveBank(detail.id, form); toast.success(t('ob.bank_saved')); reload(); }
    catch (e) { toast.error(apiErr(e, t('ob.bank_save_failed'))); } finally { setSaving(false); }
  };
  const verify = async () => { try { await obApi.verifyBank(detail.id); toast.success(t('ob.bank_verified')); reload(); } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } };
  return (
    <div className="mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-surface-800">{t('ob.bank_title')}</h4>
        {b.verified ? <Badge variant="success">{t('ob.verified')}</Badge> : <Badge variant="info">{t('ob.unverified')}</Badge>}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {BANK_FIELDS.map(([k, label, req]) => (
          <div key={k}>
            <label className="text-xs font-semibold text-surface-700">{t(label)}{req && <span className="text-red-500"> *</span>}</label>
            <input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 mt-1" />
          </div>
        ))}
        <div>
          <label className="text-xs font-semibold text-surface-700">{t('ob.transfer_method')}</label>
          <select value={form.transfer_method} onChange={(e) => setForm((f) => ({ ...f, transfer_method: e.target.value }))} className="w-full text-sm bg-white border border-surface-200 rounded-lg px-3 py-2 mt-1">
            {TRANSFER_METHODS.map((o) => <option key={o} value={o}>{t(`ob.tm_${slug(o)}`, o)}</option>)}
          </select>
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={save} loading={saving}>{t('common.save')}</Button>
        <Button size="sm" variant="secondary" onClick={verify} disabled={b.verified}><ShieldCheck size={13} /> {t('ob.verify')}</Button>
      </div>
    </div>
  );
}

// ───────────────────────────── Events timeline ─────────────────────────────
function EventsTimeline({ events }) {
  const { t } = useTranslation();
  if (!events?.length) return null;
  return (
    <div className="mt-5 border-t border-surface-100 pt-3">
      <h4 className="text-xs font-semibold text-surface-500 mb-2 uppercase tracking-wide">{t('ob.activity')}</h4>
      <div className="space-y-1.5 max-h-48 overflow-auto pr-1">
        {events.slice(0, 30).map((e) => (
          <div key={e.id} className="flex items-start gap-2 text-xs">
            <CircleDot size={10} className="text-brand-400 mt-1 shrink-0" />
            <div>
              <span className="text-surface-700">{e.detail}</span>
              <span className="text-surface-400"> · {e.user_name} · {dayjs(e.created_at).format('MMM D, HH:mm')}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
