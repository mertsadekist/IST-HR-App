import { useState, useEffect, useRef, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as leaveApi from '@api/leaveApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import { useMyCompany } from './useMyCompany';
import LeaveReport from './components/LeaveReport';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import { toast } from 'react-toastify';
import { CalendarDays, Download, Plus, Send, X } from 'lucide-react';
import dayjs from 'dayjs';

/** One round trip for everything the page shows. Failures degrade to empty. */
const fetchLeave = () => Promise.all([
  leaveApi.getBalances().catch(() => ({ data: [] })),
  leaveApi.getRequests().catch(() => ({ data: [] })),
  leaveApi.getTypes().catch(() => ({ data: [] })),
]);

const apiErr = (e, f) => e?.response?.data?.error || e?.response?.data?.errors?.[0]?.message || f;

/** Inclusive whole-day count, matching how the server counts the request. */
const inclusiveDays = (from, to) => {
  if (!from || !to) return 0;
  const d = dayjs(to).diff(dayjs(from), 'day') + 1;
  return d > 0 ? d : 0;
};

export default function MyLeave() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const myCompany = useMyCompany();
  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const reportRef = useRef(null);

  // The fetch is a plain function outside the component and the state writes
  // live in one place, so the effect and the post-submit refresh share it
  // without either writing state synchronously.
  const apply = useCallback(([bal, req, typ]) => {
    setBalances(bal.data || []);
    setRequests(req.data || []);
    setTypes(typ.data || []);
    setLoading(false);
  }, []);

  const reload = useCallback(() => fetchLeave().then(apply), [apply]);

  useEffect(() => {
    let alive = true;
    fetchLeave().then((res) => { if (alive) apply(res); });
    return () => { alive = false; };
  }, [apply]);

  const currentYear = new Date().getFullYear();
  const yearBalances = balances.filter((b) => Number(b.year) === currentYear);
  const shown = yearBalances.length ? yearBalances : balances;
  const totalRemaining = shown.reduce((s, b) => s + Number(b.remaining || 0), 0);
  const taken = requests
    .filter((r) => r.status === 'Approved' && dayjs(r.start_date).year() === currentYear)
    .reduce((s, r) => s + Number(r.days || 0), 0);
  const pending = requests.filter((r) => r.status === 'Pending').length;

  const requestedDays = inclusiveDays(form.start_date, form.end_date);
  const chosenBalance = shown.find((b) => String(b.leave_type_id) === String(form.leave_type_id));
  // Advisory only — HR decides. Blocking here would stop a legitimate request
  // for a type whose entitlement has simply not been set up yet.
  const overBalance = chosenBalance && requestedDays > Number(chosenBalance.remaining || 0);

  const submit = async (e) => {
    e.preventDefault();
    if (!form.leave_type_id || !form.start_date || !form.end_date) {
      toast.error(t('portal.req_missing')); return;
    }
    if (requestedDays <= 0) { toast.error(t('portal.req_bad_range')); return; }
    setSaving(true);
    try {
      await leaveApi.createRequest({
        leave_type_id: Number(form.leave_type_id),
        start_date: form.start_date,
        end_date: form.end_date,
        reason: form.reason.trim() || undefined,
      });
      toast.success(t('portal.req_sent'));
      setFormOpen(false);
      setForm({ leave_type_id: '', start_date: '', end_date: '', reason: '' });
      reload();
    } catch (err) {
      toast.error(apiErr(err, t('portal.req_failed')));
    } finally { setSaving(false); }
  };

  const cancel = async (r) => {
    try {
      await leaveApi.cancelRequest(r.id);
      toast.success(t('portal.req_cancelled'));
      reload();
    } catch (err) { toast.error(apiErr(err, t('common.operation_failed'))); }
  };

  const download = async () => {
    setExporting(true);
    try {
      await waitForPaint();
      const who = (user?.name || 'employee').replace(/[^\w-]+/g, '_');
      await printElementWithLetterhead(reportRef.current, myCompany?.id, `Leave-Statement-${who}.pdf`);
      toast.success(t('portal.pdf_downloaded'));
    } catch { toast.error(t('portal.pdf_failed')); }
    finally { setExporting(false); }
  };

  return (
    <PortalShell
      icon={CalendarDays}
      title={t('portal.leave_section')}
      subtitle={t('portal.leave_subtitle')}
      stats={[
        { value: totalRemaining, label: t('portal.leave_days_left') },
        { value: taken, label: t('portal.days_taken') },
        { value: pending, label: t('portal.pending_requests') },
      ]}
      actions={(
        <div className="flex items-center gap-2">
          <Button size="sm" variant="secondary" onClick={download} loading={exporting}
            disabled={loading || (shown.length === 0 && requests.length === 0)}>
            <Download size={14} /> {t('portal.download_pdf')}
          </Button>
          <Button size="sm" onClick={() => setFormOpen(true)}>
            <Plus size={14} /> {t('portal.request_leave')}
          </Button>
        </div>
      )}
    >
      {shown.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {shown.map((b) => {
            const entitled = Number(b.entitled || 0);
            const used = Number(b.used || 0);
            const pct = entitled > 0 ? Math.min(100, (used / entitled) * 100) : 0;
            return (
              <Card key={b.id} className="!p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: b.color || '#7C3AED' }} />
                  <span className="text-sm font-semibold text-surface-800 truncate">{b.leave_type_name}</span>
                  <span className="ms-auto text-[10px] text-surface-400">{b.year}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold text-surface-900">{Number(b.remaining || 0)}</span>
                  <span className="text-xs text-surface-400">/ {entitled} {t('portal.days')}</span>
                </div>
                <div className="h-1.5 bg-surface-100 rounded-full mt-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: b.color || '#7C3AED' }} />
                </div>
                <p className="text-[11px] text-surface-400 mt-1.5">{t('portal.used_of', { used, entitled })}</p>
              </Card>
            );
          })}
        </div>
      )}

      <Card className="!p-4">
        <p className="text-xs text-surface-500">
          {t('portal.leave_summary', { taken, remaining: totalRemaining, year: currentYear })}
        </p>
      </Card>

      {loading ? (
        <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : requests.length === 0 ? (
        <Card><EmptyState icon={<CalendarDays className="w-6 h-6 text-surface-400" />}
          title={t('portal.no_leave')} description={t('portal.no_leave_desc')}
          action={<Button onClick={() => setFormOpen(true)}><Plus size={16} /> {t('portal.request_leave')}</Button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.leave_type')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.from')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.to')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('portal.days')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.status')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('portal.decided_by')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {requests.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-50/60">
                    <td className="px-5 py-3">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: r.color || '#7C3AED' }} />
                        <span className="font-medium text-surface-800">{r.leave_type_name}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3 text-surface-600">{r.start_date}</td>
                    <td className="px-5 py-3 text-surface-600">{r.end_date}</td>
                    <td className="px-5 py-3 text-end font-medium text-surface-700">{r.days}</td>
                    <td className="px-5 py-3">
                      <Badge className="text-[10px]" variant={
                        r.status === 'Approved' ? 'active' : r.status === 'Rejected' ? 'danger'
                          : r.status === 'Cancelled' ? 'inactive' : 'warning'}>
                        {t(`portal.lv_${String(r.status || '').toLowerCase()}`, r.status)}
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-surface-500 text-xs">{r.approver_name || r.decided_by_name || '—'}</td>
                    <td className="px-5 py-3 text-end">
                      {/* Only a request nobody has decided yet is the employee's
                          to withdraw. */}
                      {r.status === 'Pending' && (
                        <button onClick={() => cancel(r)} title={t('portal.withdraw')}
                          className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                          <X size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Request form — lands in HR's Leave queue as Pending and notifies them */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={t('portal.request_leave')} size="md">
        <form onSubmit={submit} className="space-y-4">
          <p className="text-xs text-surface-500">{t('portal.req_intro')}</p>
          <Select label={t('portal.leave_type')} required value={form.leave_type_id}
            onChange={(e) => setForm((p) => ({ ...p, leave_type_id: e.target.value }))}
            options={types.map((ty) => ({ value: String(ty.id), label: ty.name }))}
            placeholder={t('common.select', 'Select...')} />
          <div className="grid grid-cols-2 gap-4">
            <Input type="date" label={t('portal.from')} required value={form.start_date}
              onChange={(e) => setForm((p) => ({ ...p, start_date: e.target.value }))} />
            <Input type="date" label={t('portal.to')} required value={form.end_date} min={form.start_date || undefined}
              onChange={(e) => setForm((p) => ({ ...p, end_date: e.target.value }))} />
          </div>

          {requestedDays > 0 && (
            <div className={`text-xs rounded-xl border p-3 ${overBalance
              ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-surface-50 border-surface-200 text-surface-600'}`}>
              {t('portal.req_days', { days: requestedDays })}
              {chosenBalance && ` · ${t('portal.req_balance', { remaining: Number(chosenBalance.remaining || 0) })}`}
              {overBalance && <div className="mt-1 font-medium">{t('portal.req_over_balance')}</div>}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('portal.reason')}</label>
            <textarea rows={3} value={form.reason} placeholder={t('portal.reason_ph')}
              onChange={(e) => setForm((p) => ({ ...p, reason: e.target.value }))}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}><Send size={14} /> {t('portal.req_submit')}</Button>
          </div>
        </form>
      </Modal>

      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        <LeaveReport ref={reportRef} employeeName={user?.name} company={myCompany}
          balances={shown} requests={requests} year={currentYear} onLetterhead={!!myCompany?.letterhead_path} />
      </div>
    </PortalShell>
  );
}
