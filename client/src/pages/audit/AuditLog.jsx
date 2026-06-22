import { useState, useEffect, useMemo } from 'react';
import { useSelector } from 'react-redux';
import * as auditApi from '@api/auditApi';
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

export default function AuditLog() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [facets, setFacets] = useState({ modules: [], actions: [] });
  const [filters, setFilters] = useState(EMPTY_FILTERS);

  const hasFilters = useMemo(() => Object.values(filters).some(Boolean), [filters]);

  // Build the query params: drop empty values, scope to the selected company.
  const params = useMemo(() => {
    const p = { limit: 200 };
    if (currentCompanyId) p.company_id = currentCompanyId;
    for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
    return p;
  }, [filters, currentCompanyId]);

  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const clearFilters = () => setFilters(EMPTY_FILTERS);

  // Load the distinct module/action lists for the dropdowns (once per company).
  useEffect(() => {
    auditApi.getAuditFacets(currentCompanyId ? { company_id: currentCompanyId } : undefined)
      .then(({ data }) => setFacets({ modules: data.modules || [], actions: data.actions || [] }))
      .catch(() => { /* non-blocking */ });
  }, [currentCompanyId]);

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
        </Card>
      )}
    </div>
  );
}
