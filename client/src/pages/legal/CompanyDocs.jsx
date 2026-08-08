import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as documentsApi from '@api/documentsApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { FolderOpen, Upload, Download, Trash2, Search, Plus, FileIcon, File, Book, FileText, Shield, LifeBuoy, FormInput, ClipboardList, PenTool, AlertTriangle, CalendarClock, CalendarOff, Infinity as InfinityIcon, Pencil, BellRing } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const formatSize = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const fileTypeIcon = (type) => {
  if (type?.includes('pdf')) return '📄';
  if (type?.includes('image')) return '🖼️';
  if (type?.includes('spreadsheet') || type?.includes('excel')) return '📊';
  if (type?.includes('word') || type?.includes('document')) return '📝';
  return '📁';
};


// Expiry is a mode, not just a date. Plenty of company documents genuinely have
// no end date, and forcing one produces either a wrong date or a field that
// stays permanently empty. Saying "never expires" is a positive statement that
// stops the document being chased.
const EXPIRY_MODES = ['Not Set', 'No Expiry', 'Has Expiry'];

/** How a document reads on the card: state drives the colour and the wording. */
const expiryState = (doc) => {
  if (doc.expiry_mode === 'No Expiry') return 'no_expiry';
  if (doc.expiry_mode !== 'Has Expiry' || doc.days_to_expiry == null) return 'not_set';
  if (doc.days_to_expiry < 0) return 'expired';
  if (doc.days_to_expiry <= 30) return 'critical';
  if (doc.days_to_expiry <= 90) return 'soon';
  return 'valid';
};

const expiryStyles = {
  expired: 'bg-red-100 text-red-800 border-red-200',
  critical: 'bg-orange-100 text-orange-800 border-orange-200',
  soon: 'bg-amber-100 text-amber-800 border-amber-200',
  valid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  no_expiry: 'bg-surface-100 text-surface-600 border-surface-200',
  not_set: 'bg-surface-50 text-surface-400 border-surface-200 border-dashed',
};

