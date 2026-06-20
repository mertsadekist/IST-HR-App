import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import { Users, Plus, Mail, Phone, Building2, Briefcase, FileText, Upload, Download, Calendar, DollarSign, Globe, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@api/axios';
import * as employeesApi from '@api/employeesApi';
import EmployeeOnboardingWizard from './components/EmployeeOnboardingWizard';
import Modal from '@components/ui/Modal';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

export default function Employees() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
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
    setActiveTab('profile');
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3 bg-surface-50 p-4 rounded-xl border border-surface-200">
                  <h3 className="font-bold text-surface-900 text-sm border-b pb-1.5 flex items-center gap-1.5">
                    <Users size={16} className="text-brand-600" />
                    Personal Info / معلومات شخصية
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-surface-500">Name:</span> <span className="font-semibold text-surface-800">{selectedEmp.first_name} {selectedEmp.last_name}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Email:</span> <span className="font-semibold text-surface-800">{selectedEmp.email || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Phone:</span> <span className="font-semibold text-surface-800">{selectedEmp.phone || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Nationality:</span> <span className="font-semibold text-surface-800">{selectedEmp.nationality || 'N/A'}</span></div>
                  </div>
                </div>

                <div className="space-y-3 bg-surface-50 p-4 rounded-xl border border-surface-200">
                  <h3 className="font-bold text-surface-900 text-sm border-b pb-1.5 flex items-center gap-1.5">
                    <Briefcase size={16} className="text-brand-600" />
                    Employment Details / تفاصيل العمل
                  </h3>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between"><span className="text-surface-500">Company:</span> <span className="font-semibold text-surface-800">{selectedEmp.company_name || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Department:</span> <span className="font-semibold text-surface-800">{selectedEmp.department_name || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Job Title:</span> <span className="font-semibold text-surface-800">{selectedEmp.job_title_text || selectedEmp.job_title_name || 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Status:</span> <Badge variant={selectedEmp.status === 'Active' ? 'success' : 'neutral'}>{selectedEmp.status}</Badge></div>
                    <div className="flex justify-between"><span className="text-surface-500">Basic Salary:</span> <span className="font-semibold text-emerald-600">{selectedEmp.basic_salary ? `${Number(selectedEmp.basic_salary).toLocaleString()} AED` : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Full Salary:</span> <span className="font-semibold text-emerald-700">{selectedEmp.full_salary ? `${Number(selectedEmp.full_salary).toLocaleString()} AED` : 'N/A'}</span></div>
                    <div className="flex justify-between"><span className="text-surface-500">Join Date:</span> <span className="font-semibold text-surface-800">{selectedEmp.start_date ? dayjs(selectedEmp.start_date).format('MMM D, YYYY') : 'N/A'}</span></div>
                  </div>
                </div>
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
