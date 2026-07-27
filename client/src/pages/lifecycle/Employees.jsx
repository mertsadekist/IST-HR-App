import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import { Users, Plus, Mail, Phone, Building2, Briefcase, FileText, Upload, Download, Calendar, DollarSign, Globe, Loader2, Pencil, X, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@api/axios';
import * as employeesApi from '@api/employeesApi';
import * as departmentsApi from '@api/departmentsApi';
import EmployeeOnboardingWizard from './components/EmployeeOnboardingWizard';
import Modal from '@components/ui/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

export default function Employees() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { items: companies } = useSelector((s) => s.companies);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  // Detail & Documents tab states
  const [selectedEmp, setSelectedEmp] = useState(null);
  const [activeTab, setActiveTab] = useState('profile'); // 'profile' | 'documents'
  const [empDocs, setEmpDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState('General');
  const [uploading, setUploading] = useState(false);
  const [attId, setAttId] = useState('');
  const [savingAtt, setSavingAtt] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [newLoginCreds, setNewLoginCreds] = useState(null);

  // Official mail domains of the employee's own company (not the selected entity).
  const companyDomains = useMemo(() => {
    const co = companies.find((c) => c.id === selectedEmp?.company_id);
    return String(co?.email_domains || '').split(',').map((d) => d.trim()).filter(Boolean);
  }, [companies, selectedEmp]);

  useEffect(() => {
    loadEmployees();
  }, [currentCompanyId]);

  const loadEmployees = async () => {
    setLoading(true);
    try {
      const url = currentCompanyId ? `/employees?company_id=${currentCompanyId}` : '/employees';
      const { data } = await api.get(url);
      setEmployees(data.data || data); // handle standard pagination response or flat array
    } catch (err) {
      toast.error(t('toasts.t_failed_to_load_employees'));
    } finally {
      setLoading(false);
    }
  };

  const handleWizardComplete = () => {
    setWizardOpen(false);
    loadEmployees();
    toast.success(t('toasts.t_employee_successfully_onboarded'));
  };

  const handleOpenProfile = async (emp) => {
    setSelectedEmp(emp);
    setAttId(emp.attendance_id || '');
    setActiveTab('profile');
    setEditMode(false);
    setNewLoginCreds(null);
    setEmpDocs([]);
    setDocsLoading(true);
    try {
      const { data } = await employeesApi.getEmployeeDocuments(emp.id);
      setEmpDocs(data || []);
    } catch (err) {
      console.error('Failed to load documents', err);
    } finally {
      setDocsLoading(false);
    }
  };

  const startEditProfile = async () => {
    setEditForm({
      first_name: selectedEmp.first_name || '', last_name: selectedEmp.last_name || '',
      email: selectedEmp.email || '', phone: selectedEmp.phone || '', nationality: selectedEmp.nationality || '',
      department_id: selectedEmp.department_id ? String(selectedEmp.department_id) : '',
      job_title_text: selectedEmp.job_title_text || selectedEmp.job_title_name || '',
      basic_salary: selectedEmp.basic_salary ?? '', full_salary: selectedEmp.full_salary ?? '',
      start_date: selectedEmp.start_date ? dayjs(selectedEmp.start_date).format('YYYY-MM-DD') : '',
      status: selectedEmp.status || 'Active',
      labour_contract_status: selectedEmp.labour_contract_status || 'Not Issued',
    });
    try {
      const { data } = await departmentsApi.getDepartments({ company_id: selectedEmp.company_id });
      setDepartments(data.data || data || []);
    } catch { /* ignore */ }
    setEditMode(true);
  };

  const saveProfile = async () => {
    if (!editForm.first_name || !editForm.last_name) {
      toast.error(t('employees.first_last_required', 'First and last name are required'));
      return;
    }
    setSavingProfile(true);
    try {
      const patch = {
        ...editForm,
        department_id: editForm.department_id ? Number(editForm.department_id) : null,
        basic_salary: editForm.basic_salary === '' ? null : Number(editForm.basic_salary),
        full_salary: editForm.full_salary === '' ? null : Number(editForm.full_salary),
        start_date: editForm.start_date || null,
      };
      await employeesApi.updateEmployee(selectedEmp.id, patch);
      const { data } = await employeesApi.getEmployee(selectedEmp.id);
      setSelectedEmp(data);
      setEmployees((list) => list.map((e) => (e.id === selectedEmp.id ? { ...e, ...data } : e)));
      setEditMode(false);
      toast.success(t('employees.profile_saved', 'Employee details saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('employees.profile_save_failed', 'Failed to save employee details'));
    } finally {
      setSavingProfile(false);
    }
  };

  const createLogin = async () => {
    setCreatingLogin(true);
    try {
      const { data } = await employeesApi.createEmployeeLogin(selectedEmp.id);
      setNewLoginCreds({ username: data.username, password: data.password });
      setSelectedEmp((p) => ({ ...p, user_id: data.user_id, username: data.username }));
      setEmployees((list) => list.map((e) => (e.id === selectedEmp.id ? { ...e, user_id: data.user_id } : e)));
      toast.success(t('employees.login_created', 'Login account created'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('employees.login_create_failed', 'Failed to create login'));
    } finally {
      setCreatingLogin(false);
    }
  };

  const handleDocUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('category', uploadCategory);

    const toastId = toast.loading(t('toasts.t_uploading_document'));
    try {
      await employeesApi.uploadEmployeeDocument(selectedEmp.id, formData);
      toast.update(toastId, { render: 'Document uploaded successfully!', type: 'success', isLoading: false, autoClose: 3000 });
      // Reload documents
      const { data } = await employeesApi.getEmployeeDocuments(selectedEmp.id);
      setEmpDocs(data || []);
    } catch (err) {
      console.error(err);
      toast.update(toastId, { render: 'Failed to upload document', type: 'error', isLoading: false, autoClose: 3000 });
    } finally {
      setUploading(false);
    }
  };

  const saveAttendanceId = async () => {
    setSavingAtt(true);
    try {
      await employeesApi.updateEmployee(selectedEmp.id, { attendance_id: attId || null });
      setSelectedEmp((p) => ({ ...p, attendance_id: attId }));
      setEmployees((list) => list.map((e) => (e.id === selectedEmp.id ? { ...e, attendance_id: attId } : e)));
      toast.success(t('employees.attendance_id_saved', 'Attendance ID saved'));
    } catch {
      toast.error(t('employees.attendance_id_save_failed', 'Failed to save Attendance ID'));
    } finally {
      setSavingAtt(false);
    }
  };

  const handleDocDownload = async (doc) => {
    try {
      const res = await employeesApi.downloadEmployeeDocument(selectedEmp.id, doc.id);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch {
      toast.error(t('toasts.t_failed_to_download_document'));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Users className="text-brand-600" />
            {t('employees.title', 'Employees Hub')}
          </h1>
          <p className="text-surface-500 mt-1">{t('employees.subtitle', 'Manage company staff and complete full onboarding setup.')}</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="shrink-0 group shadow-lg shadow-brand-500/20">
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          {t('employees.add_employee', 'Add Employee')}
        </Button>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-surface-50 text-surface-500 border-b border-surface-200">
                <th className="p-4 font-semibold">Employee</th>
                <th className="p-4 font-semibold">Contact</th>
                <th className="p-4 font-semibold">Role & Department</th>
                <th className="p-4 font-semibold">Status</th>
                <th className="p-4 font-semibold">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-surface-500">Loading...</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-surface-500">No employees found.</td></tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id} onClick={() => handleOpenProfile(emp)} className="hover:bg-surface-50/50 transition-colors cursor-pointer">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center font-bold">
                          {emp.first_name[0]}{emp.last_name[0]}
                        </div>
                        <div>
                          <div className="font-semibold text-surface-900">{emp.first_name} {emp.last_name}</div>
                          <div className="text-xs text-surface-500">{emp.company_name || 'No Company'}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-surface-600"><Mail size={14}/> {emp.email}</div>
                      <div className="flex items-center gap-2 text-surface-500 mt-1"><Phone size={14}/> {emp.phone || 'N/A'}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-surface-800"><Briefcase size={14} className="text-brand-500"/> {emp.job_title_text || emp.job_title_name}</div>
                      <div className="flex items-center gap-2 text-surface-500 mt-1"><Building2 size={14}/> {emp.department_name}</div>
                    </td>
                    <td className="p-4">
                      <Badge variant={emp.status === 'Active' ? 'success' : 'neutral'}>{emp.status}</Badge>
                    </td>
                    <td className="p-4 text-surface-600">
                      {emp.start_date ? dayjs(emp.start_date).format('MMM D, YYYY') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {wizardOpen && (
        <EmployeeOnboardingWizard 
          open={wizardOpen} 
          onClose={() => setWizardOpen(false)} 
          onComplete={handleWizardComplete} 
        />
      )}

      {selectedEmp && (
        <Modal
          open={!!selectedEmp}
          onClose={() => setSelectedEmp(null)}
          title={`${selectedEmp.first_name} ${selectedEmp.last_name}`}
          size="lg"
        >
          <div className="space-y-4">
            {/* Tabs Selector */}
            <div className="flex border-b border-surface-200">
              <button
                onClick={() => setActiveTab('profile')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'profile'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-surface-500 hover:text-surface-700'
                }`}
              >
                {t('employees.profile_tab', 'Profile Details / تفاصيل الملف الشخصي')}
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'documents'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-surface-500 hover:text-surface-700'
                }`}
              >
                {t('employees.documents_tab', 'Documents / المستندات')}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' ? (
              <div className="space-y-3">
                <div className="flex justify-end">
                  {editMode ? (
                    <div className="flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}><X size={14} /> {t('common.cancel', 'Cancel')}</Button>
                      <Button size="sm" onClick={saveProfile} loading={savingProfile}>{t('common.save', 'Save')}</Button>
                    </div>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={startEditProfile}><Pencil size={14} /> {t('common.edit', 'Edit')}</Button>
                  )}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 bg-surface-50 p-4 rounded-xl border border-surface-200">
                  <h3 className="font-bold text-surface-900 text-sm border-b pb-1.5 flex items-center gap-1.5">
                    <Users size={16} className="text-brand-600" />
                    Personal Info / معلومات شخصية
                  </h3>
                  {editMode ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editForm.first_name} onChange={(e) => setEditForm(f => ({ ...f, first_name: e.target.value }))} placeholder={t('recruitment.first_name', 'First name')} className="text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                        <input value={editForm.last_name} onChange={(e) => setEditForm(f => ({ ...f, last_name: e.target.value }))} placeholder={t('recruitment.last_name', 'Last name')} className="text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                      </div>
                      <EmailBuilder
                        value={editForm.email}
                        onChange={(v) => setEditForm(f => ({ ...f, email: v }))}
                        companyDomains={companyDomains}
                        contracted={editForm.labour_contract_status === 'Issued'}
                        t={t}
                      />
                      <input value={editForm.phone} onChange={(e) => setEditForm(f => ({ ...f, phone: e.target.value }))} placeholder={t('recruitment.phone', 'Phone')} className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                      <input value={editForm.nationality} onChange={(e) => setEditForm(f => ({ ...f, nationality: e.target.value }))} placeholder={t('recruitment.nationality', 'Nationality')} className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                    </div>
                  ) : (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-surface-500">Name:</span> <span className="font-semibold text-surface-800">{selectedEmp.first_name} {selectedEmp.last_name}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Email:</span> <span className="font-semibold text-surface-800">{selectedEmp.email || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Phone:</span> <span className="font-semibold text-surface-800">{selectedEmp.phone || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Nationality:</span> <span className="font-semibold text-surface-800">{selectedEmp.nationality || 'N/A'}</span></div>
                  </div>
                  )}
                </div>

                <div className="space-y-3 bg-surface-50 p-4 rounded-xl border border-surface-200">
                  <h3 className="font-bold text-surface-900 text-sm border-b pb-1.5 flex items-center gap-1.5">
                    <Briefcase size={16} className="text-brand-600" />
                    Employment Details / تفاصيل العمل
                  </h3>
                  {editMode ? (
                    <div className="space-y-2">
                      <div className="flex justify-between items-center text-xs"><span className="text-surface-500">Company:</span> <span className="font-semibold text-surface-800">{selectedEmp.company_name || 'N/A'}</span></div>
                      <select value={editForm.department_id} onChange={(e) => setEditForm(f => ({ ...f, department_id: e.target.value }))} className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5">
                        <option value="">{t('employees.no_department', 'No department')}</option>
                        {departments.map(d => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                      </select>
                      <input value={editForm.job_title_text} onChange={(e) => setEditForm(f => ({ ...f, job_title_text: e.target.value }))} placeholder={t('employees.job_title', 'Job title')} className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                      <select value={editForm.status} onChange={(e) => setEditForm(f => ({ ...f, status: e.target.value }))} className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5">
                        {['Onboarding', 'Active', 'Offboarding', 'Exited'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                      <div>
                        <label className="block text-surface-500 text-[10px] mb-0.5">{t('employees.labour_contract_status')}</label>
                        <select value={editForm.labour_contract_status} onChange={(e) => setEditForm(f => ({ ...f, labour_contract_status: e.target.value }))} className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5">
                          <option value="Not Issued">{t('employees.lc_not_issued')}</option>
                          <option value="Issued">{t('employees.lc_issued')}</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <input value={editForm.basic_salary} onChange={(e) => setEditForm(f => ({ ...f, basic_salary: e.target.value }))} type="number" placeholder={t('employees.basic_salary', 'Basic salary')} className="text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                        <input value={editForm.full_salary} onChange={(e) => setEditForm(f => ({ ...f, full_salary: e.target.value }))} type="number" placeholder={t('employees.full_salary', 'Full salary')} className="text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                      </div>
                      <input value={editForm.start_date} onChange={(e) => setEditForm(f => ({ ...f, start_date: e.target.value }))} type="date" className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                    </div>
                  ) : (
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-surface-500">Company:</span> <span className="font-semibold text-surface-800">{selectedEmp.company_name || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Department:</span> <span className="font-semibold text-surface-800">{selectedEmp.department_name || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Job Title:</span> <span className="font-semibold text-surface-800">{selectedEmp.job_title_text || selectedEmp.job_title_name || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Status:</span> <Badge variant={selectedEmp.status === 'Active' ? 'success' : 'neutral'}>{selectedEmp.status}</Badge></div>
                    <div className="flex justify-between items-center">
                      <span className="text-surface-500">{t('employees.labour_contract_status')}</span>
                      <Badge variant={selectedEmp.labour_contract_status === 'Issued' ? 'success' : 'danger'}>
                        {t(selectedEmp.labour_contract_status === 'Issued' ? 'employees.lc_issued' : 'employees.lc_not_issued')}
                      </Badge>
                    </div>
                    <div className="flex justify-between"><span className="text-surface-500">Basic Salary:</span> <span className="font-semibold text-emerald-600">{selectedEmp.basic_salary ? `${Number(selectedEmp.basic_salary).toLocaleString()} AED` : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Full Salary:</span> <span className="font-semibold text-emerald-700">{selectedEmp.full_salary ? `${Number(selectedEmp.full_salary).toLocaleString()} AED` : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Join Date:</span> <span className="font-semibold text-surface-800">{selectedEmp.start_date ? dayjs(selectedEmp.start_date).format('MMM D, YYYY') : 'N/A'}</span></div>
                  </div>
                  )}
                  <div className="pt-2 mt-1 border-t border-surface-200">
                    <label className="block text-surface-500 text-xs mb-1">{t('employees.attendance_id', 'Attendance ID (device)')}</label>
                    <div className="flex gap-2">
                      <input value={attId} onChange={(e) => setAttId(e.target.value)} placeholder="e.g. 4035"
                        className="flex-1 text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
                      <Button size="sm" onClick={saveAttendanceId} loading={savingAtt}>{t('common.save', 'Save')}</Button>
                    </div>
                    <p className="text-[10px] text-surface-400 mt-1">{t('employees.attendance_id_hint', 'Maps this employee to the time-clock device ID used by attendance import.')}</p>
                  </div>
                  <div className="pt-2 mt-1 border-t border-surface-200">
                    <label className="block text-surface-500 text-xs mb-1">{t('employees.login_account', 'Portal Login')}</label>
                    {selectedEmp.user_id ? (
                      <p className="text-[11px] text-emerald-600 font-medium">{t('employees.has_login', 'Has a login account')} ({selectedEmp.username})</p>
                    ) : newLoginCreds ? (
                      <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] space-y-1">
                        <p className="font-semibold text-amber-800">{t('employees.login_created_hint', 'Share these with the employee now — the password will not be shown again:')}</p>
                        <p>{t('employees.username', 'Username')}: <span className="font-mono font-semibold">{newLoginCreds.username}</span></p>
                        <p>{t('employees.password', 'Password')}: <span className="font-mono font-semibold">{newLoginCreds.password}</span></p>
                      </div>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={createLogin} loading={creatingLogin}>{t('employees.create_login', 'Create Login Account')}</Button>
                    )}
                  </div>
                </div>
                </div>
                {selectedEmp.labour_contract_status !== 'Issued' && (
                  <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
                    <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-red-700 leading-relaxed">{t('employees.probation_notice')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {/* Upload Widget */}
                <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 flex flex-col md:flex-row items-end gap-3">
                  <div className="w-full md:w-1/3">
                    <label className="block text-xs font-semibold text-surface-700 mb-1">
                      Document Category / فئة المستند
                    </label>
                    <select
                      value={uploadCategory}
                      onChange={(e) => setUploadCategory(e.target.value)}
                      className="w-full text-xs bg-white border border-surface-200 rounded-lg p-2 focus:ring-brand-500"
                    >
                      <option value="General">General / عام</option>
                      <option value="ID/Passport">ID & Passport / الهوية والجواز</option>
                      <option value="Certificate">Certificate / الشهادات</option>
                      <option value="Handover Sheet">Handover Sheet / ورقة الاستلام والتسليم</option>
                      <option value="Other">Other / أخرى</option>
                    </select>
                  </div>
                  
                  <div className="w-full md:flex-1 relative border-2 border-dashed border-surface-300 rounded-lg p-2.5 text-center bg-white hover:border-brand-500 transition cursor-pointer">
                    <input
                      type="file"
                      disabled={uploading}
                      onChange={handleDocUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <span className="text-xs text-surface-500 flex items-center justify-center gap-1.5 font-medium">
                      <Upload size={14} className="text-brand-600 animate-pulse" />
                      Click to select and upload document / انقر لاختيار وتحميل مستند
                    </span>
                  </div>
                </div>

                {/* Documents Table */}
                {docsLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="w-6 h-6 text-brand-600 animate-spin" />
                  </div>
                ) : empDocs.length === 0 ? (
                  <div className="text-center py-6 text-xs text-surface-400 italic bg-surface-50 rounded-xl border border-surface-100">
                    No documents uploaded yet / لا توجد مستندات مرفوعة بعد.
                  </div>
                ) : (
                  <div className="border border-surface-200 rounded-xl overflow-hidden text-xs">
                    <table className="w-full text-left border-collapse bg-white">
                      <thead>
                        <tr className="bg-surface-50 border-b border-surface-200">
                          <th className="p-3 font-semibold text-surface-700">Document Name / الاسم</th>
                          <th className="p-3 font-semibold text-surface-700">Category / الفئة</th>
                          <th className="p-3 font-semibold text-surface-700">Uploaded At / التاريخ</th>
                          <th className="p-3 font-semibold text-surface-700 text-center">Action / الإجراء</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-surface-100">
                        {empDocs.map((doc) => (
                          <tr key={doc.id} className="hover:bg-surface-50/50">
                            <td className="p-3 text-surface-950 font-medium truncate max-w-[250px]">{doc.file_name}</td>
                            <td className="p-3"><Badge variant="info" className="text-[9px]">{doc.category}</Badge></td>
                            <td className="p-3 text-surface-500">{dayjs(doc.created_at).format('MMM D, YYYY HH:mm')}</td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleDocDownload(doc)}
                                className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-700 font-semibold"
                              >
                                <Download size={12} />
                                Download / تحميل
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}

// Public providers offered to staff who are not yet under contract — they must
// not hold an official company address before the labour contract and residency
// are in place.
const PUBLIC_EMAIL_DOMAINS = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];
const OTHER = '__other__';

/**
 * Email as "local part" + a domain picker. The composed value is still a plain
 * string, so the surrounding save logic is unchanged. An existing address whose
 * domain is in neither list is preserved as its own option rather than rewritten.
 */
function EmailBuilder({ value, onChange, companyDomains, contracted, t }) {
  const at = String(value || '').lastIndexOf('@');
  const local = at >= 0 ? String(value).slice(0, at) : String(value || '');
  const domain = at >= 0 ? String(value).slice(at + 1) : '';

  const options = useMemo(() => {
    const list = [...companyDomains, ...PUBLIC_EMAIL_DOMAINS];
    if (domain && !list.includes(domain)) list.push(domain);
    return [...new Set(list)];
  }, [companyDomains, domain]);

  const [freeform, setFreeform] = useState(false);
  const compose = (l, d) => onChange(l && d ? `${l}@${d}` : l || '');
  const usingCompanyDomain = companyDomains.includes(domain);

  return (
    <div className="space-y-1">
      <div className="flex gap-1.5">
        <input value={local} onChange={(e) => compose(e.target.value.trim(), domain)}
          placeholder={t('employees.email_local_part')} className="flex-1 min-w-0 text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
        <span className="text-xs text-surface-400 self-center">@</span>
        {freeform ? (
          <input autoFocus value={domain} onChange={(e) => compose(local, e.target.value.trim().toLowerCase())}
            onBlur={() => domain && setFreeform(false)}
            placeholder="example.com" className="w-36 text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
        ) : (
          <select value={domain} onChange={(e) => {
            if (e.target.value === OTHER) { setFreeform(true); compose(local, ''); return; }
            compose(local, e.target.value);
          }} className="w-36 text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5">
            <option value="">{t('employees.select_domain')}</option>
            {options.map((d) => <option key={d} value={d}>{d}</option>)}
            <option value={OTHER}>{t('employees.other_domain')}</option>
          </select>
        )}
      </div>
      {usingCompanyDomain && !contracted && (
        <p className="text-[10px] text-amber-600">{t('employees.company_domain_warning')}</p>
      )}
    </div>
  );
}
