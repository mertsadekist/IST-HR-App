import { useState, useEffect } from 'react';
import * as auditApi from '@api/auditApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { ClipboardList, Search, RefreshCw, Download } from 'lucide-react';
import Button from '@components/ui/Button';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
dayjs.extend(relativeTime);

const moduleColors = {
  Auth: 'info', Companies: 'brand', Departments: 'active', Skills: 'warning',
  Users: 'danger', Candidates: 'info', Employees: 'active', AI: 'brand',
};

export default function AuditLog() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');

  useEffect(() => { loadLogs(); }, []);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const { data } = await auditApi.getAuditLogs({ limit: 200 });
      setLogs(Array.isArray(data) ? data : data.data || []);
    } catch {
      toast.error('Failed to load audit logs');
    } finally {
      setLoading(false);
    }
  };

  const modules = [...new Set(logs.map((l) => l.module))].sort();

  const filtered = logs.filter((l) => {
    const matchSearch = !searchQuery || 
      l.user_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.detail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.action.toLowerCase().includes(searchQuery.toLowerCase());
    const matchModule = !moduleFilter || l.module === moduleFilter;
    return matchSearch && matchModule;
  });

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('audit.title', 'Audit Log')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('audit.subtitle', 'Track all system actions and changes')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => { window.open(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/audit/export`, '_blank'); }}>
            <Download size={16} /> {t('audit.export_json', 'Export JSON')}
          </Button>
          <Button variant="secondary" onClick={loadLogs}>
            <RefreshCw size={16} /> {t('common.refresh', 'Refresh')}
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            placeholder={t('audit.search_placeholder', 'Search logs...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus"
          />
        </div>
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setModuleFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!moduleFilter ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
          >
            {t('common.all', 'All')}
          </button>
          {modules.map((mod) => (
            <button
              key={mod}
              onClick={() => setModuleFilter(mod === moduleFilter ? '' : mod)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${moduleFilter === mod ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
            >
              {mod}
            </button>
          ))}
        </div>
        <Badge variant="brand">{filtered.length} {t('audit.entries', 'entries')}</Badge>
      </div>

      {/* Log Table */}
      {loading ? (
        <Card className="animate-pulse !p-8"><div className="h-4 bg-surface-200 rounded w-1/2 mb-4" /><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ClipboardList className="w-6 h-6 text-surface-400" />}
            title={searchQuery || moduleFilter ? t('audit.no_matching_logs', 'No matching logs') : t('audit.no_activity_yet', 'No activity yet')}
            description={t('audit.no_activity_desc', 'System actions will be recorded here automatically')}
          />
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/60">
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('audit.time', 'Time')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('audit.user', 'User')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('audit.module', 'Module')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('audit.action', 'Action')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('audit.details', 'Details')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((log) => (
                  <tr key={log.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors">
                    <td className="px-5 py-3 text-surface-400 text-xs whitespace-nowrap">
                      <span title={dayjs(log.created_at).format('YYYY-MM-DD HH:mm:ss')}>
                        {dayjs(log.created_at).fromNow()}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-[10px]">
                          {log.user_name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-surface-700 font-medium">{log.user_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={moduleColors[log.module] || 'info'} className="!text-[10px]">{log.module}</Badge>
                    </td>
                    <td className="px-5 py-3 font-medium text-surface-700">{log.action}</td>
                    <td className="px-5 py-3 text-surface-500 max-w-xs truncate">{log.detail}</td>
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
