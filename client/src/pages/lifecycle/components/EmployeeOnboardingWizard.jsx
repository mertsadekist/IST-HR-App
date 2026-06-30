import { useState, useEffect, useRef } from 'react';
import Modal from '@components/ui/Modal';
import Button from '@components/ui/Button';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import { Upload, Sparkles, User, Briefcase, Key, FileText, CheckCircle2, ChevronRight, ChevronLeft, Loader2, Laptop, UserPlus } from 'lucide-react';
import api from '@api/axios';
import { toast } from 'react-toastify';
import { useTranslation } from 'react-i18next';

export default function EmployeeOnboardingWizard({ open, onClose, onComplete }) {
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Form Data
  const [formData, setFormData] = useState({
    first_name: '', last_name: '', email: '', phone: '', nationality: '',
    company_id: '', department_id: '', job_title_text: '',
    basic_salary: '', full_salary: '', start_date: '', attendance_id: '',
    status: 'Active'
  });
  const [documents, setDocuments] = useState([]); // { category, file, parsed_data, original_name }
  const [createUser, setCreateUser] = useState(true);
  
  // Lookups
  const [companies, setCompanies] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedAssets, setSelectedAssets] = useState([]);

  useEffect(() => {
    if (open) {
      loadLookups();
    }
  }, [open]);

  const loadLookups = async () => {
    try {
      const [comp, dept, cat] = await Promise.all([
        api.get('/companies'),
        api.get('/departments'),
        api.get('/settings/platform-catalog')
      ]);
      setCompanies(comp.data);
      setDepartments(dept.data);
      setCatalog(cat.data.filter(a => a.type === 'Asset'));
    } catch (err) {
      console.error(err);
    }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setLoading(true);
    const fd = new FormData();
    fd.append('file', file);
    fd.append('doc_type', file.type.includes('pdf') ? 'CV' : 'Passport'); // Simple guess

    try {
      const { data } = await api.post('/employees/parse-document', fd, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const parsed = data.parsed_data;
      
      // Auto-fill form
      setFormData(prev => ({
        ...prev,
        first_name: parsed.first_name || prev.first_name,
        last_name: parsed.last_name || prev.last_name,
        email: parsed.email || prev.email,
        phone: parsed.phone || prev.phone,
        nationality: parsed.nationality || prev.nationality
      }));

      // Add to docs list
      setDocuments(prev => [...prev, {
        category: data.doc_type || 'Identity',
        file_path: data.file_path,
        original_name: data.original_name,
        parsed_data: parsed
      }]);

      toast.success(t('toasts.t_document_parsed_with_ai_successfully'));
    } catch (err) {
      toast.error(t('toasts.t_failed_to_parse_document'));
    } finally {
      setLoading(false);
      e.target.value = null; // Reset input
    }
  };

  const handleAssetToggle = (assetId) => {
    if (selectedAssets.includes(assetId)) {
      setSelectedAssets(selectedAssets.filter(id => id !== assetId));
    } else {
      setSelectedAssets([...selectedAssets, assetId]);
    }
  };

  const submitOnboarding = async () => {
    setLoading(true);
    try {
      // Create employee
      const { data } = await api.post('/employees/onboard', {
        employee_data: formData,
        documents: documents,
        create_user: createUser
      });

      // Assign selected assets (We call the existing assets API for each)
      for (const assetId of selectedAssets) {
        await api.post('/assets', {
          employee_id: data.employee_id,
          catalog_id: assetId,
          assignment_date: new Date().toISOString().split('T')[0],
          status: 'Active'
        });
      }

      onComplete();
    } catch (err) {
      toast.error(t('toasts.t_failed_to_complete_onboarding'));
    } finally {
      setLoading(false);
    }
  };

  // --- Step Rendering ---
  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-100 text-brand-600 mb-4">
                <Sparkles size={28} />
              </div>
              <h3 className="text-lg font-semibold text-surface-900">AI-Powered Extraction</h3>
              <p className="text-surface-500 text-sm max-w-sm mx-auto mt-2">Upload the employee's CV or Passport. Our AI will automatically extract their details and pre-fill the next steps.</p>
            </div>

            <div className="border-2 border-dashed border-brand-200 bg-brand-50/50 rounded-xl p-8 text-center hover:bg-brand-50 transition-colors">
              <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} accept=".pdf,.doc,.docx,.png,.jpg,.jpeg" />
              <Button onClick={() => fileInputRef.current?.click()} loading={loading} className="mx-auto shadow-lg shadow-brand-500/20">
                <Upload size={18} /> Upload Document
              </Button>
              <p className="text-xs text-surface-400 mt-3">PDF, DOC, DOCX, PNG, JPG (Max 10MB)</p>
            </div>

            {documents.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold text-surface-700">Uploaded Documents</h4>
                {documents.map((d, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface-50 border border-surface-200 rounded-lg">
                    <FileText className="text-brand-500" size={18} />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-surface-800">{d.original_name}</p>
                      <p className="text-xs text-brand-600 flex items-center gap-1"><CheckCircle2 size={12}/> AI Extracted</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 2:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2 mb-6">
              <User size={20} className="text-brand-600" /> Personal Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <Input label="First Name" required value={formData.first_name} onChange={e => setFormData({ ...formData, first_name: e.target.value })} />
              <Input label="Last Name" required value={formData.last_name} onChange={e => setFormData({ ...formData, last_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Email" type="email" required value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
              <Input label="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
            </div>
            <Input label="Nationality" value={formData.nationality} onChange={e => setFormData({ ...formData, nationality: e.target.value })} />
          </div>
        );
      case 3:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2 mb-6">
              <Briefcase size={20} className="text-brand-600" /> Placement & Compensation
            </h3>
            <Select label="Company" required value={formData.company_id} onChange={e => setFormData({ ...formData, company_id: e.target.value })}
              options={companies.map(c => ({ value: String(c.id), label: c.name }))} placeholder="Select Company..." />
            
            <Select label="Department" required value={formData.department_id} onChange={e => setFormData({ ...formData, department_id: e.target.value })}
              options={departments.filter(d => !formData.company_id || String(d.company_id) === String(formData.company_id)).map(d => ({ value: String(d.id), label: d.name }))} placeholder="Select Department..." />
            
            <Input label="Job Title" required value={formData.job_title_text} onChange={e => setFormData({ ...formData, job_title_text: e.target.value })} />
            
            <div className="grid grid-cols-2 gap-4 mt-6 border-t border-surface-100 pt-6">
              <Input label="Basic Salary (AED)" type="number" required value={formData.basic_salary} onChange={e => setFormData({ ...formData, basic_salary: e.target.value })} />
              <Input label="Full Salary (AED)" type="number" required value={formData.full_salary} onChange={e => setFormData({ ...formData, full_salary: e.target.value })} />
            </div>
            <Input label="Start Date" type="date" required value={formData.start_date} onChange={e => setFormData({ ...formData, start_date: e.target.value })} />
            <Input label={t('employees.attendance_id', 'Attendance ID (device)')} value={formData.attendance_id} onChange={e => setFormData({ ...formData, attendance_id: e.target.value })} placeholder="e.g. 4035" />
          </div>
        );
      case 4:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2 mb-6">
              <Laptop size={20} className="text-brand-600" /> Allocate Company Assets
            </h3>
            <p className="text-sm text-surface-500 mb-4">Select items to assign to this employee. A Handover Receipt will be automatically generated.</p>
            
            <div className="grid grid-cols-2 gap-3 max-h-[40vh] overflow-y-auto p-1">
              {catalog.map(item => (
                <label key={item.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedAssets.includes(item.id) ? 'bg-brand-50 border-brand-300' : 'bg-white border-surface-200 hover:bg-surface-50'}`}>
                  <input type="checkbox" className="mt-1 accent-brand-600" checked={selectedAssets.includes(item.id)} onChange={() => handleAssetToggle(item.id)} />
                  <div>
                    <div className="font-medium text-surface-900 text-sm">{item.name}</div>
                    <div className="text-xs text-surface-500">{item.category}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );
      case 5:
        return (
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-surface-900 flex items-center gap-2 mb-2">
              <Key size={20} className="text-brand-600" /> System Access
            </h3>
            
            <label className="flex items-start gap-4 p-4 rounded-xl border border-brand-200 bg-brand-50/30 cursor-pointer">
              <input type="checkbox" className="mt-1 w-5 h-5 accent-brand-600" checked={createUser} onChange={(e) => setCreateUser(e.target.checked)} />
              <div>
                <div className="font-semibold text-surface-900 text-base">Generate Portal Account</div>
                <p className="text-sm text-surface-600 mt-1">
                  Create a user account for {formData.first_name || 'the employee'} to log into the HR portal. 
                  Credentials will be generated and can be sent to their email.
                </p>
              </div>
            </label>

            {createUser && (
              <div className="bg-surface-50 border border-surface-200 rounded-lg p-4 flex items-center gap-4">
                <UserPlus className="text-surface-400" size={24} />
                <div>
                  <div className="text-sm text-surface-500">Username</div>
                  <div className="font-medium">{formData.email ? formData.email.split('@')[0] + 'XX' : 'Auto-generated'}</div>
                </div>
              </div>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  const steps = [
    { num: 1, title: 'Docs & AI' },
    { num: 2, title: 'Personal' },
    { num: 3, title: 'Placement' },
    { num: 4, title: 'Assets' },
    { num: 5, title: 'Access' },
  ];

  const canProceed = () => {
    if (step === 2) return formData.first_name && formData.last_name && formData.email;
    if (step === 3) return formData.company_id && formData.department_id && formData.job_title_text && formData.basic_salary && formData.start_date;
    return true;
  };

  return (
    <Modal open={open} onClose={onClose} title={t('employees.onboarding_wizard', 'Employee Onboarding Hub')} size="lg">
      <div className="flex items-center mb-8 px-4 relative">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-surface-100 -z-10 -translate-y-1/2 rounded-full"></div>
        <div className="absolute top-1/2 left-0 h-0.5 bg-brand-500 -z-10 -translate-y-1/2 transition-all duration-300 rounded-full" style={{ width: `${((step - 1) / (steps.length - 1)) * 100}%` }}></div>
        
        {steps.map((s, i) => (
          <div key={s.num} className="flex-1 flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${step >= s.num ? 'bg-brand-600 text-white shadow-md shadow-brand-500/30' : 'bg-surface-100 text-surface-400'}`}>
              {step > s.num ? <CheckCircle2 size={16} /> : s.num}
            </div>
            <span className={`text-xs font-medium ${step >= s.num ? 'text-brand-700' : 'text-surface-400'}`}>{s.title}</span>
          </div>
        ))}
      </div>

      <div className="min-h-[300px]">
        {renderStepContent()}
      </div>

      <div className="flex justify-between items-center mt-8 pt-6 border-t border-surface-100">
        <Button variant="outline" onClick={() => step > 1 ? setStep(step - 1) : onClose()}>
          {step > 1 ? <><ChevronLeft size={16} /> Back</> : 'Cancel'}
        </Button>
        
        {step < steps.length ? (
          <Button onClick={() => setStep(step + 1)} disabled={!canProceed()}>
            Next Step <ChevronRight size={16} />
          </Button>
        ) : (
          <Button onClick={submitOnboarding} loading={loading} className="bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-500/20">
            <CheckCircle2 size={16} /> Complete Onboarding
          </Button>
        )}
      </div>
    </Modal>
  );
}
