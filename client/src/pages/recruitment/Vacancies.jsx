import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as vacanciesApi from '@api/vacanciesApi';
import * as applicationsApi from '@api/applicationsApi';
import * as deptApi from '@api/departmentsApi';
import * as jobTitlesApi from '@api/jobTitlesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, Edit3, Trash2, Users, FileText, Search, ChevronLeft, ChevronRight, Eye, Briefcase, Map, Globe, Copy } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const statusColors = {
  Draft: 'text-surface-500 bg-surface-100',
  Open: 'text-emerald-700 bg-emerald-50',
  Published: 'text-emerald-700 bg-emerald-50',
  'On Hold': 'text-amber-700 bg-amber-50',
  Paused: 'text-amber-700 bg-amber-50',
  Closed: 'text-red-700 bg-red-50',
  Archived: 'text-surface-500 bg-surface-100',
};
const EMPTY_FORM = {
  title: '', company_id: '', department_id: '', job_title_id: '',
  head_count: 1, status: 'Draft', description: '', requirements: '',
  work_location: '', employment_type: 'Full-time', workplace_type: 'Onsite', positions: 1,
  responsibilities: '', qualifications: '', required_skills: '', preferred_skills: '',
  benefits: '', application_deadline: '', show_salary: false, salary_min: '', salary_max: '',
};

