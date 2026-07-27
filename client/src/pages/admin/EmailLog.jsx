import { useState, useEffect, useMemo, useRef } from 'react';
import { useSelector } from 'react-redux';
import * as emailApi from '@api/emailApi';
import LogReport from '@components/reports/LogReport';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { Mail, Send, AlertCircle, Clock, Search, Eye, RefreshCw, Inbox, Filter, Download } from 'lucide-react';
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

const EMPTY_FILTERS = { search: '', status: '', module: '', template: '', sent_by: '', from: '', to: '' };

export default function EmailLog() {
  const { t } = useTranslation();
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, queued: 0 });
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [facets, setFacets] = useState({ modules: [], templates: [], senders: [] });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedLog, setSelectedLog] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);
  const [reportRows, setReportRows] = useState(null);
  const { currentCompanyId } = useSelector((s) => s.entity);

  const hasFilters = Object.values(filters).some(Boolean);
  const setFilter = (k, v) => { setFilters((f) => ({ ...f, [k]: v })); setPage(1); };

  // Filtering happens server-side: this page previously fetched with no params
  // at all and filtered the first 25 rows locally, so anything older was invisible.
  const params = useMemo(() => {
    const p = { page, limit: PAGE_SIZE };
    for (const [k, v] of Object.entries(filters)) if (v) p[k] = v;
    return p;
  }, [filters, page]);

  useEffect(() => {
    emailApi.getEmailFacets().then(({ data }) => setFacets(data)).catch(() => {});
  }, [currentCompanyId]);

  useEffect(() => {
    let cancelled = false;
    const id = setTimeout(async () => {
      setLoading(true);
      try {
        const [logsRes, statsRes] = await Promise.all([
          emailApi.getEmailLog(params),
          emailApi.getEmailStats(params),
        ]);
        if (cancelled) return;
        setLogs(logsRes.data?.data || []);
        setTotal(logsRes.data?.total || 0);
        setStats(statsRes.data || { total: 0, sent: 0, failed: 0, queued: 0 });
      } catch {
        if (!cancelled) toast.error(t('email_log.load_failed', 'Failed to load email logs'));
      } finally { if (!cancelled) setLoading(false); }
    }, 300);
    return () => { cancelled = true; clearTimeout(id); };
  }, [params, currentCompanyId, t]);

  const loadData = () => setFilters((f) => ({ ...f })); // re-trigger the effect

  const exportPdf = async () => {
    setExporting(true);
    try {
      const { data } = await emailApi.exportEmailLog(params);
      setReportRows(data.logs || []);
      await waitForPaint();
      await printElementWithLetterhead(reportRef.current, currentCompanyId, `email-log-${dayjs().format('YYYY-MM-DD')}.pdf`);
    } catch (e) {
      toast.error(e.response?.data?.error || e.message || t('email_log.export_failed'));
    } finally { setExporting(false); }
  };

  const modules = facets.modules;
  const paginated = logs;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

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
        <div className="flex gap-2">
          <Button variant="secondary" onClick={exportPdf} loading={exporting}>
            <Download size={16} /> {t('email_log.export_pdf')}
          </Button>
          <Button variant="secondary" onClick={loadData}>
            <RefreshCw size={16} /> {t('common.refresh', 'Refresh')}
          </Button>
        </div>
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
            value={filters.search}
            onChange={(e) => setFilter('search', e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus"
          />
        </div>

        {/* Status Filter */}
        <div className="flex gap-1">
          <button
            onClick={() => setFilter('status', '')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!filters.status ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
          >
            {t('common.all', 'All')}
          </button>
          {Object.entries(statusConfig).map(([key, cfg]) => (
            <button
              key={key}
              onClick={() => setFilter('status', filters.status === cfg.label ? '' : cfg.label)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filters.status === cfg.label ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}
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
              value={filters.module}
              onChange={(e) => setFilter('module', e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-surface-200 rounded-lg input-focus appearance-none pr-7 bg-[url(&quot;data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e&quot;)] bg-[length:16px] bg-[right_4px_center] bg-no-repeat"
            >
              <option value="">{t('email_log.all_modules', 'All Modules')}</option>
              {modules.map((mod) => (
                <option key={mod} value={mod}>{mod}</option>
              ))}
            </select>
          </div>
        )}

        <Badge variant="brand">{total} {t('email_log.entries', 'entries')}</Badge>
      </div>

      {/* Date range / template / sender */}
      <div className="flex items-end gap-3 flex-wrap">
        <div>
          <label className="block text-[11px] font-medium text-surface-500 mb-1">{t('email_log.from')}</label>
          <input type="datetime-local" value={filters.from} onChange={(e) => setFilter('from', e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-surface-200 rounded-lg input-focus" />
        </div>
        <div>
          <label className="block text-[11px] font-medium text-surface-500 mb-1">{t('email_log.to')}</label>
          <input type="datetime-local" value={filters.to} onChange={(e) => setFilter('to', e.target.value)}
            className="px-3 py-1.5 text-xs bg-white border border-surface-200 rounded-lg input-focus" />
        </div>
        {facets.templates.length > 0 && (
          <div>
            <label className="block text-[11px] font-medium text-surface-500 mb-1">{t('email_log.template')}</label>
            <select value={filters.template} onChange={(e) => setFilter('template', e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-surface-200 rounded-lg input-focus">
              <option value="">{t('common.all', 'All')}</option>
              {facets.templates.map((x) => <option key={x} value={x}>{x}</option>)}
            </select>
          </div>
        )}
        {facets.senders.length > 0 && (
          <div>
            <label className="block text-[11px] font-medium text-surface-500 mb-1">{t('email_log.sent_by')}</label>
            <select value={filters.sent_by} onChange={(e) => setFilter('sent_by', e.target.value)}
              className="px-3 py-1.5 text-xs bg-white border border-surface-200 rounded-lg input-focus">
              <option value="">{t('common.all', 'All')}</option>
              {facets.senders.map((u) => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
            </select>
          </div>
        )}
        {hasFilters && (
          <Button size="sm" variant="ghost" onClick={() => { setFilters(EMPTY_FILTERS); setPage(1); }}>
            {t('email_log.clear_filters')}
          </Button>
        )}
      </div>

      {/* Email Table */}
      {loading ? (
        <Card className="animate-pulse !p-8">
          <div className="h-4 bg-surface-200 rounded w-1/2 mb-4" />
          <div className="h-4 bg-surface-100 rounded w-1/3" />
        </Card>
      ) : logs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Inbox className="w-6 h-6 text-surface-400" />}
            title={hasFilters
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
                {t('email_log.showing', 'Showing')} {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)} {t('email_log.of', 'of')} {total}
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

      {/* Off-screen printable report — captured by html2canvas on export */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        {reportRows && (
          <LogReport
            ref={reportRef}
            title="Email Log Report"
            subtitle="تقرير سجل البريد الإلكتروني"
            appliedFilters={Object.entries(filters).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`)}
            columns={EMAIL_REPORT_COLUMNS}
            rows={reportRows}
          />
        )}
      </div>
    </div>
  );
}

const EMAIL_REPORT_COLUMNS = [
  { key: 'sent_at', label: 'Date', width: '13%', format: (v) => (v ? dayjs(v).format('DD/MM/YY HH:mm') : '—') },
  { key: 'to_email', label: 'Recipient', width: '20%', format: (v, r) => (r.to_name ? `${r.to_name} <${v}>` : v || '—') },
  { key: 'subject', label: 'Subject' },
  { key: 'related_module', label: 'Module', width: '11%' },
  { key: 'template_type', label: 'Template', width: '12%' },
  { key: 'status', label: 'Status', width: '8%' },
  { key: 'sent_by_name', label: 'Sent By', width: '12%' },
];
