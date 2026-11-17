import { Fragment, useEffect, useState } from 'react';
import { Upload, Download, Loader2, Pencil, Check, X, Eye, FileText, FileImage, File as FileIcon } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Badge from '@components/ui/Badge';
import * as employeesApi from '@api/employeesApi';
import { EMPLOYEE_DOC_TYPES, docTypeLabel, expiryBadge } from '@utils/employeeDocs';
import { sendWithWarnings } from '@utils/softWarnings';
import DocumentViewer from './profile/DocumentViewer';
import { previewKind } from './profile/profileUtils';

const CATEGORIES = ['General', 'ID/Passport', 'Certificate', 'Handover Sheet', 'Other'];
const EMPTY_META = { doc_type: '', doc_number: '', issue_date: '', expiry_date: '' };
const COLS = 7;

// The stored category values stay English (other pages filter on them, e.g.
// "Handover Sheet" in offboarding); only the label is translated.
function categoryLabel(t, c) {
  switch (c) {
    case 'General': return t('empDocs.cat_general');
    case 'ID/Passport': return t('empDocs.cat_id_passport');
    case 'Certificate': return t('empDocs.cat_certificate');
    case 'Handover Sheet': return t('empDocs.cat_handover_sheet');
    default: return t('empDocs.cat_other');
  }
}

/**
 * An employee's documents, with the official ones (passport, visa, Emirates ID,
 * labour card…) carrying a type, number and expiry date that feed the
 * Document Radar and its alerts.
 *
 * Every field carries a visible label. The edit form used to sit inline under
 * the table headers, but its four boxes were (type, number, issue, expiry)
 * while the headers above them read (type, number, expiry, uploaded) — so the
 * box under "Expiry date" was really the issue date. People typed the new
 * expiry there and were then warned that the (old) expiry came before the
 * "issue" date. The edit form is now its own labelled panel under the row.
 *
 * `canEdit` mirrors authorize('admin','hr_manager') on upload and update.
 * `onChanged` lets the page refresh its identity cards after an upload or edit.
 */
