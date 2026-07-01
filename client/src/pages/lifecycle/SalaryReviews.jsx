import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as srApi from '@api/salaryReviewApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import EmptyState from '@components/ui/EmptyState';
import SendDocumentModal from '@components/email/SendDocumentModal';
import { toast } from 'react-toastify';
import { confirmDelete, confirmAction } from '@utils/confirm';
import {
  Banknote, Plus, RefreshCw, Loader2, CheckCircle2, XCircle, Trash2, Send,
  ChevronDown, ChevronUp, Upload, Download, Sparkles, RotateCcw,
} from 'lucide-react';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || (e?.response?.data?.errors?.[0]?.message) || f;
const statusVariant = (s) => ({ Draft: 'info', Submitted: 'warning', Approved: 'success', Rejected: 'danger', Completed: 'brand' }[s] || 'info');
const stLabel = (t, s) => t(`salary_reviews.st_${String(s || '').toLowerCase()}`, s);
const actionLabel = (t, a) => a.action_key === 'custom' ? a.custom_label : t(`salary_reviews.action_${a.action_key}`, a.custom_label || a.action_key);
const actionVariant = (s) => ({ Pending: 'info', Completed: 'success', Skipped: 'inactive' }[s] || 'info');
const isArabic = (s) => /[؀-ۿ]/.test(s || '');
const escapeHtml = (s) => String(s || '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export default function SalaryReviews() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isAdmin = user?.role === 'admin';
  const isHR = ['admin', 'hr_manager'].includes(user?.role);

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newModal, setNewModal] = useState(false);
  const [newYear, setNewYear] = useState(String(dayjs().year() + 1));
  const [creating, setCreating] = useState(false);

  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [expanded, setExpanded] = useState({});
  const [letterItem, setLetterItem] = useState(null);
  const [letterContent, setLetterContent] = useState('');
  const [letterBusy, setLetterBusy] = useState(false);
  const [sendLetter, setSendLetter] = useState(null);
  const [rejectNote, setRejectNote] = useState('');
  const [rejectModal, setRejectModal] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const { data } = await srApi.getReviews(currentCompanyId ? { company_id: currentCompanyId } : {}); setReviews(data); }
    catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId]);

  const openDetail = async (r) => {
    setOpenId(r.id); setDetail(null); setExpanded({});
    try { const { data } = await srApi.getReview(r.id); setDetail(data); }
    catch { toast.error(t('salary_reviews.load_failed')); }
  };
  const reloadDetail = async () => { if (openId) { const { data } = await srApi.getReview(openId); setDetail(data); } load(); };

  const createReview = async () => {
    if (!currentCompanyId) { toast.error(t('payroll_runs.select_company')); return; }
    const year = parseInt(newYear);
    if (!year) { toast.error(t('salary_reviews.year_required')); return; }
    setCreating(true);
    try {
      const { data } = await srApi.createReview({ review_year: year, company_id: currentCompanyId });
      toast.success(t('salary_reviews.created', { count: data.item_count }));
      setNewModal(false); load();
      openDetail({ id: data.id });
    } catch (e) { toast.error(apiErr(e, t('salary_reviews.create_failed'))); }
    finally { setCreating(false); }
  };

  const del = async (r) => {
    const c = await confirmDelete(`salary review ${r.review_year}`);
    if (!c.isConfirmed) return;
    try {
      await srApi.deleteReview(r.id); toast.success(t('common.deleted'));
      if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      setOpenId(null); setDetail(null); load();
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };

  const submit = async (r) => {
    const c = await confirmAction(t('salary_reviews.confirm_submit_title'), t('salary_reviews.confirm_submit_text'));
    if (!c.isConfirmed) return;
    try { await srApi.submitReview(r.id); toast.success(t('salary_reviews.submitted')); reloadDetail(); }
    catch (e) { toast.error(apiErr(e, t('salary_reviews.submit_failed'))); }
  };

  const approve = async (r) => {
    const c = await confirmAction(t('salary_reviews.confirm_approve_title'), t('salary_reviews.confirm_approve_text'));
    if (!c.isConfirmed) return;
    try { await srApi.decideReview(r.id, { decision: 'Approved' }); toast.success(t('salary_reviews.approved')); reloadDetail(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };
  const reject = async () => {
    if (!rejectNote.trim()) { toast.error(t('salary_reviews.reject_note_required')); return; }
    try {
      await srApi.decideReview(openId, { decision: 'Rejected', note: rejectNote });
      toast.success(t('salary_reviews.rejected')); setRejectModal(false); setRejectNote(''); reloadDetail();
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };
  const reopen = async (r) => {
    try { await srApi.reopenReview(r.id); toast.success(t('salary_reviews.reopened')); reloadDetail(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
  };

  const saveItemField = async (item, field, value) => {
    try { await srApi.updateItem(item.id, { [field]: value }); }
    catch (e) { toast.error(apiErr(e, t('salary_reviews.save_failed'))); reloadDetail(); }
  };
  const skipItem = async (item) => {
    try { await srApi.updateItem(item.id, { status: item.status === 'Skipped' ? 'Pending' : 'Skipped' }); reloadDetail(); }
    catch (e) { toast.error(apiErr(e, t('salary_reviews.save_failed'))); }
  };

  const toggleAction = async (action) => {
    const next = action.status === 'Completed' ? 'Pending' : 'Completed';
    try { await srApi.updateAction(action.id, { status: next }); reloadDetail(); }
    catch { toast.error(t('common.operation_failed')); }
  };
  const skipAction = async (action) => {
    try { await srApi.updateAction(action.id, { status: action.status === 'Skipped' ? 'Pending' : 'Skipped' }); reloadDetail(); }
    catch { toast.error(t('common.operation_failed')); }
  };
  const addCustomAction = async (item, label) => {
    if (!label?.trim()) return;
    try { await srApi.addAction(item.id, label.trim()); reloadDetail(); }
    catch { toast.error(t('common.operation_failed')); }
  };

  const uploadDoc = async (item, file, category) => {
    if (!file) return;
    const fd = new FormData(); fd.append('file', file); fd.append('category', category);
    try { await srApi.uploadDocument(item.id, fd); toast.success(t('salary_reviews.doc_uploaded')); reloadDetail(); }
    catch { toast.error(t('salary_reviews.doc_upload_failed')); }
  };
  const downloadDoc = async (item, doc) => {
    try {
      const res = await srApi.downloadDocument(item.id, doc.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a'); a.href = url; a.download = doc.file_name;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { toast.error(t('common.operation_failed')); }
  };

  const openLetter = async (item) => {
    setLetterItem(item); setLetterContent(''); setLetterBusy(true);
    try { const { data } = await srApi.draftLetter(item.id); setLetterContent(data.content); }
    catch (e) { toast.error(apiErr(e, t('salary_reviews.letter_failed'))); setLetterItem(null); }
    finally { setLetterBusy(false); }
  };
  const buildLetterHtml = (content, employeeName, companyName) => {
    const rtl = isArabic(content);
    const body = `<div dir="${rtl ? 'rtl' : 'ltr'}" style="white-space:pre-wrap;font-size:14px;line-height:1.9;color:#111;text-align:${rtl ? 'right' : 'left'};">${escapeHtml(content)}</div>`;
    return `<div style="text-align:center;border-bottom:2px solid #1D1245;padding-bottom:16px;margin-bottom:28px;"><h1 style="margin:0;font-size:20px;color:#1D1245;">${escapeHtml(companyName || '')}</h1><p style="margin:4px 0 0;font-size:12px;color:#666;">${t('salary_reviews.letter_title', 'Salary Revision Letter')}</p></div>${body}`;
  };

  const active = detail;
  const canApprove = active && (active.salary_review_approver_id ? user?.id === active.salary_review_approver_id : isAdmin) && user?.id !== active.prepared_by;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('salary_reviews.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('salary_reviews.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isHR && <Button onClick={() => { setNewYear(String(dayjs().year() + 1)); setNewModal(true); }}><Plus size={16} /> {t('salary_reviews.new_review')}</Button>}
          <Button variant="secondary" onClick={load}><RefreshCw size={14} /></Button>
        </div>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : reviews.length === 0 ? (
        <Card><EmptyState icon={<Banknote className="w-6 h-6 text-surface-400" />} title={t('salary_reviews.no_reviews')} description={t('salary_reviews.no_reviews_desc')} /></Card>
      ) : (
        <div className="space-y-2">
          {reviews.map((r) => (
            <Card key={r.id} hover className="!p-4 cursor-pointer" onClick={() => openDetail(r)}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700"><Banknote size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-surface-900">{r.company_name} — {r.review_year}</span>
                    <Badge variant={statusVariant(r.status)}>{stLabel(t, r.status)}</Badge>
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {r.item_count} {t('salary_reviews.employees')} · {r.applied_count}/{r.item_count} {t('salary_reviews.applied')} · {t('salary_reviews.prepared_by')} {r.prepared_by_name}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* New Review modal */}
      <Modal open={newModal} onClose={() => setNewModal(false)} title={t('salary_reviews.new_review')} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-surface-500">{t('salary_reviews.new_review_desc')}</p>
          <Input label={t('salary_reviews.review_year')} type="number" required value={newYear} onChange={(e) => setNewYear(e.target.value)} />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setNewModal(false)}>{t('common.cancel')}</Button>
            <Button onClick={createReview} loading={creating}>{t('common.create', 'Create')}</Button>
          </div>
        </div>
      </Modal>

      {/* Detail modal */}
      <Modal open={!!openId} onClose={() => { setOpenId(null); setDetail(null); }}
        title={detail ? `${detail.company_name} — ${detail.review_year}` : t('payroll_runs.loading')} size="xl">
        {!detail ? <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 text-brand-600 animate-spin" /></div> : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap p-3 bg-surface-50 rounded-xl">
              <Badge variant={statusVariant(detail.status)}>{stLabel(t, detail.status)}</Badge>
              <span className="text-xs text-surface-500">{t('salary_reviews.prepared_by')}: <b>{detail.prepared_by_name}</b></span>
              {detail.approver_name && <span className="text-xs text-surface-500">{t('salary_reviews.approver')}: <b>{detail.approver_name}</b></span>}
              {detail.decision_note && <span className="text-xs text-surface-500 italic">"{detail.decision_note}"</span>}
              <div className="ms-auto flex gap-2 flex-wrap">
                {detail.status === 'Draft' && isHR && <Button size="sm" onClick={() => submit(detail)}><Send size={14} /> {t('salary_reviews.submit')}</Button>}
                {detail.status === 'Submitted' && canApprove && (
                  <>
                    <Button size="sm" onClick={() => approve(detail)}><CheckCircle2 size={14} /> {t('salary_reviews.approve')}</Button>
                    <Button size="sm" variant="danger" onClick={() => setRejectModal(true)}><XCircle size={14} /> {t('salary_reviews.reject')}</Button>
                  </>
                )}
                {detail.status === 'Rejected' && isHR && <Button size="sm" variant="secondary" onClick={() => reopen(detail)}><RotateCcw size={14} /> {t('salary_reviews.reopen')}</Button>}
                {detail.status === 'Draft' && isAdmin && <Button size="sm" variant="danger" onClick={() => del(detail)}><Trash2 size={14} /></Button>}
              </div>
            </div>

            <div className="space-y-2">
              {(detail.items || []).map((item) => {
                const isOpen = !!expanded[item.id];
                const outOfBand = item.new_basic_salary && item.band_min != null && item.band_max != null &&
                  (Number(item.new_basic_salary) < Number(item.band_min) || Number(item.new_basic_salary) > Number(item.band_max));
                const editable = detail.status === 'Draft' && isHR;
                return (
                  <Card key={item.id} className={`!p-3 ${item.status === 'Skipped' ? 'opacity-50' : ''}`}>
                    <div className="flex items-center gap-3 flex-wrap">
                      <button onClick={() => setExpanded((p) => ({ ...p, [item.id]: !p[item.id] }))} className="p-1 text-surface-400 hover:text-brand-600">
                        {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                      <div className="min-w-[140px]">
                        <p className="font-medium text-surface-800 text-sm">{item.first_name} {item.last_name}</p>
                        <p className="text-[11px] text-surface-400">{item.job_title_name || '—'}</p>
                      </div>
                      <div className="text-xs text-surface-500">
                        {t('salary_reviews.current')}: {item.current_basic_salary ?? '—'} / {item.current_full_salary ?? '—'}
                      </div>
                      <input type="number" disabled={!editable} placeholder={t('salary_reviews.new_basic')}
                        defaultValue={item.new_basic_salary ?? ''} onBlur={(e) => saveItemField(item, 'new_basic_salary', e.target.value)}
                        className={`w-28 text-xs border rounded-lg px-2 py-1.5 ${outOfBand ? 'border-amber-400 bg-amber-50' : 'border-surface-200'}`} />
                      <input type="number" disabled={!editable} placeholder={t('salary_reviews.new_full')}
                        defaultValue={item.new_full_salary ?? ''} onBlur={(e) => saveItemField(item, 'new_full_salary', e.target.value)}
                        className="w-28 text-xs border border-surface-200 rounded-lg px-2 py-1.5" />
                      <input type="date" disabled={!editable} defaultValue={item.effective_date || ''}
                        onBlur={(e) => saveItemField(item, 'effective_date', e.target.value)}
                        className="text-xs border border-surface-200 rounded-lg px-2 py-1.5" />
                      {outOfBand && <Badge variant="warning">{t('salary_reviews.out_of_band')}</Badge>}
                      <Badge variant={statusVariant(item.status === 'Skipped' ? 'Draft' : detail.status)} className="!text-[10px]">
                        {item.status === 'Skipped' ? t('salary_reviews.st_skipped') : stLabel(t, item.status)}
                      </Badge>
                      <div className="ms-auto flex gap-1">
                        {editable && <Button size="sm" variant="ghost" onClick={() => skipItem(item)}>{item.status === 'Skipped' ? t('salary_reviews.unskip') : t('salary_reviews.skip')}</Button>}
                        {detail.status !== 'Draft' && item.new_basic_salary && (
                          <Button size="sm" variant="ghost" onClick={() => openLetter(item)}><Sparkles size={13} /> {t('salary_reviews.generate_letter')}</Button>
                        )}
                      </div>
                    </div>

                    {isOpen && (
                      <div className="mt-3 pt-3 border-t border-surface-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Actions checklist */}
                        <div>
                          <h4 className="text-xs font-semibold text-surface-600 uppercase mb-2">{t('salary_reviews.required_actions')}</h4>
                          <div className="space-y-1.5">
                            {(item.actions || []).map((a) => (
                              <div key={a.id} className="flex items-center gap-2 text-xs">
                                <input type="checkbox" checked={a.status === 'Completed'} onChange={() => toggleAction(a)} className="accent-brand-600" />
                                <span className={a.status === 'Skipped' ? 'line-through text-surface-400' : 'text-surface-700'}>{actionLabel(t, a)}</span>
                                <Badge variant={actionVariant(a.status)} className="!text-[9px]">{a.status}</Badge>
                                <button onClick={() => skipAction(a)} className="ms-auto text-surface-400 hover:text-surface-600">{a.status === 'Skipped' ? t('salary_reviews.unskip') : t('salary_reviews.skip')}</button>
                              </div>
                            ))}
                          </div>
                          <AddActionRow onAdd={(label) => addCustomAction(item, label)} t={t} />
                        </div>
                        {/* Documents */}
                        <div>
                          <h4 className="text-xs font-semibold text-surface-600 uppercase mb-2">{t('salary_reviews.documents')}</h4>
                          <div className="space-y-1.5 mb-2">
                            {(item.documents || []).map((d) => (
                              <div key={d.id} className="flex items-center gap-2 text-xs text-surface-600">
                                <span className="truncate flex-1">{d.file_name}</span>
                                <Badge variant="info" className="!text-[9px]">{d.category}</Badge>
                                <button onClick={() => downloadDoc(item, d)} className="text-brand-600 hover:text-brand-700"><Download size={12} /></button>
                              </div>
                            ))}
                            {(!item.documents || item.documents.length === 0) && <p className="text-[11px] text-surface-400">{t('salary_reviews.no_documents')}</p>}
                          </div>
                          <UploadDocRow onUpload={(file, cat) => uploadDoc(item, file, cat)} t={t} />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Reject modal */}
      <Modal open={rejectModal} onClose={() => setRejectModal(false)} title={t('salary_reviews.reject')} size="sm">
        <div className="space-y-3">
          <p className="text-sm text-surface-500">{t('salary_reviews.reject_hint')}</p>
          <textarea rows={3} value={rejectNote} onChange={(e) => setRejectNote(e.target.value)}
            className="w-full text-sm border border-surface-200 rounded-xl px-3 py-2" placeholder={t('salary_reviews.reject_note_ph')} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRejectModal(false)}>{t('common.cancel')}</Button>
            <Button variant="danger" onClick={reject}>{t('salary_reviews.reject')}</Button>
          </div>
        </div>
      </Modal>

      {/* Letter preview */}
      <Modal open={!!letterItem} onClose={() => setLetterItem(null)} title={t('salary_reviews.letter_title', 'Salary Revision Letter')} size="lg">
        {letterBusy ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div> : (
          <div className="space-y-4">
            <div className="bg-white border border-surface-200 rounded-xl p-8 font-serif leading-relaxed text-sm whitespace-pre-wrap max-h-[55vh] overflow-y-auto shadow-sm">
              {letterContent}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setSendLetter(letterItem)}><Send size={14} /> {t('send_doc.send_pdf', 'Send by Email (PDF)')}</Button>
              <Button onClick={() => setLetterItem(null)}>{t('common.close', 'Close')}</Button>
            </div>
          </div>
        )}
      </Modal>

      <SendDocumentModal
        open={!!sendLetter}
        onClose={() => setSendLetter(null)}
        title={sendLetter ? `${t('salary_reviews.letter_title', 'Salary Revision Letter')} — ${sendLetter.first_name} ${sendLetter.last_name}` : ''}
        getHtml={() => buildLetterHtml(letterContent, sendLetter ? `${sendLetter.first_name} ${sendLetter.last_name}` : '', detail?.company_name)}
        rtl={isArabic(letterContent)}
        defaultTo={sendLetter?.email || ''}
        defaultToName={sendLetter ? `${sendLetter.first_name} ${sendLetter.last_name}` : ''}
        relatedModule="SalaryReview"
        relatedId={sendLetter?.id || ''}
        companyId={detail?.company_id || ''}
        letterheadCompanyId={detail?.company_id || null}
      />
    </div>
  );
}

function AddActionRow({ onAdd, t }) {
  const [label, setLabel] = useState('');
  return (
    <div className="flex gap-1.5">
      <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t('salary_reviews.add_action_ph')}
        className="flex-1 text-xs border border-surface-200 rounded-lg px-2 py-1.5" />
      <Button size="sm" variant="secondary" onClick={() => { onAdd(label); setLabel(''); }}><Plus size={12} /></Button>
    </div>
  );
}

function UploadDocRow({ onUpload, t }) {
  const [category, setCategory] = useState('signed_contract');
  return (
    <div className="flex gap-1.5 items-center">
      <select value={category} onChange={(e) => setCategory(e.target.value)} className="text-xs border border-surface-200 rounded-lg px-2 py-1.5">
        <option value="revision_letter">{t('salary_reviews.doc_revision_letter')}</option>
        <option value="signed_contract">{t('salary_reviews.doc_signed_contract')}</option>
        <option value="mohre_proof">{t('salary_reviews.doc_mohre_proof')}</option>
        <option value="wps_proof">{t('salary_reviews.doc_wps_proof')}</option>
        <option value="other">{t('salary_reviews.doc_other')}</option>
      </select>
      <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1.5 bg-surface-100 hover:bg-surface-200 rounded-lg text-xs text-surface-700">
        <Upload size={12} /> {t('salary_reviews.upload')}
        <input type="file" className="hidden" onChange={(e) => { onUpload(e.target.files[0], category); e.target.value = null; }} />
      </label>
    </div>
  );
}
