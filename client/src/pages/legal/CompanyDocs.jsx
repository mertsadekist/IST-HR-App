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
import { FolderOpen, Upload, Download, Trash2, Search, Plus, FileIcon, File, Book, FileText, Shield, LifeBuoy, FormInput, ClipboardList, PenTool } from 'lucide-react';
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

export default function CompanyDocs() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [documents, setDocuments] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  const [uploadModal, setUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadForm, setUploadForm] = useState({ company_id: '', category_id: '', name: '', description: '' });
  const [file, setFile] = useState(null);

  const [catModal, setCatModal] = useState(false);
  const [catName, setCatName] = useState('');

  useEffect(() => { loadAll(); }, [currentCompanyId, catFilter]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (catFilter) params.category = catFilter;
      if (search) params.search = search;
      const [docsRes, catsRes] = await Promise.all([documentsApi.getDocuments(params), documentsApi.getCategories()]);
      setDocuments(docsRes.data);
      setCategories(catsRes.data);
    } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) { toast.error('Please select a file'); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('company_id', uploadForm.company_id || currentCompanyId);
      formData.append('category', uploadForm.category || 'General');
      formData.append('name', uploadForm.name || file.name);
      if (uploadForm.description) formData.append('description', uploadForm.description);
      await documentsApi.uploadDocument(formData);
      toast.success('Document uploaded');
      setUploadModal(false); setFile(null); loadAll();
    } catch { toast.error('Failed to upload'); }
    finally { setUploading(false); }
  };

  const handleDownload = async (doc) => {
    try {
      const { data } = await documentsApi.downloadDocument(doc.id);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a'); a.href = url; a.download = doc.file_name; a.click();
      URL.revokeObjectURL(url);
    } catch { toast.error('Failed to download'); }
  };

  const handleDelete = async (doc) => {
    const r = await confirmDelete(`"${doc.name}"`);
    if (r.isConfirmed) { try { await documentsApi.deleteDocument(doc.id); toast.success(t('common.deleted')); loadAll(); } catch { toast.error(t('common.error')); } }
  };

  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!catName) return;
    try { await documentsApi.createCategory({ name: catName }); toast.success('Category added'); setCatModal(false); setCatName(''); loadAll(); }
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
          <Button onClick={() => { setUploadForm({ company_id: currentCompanyId ? String(currentCompanyId) : '', category: '', name: '' }); setFile(null); setUploadModal(true); }}>
            <Upload size={16} /> {t('docs.upload')}
          </Button>
        </div>
      </div>

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
                  <h3 className="font-semibold text-surface-800 text-sm truncate">{doc.file_name}</h3>
                  <div className="flex items-center gap-2 mt-1.5 text-[10px] text-surface-400">
                    <span>{formatSize(doc.file_size)}</span>
                    {doc.category && <><span>·</span><span>{doc.category}</span></>}
                    <span>·</span>
                    <span>{dayjs(doc.uploaded_at).format('MMM D')}</span>
                  </div>
                  {doc.short_code && <span className="inline-block mt-1.5 px-1.5 py-0.5 rounded text-[9px] font-medium text-white" style={{ backgroundColor: doc.color_primary || '#6D28D9' }}>{doc.short_code}</span>}
                </div>
                <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleDownload(doc)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Download"><Download size={14} /></button>
                  <button onClick={() => handleDelete(doc)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 size={14} /></button>
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
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setUploadModal(false)}>{t('common.cancel', 'Cancel')}</Button>
            <Button type="submit" loading={uploading}>{t('docs.upload', 'Upload')}</Button>
          </div>
        </form>
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
