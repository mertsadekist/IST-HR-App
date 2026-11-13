import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { toast } from 'react-toastify';
import { Loader2, Paperclip, Download, Upload, Send, Check, X, Ban } from 'lucide-react';
import Modal from '@components/ui/Modal';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import ApprovalProgress from '@components/approvals/ApprovalProgress';
import * as requestsApi from '@api/requestsApi';
import { CASE_STATUSES, OPEN_STATUSES, slug, statusVariant, money, requestTitle, saveBlob } from '@utils/requests';

const apiErr = (e, f) => e?.response?.data?.error || f;

/**
 * One request: what was asked, where it is in its approval chain, its files and
 * the conversation with HR. `staff` adds HR's controls — the final decision for
 * an expense or advance, issuing a letter, working a case.
 */
export default function RequestDetail({ t, id, staff = false, onClose, onChanged }) {
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, r: null });
  const [assignees, setAssignees] = useState([]);
  const [busy, setBusy] = useState(false);
  const [comment, setComment] = useState('');
  const [reason, setReason] = useState('');
  const [override, setOverride] = useState('');
  const [decision, setDecision] = useState({});
  const fileRef = useRef(null);
  const [fileKind, setFileKind] = useState('attachment');
  const key = `${id}:${reload}`;

  useEffect(() => {
    let off = false;
    requestsApi.getRequest(id)
      .then(({ data }) => { if (!off) setState({ key, r: data }); })
      .catch(() => { if (!off) setState({ key, r: null }); });
    return () => { off = true; };
  }, [id, key]);

  useEffect(() => {
    if (!staff) return undefined;
    let off = false;
    requestsApi.getAssignees().then(({ data }) => { if (!off) setAssignees(data); }).catch(() => {});
    return () => { off = true; };
  }, [staff]);

  const r = state.key === key ? state.r : null;
  const loading = state.key !== key;
  const open = r && OPEN_STATUSES.includes(r.status);
  const chainPending = r?.approval?.status === 'Pending';
  // A resolved case is still HR's to close (or reopen).
  const workable = r && (r.type === 'case' ? !['Closed', 'Rejected', 'Cancelled'].includes(r.status) : open);

  const run = async (fn, okMsg) => {
    setBusy(true);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      setReload((n) => n + 1);
      onChanged?.();
      return true;
    } catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); return false; }
    finally { setBusy(false); }
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    if (await run(() => requestsApi.addComment(r.id, comment.trim()))) setComment('');
  };
  const pickFile = (kind) => { setFileKind(kind); fileRef.current?.click(); };
  const upload = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) await run(() => requestsApi.addFile(r.id, f, fileKind), t('requests.file_added'));
  };
  const download = async (f) => {
    try { const { data } = await requestsApi.downloadFile(f.id); saveBlob(data, f.file_name); }
    catch { toast.error(t('common.operation_failed')); }
  };
  const approve = () => run(() => requestsApi.approveRequest(r.id, {
    ...decision, ...(chainPending && isAdmin ? { override_chain: override } : {}),
  }), r.type === 'letter' ? t('requests.letter_issued') : t('requests.approved_msg'));
  const reject = () => {
    if (!reason.trim()) { toast.error(t('requests.reason_required')); return; }
    run(() => requestsApi.rejectRequest(r.id, reason.trim()), t('requests.rejected_msg'));
  };
  const withdraw = () => run(() => requestsApi.cancelRequest(r.id), t('requests.cancelled_msg'));
  const updateCase = (data) => run(() => requestsApi.updateCase(r.id, data), t('requests.updated_msg'));

  const d = r?.details || {};
  return (
    <Modal open onClose={onClose} size="lg" title={r ? requestTitle(t, r) : t('requests.request')}>
      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : !r ? (
        <p className="text-sm text-surface-500">{t('requests.not_found')}</p>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-2 flex-wrap text-sm">
            <Badge variant="brand">{t(`requests.type.${r.type}`)}</Badge>
            <Badge variant={statusVariant(r.status)}>{t(`requests.status.${slug(r.status)}`)}</Badge>
            {staff && <span className="font-medium text-surface-800">{r.employee_name}</span>}
            <span className="text-xs text-surface-400 ms-auto">#{r.id} · {String(r.created_at).slice(0, 10)}</span>
          </div>

          {/* What was asked */}
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm bg-surface-50 rounded-xl p-4">
            {r.type === 'letter' && (<>
              <Field label={t('requests.f.letter_type')} value={t(`requests.letter_type.${slug(d.letter_type)}`)} />
              <Field label={t('requests.f.language')} value={t(`requests.lang.${d.language}`)} />
              <Field label={t('requests.f.addressed_to')} value={d.addressed_to || t('requests.to_whom')} />
              <Field label={t('requests.f.purpose')} value={d.purpose} wide />
            </>)}
            {r.type === 'expense' && (<>
              <Field label={t('requests.f.amount')} value={money(r.amount)} />
              <Field label={t('requests.f.category')} value={t(`requests.expense_cat.${d.category}`)} />
              <Field label={t('requests.f.expense_date')} value={d.expense_date} />
              <Field label={t('requests.f.description')} value={d.description} wide />
            </>)}
            {r.type === 'advance' && (<>
              <Field label={t('requests.f.amount')} value={money(r.amount)} />
              <Field label={t('requests.f.months')} value={d.months} />
              <Field label={t('requests.f.instalment')} value={money(d.instalment)} />
              <Field label={t('requests.f.reason')} value={d.reason} wide />
            </>)}
            {r.type === 'case' && (<>
              <Field label={t('requests.f.category')} value={t(`requests.case_cat.${d.category}`)} />
              <Field label={t('requests.f.assigned_to')} value={r.assigned_to_name || '—'} />
              <Field label={t('requests.f.due_date')} value={r.due_date || '—'} />
              <Field label={t('requests.f.description')} value={d.description} wide />
            </>)}
            {r.decision_note && <Field label={t('requests.f.decision')} value={r.decision_note} wide />}
          </dl>

          {r.approval && <ApprovalProgress t={t} approval={r.approval} />}

          {/* Files */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h4 className="text-sm font-semibold text-surface-800">{t('requests.files')}</h4>
              <input ref={fileRef} type="file" className="hidden" onChange={upload}
                accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" />
              <div className="ms-auto flex gap-2">
                {open && <Button size="sm" variant="secondary" onClick={() => pickFile('attachment')} disabled={busy}><Paperclip size={14} /> {t('requests.attach')}</Button>}
                {staff && open && r.type === 'letter' && (
                  <Button size="sm" onClick={() => pickFile('result')} disabled={busy}><Upload size={14} /> {t('requests.upload_letter')}</Button>
                )}
              </div>
            </div>
            {r.files.length === 0 ? <p className="text-xs text-surface-400">{t('requests.no_files')}</p> : (
              <ul className="space-y-1">
                {r.files.map((f) => (
                  <li key={f.id} className="flex items-center gap-2 text-sm">
                    <button type="button" onClick={() => download(f)} className="inline-flex items-center gap-1.5 text-brand-700 hover:underline">
                      <Download size={14} /> {f.file_name}
                    </button>
                    {f.kind === 'result' && <Badge variant="success" className="text-[10px]">{t('requests.issued_document')}</Badge>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Conversation */}
          <div>
            <h4 className="text-sm font-semibold text-surface-800 mb-2">{t('requests.conversation')}</h4>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {r.comments.length === 0 && <p className="text-xs text-surface-400">{t('requests.no_comments')}</p>}
              {r.comments.map((c) => (
                <div key={c.id} className={`rounded-xl px-3 py-2 text-sm ${c.user_id === user?.id ? 'bg-brand-50 ms-8' : 'bg-surface-50 me-8'}`}>
                  <p className="text-[11px] text-surface-500 mb-0.5">{c.user_name || '—'} · {String(c.created_at).slice(0, 16).replace('T', ' ')}</p>
                  <p className="text-surface-800 whitespace-pre-wrap">{c.body}</p>
                </div>
              ))}
            </div>
            {!['Cancelled'].includes(r.status) && (
              <div className="flex gap-2 mt-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} maxLength={2000}
                  onKeyDown={(e) => { if (e.key === 'Enter') sendComment(); }}
                  placeholder={t('requests.comment_ph')}
                  className="flex-1 text-sm bg-white border border-surface-200 rounded-lg px-3 py-2" />
                <Button size="sm" variant="secondary" onClick={sendComment} disabled={busy || !comment.trim()}><Send size={14} /></Button>
              </div>
            )}
          </div>

          {/* The employee's own action */}
          {!staff && open && (
            <div className="flex justify-end">
              <Button size="sm" variant="secondary" onClick={withdraw} disabled={busy}><Ban size={14} /> {t('requests.withdraw')}</Button>
            </div>
          )}

          {/* HR's decision */}
          {staff && workable && (
            <div className="border-t border-surface-100 pt-4 space-y-3">
              <h4 className="text-sm font-semibold text-surface-800">{t('requests.hr_decision')}</h4>

              {r.type === 'case' ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Select label={t('requests.f.status')} value={r.status}
                    onChange={(e) => updateCase({ status: e.target.value })}
                    options={CASE_STATUSES.map((s) => ({ value: s, label: t(`requests.status.${slug(s)}`) }))} />
                  <Select label={t('requests.f.assigned_to')} value={r.assigned_to ? String(r.assigned_to) : ''}
                    onChange={(e) => updateCase({ assigned_to: e.target.value || null })}
                    options={assignees.map((u) => ({ value: String(u.id), label: u.name }))} placeholder={t('requests.unassigned')} />
                  <Input type="date" label={t('requests.f.due_date')} value={r.due_date || ''}
                    onChange={(e) => updateCase({ due_date: e.target.value || null })} />
                </div>
              ) : (
                <>
                  {chainPending && (
                    <div className="text-xs rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-3 space-y-2">
                      <p>{t('requests.chain_pending')}</p>
                      {isAdmin && <Input label={t('requests.override_reason')} value={override} onChange={(e) => setOverride(e.target.value)} maxLength={500} />}
                    </div>
                  )}
                  {r.type === 'expense' && (
                    <Input type="month" label={t('requests.f.reimburse_in')} value={decision.period || ''}
                      onChange={(e) => setDecision({ period: e.target.value })} />
                  )}
                  {r.type === 'expense' && (
                    <p className="text-xs text-surface-500 -mt-1">{t('requests.reimburse_hint')}</p>
                  )}
                  {r.type === 'advance' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <Input type="month" label={t('requests.f.start_period')} value={decision.start_period || ''}
                        onChange={(e) => setDecision((p) => ({ ...p, start_period: e.target.value }))} />
                      <Input type="number" step="0.01" min="0" label={t('requests.f.instalment')} value={decision.instalment ?? d.instalment}
                        onChange={(e) => setDecision((p) => ({ ...p, instalment: e.target.value }))} />
                    </div>
                  )}
                  {r.type === 'letter' && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-surface-500 flex-1">{t('requests.letter_hint')}</p>
                      {r.status === 'Pending' && (
                        <Button size="sm" variant="secondary" onClick={() => updateCase({ status: 'In Progress' })} disabled={busy}>{t('requests.start_work')}</Button>
                      )}
                    </div>
                  )}
                </>
              )}

              {open && <div className="flex gap-2 items-center flex-wrap">
                <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500}
                  placeholder={t('requests.reason_ph')}
                  className="flex-1 min-w-[200px] text-sm bg-white border border-surface-200 rounded-lg px-3 py-2" />
                <Button size="sm" variant="secondary" onClick={reject} disabled={busy}><X size={14} /> {t('requests.reject')}</Button>
                {r.type !== 'case' && (
                  <Button size="sm" onClick={approve} loading={busy}
                    disabled={chainPending && !(isAdmin && override.trim().length >= 10)}>
                    <Check size={14} /> {r.type === 'letter' ? t('requests.issue') : t('requests.approve')}
                  </Button>
                )}
              </div>}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function Field({ label, value, wide }) {
  return (
    <div className={wide ? 'sm:col-span-2' : ''}>
      <dt className="text-[11px] uppercase tracking-wider text-surface-400">{label}</dt>
      <dd className="text-surface-800 whitespace-pre-wrap break-words">{value ?? '—'}</dd>
    </div>
  );
}
