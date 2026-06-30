import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as attApi from '@api/attendanceApi';
import * as employeesApi from '@api/employeesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { Clock, LogIn, LogOut, Plus, RefreshCw, Upload, Download, X, ChevronDown } from 'lucide-react';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || (e?.response?.data?.errors?.[0]?.message) || f;
const statusVariant = (s) => ({ Present: 'success', Late: 'warning', Absent: 'danger', 'Half Day': 'warning', 'On Leave': 'info', Holiday: 'info', Remote: 'info' }[s] || 'info');
const STATUSES = ['Present', 'Absent', 'Late', 'Half Day', 'On Leave', 'Holiday', 'Remote'];
const stLabel = (t, s) => t(`attendance.st_${String(s || '').toLowerCase().replace(/ /g, '_')}`, s);
// work_hours is stored as decimal hours (8.8 = 8h48m); show it as "8h 48m".
const fmtHM = (h) => {
  if (h == null || h === '') return '—';
  const n = Number(h);
  if (Number.isNaN(n)) return '—';
  let hh = Math.floor(n);
  let mm = Math.round((n - hh) * 60);
  if (mm === 60) { hh += 1; mm = 0; }
  return `${hh}h ${String(mm).padStart(2, '0')}m`;
};

export default function Attendance() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isHR = ['admin', 'hr_manager', 'hr_specialist'].includes(user?.role);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [summary, setSummary] = useState(null);
  const [filters, setFilters] = useState({ employee_id: '', from: '', to: '', status: '' });
  const [recModal, setRecModal] = useState(false);
  const [importModal, setImportModal] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
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
    } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId, month]);

  const checkIn = async () => { try { const { data } = await attApi.checkIn(); toast.success(t('attendance.checked_in', { status: stLabel(t, data.status) })); load(); } catch (e) { toast.error(apiErr(e, t('attendance.check_in_failed'))); } };
  const checkOut = async () => { try { const { data } = await attApi.checkOut(); toast.success(t('attendance.checked_out', { hours: data.work_hours })); load(); } catch (e) { toast.error(apiErr(e, t('attendance.check_out_failed'))); } };

  const doExport = async (format) => {
    setExportOpen(false);
    try {
      const params = { format };
      Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
      const { data } = await attApi.exportFile(params);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url; a.download = `attendance_export_${dayjs().format('YYYY-MM-DD')}.${format}`;
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
    } catch { toast.error(t('attendance.export_failed')); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('attendance.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('attendance.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={checkIn}><LogIn size={15} /> {t('attendance.check_in')}</Button>
          <Button variant="secondary" onClick={checkOut}><LogOut size={15} /> {t('attendance.check_out')}</Button>
          {isHR && (
            <>
              <Button variant="secondary" onClick={() => setImportModal(true)}><Upload size={15} /> {t('attendance.import')}</Button>
              <div className="relative">
                <Button variant="secondary" onClick={() => setExportOpen((o) => !o)}><Download size={15} /> {t('attendance.export')} <ChevronDown size={13} /></Button>
                {exportOpen && (
                  <div className="absolute z-20 mt-1 ltr:right-0 rtl:left-0 w-40 bg-white rounded-xl shadow-card border border-surface-100 overflow-hidden">
                    <button onClick={() => doExport('csv')} className="w-full text-start px-3 py-2 text-sm text-surface-700 hover:bg-surface-50">{t('attendance.export_csv')}</button>
                    <button onClick={() => doExport('xlsx')} className="w-full text-start px-3 py-2 text-sm text-surface-700 hover:bg-surface-50">{t('attendance.export_excel')}</button>
                  </div>
                )}
              </div>
              <Button onClick={() => setRecModal(true)}><Plus size={16} /> {t('attendance.record')}</Button>
            </>
          )}
        </div>
      </div>

      {/* Monthly summary */}
      <div className="flex items-center gap-3 flex-wrap">
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-2" />
        {summary && (
          <div className="flex gap-2 flex-wrap">
            {summary.by_status?.map((s) => (
              <Badge key={s.status} variant={statusVariant(s.status)}>{stLabel(t, s.status)}: {s.count}</Badge>
            ))}
            <Badge variant="brand">{t('attendance.total_hours')}: {fmtHM(summary.total_hours)}</Badge>
          </div>
        )}
        <Button variant="ghost" size="sm" onClick={load} className="ml-auto"><RefreshCw size={14} /></Button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {isHR && (
          <select value={filters.employee_id} onChange={(e) => setFilters((f) => ({ ...f, employee_id: e.target.value }))} className="text-xs border border-surface-200 rounded-lg px-3 py-2">
            <option value="">{t('attendance.all_employees')}</option>
            {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
          </select>
        )}
        <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))} className="text-xs border border-surface-200 rounded-lg px-3 py-2" />
        <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))} className="text-xs border border-surface-200 rounded-lg px-3 py-2" />
        <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} className="text-xs border border-surface-200 rounded-lg px-3 py-2">
          <option value="">{t('attendance.all_statuses')}</option>{STATUSES.map((s) => <option key={s} value={s}>{stLabel(t, s)}</option>)}
        </select>
        <Button size="sm" onClick={load}>{t('attendance.apply')}</Button>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Clock className="w-6 h-6 text-surface-400" />} title={t('attendance.no_records')} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
              <th className="text-left p-3">{t('attendance.th_date')}</th><th className="text-left p-3">{t('attendance.th_employee')}</th>
              <th className="p-3">{t('attendance.th_check_in')}</th><th className="p-3">{t('attendance.th_check_out')}</th><th className="p-3">{t('attendance.th_hours')}</th><th className="p-3">{t('attendance.th_status')}</th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-surface-50">
                  <td className="p-3">{dayjs(r.work_date).format('MMM D, YYYY')}</td>
                  <td className="p-3">{r.first_name} {r.last_name}</td>
                  <td className="p-3 text-center">{r.check_in || '—'}</td>
                  <td className="p-3 text-center">{r.check_out || '—'}</td>
                  <td className="p-3 text-center">{fmtHM(r.work_hours)}</td>
                  <td className="p-3 text-center"><Badge variant={statusVariant(r.status)} className="text-[10px]">{stLabel(t, r.status)}</Badge></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <RecordModal open={recModal} onClose={() => setRecModal(false)} employees={employees} onSaved={() => { setRecModal(false); load(); }} />
      <ImportModal open={importModal} onClose={() => setImportModal(false)} onDone={load} />
    </div>
  );
}

