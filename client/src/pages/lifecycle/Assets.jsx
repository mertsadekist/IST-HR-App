import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import * as assetsApi from '@api/assetsApi';
import * as employeesApi from '@api/employeesApi';
import * as settingsApi from '@api/settingsApi';
import * as inventoryApi from '@api/inventoryApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, Edit3, Trash2, Laptop, RotateCcw, Search, Monitor, Globe, Wrench, Printer, Upload, CheckCircle2, FileCheck, Package, Eye, EyeOff, Link2, Key, Copy, Send } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import HandoverReceipt from './components/HandoverReceipt';
import EmailButton from '@components/email/EmailButton';
import SendDocumentModal from '@components/email/SendDocumentModal';
import { getCompany, getLetterheadBytes } from '@api/companiesApi';
import { companyLetterhead } from '@utils/letterhead';
import { composeWithLetterhead, elementToPdfBlob, downloadBlob } from '@utils/pdf';

const typeIcons = { Hardware: Monitor, Account: Globe, Software: Wrench };
const statusColors = { Active: 'active', Returned: 'success', Deactivated: 'warning', Missing: 'danger' };

export default function Assets() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [inventoryItems, setInventoryItems] = useState([]);
  const [form, setForm] = useState({
    employee_id: '', company_id: '', platform_id: '', name: '', asset_type: 'Hardware',
    workspace: '', access_level: '', identifier: '', issued_date: '', notes: '',
    inventory_id: '', account_username: '', account_password: '', account_url: '',
  });

  const [returnModal, setReturnModal] = useState(null);
  const [returnCondition, setReturnCondition] = useState('');

  // Print & Upload Receipt
  const [receiptAsset, setReceiptAsset] = useState(null);
  const [receiptLh, setReceiptLh] = useState(null); // resolved company letterhead config
  const [sendReceiptOpen, setSendReceiptOpen] = useState(false);
  const [uploadReceiptAsset, setUploadReceiptAsset] = useState(null);
  const [uploading, setUploading] = useState(false);
  const receiptRef = useRef(null);
  const uploadInputRef = useRef(null);

  // Password reveal
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [revealingId, setRevealingId] = useState(null);

  useEffect(() => { loadAssets(); }, [currentCompanyId, statusFilter]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (statusFilter) params.status = statusFilter;
      const { data } = await assetsApi.getAssets(params);
      setAssets(data);
    } catch { toast.error('Failed to load assets'); }
    finally { setLoading(false); }
  };

  const loadFormData = async () => {
    try {
      const params = currentCompanyId ? { company_id: currentCompanyId, limit: 200 } : { limit: 200 };
      const invParams = { status: 'Available' };
      if (currentCompanyId) invParams.company_id = currentCompanyId;

      const [empRes, platRes, invRes] = await Promise.all([
        employeesApi.getEmployees(params),
        settingsApi.getPlatformCatalog(),
        inventoryApi.getInventory({ ...invParams, limit: 500 }),
      ]);
      setEmployees(empRes.data.data || []);
      setPlatforms(platRes.data);
      setInventoryItems(invRes.data.data || []);
    } catch { /* ignore */ }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      employee_id: '', company_id: currentCompanyId ? String(currentCompanyId) : '',
      platform_id: '', name: '', asset_type: 'Hardware', workspace: '', access_level: '',
      identifier: '', issued_date: dayjs().format('YYYY-MM-DD'), notes: '',
      inventory_id: '', account_username: '', account_password: '', account_url: '',
    });
    loadFormData();
    setModalOpen(true);
  };

  const openEdit = (a) => {
    setEditing(a);
    setForm({
      employee_id: String(a.employee_id), company_id: String(a.company_id),
      platform_id: a.platform_id ? String(a.platform_id) : '', name: a.name,
      asset_type: a.asset_type || 'Hardware', workspace: a.workspace || '',
      access_level: a.access_level || '', identifier: a.identifier || '',
      issued_date: a.issued_date ? dayjs(a.issued_date).format('YYYY-MM-DD') : '',
      notes: a.notes || '', inventory_id: a.inventory_id ? String(a.inventory_id) : '',
      account_username: a.account_username || '', account_password: '',
      account_url: a.account_url || '',
    });
    loadFormData();
    setModalOpen(true);
  };

  // When an inventory item is selected, auto-fill the form fields
  const handleInventorySelect = (inventoryId) => {
    update('inventory_id', inventoryId);
    if (inventoryId) {
      const item = inventoryItems.find(i => String(i.id) === String(inventoryId));
      if (item) {
        setForm(prev => ({
          ...prev,
          inventory_id: String(inventoryId),
          name: `${item.brand || ''} ${item.model || ''}`.trim() || item.asset_code,
          identifier: item.serial_number || item.asset_code || '',
          workspace: item.location || prev.workspace,
          platform_id: item.platform_id ? String(item.platform_id) : prev.platform_id,
          company_id: item.company_id ? String(item.company_id) : prev.company_id,
        }));
      }
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name || !form.employee_id) { toast.error('Name and employee are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        employee_id: parseInt(form.employee_id),
        company_id: parseInt(form.company_id),
        platform_id: form.platform_id ? parseInt(form.platform_id) : null,
        inventory_id: form.inventory_id ? parseInt(form.inventory_id) : null,
        issued_date: form.issued_date || null,
      };
      // Don't send empty password fields
      if (!payload.account_password) delete payload.account_password;
      if (!payload.account_username) delete payload.account_username;
      if (!payload.account_url) delete payload.account_url;

      if (editing) { await assetsApi.updateAsset(editing.id, payload); toast.success('Asset updated'); }
      else { await assetsApi.createAsset(payload); toast.success('Asset assigned successfully!'); }
      setModalOpen(false); loadAssets();
    } catch { toast.error('Failed'); } finally { setSaving(false); }
  };

  const handleReturn = async () => {
    try {
      await assetsApi.returnAsset(returnModal.id, { condition_note: returnCondition });
      toast.success('Asset returned');
      setReturnModal(null); loadAssets();
    } catch { toast.error('Failed'); }
  };

  const handleDelete = async (a) => {
    const result = await confirmDelete(`"${a.name}"`);
    if (result.isConfirmed) { try { await assetsApi.deleteAsset(a.id); toast.success('Deleted'); loadAssets(); } catch { toast.error('Failed'); } }
  };

  // Reveal password
  const handleRevealPassword = async (assetId) => {
    if (revealedPasswords[assetId]) {
      setRevealedPasswords(prev => { const n = { ...prev }; delete n[assetId]; return n; });
      return;
    }
    setRevealingId(assetId);
    try {
      const { data } = await assetsApi.revealPassword(assetId);
      setRevealedPasswords(prev => ({ ...prev, [assetId]: data.password }));
      // Auto-hide after 15 seconds
      setTimeout(() => {
        setRevealedPasswords(prev => { const n = { ...prev }; delete n[assetId]; return n; });
      }, 15000);
    } catch { toast.error('Failed to reveal password'); }
    finally { setRevealingId(null); }
  };

  // Resolve a company's letterhead config (fresh from the server).
  const resolveLh = async (companyId) => {
    if (!companyId) return null;
    try { const { data } = await getCompany(companyId); return companyLetterhead(data); }
    catch { return null; }
  };

  // Print handover receipt as a PDF — composed onto the company letterhead when set.
  const handlePrint = async (asset) => {
    const win = window.open('', '_blank'); // sync open to keep the user gesture
    const lh = await resolveLh(asset.company_id);
    setReceiptAsset(asset);
    setReceiptLh(lh);
    // Let the hidden receipt re-render (bare when on a letterhead) before capture.
    await new Promise((r) => setTimeout(r, 200));
    try {
      const el = receiptRef.current;
      if (!el) throw new Error('Receipt not ready');
      let blob;
      if (lh) {
        const res = await getLetterheadBytes(lh.companyId);
        blob = await composeWithLetterhead({ letterheadBytes: res.data, letterheadType: lh.type, element: el, marginsMm: lh.margins });
      } else {
        blob = await elementToPdfBlob(el);
      }
      const url = URL.createObjectURL(blob);
      if (win) win.location.href = url; else downloadBlob(blob, `handover-receipt-${asset.name || asset.id}.pdf`);
    } catch (err) {
      if (win) win.close();
      toast.error(err.message || 'Print failed');
    }
  };

  // Upload signed receipt
  const handleUploadReceipt = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !uploadReceiptAsset) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('receipt', file);
      await assetsApi.uploadReceipt(uploadReceiptAsset.id, fd);
      toast.success('Signed receipt uploaded successfully!');
      setUploadReceiptAsset(null);
      loadAssets();
    } catch {
      toast.error('Failed to upload receipt');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const filtered = assets.filter(a => !search || `${a.first_name} ${a.last_name} ${a.name} ${a.identifier || ''}`.toLowerCase().includes(search.toLowerCase()));
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));
  const currentCompany = companies.find(c => String(c.id) === String(currentCompanyId));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('lifecycle.assets_title')}</h1><p className="text-surface-500 mt-0.5 text-sm">{t('lifecycle.assets_subtitle')}</p></div>
        <Button onClick={openAdd}><Plus size={16} /> {t('lifecycle.assign_asset')}</Button>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input type="text" placeholder={t('lifecycle.search_assets')} value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus" />
        </div>
        <div className="flex gap-1">
          {['', 'Active', 'Returned', 'Deactivated', 'Missing'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{s ? t(`lifecycle.${s.toLowerCase()}`) : t('lifecycle.all')}</button>
          ))}
        </div>
        <Badge variant="brand">{filtered.length} {t('lifecycle.assets', 'assets')}</Badge>
      </div>

      {loading ? (
        <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/2 mb-4" /><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<Laptop className="w-6 h-6 text-surface-400" />} title={t('lifecycle.no_assets')} description={t('lifecycle.no_assets_desc')} action={<Button onClick={openAdd}><Plus size={16} /> {t('lifecycle.assign_asset')}</Button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-surface-100 bg-surface-50/60">
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.asset')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.employee')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.type')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.identifier')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.credentials', 'Credentials')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.status')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">{t('lifecycle.issued')}</th>
                <th className="text-left px-5 py-3 font-medium text-surface-500">Receipt</th>
                <th className="text-right px-5 py-3 font-medium text-surface-500">{t('lifecycle.actions')}</th>
              </tr></thead>
              <tbody>
                {filtered.map(a => {
                  const Icon = typeIcons[a.asset_type] || Laptop;
                  const hasReceipt = !!a.handover_receipt_file;
                  const hasCredentials = !!a.account_username;
                  const isRevealed = !!revealedPasswords[a.id];
                  return (
                    <tr key={a.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Icon size={14} className="text-brand-500" />
                          <div>
                            <span className="font-medium text-surface-800">{a.name}</span>
                            {a.inventory_id && (
                              <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                                <Package size={9} /> Linked
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-surface-600">{a.first_name} {a.last_name}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          a.asset_type === 'Account' ? 'bg-blue-50 text-blue-600' :
                          a.asset_type === 'Hardware' ? 'bg-purple-50 text-purple-600' :
                          'bg-orange-50 text-orange-600'
                        }`}>
                          {a.asset_type === 'Account' ? t('lifecycle.account') : a.asset_type === 'Hardware' ? t('lifecycle.hardware') : t('lifecycle.software')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-surface-500 text-xs font-mono">{a.identifier || '—'}</td>
                      <td className="px-5 py-3">
                        {hasCredentials ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-surface-600 max-w-[100px] truncate" title={a.account_username}>
                              <Key size={10} className="inline mr-1 text-amber-500" />{a.account_username}
                            </span>
                            {a.encrypted_password && (
                              <button
                                onClick={() => handleRevealPassword(a.id)}
                                disabled={revealingId === a.id}
                                className={`p-1 rounded transition-colors ${isRevealed ? 'text-amber-600 bg-amber-50' : 'text-surface-400 hover:text-brand-600 hover:bg-brand-50'}`}
                                title={isRevealed ? 'Hide password' : 'Reveal password'}
                              >
                                {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                              </button>
                            )}
                            {isRevealed && (
                              <span className="text-xs font-mono bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded border border-amber-200">
                                {revealedPasswords[a.id]}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-surface-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3"><Badge variant={statusColors[a.status] || 'info'} className="text-[10px]">{a.status ? t(`lifecycle.${a.status.toLowerCase()}`) : a.status}</Badge></td>
                      <td className="px-5 py-3 text-surface-400 text-xs">{a.issued_date ? dayjs(a.issued_date).format('MMM D, YYYY') : '—'}</td>
                      <td className="px-5 py-3">
                        {hasReceipt ? (
                          <span className="inline-flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                            <FileCheck size={12} /> Signed
                          </span>
                        ) : (
                          <span className="text-xs text-amber-500">Pending</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <EmailButton
                            variant="icon"
                            to={a.email || ''}
                            toName={`${a.first_name} ${a.last_name}`}
                            templateType="asset_assigned"
                            templateData={{ name: `${a.first_name} ${a.last_name}`, asset_name: a.name, asset_type: a.asset_type, serial: a.identifier, company: a.company_name }}
                            relatedModule="Assets"
                            relatedId={a.id}
                            companyId={a.company_id}
                          />
                          <button onClick={() => handlePrint(a)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Print Handover Receipt">
                            <Printer size={14} />
                          </button>
                          <button onClick={async () => { setReceiptAsset(a); setReceiptLh(await resolveLh(a.company_id)); setSendReceiptOpen(true); }} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title={t('send_doc.send_pdf', 'Send receipt by email (PDF)')}>
                            <Send size={14} />
                          </button>
                          <button onClick={() => { setUploadReceiptAsset(a); setTimeout(() => uploadInputRef.current?.click(), 100); }} className="p-1.5 text-surface-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Upload Signed Receipt">
                            <Upload size={14} />
                          </button>
                          {a.status === 'Active' && <button onClick={() => { setReturnModal(a); setReturnCondition(''); }} className="p-1.5 text-surface-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" title="Return"><RotateCcw size={14} /></button>}
                          <button onClick={() => openEdit(a)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"><Edit3 size={14} /></button>
                          <button onClick={() => handleDelete(a)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Hidden file input for uploading signed receipt */}
      <input
        type="file"
        ref={uploadInputRef}
        className="hidden"
        accept=".pdf,.png,.jpg,.jpeg"
        onChange={handleUploadReceipt}
      />

      {/* Hidden receipt render area for printing / PDF */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }}>
        {receiptAsset && (
          <HandoverReceipt ref={receiptRef} asset={receiptAsset} company={currentCompany} onLetterhead={!!receiptLh} />
        )}
      </div>

      {/* Send handover receipt by email (PDF) */}
      <SendDocumentModal
        open={sendReceiptOpen}
        onClose={() => setSendReceiptOpen(false)}
        title={receiptAsset ? `Asset Handover Receipt — ${receiptAsset.first_name} ${receiptAsset.last_name}` : 'Asset Handover Receipt'}
        getElement={() => receiptRef.current}
        defaultTo={receiptAsset?.email || ''}
        defaultToName={receiptAsset ? `${receiptAsset.first_name} ${receiptAsset.last_name}` : ''}
        relatedModule="Assets"
        relatedId={receiptAsset?.id || ''}
        companyId={receiptAsset?.company_id || ''}
        letterhead={receiptLh}
      />

      {/* Assign/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('lifecycle.edit_asset') : t('lifecycle.assign_asset')} size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Row 1: Employee & Company */}
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('lifecycle.employee')} required value={form.employee_id} onChange={(e) => update('employee_id', e.target.value)}
              options={employees.map(em => ({ value: String(em.id), label: `${em.first_name} ${em.last_name}` }))} placeholder={t('lifecycle.select_employee')} />
            <Select label={t('lifecycle.company')} required value={form.company_id} onChange={(e) => update('company_id', e.target.value)}
              options={companies.map(c => ({ value: String(c.id), label: c.name }))} placeholder={t('lifecycle.select_employee')} />
          </div>

          {/* Row 2: Type Selection */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-2">{t('lifecycle.type')}</label>
            <div className="flex gap-2">
              {[
                { value: 'Hardware', icon: Monitor, label: t('lifecycle.hardware'), color: 'purple', desc: t('lifecycle.hardware_desc', 'Laptops, Monitors, Phones...') },
                { value: 'Account', icon: Globe, label: t('lifecycle.account'), color: 'blue', desc: t('lifecycle.account_desc', 'Email, Software, VPN...') },
                { value: 'Software', icon: Wrench, label: t('lifecycle.software'), color: 'orange', desc: t('lifecycle.software_desc', 'Licenses, Tools...') },
              ].map(tp => {
                const TypeIcon = tp.icon;
                const isSelected = form.asset_type === tp.value;
                return (
                  <button key={tp.value} type="button"
                    onClick={() => update('asset_type', tp.value)}
                    className={`flex-1 p-3 rounded-xl border-2 transition-all text-left ${
                      isSelected
                        ? `border-${tp.color}-500 bg-${tp.color}-50 shadow-sm`
                        : 'border-surface-200 bg-white hover:border-surface-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <TypeIcon size={18} className={isSelected ? `text-${tp.color}-600` : 'text-surface-400'} />
                      <div>
                        <div className={`text-sm font-semibold ${isSelected ? `text-${tp.color}-700` : 'text-surface-700'}`}>{tp.label}</div>
                        <div className="text-[10px] text-surface-400 mt-0.5">{tp.desc}</div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hardware: Select from Inventory */}
          {form.asset_type === 'Hardware' && (
            <div className="p-4 bg-purple-50/50 border border-purple-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Package size={16} className="text-purple-600" />
                <span className="text-sm font-semibold text-purple-800">{t('lifecycle.select_from_inventory', 'Select from Inventory')}</span>
                <span className="text-[10px] text-purple-500 bg-purple-100 px-2 py-0.5 rounded-full">{t('lifecycle.optional', 'Optional')}</span>
              </div>
              <Select
                label=""
                value={form.inventory_id}
                onChange={(e) => handleInventorySelect(e.target.value)}
                options={inventoryItems.map(item => ({
                  value: String(item.id),
                  label: `${item.asset_code} — ${item.brand || ''} ${item.model || ''} ${item.serial_number ? `(S/N: ${item.serial_number})` : ''}`.trim(),
                }))}
                placeholder={t('lifecycle.select_inventory_item', '📦 Select an available inventory item...')}
              />
              {form.inventory_id && (
                <div className="flex items-center gap-2 text-xs text-emerald-600">
                  <Link2 size={12} />
                  <span>{t('lifecycle.inventory_linked', 'Linked to inventory item — fields auto-filled below')}</span>
                </div>
              )}
              <div className="grid grid-cols-3 gap-4">
                <Input label={t('lifecycle.asset_name')} required placeholder="e.g. Dell Latitude 5550" value={form.name} onChange={(e) => update('name', e.target.value)} />
                <Input label={t('lifecycle.identifier')} placeholder="Serial / Asset Code" value={form.identifier} onChange={(e) => update('identifier', e.target.value)} />
                <Select label={t('lifecycle.platform_optional')} value={form.platform_id} onChange={(e) => update('platform_id', e.target.value)}
                  options={platforms.map(p => ({ value: String(p.id), label: p.name }))} placeholder={t('lifecycle.select_platform', 'Select platform...')} />
              </div>
            </div>
          )}

          {/* Account: Credential Fields */}
          {form.asset_type === 'Account' && (
            <div className="p-4 bg-blue-50/50 border border-blue-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Key size={16} className="text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">{t('lifecycle.account_credentials', 'Account Credentials')}</span>
                <span className="text-[10px] text-blue-500 bg-blue-100 px-2 py-0.5 rounded-full">{t('lifecycle.encrypted', '🔒 Encrypted')}</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Input label={t('lifecycle.asset_name')} required placeholder="e.g. Company Email, Slack, Jira" value={form.name} onChange={(e) => update('name', e.target.value)} />
                <Select label={t('lifecycle.platform_optional')} value={form.platform_id} onChange={(e) => update('platform_id', e.target.value)}
                  options={platforms.map(p => ({ value: String(p.id), label: p.name }))} placeholder={t('lifecycle.select_platform', 'Select platform...')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label={t('lifecycle.username', 'Username / Email')} placeholder="user@company.com" value={form.account_username} onChange={(e) => update('account_username', e.target.value)} />
                <Input label={t('lifecycle.password', 'Password')} type="password" autoComplete="off" placeholder={editing ? '(unchanged)' : 'Enter password...'} value={form.account_password} onChange={(e) => update('account_password', e.target.value)} />
                <Input label={t('lifecycle.url', 'URL / Link')} placeholder="https://..." value={form.account_url} onChange={(e) => update('account_url', e.target.value)} />
              </div>
              <Input label={t('lifecycle.identifier')} placeholder="License key or account ID" value={form.identifier} onChange={(e) => update('identifier', e.target.value)} />
            </div>
          )}

          {/* Software type */}
          {form.asset_type === 'Software' && (
            <div className="p-4 bg-orange-50/50 border border-orange-200 rounded-xl space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <Wrench size={16} className="text-orange-600" />
                <span className="text-sm font-semibold text-orange-800">{t('lifecycle.software_details', 'Software Details')}</span>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label={t('lifecycle.asset_name')} required placeholder="e.g. Adobe Creative Suite" value={form.name} onChange={(e) => update('name', e.target.value)} />
                <Input label={t('lifecycle.identifier')} placeholder="License Key" value={form.identifier} onChange={(e) => update('identifier', e.target.value)} />
                <Select label={t('lifecycle.platform_optional')} value={form.platform_id} onChange={(e) => update('platform_id', e.target.value)}
                  options={platforms.map(p => ({ value: String(p.id), label: p.name }))} placeholder={t('lifecycle.select_platform', 'Select platform...')} />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <Input label={t('lifecycle.username', 'Username / Email')} placeholder="user@company.com" value={form.account_username} onChange={(e) => update('account_username', e.target.value)} />
                <Input label={t('lifecycle.password', 'Password')} type="password" autoComplete="off" placeholder={editing ? '(unchanged)' : 'Password...'} value={form.account_password} onChange={(e) => update('account_password', e.target.value)} />
                <Input label={t('lifecycle.url', 'URL / Link')} placeholder="https://..." value={form.account_url} onChange={(e) => update('account_url', e.target.value)} />
              </div>
            </div>
          )}

          {/* Common fields */}
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('lifecycle.workspace')} placeholder={t('lifecycle.workspace_placeholder', 'e.g. Floor 3, Desk 12')} value={form.workspace} onChange={(e) => update('workspace', e.target.value)} />
            <Select label={t('lifecycle.access_level', 'Access Level')} value={form.access_level} onChange={(e) => update('access_level', e.target.value)}
              options={[
                { value: 'Standard', label: 'Standard' },
                { value: 'Admin', label: 'Admin' },
                { value: 'Read-Only', label: 'Read-Only' },
                { value: 'Full Access', label: 'Full Access' },
              ]} placeholder={t('lifecycle.select_level', 'Select level...')} />
            <Input label={t('lifecycle.issued_date')} type="date" value={form.issued_date} onChange={(e) => update('issued_date', e.target.value)} />
          </div>
          <div><label className="block text-sm font-medium text-surface-700 mb-1.5">{t('lifecycle.notes')}</label>
            <textarea placeholder={t('lifecycle.notes_placeholder', 'Notes...')} value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2} className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" /></div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('lifecycle.assign')}</Button>
          </div>
        </form>
      </Modal>

      {/* Return Modal */}
      <Modal open={!!returnModal} onClose={() => setReturnModal(null)} title={`${t('lifecycle.return_asset')}: ${returnModal?.name}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-surface-500">{t('lifecycle.return_asset_desc', { first_name: returnModal?.first_name || '', last_name: returnModal?.last_name || '' })}</p>
          {returnModal?.inventory_id && (
            <div className="flex items-center gap-2 text-xs text-emerald-600 bg-emerald-50 px-3 py-2 rounded-lg">
              <Package size={14} />
              <span>{t('lifecycle.inventory_will_release', 'The linked inventory item will be released back to "Available" status')}</span>
            </div>
          )}
          <Input label={t('lifecycle.condition_notes')} placeholder={t('lifecycle.condition_placeholder', 'e.g. Good condition, minor scratches')} value={returnCondition} onChange={(e) => setReturnCondition(e.target.value)} />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setReturnModal(null)}>{t('common.cancel')}</Button>
            <Button onClick={handleReturn}>{t('lifecycle.confirm_return')}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
