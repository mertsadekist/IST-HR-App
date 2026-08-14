import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as leaveApi from '@api/leaveApi';
import * as employeesApi from '@api/employeesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { CalendarDays, Plus, RefreshCw, Check, X, Upload } from 'lucide-react';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || (e?.response?.data?.errors?.[0]?.message) || f;
const statusVariant = (s) => ({ Approved: 'success', Rejected: 'danger', Cancelled: 'danger', Pending: 'warning' }[s] || 'info');
const stLabel = (t, s) => t(`leave.st_${String(s || '').toLowerCase()}`, s);

export default function Leave() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isHR = ['admin', 'hr_manager'].includes(user?.role);
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [types, setTypes] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [reqModal, setReqModal] = useState(false);
  const [decision, setDecision] = useState(null); // { request, action }
  const [balModal, setBalModal] = useState(false);
  const [typeModal, setTypeModal] = useState(false);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [tp, rq] = await Promise.all([leaveApi.getTypes(), leaveApi.getRequests(statusFilter ? { status: statusFilter } : {})]);
      setTypes(tp.data); setRequests(rq.data);
      if (isHR) {
        const b = await leaveApi.getBalances({}); setBalances(b.data);
        try { const e = await employeesApi.getEmployees({ limit: 500 }); setEmployees(e.data.data || []); } catch { /* ignore */ }
      }
    } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [currentCompanyId, statusFilter]);

  // Approve/reject open a modal: the server requires the written request on
  // file plus the name of the manager who actually made the call.
  const decide = async (r, action) => {
    if (action === 'cancel') {
      try { await leaveApi.cancelRequest(r.id); toast.success(t('common.updated')); loadAll(); }
      catch (e) { toast.error(apiErr(e, t('leave.action_failed'))); }
      return;
    }
    setDecision({ request: r, action });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('leave.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('leave.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadAll}><RefreshCw size={14} /> {t('common.refresh')}</Button>
          <Button onClick={() => setReqModal(true)}><Plus size={16} /> {t('leave.new_request')}</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-100">
        {['requests', ...(isHR ? ['balances', 'types', 'report'] : [])].map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-all ${tab === tb ? 'border-brand-600 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>{t(`leave.tab_${tb}`)}</button>
        ))}
      </div>

      {tab === 'requests' && (
        <>
          <div className="flex gap-1 flex-wrap">
            {['', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{s ? stLabel(t, s) : t('common.all')}</button>
            ))}
          </div>
          {loading ? <Skel /> : requests.length === 0 ? (
            <Card><EmptyState icon={<CalendarDays className="w-6 h-6 text-surface-400" />} title={t('leave.no_requests')} /></Card>
          ) : (
            <div className="space-y-2">
              {requests.map((r) => (
                <Card key={r.id} className="!p-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: r.color || '#7c3aed' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-surface-900">{r.first_name} {r.last_name}</span>
                        <Badge variant="info" className="text-[10px]">{r.leave_type_name}</Badge>
                        <Badge variant={statusVariant(r.status)} className="text-[10px]">{stLabel(t, r.status)}</Badge>
                      </div>
                      <p className="text-xs text-surface-400 mt-0.5">{dayjs(r.start_date).format('MMM D')} → {dayjs(r.end_date).format('MMM D, YYYY')} · {r.days} {t('leave.days')}{r.reason ? ` · ${r.reason}` : ''}</p>
                    </div>
                    {isHR && r.status === 'Pending' && (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => decide(r, 'approve')}><Check size={13} /> {t('common.approve')}</Button>
                        <Button size="sm" variant="danger" onClick={() => decide(r, 'reject')}><X size={13} /> {t('common.reject')}</Button>
                      </div>
                    )}
                    {r.status !== 'Cancelled' && r.status !== 'Rejected' && (
                      <Button size="sm" variant="ghost" onClick={() => decide(r, 'cancel')}>{t('leave.cancel')}</Button>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'balances' && isHR && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-800">{t('leave.balances_title')}</h3>
            <Button size="sm" onClick={() => setBalModal(true)}><Plus size={14} /> {t('leave.set_entitlement')}</Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
              <th className="text-left p-3">{t('leave.th_employee')}</th><th className="text-left p-3">{t('leave.th_type')}</th><th className="p-3">{t('leave.th_year')}</th>
              <th className="p-3">{t('leave.th_entitled')}</th><th className="p-3">{t('leave.th_used')}</th><th className="p-3">{t('leave.th_remaining')}</th></tr></thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id} className="border-t border-surface-50">
                  <td className="p-3">{b.first_name} {b.last_name}</td><td className="p-3">{b.leave_type_name}</td>
                  <td className="p-3 text-center">{b.year}</td><td className="p-3 text-center">{b.entitled}</td>
                  <td className="p-3 text-center">{b.used}</td><td className="p-3 text-center font-semibold text-brand-600">{b.remaining}</td>
                </tr>
              ))}
              {balances.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-surface-400 text-sm">{t('leave.no_balances')}</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'types' && isHR && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-800">{t('leave.types_title')}</h3>
            <Button size="sm" onClick={() => setTypeModal(true)}><Plus size={14} /> {t('leave.add_type')}</Button>
          </div>
          <div className="divide-y divide-surface-50">
            {types.map((tp) => (
              <div key={tp.id} className="p-3.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: tp.color || '#7c3aed' }} />
                  <span className="font-medium text-surface-800">{tp.name}</span>
                  {/* A tiered type has no single pay mode: sick leave is full, half
                      and unpaid depending on how much of the year has gone. The
                      tier list below says so; a flat badge here would contradict it. */}
                  {(tp.tiers?.length || 0) > 1 ? (
                    <Badge variant="warning" className="text-[10px]">{t('leave.tiered')}</Badge>
                  ) : (
                    <Badge variant={tp.paid_mode === 'None' ? 'info' : tp.paid_mode === 'Half' ? 'warning' : 'success'} className="text-[10px]">
                      {t(`leave.pm_${String(tp.paid_mode || (tp.is_paid ? 'Full' : 'None')).toLowerCase()}`)}
                    </Badge>
                  )}
                  {tp.accrual === 'Service Based' && (
                    <Badge variant="info" className="text-[10px]">{t('leave.accrual_service')}</Badge>
                  )}
                  {!!tp.requires_document && (
                    <Badge variant="inactive" className="text-[10px]">{t('leave.needs_document')}</Badge>
                  )}
                  {tp.draws_on_name && (
                    <Badge variant="info" className="text-[10px]">{t('leave.draws_on', { name: tp.draws_on_name })}</Badge>
                  )}
                  {tp.status === 'Inactive' && <Badge variant="inactive" className="text-[10px]">{t('leave.retired')}</Badge>}
                  <span className="ms-auto text-xs text-surface-400 shrink-0">
                    {Number(tp.default_days) > 0 ? t('leave.days_per_year', { n: tp.default_days }) : '—'}
                  </span>
                </div>

                {(tp.tiers?.length || 0) > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2 ms-4">
                    {tp.tiers.map((tr, i) => (
                      <span key={i} className={`px-2 py-0.5 rounded-lg text-[11px] ${
                        Number(tr.pay_factor) >= 1 ? 'bg-emerald-50 text-emerald-700'
                          : Number(tr.pay_factor) > 0 ? 'bg-amber-50 text-amber-700'
                            : 'bg-surface-100 text-surface-500'}`}>
                        {t('leave.tier_range', {
                          from: Number(tr.from_day),
                          to: tr.to_day == null ? '∞' : Number(tr.to_day),
                          pct: Math.round(Number(tr.pay_factor) * 100),
                        })}
                      </span>
                    ))}
                  </div>
                )}

                {tp.description && (
                  <p className="text-[11px] text-surface-500 mt-2 ms-4 leading-relaxed">{tp.description}</p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {tab === 'report' && isHR && <ReportTab employees={employees} />}

      <DecisionModal decision={decision} onClose={() => setDecision(null)} onDone={() => { setDecision(null); loadAll(); }} />
      <RequestModal open={reqModal} onClose={() => setReqModal(false)} types={types} isHR={isHR} employees={employees} onSaved={() => { setReqModal(false); loadAll(); }} />
      <BalanceModal open={balModal} onClose={() => setBalModal(false)} types={types} employees={employees} onSaved={() => { setBalModal(false); loadAll(); }} />
      <TypeModal open={typeModal} onClose={() => setTypeModal(false)} onSaved={() => { setTypeModal(false); loadAll(); }} />
    </div>
  );
}

function Skel() { return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>)}</div>; }

function ReportTab({ employees = [] }) {
  const { t } = useTranslation();
  const [employeeId, setEmployeeId] = useState('');
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!employeeId) { setReport(null); return; }
    let cancelled = false;
    setLoading(true);
    leaveApi.getReport({ employee_id: employeeId, year })
      .then(({ data }) => { if (!cancelled) setReport(data); })
      .catch((e) => { if (!cancelled) toast.error(apiErr(e, t('common.failed_load'))); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId, year]);

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="p-4 border-b border-surface-100 flex items-end gap-3 flex-wrap">
        <div>
          <label className="text-xs font-semibold text-surface-700 block mb-1">{t('leave.th_employee')}</label>
          <select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-2 min-w-[220px]">
            <option value="">{t('leave.report_select_employee')}</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs font-semibold text-surface-700 block mb-1">{t('leave.report_year')}</label>
          <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())} className="text-sm border border-surface-200 rounded-lg px-3 py-2 w-28" />
        </div>
      </div>

      {!employeeId ? (
        <EmptyState icon={<CalendarDays className="w-6 h-6 text-surface-400" />} title={t('leave.no_report_selection')} />
      ) : loading ? (
        <div className="p-4"><Skel /></div>
      ) : report && (
        <div className="divide-y divide-surface-100">
          <div>
            <h4 className="text-sm font-semibold text-surface-800 px-4 pt-4">{t('leave.report_summary_title')}</h4>
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                <th className="text-left p-3">{t('leave.th_type')}</th><th className="p-3">{t('leave.th_entitled')}</th>
                <th className="p-3">{t('leave.th_used')}</th><th className="p-3">{t('leave.th_remaining')}</th></tr></thead>
              <tbody>
                {report.summary.map((s) => (
                  <tr key={s.leave_type_id} className="border-t border-surface-50">
                    <td className="p-3"><span className="inline-flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: s.color || '#7c3aed' }} />{s.name}</span></td>
                    <td className="p-3 text-center">{s.entitled}</td>
                    <td className="p-3 text-center">{s.used}</td>
                    <td className="p-3 text-center font-semibold text-brand-600">{Math.max(0, s.entitled - s.used)}</td>
                  </tr>
                ))}
                {report.summary.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-surface-400 text-sm">{t('leave.no_balances')}</td></tr>}
              </tbody>
            </table>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-surface-800 px-4 pt-4">{t('leave.report_detail_title')}</h4>
            {report.requests.length === 0 ? (
              <p className="text-xs text-surface-400 p-4">{t('leave.no_report_requests')}</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                  <th className="text-left p-3">{t('leave.th_type')}</th><th className="text-left p-3">{t('leave.th_dates')}</th>
                  <th className="p-3">{t('leave.days')}</th><th className="p-3">{t('common.status')}</th>
                  <th className="text-left p-3">{t('leave.th_reason')}</th><th className="text-left p-3">{t('leave.th_decided_by')}</th></tr></thead>
                <tbody>
                  {report.requests.map((r) => (
                    <tr key={r.id} className="border-t border-surface-50">
                      <td className="p-3"><span className="inline-flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: r.color || '#7c3aed' }} />{r.leave_type_name}</span></td>
                      <td className="p-3">{dayjs(r.start_date).format('MMM D')} → {dayjs(r.end_date).format('MMM D, YYYY')}</td>
                      <td className="p-3 text-center">{r.days}</td>
                      <td className="p-3 text-center"><Badge variant={statusVariant(r.status)} className="text-[10px]">{stLabel(t, r.status)}</Badge></td>
                      <td className="p-3 text-surface-500">{r.reason || '—'}</td>
                      <td className="p-3 text-surface-500">{r.decided_by_name ? `${r.decided_by_name}${r.decided_at ? ` · ${dayjs(r.decided_at).format('MMM D, YYYY')}` : ''}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}

function RequestModal({ open, onClose, types, isHR, employees = [], onSaved }) {
  const { t } = useTranslation();
  const blank = { leave_type_id: '', start_date: '', end_date: '', reason: '', employee_id: '', partial_hours: '' };
  const [form, setForm] = useState(blank);
  // Full days, or part of one. Kept as an explicit choice rather than inferred
  // from whether the hours box is filled, so the date fields can change shape
  // with it — a part-day request covers one date, not a range.
  const [mode, setMode] = useState('full');
  const [proof, setProof] = useState(null);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) { toast.error(t('leave.type_dates_required')); return; }
    if (mode === 'part' && !(Number(form.partial_hours) > 0)) { toast.error(t('leave.hours_required')); return; }
    setSaving(true);
    try {
      const body = { ...form };
      if (mode !== 'part') delete body.partial_hours;
      if (!isHR || !body.employee_id) delete body.employee_id;
      const { data } = await leaveApi.createRequest(body);
      // Attaching here is optional; the proof becomes mandatory at decision time.
      if (proof && data?.id) {
        const fd = new FormData();
        fd.append('file', proof);
        fd.append('kind', 'request_proof');
        try { await leaveApi.uploadRequestFile(data.id, fd); }
        catch (e) { toast.error(apiErr(e, t('leave.proof_upload_failed'))); }
      }
      toast.success(data?.days < 1
        ? t('leave.submitted_partial', { days: data.days })
        : t('leave.submitted'));
      onSaved();
      setForm(blank); setMode('full'); setProof(null);
    } catch (e) { toast.error(apiErr(e, t('leave.submit_failed'))); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('leave.modal_new')} size="md">
      <div className="space-y-3">
        <div><label className="text-xs font-semibold text-surface-700">{t('leave.f_type')} *</label>
          <select value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
            <option value="">{t('leave.select')}</option>{types.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </select></div>
        {/* Full days or part of one */}
        <div className="flex gap-1 bg-surface-100 rounded-xl p-1">
          {['full', 'part'].map((m) => (
            <button key={m} type="button"
              onClick={() => { setMode(m); if (m === 'part') setForm((f) => ({ ...f, end_date: f.start_date })); }}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                mode === m ? 'bg-white text-brand-700 shadow-sm' : 'text-surface-500 hover:text-surface-700'}`}>
              {t(`leave.mode_${m}`)}
            </button>
          ))}
        </div>

        {mode === 'full' ? (
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-xs font-semibold text-surface-700">{t('leave.f_start')} *</label><input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
            <div><label className="text-xs font-semibold text-surface-700">{t('leave.f_end')} *</label><input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-surface-700">{t('leave.f_date')} *</label>
                {/* One date: the range collapses, so both ends move together. */}
                <input type="date" value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value, end_date: e.target.value }))}
                  className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" />
              </div>
              <div>
                <label className="text-xs font-semibold text-surface-700">{t('leave.f_hours')} *</label>
                <input type="number" min="0.25" max="12" step="0.25" value={form.partial_hours}
                  onChange={(e) => setForm((f) => ({ ...f, partial_hours: e.target.value }))}
                  placeholder="1" className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" />
              </div>
            </div>
            <p className="text-[11px] text-surface-500 bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-2">
              {t('leave.hours_hint')}
            </p>
          </>
        )}
        {isHR && (
          <div>
            <label className="text-xs font-semibold text-surface-700">{t('leave.f_employee_self')}</label>
            <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
              <option value="">{t('leave.myself')}</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
        )}
        <div><label className="text-xs font-semibold text-surface-700">{t('leave.f_reason')}</label><textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        <div>
          <label className="text-xs font-semibold text-surface-700">{t('leave.f_request_proof')}</label>
          <label className="mt-1 flex items-center gap-2 border-2 border-dashed border-surface-200 rounded-lg px-3 py-2.5 cursor-pointer hover:border-brand-400">
            <Upload size={14} className="text-surface-400" />
            <span className="text-xs text-surface-500 truncate">{proof ? proof.name : t('leave.attach_proof')}</span>
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setProof(e.target.files?.[0] || null)} />
          </label>
          <p className="text-[10px] text-surface-400 mt-1">{t('leave.proof_hint')}</p>
        </div>
        <Button onClick={save} loading={saving}>{t('leave.submit_request')}</Button>
      </div>
    </Modal>
  );
}

