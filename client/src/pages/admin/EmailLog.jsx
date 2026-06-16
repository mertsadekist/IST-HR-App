import { useState, useEffect } from 'react';
import * as emailApi from '@api/emailApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { Mail, Send, AlertCircle, Clock, Search, Eye, RefreshCw, Inbox, Filter } from 'lucide-react';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import { useTranslation } from 'react-i18next';
dayjs.extend(relativeTime);

const statusConfig = {
  sent:   { variant: 'success', label: 'Sent',   icon: Send },
  failed: { variant: 'danger',  label: 'Failed', icon: AlertCircle },
  queued: { variant: 'warning', label: 'Queued', icon: Clock },
};

const PAGE_SIZE = 20;

export default function EmailLog() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, queued: 0 });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [moduleFilter, setModuleFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [logsRes, statsRes] = await Promise.all([
        emailApi.getEmailLog(),
        emailApi.getEmailStats(),
      ]);
      setLogs(Array.isArray(logsRes.data) ? logsRes.data : logsRes.data?.data || []);
      setStats(statsRes.data || { total: 0, sent: 0, failed: 0, queued: 0 });
    } catch {
      toast.error(t('email_log.load_failed', 'Failed to load email logs'));
    } finally { setLoading(false); }
  };

  const modules = [...new Set(logs.map((l) => l.related_module).filter(Boolean))].sort();

  const filtered = logs.filter((l) => {
    const matchSearch = !searchQuery ||
      l.to_email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      l.to_name?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchStatus = !statusFilter || l.status?.toLowerCase() === statusFilter;
    const matchModule = !moduleFilter || l.related_module === moduleFilter;
    return matchSearch && matchStatus && matchModule;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [searchQuery, statusFilter, moduleFilter]);

  const openDetail = (log) => {
    setSelectedLog(log);
    setModalOpen(true);
  };

  const statCards = [
    { key: 'total',  label: t('email_log.total_emails', 'Total Emails'),  value: stats.total,  gradient: 'from-brand-600 to-brand-800',  icon: Mail },
    { key: 'sent',   label: t('email_log.sent', 'Sent'),                  value: stats.sent,   gradient: 'from-emerald-500 to-emerald-700', icon: Send },
    { key: 'failed', label: t('email_log.failed', 'Failed'),              value: stats.failed, gradient: 'from-red-500 to-red-700',         icon: AlertCircle },
    { key: 'queued', label: t('email_log.queued', 'Queued'),              value: stats.queued, gradient: 'from-amber-500 to-amber-700',     icon: Clock },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('email_log.title', 'Email Log')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('email_log.subtitle', 'Track all outgoing emails and delivery status')}</p>
        </div>
        <Button variant="secondary" onClick={loadData}>
          <RefreshCw size={16} /> {t('common.refresh', 'Refresh')}
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => {
          const IconComp = stat.icon;
          return (
            <div
              key={stat.key}
              className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${stat.gradient} p-5 text-white`}
            >
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
              <div className="relative">
                <div className="w-9 h-9 bg-white/15 backdrop-blur-sm rounded-xl flex items-center justify-center mb-3">
                  <IconComp size={18} />
                </div>
                <p className="text-2xl font-bold">{(stat.value || 0).toLocaleString()}</p>
                <p className="text-white/70 text-xs mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text"
            placeholder={t('email_log.search_placeholder', 'Search by recipient, subject...')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-1">
          <button
            onClick={() => setStatusFilter('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!statusFilter ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
          >
            {t('common.all', 'All')}
          </button>
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setStatusFilter(statusFilter === key ? '' : key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${statusFilter === key ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
            >
              {cfg.label}
            </button>
          ))}
        </div>

        {/* Module Filter */}
        {modules.length > 0 && (
          <div className="flex items-center gap-1.5">
            <Filter size={14} className="text-surface-400" />
            <select
              value={moduleFilter}
              onChange={(e) => setModuleFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-surface-200 rounded-lg input-focus appearance-none pr-7 bg-[url(&quot;data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e&quot;)] bg-[length:16px] bg-[right_4px_center] bg-no-repeat"
            >
              <option value="">{t('email_log.all_modules', 'All Modules')}</option>
              {modules.map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>
        )}

        <Badge variant="brand">{filtered.length} {t('email_log.entries', 'entries')}</Badge>
      </div>

      {/* Email Table */}
      {loading ? (
        <Card className="animate-pulse !p-8">
          <div className="h-4 bg-surface-200 rounded w-1/2 mb-4" />
          <div className="h-4 bg-surface-100 rounded w-1/3" />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="w-6 h-6 text-surface-400" />}
            title={searchQuery || statusFilter || moduleFilter
              ? t('email_log.no_matching', 'No matching emails')
              : t('email_log.no_emails', 'No emails sent yet')
            }
            description={t('email_log.no_emails_desc', 'Outgoing emails will appear here automatically')}
          />
        </Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/60">
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('email_log.date', 'Date')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('email_log.to', 'To')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('email_log.subject', 'Subject')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('email_log.module', 'Module')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('email_log.template', 'Template')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('email_log.status', 'Status')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('email_log.sent_by', 'Sent By')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500"></th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((log) => {
                  const cfg = statusConfig[log.status?.toLowerCase()] || statusConfig.queued;
                  return (
                    <tr
                      key={log.id}
                      onClick={() => openDetail(log)}
                      className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors cursor-pointer"
                    >
                      <td className="px-5 py-3 text-surface-400 text-xs whitespace-nowrap">
                        <span title={dayjs(log.sent_at).format('YYYY-MM-DD HH:mm:ss')}>
                          {dayjs(log.sent_at).format('DD MMM YYYY, HH:mm')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-surface-700 font-medium max-w-[180px] truncate">
                        <div>{log.to_name || log.to_email}</div>
                        {log.to_name && <div className="text-xs text-surface-400">{log.to_email}</div>}
                      </td>
                      <td className="px-5 py-3 text-surface-700 max-w-[220px] truncate">{log.subject}</td>
                      <td className="px-5 py-3">
                        {log.related_module && <Badge variant="info" className="!text-[10px]">{log.related_module}</Badge>}
                      </td>
                      <td className="px-5 py-3 text-surface-500 text-xs">
                        {log.template_type ? log.template_type.replace(/_/g, ' ') : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={cfg.variant} dot>{cfg.label}</Badge>
                      </td>
                      <td className="px-5 py-3">
                        {log.sent_by_name && (
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-[10px]">
                              {log.sent_by_name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-surface-700 text-xs">{log.sent_by_name}</span>
                          </div>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={(e) => { e.stopPropagation(); openDetail(log); }}
                          className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        >
                          <Eye size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-surface-100 bg-surface-50/30">
              <p className="text-xs text-surface-400">
                {t('email_log.showing', 'Showing')} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} {t('email_log.of', 'of')} {filtered.length}
              </p>
              <div className="flex gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('common.previous', 'Previous')}
                </button>
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setPage(pageNum)}
                      className={`w-8 h-8 rounded-lg text-xs font-medium transition-all ${
                        page === pageNum
                          ? 'bg-brand-700 text-white'
                          : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-surface-100 text-surface-600 hover:bg-surface-200 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {t('common.next', 'Next')}
                </button>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Detail Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={t('email_log.email_detail', 'Email Detail')}
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-0.5">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">{t('email_log.to', 'To')}</p>
                <p className="text-sm font-medium text-surface-900">{selectedLog.to_name || selectedLog.to_email}</p>
                {selectedLog.to_name && <p className="text-xs text-surface-400">{selectedLog.to_email}</p>}
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">{t('email_log.date', 'Date')}</p>
                <p className="text-sm text-surface-700">{dayjs(selectedLog.sent_at).format('DD MMM YYYY, HH:mm:ss')}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">{t('email_log.subject', 'Subject')}</p>
                <p className="text-sm font-medium text-surface-900">{selectedLog.subject}</p>
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-surface-400 uppercase tracking-wider">{t('email_log.status', 'Status')}</p>
                <Badge variant={(statusConfig[selectedLog.status?.toLowerCase()] || statusConfig.queued).variant} dot>
                  {(statusConfig[selectedLog.status?.toLowerCase()] || statusConfig.queued).label}
                </Badge>
              </div>
              {selectedLog.related_module && (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider">{t('email_log.module', 'Module')}</p>
                  <Badge variant="info">{selectedLog.related_module}</Badge>
                </div>
              )}
              {selectedLog.sent_by_name && (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-surface-400 uppercase tracking-wider">{t('email_log.sent_by', 'Sent By')}</p>
                  <p className="text-sm text-surface-700">{selectedLog.sent_by_name}</p>
                </div>
              )}
            </div>

            {/* Error message */}
            {selectedLog.error_message && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{selectedLog.error_message}</span>
              </div>
            )}

            {/* HTML Body Preview */}
            {selectedLog.body_html && (
              <div>
                <p className="text-[10px] text-surface-400 uppercase tracking-wider mb-2">{t('email_log.preview', 'Email Preview')}</p>
                <div className="border border-surface-200 rounded-xl overflow-hidden bg-white">
                  <iframe
                    title="Email Preview"
                    srcDoc={selectedLog.body_html}
                    className="w-full h-80 border-0"
                    sandbox=""
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button variant="secondary" onClick={() => setModalOpen(false)}>
                {t('common.close', 'Close')}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
