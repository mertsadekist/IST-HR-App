import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
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
import { Plus, Edit3, Trash2, Package, Monitor, Globe, Wrench, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const assetTypeIcons = { Hardware: Monitor, Account: Globe, Software: Wrench };
const assetTypeColors = { Hardware: 'text-blue-600', Account: 'text-green-600', Software: 'text-purple-600' };

export default function AssetCatalog() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const [categories, setCategories] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});

  // Category modal
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [savingCat, setSavingCat] = useState(false);
  const [catForm, setCatForm] = useState({ name: '', icon: '💻', color: '#374151' });

  // Platform modal
  const [platModalOpen, setPlatModalOpen] = useState(false);
  const [editingPlat, setEditingPlat] = useState(null);
  const [savingPlat, setSavingPlat] = useState(false);
  const [platForm, setPlatForm] = useState({
    name: '', category_id: '', asset_type: 'Account', description: '',
    inventory_total: 0, status: 'Active', company_ids: [],
  });

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [catRes, platRes] = await Promise.all([
        settingsApi.getAssetCategories(),
        settingsApi.getPlatformCatalog(),
      ]);
      setCategories(catRes.data);
      setPlatforms(platRes.data);
      const exp = {};
      catRes.data.forEach((c) => { exp[c.id] = true; });
      setExpanded(exp);
    } catch (err) {
      toast.error(t('toasts.t_failed_to_load_asset_catalog'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // ======= Category CRUD =======
  const openAddCat = () => { setEditingCat(null); setCatForm({ name: '', icon: '💻', color: '#374151' }); setCatModalOpen(true); };
  const openEditCat = (cat) => { setEditingCat(cat); setCatForm({ name: cat.name, icon: cat.icon || '💻', color: cat.color || '#374151' }); setCatModalOpen(true); };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    if (!catForm.name) { toast.error(t('toasts.t_category_name_is_required')); return; }
    setSavingCat(true);
    try {
      if (editingCat) {
        await settingsApi.updateAssetCategory(editingCat.id, catForm);
        toast.success(t('toasts.t_category_updated'));
      } else {
        await settingsApi.createAssetCategory(catForm);
        toast.success(t('toasts.t_category_created'));
      }
      setCatModalOpen(false);
      loadAll();
    } catch (err) { toast.error(t('common.error')); } finally { setSavingCat(false); }
  };

  const handleDeleteCat = async (cat) => {
    const result = await confirmDelete(`category "${cat.name}" and all its platforms`);
    if (result.isConfirmed) {
      try { await settingsApi.deleteAssetCategory(cat.id); toast.success(t('toasts.t_category_deleted')); loadAll(); }
      catch (err) { toast.error(t('common.delete_failed')); }
    }
  };

  // ======= Platform CRUD =======
  const openAddPlat = (categoryId) => {
    setEditingPlat(null);
    setPlatForm({ name: '', category_id: String(categoryId || ''), asset_type: 'Account', description: '', inventory_total: 0, status: 'Active', company_ids: [] });
    setPlatModalOpen(true);
  };

  const openEditPlat = (plat) => {
    setEditingPlat(plat);
    setPlatForm({
      name: plat.name, category_id: String(plat.category_id), asset_type: plat.asset_type || 'Account',
      description: plat.description || '', inventory_total: plat.inventory_total || 0,
      status: plat.status || 'Active',
      company_ids: plat.companies?.map(c => c.id) || [],
    });
    setPlatModalOpen(true);
  };

  const handleSavePlat = async (e) => {
    e.preventDefault();
    if (!platForm.name || !platForm.category_id) { toast.error(t('toasts.t_name_and_category_required')); return; }
    setSavingPlat(true);
    try {
      const payload = { ...platForm, category_id: parseInt(platForm.category_id), inventory_total: parseInt(platForm.inventory_total) || 0 };
      if (editingPlat) {
        await settingsApi.updatePlatformItem(editingPlat.id, payload);
        toast.success(t('toasts.t_platform_updated'));
      } else {
        await settingsApi.createPlatformItem(payload);
        toast.success(t('toasts.t_platform_created'));
      }
      setPlatModalOpen(false);
      loadAll();
    } catch (err) { toast.error(t('common.error')); } finally { setSavingPlat(false); }
  };

  const handleDeletePlat = async (plat) => {
    const result = await confirmDelete(`"${plat.name}"`);
    if (result.isConfirmed) {
      try { await settingsApi.deletePlatformItem(plat.id); toast.success(t('toasts.t_platform_deleted')); loadAll(); }
      catch (err) { toast.error(t('common.delete_failed')); }
    }
  };

  const toggleCompany = (companyId) => {
    setPlatForm(prev => ({
      ...prev,
      company_ids: prev.company_ids.includes(companyId)
        ? prev.company_ids.filter(id => id !== companyId)
        : [...prev.company_ids, companyId],
    }));
  };

  const catIcons = ['💻', '📱', '🖥️', '🖨️', '📧', '☁️', '🔑', '📁', '🎧', '📷', '🏢', '🛡️'];

  const totalPlatforms = platforms.length;

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3 mb-2" /><div className="h-3 bg-surface-100 rounded w-2/3" /></div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <Badge variant="brand">{t('asset_catalog.platforms_in_categories', { platforms: totalPlatforms, categories: categories.length })}</Badge>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => openAddPlat('')}><Plus size={14} /> {t('asset_catalog.add_platform')}</Button>
          <Button onClick={openAddCat}><Plus size={16} /> {t('asset_catalog.add_category')}</Button>
        </div>
      </div>

      {/* Category list */}
      {categories.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Package className="w-6 h-6 text-surface-400" />}
            title={t('asset_catalog.no_categories')}
            description={t('asset_catalog.no_categories_desc')}
            action={<Button onClick={openAddCat}><Plus size={16} /> {t('asset_catalog.add_category')}</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {categories.map((cat) => {
            const catPlatforms = platforms.filter(p => p.category_id === cat.id);
            return (
              <Card key={cat.id} className="!p-0 overflow-hidden">
                {/* Category header */}
                <div
                  className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-surface-50 transition-colors"
                  onClick={() => toggle(cat.id)}
                >
                  <span className="text-lg">{cat.icon}</span>
                  <h3 className="font-semibold text-surface-900 flex-1">{cat.name}</h3>
                  <Badge variant="brand" className="!text-[10px]">{catPlatforms.length}</Badge>
                  <div className="flex gap-1 ml-2">
                    <button onClick={(e) => { e.stopPropagation(); openAddPlat(cat.id); }}
                      className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                      <Plus size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); openEditCat(cat); }}
                      className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                      <Edit3 size={14} />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCat(cat); }}
                      className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {expanded[cat.id] ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
                </div>

                {/* Platforms */}
                {expanded[cat.id] && (
                  <div className="border-t border-surface-100">
                    {catPlatforms.length === 0 ? (
                      <div className="px-5 py-6 text-center">
                        <p className="text-sm text-surface-400">{t('asset_catalog.no_platforms')}</p>
                        <Button size="sm" className="mt-2" onClick={() => openAddPlat(cat.id)}><Plus size={14} /> {t('asset_catalog.add_platform')}</Button>
                      </div>
                    ) : (
                      <div className="divide-y divide-surface-50">
                        {catPlatforms.map((plat) => {
                          const TypeIcon = assetTypeIcons[plat.asset_type] || Package;
                          return (
                            <div key={plat.id} className="px-5 py-3 flex items-center gap-3 group hover:bg-surface-50/50 transition-colors">
                              <TypeIcon size={16} className={assetTypeColors[plat.asset_type] || 'text-surface-500'} />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-medium text-surface-800 text-sm">{plat.name}</span>
                                  <Badge variant={plat.status === 'Active' ? 'active' : 'inactive'} className="text-[10px]">{plat.status}</Badge>
                                  <span className="text-xs text-surface-400 px-1.5 py-0.5 bg-surface-100 rounded">{plat.asset_type}</span>
                                </div>
                                {plat.companies?.length > 0 && (
                                  <div className="flex gap-1 mt-1">
                                    {plat.companies.map(c => (
                                      <span key={c.id} className="text-[10px] px-1.5 py-0.5 bg-brand-50 text-brand-700 rounded-md">{c.short_code}</span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-3">
                                {plat.inventory_total > 0 && (
                                  <span className="text-xs text-surface-400">{t('asset_catalog.stock')}: {plat.inventory_total}</span>
                                )}
                                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <button onClick={() => openEditPlat(plat)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                    <Edit3 size={13} />
                                  </button>
                                  <button onClick={() => handleDeletePlat(plat)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Category Modal */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? t('asset_catalog.edit_category') : t('asset_catalog.create_category')} size="sm">
        <form onSubmit={handleSaveCat} className="space-y-4">
          <Input label={t('asset_catalog.category_name')} required placeholder="e.g. Communication Tools" value={catForm.name} onChange={(e) => setCatForm(p => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('asset_catalog.icon')}</label>
              <div className="flex flex-wrap gap-1.5">
                {catIcons.map((icon) => (
                  <button key={icon} type="button" onClick={() => setCatForm(p => ({ ...p, icon }))}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${catForm.icon === icon ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-surface-50 hover:bg-surface-100'}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('asset_catalog.color')}</label>
              <input type="color" value={catForm.color} onChange={(e) => setCatForm(p => ({ ...p, color: e.target.value }))} className="w-full h-10 rounded-xl border-0 cursor-pointer" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCatModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={savingCat}>{editingCat ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>

      {/* Platform Modal */}
      <Modal open={platModalOpen} onClose={() => setPlatModalOpen(false)} title={editingPlat ? t('asset_catalog.edit_platform') : t('asset_catalog.create_platform')} size="md">
        <form onSubmit={handleSavePlat} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('asset_catalog.platform_name')} required placeholder="e.g. Google Workspace" value={platForm.name} onChange={(e) => setPlatForm(p => ({ ...p, name: e.target.value }))} />
            <Select
              label={t('asset_catalog.category')}
              required
              value={platForm.category_id}
              onChange={(e) => setPlatForm(p => ({ ...p, category_id: e.target.value }))}
              options={categories.map(c => ({ value: String(c.id), label: c.name }))}
              placeholder="Select..."
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label={t('asset_catalog.asset_type')}
              value={platForm.asset_type}
              onChange={(e) => setPlatForm(p => ({ ...p, asset_type: e.target.value }))}
              options={['Hardware', 'Account', 'Software']}
            />
            <Input label={t('asset_catalog.total_inventory')} type="number" value={platForm.inventory_total} onChange={(e) => setPlatForm(p => ({ ...p, inventory_total: e.target.value }))} />
            <Select
              label={t('asset_catalog.status')}
              value={platForm.status}
              onChange={(e) => setPlatForm(p => ({ ...p, status: e.target.value }))}
              options={['Active', 'Inactive']}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('asset_catalog.description')}</label>
            <textarea placeholder="..." value={platForm.description} onChange={(e) => setPlatForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>

          {/* Company assignment */}
          {companies.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">{t('asset_catalog.assign_to_companies')}</label>
              <div className="flex flex-wrap gap-1.5">
                {companies.map(c => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCompany(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      platForm.company_ids.includes(c.id)
                        ? 'bg-brand-600 text-white'
                        : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                    }`}
                  >
                    {c.short_code} — {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setPlatModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={savingPlat}>{editingPlat ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
