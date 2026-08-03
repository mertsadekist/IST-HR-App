import { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { Users, Plus, Mail, Phone, Building2, Briefcase, FileText, Upload, Download, Calendar, DollarSign, Globe, Loader2, Pencil, X, AlertTriangle, Camera, ShieldCheck, Trash2, Laptop, KeyRound, Package } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@api/axios';
import * as employeesApi from '@api/employeesApi';
import * as departmentsApi from '@api/departmentsApi';
import * as leaveApi from '@api/leaveApi';
import * as assetsApi from '@api/assetsApi';
import EmployeeOnboardingWizard from './components/EmployeeOnboardingWizard';
import EmployeeHistoryReport from './components/EmployeeHistoryReport';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import Modal from '@components/ui/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

export default function Employees() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { items: companies } = useSelector((s) => s.companies);
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin'; // deleting a bank letter is admin-only
  // Revealing a stored credential is admin/hr_manager only, matching the server gate.
  const canRevealSecrets = ['admin', 'hr_manager'].includes(useSelector((s) => s.auth.user?.role));
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
  const [wpsIds, setWpsIds] = useState({ work_permit_no: '', personal_no: '' });
  const [savingWps, setSavingWps] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [departments, setDepartments] = useState([]);
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [newLoginCreds, setNewLoginCreds] = useState(null);
  // Photo bytes come from an authenticated endpoint, so an <img src> can't
  // fetch them directly — they're read as blobs into a map of object URLs
  // keyed by employee id, shared by the list avatars and the profile card.
  const [photoUrls, setPhotoUrls] = useState({});
  const photoUrlsRef = useRef({});
  const [photoBusy, setPhotoBusy] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);

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
    revokeAllPhotos(); // the previous company's blobs are no longer referenced
    try {
      const url = currentCompanyId ? `/employees?company_id=${currentCompanyId}` : '/employees';
      const { data } = await api.get(url);
      const list = data.data || data; // handle standard pagination response or flat array
      setEmployees(list);
      loadPhotos(list); // not awaited: avatars fill in as they arrive
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
    setWpsIds({ work_permit_no: emp.work_permit_no || '', personal_no: emp.personal_no || '' });
    setActiveTab('profile');
    setEditMode(false);
    setNewLoginCreds(null);
    setEmpDocs([]);
    setDocsLoading(true);
    if (emp.photo_path && !photoUrls[emp.id]) loadPhotos([emp]); // in case the list fetch missed it
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

  // Only employees that actually have a stored photo are fetched.
  const loadPhotos = async (list) => {
    const targets = (list || []).filter((e) => e.photo_path);
    if (!targets.length) return;
    const entries = await Promise.all(targets.map(async (e) => {
      try {
        const { data } = await employeesApi.getEmployeePhotoBytes(e.id);
        return [e.id, URL.createObjectURL(data)];
      } catch { return null; }
    }));
    setPhotoUrls((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        if (!entry) continue;
        const [id, url] = entry;
        if (next[id]) URL.revokeObjectURL(next[id]);
        next[id] = url;
      }
      return next;
    });
  };

  const revokeAllPhotos = () => {
    Object.values(photoUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    photoUrlsRef.current = {};
    setPhotoUrls({});
  };

  // Keep a ref copy so the unmount cleanup revokes the *current* URLs.
  useEffect(() => { photoUrlsRef.current = photoUrls; }, [photoUrls]);
  useEffect(() => () => { Object.values(photoUrlsRef.current).forEach((u) => URL.revokeObjectURL(u)); }, []);

  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await employeesApi.uploadEmployeePhoto(selectedEmp.id, fd);
      const { data } = await employeesApi.getEmployee(selectedEmp.id);
      setSelectedEmp(data);
      setEmployees((list) => list.map((x) => (x.id === data.id ? { ...x, photo_path: data.photo_path, photo_type: data.photo_type } : x)));
      await loadPhotos([data]); // replaces the map entry and revokes the old blob
      toast.success(t('employees.photo_saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('employees.photo_save_failed'));
    } finally { setPhotoBusy(false); }
  };

  const exportHistory = async () => {
    setExporting(true);
    try {
      const { data } = await employeesApi.getEmployeeHistory(selectedEmp.id);
      setHistoryData(data);
      await waitForPaint(); // let the off-screen report commit before capture
      const name = `${selectedEmp.first_name}-${selectedEmp.last_name}`.replace(/\s+/g, '');
      await printElementWithLetterhead(reportRef.current, selectedEmp.company_id, `employee-record-${name}.pdf`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || t('employees.export_failed'));
    } finally { setExporting(false); }
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

  // WPS identifiers save inline (like Attendance ID) rather than only through
  // edit mode — they are filled in one pass across many employees.
  const saveWpsIds = async () => {
    setSavingWps(true);
    const patch = {
      work_permit_no: wpsIds.work_permit_no.trim() || null,
      personal_no: wpsIds.personal_no.trim() || null,
    };
    try {
      await employeesApi.updateEmployee(selectedEmp.id, patch);
      setSelectedEmp((p) => ({ ...p, ...patch }));
      setEmployees((list) => list.map((e) => (e.id === selectedEmp.id ? { ...e, ...patch } : e)));
      toast.success(t('employees.wps_ids_saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('employees.wps_ids_save_failed'));
    } finally {
      setSavingWps(false);
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
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0">
                          {photoUrls[emp.id]
                            ? <img src={photoUrls[emp.id]} alt="" className="w-full h-full object-cover" />
                            : <>{emp.first_name?.[0]}{emp.last_name?.[0]}</>}
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
          title={t('employees.employee_profile')}
          size="lg"
        >
          <div className="space-y-4">
            {/* Employee card — photo + identity */}
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-gradient-to-r from-brand-50 to-surface-50 border border-brand-100">
              <label className={`relative group shrink-0 ${photoBusy ? 'pointer-events-none' : 'cursor-pointer'}`} title={t('employees.change_photo')}>
                <span className="block w-20 h-20 rounded-full overflow-hidden bg-brand-100 text-brand-700 ring-2 ring-white shadow-sm">
                  {photoUrls[selectedEmp.id] ? (
                    <img src={photoUrls[selectedEmp.id]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="w-full h-full flex items-center justify-center text-xl font-bold">
                      {selectedEmp.first_name?.[0]}{selectedEmp.last_name?.[0]}
                    </span>
                  )}
                </span>
                <span className="absolute inset-0 rounded-full bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {photoBusy ? <Loader2 size={18} className="text-white animate-spin" /> : <Camera size={18} className="text-white" />}
                </span>
                <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoPick} disabled={photoBusy} />
              </label>
              <div className="min-w-0">
                <h2 className="text-lg font-bold text-surface-900 truncate">{selectedEmp.first_name} {selectedEmp.last_name}</h2>
                <p className="text-sm text-surface-600 truncate">
                  {selectedEmp.job_title_text || selectedEmp.job_title_name || t('employees.no_job_title')}
                  {selectedEmp.department_name ? ` · ${selectedEmp.department_name}` : ''}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <Badge variant={selectedEmp.status === 'Active' ? 'success' : 'neutral'}>{selectedEmp.status}</Badge>
                  <Badge variant={selectedEmp.labour_contract_status === 'Issued' ? 'success' : 'danger'}>
                    {t('employees.labour_contract_status')}: {t(selectedEmp.labour_contract_status === 'Issued' ? 'employees.lc_issued' : 'employees.lc_not_issued')}
                  </Badge>
                </div>
              </div>
            </div>

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
              <button
                onClick={() => setActiveTab('leave')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'leave'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-surface-500 hover:text-surface-700'
                }`}
              >
                {t('employees.leave_tab')}
              </button>
              <button
                onClick={() => setActiveTab('assets')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'assets'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-surface-500 hover:text-surface-700'
                }`}
              >
                {t('employees.assets_tab')}
              </button>
              <button
                onClick={() => setActiveTab('bank')}
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all ${
                  activeTab === 'bank'
                    ? 'border-brand-600 text-brand-600'
                    : 'border-transparent text-surface-500 hover:text-surface-700'
                }`}
              >
                {t('employees.bank_tab')}
              </button>
            </div>

            {/* Tab Content */}
            {activeTab === 'profile' ? (
              <div className="space-y-3">
                <div className="flex justify-end gap-2">
                  {editMode ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}><X size={14} /> {t('common.cancel', 'Cancel')}</Button>
                      <Button size="sm" onClick={saveProfile} loading={savingProfile}>{t('common.save', 'Save')}</Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="secondary" onClick={exportHistory} loading={exporting}>
                        <Download size={14} /> {t('employees.export_record')}
                      </Button>
                      <Button size="sm" variant="secondary" onClick={startEditProfile}><Pencil size={14} /> {t('common.edit', 'Edit')}</Button>
                    </>
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
                    <div className="flex justify-between"><span className="text-surface-500">{t('employees.work_permit_no')}</span> <span className={`font-semibold font-mono ${selectedEmp.work_permit_no ? 'text-surface-800' : 'text-red-500'}`}>{selectedEmp.work_permit_no || t('employees.wps_missing')}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">{t('employees.personal_no')}</span> <span className={`font-semibold font-mono ${selectedEmp.personal_no ? 'text-surface-800' : 'text-red-500'}`}>{selectedEmp.personal_no || t('employees.wps_missing')}</span></div>
                  </div>
                  )}
                  {/* WPS identifiers — mandatory on the Ministry of Labour salary file.
                      Editable inline (no edit mode) because they are filled in one pass. */}
                  <div className="pt-2 mt-1 border-t border-surface-200">
                    <label className="block text-surface-500 text-xs mb-1">{t('employees.wps_ids')}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        ['work_permit_no', t('employees.work_permit_no_full'), 9],
                        ['personal_no', t('employees.personal_no_full'), 14],
                      ].map(([key, label, len]) => {
                        const val = wpsIds[key];
                        // Live length feedback: the MOL rejects a file with a wrong-width number.
                        const wrongLen = val.trim().length > 0 && val.trim().length !== len;
                        return (
                          <div key={key}>
                            <label className="block text-surface-400 text-[10px] mb-0.5">{label}</label>
                            <input value={val} onChange={(e) => setWpsIds((p) => ({ ...p, [key]: e.target.value }))}
                              inputMode="numeric" placeholder={'0'.repeat(len)}
                              className={`w-full text-xs font-mono bg-white border rounded-lg px-2 py-1.5 ${wrongLen ? 'border-amber-400' : 'border-surface-200'}`} />
                            {wrongLen && <p className="text-[10px] text-amber-600 mt-0.5">{t('employees.wps_len_warning', { expected: len, actual: val.trim().length })}</p>}
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      <Button size="sm" onClick={saveWpsIds} loading={savingWps}>{t('common.save', 'Save')}</Button>
                      {(!selectedEmp.work_permit_no || !selectedEmp.personal_no) && (
                        <span className="text-[10px] text-red-500">{t('employees.wps_ids_required')}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-surface-400 mt-1">{t('employees.wps_ids_hint')}</p>
                  </div>
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
            ) : activeTab === 'leave' ? (
              <EmployeeLeaveTab employee={selectedEmp} t={t} />
            ) : activeTab === 'assets' ? (
              <EmployeeAssetsTab employee={selectedEmp} t={t} canReveal={canRevealSecrets} />
            ) : activeTab === 'bank' ? (
              <EmployeeBankTab employee={selectedEmp} t={t} isAdmin={isAdmin} />
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

      {/* Off-screen printable report — captured by html2canvas on export */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        {historyData && (
          <EmployeeHistoryReport
            ref={reportRef}
            data={historyData}
            company={companies.find((c) => c.id === selectedEmp?.company_id)}
          />
        )}
      </div>
    </div>
  );
}

/**
 * Everything handed to the employee during their employment — hardware, company
 * accounts and software licences — including items already returned, so the tab
 * doubles as a handover record. Credentials are never rendered from the list
 * payload: revealing one goes through the dedicated audited endpoint.
 */
const ASSET_ICONS = { Hardware: Laptop, Account: KeyRound, Software: Package };
const ASSET_STATUS_VARIANT = { Active: 'success', Returned: 'info', Deactivated: 'neutral', Missing: 'danger' };

function EmployeeAssetsTab({ employee, t, canReveal }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState({});
  const [revealing, setRevealing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // No status filter: returned/deactivated items are part of the record.
    assetsApi.getAssets({ employee_id: employee.id })
      .then(({ data }) => { if (!cancelled) setAssets(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setAssets([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id]);

  const reveal = async (a) => {
    setRevealing(a.id);
    try {
      const { data } = await assetsApi.revealPassword(a.id);
      setRevealed((p) => ({ ...p, [a.id]: data.password }));
    } catch (err) { toast.error(err.response?.data?.error || t('common.operation_failed')); }
    finally { setRevealing(null); }
  };

  const active = assets.filter((a) => a.status === 'Active');
  const closed = assets.filter((a) => a.status !== 'Active');

  const row = (a) => {
    const Icon = ASSET_ICONS[a.asset_type] || Package;
    return (
      <div key={a.id} className="p-3 rounded-xl border border-surface-100">
        <div className="flex items-start gap-2.5">
          <Icon size={15} className="text-brand-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-surface-900">{a.name}</span>
              <Badge variant={ASSET_STATUS_VARIANT[a.status] || 'info'} className="text-[10px]">{a.status}</Badge>
              <span className="text-[10px] text-surface-400">{a.asset_type}</span>
              {a.platform_name && <span className="text-[10px] text-surface-400">· {a.platform_name}</span>}
            </div>
            <div className="text-[11px] text-surface-500 mt-0.5 space-y-0.5">
              {a.identifier && <p>{t('employees.asset_identifier')}: <span className="font-mono">{a.identifier}</span></p>}
              {a.account_username && <p>{t('employees.asset_username')}: <span className="font-mono">{a.account_username}</span></p>}
              {a.workspace && <p>{t('employees.asset_workspace')}: {a.workspace}</p>}
              {a.access_level && <p>{t('employees.asset_access')}: {a.access_level}</p>}
              <p>
                {t('employees.asset_issued')}: {a.issued_date ? dayjs(a.issued_date).format('MMM D, YYYY') : '—'}
                {a.returned_date ? ` · ${t('employees.asset_returned')}: ${dayjs(a.returned_date).format('MMM D, YYYY')}` : ''}
                {a.condition_note ? ` · ${a.condition_note}` : ''}
              </p>
              {a.notes && <p className="whitespace-pre-wrap">{a.notes}</p>}
              {a.handover_receipt_file && (
                <p className="text-emerald-600">
                  ✓ {t('employees.asset_receipt_on_file')}: {a.handover_receipt_file}
                  {a.handover_receipt_uploaded_at ? ` (${dayjs(a.handover_receipt_uploaded_at).format('MMM D, YYYY')})` : ''}
                </p>
              )}
              {revealed[a.id] && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                  {t('employees.password')}: <span className="font-mono font-semibold">{revealed[a.id]}</span>
                </p>
              )}
            </div>
          </div>
          {canReveal && a.has_password && !revealed[a.id] && (
            <Button size="sm" variant="secondary" onClick={() => reveal(a)} loading={revealing === a.id}>
              <KeyRound size={12} /> {t('employees.reveal_password')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="card p-3 animate-pulse"><div className="h-3 bg-surface-200 rounded w-1/3" /></div>)}</div>;
  if (!assets.length) {
    return <Card><EmptyState icon={<Laptop className="w-5 h-5 text-surface-400" />} title={t('employees.no_assets')} description={t('employees.no_assets_desc')} /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Badge variant="success">{active.length} {t('employees.assets_held')}</Badge>
        {closed.length > 0 && <Badge variant="info">{closed.length} {t('employees.assets_closed')}</Badge>}
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-surface-800">{t('employees.assets_currently_held')}</h4>
          {active.map(row)}
        </div>
      )}
      {closed.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-surface-800">{t('employees.assets_returned_history')}</h4>
          {closed.map(row)}
        </div>
      )}
    </div>
  );
}

/**
 * Payroll bank account for one employee, plus the bank-stamped IBAN letter that
 * evidences it. The account cannot be marked Verified until that letter is on
 * file, and editing the account clears verification (a changed account needs a
 * fresh letter).
 */
const BANK_FIELDS = [
  ['bank_name', 'employees.bank_name', true],
  ['account_holder_name', 'employees.account_holder', true],
  ['account_number', 'employees.account_number', true],
  ['iban', 'employees.iban', true],
  ['swift_code', 'employees.swift'],
  ['branch_name', 'employees.branch'],
];
const TRANSFER_METHODS = ['Bank Transfer', 'WPS', 'Cheque', 'Cash'];

function EmployeeBankTab({ employee, t, isAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await employeesApi.getEmployeeBank(employee.id); setData(res.data); }
    catch { setData(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [employee.id]);

  const bank = data?.bank;
  const letters = (data?.files || []).filter((f) => f.kind === 'iban_letter');
  const hasLetter = letters.length > 0;

  const startEdit = () => {
    setForm({
      bank_name: bank?.bank_name || '', account_holder_name: bank?.account_holder_name || `${employee.first_name} ${employee.last_name}`,
      account_number: bank?.account_number || '', iban: bank?.iban || '', swift_code: bank?.swift_code || '',
      branch_name: bank?.branch_name || '', transfer_method: bank?.transfer_method || 'Bank Transfer',
      salary_currency: bank?.salary_currency || '', notes: bank?.notes || '',
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await employeesApi.saveEmployeeBank(employee.id, form);
      toast.success(t('employees.bank_saved'));
      setEditing(false);
      await load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.save_failed')); }
    finally { setSaving(false); }
  };

  const uploadLetter = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'iban_letter');
      await employeesApi.uploadEmployeeBankFile(employee.id, fd);
      toast.success(t('employees.iban_letter_uploaded'));
      await load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.upload_failed')); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await employeesApi.verifyEmployeeBank(employee.id);
      toast.success(t('employees.bank_verified'));
      await load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(false); }
  };

  const download = async (f) => {
    try {
      const res = await employeesApi.downloadEmployeeBankFile(employee.id, f.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = f.file_name || 'iban-letter';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error(t('toasts.t_failed_to_download_document')); }
  };

  const removeFile = async (f) => {
    const res = await confirmDelete(`"${f.file_name}"`);
    if (!res.isConfirmed) return;
    try { await employeesApi.deleteEmployeeBankFile(employee.id, f.id); toast.success(t('common.deleted')); await load(); }
    catch { toast.error(t('common.delete_failed')); }
  };

  if (loading) return <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="card p-3 animate-pulse"><div className="h-3 bg-surface-200 rounded w-1/3" /></div>)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-surface-900 text-sm">{t('employees.bank_details')}</h3>
          {bank && (
            <Badge variant={bank.verified ? 'success' : 'warning'}>
              {t(bank.verified ? 'employees.bank_is_verified' : 'employees.bank_unverified')}
            </Badge>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2">
            {bank && !bank.verified && (
              <Button size="sm" onClick={verify} loading={busy} disabled={!hasLetter}
                title={!hasLetter ? t('employees.iban_letter_required') : undefined}>
                <ShieldCheck size={14} /> {t('employees.verify_bank')}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={startEdit}>
              <Pencil size={14} /> {bank ? t('common.edit') : t('employees.add_bank')}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 bg-surface-50 p-4 rounded-xl border border-surface-200">
          {BANK_FIELDS.map(([k, label, req]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-surface-700">{t(label)}{req && <span className="text-red-500"> *</span>}</label>
              <input value={form[k] || ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className={`w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5 mt-1 ${k === 'iban' ? 'font-mono uppercase' : ''}`} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-surface-700">{t('employees.transfer_method')}</label>
              <select value={form.transfer_method} onChange={(e) => setForm((f) => ({ ...f, transfer_method: e.target.value }))}
                className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5 mt-1">
                {TRANSFER_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-surface-700">{t('employees.salary_currency')}</label>
              <input value={form.salary_currency || ''} onChange={(e) => setForm((f) => ({ ...f, salary_currency: e.target.value }))}
                placeholder="AED" className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5 mt-1" />
            </div>
          </div>
          <p className="text-[10px] text-amber-600">{t('employees.bank_edit_resets_verification')}</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}><X size={14} /> {t('common.cancel')}</Button>
            <Button size="sm" onClick={save} loading={saving}>{t('common.save')}</Button>
          </div>
        </div>
      ) : !bank ? (
        <Card><EmptyState icon={<Building2 className="w-5 h-5 text-surface-400" />} title={t('employees.no_bank_details')} description={t('employees.no_bank_desc')} /></Card>
      ) : (
        <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-2 text-xs">
          {BANK_FIELDS.map(([k, label]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-surface-500">{t(label)}</span>
              <span className={`font-semibold text-surface-800 text-right break-all ${k === 'iban' ? 'font-mono' : ''}`}>{bank[k] || '—'}</span>
            </div>
          ))}
          <div className="flex justify-between"><span className="text-surface-500">{t('employees.transfer_method')}</span><span className="font-semibold text-surface-800">{bank.transfer_method || '—'}</span></div>
          {bank.salary_currency && <div className="flex justify-between"><span className="text-surface-500">{t('employees.salary_currency')}</span><span className="font-semibold text-surface-800">{bank.salary_currency}</span></div>}
          {bank.verified && (
            <div className="flex justify-between pt-2 border-t border-surface-200">
              <span className="text-surface-500">{t('employees.verified_by')}</span>
              <span className="font-semibold text-emerald-700">{bank.verified_by_name || '—'}{bank.verified_at ? ` · ${dayjs(bank.verified_at).format('MMM D, YYYY')}` : ''}</span>
            </div>
          )}
          {bank.notes && <p className="text-[11px] text-surface-500 pt-1 whitespace-pre-wrap">{bank.notes}</p>}
        </div>
      )}

      {/* Bank-stamped IBAN letter */}
      <div className="border-t border-surface-200 pt-3">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-bold text-surface-800">{t('employees.iban_letter')}</h4>
          <label className={`text-xs px-2.5 py-1 rounded-lg cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''} bg-surface-100 hover:bg-surface-200 text-surface-700`}>
            <Upload size={12} className="inline -mt-0.5 mr-1" /> {t('employees.upload_iban_letter')}
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={uploadLetter} disabled={busy} />
          </label>
        </div>
        <p className="text-[10px] text-surface-400 mb-2">{t('employees.iban_letter_hint')}</p>
        {!hasLetter ? (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
            {t('employees.iban_letter_required')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {letters.map((f) => (
              <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-surface-100 text-xs">
                <FileText size={13} className="text-brand-500 shrink-0" />
                <span className="flex-1 min-w-0 truncate">{f.file_name}</span>
                <span className="text-[10px] text-surface-400 whitespace-nowrap">{dayjs(f.uploaded_at).format('MMM D, YYYY')}{f.uploaded_by_name ? ` · ${f.uploaded_by_name}` : ''}</span>
                <button onClick={() => download(f)} className="p-1 text-surface-400 hover:text-brand-600"><Download size={13} /></button>
                {isAdmin && <button onClick={() => removeFile(f)} className="p-1 text-surface-400 hover:text-red-600"><Trash2 size={13} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Per-employee leave history with its supporting documents, reusing the
 * existing GET /leave/report endpoint.
 */
function EmployeeLeaveTab({ employee, t }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    leaveApi.getReport({ employee_id: employee.id, year })
      .then(async ({ data }) => {
        if (cancelled) return;
        setReport(data);
        // Pull attachments only for requests that actually have some.
        const withFiles = (data.requests || []).filter((r) => Number(r.file_count) > 0);
        const pairs = await Promise.all(withFiles.map((r) =>
          leaveApi.getRequestFiles(r.id).then(({ data: f }) => [r.id, f]).catch(() => [r.id, []])));
        if (!cancelled) setFiles(Object.fromEntries(pairs));
      })
      .catch(() => { if (!cancelled) setReport(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id, year]);

  const download = async (f) => {
    try {
      const res = await leaveApi.downloadLeaveFile(f.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = f.file_name || 'document';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error(t('toasts.t_failed_to_download_document')); }
  };

  const statusColor = (s) => ({ Approved: 'success', Rejected: 'danger', Cancelled: 'danger', Pending: 'warning' }[s] || 'info');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-surface-700">{t('leave.report_year')}</label>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
          className="text-xs border border-surface-200 rounded-lg px-2 py-1.5 w-24" />
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="card p-3 animate-pulse"><div className="h-3 bg-surface-200 rounded w-1/3" /></div>)}</div>
      ) : !report ? (
        <p className="text-xs text-surface-400">{t('common.failed_load')}</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead className="bg-surface-50 text-surface-500"><tr>
              <th className="text-left p-2">{t('leave.th_type')}</th><th className="p-2">{t('leave.th_entitled')}</th>
              <th className="p-2">{t('leave.th_used')}</th><th className="p-2">{t('leave.th_remaining')}</th></tr></thead>
            <tbody>
              {(report.summary || []).map((s) => (
                <tr key={s.leave_type_id} className="border-t border-surface-50">
                  <td className="p-2">{s.name}</td>
                  <td className="p-2 text-center">{s.entitled}</td>
                  <td className="p-2 text-center">{s.used}</td>
                  <td className="p-2 text-center font-semibold text-brand-600">{Math.max(0, s.entitled - s.used)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(report.requests || []).length === 0 ? (
            <p className="text-xs text-surface-400">{t('leave.no_report_requests')}</p>
          ) : (
            <div className="space-y-2">
              {report.requests.map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg border border-surface-100">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ background: r.color || '#7c3aed' }} />
                    <span className="font-semibold text-surface-800">{r.leave_type_name}</span>
                    <Badge variant={statusColor(r.status)} className="text-[10px]">{r.status}</Badge>
                    <span className="text-surface-500">{dayjs(r.start_date).format('MMM D')} → {dayjs(r.end_date).format('MMM D, YYYY')} · {r.days} {t('leave.days')}</span>
                  </div>
                  {r.reason && <p className="text-[11px] text-surface-500 mt-1">{r.reason}</p>}
                  {(r.approver_name || r.decided_by_name) && (
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      {t('leave.th_decided_by')} {r.approver_name || r.decided_by_name}
                      {r.decided_at ? ` · ${dayjs(r.decided_at).format('MMM D, YYYY')}` : ''}
                    </p>
                  )}
                  {(files[r.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {files[r.id].map((f) => (
                        <button key={f.id} onClick={() => download(f)}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-600">
                          <Download size={11} /> {t(`leave.kind_${f.kind}`)}: {f.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
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
