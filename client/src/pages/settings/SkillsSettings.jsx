import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as skillsApi from '@api/skillsApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, ChevronDown, ChevronRight, Trash2, Edit3, Search, Download, Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function SkillsSettings() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin'; // delete is admin-only
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [editingCat, setEditingCat] = useState(null);
  const [catForm, setCatForm] = useState({ name: '', icon: '🎯', color: '#6D28D9' });
  const [savingCat, setSavingCat] = useState(false);
  const [newSkillText, setNewSkillText] = useState({});

  useEffect(() => { loadSkills(); }, []);

  const loadSkills = async () => {
    setLoading(true);
    try {
      const { data } = await skillsApi.getSkills();
      setCategories(data);
      // Expand all by default
      const exp = {};
      data.forEach((c) => { exp[c.id] = true; });
      setExpanded(exp);
    } catch (err) {
      toast.error(t('toasts.t_failed_to_load_skills'));
    } finally {
      setLoading(false);
    }
  };

  const toggle = (id) => setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));

  // Category CRUD
  const openAddCat = () => { setEditingCat(null); setCatForm({ name: '', icon: '🎯', color: '#6D28D9' }); setCatModalOpen(true); };
  const openEditCat = (cat) => {
    setEditingCat(cat);
    setCatForm({ name: cat.name, icon: cat.icon || '🎯', color: cat.color || '#6D28D9' });
    setCatModalOpen(true);
  };

  const handleSaveCat = async (e) => {
    e.preventDefault();
    if (!catForm.name) { toast.error(t('toasts.t_category_name_is_required')); return; }
    setSavingCat(true);
    try {
      if (editingCat) {
        await skillsApi.updateCategory(editingCat.id, catForm);
        toast.success(t('toasts.t_category_updated'));
      } else {
        await skillsApi.createCategory(catForm);
        toast.success(t('toasts.t_category_created'));
      }
      setCatModalOpen(false);
      loadSkills();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed');
    } finally {
      setSavingCat(false);
    }
  };

  const handleDeleteCat = async (cat) => {
    const result = await confirmDelete(`category "${cat.name}" and all its skills`);
    if (result.isConfirmed) {
      try {
        await skillsApi.deleteCategory(cat.id);
        toast.success(t('toasts.t_category_deleted'));
        loadSkills();
      } catch (err) { toast.error(t('common.delete_failed')); }
    }
  };

  // Skill inline add + delete
  const handleAddSkill = async (categoryId) => {
    const text = newSkillText[categoryId]?.trim();
    if (!text) return;
    try {
      await skillsApi.createSkill({ category_id: categoryId, name: text });
      setNewSkillText((prev) => ({ ...prev, [categoryId]: '' }));
      loadSkills();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add skill');
    }
  };

  const handleDeleteSkill = async (skillId) => {
    try {
      await skillsApi.deleteSkill(skillId);
      loadSkills();
    } catch (err) { toast.error(t('toasts.t_failed_to_delete_skill')); }
  };

  // Export
  const handleExport = () => {
    const json = JSON.stringify({ categories: categories.map((c) => ({ name: c.name, icon: c.icon, color: c.color, skills: c.skills.map((s) => s.name) })) }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'skills-library.json'; a.click();
    URL.revokeObjectURL(url);
    toast.success(t('toasts.t_skills_exported'));
  };

  // Filter
  const filteredCategories = searchQuery
    ? categories.map((cat) => ({
        ...cat,
        skills: cat.skills.filter((s) => s.name.toLowerCase().includes(searchQuery.toLowerCase())),
      })).filter((cat) => cat.skills.length > 0 || cat.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : categories;

  const totalSkills = categories.reduce((sum, c) => sum + c.skills.length, 0);

  const icons = ['🎯', '💼', '🌐', '💻', '🛠️', '📊', '🏗️', '🎨', '📝', '🔬', '📱', '🔧', '⚡', '🏅'];

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
        ))}
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
            <input
              type="text"
              placeholder={t('skills_settings.search')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus"
            />
          </div>
          <Badge variant="brand">{totalSkills} skills in {categories.length} categories</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={handleExport} disabled={categories.length === 0}>
            <Download size={14} /> {t('skills_settings.export')}
          </Button>
          <Button onClick={openAddCat}><Plus size={16} /> {t('skills_settings.add_category')}</Button>
        </div>
      </div>

      {/* Category list */}
      {filteredCategories.length === 0 ? (
        <Card>
          <EmptyState
            icon="🎯"
            title={searchQuery ? 'No matching skills' : t('skills_settings.no_skills')}
            description={searchQuery ? 'Try a different search term' : t('skills_settings.no_skills_desc')}
            action={!searchQuery && <Button onClick={openAddCat}><Plus size={16} /> {t('skills_settings.add_category')}</Button>}
          />
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredCategories.map((cat) => (
            <Card key={cat.id} className="!p-0 overflow-hidden">
              {/* Category header */}
              <div
                className="flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-surface-50 transition-colors"
                onClick={() => toggle(cat.id)}
              >
                <span className="text-lg">{cat.icon}</span>
                <h3 className="font-semibold text-surface-900 flex-1">{cat.name}</h3>
                <Badge variant="brand" className="!text-[10px]">{cat.skills.length}</Badge>
                <div className="flex gap-1 ml-2">
                  <button onClick={(e) => { e.stopPropagation(); openEditCat(cat); }}
                    className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                    <Edit3 size={14} />
                  </button>
                  {isAdmin && (
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCat(cat); }}
                      className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                {expanded[cat.id] ? <ChevronDown size={16} className="text-surface-400" /> : <ChevronRight size={16} className="text-surface-400" />}
              </div>

              {/* Skills */}
              {expanded[cat.id] && (
                <div className="px-5 pb-4 border-t border-surface-100 pt-3">
                  <div className="flex flex-wrap gap-2 mb-3">
                    {cat.skills.map((skill) => (
                      <span
                        key={skill.id}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-surface-100 text-surface-700 group hover:bg-surface-200 transition-colors"
                      >
                        {skill.name}
                        {isAdmin && (
                          <button
                            onClick={() => handleDeleteSkill(skill.id)}
                            className="opacity-0 group-hover:opacity-100 text-surface-400 hover:text-red-500 transition-all"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {/* Inline add */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder={t('common.add') + '...'}
                      value={newSkillText[cat.id] || ''}
                      onChange={(e) => setNewSkillText((prev) => ({ ...prev, [cat.id]: e.target.value }))}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSkill(cat.id))}
                      className="flex-1 px-3 py-2 text-sm bg-surface-50 border border-surface-200 rounded-lg input-focus"
                    />
                    <Button size="sm" onClick={() => handleAddSkill(cat.id)}><Plus size={14} /> {t('common.add')}</Button>
                  </div>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Category Modal */}
      <Modal open={catModalOpen} onClose={() => setCatModalOpen(false)} title={editingCat ? t('skills_settings.edit_category') : t('skills_settings.create_category')} size="sm">
        <form onSubmit={handleSaveCat} className="space-y-4">
          <Input label={t('skills_settings.category_name')} required placeholder="e.g. Sales & Business Dev" value={catForm.name} onChange={(e) => setCatForm((p) => ({ ...p, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('skills_settings.icon')}</label>
              <div className="flex flex-wrap gap-1.5">
                {icons.map((icon) => (
                  <button key={icon} type="button" onClick={() => setCatForm((p) => ({ ...p, icon }))}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${catForm.icon === icon ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-surface-50 hover:bg-surface-100'}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('skills_settings.color')}</label>
              <input type="color" value={catForm.color} onChange={(e) => setCatForm((p) => ({ ...p, color: e.target.value }))} className="w-full h-10 rounded-xl border-0 cursor-pointer" />
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setCatModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={savingCat}>{editingCat ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
