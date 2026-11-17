import { useState, useEffect } from 'react';
import { Download } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Badge from '@components/ui/Badge';
import * as leaveApi from '@api/leaveApi';

/**
 * Per-employee leave history with its supporting documents, reusing the
 * existing GET /leave/report endpoint.
 */
export default function EmployeeLeaveTab({ employee, t }) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState({});

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    leaveApi.getReport({ employee_id: employee.id, year })
      .then(async ({ data }) => {
        if (cancelled) return;
        setReport(data);
        // Pull attachments only for requests that actually have some.
        const withFiles = (data.requests || []).filter((r) => Number(r.file_count) > 0);
        const pairs = await Promise.all(withFiles.map((r) =>
          leaveApi.getRequestFiles(r.id).then(({ data: f }) => [r.id, f]).catch(() => [r.id, []])));
        if (!cancelled) setFiles(Object.fromEntries(pairs));
      })
      .catch(() => { if (!cancelled) setReport(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id, year]);

  const download = async (f) => {
    try {
      const res = await leaveApi.downloadLeaveFile(f.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = f.file_name || 'document';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error(t('toasts.t_failed_to_download_document')); }
  };

  const statusColor = (s) => ({ Approved: 'success', Rejected: 'danger', Cancelled: 'danger', Pending: 'warning' }[s] || 'info');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <label className="text-xs font-semibold text-surface-700">{t('leave.report_year')}</label>
        <input type="number" value={year} onChange={(e) => setYear(Number(e.target.value) || new Date().getFullYear())}
          className="text-xs border border-surface-200 rounded-lg px-2 py-1.5 w-24" />
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="card p-3 animate-pulse"><div className="h-3 bg-surface-200 rounded w-1/3" /></div>)}</div>
      ) : !report ? (
        <p className="text-xs text-surface-400">{t('common.failed_load')}</p>
      ) : (
        <>
          <table className="w-full text-xs">
            <thead className="bg-surface-50 text-surface-500"><tr>
              <th className="text-left p-2">{t('leave.th_type')}</th><th className="p-2">{t('leave.th_entitled')}</th>
              <th className="p-2">{t('leave.th_used')}</th><th className="p-2">{t('leave.th_remaining')}</th></tr></thead>
            <tbody>
              {(report.summary || []).map((s) => (
                <tr key={s.leave_type_id} className="border-t border-surface-50">
                  <td className="p-2">{s.name}</td>
                  <td className="p-2 text-center">{s.entitled}</td>
                  <td className="p-2 text-center">{s.used}</td>
                  <td className="p-2 text-center font-semibold text-brand-600">{Math.max(0, s.entitled - s.used)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {(report.requests || []).length === 0 ? (
            <p className="text-xs text-surface-400">{t('leave.no_report_requests')}</p>
          ) : (
            <div className="space-y-2">
              {report.requests.map((r) => (
                <div key={r.id} className="p-2.5 rounded-lg border border-surface-100">
                  <div className="flex items-center gap-2 flex-wrap text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ background: r.color || '#7c3aed' }} />
                    <span className="font-semibold text-surface-800">{r.leave_type_name}</span>
                    <Badge variant={statusColor(r.status)} className="text-[10px]">{r.status}</Badge>
                    <span className="text-surface-500">{dayjs(r.start_date).format('MMM D')} → {dayjs(r.end_date).format('MMM D, YYYY')} · {r.days} {t('leave.days')}</span>
                  </div>
                  {r.reason && <p className="text-[11px] text-surface-500 mt-1">{r.reason}</p>}
                  {(r.approver_name || r.decided_by_name) && (
                    <p className="text-[11px] text-surface-400 mt-0.5">
                      {t('leave.th_decided_by')} {r.approver_name || r.decided_by_name}
                      {r.decided_at ? ` · ${dayjs(r.decided_at).format('MMM D, YYYY')}` : ''}
                    </p>
                  )}
                  {(files[r.id] || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {files[r.id].map((f) => (
                        <button key={f.id} onClick={() => download(f)}
                          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-md bg-surface-100 hover:bg-surface-200 text-surface-600">
                          <Download size={11} /> {t(`leave.kind_${f.kind}`)}: {f.file_name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