export default function EmployeeDocumentsTab({ employee, t, canEdit, onChanged }) {
  const [docs, setDocs] = useState([]);
  // Which employee the list belongs to; loading is derived from it, so opening
  // another profile shows the spinner instead of the previous person's files.
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== employee.id;
  const [category, setCategory] = useState('General');
  const [meta, setMeta] = useState(EMPTY_META);
  const [uploading, setUploading] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editMeta, setEditMeta] = useState(EMPTY_META);
  const [saving, setSaving] = useState(false);
  const [viewIndex, setViewIndex] = useState(null);

  const load = async () => {
    const id = employee.id;
    try {
      const { data } = await employeesApi.getEmployeeDocuments(id);
      setDocs(data || []);
    } catch {
      setDocs([]);
      toast.error(t('empDocs.load_failed'));
    } finally {
      setLoadedFor(id);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const id = employee.id;
    employeesApi.getEmployeeDocuments(id)
      .then(({ data }) => { if (!cancelled) { setDocs(data || []); setLoadedFor(id); } })
      .catch(() => {
        if (cancelled) return;
        setDocs([]);
        setLoadedFor(id);
        toast.error(t('empDocs.load_failed'));
      });
    return () => { cancelled = true; };
  }, [employee.id, t]);

  const onUpload = async (e) => {
    const file = e.target.files[0];
    e.target.value = ''; // the same file can be picked again after a failure
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', category);
    for (const [k, v] of Object.entries(meta)) if (v) formData.append(k, v);

    let toastId = toast.loading(t('toasts.t_uploading_document'));
    try {
      // Unusual dates (e.g. expiry before issue) are the uploader's call: they are
      // asked, and the same upload is repeated if they confirm.
      await sendWithWarnings((confirmed) => {
        if (confirmed) formData.set('confirm_warnings', 'true');
        return employeesApi.uploadEmployeeDocument(employee.id, formData);
      }, t, {
        onAsk: () => toast.dismiss(toastId),
        onConfirmed: () => { toastId = toast.loading(t('toasts.t_uploading_document')); },
      });
      toast.update(toastId, { render: t('empDocs.uploaded'), type: 'success', isLoading: false, autoClose: 3000 });
      setMeta(EMPTY_META);
      await load();
      onChanged?.();
    } catch (err) {
      if (err.cancelled) { toast.dismiss(toastId); return; } // the person chose to go back and fix it
      toast.update(toastId, { render: err.response?.data?.error || t('empDocs.upload_failed'), type: 'error', isLoading: false, autoClose: 4000 });
    } finally {
      setUploading(false);
    }
  };

  const download = async (doc) => {
    try {
      const res = await employeesApi.downloadEmployeeDocument(employee.id, doc.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      toast.error(t('toasts.t_failed_to_download_document'));
    }
  };

  const startEdit = (doc) => {
    setEditingId(doc.id);
    setEditMeta({
      doc_type: doc.doc_type || '', doc_number: doc.doc_number || '',
      issue_date: doc.issue_date || '', expiry_date: doc.expiry_date || '',
    });
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await sendWithWarnings(
        (confirmed) => employeesApi.updateEmployeeDocument(employee.id, editingId,
          confirmed ? { ...editMeta, confirm_warnings: true } : editMeta),
        t);
      toast.success(t('empDocs.saved'));
      setEditingId(null);
      await load();
      onChanged?.();
    } catch (err) {
      if (err.cancelled) return; // stay in edit mode so the dates can be corrected
      toast.error(err.response?.data?.error || t('empDocs.save_failed'));
    } finally {
      setSaving(false);
    }
  };

  const input = 'w-full text-xs bg-white border border-surface-200 rounded-lg p-2 focus:ring-brand-500';
  const label = 'block text-[11px] font-semibold text-surface-600 mb-1';
  // Each field is wrapped with its own label, so a date box can never be read as
  // the other one.
  const metaFields = (value, onChange) => (
    <>
      <div>
        <label className={label}>{t('empDocs.doc_type')}</label>
        <select value={value.doc_type} onChange={(e) => onChange({ ...value, doc_type: e.target.value })} className={input}>
          <option value="">{t('empDocs.not_official')}</option>
          {EMPLOYEE_DOC_TYPES.map((type) => <option key={type} value={type}>{docTypeLabel(t, type)}</option>)}
        </select>
      </div>
      <div>
        <label className={label}>{t('empDocs.doc_number')}</label>
        <input value={value.doc_number} onChange={(e) => onChange({ ...value, doc_number: e.target.value })} className={input}
          placeholder={t('empDocs.doc_number')} maxLength={64} />
      </div>
      <div>
        <label className={label}>{t('empDocs.issue_date')}</label>
        <input type="date" value={value.issue_date} onChange={(e) => onChange({ ...value, issue_date: e.target.value })} className={input} />
      </div>
      <div>
        <label className={label}>{t('empDocs.expiry_date')}</label>
        <input type="date" value={value.expiry_date}
          onChange={(e) => onChange({ ...value, expiry_date: e.target.value })} className={`${input} border-brand-200`} />
      </div>
    </>
  );

  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
            <div>
              <label className={label}>{t('empDocs.category')}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className={input}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(t, c)}</option>)}
              </select>
            </div>
            {metaFields(meta, setMeta)}
          </div>
          <p className="text-[11px] text-surface-500">{t('empDocs.expiry_hint')}</p>
          <div className="relative border-2 border-dashed border-surface-300 rounded-lg p-3 text-center bg-white hover:border-brand-500 transition cursor-pointer">
            <input type="file" disabled={uploading} onChange={onUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <span className="text-xs text-surface-500 flex items-center justify-center gap-1.5 font-medium">
              <Upload size={14} className="text-brand-600" />
              {t('empDocs.pick_file')}
            </span>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : docs.length === 0 ? (
        <div className="text-center py-6 text-xs text-surface-400 italic bg-surface-50 rounded-xl border border-surface-100">
          {t('empDocs.none')}
        </div>
      ) : (
        <div className="border border-surface-200 rounded-xl overflow-x-auto text-xs">
          <table className="w-full text-start border-collapse bg-white">
            <thead>
              <tr className="bg-surface-50 border-b border-surface-200 text-surface-700">
                <th className="p-3 font-semibold text-start">{t('empDocs.name')}</th>
                <th className="p-3 font-semibold text-start">{t('empDocs.doc_type')}</th>
                <th className="p-3 font-semibold text-start">{t('empDocs.doc_number')}</th>
                <th className="p-3 font-semibold text-start">{t('empDocs.issue_date')}</th>
                <th className="p-3 font-semibold text-start">{t('empDocs.expiry_date')}</th>
                <th className="p-3 font-semibold text-start">{t('empDocs.uploaded_at')}</th>
                <th className="p-3 font-semibold text-center">{t('empDocs.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {docs.map((doc) => {
                const badge = expiryBadge(t, doc.days_left);
                const editing = editingId === doc.id;
                const kind = previewKind(doc.file_name);
                const KindIcon = kind === 'image' ? FileImage : kind ? FileText : FileIcon;
                const open = () => setViewIndex(docs.indexOf(doc));
                return (
                  <Fragment key={doc.id}>
                    <tr className={editing ? 'bg-brand-50/40' : 'hover:bg-surface-50/50'}>
                      <td className="p-3 max-w-[280px]">
                        <button type="button" onClick={open} className="flex items-start gap-2 text-start group min-w-0 w-full" title={t('empProfile.preview')}>
                          <KindIcon size={16} className={`shrink-0 mt-0.5 ${kind === 'image' ? 'text-emerald-500' : kind === 'pdf' ? 'text-red-500' : 'text-surface-400'}`} />
                          <span className="min-w-0">
                            <span className="block font-medium text-surface-950 truncate group-hover:text-brand-700 group-hover:underline">{doc.file_name}</span>
                            <span className="block text-[10px] text-surface-400 font-normal">{categoryLabel(t, doc.category)}</span>
                          </span>
                        </button>
                      </td>
                      <td className="p-3">{doc.doc_type ? <Badge variant="info" className="text-[10px]">{docTypeLabel(t, doc.doc_type)}</Badge> : <span className="text-surface-300">—</span>}</td>
                      <td className="p-3 font-mono text-surface-700">{doc.doc_number || <span className="text-surface-300">—</span>}</td>
                      <td className="p-3 text-surface-700 whitespace-nowrap">{doc.issue_date || <span className="text-surface-300">—</span>}</td>
                      <td className="p-3">
                        {doc.expiry_date ? (
                          <div className="flex flex-col gap-0.5">
                            <span className="text-surface-700 whitespace-nowrap">{doc.expiry_date}</span>
                            <Badge variant={badge.variant} className="text-[10px] w-fit whitespace-nowrap">{badge.text}</Badge>
                          </div>
                        ) : <span className="text-surface-300">—</span>}
                      </td>
                      <td className="p-3 text-surface-500 whitespace-nowrap">{dayjs(doc.created_at).format('YYYY-MM-DD')}</td>
                      <td className="p-3 text-center whitespace-nowrap">
                        <button type="button" onClick={open} className="p-1 text-brand-600 hover:text-brand-700" aria-label={t('empProfile.preview')} title={t('empProfile.preview')}>
                          <Eye size={14} />
                        </button>
                        <button type="button" onClick={() => download(doc)} className="p-1 text-brand-600 hover:text-brand-700" aria-label={t('empDocs.download')} title={t('empDocs.download')}>
                          <Download size={14} />
                        </button>
                        {canEdit && !editing && (
                          <button type="button" onClick={() => startEdit(doc)} className="p-1 text-surface-400 hover:text-brand-600" aria-label={t('empDocs.edit_details')} title={t('empDocs.edit_details')}>
                            <Pencil size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                    {editing && (
                      <tr className="bg-brand-50/40">
                        <td colSpan={COLS} className="px-3 pb-3">
                          <div className="rounded-lg border border-brand-200 bg-white p-3 space-y-3">
                            <p className="text-[11px] font-semibold text-brand-700">{t('empDocs.edit_details')}</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">{metaFields(editMeta, setEditMeta)}</div>
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => setEditingId(null)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-surface-600 bg-surface-100 hover:bg-surface-200">
                                <X size={13} /> {t('common.cancel')}
                              </button>
                              <button type="button" onClick={saveEdit} disabled={saving}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-white bg-brand-600 hover:bg-brand-700 disabled:opacity-60">
                                {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} {t('common.save')}
                              </button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <DocumentViewer employeeId={employee.id} docs={docs} index={viewIndex}
        onIndexChange={setViewIndex} onClose={() => setViewIndex(null)} t={t} />
    </div>
  );
}
