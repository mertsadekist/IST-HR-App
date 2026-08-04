import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import * as inventoryApi from '@api/inventoryApi';
import * as settingsApi from '@api/settingsApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import {
  Package, Search, Plus, Edit3, Trash2, QrCode, Printer,
  BarChart3, Tag, ChevronLeft, ChevronRight, Eye, History,
  DollarSign, MapPin, Shield, Wrench, CheckSquare, Square,
  X, Copy, Calendar, Clock, AlertTriangle, CheckCircle2,
  Monitor, Info, ExternalLink, ClipboardCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

// Full physical-asset lifecycle from the assets PRD. Reserved and Returned
// Pending Inspection are the two states that make business rule 1 possible:
// a returned item does not re-enter available stock until it is inspected.
const STATUSES = ['All', 'Available', 'Reserved', 'Assigned', 'Returned Pending Inspection',
  'In Repair', 'Damaged', 'Retired', 'Lost', 'Disposed'];
const CONDITIONS = ['New', 'Good', 'Fair', 'Poor', 'Damaged'];
const PAGE_SIZE = 15;

const statusConfig = {
  Available:  { color: 'active',  icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-600' },
  Reserved:   { color: 'info',    icon: Clock,        gradient: 'from-sky-500 to-sky-600' },
  Assigned:   { color: 'info',    icon: Monitor,      gradient: 'from-blue-500 to-blue-600' },
  'Returned Pending Inspection': { color: 'warning', icon: ClipboardCheck, gradient: 'from-orange-500 to-orange-600' },
  'In Repair':{ color: 'warning', icon: Wrench,       gradient: 'from-amber-500 to-amber-600' },
  Damaged:    { color: 'danger',  icon: AlertTriangle,gradient: 'from-rose-500 to-rose-600' },
  Retired:    { color: 'inactive',icon: X,            gradient: 'from-gray-400 to-gray-500' },
  Lost:       { color: 'danger',  icon: AlertTriangle,gradient: 'from-red-500 to-red-600' },
  Disposed:   { color: 'inactive',icon: X,            gradient: 'from-gray-400 to-gray-500' },
};

const conditionColors = {
  New: 'active', Good: 'success', Fair: 'warning', Poor: 'danger', Damaged: 'danger',
};

export default function Inventory() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin'; // delete is admin-only

  // Data state
  const [items, setItems] = useState([]);
  const [stats, setStats] = useState({ total: 0, available: 0, assigned: 0, inRepair: 0, totalValue: 0 });
  const [loading, setLoading] = useState(true);
  const [platforms, setPlatforms] = useState([]);

  // Filters & pagination
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  // Owning company per the assets PRD: RE / MKT / GRP (GRP = shared).
  const [ownerFilter, setOwnerFilter] = useState('');
  const [platformFilter, setPlatformFilter] = useState('');
  const [page, setPage] = useState(1);

  // Selection
  const [selected, setSelected] = useState(new Set());

  // Modals
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [detailTab, setDetailTab] = useState('details');
  const [barcodeData, setBarcodeData] = useState(null);
  const [qrcodeData, setQrcodeData] = useState(null);
  const [historyData, setHistoryData] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  // Inspection of a returned unit + the PRD availability view
  const [inspectModal, setInspectModal] = useState(null);
  const [inspectNote, setInspectNote] = useState('');
  const [inspectOutcome, setInspectOutcome] = useState('In Repair');
  const [inspecting, setInspecting] = useState(false);
  const [showAvailability, setShowAvailability] = useState(false);
  const [availability, setAvailability] = useState(null);
  const [availLoading, setAvailLoading] = useState(false);

  // Form
  const [form, setForm] = useState({
    company_id: '', platform_id: '', asset_code: '', serial_number: '',
    brand: '', model: '', specifications: '', purchase_date: '',
    purchase_cost: '', warranty_expiry: '', depreciation_rate: '',
    location: '', condition_status: 'New', status: 'Available', notes: '',
  });

  // Load items & stats
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (statusFilter && statusFilter !== 'All') params.status = statusFilter;
      if (platformFilter) params.platform_id = platformFilter;
      if (ownerFilter) params.owner_scope = ownerFilter;
      if (search) params.search = search;
      params.page = page;
      params.limit = PAGE_SIZE;

      const [itemsRes, statsRes] = await Promise.all([
        inventoryApi.getInventory(params),
        inventoryApi.getInventoryStats({ company_id: currentCompanyId || undefined }),
      ]);

      const data = itemsRes.data;
      setItems(Array.isArray(data) ? data : data.data || []);
      setStats(statsRes.data || { total: 0, available: 0, assigned: 0, inRepair: 0, totalValue: 0 });
    } catch {
      toast.error(t('inventory.load_error', 'Failed to load inventory'));
    } finally {
      setLoading(false);
    }
  }, [currentCompanyId, statusFilter, platformFilter, ownerFilter, search, page, t]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    settingsApi.getPlatformCatalog().then(res => setPlatforms(res.data || [])).catch(() => {});
  }, []);

  // Filtered items (client-side search fallback)
  const filtered = items.filter(item => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (item.asset_code || '').toLowerCase().includes(q) ||
      (item.brand || '').toLowerCase().includes(q) ||
      (item.model || '').toLowerCase().includes(q) ||
      (item.serial_number || '').toLowerCase().includes(q) ||
      (item.location || '').toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil((stats.total || filtered.length) / PAGE_SIZE));

  // Selection handlers
  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map(i => i.id)));
  };

  // Form helpers
  const update = (f, v) => setForm(p => ({ ...p, [f]: v }));

  const openAdd = () => {
    setEditing(null);
    setForm({
      company_id: currentCompanyId ? String(currentCompanyId) : '',
      platform_id: '', asset_code: '', serial_number: '',
      brand: '', model: '', specifications: '', purchase_date: dayjs().format('YYYY-MM-DD'),
      purchase_cost: '', warranty_expiry: '', depreciation_rate: '',
      location: '', condition_status: 'New', status: 'Available', notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (item) => {
    setEditing(item);
    setForm({
      company_id: String(item.company_id || ''),
      platform_id: item.platform_id ? String(item.platform_id) : '',
      asset_code: item.asset_code || '',
      serial_number: item.serial_number || '',
      brand: item.brand || '',
      model: item.model || '',
      specifications: item.specifications || '',
      purchase_date: item.purchase_date ? dayjs(item.purchase_date).format('YYYY-MM-DD') : '',
      purchase_cost: item.purchase_cost != null ? String(item.purchase_cost) : '',
      warranty_expiry: item.warranty_expiry ? dayjs(item.warranty_expiry).format('YYYY-MM-DD') : '',
      depreciation_rate: item.depreciation_rate != null ? String(item.depreciation_rate) : '',
      location: item.location || '',
      condition_status: item.condition_status || 'Good',
      status: item.status || 'Available',
      notes: item.notes || '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.brand || !form.model) {
      toast.error(t('inventory.brand_model_required', 'Brand and model are required'));
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: form.company_id ? parseInt(form.company_id) : null,
        platform_id: form.platform_id ? parseInt(form.platform_id) : null,
        purchase_cost: form.purchase_cost ? parseFloat(form.purchase_cost) : null,
        depreciation_rate: form.depreciation_rate ? parseFloat(form.depreciation_rate) : null,
        purchase_date: form.purchase_date || null,
        warranty_expiry: form.warranty_expiry || null,
      };
      if (editing) {
        await inventoryApi.updateInventoryItem(editing.id, payload);
        toast.success(t('inventory.updated', 'Item updated'));
      } else {
        await inventoryApi.createInventoryItem(payload);
        toast.success(t('inventory.created', 'Item created'));
      }
      setModalOpen(false);
      loadData();
    } catch {
      toast.error(t('inventory.save_error', 'Failed to save'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item) => {
    const result = await confirmDelete(`"${item.brand} ${item.model}"`);
    if (result.isConfirmed) {
      try {
        await inventoryApi.deleteInventoryItem(item.id);
        toast.success(t('inventory.deleted', 'Item deleted'));
        loadData();
      } catch {
        toast.error(t('inventory.delete_error', 'Failed to delete'));
      }
    }
  };

  // Inspection of a returned unit (assets PRD business rule 1). Passing releases
  // it into available stock; failing has to say where the item goes and why,
  // because "failed" alone leaves it out of every count.
  const submitInspection = async (passed) => {
    if (!inspectModal) return;
    if (!passed && !inspectNote.trim()) { toast.error(t('inventory.inspect_note_required')); return; }
    setInspecting(true);
    try {
      await inventoryApi.inspectItem(inspectModal.id,
        { passed, note: inspectNote.trim() || null, outcome_status: passed ? undefined : inspectOutcome },
        currentCompanyId ? { company_id: currentCompanyId } : {});
      toast.success(passed ? t('inventory.inspect_passed_toast') : t('inventory.inspect_failed_toast', { status: inspectOutcome }));
      setInspectModal(null); setInspectNote(''); setInspectOutcome('In Repair');
      loadData();
      if (showAvailability) loadAvailability();
    } catch (err) {
      toast.error(err.response?.data?.error || t('inventory.inspect_error'));
    } finally { setInspecting(false); }
  };

  // The PRD availability line, computed from the real per-unit rows rather than
  // the manual platform_catalog counter.
  const loadAvailability = async () => {
    setAvailLoading(true);
    try {
      const { data } = await inventoryApi.getAvailability({
        ...(currentCompanyId ? { company_id: currentCompanyId } : {}),
        ...(ownerFilter ? { owner_scope: ownerFilter } : {}),
      });
      setAvailability(data);
    } catch { toast.error(t('inventory.availability_error')); }
    finally { setAvailLoading(false); }
  };

  // Detail modal
  const openDetail = async (item) => {
    setDetailModal(item);
    setDetailTab('details');
    setBarcodeData(null);
    setQrcodeData(null);
    setHistoryData([]);
  };

  const loadBarcodesAndQR = async (item) => {
    setLoadingDetail(true);
    try {
      const [barcodeRes, qrRes] = await Promise.all([
        inventoryApi.getItemBarcode(item.id),
        inventoryApi.getItemQRCode(item.id),
      ]);
      setBarcodeData(barcodeRes.data);
      setQrcodeData(qrRes.data);
    } catch {
      toast.error(t('inventory.barcode_error', 'Failed to load codes'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const loadHistory = async (item) => {
    setLoadingDetail(true);
    try {
      const res = await inventoryApi.getItemHistory(item.id);
      setHistoryData(res.data || []);
    } catch {
      toast.error(t('inventory.history_error', 'Failed to load history'));
    } finally {
      setLoadingDetail(false);
    }
  };

  useEffect(() => {
    if (detailModal && detailTab === 'barcode') loadBarcodesAndQR(detailModal);
    if (detailModal && detailTab === 'history') loadHistory(detailModal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailTab, detailModal]);

  // Print label
  const handlePrintLabel = async (item) => {
    try {
      const res = await inventoryApi.getItemLabel(item.id);
      const html = res.data?.html || res.data;
      const printWindow = window.open('', '_blank', 'width=600,height=400');
      printWindow.document.write(typeof html === 'string' ? html : `
        <!DOCTYPE html><html><head><title>Label - ${item.asset_code}</title>
        <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: Arial, sans-serif; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>
        </head><body>${JSON.stringify(html)}</body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    } catch {
      toast.error(t('inventory.print_error', 'Failed to print label'));
    }
  };

  // Bulk print
  const handleBulkPrint = async () => {
    if (selected.size === 0) return;
    try {
      const res = await inventoryApi.getBulkLabels([...selected]);
      const html = res.data?.html || res.data;
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      printWindow.document.write(typeof html === 'string' ? html : `
        <!DOCTYPE html><html><head><title>Bulk Labels</title>
        <style>* { margin: 0; padding: 0; box-sizing: border-box; } body { font-family: Arial, sans-serif; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }</style>
        </head><body>${JSON.stringify(html)}</body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    } catch {
      toast.error(t('inventory.bulk_print_error', 'Failed to print labels'));
    }
  };

  // Print QR
  const handlePrintQR = async (item) => {
    try {
      const res = await inventoryApi.getItemQRCode(item.id);
      const data = res.data;
      const printWindow = window.open('', '_blank', 'width=400,height=400');
      printWindow.document.write(`
        <!DOCTYPE html><html><head><title>QR - ${item.asset_code}</title>
        <style>* { margin:0; padding:0; } body { display:flex; justify-content:center; align-items:center; min-height:100vh; }
        @media print { body { -webkit-print-color-adjust: exact; } }</style>
        </head><body>
        ${data?.image ? `<img src="${data.image}" style="max-width:300px;" />` : `<pre>${JSON.stringify(data)}</pre>`}
        </body></html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => printWindow.print(), 300);
    } catch {
      toast.error(t('inventory.qr_error', 'Failed to print QR code'));
    }
  };

  const formatCurrency = (val) => {
    if (val == null || val === '') return '—';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(val);
  };

  const getPlatformName = (platformId) => {
    const p = platforms.find(pl => String(pl.id) === String(platformId));
    return p ? p.name : '—';
  };

  // Stats cards config
  const statsCards = [
    { label: t('inventory.total_items', 'Total Items'), value: stats.total || 0, icon: Package, gradient: 'from-brand-600 to-brand-800', text: 'text-brand-50' },
    { label: t('inventory.available', 'Available'), value: stats.available || 0, icon: CheckCircle2, gradient: 'from-emerald-500 to-emerald-700', text: 'text-emerald-50' },
    { label: t('inventory.assigned', 'Assigned'), value: stats.assigned || 0, icon: Monitor, gradient: 'from-blue-500 to-blue-700', text: 'text-blue-50' },
    { label: t('inventory.in_repair', 'In Repair'), value: stats.inRepair || 0, icon: Wrench, gradient: 'from-amber-500 to-amber-700', text: 'text-amber-50' },
    { label: t('inventory.total_value', 'Total Value'), value: formatCurrency(stats.totalValue), icon: DollarSign, gradient: 'from-violet-600 to-purple-800', text: 'text-violet-50', isCurrency: true },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Package className="text-brand-600" size={24} />
            {t('inventory.title', 'Asset Inventory')}
          </h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('inventory.subtitle', 'Track and manage all physical assets across your organization')}</p>
        </div>
        <Button onClick={openAdd}>
          <Plus size={16} /> {t('inventory.add_item', 'Add Item')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {statsCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${card.gradient} p-4 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-0.5`}
            >
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
              <div className="absolute bottom-0 left-0 w-12 h-12 bg-white/5 rounded-full translate-y-4 -translate-x-4" />
              <div className="relative">
                <div className={`flex items-center gap-2 ${card.text} mb-2`}>
                  <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                    <Icon size={14} />
                  </div>
                  <span className="text-xs font-medium opacity-90">{card.label}</span>
                </div>
                <p className={`text-2xl font-bold text-white ${card.isCurrency ? 'text-lg' : ''}`}>
                  {card.isCurrency ? card.value : card.value.toLocaleString()}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Availability by platform — the assets PRD formula, computed from the
          real per-unit rows. Collapsed by default so the page stays quick. */}
      <Card className="!p-0 overflow-hidden">
        <button type="button"
          onClick={() => { const next = !showAvailability; setShowAvailability(next); if (next && !availability) loadAvailability(); }}
          className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-surface-50 transition-colors text-start">
          <BarChart3 size={16} className="text-brand-600" />
          <span className="font-semibold text-surface-900 flex-1">{t('inventory.availability_title')}</span>
          {availability && (
            <span className="text-xs text-surface-500">
              {t('inventory.avail_available')}: <b className="text-emerald-600">{availability.totals.available || 0}</b>
              {' · '}{t('inventory.avail_pending')}: <b className="text-orange-600">{availability.totals.pending_inspection || 0}</b>
            </span>
          )}
          {showAvailability ? <ChevronLeft size={16} className="rotate-90 text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
        </button>
        {showAvailability && (
          <div className="border-t border-surface-100">
            <p className="px-5 py-2 text-[11px] text-surface-500 bg-surface-50">{t('inventory.availability_formula')}</p>
            {availLoading ? (
              <div className="p-5 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
            ) : !availability?.lines?.length ? (
              <p className="px-5 py-6 text-center text-sm text-surface-400">{t('inventory.availability_empty')}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-surface-50 text-surface-500">
                    <tr>
                      <th className="text-start p-3">{t('inventory.avail_platform')}</th>
                      <th className="p-3">{t('inventory.avail_total')}</th>
                      <th className="p-3 text-emerald-700">{t('inventory.avail_available')}</th>
                      <th className="p-3">{t('inventory.avail_assigned')}</th>
                      <th className="p-3">{t('inventory.avail_reserved')}</th>
                      <th className="p-3 text-orange-700">{t('inventory.avail_pending')}</th>
                      <th className="p-3">{t('inventory.avail_maintenance')}</th>
                      <th className="p-3">{t('inventory.avail_damaged')}</th>
                      <th className="p-3">{t('inventory.avail_lost')}</th>
                      <th className="p-3">{t('inventory.avail_disposed')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availability.lines.map((l, i) => (
                      <tr key={`${l.platform_id}-${l.owner_scope}-${i}`} className="border-t border-surface-50">
                        <td className="p-3">
                          <span className="me-1">{l.category_icon}</span>
                          <span className="font-medium text-surface-800">{l.platform_name || t('inventory.avail_unlinked')}</span>
                          <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">{l.owner_scope}</span>
                          {/* The manual platform counter drifts from reality the
                              moment anyone edits it; show it rather than hide it. */}
                          {l.counter_drift !== 0 && (
                            <span className="ms-2 text-[10px] text-amber-600" title={t('inventory.avail_drift_hint')}>
                              {t('inventory.avail_drift', { n: l.counter_drift })}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-center font-semibold">{l.total}</td>
                        <td className="p-3 text-center font-bold text-emerald-600">{l.available}</td>
                        <td className="p-3 text-center">{l.assigned}</td>
                        <td className="p-3 text-center">{l.reserved}</td>
                        <td className="p-3 text-center text-orange-600 font-semibold">{l.pending_inspection}</td>
                        <td className="p-3 text-center">{l.under_maintenance}</td>
                        <td className="p-3 text-center text-red-500">{l.damaged}</td>
                        <td className="p-3 text-center text-red-500">{l.lost}</td>
                        <td className="p-3 text-center text-surface-400">{l.disposed}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-surface-200 bg-surface-50 font-semibold">
                      <td className="p-3">{t('inventory.avail_totals')}</td>
                      <td className="p-3 text-center">{availability.totals.total}</td>
                      <td className="p-3 text-center text-emerald-600">{availability.totals.available}</td>
                      <td className="p-3 text-center">{availability.totals.assigned}</td>
                      <td className="p-3 text-center">{availability.totals.reserved}</td>
                      <td className="p-3 text-center text-orange-600">{availability.totals.pending_inspection}</td>
                      <td className="p-3 text-center">{availability.totals.under_maintenance}</td>
                      <td className="p-3 text-center">{availability.totals.damaged}</td>
                      <td className="p-3 text-center">{availability.totals.lost}</td>
                      <td className="p-3 text-center">{availability.totals.disposed}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* Bulk Actions Bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-3 bg-brand-50 border border-brand-200 rounded-xl px-4 py-3 animate-fade-in">
          <div className="flex items-center gap-2 text-brand-700">
            <CheckSquare size={16} />
            <span className="text-sm font-medium">
              {selected.size} {t('inventory.items_selected', 'item(s) selected')}
            </span>
          </div>
          <div className="flex-1" />
          <Button size="sm" onClick={handleBulkPrint}>
            <Printer size={14} /> {t('inventory.print_labels', `Print ${selected.size} Label(s)`)}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X size={14} /> {t('inventory.clear_selection', 'Clear')}
          </Button>
        </div>
      )}

      {/* Search & Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            placeholder={t('inventory.search', 'Search by code, brand, model, serial...')}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          {STATUSES.map(s => (
            <button
              key={s}
              onClick={() => { setStatusFilter(s); setPage(1); setSelected(new Set()); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s
                  ? 'bg-brand-700 text-white shadow-sm'
                  : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {s === 'All' ? t('inventory.all', 'All') : t(`inventory.${s.toLowerCase().replace(' ', '_')}`, s)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {['', 'RE', 'MKT', 'GRP'].map(o => (
            <button key={o || 'all'} onClick={() => { setOwnerFilter(o); setPage(1); setSelected(new Set()); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ownerFilter === o ? 'bg-brand-700 text-white shadow-sm' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
              {o ? t(`asset_catalog.owner_${o}`) : t('asset_catalog.owner_all')}
            </button>
          ))}
        </div>
        <select
          value={platformFilter}
          onChange={(e) => { setPlatformFilter(e.target.value); setPage(1); }}
          className="px-3 py-2 text-xs bg-white border border-surface-200 rounded-xl input-focus appearance-none min-w-[140px]"
        >
          <option value="">{t('inventory.all_platforms', 'All Platforms')}</option>
          {platforms.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <Badge variant="brand">{filtered.length} {t('inventory.items', 'items')}</Badge>
      </div>

      {/* Table */}
      {loading ? (
        <Card className="!p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface-200 rounded w-1/3" />
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex gap-4">
                <div className="h-4 bg-surface-100 rounded w-16" />
                <div className="h-4 bg-surface-100 rounded w-32" />
                <div className="h-4 bg-surface-100 rounded flex-1" />
                <div className="h-4 bg-surface-100 rounded w-20" />
              </div>
            ))}
          </div>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="w-6 h-6 text-surface-400" />}
            title={t('inventory.no_items', 'No inventory items')}
            description={t('inventory.no_items_desc', 'Start by adding your first asset to the inventory')}
            action={<Button onClick={openAdd}><Plus size={16} /> {t('inventory.add_item', 'Add Item')}</Button>}
          />
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/60">
                  <th className="text-left px-4 py-3 w-10">
                    <button
                      onClick={toggleSelectAll}
                      className="p-0.5 text-surface-400 hover:text-brand-600 transition-colors"
                    >
                      {selected.size === filtered.length && filtered.length > 0
                        ? <CheckSquare size={16} className="text-brand-600" />
                        : <Square size={16} />
                      }
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-surface-500">{t('inventory.asset_code', 'Asset Code')}</th>
                  <th className="text-left px-4 py-3 font-medium text-surface-500">{t('inventory.brand_model', 'Brand / Model')}</th>
                  <th className="text-left px-4 py-3 font-medium text-surface-500">{t('inventory.serial', 'Serial Number')}</th>
                  <th className="text-left px-4 py-3 font-medium text-surface-500">{t('inventory.platform_type', 'Platform')}</th>
                  <th className="text-left px-4 py-3 font-medium text-surface-500">{t('inventory.status', 'Status')}</th>
                  <th className="text-left px-4 py-3 font-medium text-surface-500">{t('inventory.condition', 'Condition')}</th>
                  <th className="text-left px-4 py-3 font-medium text-surface-500">{t('inventory.location', 'Location')}</th>
                  <th className="text-left px-4 py-3 font-medium text-surface-500">{t('inventory.value', 'Value')}</th>
                  <th className="text-right px-4 py-3 font-medium text-surface-500">{t('inventory.actions', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(item => {
                  const sc = statusConfig[item.status] || statusConfig.Available;
                  const isSelected = selected.has(item.id);
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-surface-50 transition-colors group ${
                        isSelected ? 'bg-brand-50/50' : 'hover:bg-surface-50/50'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleSelect(item.id)}
                          className="p-0.5 text-surface-400 hover:text-brand-600 transition-colors"
                        >
                          {isSelected
                            ? <CheckSquare size={16} className="text-brand-600" />
                            : <Square size={16} />
                          }
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => openDetail(item)}
                          className="flex items-center gap-2 text-brand-700 hover:text-brand-800 font-medium transition-colors"
                        >
                          <BarChart3 size={12} className="text-brand-400 flex-shrink-0" />
                          <span className="font-mono text-xs">{item.asset_code || '—'}</span>
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-medium text-surface-800">{item.brand || '—'}</span>
                          <span className="text-surface-400 ml-1">{item.model || ''}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-500 text-xs font-mono">{item.serial_number || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs px-2 py-0.5 bg-surface-100 rounded text-surface-600">
                          {item.platform_id ? getPlatformName(item.platform_id) : '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={sc.color} className="text-[10px]" dot>
                          {t(`inventory.${(item.status || 'available').toLowerCase().replace(' ', '_')}`, item.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={conditionColors[item.condition_status] || 'info'} className="text-[10px]">
                          {item.condition_status || '—'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 text-surface-500 text-xs">
                          <MapPin size={10} className="flex-shrink-0" />
                          {item.location || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-surface-700 font-medium text-xs">
                        {formatCurrency(item.purchase_cost)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          {/* A unit awaiting inspection cannot re-enter stock
                              until someone verifies it, so the action stays
                              visible rather than appearing on hover. */}
                          {item.status === 'Returned Pending Inspection' && (
                            <button onClick={() => { setInspectModal(item); setInspectNote(''); setInspectOutcome('In Repair'); }}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-orange-100 text-orange-800 hover:bg-orange-200 transition-colors whitespace-nowrap"
                              title={t('inventory.inspect')}>
                              <ClipboardCheck size={12} className="inline me-1" />{t('inventory.inspect')}
                            </button>
                          )}
                        </div>
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openDetail(item)} className="p-1.5 text-surface-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title={t('inventory.view_details', 'View Details')}>
                            <Eye size={14} />
                          </button>
                          <button onClick={() => handlePrintLabel(item)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title={t('inventory.print_label', 'Print Label')}>
                            <Tag size={14} />
                          </button>
                          <button onClick={() => openEdit(item)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title={t('inventory.edit', 'Edit')}>
                            <Edit3 size={14} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDelete(item)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title={t('inventory.delete', 'Delete')}>
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100 bg-surface-50/40">
            <span className="text-xs text-surface-500">
              {t('inventory.showing', 'Showing')} {Math.min((page - 1) * PAGE_SIZE + 1, filtered.length)}–{Math.min(page * PAGE_SIZE, filtered.length)} {t('inventory.of', 'of')} {stats.total || filtered.length}
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              {[...Array(Math.min(totalPages, 7))].map((_, i) => {
                let pageNum;
                if (totalPages <= 7) pageNum = i + 1;
                else if (page <= 4) pageNum = i + 1;
                else if (page >= totalPages - 3) pageNum = totalPages - 6 + i;
                else pageNum = page - 3 + i;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                      page === pageNum
                        ? 'bg-brand-700 text-white shadow-sm'
                        : 'text-surface-600 hover:bg-surface-200'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg text-surface-500 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('inventory.edit_item', 'Edit Item') : t('inventory.add_item', 'Add Item')} size="xl">
        <form onSubmit={handleSave} className="space-y-5">
          {/* Row 1: Company & Platform */}
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('inventory.company', 'Company')}
              value={form.company_id}
              onChange={(e) => update('company_id', e.target.value)}
              options={companies.map(c => ({ value: String(c.id), label: c.name }))}
              placeholder={t('inventory.select_company', 'Select company...')}
            />
            <Select
              label={t('inventory.platform', 'Platform Type')}
              value={form.platform_id}
              onChange={(e) => update('platform_id', e.target.value)}
              options={platforms.map(p => ({ value: String(p.id), label: p.name }))}
              placeholder={t('inventory.select_platform', 'Select platform...')}
            />
          </div>

          {/* Row 2: Code, Serial, Brand, Model */}
          <div className="grid grid-cols-4 gap-4">
            <Input
              label={t('inventory.asset_code', 'Asset Code')}
              placeholder={t('inventory.auto_generated', 'Auto-generated')}
              value={form.asset_code}
              onChange={(e) => update('asset_code', e.target.value)}
            />
            <Input
              label={t('inventory.serial', 'Serial Number')}
              placeholder="SN-XXXX-XXXX"
              value={form.serial_number}
              onChange={(e) => update('serial_number', e.target.value)}
            />
            <Input
              label={t('inventory.brand', 'Brand')}
              required
              placeholder="e.g. Dell, HP"
              value={form.brand}
              onChange={(e) => update('brand', e.target.value)}
            />
            <Input
              label={t('inventory.model', 'Model')}
              required
              placeholder="e.g. Latitude 5540"
              value={form.model}
              onChange={(e) => update('model', e.target.value)}
            />
          </div>

          {/* Row 3: Purchase, Warranty, Cost, Depreciation */}
          <div className="grid grid-cols-4 gap-4">
            <Input
              label={t('inventory.purchase_date', 'Purchase Date')}
              type="date"
              value={form.purchase_date}
              onChange={(e) => update('purchase_date', e.target.value)}
            />
            <Input
              label={t('inventory.purchase_cost', 'Purchase Cost ($)')}
              type="number"
              step="0.01"
              placeholder="0.00"
              value={form.purchase_cost}
              onChange={(e) => update('purchase_cost', e.target.value)}
            />
            <Input
              label={t('inventory.warranty_expiry', 'Warranty Expiry')}
              type="date"
              value={form.warranty_expiry}
              onChange={(e) => update('warranty_expiry', e.target.value)}
            />
            <Input
              label={t('inventory.depreciation', 'Depreciation Rate (%)')}
              type="number"
              step="0.1"
              placeholder="e.g. 20"
              value={form.depreciation_rate}
              onChange={(e) => update('depreciation_rate', e.target.value)}
            />
          </div>

          {/* Row 4: Location, Condition, Status */}
          <div className="grid grid-cols-3 gap-4">
            <Input
              label={t('inventory.location', 'Location')}
              placeholder={t('inventory.location_placeholder', 'e.g. Building A, Floor 2')}
              value={form.location}
              onChange={(e) => update('location', e.target.value)}
            />
            <Select
              label={t('inventory.condition', 'Condition')}
              value={form.condition_status}
              onChange={(e) => update('condition_status', e.target.value)}
              options={CONDITIONS.map(c => ({ value: c, label: c }))}
            />
            <Select
              label={t('inventory.status', 'Status')}
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              options={STATUSES.filter(s => s !== 'All').map(s => ({ value: s, label: s }))}
            />
          </div>

          {/* Specifications */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              {t('inventory.specifications', 'Specifications')}
            </label>
            <textarea
              placeholder={t('inventory.specs_placeholder', 'e.g. 16GB RAM, 512GB SSD, Intel i7')}
              value={form.specifications}
              onChange={(e) => update('specifications', e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">
              {t('inventory.notes', 'Notes')}
            </label>
            <textarea
              placeholder={t('inventory.notes_placeholder', 'Additional notes...')}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
              rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2 border-t border-surface-100">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button type="submit" loading={saving}>
              {editing ? t('common.save', 'Save Changes') : t('inventory.create', 'Create Item')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        open={!!detailModal}
        onClose={() => { setDetailModal(null); setBarcodeData(null); setQrcodeData(null); setHistoryData([]); }}
        title={detailModal ? `${detailModal.brand} ${detailModal.model}` : ''}
        size="xl"
      >
        {detailModal && (
          <div className="space-y-5">
            {/* Tab Navigation */}
            <div className="flex gap-1 border-b border-surface-100">
              {[
                { key: 'details', label: t('inventory.tab_details', 'Details'), icon: Info },
                { key: 'barcode', label: t('inventory.tab_barcode', 'Barcode & Labels'), icon: QrCode },
                { key: 'history', label: t('inventory.tab_history', 'History'), icon: History },
              ].map(tab => {
                const TabIcon = tab.icon;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setDetailTab(tab.key)}
                    className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                      detailTab === tab.key
                        ? 'border-brand-600 text-brand-700'
                        : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300'
                    }`}
                  >
                    <TabIcon size={14} />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Details Tab */}
            {detailTab === 'details' && (
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {[
                  { label: t('inventory.asset_code', 'Asset Code'), value: detailModal.asset_code, mono: true },
                  { label: t('inventory.serial', 'Serial Number'), value: detailModal.serial_number, mono: true },
                  { label: t('inventory.brand', 'Brand'), value: detailModal.brand },
                  { label: t('inventory.model', 'Model'), value: detailModal.model },
                  { label: t('inventory.platform', 'Platform'), value: detailModal.platform_id ? getPlatformName(detailModal.platform_id) : '—' },
                  { label: t('inventory.status', 'Status'), value: detailModal.status, badge: true, badgeVariant: (statusConfig[detailModal.status] || statusConfig.Available).color },
                  { label: t('inventory.condition', 'Condition'), value: detailModal.condition_status, badge: true, badgeVariant: conditionColors[detailModal.condition_status] || 'info' },
                  { label: t('inventory.location', 'Location'), value: detailModal.location, icon: MapPin },
                  { label: t('inventory.purchase_date', 'Purchase Date'), value: detailModal.purchase_date ? dayjs(detailModal.purchase_date).format('MMM D, YYYY') : '—', icon: Calendar },
                  { label: t('inventory.purchase_cost', 'Purchase Cost'), value: formatCurrency(detailModal.purchase_cost), icon: DollarSign },
                  { label: t('inventory.warranty_expiry', 'Warranty Expiry'), value: detailModal.warranty_expiry ? dayjs(detailModal.warranty_expiry).format('MMM D, YYYY') : '—', icon: Shield },
                  { label: t('inventory.depreciation', 'Depreciation'), value: detailModal.depreciation_rate ? `${detailModal.depreciation_rate}%` : '—' },
                ].map((field) => (
                  <div key={field.label} className="bg-surface-50 rounded-xl p-3 border border-surface-100">
                    <span className="text-xs text-surface-400 block mb-1">{field.label}</span>
                    {field.badge ? (
                      <Badge variant={field.badgeVariant} dot className="text-xs">{field.value || '—'}</Badge>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {field.icon && <field.icon size={12} className="text-surface-400" />}
                        <span className={`text-sm font-medium text-surface-800 ${field.mono ? 'font-mono' : ''}`}>
                          {field.value || '—'}
                        </span>
                      </div>
                    )}
                  </div>
                ))}

                {detailModal.specifications && (
                  <div className="col-span-full bg-surface-50 rounded-xl p-3 border border-surface-100">
                    <span className="text-xs text-surface-400 block mb-1">{t('inventory.specifications', 'Specifications')}</span>
                    <p className="text-sm text-surface-700 whitespace-pre-wrap">{detailModal.specifications}</p>
                  </div>
                )}
                {detailModal.notes && (
                  <div className="col-span-full bg-surface-50 rounded-xl p-3 border border-surface-100">
                    <span className="text-xs text-surface-400 block mb-1">{t('inventory.notes', 'Notes')}</span>
                    <p className="text-sm text-surface-700 whitespace-pre-wrap">{detailModal.notes}</p>
                  </div>
                )}
              </div>
            )}

            {/* Barcode & Labels Tab */}
            {detailTab === 'barcode' && (
              <div className="space-y-6">
                {loadingDetail ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full" />
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Barcode */}
                    <div className="bg-white border border-surface-200 rounded-2xl p-6 text-center shadow-sm">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <BarChart3 size={16} className="text-brand-600" />
                        <span className="text-sm font-semibold text-surface-700">{t('inventory.barcode', 'Barcode')}</span>
                      </div>
                      <div className="bg-surface-50 rounded-xl p-6 mb-4 min-h-[120px] flex items-center justify-center">
                        {barcodeData?.image ? (
                          <img src={barcodeData.image} alt="Barcode" className="max-w-full h-auto" />
                        ) : barcodeData?.svg ? (
                          <div dangerouslySetInnerHTML={{ __html: barcodeData.svg }} />
                        ) : (
                          <span className="text-surface-400 text-sm">{t('inventory.no_barcode', 'No barcode available')}</span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-surface-500 mb-4">{detailModal.asset_code}</p>
                      <Button size="sm" variant="secondary" onClick={() => handlePrintLabel(detailModal)}>
                        <Printer size={14} /> {t('inventory.print_label', 'Print Label')}
                      </Button>
                    </div>

                    {/* QR Code */}
                    <div className="bg-white border border-surface-200 rounded-2xl p-6 text-center shadow-sm">
                      <div className="flex items-center justify-center gap-2 mb-4">
                        <QrCode size={16} className="text-brand-600" />
                        <span className="text-sm font-semibold text-surface-700">{t('inventory.qr_code', 'QR Code')}</span>
                      </div>
                      <div className="bg-surface-50 rounded-xl p-6 mb-4 min-h-[120px] flex items-center justify-center">
                        {qrcodeData?.image ? (
                          <img src={qrcodeData.image} alt="QR Code" className="w-32 h-32 object-contain" />
                        ) : qrcodeData?.svg ? (
                          <div dangerouslySetInnerHTML={{ __html: qrcodeData.svg }} />
                        ) : (
                          <span className="text-surface-400 text-sm">{t('inventory.no_qrcode', 'No QR code available')}</span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-surface-500 mb-4">{detailModal.asset_code}</p>
                      <Button size="sm" variant="secondary" onClick={() => handlePrintQR(detailModal)}>
                        <QrCode size={14} /> {t('inventory.print_qr', 'Print QR Code')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* History Tab */}
            {detailTab === 'history' && (
              <div className="space-y-4">
                {loadingDetail ? (
                  <div className="flex justify-center py-12">
                    <div className="animate-spin h-8 w-8 border-2 border-brand-500 border-t-transparent rounded-full" />
                  </div>
                ) : historyData.length === 0 ? (
                  <EmptyState
                    icon={<History className="w-5 h-5 text-surface-400" />}
                    title={t('inventory.no_history', 'No history yet')}
                    description={t('inventory.no_history_desc', 'Assignment and status changes will appear here')}
                  />
                ) : (
                  <div className="relative pl-6">
                    {/* Timeline line */}
                    <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gradient-to-b from-brand-300 via-brand-200 to-surface-100" />

                    {historyData.map((entry, idx) => (
                      <div key={idx} className="relative flex gap-4 pb-6 last:pb-0">
                        {/* Timeline dot */}
                        <div className={`absolute left-[-17px] w-4 h-4 rounded-full border-2 flex-shrink-0 ${
                          idx === 0
                            ? 'bg-brand-600 border-brand-600 shadow-sm shadow-brand-200'
                            : 'bg-white border-surface-300'
                        }`} />

                        <div className="bg-surface-50 rounded-xl p-4 border border-surface-100 flex-1 hover:border-brand-200 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-surface-800">
                              {entry.action || entry.description || t('inventory.status_change', 'Status change')}
                            </span>
                            <span className="text-xs text-surface-400 flex items-center gap-1">
                              <Clock size={10} />
                              {entry.created_at ? dayjs(entry.created_at).format('MMM D, YYYY h:mm A') : '—'}
                            </span>
                          </div>
                          {entry.employee_name && (
                            <p className="text-xs text-surface-500">
                              {t('inventory.assigned_to', 'Assigned to')}: <span className="font-medium">{entry.employee_name}</span>
                            </p>
                          )}
                          {entry.notes && (
                            <p className="text-xs text-surface-400 mt-1">{entry.notes}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Inspection of a returned unit — the gate that keeps a damaged item out
          of available stock (assets PRD business rule 1). */}
      <Modal open={!!inspectModal} onClose={() => setInspectModal(null)} title={t('inventory.inspect_title')} size="md">
        {inspectModal && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-50 rounded-xl text-sm">
              <p className="font-semibold text-surface-800">{inspectModal.asset_code}</p>
              <p className="text-xs text-surface-500">{[inspectModal.brand, inspectModal.model].filter(Boolean).join(' ')} · {inspectModal.serial_number || '—'}</p>
              {inspectModal.condition_status && (
                <p className="text-xs text-surface-500 mt-1">{t('inventory.condition', 'Condition')}: {inspectModal.condition_status}</p>
              )}
            </div>
            <p className="text-xs text-surface-600">{t('inventory.inspect_desc')}</p>

            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('inventory.inspect_note')}</label>
              <textarea value={inspectNote} onChange={(e) => setInspectNote(e.target.value)} rows={2}
                placeholder={t('inventory.inspect_note_ph')}
                className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
            </div>

            <div className="p-3 rounded-xl border border-surface-200 space-y-2">
              <label className="block text-sm font-medium text-surface-700">{t('inventory.inspect_fail_outcome')}</label>
              <Select value={inspectOutcome} onChange={(e) => setInspectOutcome(e.target.value)}
                options={['In Repair', 'Damaged', 'Disposed', 'Lost'].map((s) => ({ value: s, label: t(`inventory.${s.toLowerCase().replace(' ', '_')}`, s) }))} />
              <p className="text-[10px] text-surface-400">{t('inventory.inspect_fail_hint')}</p>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="secondary" onClick={() => setInspectModal(null)}>{t('common.cancel')}</Button>
              <Button variant="danger" onClick={() => submitInspection(false)} loading={inspecting}>
                <AlertTriangle size={14} /> {t('inventory.inspect_fail')}
              </Button>
              <Button onClick={() => submitInspection(true)} loading={inspecting}>
                <CheckCircle2 size={14} /> {t('inventory.inspect_pass')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
