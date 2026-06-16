import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as payApi from '@api/payrollApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { confirmDelete } from '@utils/confirm';
import { Banknote, Plus, RefreshCw, Loader2, CheckCircle2, Trash2 } from 'lucide-react';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || (e?.response?.data?.errors?.[0]?.message) || f;
const statusVariant = (s) => ({ Draft: 'info', Approved: 'warning', Paid: 'success', Cancelled: 'danger' }[s] || 'info');

export default function PayrollRuns() {
  const { user } = useSelector((s) => s.auth);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const isAdmin = user?.role === 'admin';
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(dayjs().format('YYYY-MM'));
  const [generating, setGenerating] = useState(false);
  const [openRun, setOpenRun] = useState(null);
  const [detail, setDetail] = useState(null);
  const [myslips, setMyslips] = useState([]);

  const load = async () => {
    setLoading(true);
    try { const { data } = await payApi.getRuns(); setRuns(data); } catch { toast.error('Failed to load payroll runs'); }
    finally { setLoading(false); }
    try { const { data } = await payApi.myPayslips({}); setMyslips(data); } catch { /* ignore */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentCompanyId]);

  const generate = async () => {
    setGenerating(true);
    try { const { data } = await payApi.generateRun({ period }); toast.success(`Run generated: ${data.employee_count} employee(s), net ${data.total_net}`); load(); }
    catch (e) { toast.error(apiErr(e, 'Generate failed')); } finally { setGenerating(false); }
  };
  const openDetail = async (r) => { setOpenRun(r); try { const { data } = await payApi.getRun(r.id); setDetail(data); } catch { toast.error('Failed to load run'); } };
  const reloadDetail = async () => { if (openRun) { const { data } = await payApi.getRun(openRun.id); setDetail(data); } load(); };

  const approve = async (r) => { try { await payApi.approveRun(r.id); toast.success('Run approved'); reloadDetail(); } catch (e) { toast.error(apiErr(e, 'Failed')); } };
  const pay = async (r) => { try { await payApi.markPaid(r.id); toast.success('Marked paid'); reloadDetail(); } catch (e) { toast.error(apiErr(e, 'Failed')); } };
  const del = async (r) => { const c = await confirmDelete(`payroll run ${r.period}`); if (!c.isConfirmed) return; try { await payApi.deleteRun(r.id); toast.success('Deleted'); setOpenRun(null); setDetail(null); load(); } catch (e) { toast.error(apiErr(e, 'Failed')); } };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">Payroll Runs</h1>
          <p className="text-surface-500 mt-0.5 text-sm">Generate monthly payroll (pulls unpaid leave + absence deductions), approve and pay</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="month" value={period} onChange={(e) => setPeriod(e.target.value)} className="text-sm border border-surface-200 rounded-lg px-3 py-2" />
          <Button onClick={generate} loading={generating}><Plus size={16} /> Generate run</Button>
          <Button variant="secondary" onClick={load}><RefreshCw size={14} /></Button>
        </div>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : runs.length === 0 ? (
        <Card><EmptyState icon={<Banknote className="w-6 h-6 text-surface-400" />} title="No payroll runs" description="Pick a month and click Generate run." /></Card>
      ) : (
        <div className="space-y-2">
          {runs.map((r) => (
            <Card key={r.id} hover className="!p-4 cursor-pointer" onClick={() => openDetail(r)}>
              <div className="flex items-center gap-4 flex-wrap">
                <div className="w-10 h-10 rounded-xl bg-brand-100 flex items-center justify-center text-brand-700"><Banknote size={18} /></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2"><span className="font-semibold text-surface-900">{dayjs(r.period + '-01').format('MMMM YYYY')}</span><Badge variant={statusVariant(r.status)}>{r.status}</Badge></div>
                  <p className="text-xs text-surface-400 mt-0.5">{r.employee_count} employees · gross {r.total_gross} · deductions {r.total_deductions}</p>
                </div>
                <div className="text-right"><p className="text-xs text-surface-400">Net total</p><p className="font-bold text-brand-600">{r.total_net}</p></div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* My payslips */}
      {myslips.length > 0 && (
        <Card className="!p-0 overflow-hidden">
          <div className="p-4 border-b border-surface-100"><h3 className="font-semibold text-surface-800">My Payslips</h3></div>
          <table className="w-full text-sm">
            <thead className="bg-surface-50 text-surface-500 text-xs"><tr><th className="text-left p-3">Period</th><th className="p-3">Gross</th><th className="p-3">Deductions</th><th className="p-3">Net</th><th className="p-3">Status</th></tr></thead>
            <tbody>{myslips.map((s) => (
              <tr key={s.id} className="border-t border-surface-50"><td className="p-3">{dayjs(s.period + '-01').format('MMM YYYY')}</td><td className="p-3 text-center">{s.gross}</td><td className="p-3 text-center">{s.deductions}</td><td className="p-3 text-center font-semibold text-brand-600">{s.net}</td><td className="p-3 text-center"><Badge variant={statusVariant(s.run_status)} className="text-[10px]">{s.run_status}</Badge></td></tr>
            ))}</tbody>
          </table>
        </Card>
      )}

      <Modal open={!!openRun} onClose={() => { setOpenRun(null); setDetail(null); }} title={detail ? `Payroll — ${dayjs(detail.period + '-01').format('MMMM YYYY')}` : 'Loading'} size="xl">
        {!detail ? <div className="flex justify-center py-10"><Loader2 className="w-7 h-7 text-brand-600 animate-spin" /></div> : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 flex-wrap p-3 bg-surface-50 rounded-xl">
              <Badge variant={statusVariant(detail.status)}>{detail.status}</Badge>
              <span className="text-sm text-surface-600">{detail.employee_count} employees</span>
              <span className="text-sm text-surface-600">Net: <b className="text-brand-600">{detail.total_net}</b></span>
              <div className="ml-auto flex gap-2">
                {detail.status === 'Draft' && <Button size="sm" onClick={() => approve(detail)}><CheckCircle2 size={14} /> Approve</Button>}
                {detail.status === 'Approved' && isAdmin && <Button size="sm" onClick={() => pay(detail)}>Mark paid</Button>}
                {detail.status === 'Draft' && isAdmin && <Button size="sm" variant="danger" onClick={() => del(detail)}><Trash2 size={14} /></Button>}
              </div>
            </div>
            <Card className="!p-0 overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                  <th className="text-left p-3">Employee</th><th className="p-3">Basic</th><th className="p-3">Allowances</th><th className="p-3">Gross</th>
                  <th className="p-3">Unpaid</th><th className="p-3">Absence</th><th className="p-3">Deductions</th><th className="p-3">Net</th></tr></thead>
                <tbody>{(detail.items || []).map((it) => (
                  <tr key={it.id} className="border-t border-surface-50">
                    <td className="p-3">{it.first_name} {it.last_name}</td>
                    <td className="p-3 text-center">{it.basic_salary}</td><td className="p-3 text-center">{it.allowances}</td><td className="p-3 text-center">{it.gross}</td>
                    <td className="p-3 text-center">{it.unpaid_leave_days}</td><td className="p-3 text-center">{it.absence_days}</td>
                    <td className="p-3 text-center text-red-500">{it.deductions}</td><td className="p-3 text-center font-semibold text-brand-600">{it.net}</td>
                  </tr>
                ))}</tbody>
              </table>
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
}
