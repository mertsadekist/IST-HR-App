import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as leaveApi from '@api/leaveApi';
import * as employeesApi from '@api/employeesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { CalendarDays, Plus, RefreshCw, Check, X } from 'lucide-react';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || (e?.response?.data?.errors?.[0]?.message) || f;
const statusVariant = (s) => ({ Approved: 'success', Rejected: 'danger', Cancelled: 'danger', Pending: 'warning' }[s] || 'info');

export default function Leave() {
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
    } catch { toast.error('Failed to load leave data'); }
    finally { setLoading(false); }
  };
  useEffect(() => { loadAll(); /* eslint-disable-next-line */ }, [currentCompanyId, statusFilter]);

  const decide = async (r, action) => {
    try {
      if (action === 'approve') await leaveApi.approveRequest(r.id);
      else if (action === 'reject') {
        const note = window.prompt('Rejection note (optional):') ?? '';
        await leaveApi.rejectRequest(r.id, { note });
      } else if (action === 'cancel') await leaveApi.cancelRequest(r.id);
      toast.success('Updated'); loadAll();
    } catch (e) { toast.error(apiErr(e, 'Action failed')); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Leave Management</h1>
          <p className="text-surface-500 mt-0.5 text-sm">Requests, balances and leave types</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={loadAll}><RefreshCw size={14} /> Refresh</Button>
          <Button onClick={() => setReqModal(true)}><Plus size={16} /> New Request</Button>
        </div>
      </div>

      <div className="flex gap-1 border-b border-surface-100">
        {['requests', ...(isHR ? ['balances', 'types'] : [])].map((tb) => (
          <button key={tb} onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 -mb-px transition-all ${tab === tb ? 'border-brand-600 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>{tb}</button>
        ))}
      </div>

      {tab === 'requests' && (
        <>
          <div className="flex gap-1 flex-wrap">
            {['', 'Pending', 'Approved', 'Rejected', 'Cancelled'].map((s) => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium ${statusFilter === s ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>{s || 'All'}</button>
            ))}
          </div>
          {loading ? <Skel /> : requests.length === 0 ? (
            <Card><EmptyState icon={<CalendarDays className="w-6 h-6 text-surface-400" />} title="No leave requests" /></Card>
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
                        <Badge variant={statusVariant(r.status)} className="text-[10px]">{r.status}</Badge>
                      </div>
                      <p className="text-xs text-surface-400 mt-0.5">{dayjs(r.start_date).format('MMM D')} → {dayjs(r.end_date).format('MMM D, YYYY')} · {r.days} day(s){r.reason ? ` · ${r.reason}` : ''}</p>
                    </div>
                    {isHR && r.status === 'Pending' && (
                      <div className="flex gap-1.5">
                        <Button size="sm" onClick={() => decide(r, 'approve')}><Check size={13} /> Approve</Button>
                        <Button size="sm" variant="danger" onClick={() => decide(r, 'reject')}><X size={13} /> Reject</Button>
                      </div>
                    )}
                    {r.status !== 'Cancelled' && r.status !== 'Rejected' && (
                      <Button size="sm" variant="ghost" onClick={() => decide(r, 'cancel')}>Cancel</Button>
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
            <h3 className="font-semibold text-surface-800">Balances</h3>
            <Button size="sm" onClick={() => setBalModal(true)}><Plus size={14} /> Set entitlement</Button>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
              <th className="text-left p-3">Employee</th><th className="text-left p-3">Type</th><th className="p-3">Year</th>
              <th className="p-3">Entitled</th><th className="p-3">Used</th><th className="p-3">Remaining</th></tr></thead>
            <tbody>
              {balances.map((b) => (
                <tr key={b.id} className="border-t border-surface-50">
                  <td className="p-3">{b.first_name} {b.last_name}</td><td className="p-3">{b.leave_type_name}</td>
                  <td className="p-3 text-center">{b.year}</td><td className="p-3 text-center">{b.entitled}</td>
                  <td className="p-3 text-center">{b.used}</td><td className="p-3 text-center font-semibold text-brand-600">{b.remaining}</td>
                </tr>
              ))}
              {balances.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-surface-400 text-sm">No balances set</td></tr>}
            </tbody>
          </table>
        </Card>
      )}

      {tab === 'types' && isHR && (
        <Card className="!p-0 overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-surface-100">
            <h3 className="font-semibold text-surface-800">Leave Types</h3>
            <Button size="sm" onClick={() => setTypeModal(true)}><Plus size={14} /> Add type</Button>
          </div>
          <div className="divide-y divide-surface-50">
            {types.map((tp) => (
              <div key={tp.id} className="flex items-center gap-3 p-3">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: tp.color || '#7c3aed' }} />
                <span className="font-medium text-surface-800">{tp.name}</span>
                <Badge variant={tp.is_paid ? 'success' : 'info'} className="text-[10px]">{tp.is_paid ? 'Paid' : 'Unpaid'}</Badge>
                {tp.company_id == null && <Badge variant="info" className="text-[10px]">Global</Badge>}
                <span className="ml-auto text-xs text-surface-400">{tp.default_days} days/yr</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      <RequestModal open={reqModal} onClose={() => setReqModal(false)} types={types} isHR={isHR} employees={employees} onSaved={() => { setReqModal(false); loadAll(); }} />
      <BalanceModal open={balModal} onClose={() => setBalModal(false)} types={types} employees={employees} onSaved={() => { setBalModal(false); loadAll(); }} />
      <TypeModal open={typeModal} onClose={() => setTypeModal(false)} onSaved={() => { setTypeModal(false); loadAll(); }} />
    </div>
  );
}

function Skel() { return <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="card p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>)}</div>; }

function RequestModal({ open, onClose, types, isHR, employees = [], onSaved }) {
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '', employee_id: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.leave_type_id || !form.start_date || !form.end_date) { toast.error('Type and dates are required'); return; }
    setSaving(true);
    try {
      const body = { ...form };
      if (!isHR || !body.employee_id) delete body.employee_id;
      await leaveApi.createRequest(body); toast.success('Leave request submitted'); onSaved();
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '', employee_id: '' });
    } catch (e) { toast.error(apiErr(e, 'Failed to submit')); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New Leave Request" size="md">
      <div className="space-y-3">
        <div><label className="text-xs font-semibold text-surface-700">Leave type *</label>
          <select value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
            <option value="">Select…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-surface-700">Start date *</label><input type="date" value={form.start_date} onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-xs font-semibold text-surface-700">End date *</label><input type="date" value={form.end_date} onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        </div>
        {isHR && (
          <div>
            <label className="text-xs font-semibold text-surface-700">Employee (leave blank for yourself)</label>
            <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
              <option value="">— Myself —</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select>
          </div>
        )}
        <div><label className="text-xs font-semibold text-surface-700">Reason</label><textarea rows={2} value={form.reason} onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        <Button onClick={save} loading={saving}>Submit request</Button>
      </div>
    </Modal>
  );
}

function BalanceModal({ open, onClose, types, employees = [], onSaved }) {
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', year: new Date().getFullYear(), entitled: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await leaveApi.setBalance({ ...form, employee_id: Number(form.employee_id), leave_type_id: Number(form.leave_type_id), year: Number(form.year), entitled: Number(form.entitled) }); toast.success('Entitlement set'); onSaved(); }
    catch (e) { toast.error(apiErr(e, 'Failed')); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Set Leave Entitlement" size="md">
      <div className="space-y-3">
        <div><label className="text-xs font-semibold text-surface-700">Employee *</label>
          <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
            <option value="">Select employee…</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
          </select></div>
        <div><label className="text-xs font-semibold text-surface-700">Type *</label>
          <select value={form.leave_type_id} onChange={(e) => setForm((f) => ({ ...f, leave_type_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
            <option value="">Select…</option>{types.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-surface-700">Year *</label><input type="number" value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-xs font-semibold text-surface-700">Entitled days *</label><input type="number" value={form.entitled} onChange={(e) => setForm((f) => ({ ...f, entitled: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        </div>
        <Button onClick={save} loading={saving}>Save</Button>
      </div>
    </Modal>
  );
}

function TypeModal({ open, onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', default_days: 0, is_paid: true });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.name) { toast.error('Name required'); return; }
    setSaving(true);
    try { await leaveApi.createType({ ...form, default_days: Number(form.default_days) }); toast.success('Leave type added'); onSaved(); setForm({ name: '', default_days: 0, is_paid: true }); }
    catch (e) { toast.error(apiErr(e, 'Failed')); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Add Leave Type" size="md">
      <div className="space-y-3">
        <div><label className="text-xs font-semibold text-surface-700">Name *</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        <div className="grid grid-cols-2 gap-3 items-end">
          <div><label className="text-xs font-semibold text-surface-700">Default days/year</label><input type="number" value={form.default_days} onChange={(e) => setForm((f) => ({ ...f, default_days: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <label className="flex items-center gap-2 text-sm pb-2"><input type="checkbox" checked={form.is_paid} onChange={(e) => setForm((f) => ({ ...f, is_paid: e.target.checked }))} /> Paid leave</label>
        </div>
        <Button onClick={save} loading={saving}>Add</Button>
      </div>
    </Modal>
  );
}
