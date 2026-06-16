import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as attApi from '@api/attendanceApi';
import * as employeesApi from '@api/employeesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { Clock, LogIn, LogOut, Plus, RefreshCw } from 'lucide-react';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || (e?.response?.data?.errors?.[0]?.message) || f;
const statusVariant = (s) => ({ Present: 'success', Late: 'warning', Absent: 'danger', 'Half Day': 'warning', 'On Leave': 'info', Holiday: 'info', Remote: 'info' }[s] || 'info');
const STATUSES = ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Remote'];

export default function Attendance() {
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isHR = ['admin', 'hr_manager', 'hr_specialist'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ employee_id: '', from: '', to: '', status: '' });
  const [recModal, setRecModal] = useState(false);
  const [employees, setEmployees] = useState([]);

  useEffect(() => {
    if (!isHR) return;
    (async () => { try { const e = await employeesApi.getEmployees({ limit: 500 }); setEmployees(e.data.data || []); } catch { /* ignore */ } })();
  }, [currentCompanyId, isHR]);

  const load = async () => {
    setLoading(true);
    try {
      const params = {};
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const [l, s] = await Promise.all([attApi.list(params), attApi.summary({ month, ...(filters.employee_id ? { employee_id: filters.employee_id } : {}) })]);
      setRows(l.data); setSummary(s.data);
    } catch { toast.error('Failed to load attendance'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId, month]);

  const checkIn = async () => { try { const { data } = await attApi.checkIn(); toast.success(`Checked in (${data.status})`); load(); } catch (e) { toast.error(apiErr(e, 'Check-in failed')); } };
  const checkOut = async () => { try { const { data } = await attApi.checkOut(); toast.success(`Checked out (${data.work_hours}h)`); load(); } catch (e) { toast.error(apiErr(e, 'Check-out failed')); } };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Attendance</h1>
          <p className="text-surface-500 mt-0.5 text-sm">Daily check-in / check-out and monthly summary</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={checkIn}><LogIn size={15} /> Check in</Button>
          <Button variant="secondary" onClick={checkOut}><LogOut size={15} /> Check out</Button>
          {isHR && <Button onClick={() => setRecModal(true)}><Plus size={16} /> Record</Button>}
        </div>
      </div>

      {/* Monthly summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-2" />
        {summary && (
          <div className="flex gap-2 flex-wrap">
            {summary.by_status?.map((s) => (
              <Badge key={s.status} variant={statusVariant(s.status)}>{s.status}: {s.count}</Badge>
            ))}
            <Badge variant="brand">Total hours: {summary.total_hours}</Badge>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={load} className="ml-auto"><RefreshCw size={14} /></Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {isHR && (
          <select value={filters.employee_id} onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))} className="text-xs border border-surface-200 rounded-lg px-3 py-2">
            <option value="">All employees</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
          </select>
        )}
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="text-xs border border-surface-200 rounded-lg px-3 py-2" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="text-xs border border-surface-200 rounded-lg px-3 py-2" />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="text-xs border border-surface-200 rounded-lg px-3 py-2">
          <option value="">All statuses</option>{STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
        <Button size="sm" onClick={load}>Apply</Button>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Clock className="w-6 h-6 text-surface-400" />} title="No attendance records" /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
              <th className="text-left p-3">Date</th><th className="text-left p-3">Employee</th>
              <th className="p-3">Check-in</th><th className="p-3">Check-out</th><th className="p-3">Hours</th><th className="p-3">Status</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-50">
                  <td className="p-3">{dayjs(r.work_date).format('MMM D, YYYY')}</td>
                  <td className="p-3">{r.first_name} {r.last_name}</td>
                  <td className="p-3 text-center">{r.check_in ? dayjs(r.check_in).format('HH:mm') : '—'}</td>
                  <td className="p-3 text-center">{r.check_out ? dayjs(r.check_out).format('HH:mm') : '—'}</td>
                  <td className="p-3 text-center">{r.work_hours ?? '—'}</td>
                  <td className="p-3 text-center"><Badge variant={statusVariant(r.status)} className="text-[10px]">{r.status}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <RecordModal open={recModal} onClose={() => setRecModal(false)} employees={employees} onSaved={() => { setRecModal(false); load(); }} />
    </div>
  );
}

function RecordModal({ open, onClose, employees = [], onSaved }) {
  const [form, setForm] = useState({ employee_id: '', work_date: dayjs().format('YYYY-MM-DD'), check_in: '', check_out: '', status: 'Present', notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.employee_id || !form.work_date) { toast.error('Employee and date are required'); return; }
    setSaving(true);
    try {
      const body = { ...form, employee_id: Number(form.employee_id) };
      if (body.check_in) body.check_in = `${form.work_date} ${form.check_in}:00`;
      if (body.check_out) body.check_out = `${form.work_date} ${form.check_out}:00`;
      await attApi.record(body); toast.success('Attendance recorded'); onSaved();
    } catch (e) { toast.error(apiErr(e, 'Failed to record')); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Record Attendance" size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-surface-700">Employee *</label>
            <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
              <option value="">Select employee…</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select></div>
          <div><label className="text-xs font-semibold text-surface-700">Date *</label><input type="date" value={form.work_date} onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-xs font-semibold text-surface-700">Check-in (HH:mm)</label><input type="time" value={form.check_in} onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-xs font-semibold text-surface-700">Check-out (HH:mm)</label><input type="time" value={form.check_out} onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        </div>
        <div><label className="text-xs font-semibold text-surface-700">Status</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">{STATUSES.map((s) => <option key={s}>{s}</option>)}</select></div>
        <Button onClick={save} loading={saving}>Save</Button>
      </div>
    </Modal>
  );
}