function ExpiryBadge({ doc, t }) {
  const state = expiryState(doc);
  const d = doc.days_to_expiry;
  const label = state === 'no_expiry' ? t('docs.exp_no_expiry')
    : state === 'not_set' ? t('docs.exp_not_set')
    : d < 0 ? t('docs.exp_expired_ago', { days: Math.abs(d) })
      : d === 0 ? t('docs.exp_today')
        : t('docs.exp_days_left', { days: d });
  const Icon = state === 'expired' || state === 'critical' ? AlertTriangle
    : state === 'no_expiry' ? InfinityIcon
      : state === 'not_set' ? CalendarOff : CalendarClock;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${expiryStyles[state]}`}
      title={doc.expiry_date ? `${t('docs.expiry_date')}: ${doc.expiry_date}` : undefined}>
      <Icon size={10} /> {label}
    </span>
  );
}

/** Typing a date a year out by hand is the step people skip — offer the common ones. */
const DATE_PRESETS = [
  { months: 6, key: 'docs.preset_6m' },
  { months: 12, key: 'docs.preset_1y' },
  { months: 24, key: 'docs.preset_2y' },
];

/**
 * The expiry block, shared by upload and edit. Three modes rather than an
 * optional date field: "no expiry" has to be sayable, otherwise a permanent
 * document sits in the "needs attention" pile forever.
 */
function ExpiryFields({ form, set, t }) {
  const modeMeta = {
    'Not Set': { icon: CalendarOff, label: t('docs.mode_not_set'), hint: t('docs.mode_not_set_hint') },
    'No Expiry': { icon: InfinityIcon, label: t('docs.mode_no_expiry'), hint: t('docs.mode_no_expiry_hint') },
    'Has Expiry': { icon: CalendarClock, label: t('docs.mode_has_expiry'), hint: t('docs.mode_has_expiry_hint') },
  };
  return (
    <div className="rounded-xl border border-surface-200 p-3 space-y-3">
      <label className="block text-sm font-medium text-surface-700">{t('docs.validity')}</label>
      <div className="grid grid-cols-3 gap-2">
        {EXPIRY_MODES.map(m => {
          const Icon = modeMeta[m].icon;
          const active = form.expiry_mode === m;
          return (
            <button key={m} type="button" onClick={() => set({ expiry_mode: m })}
              className={`flex flex-col items-center gap-1 py-2 px-1 rounded-lg border text-[11px] font-medium transition-all ${
                active ? 'border-brand-500 bg-brand-50 text-brand-700 ring-1 ring-brand-500' : 'border-surface-200 text-surface-600 hover:border-brand-300'
              }`}>
              <Icon size={16} /> {modeMeta[m].label}
            </button>
          );
        })}
      </div>
      <p className="text-[11px] text-surface-400">{modeMeta[form.expiry_mode]?.hint}</p>

      {form.expiry_mode === 'Has Expiry' && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <Input type="date" label={t('docs.issue_date')} value={form.issue_date || ''} onChange={(e) => set({ issue_date: e.target.value })} />
            <Input type="date" label={t('docs.expiry_date')} required value={form.expiry_date || ''} onChange={(e) => set({ expiry_date: e.target.value })} />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[11px] text-surface-400">{t('docs.quick_set')}</span>
            {DATE_PRESETS.map(p => (
              <button key={p.months} type="button"
                onClick={() => set({ expiry_date: dayjs(form.issue_date || undefined).add(p.months, 'month').format('YYYY-MM-DD') })}
                className="px-2 py-0.5 rounded-lg border border-surface-200 text-[11px] text-surface-600 hover:border-brand-400 hover:text-brand-600">
                {t(p.key)}
              </button>
            ))}
          </div>
          <Input type="number" min={1} max={365} label={t('docs.reminder_days')} placeholder={t('docs.reminder_days_ph')}
            value={form.reminder_days ?? ''} onChange={(e) => set({ reminder_days: e.target.value })} />
          <p className="text-[11px] text-surface-400">{t('docs.reminder_hint')}</p>
        </div>
      )}
    </div>
  );
}

export default function CompanyDocs() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin'; // delete is admin-only
  const canEdit = isAdmin || user?.role === 'hr_manager'; // matches PUT /documents/:id
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({
    company_id: '', category: '', name: '', description: '',
    expiry_mode: 'Not Set', expiry_date: '', issue_date: '', reminder_days: '',
  });
  // The headline the page is actually read for: what has lapsed and what is next.
  const [summary, setSummary] = useState(null);
  const [expiryFilter, setExpiryFilter] = useState('');
  // Editing metadata without re-uploading: a renewed licence keeps its name.
  const [editDoc, setEditDoc] = useState(null);
  const [editForm, setEditForm] = useState({ expiry_mode: 'Not Set', expiry_date: '', issue_date: '', reminder_days: '', category: '' });
  const [savingEdit, setSavingEdit] = useState(false);
  const [file, setFile] = useState(null);

  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName] = useState('');

  useEffect(() => { loadAll(); }, [currentCompanyId, catFilter, expiryFilter]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (catFilter) params.category = catFilter;
      if (expiryFilter === 'expired') params.expired = '1';
      else if (expiryFilter === 'expiring') { params.expiring = '1'; params.within_days = 90; }
      else if (expiryFilter) params.expiry_mode = expiryFilter;
      if (search) params.search = search;
      const scope = currentCompanyId ? { company_id: currentCompanyId } : {};
      const [docsRes, catsRes, sumRes] = await Promise.all([
        documentsApi.getDocuments(params),
        documentsApi.getCategories(),
        documentsApi.getExpirySummary(scope),
      ]);
      setDocuments(docsRes.data);
      setCategories(catsRes.data);
      setSummary(sumRes.data);
    } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };

  const openEdit = (doc) => {
    setEditDoc(doc);
    setEditForm({
      document_name: doc.document_name || '',
      expiry_mode: doc.expiry_mode || 'Not Set',
      expiry_date: doc.expiry_date || '',
      issue_date: doc.issue_date || '',
      reminder_days: doc.reminder_days || '',
      category: doc.category || '',
    });
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (editForm.expiry_mode === 'Has Expiry' && !editForm.expiry_date) { toast.error(t('docs.expiry_date_required')); return; }
    setSavingEdit(true);
    try {
      await documentsApi.updateDocument(editDoc.id, {
        ...editForm,
        reminder_days: editForm.reminder_days || null,
      }, currentCompanyId ? { company_id: currentCompanyId } : {});
      toast.success(t('toasts.t_document_updated'));
      setEditDoc(null); loadAll();
    } catch (err) { toast.error(err?.response?.data?.error || t('common.error')); }
    finally { setSavingEdit(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { toast.error(t('toasts.t_please_select_a_file')); return; }
    if (uploadForm.expiry_mode === 'Has Expiry' && !uploadForm.expiry_date) { toast.error(t('docs.expiry_date_required')); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_id', uploadForm.company_id || currentCompanyId);
      formData.append('category', uploadForm.category || 'General');
      formData.append('name', uploadForm.name || file.name);
      if (uploadForm.description) formData.append('description', uploadForm.description);
      formData.append('expiry_mode', uploadForm.expiry_mode || 'Not Set');
      if (uploadForm.expiry_mode === 'Has Expiry') {
        formData.append('expiry_date', uploadForm.expiry_date);
        if (uploadForm.issue_date) formData.append('issue_date', uploadForm.issue_date);
        if (uploadForm.reminder_days) formData.append('reminder_days', uploadForm.reminder_days);
      }
      await documentsApi.uploadDocument(formData);
      toast.success(t('toasts.t_document_uploaded'));
      setUploadModal(false); setFile(null); loadAll();
    } catch { toast.error(t('toasts.t_failed_to_upload')); }
    finally { setUploading(false); }
  };

  const handleDownload = async (doc) => {
    try {
      const { data } = await documentsApi.downloadDocument(doc.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a'); a.href = url; a.download = doc.file_name; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error(t('toasts.t_failed_to_download')); }
  };

  const handleDelete = async (doc) => {
    const r = await confirmDelete(`"${doc.name}"`);
    if (r.isConfirmed) { try { await documentsApi.deleteDocument(doc.id); toast.success(t('common.deleted')); loadAll(); } catch { toast.error(t('common.error')); } }
  };

  // The scheduler runs every 6 hours; this is for "I just fixed the dates, warn now".
  const handleRunCheck = async () => {
    try {
      const { data } = await documentsApi.runExpiryCheck();
      toast.success(t('toasts.t_expiry_check_done', { count: data.alerts_sent }));
    } catch { toast.error(t('common.error')); }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!catName) return;
    try { await documentsApi.createCategory({ name: catName }); toast.success(t('toasts.t_category_added')); setCatModal(false); setCatName(''); loadAll(); }
    catch { toast.error(t('common.error')); }
  };

  const filtered = documents.filter(d => !search || `${d.file_name}`.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('docs.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('docs.subtitle')}</p></div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setCatModal(true)}><Plus size={14} /> {t('docs.category')}</Button>
          <Button onClick={() => { setUploadForm({ company_id: currentCompanyId ? String(currentCompanyId) : '', category: '', name: '', description: '', expiry_mode: 'Not Set', expiry_date: '', issue_date: '', reminder_days: '' }); setFile(null); setUploadModal(true); }}>
            <Upload size={16} /> {t('docs.upload')}
          </Button>
        </div>
      </div>

      {/* Renewal watch — clicking a tile filters the list to exactly that set. */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { key: 'expired', value: Number(summary.counts?.expired || 0), label: t('docs.sum_expired'), icon: AlertTriangle, tone: 'border-red-200 bg-red-50 text-red-700' },
            { key: 'expiring', value: Number(summary.counts?.within_90 || 0), label: t('docs.sum_expiring'), icon: CalendarClock, tone: 'border-amber-200 bg-amber-50 text-amber-700' },
            { key: 'No Expiry', value: Number(summary.counts?.no_expiry || 0), label: t('docs.sum_no_expiry'), icon: InfinityIcon, tone: 'border-surface-200 bg-white text-surface-600' },
            { key: 'Not Set', value: Number(summary.counts?.not_set || 0), label: t('docs.sum_not_set'), icon: CalendarOff, tone: 'border-surface-200 bg-white text-surface-500' },
          ].map(tile => (
            <button key={tile.key} type="button" onClick={() => setExpiryFilter(expiryFilter === tile.key ? '' : tile.key)}
              className={`flex items-center gap-3 p-3 rounded-xl border text-start transition-all ${tile.tone} ${expiryFilter === tile.key ? 'ring-2 ring-brand-500' : 'hover:shadow-sm'}`}>
              <tile.icon size={18} />
              <div><div className="text-lg font-bold leading-none">{tile.value}</div>
                <div className="text-[11px] mt-1 opacity-80">{tile.label}</div></div>
            </button>
          ))}
        </div>
      )}

      {/* The next few renewals, in date order — the thing worth seeing without clicking. */}
      {summary?.soonest?.length > 0 && (
        <Card className="!p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-surface-800 flex items-center gap-2"><BellRing size={14} className="text-brand-600" /> {t('docs.upcoming_renewals')}</h3>
            {isAdmin && <button type="button" onClick={handleRunCheck} className="text-[11px] text-brand-600 hover:underline">{t('docs.run_check')}</button>}
          </div>
          <div className="divide-y divide-surface-100">
            {summary.soonest.map(s => (
              <div key={s.id} className="flex items-center justify-between py-1.5 text-xs">
                <span className="text-surface-700 truncate">{s.label}{s.category && <span className="text-surface-400"> · {s.category}</span>}</span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-surface-400">{s.expiry_date}</span>
                  <ExpiryBadge doc={{ expiry_mode: 'Has Expiry', ...s }} t={t} />
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Visual Category Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
        {[
          { id: 'Policies', icon: Book, color: 'text-brand-600', bg: 'bg-brand-50' },
          { id: 'Guides', icon: LifeBuoy, color: 'text-blue-600', bg: 'bg-blue-50' },
          { id: 'Onboarding', icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { id: 'Forms', icon: FormInput, color: 'text-orange-600', bg: 'bg-orange-50' },
          { id: 'Legal', icon: Shield, color: 'text-red-600', bg: 'bg-red-50' },
          { id: 'Templates', icon: PenTool, color: 'text-purple-600', bg: 'bg-purple-50' },
          { id: 'General', icon: FolderOpen, color: 'text-surface-600', bg: 'bg-surface-100' },
        ].map(cat => (
          <button key={cat.id} onClick={() => setCatFilter(catFilter === cat.id ? '' : cat.id)}
            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all ${
              catFilter === cat.id ? 'border-brand-500 shadow-sm ring-1 ring-brand-500' : 'border-surface-200 hover:border-brand-300 bg-white shadow-sm'
            }`}>
            <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-2 ${cat.bg} ${cat.color}`}>
              <cat.icon size={20} />
            </div>
            <span className="text-xs font-semibold text-surface-800">{cat.id}</span>
          </button>
        ))}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input type="text" placeholder={t('docs.search')} value={search} onChange={(e) => setSearch(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && loadAll()}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus" />
        </div>
        <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          options={[{ value: '', label: t('docs.all_categories') }, ...categories.map(c => ({ value: c.name, label: c.name }))]} className="!w-44" />
        <Badge variant="brand">{filtered.length} documents</Badge>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{[1,2,3].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-8 bg-surface-200 rounded mb-2" /><div className="h-3 bg-surface-100 rounded w-2/3" /></div>)}</div>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<FolderOpen className="w-6 h-6 text-surface-400" />} title={t('docs.no_documents', 'No documents')} description={t('docs.no_documents_desc', 'Upload company files, policies, and forms')}
          action={<Button onClick={() => setUploadModal(true)}><Upload size={16} /> {t('docs.upload', 'Upload')}</Button>} /></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(doc => (
            <Card key={doc.id} hover className="!p-4 group">
              <div className="flex items-start gap-3">
                <div className="text-2xl">{fileTypeIcon(doc.file_type)}</div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-surface-800 text-sm truncate">{doc.document_name || doc.file_name}</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-surface-400">
                    <span>{formatSize(doc.file_size)}</span>
                    {doc.category && <><span>·</span><span>{doc.category}</span></>}
                    <span>·</span>
                    <span>{dayjs(doc.uploaded_at).format('MMM D')}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-1.5">
                    <ExpiryBadge doc={doc} t={t} />
                    {doc.expiry_mode === 'Has Expiry' && doc.expiry_date && (
                      <span className="text-[10px] text-surface-500">{t('docs.expiry_date')}: {doc.expiry_date}</span>
                    )}
                    {doc.short_code && <span className="px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: doc.color_primary || '#6D28D9' }}>{doc.short_code}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDownload(doc)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Download"><Download size={14} /></button>
                  {canEdit && <button onClick={() => openEdit(doc)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title={t('docs.edit_expiry')}><Pencil size={14} /></button>}
                  {isAdmin && <button onClick={() => handleDelete(doc)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      <Modal open={uploadModal} onClose={() => setUploadModal(false)} title={t('docs.upload_document', 'Upload Document')} size="md">
        <form onSubmit={handleUpload} className="space-y-4">
          <div className="border-2 border-dashed border-surface-200 rounded-xl p-6 text-center hover:border-brand-300 transition-colors">
            <input type="file" id="doc-file" className="hidden" onChange={(e) => setFile(e.target.files[0])} />
            <label htmlFor="doc-file" className="cursor-pointer">
              {file ? (<><File size={24} className="mx-auto text-brand-500 mb-2" /><p className="text-sm font-medium text-surface-800">{file.name}</p><p className="text-xs text-surface-400">{formatSize(file.size)}</p></>) : (
                <><Upload size={24} className="mx-auto text-surface-300 mb-2" /><p className="text-sm text-surface-500">{t('docs.click_select', 'Click to select file')}</p><p className="text-xs text-surface-400">{t('docs.max_size', 'Max 25MB')}</p></>
              )}
            </label>
          </div>
          <Input label={t('docs.doc_name', 'Document Name')} placeholder={t('docs.leave_blank', 'Leave blank to use filename')} value={uploadForm.name} onChange={(e) => setUploadForm(p => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('common.company', 'Company')} value={uploadForm.company_id} onChange={(e) => setUploadForm(p => ({ ...p, company_id: e.target.value }))}
              options={companies.map(c => ({ value: String(c.id), label: c.name }))} placeholder={t('common.select', 'Select...')} />
            <Select label={t('docs.category', 'Category')} value={uploadForm.category} onChange={(e) => setUploadForm(p => ({ ...p, category: e.target.value }))}
              options={categories.map(c => ({ value: c.name, label: c.name }))} placeholder={t('common.select', 'Select...')} />
          </div>
          <div><label className="block text-sm font-medium text-surface-700 mb-1.5">{t('common.description', 'Description')}</label>
            <textarea placeholder={t('docs.optional_desc', 'Optional description...')} value={uploadForm.description} onChange={(e) => setUploadForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" /></div>
          <ExpiryFields form={uploadForm} set={(patch) => setUploadForm(p => ({ ...p, ...patch }))} t={t} />
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUploadModal(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button type="submit" loading={uploading}>{t('docs.upload', 'Upload')}</Button>
          </div>
        </form>
      </Modal>

      {/* Edit metadata — a renewed licence gets a new date, not a new upload */}
      <Modal open={!!editDoc} onClose={() => setEditDoc(null)} title={t('docs.edit_document')} size="md">
        {editDoc && (
          <form onSubmit={handleSaveEdit} className="space-y-4">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-50 border border-surface-100">
              <div className="text-2xl">{fileTypeIcon(editDoc.file_type)}</div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-surface-800 truncate">{editDoc.document_name || editDoc.file_name}</p>
                <p className="text-[11px] text-surface-400">{formatSize(editDoc.file_size)} · {dayjs(editDoc.uploaded_at).format('MMM D, YYYY')}</p>
              </div>
            </div>
            <Input label={t('docs.doc_name', 'Document Name')} placeholder={editDoc.file_name} value={editForm.document_name}
              onChange={(e) => setEditForm(p => ({ ...p, document_name: e.target.value }))} />
            <Select label={t('docs.category', 'Category')} value={editForm.category} onChange={(e) => setEditForm(p => ({ ...p, category: e.target.value }))}
              options={categories.map(c => ({ value: c.name, label: c.name }))} placeholder={t('common.select', 'Select...')} />
            <ExpiryFields form={editForm} set={(patch) => setEditForm(p => ({ ...p, ...patch }))} t={t} />
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" onClick={() => setEditDoc(null)}>{t('common.cancel', 'Cancel')}</Button>
              <Button type="submit" loading={savingEdit}>{t('common.save', 'Save')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {/* Category Modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={t('docs.add_category', 'Add Category')} size="sm">
        <form onSubmit={handleAddCategory} className="space-y-4">
          <Input label={t('docs.cat_name', 'Category Name')} required placeholder={t('docs.cat_eg', 'e.g. Policies, Contracts...')} value={catName} onChange={(e) => setCatName(e.target.value)} />
          <div className="flex justify-end gap-3"><Button type="button" variant="secondary" onClick={() => setCatModal(false)}>{t('common.cancel', 'Cancel')}</Button><Button type="submit">{t('common.add', 'Add')}</Button></div>
        </form>
      </Modal>
    </div>
  );
}
