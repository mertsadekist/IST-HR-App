import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as offboardingApi from '@api/offboardingApi';
import * as employeesApi from '@api/employeesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { UserMinus, Check, Lock, ChevronRight, Loader2, Plus, DollarSign, Calendar, RefreshCw, Printer } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import EmailButton from '@components/email/EmailButton';

const STAGE_TEMPLATE_MAP = {
  resignation: 'offboarding_resignation',
  knowledge_transfer: 'offboarding_knowledge_transfer',
  it_access: 'offboarding_it_revocation',
  asset_return: 'offboarding_asset_return',
  financial: 'offboarding_financial',
  exit_interview: 'offboarding_exit_interview',
  legal: 'offboarding_legal',
  final_signoff: 'offboarding_farewell',
};

const getStageTemplateType = (stepName) => {
  const key = stepName.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  for (const [stageKey, templateType] of Object.entries(STAGE_TEMPLATE_MAP)) {
    if (key.includes(stageKey)) return templateType;
  }
  return 'offboarding_general';
};

export default function Offboarding() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [employeeDocs, setEmployeeDocs] = useState([]);

  // Initiate modal
  const [initModal, setInitModal] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [initForm, setInitForm] = useState({ employee_id: '', departure_type: 'Resignation', last_working_day: '', reason: '' });
  const [initiating, setInitiating] = useState(false);

  useEffect(() => { loadRecords(); }, [currentCompanyId, statusFilter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (statusFilter) params.status = statusFilter;
      const { data } = await offboardingApi.getOffboardingList(params);
      setRecords(data);
    } catch { toast.error('Failed to load offboarding records'); }
    finally { setLoading(false); }
  };

  const openInit = async () => {
    try {
      const params = currentCompanyId ? { company_id: currentCompanyId, status: 'Active', limit: 200 } : { status: 'Active', limit: 200 };
      const { data } = await employeesApi.getEmployees(params);
      setEmployees(data.data || []);
    } catch { /* ignore */ }
    setInitForm({ employee_id: '', departure_type: 'Resignation', last_working_day: '', reason: '' });
    setInitModal(true);
  };

  const handleInitiate = async (e) => {
    e.preventDefault();
    if (!initForm.employee_id || !initForm.last_working_day) { toast.error('Employee and LWD required'); return; }
    setInitiating(true);
    try {
      const payload = { ...initForm, employee_id: parseInt(initForm.employee_id) };
      const { data } = await offboardingApi.initiateOffboarding(payload);
      toast.success(`Offboarding initiated. EOSB: ${data.eosb_amount?.toLocaleString()} AED`);
      setInitModal(false); loadRecords();
    } catch { toast.error('Failed to initiate'); } finally { setInitiating(false); }
  };

  const openDetail = async (record) => {
    setDetailModal(record); setDetailLoading(true);
    setEmployeeDocs([]);
    try {
      const { data } = await offboardingApi.getOffboarding(record.id);
      setDetail(data);
      if (data.employee_id) {
        try {
          const { data: docs } = await employeesApi.getEmployeeDocuments(data.employee_id);
          setEmployeeDocs(docs || []);
        } catch (e) {
          console.error("Failed to fetch documents:", e);
        }
      }
    }
    catch { toast.error('Failed to load details'); }
    finally { setDetailLoading(false); }
  };

  const refreshEmployeeDocs = async (employeeId) => {
    try {
      const { data: docs } = await employeesApi.getEmployeeDocuments(employeeId);
      setEmployeeDocs(docs || []);
    } catch (e) {
      console.error("Failed to refresh documents:", e);
    }
  };

  const handleToggleItem = async (itemId, checked) => {
    try { await offboardingApi.toggleChecklistItem(itemId, { is_checked: checked }); if (detailModal) openDetail(detailModal); }
    catch { toast.error(t('common.error')); }
  };

  const handleCompleteStep = async (stepId) => {
    try { await offboardingApi.completeStep(stepId); toast.success('Step completed'); if (detailModal) openDetail(detailModal); loadRecords(); }
    catch { toast.error(t('common.error')); }
  };

  const statusBadge = (status) => {
    const map = { 'In Progress': 'warning', 'Completed': 'success', 'Cancelled': 'danger' };
    return <Badge variant={map[status] || 'info'} className="text-[10px]">{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('lifecycle.offboarding')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('lifecycle.offboarding_desc')}</p></div>
        <Button onClick={openInit}><Plus size={16} /> {t('lifecycle.initiate_offboarding')}</Button>
      </div>

      <div className="flex gap-1">
        {['', 'In Progress', 'Completed', 'Cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{s ? t(`lifecycle.status_${s.toLowerCase().replace(' ', '_')}`, s) : t('lifecycle.all_status', 'All')}</button>
        ))}
        <Badge variant="brand" className="ml-2">{records.length} {t('lifecycle.records', 'records')}</Badge>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3 mb-2" /><div className="h-3 bg-surface-100 rounded w-2/3" /></div>)}</div>
      ) : records.length === 0 ? (
        <Card><EmptyState icon={<UserMinus className="w-6 h-6 text-surface-400" />} title={t('lifecycle.no_offboarding')} description={t('lifecycle.no_offboarding_desc')}
          action={<Button onClick={openInit}><Plus size={16} /> {t('lifecycle.initiate_offboarding')}</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <Card key={r.id} hover className="!p-4 cursor-pointer" onClick={() => openDetail(r)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center text-red-700 font-semibold text-sm">
                  {r.first_name?.charAt(0)}{r.last_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-surface-900">{r.first_name} {r.last_name}</h3>
                    {statusBadge(r.status)}
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: r.color_primary || '#6D28D9' }}>{r.short_code}</span>
                    <span className="text-xs text-surface-400 px-2 py-0.5 bg-surface-100 rounded">{r.departure_type}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-surface-400 mt-1">
                    {r.last_working_day && <span className="flex items-center gap-1"><Calendar size={10} /> {t('lifecycle.lwd', 'LWD')}: {dayjs(r.last_working_day).format('MMM D, YYYY')}</span>}
                    {r.eosb_amount > 0 && <span className="flex items-center gap-1 text-emerald-600 font-medium"><DollarSign size={10} /> {t('lifecycle.eosb', 'EOSB')}: {Number(r.eosb_amount).toLocaleString()} AED</span>}
                  </div>
                </div>
                <div className="w-36">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-surface-500">{r.completed_steps}/{r.total_steps} {t('lifecycle.steps')}</span>
                    <span className="font-semibold text-red-600">{r.progress}%</span>
                  </div>
                  <div className="w-full bg-surface-100 rounded-full h-2"><div className="bg-red-500 h-2 rounded-full transition-all duration-500" style={{ width: `${r.progress}%` }} /></div>
                </div>
                <ChevronRight size={16} className="text-surface-300" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Initiate Modal */}
      <Modal open={initModal} onClose={() => setInitModal(false)} title={t('lifecycle.initiate_offboarding')} size="md">
        <form onSubmit={handleInitiate} className="space-y-4">
          <Select label={t('lifecycle.employee')} required value={initForm.employee_id} onChange={(e) => setInitForm(p => ({ ...p, employee_id: e.target.value }))}
            options={employees.map(em => ({ value: String(em.id), label: `${em.first_name} ${em.last_name}` }))} placeholder={t('lifecycle.select_employee')} />
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('lifecycle.departure_type')} required value={initForm.departure_type} onChange={(e) => setInitForm(p => ({ ...p, departure_type: e.target.value }))}
              options={['Resignation', 'Termination', 'End of Contract', 'Mutual Agreement'].map(type => ({ value: type, label: t(`lifecycle.dep_${type.toLowerCase().replace(/ /g, '_')}`, type) }))} />
            <Input label={t('lifecycle.last_working_day')} type="date" required value={initForm.last_working_day} onChange={(e) => setInitForm(p => ({ ...p, last_working_day: e.target.value }))} />
          </div>
          <div><label className="block text-sm font-medium text-surface-700 mb-1.5">{t('lifecycle.reason')}</label>
            <textarea placeholder={t('lifecycle.reason_desc')} value={initForm.reason} onChange={(e) => setInitForm(p => ({ ...p, reason: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" /></div>
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700">
            {t('lifecycle.eosb_warning')}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setInitModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={initiating}>{t('lifecycle.initiate_offboarding')}</Button>
          </div>
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal open={!!detailModal} onClose={() => { setDetailModal(null); setDetail(null); }}
        title={detail ? `${t('lifecycle.offboarding')} — ${detail.first_name} ${detail.last_name}` : t('common.loading')} size="lg">
        {detailLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /></div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              {[
                { label: t('lifecycle.lwd', 'LWD'), value: detail.last_working_day ? dayjs(detail.last_working_day).format('MMM D, YYYY') : '—' },
                { label: t('lifecycle.type'), value: detail.departure_type },
                { label: t('lifecycle.basic_salary'), value: `${Number(detail.basic_salary || 0).toLocaleString()} AED` },
                { label: t('lifecycle.eosb_amount'), value: `${Number(detail.eosb_amount || 0).toLocaleString()} AED`, highlight: true },
              ].map((item, i) => (
                <div key={i} className={`p-3 rounded-xl ${item.highlight ? 'bg-emerald-50 border border-emerald-200' : 'bg-surface-50'}`}>
                  <p className="text-[10px] text-surface-400 uppercase">{item.label}</p>
                  <p className={`text-sm font-semibold ${item.highlight ? 'text-emerald-700' : 'text-surface-800'}`}>{item.value}</p>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center bg-brand-50 border border-brand-200 p-3 rounded-xl">
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-brand-900">{t('lifecycle.handover_sheet', 'Handover & Receipt Sheet / ورقة الاستلام والتسليم')}</span>
                <span className="text-[10px] text-brand-600 mt-0.5">{t('lifecycle.handover_sheet_desc', 'Generate printable document for assets & handover / إنشاء المستند المخصص للطباعة والتوقيع للعهد والتسليم')}</span>
              </div>
              <Button
                variant="brand"
                onClick={() => window.open(`/offboarding/${detail.id}/handover-sheet`, '_blank')}
                className="flex items-center gap-2"
              >
                <Printer size={14} />
                <span>{t('lifecycle.print_handover', 'Generate Handover Sheet / إنشاء ورقة الاستلام والتسليم')}</span>
              </Button>
            </div>

            {detail.steps?.length > 0 ? (
              <div className="space-y-2">
                {detail.steps.map(step => {
                  const isOpen = step.status === 'Open';
                  const isDone = step.status === 'Complete';
                  const isLocked = step.status === 'Locked';
                  const allChecked = step.checklist_items?.length > 0 && step.checklist_items.every(i => i.is_checked);
                  
                  const isHandoverStep = step.step_number === 2 || step.name.toLowerCase().includes('knowledge');
                  const isAssetReturnStep = step.step_number === 4 || step.name.toLowerCase().includes('asset return');
                  const isStepWithHandoverConstraint = isHandoverStep || isAssetReturnStep;
                  const hasHandoverDoc = employeeDocs.some(d => d.category === 'Handover Sheet');

                  return (
                    <div key={step.id} className={`rounded-xl border ${isDone ? 'border-emerald-200 bg-emerald-50/30' : isOpen ? 'border-red-200 bg-red-50/20' : 'border-surface-100 bg-surface-50/50 opacity-60'}`}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isDone ? 'bg-emerald-100 text-emerald-700' : isOpen ? 'bg-red-100 text-red-700' : 'bg-surface-200 text-surface-400'}`}>
                          {isDone ? <Check size={14} /> : isLocked ? <Lock size={12} /> : step.step_number}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-surface-800 text-sm">{step.name}</h4>
                          <div className="flex gap-2 text-[10px] text-surface-400 mt-0.5">
                            {step.owner && <span>{t('lifecycle.owner')}: {step.owner}</span>}
                            {step.sla && <span>{t('lifecycle.sla')}: {step.sla}</span>}
                          </div>
                        </div>
                        <Badge variant={isDone ? 'success' : isOpen ? 'danger' : 'info'} className="text-[10px]">{t(`lifecycle.status_${step.status.toLowerCase()}`, step.status)}</Badge>
                        {isOpen && allChecked && (
                          <Button
                            size="sm"
                            disabled={isStepWithHandoverConstraint && !hasHandoverDoc}
                            onClick={() => handleCompleteStep(step.id)}
                          >
                            {t('lifecycle.complete')}
                          </Button>
                        )}
                      </div>
                      
                      {isOpen && (
                        <div className="px-4 pb-3 border-t border-surface-100/60 pt-2 space-y-3">
                          {step.checklist_items?.length > 0 && (
                            <div className="space-y-1.5">
                              {step.checklist_items.map(item => (
                                <label key={item.id} className="flex items-center gap-2.5 cursor-pointer">
                                  <input type="checkbox" checked={!!item.is_checked} onChange={(e) => handleToggleItem(item.id, e.target.checked)}
                                    className="w-4 h-4 rounded border-surface-300 text-brand-600" />
                                  <span className={`text-sm ${item.is_checked ? 'text-surface-400 line-through' : 'text-surface-700'}`}>{item.label}</span>
                                </label>
                              ))}
                            </div>
                          )}

                          {detail?.email && (
                            <EmailButton
                              variant="button"
                              size="sm"
                              to={detail.email}
                              toName={`${detail.first_name} ${detail.last_name}`}
                              templateType={getStageTemplateType(step.name)}
                              templateData={{ step_name: step.name, departure_type: detail.departure_type, last_working_day: detail.last_working_day }}
                              relatedModule="offboarding"
                              relatedId={detail.id}
                              companyId={detail.company_id}
                              label={t('lifecycle.send_email_for_step', { step: step.name, defaultValue: `Send Email: ${step.name}` })}
                            />
                          )}

                          {isStepWithHandoverConstraint && (
                            <div className="bg-white border border-surface-200 rounded-xl p-3 space-y-2 mt-2">
                              <div className="flex justify-between items-center">
                                <span className="text-xs font-semibold text-surface-700 flex items-center gap-1.5">
                                  <UserMinus size={14} className="text-brand-600" />
                                  {t('lifecycle.upload_signed_handover', 'Upload Signed Handover Sheet / رفع ورقة الاستلام والتسليم الموقعة')}
                                </span>
                                {hasHandoverDoc ? (
                                  <Badge variant="success" className="text-[9px]">{t('lifecycle.uploaded', 'Uploaded / تم الرفع')}</Badge>
                                ) : (
                                  <Badge variant="warning" className="text-[9px]">{t('lifecycle.pending_upload', 'Pending / مطلوب الرفع')}</Badge>
                                )}
                              </div>
                              
                              {hasHandoverDoc ? (
                                <div className="space-y-1">
                                  {employeeDocs.filter(d => d.category === 'Handover Sheet').map(doc => (
                                    <div key={doc.id} className="flex justify-between items-center text-xs bg-surface-50 border border-surface-200 rounded-lg p-2.5">
                                      <span className="text-surface-600 truncate max-w-[200px] font-medium">{doc.file_name}</span>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          try {
                                            const res = await employeesApi.downloadEmployeeDocument(detail.employee_id, doc.id);
                                            const url = window.URL.createObjectURL(new Blob([res.data]));
                                            const link = document.createElement('a');
                                            link.href = url;
                                            link.setAttribute('download', doc.file_name);
                                            document.body.appendChild(link);
                                            link.click();
                                            link.remove();
                                          } catch {
                                            toast.error('Failed to download document');
                                          }
                                        }}
                                        className="text-brand-600 hover:text-brand-700 font-semibold"
                                      >
                                        {t('common.download', 'Download / تحميل')}
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <div className="border-2 border-dashed border-surface-200 rounded-xl p-4 text-center bg-surface-50 hover:border-brand-500 transition relative">
                                  <input
                                    type="file"
                                    accept=".pdf,.png,.jpg,.jpeg"
                                    onChange={async (e) => {
                                      const file = e.target.files[0];
                                      if (!file) return;
                                      const formData = new FormData();
                                      formData.append('file', file);
                                      formData.append('category', 'Handover Sheet');
                                      
                                      const toastId = toast.loading('Uploading handover sheet...');
                                      try {
                                        await employeesApi.uploadEmployeeDocument(detail.employee_id, formData);
                                        toast.update(toastId, { render: 'Document uploaded successfully!', type: 'success', isLoading: false, autoClose: 3000 });
                                        refreshEmployeeDocs(detail.employee_id);
                                      } catch (err) {
                                        console.error(err);
                                        toast.update(toastId, { render: 'Failed to upload document', type: 'error', isLoading: false, autoClose: 3000 });
                                      }
                                    }}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                  />
                                  <p className="text-xs text-surface-500 font-medium">
                                    {t('lifecycle.upload_click', 'Click or drag signed sheet here to upload / انقر أو اسحب الملف هنا للرفع')}
                                  </p>
                                  <p className="text-[10px] text-surface-400 mt-1">PDF, PNG, JPG up to 10MB</p>
                                </div>
                              )}

                              {!hasHandoverDoc && (
                                <p className="text-[10px] text-red-500 font-semibold mt-1.5 flex items-center gap-1">
                                  <span>⚠</span>
                                  {t('lifecycle.require_signed_handover', 'You must upload the signed Handover Sheet to complete this step / يجب عليك رفع ورقة الاستلام والتسليم الموقعة لإكمال هذه الخطوة')}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : <p className="text-center text-surface-400 py-4">{t('lifecycle.no_workflow')}</p>}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
