import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchCompanies } from '@store/slices/companiesSlice';
import * as deptApi from '@api/departmentsApi';
import * as jobTitlesApi from '@api/jobTitlesApi';
import * as skillsApi from '@api/skillsApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, Edit3, Trash2, Users, Briefcase, ChevronRight, DollarSign, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function DepartmentSettings() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { items: companies } = useSelector((s) => s.companies);
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin'; // delete is admin-only
  const [selectedCompany, setSelectedCompany] = useState('');
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', head_count_limit: '', icon: '📁', status: 'Active' });

  // Job Titles state
  const [selectedDept, setSelectedDept] = useState(null);
  const [jobTitles, setJobTitles] = useState([]);
  const [jobLoading, setJobLoading] = useState(false);
  const [jobModalOpen, setJobModalOpen] = useState(false);
  const [editingJob, setEditingJob] = useState(null);
  const [savingJob, setSavingJob] = useState(false);
  const [allSkills, setAllSkills] = useState([]);
  const [jobForm, setJobForm] = useState({
    title: '', description: '', status: 'Active',
    seniorities: [{ level: '', salary_min: '', salary_max: '' }],
    required_skills: [],
  });

  useEffect(() => { dispatch(fetchCompanies()); }, [dispatch]);
  useEffect(() => { if (companies.length > 0 && !selectedCompany) setSelectedCompany(String(companies[0].id)); }, [companies, selectedCompany]);

  useEffect(() => {
    if (selectedCompany) {
      loadDepartments();
      loadSkills();
    }
  }, [selectedCompany]);

  const loadDepartments = async () => {
    setLoading(true);
    try {
      const { data } = await deptApi.getDepartments({ company_id: selectedCompany });
      setDepartments(data);
    } catch (err) {
      toast.error(t('toasts.t_failed_to_load_departments'));
    } finally {
      setLoading(false);
    }
  };

  const loadSkills = async () => {
    try {
      const { data } = await skillsApi.getSkillsFlat();
      setAllSkills(data);
    } catch { /* ignore */ }
  };

  const loadJobTitles = async (deptId) => {
    setJobLoading(true);
    try {
      const { data } = await jobTitlesApi.getJobTitles({ department_id: deptId, company_id: selectedCompany });
      setJobTitles(data);
    } catch (err) {
      toast.error(t('toasts.t_failed_to_load_job_titles'));
    } finally {
      setJobLoading(false);
    }
  };

  // ========= Department CRUD =========
  const openAdd = () => {
    setEditing(null);
    setForm({ name: '', description: '', head_count_limit: '', icon: '📁', status: 'Active' });
    setModalOpen(true);
  };

  const openEdit = (dept) => {
    setEditing(dept);
    setForm({
      name: dept.name || '', description: dept.description || '',
      head_count_limit: dept.head_count_limit || '', icon: dept.icon || '📁',
      status: dept.status || 'Active',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name) { toast.error(t('toasts.t_department_name_is_required')); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: parseInt(selectedCompany),
        head_count_limit: form.head_count_limit ? parseInt(form.head_count_limit) : null,
      };
      if (editing) {
        await deptApi.updateDepartment(editing.id, payload);
        toast.success(t('toasts.t_department_updated'));
      } else {
        await deptApi.createDepartment(payload);
        toast.success(t('toasts.t_department_created'));
      }
      setModalOpen(false);
      loadDepartments();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (dept) => {
    const result = await confirmDelete(`"${dept.name}"`);
    if (result.isConfirmed) {
      try {
        await deptApi.deleteDepartment(dept.id);
        toast.success(t('toasts.t_department_deleted'));
        if (selectedDept?.id === dept.id) { setSelectedDept(null); setJobTitles([]); }
        loadDepartments();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Delete failed — check for linked job titles');
      }
    }
  };

  const selectDept = (dept) => {
    setSelectedDept(dept);
    loadJobTitles(dept.id);
  };

  // ========= Job Title CRUD =========
  const openAddJob = () => {
    setEditingJob(null);
    setJobForm({
      title: '', description: '', status: 'Active',
      seniorities: [{ level: '', salary_min: '', salary_max: '' }],
      required_skills: [],
    });
    setJobModalOpen(true);
  };

  const openEditJob = (job) => {
    setEditingJob(job);
    setJobForm({
      title: job.title || '', description: job.description || '', status: job.status || 'Active',
      seniorities: job.seniorities?.length ? job.seniorities.map(s => ({
        level: s.level, salary_min: s.salary_min || '', salary_max: s.salary_max || '',
      })) : [{ level: '', salary_min: '', salary_max: '' }],
      required_skills: job.required_skills || [],
    });
    setJobModalOpen(true);
  };

  const handleSaveJob = async (e) => {
    e.preventDefault();
    if (!jobForm.title) { toast.error(t('toasts.t_job_title_is_required')); return; }
    setSavingJob(true);
    try {
      const payload = {
        ...jobForm,
        department_id: selectedDept.id,
        company_id: parseInt(selectedCompany),
        seniorities: jobForm.seniorities.filter(s => s.level),
      };
      if (editingJob) {
        await jobTitlesApi.updateJobTitle(editingJob.id, payload);
        toast.success(t('toasts.t_job_title_updated'));
      } else {
        await jobTitlesApi.createJobTitle(payload);
        toast.success(t('toasts.t_job_title_created'));
      }
      setJobModalOpen(false);
      loadJobTitles(selectedDept.id);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    } finally {
      setSavingJob(false);
    }
  };

  const handleDeleteJob = async (job) => {
    const result = await confirmDelete(`"${job.title}"`);
    if (result.isConfirmed) {
      try {
        await jobTitlesApi.deleteJobTitle(job.id);
        toast.success(t('toasts.t_job_title_deleted'));
        loadJobTitles(selectedDept.id);
      } catch (err) {
        toast.error(err.response?.data?.error || 'Delete failed');
      }
    }
  };

  const addSeniority = () => {
    setJobForm(prev => ({ ...prev, seniorities: [...prev.seniorities, { level: '', salary_min: '', salary_max: '' }] }));
  };

  const removeSeniority = (index) => {
    setJobForm(prev => ({ ...prev, seniorities: prev.seniorities.filter((_, i) => i !== index) }));
  };

  const updateSeniority = (index, field, value) => {
    setJobForm(prev => ({
      ...prev,
      seniorities: prev.seniorities.map((s, i) => i === index ? { ...s, [field]: value } : s),
    }));
  };

  const toggleSkill = (skillId) => {
    setJobForm(prev => ({
      ...prev,
      required_skills: prev.required_skills.includes(skillId)
        ? prev.required_skills.filter(id => id !== skillId)
        : [...prev.required_skills, skillId],
    }));
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));
  const selectedCompanyData = companies.find((c) => c.id === parseInt(selectedCompany));

  const icons = ['📁', '💼', '📊', '🛒', '💻', '🏗️', '📞', '⚙️', '💰', '📋', '🎯', '🔧', '🎨', '📈'];

  return (
    <>
      {/* Company Filter + Add Button */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Select
            value={selectedCompany}
            onChange={(e) => { setSelectedCompany(e.target.value); setSelectedDept(null); setJobTitles([]); }}
            options={companies.map((c) => ({ value: String(c.id), label: `${c.name} (${c.short_code})` }))}
            placeholder="Select company..."
            className="!w-56"
          />
          {selectedCompanyData && (
            <Badge variant="brand">{departments.length} {t('dept_settings.departments').toLowerCase()}</Badge>
          )}
        </div>
        <Button onClick={openAdd} disabled={!selectedCompany}><Plus size={16} /> {t('dept_settings.add_dept')}</Button>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Left: Departments */}
        <div className="lg:col-span-2 space-y-2">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider px-1 mb-2">{t('dept_settings.departments')}</p>
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="card p-4 animate-pulse flex items-center gap-4">
                  <div className="w-10 h-10 bg-surface-200 rounded-xl" />
                  <div className="flex-1"><div className="h-4 bg-surface-200 rounded w-1/3 mb-2" /><div className="h-3 bg-surface-100 rounded w-1/4" /></div>
                </div>
              ))}
            </div>
          ) : departments.length === 0 ? (
            <Card>
              <EmptyState
                icon="📁"
                title={t('dept_settings.no_dept')}
                description={selectedCompany ? t('dept_settings.no_dept_desc') : t('dept_settings.select_dept')}
                action={selectedCompany && <Button onClick={openAdd}><Plus size={16} /> {t('dept_settings.add_dept')}</Button>}
              />
            </Card>
          ) : (
            departments.map((dept) => (
              <Card
                key={dept.id}
                className={`!p-3.5 flex items-center gap-3 group cursor-pointer transition-all ${selectedDept?.id === dept.id ? '!border-brand-300 !bg-brand-50/40 ring-1 ring-brand-200' : 'hover:!border-surface-200'}`}
                onClick={() => selectDept(dept)}
              >
                <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center text-base shrink-0">
                  {dept.icon || '📁'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-surface-900 text-sm">{dept.name}</h3>
                    <Badge variant={dept.status === 'Active' ? 'active' : 'inactive'} className="text-[10px]">
                      {dept.status}
                    </Badge>
                  </div>
                  {dept.description && <p className="text-xs text-surface-400 truncate mt-0.5">{dept.description}</p>}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); openEdit(dept); }} title={t('common.edit')}>
                    <Edit3 size={13} />
                  </Button>
                  {isAdmin && (
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleDelete(dept); }} className="text-red-500 hover:!bg-red-50" title={t('common.delete')}>
                      <Trash2 size={13} />
                    </Button>
                  )}
                </div>
                <ChevronRight size={14} className={`text-surface-300 transition-colors ${selectedDept?.id === dept.id ? 'text-brand-500' : ''}`} />
              </Card>
            ))
          )}
        </div>

        {/* Right: Job Titles */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider px-1">
              {selectedDept ? `${t('dept_settings.job_titles')} — ${selectedDept.name}` : t('dept_settings.job_titles')}
            </p>
            {selectedDept && (
              <Button size="sm" onClick={openAddJob}><Plus size={14} /> {t('dept_settings.add_job')}</Button>
            )}
          </div>

          {!selectedDept ? (
            <Card className="min-h-[200px]">
              <EmptyState
                icon="👈"
                title={t('dept_settings.select_dept')}
                description={t('dept_settings.select_dept_desc')}
              />
            </Card>
          ) : jobLoading ? (
            <div className="space-y-2">
              {[1, 2].map(i => (
                <div key={i} className="card p-4 animate-pulse">
                  <div className="h-4 bg-surface-200 rounded w-1/3 mb-3" />
                  <div className="h-3 bg-surface-100 rounded w-2/3" />
                </div>
              ))}
            </div>
          ) : jobTitles.length === 0 ? (
            <Card className="min-h-[200px]">
              <EmptyState
                icon={<Briefcase className="w-6 h-6 text-surface-400" />}
                title={t('dept_settings.no_jobs')}
                description={`${t('dept_settings.no_jobs_desc')} "${selectedDept.name}"`}
                action={<Button onClick={openAddJob}><Plus size={16} /> {t('dept_settings.add_job')}</Button>}
              />
            </Card>
          ) : (
            <div className="space-y-2">
              {jobTitles.map((job) => (
                <Card key={job.id} className="!p-4 group">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-indigo-50 rounded-xl flex items-center justify-center shrink-0 mt-0.5">
                        <Briefcase size={16} className="text-indigo-600" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-surface-900">{job.title}</h4>
                          <Badge variant={job.status === 'Active' ? 'active' : 'inactive'} className="text-[10px]">{job.status}</Badge>
                        </div>
                        {job.description && <p className="text-xs text-surface-400 mt-0.5">{job.description}</p>}
                        
                        {/* Seniority levels */}
                        {job.seniorities?.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {job.seniorities.map((s) => (
                              <span key={s.id} className="inline-flex items-center gap-1 px-2 py-1 bg-surface-100 rounded-lg text-xs text-surface-600">
                                <DollarSign size={10} />
                                {s.level}
                                {s.salary_min && s.salary_max ? `: ${Number(s.salary_min).toLocaleString()}–${Number(s.salary_max).toLocaleString()}` : ''}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" onClick={() => openEditJob(job)} title={t('common.edit')}>
                        <Edit3 size={14} />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => handleDeleteJob(job)} className="text-red-500 hover:!bg-red-50" title={t('common.delete')}>
                          <Trash2 size={14} />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Department Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('dept_settings.edit_dept') : t('dept_settings.create_dept')} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t('dept_settings.dept_name')} required placeholder="e.g. Sales" value={form.name} onChange={(e) => update('name', e.target.value)} />
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('dept_settings.description')}</label>
            <textarea placeholder="..." value={form.description} onChange={(e) => update('description', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('dept_settings.head_count_limit')} type="number" placeholder={t('common.optional') || 'Optional'} value={form.head_count_limit} onChange={(e) => update('head_count_limit', e.target.value)} />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-surface-700">{t('dept_settings.icon')}</label>
              <div className="flex flex-wrap gap-1.5">
                {icons.map((icon) => (
                  <button key={icon} type="button" onClick={() => update('icon', icon)}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all ${form.icon === icon ? 'bg-brand-100 ring-2 ring-brand-500' : 'bg-surface-50 hover:bg-surface-100'}`}>
                    {icon}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>

      {/* Job Title Modal */}
      <Modal open={jobModalOpen} onClose={() => setJobModalOpen(false)} title={editingJob ? t('dept_settings.edit_job') : t('dept_settings.create_job')} size="lg">
        <form onSubmit={handleSaveJob} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label={t('dept_settings.job_title')} required placeholder="e.g. Sales Executive" value={jobForm.title} onChange={(e) => setJobForm(p => ({ ...p, title: e.target.value }))} />
            <Select
              label={t('dept_settings.status')}
              value={jobForm.status}
              onChange={(e) => setJobForm(p => ({ ...p, status: e.target.value }))}
              options={['Active', 'Inactive']}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('dept_settings.description')}</label>
            <textarea placeholder="..." value={jobForm.description} onChange={(e) => setJobForm(p => ({ ...p, description: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>

          {/* Seniority Levels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-surface-700">{t('dept_settings.seniority_levels')}</label>
              <button type="button" onClick={addSeniority} className="text-xs text-brand-600 hover:text-brand-700 font-medium">+ {t('dept_settings.add_level')}</button>
            </div>
            <div className="space-y-2">
              {jobForm.seniorities.map((s, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 bg-surface-50 rounded-xl">
                  <input
                    type="text"
                    placeholder={t('dept_settings.level_placeholder') || "Level (e.g. Junior, Senior)"}
                    value={s.level}
                    onChange={(e) => updateSeniority(i, 'level', e.target.value)}
                    className="flex-1 px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg input-focus"
                  />
                  <input
                    type="number"
                    placeholder={t('dept_settings.min_salary') || "Min Salary"}
                    value={s.salary_min}
                    onChange={(e) => updateSeniority(i, 'salary_min', e.target.value)}
                    className="w-28 px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg input-focus"
                  />
                  <span className="text-surface-400 text-xs">–</span>
                  <input
                    type="number"
                    placeholder={t('dept_settings.max_salary') || "Max Salary"}
                    value={s.salary_max}
                    onChange={(e) => updateSeniority(i, 'salary_max', e.target.value)}
                    className="w-28 px-3 py-2 text-sm bg-white border border-surface-200 rounded-lg input-focus"
                  />
                  {jobForm.seniorities.length > 1 && (
                    <button type="button" onClick={() => removeSeniority(i)} className="p-1.5 text-surface-400 hover:text-red-500 transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Required Skills */}
          {allSkills.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-2">{t('dept_settings.required_skills')}</label>
              <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-surface-50 rounded-xl">
                {allSkills.map((skill) => (
                  <button
                    key={skill.id}
                    type="button"
                    onClick={() => toggleSkill(skill.id)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      jobForm.required_skills.includes(skill.id)
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-surface-600 border border-surface-200 hover:border-brand-300'
                    }`}
                  >
                    {skill.name}
                  </button>
                ))}
              </div>
              {jobForm.required_skills.length > 0 && (
                <p className="text-xs text-surface-400 mt-1">{jobForm.required_skills.length} {t('dept_settings.skills_selected')}</p>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setJobModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={savingJob}>{editingJob ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
