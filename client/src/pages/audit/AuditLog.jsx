import { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import * as auditApi from '@api/auditApi';
import LogReport from '@components/reports/LogReport';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { ClipboardList, Search, RefreshCw, Download, X } from 'lucide-react';
import Button from '@components/ui/Button';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
dayjs.extend(relativeTime);

const moduleColors = {
  Auth: 'info', Companies: 'brand', Departments: 'active', Skills: 'warning',
  Users: 'danger', Candidates: 'info', Employees: 'active', AI: 'brand',
};

const EMPTY_FILTERS = { user: '', module: '', action: '', from: '', to: '', search: '' };
const PAGE_SIZE = 50;

export default function AuditLog() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState({ modules: [], actions: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [exporting, setExporting] = useState(false);
  const [reportRows, setReportRows] = useState(null);
  const reportRef = useRef(null);
  const { currentCompanyId } = useSelector((s) => s.entity);

  const hasFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Build the query params: drop empty values. The audit log is a global
  // security trail — it is NOT scoped to the selected Entity, so rows with a
  // NULL company_id (logins, system/pre-migration events) always appear.
  const params = useMemo(() => {
    // limit stays within the server's cap of 100; the page used to ask for 200
    // and silently receive at most 100 while displaying the true total.
    const p = { page, limit: PAGE_SIZE };
    for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
    return p;
  }, [filters, page]);

  const set = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
  const clearFilters = () => { setFilters(EMPTY_FILTERS); setPage(1); };

  // Load the distinct module/action lists for the dropdowns (once).
  useEffect(() => {
    auditApi.getAuditFacets()
      .then(({ data }) => setFacets({ modules: data.modules || [], actions: data.actions || [] }))
      .catch(() => { /* non-blocking */ });
  }, []);

  // Reload (debounced) whenever a filter or the company changes.
  useEffect(() => {
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const { data } = await auditApi.getAuditLogs(params);
        setLogs(Array.isArray(data) ? data : data.data || []);
        setTotal(typeof data?.total === 'number' ? data.total : (data.data || data || []).length);
      } catch {
        toast.error(t('toasts.t_failed_to_load_audit_logs'));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(id);
  }, [params, t]);

  // The audit trail itself is global, but the letterhead has to come from some
  // company — the entity the operator is working in.
  const exportPdf = async () => {
    setExporting(true);
    try {
      const { data } = await auditApi.exportAuditLogs(params);
      const parsed = data instanceof Blob ? JSON.parse(await data.text()) : data;
      setReportRows(parsed.logs || []);
      await waitForPaint();
      await printElementWithLetterhead(reportRef.current, currentCompanyId, `audit-log-${dayjs().format('YYYY-MM-DD')}.pdf`);
    } catch (e) {
      toast.error(e.message || t('audit.export_failed'));
    } finally { setExporting(false); }
  };

  const exportLogs = async () => {
    try {
      const { data } = await auditApi.exportAuditLogs(params);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_export_${dayjs().format('YYYY-MM-DD')}.json`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(t('toasts.t_failed_to_load_audit_logs'));
    }
  };

  const fieldCls = 'w-full px-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus';

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('audit.title', 'Audit Log')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('audit.subtitle', 'Track all system actions and changes')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportPdf} loading={exporting}>
            <Download size={16} /> {t('audit.export_pdf')}
          </Button>
          <Button variant="secondary" onClick={exportLogs}>
            <Download size={16} /> {t('audit.export_json', 'Export JSON')}
          </Button>
          <Button variant="secondary" onClick={() => setFilters((f) => ({ ...f }))}>
            <RefreshCw size={16} /> {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="!p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* User */}
          <div className="relative">
            <Search className="absolute ltr:left-3 rtl:right-3 top-1/2 -translate-y-1/2 text-surface-400" size={15} />
            <input type="text" value={filters.user} onChange={(e) => set('user', e.target.value)}
              placeholder={t('audit.filter_user', 'Filter by user…')} className={`${fieldCls} ltr:pl-9 rtl:pr-9`} />
          </div>
          {/* Module */}
          <select value={filters.module} onChange={(e) => set('module', e.target.value)} className={fieldCls}>
            <option value="">{t('audit.all_modules', 'All modules')}</option>
            {facets.modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
          {/* Action */}
          <select value={filters.action} onChange={(e) => set('action', e.target.value)} className={fieldCls}>
            <option value="">{t('audit.all_actions', 'All actions')}</option>
            {facets.actions.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {/* From */}
          <div>
            <label className="block text-[11px] font-medium text-surface-400 mb-1">{t('audit.from', 'From')}</label>
            <input type="datetime-local" value={filters.from} onChange={(e) => set('from', e.target.value)} className={fieldCls} />
          </div>
          {/* To */}
          <div>
            <label className="block text-[11px] font-medium text-surface-400 mb-1">{t('audit.to', 'To')}</label>
            <input type="datetime-local" value={filters.to} onChange={(e) => set('to', e.target.value)} className={fieldCls} />
          </div>
          {/* Details */}
          <input type="text" value={filters.search} onChange={(e) => set('search', e.target.value)}
            placeholder={t('audit.filter_details', 'Filter by details…')} className={fieldCls} />
        </div>
        <div className="flex items-center justify-between mt-3">
          <Badge variant="brand">{total} {t('audit.entries', 'entries')}</Badge>
          {hasFilters && (
            <button onClick={clearFilters} className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-red-600 transition-colors">
              <X size={13} /> {t('audit.clear_filters', 'Clear filters')}
            </button>
          )}
        </div>
      </Card>

      {/* Log Table */}
      {loading ? (
        <Card className="animate-pulse !p-8"><div className="h-4 bg-surface-200 rounded w-1/2 mb-4" /><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : logs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="w-6 h-6 text-surface-400" />}
            title={hasFilters ? t('audit.no_matching_logs', 'No matching logs') : t('audit.no_activity_yet', 'No activity yet')}
            description={t('audit.no_activity_desc', 'System actions will be recorded here automatically')}
          />
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/60">
                  <th className="text-start px-5 py-3 font-medium text-surface-500">{t('audit.time', 'Time')}</th>
                  <th className="text-start px-5 py-3 font-medium text-surface-500">{t('audit.user', 'User')}</th>
                  <th className="text-start px-5 py-3 font-medium text-surface-500">{t('audit.module', 'Module')}</th>
                  <th className="text-start px-5 py-3 font-medium text-surface-500">{t('audit.action', 'Action')}</th>
                  <th className="text-start px-5 py-3 font-medium text-surface-500">{t('audit.details', 'Details')}</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors">
                    <td className="px-5 py-3 text-surface-400 text-xs whitespace-nowrap">
                      <span title={dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}>
                        {dayjs(log.created_at).fromNow()}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-[10px]">
                          {log.user_name?.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-surface-700 font-medium">{log.user_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={moduleColors[log.module] || 'info'} className="!text-[10px]">{log.module}</Badge>
                    </td>
                    <td className="px-5 py-3 font-medium text-surface-700">{log.action}</td>
                    <td className="px-5 py-3 text-surface-500 max-w-xs truncate" title={log.detail}>{log.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100 bg-surface-50/30">
              <p className="text-xs text-surface-400">
                {t('audit.showing')} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t('audit.of')} {total}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {t('common.previous', 'Previous')}
                </button>
                <span className="px-3 py-1.5 text-xs text-surface-500">{page} / {totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                  {t('common.next', 'Next')}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Off-screen printable report — captured by html2canvas on export */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        {reportRows && (
          <LogReport
            ref={reportRef}
            title="Audit Log Report"
            subtitle="تقرير سجل التدقيق"
            appliedFilters={Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)}
            columns={AUDIT_REPORT_COLUMNS}
            rows={reportRows}
          />
        )}
      </div>
    </div>
  );
}

const AUDIT_REPORT_COLUMNS = [
  { key: 'created_at', label: 'Time', width: '14%', format: (v) => (v ? dayjs(v).format('DD/MM/YY HH:mm') : '—') },
  { key: 'user_name', label: 'User', width: '16%' },
  { key: 'module', label: 'Module', width: '13%' },
  { key: 'action', label: 'Action', width: '15%' },
  { key: 'detail', label: 'Details' },
];
