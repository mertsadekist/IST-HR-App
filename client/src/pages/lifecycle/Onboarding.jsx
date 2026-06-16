import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as onboardingApi from '@api/onboardingApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { UserCheck, ChevronDown, ChevronRight, Check, Lock, Play, RefreshCw, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import EmailButton from '@components/email/EmailButton';

export default function Onboarding() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [detailModal, setDetailModal] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => { loadRecords(); }, [currentCompanyId, statusFilter]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const params = {};
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (statusFilter) params.status = statusFilter;
      const { data } = await onboardingApi.getOnboardingList(params);
      setRecords(data);
    } catch { toast.error('Failed to load onboarding records'); }
    finally { setLoading(false); }
  };

  const openDetail = async (record) => {
    setDetailModal(record);
    setDetailLoading(true);
    try {
      const { data } = await onboardingApi.getOnboarding(record.id);
      setDetail(data);
    } catch { toast.error('Failed to load details'); }
    finally { setDetailLoading(false); }
  };

  const handleInit = async (record) => {
    try {
      const { data } = await onboardingApi.initOnboarding(record.id);
      toast.success(`${data.steps_created} steps initialized from templates`);
      loadRecords();
      if (detailModal?.id === record.id) openDetail(record);
    } catch { toast.error('Failed to initialize steps'); }
  };

  const handleToggleItem = async (itemId, checked) => {
    try {
      await onboardingApi.toggleChecklistItem(itemId, { is_checked: checked });
      if (detailModal) openDetail(detailModal);
    } catch { toast.error('Failed to update'); }
  };

  const handleCompleteStep = async (stepId) => {
    try {
      await onboardingApi.completeStep(stepId);
      toast.success('Step completed & next unlocked');
      if (detailModal) openDetail(detailModal);
      loadRecords();
    } catch { toast.error('Failed to complete step'); }
  };

  const statusBadge = (status) => {
    const map = { 'In Progress': 'warning', 'Completed': 'success', 'Cancelled': 'danger' };
    return <Badge variant={map[status] || 'info'} className="text-[10px]">{status}</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('lifecycle.onboarding')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('lifecycle.onboarding_desc')}</p></div>
        <Button variant="secondary" onClick={loadRecords}><RefreshCw size={14} /> {t('lifecycle.refresh')}</Button>
      </div>

      <div className="flex gap-1">
        {['', 'In Progress', 'Completed', 'Cancelled'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === s ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{s ? t(`lifecycle.status_${s.toLowerCase().replace(' ', '_')}`, s) : t('lifecycle.all_status', 'All')}</button>
        ))}
        <Badge variant="brand" className="ml-2">{records.length} {t('lifecycle.records', 'records')}</Badge>
      </div>

      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3 mb-2" /><div className="h-3 bg-surface-100 rounded w-2/3" /></div>)}</div>
      ) : records.length === 0 ? (
        <Card><EmptyState icon={<UserCheck className="w-6 h-6 text-surface-400" />} title={t('lifecycle.no_records')} description={t('lifecycle.no_records_desc')} /></Card>
      ) : (
        <div className="space-y-3">
          {records.map(r => (
            <Card key={r.id} hover className="!p-4 cursor-pointer" onClick={() => openDetail(r)}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-sm">
                  {r.first_name?.charAt(0)}{r.last_name?.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-surface-900">{r.first_name} {r.last_name}</h3>
                    {statusBadge(r.status)}
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: r.color_primary || '#6D28D9' }}>{r.short_code}</span>
                  </div>
                  <p className="text-xs text-surface-400 mt-0.5">
                    {r.department_name && `${r.department_name} · `}
                    {r.job_title_name && `${r.job_title_name} · `}
                    {t('lifecycle.started', 'Started')} {dayjs(r.started_at).format('MMM D, YYYY')}
                  </p>
                </div>
                {/* Progress bar */}
                <div className="w-40">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-surface-500">{r.completed_steps}/{r.total_steps} {t('lifecycle.steps')}</span>
                    <span className="font-semibold text-brand-600">{r.progress}%</span>
                  </div>
                  <div className="w-full bg-surface-100 rounded-full h-2">
                    <div className="bg-brand-gradient h-2 rounded-full transition-all duration-500" style={{ width: `${r.progress}%` }} />
                  </div>
                </div>
                <div onClick={(e) => e.stopPropagation()}>
                  <EmailButton
                    variant="icon"
                    to={r.email || ''}
                    toName={`${r.first_name} ${r.last_name}`}
                    templateType="onboarding_welcome"
                    templateData={{ name: `${r.first_name} ${r.last_name}`, company: r.company_name, department: r.department_name, job_title: r.job_title_name, start_date: r.started_at ? dayjs(r.started_at).format('MMM D, YYYY') : '' }}
                    relatedModule="Onboarding"
                    relatedId={r.id}
                    companyId={r.company_id}
                  />
                </div>
                {r.total_steps === 0 && (
                  <Button size="sm" onClick={(e) => { e.stopPropagation(); handleInit(r); }}>{t('lifecycle.init_steps')}</Button>
                )}
                <ChevronRight size={16} className="text-surface-300" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={!!detailModal} onClose={() => { setDetailModal(null); setDetail(null); }}
        title={detail ? `${t('lifecycle.onboarding')} — ${detail.first_name} ${detail.last_name}` : t('common.loading')} size="lg">
        {detailLoading ? (
          <div className="flex items-center justify-center py-12"><Loader2 className="w-8 h-8 text-brand-600 animate-spin" /></div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-4 p-3 bg-surface-50 rounded-xl">
              <div><p className="text-xs text-surface-400">{t('lifecycle.email')}</p><p className="text-sm font-medium">{detail.email || '—'}</p></div>
              <div><p className="text-xs text-surface-400">{t('lifecycle.phone')}</p><p className="text-sm font-medium">{detail.phone || '—'}</p></div>
              <div><p className="text-xs text-surface-400">{t('lifecycle.start_date')}</p><p className="text-sm font-medium">{detail.start_date ? dayjs(detail.start_date).format('MMM D, YYYY') : '—'}</p></div>
              <div className="ml-auto flex items-center gap-2">
                <EmailButton
                  variant="button"
                  size="sm"
                  label={t('lifecycle.send_welcome', 'Send Welcome Email')}
                  to={detail.email || ''}
                  toName={`${detail.first_name} ${detail.last_name}`}
                  templateType="onboarding_welcome"
                  templateData={{ name: `${detail.first_name} ${detail.last_name}`, company: detail.company_name, department: detail.department_name, job_title: detail.job_title_name, start_date: detail.start_date ? dayjs(detail.start_date).format('MMM D, YYYY') : '' }}
                  relatedModule="Onboarding"
                  relatedId={detail.id}
                  companyId={detail.company_id}
                />
                {statusBadge(detail.status)}
              </div>
            </div>

            {!detail.steps?.length ? (
              <div className="text-center py-8">
                <p className="text-sm text-surface-500 mb-3">{t('lifecycle.no_steps')}</p>
                <Button onClick={() => handleInit(detailModal)}>{t('lifecycle.init_from_templates')}</Button>
              </div>
            ) : (
              <div className="space-y-2">
                {detail.steps.map(step => {
                  const isOpen = step.status === 'Open';
                  const isDone = step.status === 'Complete';
                  const isLocked = step.status === 'Locked';
                  const allChecked = step.checklist_items?.length > 0 && step.checklist_items.every(i => i.is_checked);
                  return (
                    <div key={step.id} className={`rounded-xl border ${isDone ? 'border-emerald-200 bg-emerald-50/30' : isOpen ? 'border-brand-200 bg-brand-50/20' : 'border-surface-100 bg-surface-50/50 opacity-60'}`}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${isDone ? 'bg-emerald-100 text-emerald-700' : isOpen ? 'bg-brand-100 text-brand-700' : 'bg-surface-200 text-surface-400'}`}>
                          {isDone ? <Check size={14} /> : isLocked ? <Lock size={12} /> : step.step_number}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-semibold text-surface-800 text-sm">{step.name}</h4>
                          <div className="flex gap-2 text-[10px] text-surface-400 mt-0.5">
                            {step.owner && <span>{t('lifecycle.owner')}: {step.owner}</span>}
                            {step.sla && <span>{t('lifecycle.sla')}: {step.sla}</span>}
                          </div>
                        </div>
                        <Badge variant={isDone ? 'success' : isOpen ? 'warning' : 'info'} className="text-[10px]">{t(`lifecycle.status_${step.status.toLowerCase()}`, step.status)}</Badge>
                        {isOpen && allChecked && (
                          <Button size="sm" onClick={() => handleCompleteStep(step.id)}>{t('lifecycle.complete')}</Button>
                        )}
                      </div>
                      {isOpen && step.checklist_items?.length > 0 && (
                        <div className="px-4 pb-3 space-y-1.5 border-t border-surface-100/60 pt-2">
                          {step.checklist_items.map(item => (
                            <label key={item.id} className="flex items-center gap-2.5 cursor-pointer group">
                              <input type="checkbox" checked={!!item.is_checked}
                                onChange={(e) => handleToggleItem(item.id, e.target.checked)}
                                className="w-4 h-4 rounded border-surface-300 text-brand-600" />
                              <span className={`text-sm ${item.is_checked ? 'text-surface-400 line-through' : 'text-surface-700'}`}>{item.label}</span>
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
