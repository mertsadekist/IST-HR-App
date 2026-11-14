import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Link } from 'react-router-dom';
import { ClipboardList, Plus, Check, X, Loader2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import ApprovalProgress from '@components/approvals/ApprovalProgress';
import RequisitionForm from '@components/requisitions/RequisitionForm';
import * as requisitionsApi from '@api/requisitionsApi';
import * as employeesApi from '@api/employeesApi';
import * as departmentsApi from '@api/departmentsApi';
import * as jobTitlesApi from '@api/jobTitlesApi';

const statusVariant = { Pending: 'warning', Approved: 'success', Rejected: 'danger', Cancelled: 'inactive' };
const money = (n) => (n == null ? '—' : Number(n).toLocaleString());

/**
 * Hiring requests from managers and HR. Once its approval chain is done, HR
 * approves it and a Draft vacancy is created to publish from Vacancies.
 */
export default function Requisitions() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const canDecide = ['admin', 'hr_manager'].includes(user?.role);
  const isAdmin = user?.role === 'admin';
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${reload}`;
  const [state, setState] = useState({ key: null, rows: [] });
  const [lookups, setLookups] = useState({ people: [], departments: [], jobTitles: [] });
  const [form, setForm] = useState(false);
  const [reasons, setReasons] = useState({});
  const [overrides, setOverrides] = useState({});

  useEffect(() => {
    let off = false;
    requisitionsApi.getRequisitions()
      .then(({ data }) => { if (!off) setState({ key, rows: data }); })
      .catch(() => { if (!off) { setState({ key, rows: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [key, t]);

  useEffect(() => {
    let off = false;
    Promise.all([
      employeesApi.getEmployees({ limit: 500 }).catch(() => ({ data: { data: [] } })),
      departmentsApi.getDepartments().catch(() => ({ data: [] })),
      jobTitlesApi.getJobTitles().catch(() => ({ data: [] })),
    ]).then(([e, d, j]) => {
      if (off) return;
      setLookups({
        people: (e.data.data || []).map((p) => ({ id: p.id, name: `${p.first_name} ${p.last_name}` })),
        departments: Array.isArray(d.data) ? d.data : d.data?.data || [],
        jobTitles: Array.isArray(j.data) ? j.data : j.data?.data || [],
      });
    });
    return () => { off = true; };
  }, [currentCompanyId]);

  const act = async (fn, ok) => {
    try { const { data } = await fn(); toast.success(ok(data)); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const reject = (r) => {
    const reason = (reasons[r.id] || '').trim();
    if (!reason) { toast.error(t('requisitions.reason_required')); return; }
    act(() => requisitionsApi.rejectRequisition(r.id, reason), () => t('requisitions.rejected'));
  };

  const rows = state.key === key ? state.rows : null;
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><ClipboardList className="text-brand-600" /> {t('requisitions.title')}</h1>
          <p className="text-sm text-surface-500 mt-1">{t('requisitions.subtitle')}</p>
        </div>
        <Button className="ms-auto" onClick={() => setForm(true)}><Plus size={16} /> {t('requisitions.new')}</Button>
      </div>

      {!rows ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><p className="text-sm text-surface-500 text-center py-6">{t('requisitions.none')}</p></Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => {
            const chainRunning = r.approval?.status === 'Pending';
            return (
              <Card key={r.id} className="!p-4 space-y-2">
                <div className="flex items-start gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-surface-900">{r.title} <span className="text-xs font-normal text-surface-500">× {r.head_count}</span></p>
                    <p className="text-xs text-surface-500">
                      {[r.company_name, r.department_name, r.job_title_name].filter(Boolean).join(' · ')}
                      {' · '}{r.reason === 'Replacement' ? t('requisitions.replacing', { name: r.replaces_name }) : t('requisitions.reason.new')}
                      {' · '}{t('requisitions.budget', { min: money(r.budget_min), max: money(r.budget_max) })}
                      {r.target_start && <> · {t('requisitions.start_by', { date: r.target_start })}</>}
                    </p>
                    <p className="text-xs text-surface-400">{t('requisitions.by', { name: r.requested_by_name || '—', date: String(r.created_at).slice(0, 10) })}</p>
                  </div>
                  <Badge variant={statusVariant[r.status]} className="text-[10px]">{t(`requisitions.status.${r.status.toLowerCase()}`)}</Badge>
                </div>
                <p className="text-sm text-surface-700 whitespace-pre-wrap">{r.justification}</p>
                {r.approval && r.status === 'Pending' && <ApprovalProgress t={t} approval={r.approval} />}
                {r.decision_note && <p className="text-xs text-surface-500">{t('requisitions.note', { note: r.decision_note })}</p>}
                {r.vacancy_id && <Link to="/vacancies" className="text-xs text-brand-700 hover:underline">{t('requisitions.open_vacancy', { status: r.vacancy_status || '' })}</Link>}
                {canDecide && r.status === 'Pending' && (
                  <div className="flex gap-2 items-center flex-wrap pt-1">
                    <input value={reasons[r.id] || ''} onChange={(e) => setReasons((p) => ({ ...p, [r.id]: e.target.value }))}
                      placeholder={t('requisitions.reject_ph')} maxLength={500} className="flex-1 min-w-[200px] text-sm bg-white border border-surface-200 rounded-lg px-3 py-2" />
                    {chainRunning && isAdmin && (
                      <input value={overrides[r.id] || ''} onChange={(e) => setOverrides((p) => ({ ...p, [r.id]: e.target.value }))}
                        placeholder={t('approvals.override_ph')} className="flex-1 min-w-[200px] text-sm bg-white border border-amber-200 rounded-lg px-3 py-2" />
                    )}
                    <Button size="sm" variant="secondary" onClick={() => reject(r)}><X size={14} /> {t('requisitions.reject')}</Button>
                    <Button size="sm" disabled={chainRunning && !(isAdmin && (overrides[r.id] || '').trim().length >= 10)}
                      title={chainRunning ? t('approvals.chain_running') : undefined}
                      onClick={() => act(() => requisitionsApi.approveRequisition(r.id, chainRunning ? { override_chain: overrides[r.id] } : {}), () => t('requisitions.approved'))}>
                      <Check size={14} /> {t('requisitions.approve')}
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
      {form && <RequisitionForm t={t} people={lookups.people} departments={lookups.departments} jobTitles={lookups.jobTitles}
        onClose={() => setForm(false)} onSaved={() => { setForm(false); setReload((n) => n + 1); }} />}
    </div>
  );
}