function ImportModal({ open, onClose, onDone }) {
  const { t } = useTranslation();
  const [file, setFile] = useState(null);
  const [checkout, setCheckout] = useState('19:00');
  const [lateAfter, setLateAfter] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const reset = () => { setFile(null); setResult(null); setLateAfter(''); setCheckout('19:00'); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!file) { toast.error(t('attendance.import_pick_file')); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('checkout_time', checkout || '19:00');
      if (lateAfter) fd.append('late_after', lateAfter);
      const { data } = await attApi.importFile(fd);
      setResult(data);
      toast.success(t('attendance.import_done', { imported: data.imported, updated: data.updated }));
      onDone();
    } catch (e) { toast.error(apiErr(e, t('attendance.import_failed'))); }
    finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={close} title={t('attendance.import_title')} size="md">
      <div className="space-y-4">
        <p className="text-sm text-surface-500">{t('attendance.import_desc')}</p>

        <div className="relative border-2 border-dashed border-surface-300 rounded-xl p-4 text-center bg-surface-50 hover:border-brand-400 transition cursor-pointer">
          <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => { setFile(e.target.files[0] || null); setResult(null); }}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <span className="text-sm text-surface-600 flex items-center justify-center gap-2">
            <Upload size={15} className="text-brand-600" /> {file ? file.name : t('attendance.import_choose_file')}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-semibold text-surface-700">{t('attendance.import_checkout')}</label>
            <input type="time" value={checkout} onChange={(e) => setCheckout(e.target.value)} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" />
          </div>
          <div>
            <label className="text-xs font-semibold text-surface-700">{t('attendance.import_late_after')}</label>
            <input type="time" value={lateAfter} onChange={(e) => setLateAfter(e.target.value)} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" />
            <p className="text-[10px] text-surface-400 mt-1">{t('attendance.import_late_hint')}</p>
          </div>
        </div>

        {result && (
          <div className="rounded-xl border border-surface-100 bg-surface-50/60 p-3 space-y-2 text-sm">
            <div className="flex gap-2 flex-wrap">
              <Badge variant="success">{t('attendance.im_imported')}: {result.imported}</Badge>
              <Badge variant="info">{t('attendance.im_updated')}: {result.updated}</Badge>
              <Badge variant="warning">{t('attendance.im_skipped')}: {result.skipped}</Badge>
            </div>
            {result.unmatched?.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-surface-700 mt-1">{t('attendance.im_unmatched')} ({result.unmatched.length})</p>
                <p className="text-[11px] text-surface-500 mb-1">{t('attendance.import_unmatched_hint')}</p>
                <div className="max-h-32 overflow-auto text-xs text-surface-600 space-y-0.5">
                  {result.unmatched.map((u) => (
                    <div key={u.id} className="flex justify-between gap-2 border-b border-surface-100 py-0.5">
                      <span className="font-mono">{u.id}</span><span className="truncate flex-1 text-surface-500">{u.name}</span><span>{u.rows}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={close}><X size={15} /> {t('common.close', 'Close')}</Button>
          <Button onClick={submit} loading={busy}><Upload size={15} /> {t('attendance.import_run')}</Button>
        </div>
      </div>
    </Modal>
  );
}

function RecordModal({ open, onClose, employees = [], onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState({ employee_id: '', work_date: dayjs().format('YYYY-MM-DD'), check_in: '', check_out: '', status: 'Present', notes: '' });
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (!form.employee_id || !form.work_date) { toast.error(t('attendance.emp_date_required')); return; }
    setSaving(true);
    try {
      const body = { ...form, employee_id: Number(form.employee_id) };
      if (body.check_in) body.check_in = `${form.work_date} ${form.check_in}:00`;
      if (body.check_out) body.check_out = `${form.work_date} ${form.check_out}:00`;
      await attApi.record(body); toast.success(t('attendance.recorded')); onSaved();
    } catch (e) { toast.error(apiErr(e, t('attendance.record_failed'))); } finally { setSaving(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title={t('attendance.modal_record')} size="md">
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="text-xs font-semibold text-surface-700">{t('attendance.f_employee')} *</label>
            <select value={form.employee_id} onChange={(e) => setForm((f) => ({ ...f, employee_id: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">
              <option value="">{t('attendance.select_employee')}</option>
              {employees.map((emp) => <option key={emp.id} value={emp.id}>{emp.first_name} {emp.last_name}</option>)}
            </select></div>
          <div><label className="text-xs font-semibold text-surface-700">{t('attendance.f_date')} *</label><input type="date" value={form.work_date} onChange={(e) => setForm((f) => ({ ...f, work_date: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-xs font-semibold text-surface-700">{t('attendance.f_check_in')}</label><input type="time" value={form.check_in} onChange={(e) => setForm((f) => ({ ...f, check_in: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
          <div><label className="text-xs font-semibold text-surface-700">{t('attendance.f_check_out')}</label><input type="time" value={form.check_out} onChange={(e) => setForm((f) => ({ ...f, check_out: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1" /></div>
        </div>
        <div><label className="text-xs font-semibold text-surface-700">{t('attendance.f_status')}</label>
          <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} className="w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1">{STATUSES.map((s) => <option key={s} value={s}>{stLabel(t, s)}</option>)}</select></div>
        <Button onClick={save} loading={saving}>{t('common.save')}</Button>
      </div>
    </Modal>
  );
}