export default function Vacancies() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);

  const [vacancies, setVacancies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [jobTitles, setJobTitles] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);

  useEffect(() => { loadVacancies(); }, [currentCompanyId, page, statusFilter]);

  const loadVacancies = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 15 };
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await vacanciesApi.getVacancies(params);
      setVacancies(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err) {
      toast.error('Failed to load vacancies');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { setPage(1); loadVacancies(); };

  // Load departments and job titles for forms
  const loadFormData = async (companyId) => {
    if (!companyId) return;
    try {
      const { data: depts } = await deptApi.getDepartments({ company_id: companyId });
      setDepartments(depts);
    } catch { /* ignore */ }
  };

  const loadJobTitlesForDept = async (deptId) => {
    if (!deptId) { setJobTitles([]); return; }
    try {
      const { data } = await jobTitlesApi.getJobTitles({ department_id: deptId });
      setJobTitles(data);
    } catch { /* ignore */ }
  };

  const openAdd = () => {
    setEditing(null);
    const defaultCompany = currentCompanyId || (companies.length > 0 ? String(companies[0].id) : '');
    setForm({ ...EMPTY_FORM, company_id: defaultCompany });
    setDepartments([]);
    setJobTitles([]);
    if (defaultCompany) loadFormData(defaultCompany);
    setModalOpen(true);
  };

  const openEdit = (vacancy) => {
    setEditing(vacancy);
    setForm({
      title: vacancy.title || '', company_id: String(vacancy.company_id) || '',
      department_id: vacancy.department_id ? String(vacancy.department_id) : '',
      job_title_id: vacancy.job_title_id ? String(vacancy.job_title_id) : '',
      head_count: vacancy.head_count || 1, status: vacancy.status || 'Draft',
      description: vacancy.description || '', requirements: vacancy.requirements || '',
      work_location: vacancy.work_location || '', employment_type: vacancy.employment_type || 'Full-time',
      workplace_type: vacancy.workplace_type || 'Onsite', positions: vacancy.positions || vacancy.head_count || 1,
      responsibilities: vacancy.responsibilities || '', qualifications: vacancy.qualifications || '',
      required_skills: vacancy.required_skills || '', preferred_skills: vacancy.preferred_skills || '',
      benefits: vacancy.benefits || '', application_deadline: vacancy.application_deadline ? String(vacancy.application_deadline).slice(0, 10) : '',
      show_salary: !!vacancy.show_salary, salary_min: vacancy.salary_min || '', salary_max: vacancy.salary_max || '',
    });
    if (vacancy.company_id) loadFormData(vacancy.company_id);
    if (vacancy.department_id) loadJobTitlesForDept(vacancy.department_id);
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.title || !form.company_id) { toast.error('Title and company are required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: parseInt(form.company_id),
        department_id: form.department_id ? parseInt(form.department_id) : null,
        job_title_id: form.job_title_id ? parseInt(form.job_title_id) : null,
        head_count: parseInt(form.head_count) || 1,
        positions: parseInt(form.positions) || 1,
        show_salary: form.show_salary ? 1 : 0,
        salary_min: form.salary_min === '' ? null : Number(form.salary_min),
        salary_max: form.salary_max === '' ? null : Number(form.salary_max),
        application_deadline: form.application_deadline || null,
      };
      if (editing) {
        await vacanciesApi.updateVacancy(editing.id, payload);
        toast.success('Vacancy updated');
      } else {
        await vacanciesApi.createVacancy(payload);
        toast.success('Vacancy created');
      }
      setModalOpen(false);
      loadVacancies();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vacancy) => {
    const result = await confirmDelete(`"${vacancy.title}"`);
    if (result.isConfirmed) {
      try {
        await vacanciesApi.deleteVacancy(vacancy.id);
        toast.success('Vacancy deleted');
        loadVacancies();
      } catch (err) {
        toast.error('Delete failed');
      }
    }
  };

  const handlePublish = async (v) => {
    try {
      const { data } = await applicationsApi.publishVacancy(v.id);
      const link = `${window.location.origin}/careers/${data.public_slug}`;
      try { await navigator.clipboard.writeText(link); } catch { /* ignore */ }
      toast.success('Published — public link copied to clipboard');
      loadVacancies();
    } catch (err) {
      const miss = err.response?.data?.missing;
      toast.error(miss ? `Complete required fields: ${miss.join(', ')}` : (err.response?.data?.error || 'Publish failed'));
    }
  };
  const copyLink = async (v) => {
    if (!v.public_slug) return;
    const link = `${window.location.origin}/careers/${v.public_slug}`;
    try { await navigator.clipboard.writeText(link); toast.success('Public link copied'); }
    catch { window.prompt('Public link:', link); }
  };

  const update = (field, value) => {
    setForm(p => ({ ...p, [field]: value }));
    if (field === 'company_id') { loadFormData(value); setForm(p => ({ ...p, department_id: '', job_title_id: '' })); }
    if (field === 'department_id') { loadJobTitlesForDept(value); setForm(p => ({ ...p, job_title_id: '' })); }
    // Hiring Blueprint: auto-fill from job title
    if (field === 'job_title_id' && value) {
      const jt = jobTitles.find(j => String(j.id) === value);
      if (jt) {
        setForm(p => ({
          ...p,
          job_title_id: value,
          title: p.title || jt.title,
          description: p.description || (jt.description || `Position: ${jt.title}`),
          requirements: p.requirements || (jt.requirements || ''),
        }));
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('recruitment.vacancies')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('recruitment.vacancies_subtitle')}</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> {t('recruitment.add_vacancy')}</Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            placeholder={t('recruitment.search_vacancies')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus"
          />
        </div>
        <div className="flex gap-1">
          {[{v: '', l: t('recruitment.all_statuses')}, {v: 'Draft', l: t('recruitment.draft')}, {v: 'Open', l: t('recruitment.open')}, {v: 'On Hold', l: t('recruitment.on_hold')}, {v: 'Closed', l: t('recruitment.closed')}].map(s => (
            <button
              key={s.v}
              onClick={() => { setStatusFilter(s.v); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s.v ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}
            >
              {s.l}
            </button>
          ))}
        </div>
        <Badge variant="brand">{total} {t('recruitment.total')}</Badge>
      </div>

      {/* Table */}
      {loading ? (
        <Card className="!p-6 animate-pulse">
          <div className="h-4 bg-surface-200 rounded w-1/2 mb-4" />
          <div className="h-4 bg-surface-100 rounded w-1/3 mb-3" />
          <div className="h-4 bg-surface-100 rounded w-2/3" />
        </Card>
      ) : vacancies.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-6 h-6 text-surface-400" />}
            title={search || statusFilter ? t('recruitment.no_matching_vacancies') : t('recruitment.no_vacancies')}
            description={t('recruitment.create_first_vacancy')}
            action={!search && !statusFilter && <Button onClick={openAdd}><Plus size={16} /> {t('recruitment.create_vacancy')}</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50/60">
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.title')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.company')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.department')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.status')}</th>
                    <th className="text-center px-5 py-3 font-medium text-surface-500">{t('recruitment.hc')}</th>
                    <th className="text-center px-5 py-3 font-medium text-surface-500">{t('recruitment.candidates_count')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.created')}</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-500">{t('recruitment.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {vacancies.map((v) => (
                    <tr key={v.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Briefcase size={14} className="text-brand-500" />
                          <span className="font-medium text-surface-800">{v.title}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="px-2 py-0.5 rounded-md text-xs font-medium text-white"
                          style={{ backgroundColor: v.color_primary || '#6D28D9' }}
                        >
                          {v.short_code}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-surface-600">{v.department_name || '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${statusColors[v.status] || ''}`}>
                          {t(`recruitment.${v.status.toLowerCase().replace(' ', '_')}`)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center text-surface-600">{v.head_count}</td>
                      <td className="px-5 py-3 text-center">
                        <Badge variant={v.candidate_count > 0 ? 'brand' : 'info'} className="text-[10px]">
                          {v.candidate_count}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-surface-400 text-xs">{dayjs(v.created_at).format('MMM D, YYYY')}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {v.status !== 'Published' && (
                            <button onClick={() => handlePublish(v)} title="Publish public job page" className="p-1.5 text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                              <Globe size={14} />
                            </button>
                          )}
                          {v.public_slug && (
                            <>
                              <button onClick={() => copyLink(v)} title="Copy public link" className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                <Copy size={14} />
                              </button>
                              <a href={`/careers/${v.public_slug}`} target="_blank" rel="noreferrer" title="Open public page" className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                <Eye size={14} />
                              </a>
                            </>
                          )}
                          <button onClick={() => openEdit(v)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDelete(v)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-400">
                {t('recruitment.showing')} {(page - 1) * 15 + 1}–{Math.min(page * 15, total)} {t('recruitment.of')} {total}
              </p>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                  <ChevronLeft size={14} /> {t('recruitment.prev')}
                </Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                  {t('recruitment.next')} <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('recruitment.edit_vacancy') : t('recruitment.create_vacancy')} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          <Input label={t('recruitment.job_title')} required placeholder={t('recruitment.title_placeholder', 'e.g. Senior Sales Executive')} value={form.title} onChange={(e) => update('title', e.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('recruitment.company')} required
              value={form.company_id}
              onChange={(e) => update('company_id', e.target.value)}
              options={companies.map(c => ({ value: String(c.id), label: `${c.name} (${c.short_code})` }))}
              placeholder={t('recruitment.select_company')}
            />
            <Select
              label={t('recruitment.department')}
              value={form.department_id}
              onChange={(e) => update('department_id', e.target.value)}
              options={departments.map(d => ({ value: String(d.id), label: d.name }))}
              placeholder={t('recruitment.select_department')}
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Select
              label={t('recruitment.job_title_db')}
              value={form.job_title_id}
              onChange={(e) => update('job_title_id', e.target.value)}
              options={jobTitles.map(jt => ({ value: String(jt.id), label: jt.title }))}
              placeholder={t('recruitment.optional')}
            />
            <Input label={t('recruitment.head_count')} type="number" min="1" value={form.head_count} onChange={(e) => update('head_count', e.target.value)} />
            <Select
              label={t('recruitment.status')}
              value={form.status}
              onChange={(e) => update('status', e.target.value)}
              options={['Draft', 'Published', 'Paused', 'Closed', 'Archived'].map(s => ({ value: s, label: s }))}
            />
          </div>

          {/* Public job-page details (required to publish) */}
          <div className="rounded-xl border border-surface-100 bg-surface-50/40 p-3 space-y-3">
            <p className="text-xs font-semibold text-surface-500 uppercase tracking-wide">Public job page details</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label="Work location *" value={form.work_location} onChange={(e) => update('work_location', e.target.value)} />
              <Select label="Employment type *" value={form.employment_type} onChange={(e) => update('employment_type', e.target.value)}
                options={['Full-time', 'Part-time', 'Contract', 'Temporary', 'Internship'].map(s => ({ value: s, label: s }))} />
              <Select label="Workplace type *" value={form.workplace_type} onChange={(e) => update('workplace_type', e.target.value)}
                options={['Onsite', 'Hybrid', 'Remote'].map(s => ({ value: s, label: s }))} />
            </div>
            {[['responsibilities', 'Key responsibilities'], ['qualifications', 'Requirements & qualifications'], ['required_skills', 'Required skills'], ['preferred_skills', 'Preferred skills'], ['benefits', 'Benefits']].map(([k, label]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-surface-600 mb-1">{label}</label>
                <textarea value={form[k]} onChange={(e) => update(k, e.target.value)} rows={2} className="w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-xl resize-none" />
              </div>
            ))}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              <Input label="Application deadline" type="date" value={form.application_deadline} onChange={(e) => update('application_deadline', e.target.value)} />
              <Input label="Salary min" type="number" value={form.salary_min} onChange={(e) => update('salary_min', e.target.value)} />
              <Input label="Salary max" type="number" value={form.salary_max} onChange={(e) => update('salary_max', e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm text-surface-600"><input type="checkbox" checked={form.show_salary} onChange={(e) => update('show_salary', e.target.checked)} /> Show salary range on the public page</label>
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('recruitment.description')}</label>
            <textarea placeholder={t('recruitment.desc_placeholder', 'Job description...')} value={form.description} onChange={(e) => update('description', e.target.value)} rows={3}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('recruitment.requirements')}</label>
            <textarea placeholder={t('recruitment.req_placeholder', 'Requirements & qualifications...')} value={form.requirements} onChange={(e) => update('requirements', e.target.value)} rows={3}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('recruitment.save_changes') : t('recruitment.create_vacancy')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