/**
 * Approve / reject a request. The server refuses a decision unless the written
 * request is on file and the deciding manager is named, so both are collected
 * here — along with optional proof of the approval conversation itself.
 */
function DecisionModal({ decision, onClose, onDone }) {
  const { t } = useTranslation();
  const [approverName, setApproverName] = useState('');
  const [note, setNote] = useState('');
  const [requestProof, setRequestProof] = useState(null);
  const [approvalProof, setApprovalProof] = useState(null);
  const [existing, setExisting] = useState([]);
  const [saving, setSaving] = useState(false);
  const req = decision?.request;
  const isApprove = decision?.action === 'approve';

  useEffect(() => {
    setApproverName(''); setNote(''); setRequestProof(null); setApprovalProof(null); setExisting([]);
    if (!req) return;
    leaveApi.getRequestFiles(req.id).then(({ data }) => setExisting(data || [])).catch(() => setExisting([]));
  }, [req]);

  const hasRequestProof = existing.some((f) => f.kind === 'request_proof') || !!requestProof;

  const submit = async () => {
    if (!approverName.trim()) { toast.error(t('leave.approver_required')); return; }
    if (!hasRequestProof) { toast.error(t('leave.request_proof_required')); return; }
    setSaving(true);
    try {
      for (const [file, kind] of [[requestProof, 'request_proof'], [approvalProof, 'approval_proof']]) {
        if (!file) continue;
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', kind);
        await leaveApi.uploadRequestFile(req.id, fd);
      }
      const body = { approver_name: approverName.trim(), note };
      if (isApprove) await leaveApi.approveRequest(req.id, body);
      else await leaveApi.rejectRequest(req.id, body);
      toast.success(t('common.updated'));
      onDone();
    } catch (e) { toast.error(apiErr(e, t('leave.action_failed'))); }
    finally { setSaving(false); }
  };

  return (
    <Modal open={!!decision} onClose={onClose} size="md"
      title={isApprove ? t('leave.approve_title') : t('leave.reject_title')}>
      {req && (
        <div className="space-y-3">
          <div className="text-xs bg-surface-50 rounded-lg p-2.5">
            <span className="font-semibold text-surface-800">{req.first_name} {req.last_name}</span>
            <span className="text-surface-500"> · {req.leave_type_name} · {dayjs(req.start_date).format('MMM D')} → {dayjs(req.end_date).format('MMM D, YYYY')} · {req.days} {t('leave.days')}</span>
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700">{t('leave.f_approver_name')} *</label>
            <input value={approverName} onChange={(e) => setApproverName(e.target.value)} placeholder={t('leave.approver_placeholder')}
              className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" />
            <p className="text-[10px] text-surface-400 mt-1">{t('leave.approver_hint')}</p>
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700">{t('leave.f_request_proof')} *</label>
            {existing.filter((f) => f.kind === 'request_proof').map((f) => (
              <p key={f.id} className="text-[11px] text-emerald-600 mt-1">✓ {f.file_name}</p>
            ))}
            <label className="mt-1 flex items-center gap-2 border-2 border-dashed border-surface-200 rounded-lg px-3 py-2.5 cursor-pointer hover:border-brand-400">
              <Upload size={14} className="text-surface-400" />
              <span className="text-xs text-surface-500 truncate">{requestProof ? requestProof.name : t('leave.attach_proof')}</span>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setRequestProof(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700">{t('leave.f_approval_proof')}</label>
            <label className="mt-1 flex items-center gap-2 border-2 border-dashed border-surface-200 rounded-lg px-3 py-2.5 cursor-pointer hover:border-brand-400">
              <Upload size={14} className="text-surface-400" />
              <span className="text-xs text-surface-500 truncate">{approvalProof ? approvalProof.name : t('leave.attach_approval_proof')}</span>
              <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setApprovalProof(e.target.files?.[0] || null)} />
            </label>
          </div>

          <div>
            <label className="text-xs font-semibold text-surface-700">{isApprove ? t('leave.decision_note') : t('leave.rejection_note')}</label>
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
            <Button variant={isApprove ? 'primary' : 'danger'} onClick={submit} loading={saving}>
              {isApprove ? t('common.approve') : t('common.reject')}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function BalanceModal({ open, onClose, types, employees = [], onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', year: new Date().getFullYear(), entitled: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await leaveApi.setBalance({ ...form, employee_id: Number(form.employee_id), leave_type_id: Number(form.leave_type_id), year: Number(form.year), entitled: Number(form.entitled) }); toast.success(t('leave.entitlement_set')); onSaved(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('leave.modal_balance')} size="md">
      <div className="space-y-3">
        <div><label className="text-xs font-semibold text-surface-700">{t('leave.th_employee')} *</label>
          <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
            <option value="">{t('leave.select_employee')}</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-surface-700">{t('leave.f_type')} *</label>
          <select value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
            <option value="">{t('leave.select')}</option>{types.map((tp) => <option key={tp.id} value={tp.id}>{tp.name}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-surface-700">{t('leave.th_year')} *</label><input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-xs font-semibold text-surface-700">{t('leave.f_entitled')} *</label><input type="number" value={form.entitled} onChange={(e) => setForm((f) => ({ ...f, entitled: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        </div>
        <Button onClick={save} loading={saving}>{t('common.save')}</Button>
      </div>
    </Modal>
  );
}

function TypeModal({ open, onClose, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ name: '', default_days: 0, paid_mode: 'Full' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.name) { toast.error(t('leave.name_required')); return; }
    setSaving(true);
    try { await leaveApi.createType({ ...form, default_days: Number(form.default_days) }); toast.success(t('leave.type_added')); onSaved(); setForm({ name: '', default_days: 0, paid_mode: 'Full' }); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('leave.modal_type')} size="md">
      <div className="space-y-3">
        <div><label className="text-xs font-semibold text-surface-700">{t('leave.f_name')} *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div><label className="text-xs font-semibold text-surface-700">{t('leave.f_default_days')}</label><input type="number" value={form.default_days} onChange={(e) => setForm((f) => ({ ...f, default_days: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <div>
            <label className="text-xs font-semibold text-surface-700">{t('leave.f_paid_mode')}</label>
            <select value={form.paid_mode} onChange={(e) => setForm((f) => ({ ...f, paid_mode: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
              <option value="Full">{t('leave.pm_full')}</option>
              <option value="Half">{t('leave.pm_half')}</option>
              <option value="None">{t('leave.pm_none')}</option>
            </select>
          </div>
        </div>
        <Button onClick={save} loading={saving}>{t('common.add')}</Button>
      </div>
    </Modal>
  );
}
