import { useState, useEffect, useRef, useCallback } from 'react';
import * as portalApi from '@api/portalApi';
import * as payrollApi from '@api/payrollApi';
import * as leaveApi from '@api/leaveApi';
import * as attendanceApi from '@api/attendanceApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import {
  Shield, Monitor, Laptop, Copy, Eye, EyeOff, ExternalLink, Package,
  Lock, Banknote, CalendarDays, FileCheck, Clock, ChevronLeft, ChevronRight,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';

const platformIcons = {
  Email: '📧',
  Software: '💻',
  Website: '🌐',
  VPN: '🔐',
  Cloud: '☁️',
  Database: '🗄️',
};

const getPlatformIcon = (type) => {
  if (!type) return '💻';
  const key = Object.keys(platformIcons).find(k =>
    type.toLowerCase().includes(k.toLowerCase())
  );
  return key ? platformIcons[key] : '💻';
};

const money = (n) => Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// The attendance statuses worth a colour of their own. Anything the enum grows
// later falls through to neutral rather than breaking the row.
const attendanceTone = {
  Present: 'active',
  Remote: 'info',
  Late: 'warning',
  'Half Day': 'warning',
  Absent: 'danger',
  'On Leave': 'brand',
  Holiday: 'inactive',
};

/** One labelled value in a card. Renders nothing when there is nothing to show. */
const Field = ({ label, value, mono }) => {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between gap-3">
      <span className="text-surface-400 shrink-0">{label}</span>
      <span className={`font-medium text-surface-600 text-end break-words ${mono ? 'font-mono' : ''}`}>{value}</span>
    </div>
  );
};

export default function MyAssets() {
  const { t } = useTranslation();
  const [assets, setAssets] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [balances, setBalances] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  // Attendance is browsed a month at a time — a year of daily rows is a wall of
  // numbers, and the question being asked is nearly always about this month.
  const [month, setMonth] = useState(dayjs().format('YYYY-MM'));
  const [attendance, setAttendance] = useState([]);
  const [attSummary, setAttSummary] = useState(null);
  const [attLoading, setAttLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [revealingId, setRevealingId] = useState(null);
  const timersRef = useRef({});

  useEffect(() => {
    loadData();
    const timers = timersRef.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  // Declared before the effect that calls it, so the month can change without
  // reaching back up at a value that is not defined yet.
  const loadAttendance = useCallback(async (m) => {
    setAttLoading(true);
    try {
      const from = dayjs(`${m}-01`).startOf('month').format('YYYY-MM-DD');
      const to = dayjs(`${m}-01`).endOf('month').format('YYYY-MM-DD');
      const [rows, sum] = await Promise.all([
        attendanceApi.list({ from, to }).catch(() => ({ data: [] })),
        attendanceApi.summary({ month: m }).catch(() => ({ data: null })),
      ]);
      setAttendance(rows.data || []);
      setAttSummary(sum.data || null);
    } finally {
      setAttLoading(false);
    }
  }, []);

  useEffect(() => { loadAttendance(month); }, [month, loadAttendance]);

  const loadData = async () => {
    setLoading(true);
    try {
      // Each section fails on its own: an employee with no payroll record should
      // still see their equipment, not an error page.
      const [assetsRes, slipsRes, balRes, reqRes] = await Promise.all([
        portalApi.getMyAssets().catch(() => ({ data: [] })),
        payrollApi.myPayslips({}).catch(() => ({ data: [] })),
        leaveApi.getBalances().catch(() => ({ data: [] })),
        leaveApi.getRequests().catch(() => ({ data: [] })),
      ]);
      setAssets(assetsRes.data || []);
      setPayslips(slipsRes.data || []);
      setBalances(balRes.data || []);
      setLeaveRequests(reqRes.data || []);
    } catch {
      toast.error(t('portal.load_error', 'Failed to load your assets'));
    } finally {
      setLoading(false);
    }
  };

  const handleRevealPassword = useCallback(async (id) => {
    if (revealedPasswords[id]) {
      setRevealedPasswords(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (timersRef.current[id]) {
        clearTimeout(timersRef.current[id]);
        delete timersRef.current[id];
      }
      return;
    }

    setRevealingId(id);
    try {
      const res = await portalApi.revealMyPassword(id);
      const password = res.data?.password || res.data;
      setRevealedPasswords(prev => ({ ...prev, [id]: password }));

      timersRef.current[id] = setTimeout(() => {
        setRevealedPasswords(prev => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
        delete timersRef.current[id];
      }, 10000);
    } catch {
      toast.error(t('portal.reveal_error', 'Failed to reveal password'));
    } finally {
      setRevealingId(null);
    }
  }, [revealedPasswords, t]);

  const handleCopy = (text, label) => {
    navigator.clipboard.writeText(text).then(() => {
      toast.success(t('portal.copied', `${label} copied to clipboard`));
    }).catch(() => {
      toast.error(t('portal.copy_error', 'Failed to copy'));
    });
  };

  // Hardware and accounts both come from asset_assignments, and my-assets now
  // carries the inventory join, so this is the single source. Rendering
  // /my-inventory alongside it showed every device twice.
  const hardwareItems = assets.filter(a => a.asset_type === 'Hardware');
  const accountItems = assets.filter(a => a.asset_type !== 'Hardware');

  const currentYear = new Date().getFullYear();
  const yearBalances = balances.filter(b => Number(b.year) === currentYear);
  const shownBalances = yearBalances.length ? yearBalances : balances;
  const totalRemaining = shownBalances.reduce((s, b) => s + Number(b.remaining || 0), 0);
  const takenThisYear = leaveRequests
    .filter(r => r.status === 'Approved' && dayjs(r.start_date).year() === currentYear)
    .reduce((s, r) => s + Number(r.days || 0), 0);
  const totalPaid = payslips.reduce((s, p) => s + Number(p.net || 0), 0);
  const absentThisMonth = Number(
    attSummary?.by_status?.find((s) => s.status === 'Absent')?.count || 0);

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 bg-surface-200 rounded-xl animate-pulse" />
          <div>
            <div className="h-6 w-48 bg-surface-200 rounded animate-pulse" />
            <div className="h-4 w-64 bg-surface-100 rounded animate-pulse mt-1" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="!p-5 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-surface-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-surface-100 rounded w-1/3" />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-800 to-brand-900 p-6 shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-20 -translate-x-20" />
        <div className="relative flex items-center gap-4 flex-wrap">
          <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
            <Shield className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t('portal.my_assets_title', 'My Assets & Accounts')}
            </h1>
            <p className="text-brand-200 text-sm mt-0.5">
              {t('portal.my_portal_subtitle')}
            </p>
          </div>
          <div className="ms-auto flex gap-3 flex-wrap">
            {[
              { n: hardwareItems.length, l: t('portal.devices', 'Devices') },
              { n: accountItems.length, l: t('portal.accounts', 'Accounts') },
              { n: payslips.length, l: t('portal.payslips_count') },
              { n: totalRemaining, l: t('portal.leave_days_left') },
              { n: absentThisMonth, l: t('portal.absences_this_month') },
            ].map((s, i) => (
              <div key={i} className="text-center bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
                <span className="block text-2xl font-bold text-white">{s.n}</span>
                <span className="text-xs text-brand-200">{s.l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Hardware ─────────────────────────────────────────────────────── */}
      {hardwareItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-100 rounded-lg"><Monitor size={16} className="text-blue-600" /></div>
            <h2 className="text-lg font-semibold text-surface-800">{t('portal.hardware_section', 'Assigned Hardware')}</h2>
            <Badge variant="info">{hardwareItems.length}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {hardwareItems.map(item => (
              <div key={`asset-${item.id}`}
                className="group bg-white rounded-2xl border border-surface-100 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl">
                    <Laptop size={20} className="text-blue-600" />
                  </div>
                  <Badge variant="active" className="text-[10px]" dot>
                    {t(`portal.${(item.status || 'active').toLowerCase()}`, item.status || 'Active')}
                  </Badge>
                </div>
                <h3 className="font-semibold text-surface-800 mb-2">
                  {item.name}{(item.brand || item.model) && <span className="text-surface-400 font-normal"> — {[item.brand, item.model].filter(Boolean).join(' ')}</span>}
                </h3>
                <div className="space-y-1.5 text-xs">
                  <Field label={t('portal.platform')} value={item.platform_name} />
                  <Field label={t('portal.asset_code', 'Asset Code')} value={item.asset_code} mono />
                  <Field label={t('portal.serial_number', 'Serial')} value={item.serial_number || item.identifier} mono />
                  <Field label={t('portal.workspace', 'Workspace')} value={item.workspace} />
                  <Field label={t('portal.issued_date')} value={item.issued_date} />
                  <Field label={t('portal.expected_return')} value={item.expected_return} />
                  <Field label={t('portal.company')} value={item.company_name} />
                  <Field label={t('portal.condition')} value={item.condition_note} />
                  <Field label={t('portal.notes')} value={item.notes} />
                </div>
                {item.has_receipt && (
                  <p className="flex items-center gap-1.5 text-[11px] text-emerald-700 mt-3 pt-3 border-t border-surface-100">
                    <FileCheck size={12} /> {t('portal.receipt_on_file')}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Accounts ─────────────────────────────────────────────────────── */}
      {accountItems.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-100 rounded-lg"><Lock size={16} className="text-violet-600" /></div>
            <h2 className="text-lg font-semibold text-surface-800">{t('portal.accounts_section', 'Accounts & Credentials')}</h2>
            <Badge variant="brand">{accountItems.length}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {accountItems.map(item => {
              const icon = getPlatformIcon(item.platform_name || item.asset_type);
              const isRevealed = !!revealedPasswords[item.id];
              const isRevealing = revealingId === item.id;
              const passwordDisplay = isRevealed ? revealedPasswords[item.id] : '••••••••';
              // The handover form stores this as account_username; `identifier`
              // is the fallback for older rows that used the generic field.
              const username = item.account_username || item.identifier;

              return (
                <div key={`account-${item.id}`}
                  className="group bg-white rounded-2xl border border-surface-100 shadow-sm hover:shadow-lg hover:border-brand-200 transition-all duration-300 overflow-hidden">
                  <div className="h-1 bg-gradient-to-r from-brand-500 via-violet-500 to-purple-500" />

                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-4">
                      <div className="text-2xl flex-shrink-0 p-2 bg-surface-50 rounded-xl">{icon}</div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-surface-800 truncate">{item.platform_name || item.name}</h3>
                        <span className="text-xs text-surface-400">
                          {item.platform_name && item.name !== item.platform_name ? item.name : (
                            item.asset_type === 'Account' ? t('portal.account', 'Account') : t('portal.software', 'Software')
                          )}
                        </span>
                      </div>
                      <Badge variant="active" className="text-[10px] flex-shrink-0" dot>{t('portal.active', 'Active')}</Badge>
                    </div>

                    {/* Username */}
                    {username && (
                      <div className="bg-surface-50 rounded-xl px-3 py-2.5 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] uppercase tracking-wider text-surface-400 font-medium block">
                              {t('portal.username', 'Username')}
                            </span>
                            <span className="text-sm font-medium text-surface-700 truncate block">{username}</span>
                          </div>
                          <button onClick={() => handleCopy(username, 'Username')}
                            className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex-shrink-0"
                            title={t('portal.copy_username', 'Copy username')}>
                            <Copy size={14} />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Password */}
                    {item.has_password && (
                      <div className="bg-surface-50 rounded-xl px-3 py-2.5 mb-3">
                        <div className="flex items-center justify-between">
                          <div className="min-w-0 flex-1">
                            <span className="text-[10px] uppercase tracking-wider text-surface-400 font-medium block">
                              {t('portal.password', 'Password')}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className={`text-sm font-medium truncate block ${isRevealed ? 'font-mono text-surface-700' : 'text-surface-400 tracking-widest'}`}>
                                {passwordDisplay}
                              </span>
                              {isRevealed && (
                                <span className="text-[9px] bg-amber-100 text-amber-600 px-1.5 py-0.5 rounded-full font-medium animate-pulse flex-shrink-0">
                                  {t('portal.auto_hide', '10s')}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            {isRevealed && (
                              <button onClick={() => handleCopy(revealedPasswords[item.id], 'Password')}
                                className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                title={t('portal.copy_password', 'Copy password')}>
                                <Copy size={14} />
                              </button>
                            )}
                            <button onClick={() => handleRevealPassword(item.id)} disabled={isRevealing}
                              className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isRevealed
                                ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                                : 'text-surface-400 hover:text-brand-600 hover:bg-brand-50'}`}
                              title={isRevealed ? t('portal.hide_password', 'Hide password') : t('portal.reveal_password', 'Reveal password')}>
                              {isRevealing ? (
                                <div className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                              ) : isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Everything else recorded on the handover */}
                    <div className="space-y-1.5 text-xs">
                      <Field label={t('portal.access_level')} value={item.access_level} />
                      <Field label={t('portal.workspace', 'Workspace')} value={item.workspace} />
                      <Field label={t('portal.identifier')} value={item.account_username ? item.identifier : null} mono />
                      <Field label={t('portal.issued_date')} value={item.issued_date} />
                      <Field label={t('portal.expected_return')} value={item.expected_return} />
                      <Field label={t('portal.company')} value={item.company_name} />
                      <Field label={t('portal.notes')} value={item.notes} />
                    </div>

                    {item.account_url && (
                      <a href={item.account_url} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-2 text-xs text-brand-600 hover:text-brand-700 transition-colors group/link mt-3 pt-3 border-t border-surface-100">
                        <ExternalLink size={12} />
                        <span className="group-hover/link:underline truncate">{item.account_url}</span>
                      </a>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Attendance ───────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="p-1.5 bg-sky-100 rounded-lg"><Clock size={16} className="text-sky-600" /></div>
          <h2 className="text-lg font-semibold text-surface-800">{t('portal.attendance_section')}</h2>
          <div className="ms-auto flex items-center gap-1">
            <button type="button" onClick={() => setMonth(dayjs(`${month}-01`).subtract(1, 'month').format('YYYY-MM'))}
              className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
              title={t('portal.prev_month')}>
              <ChevronLeft size={16} className="rtl:rotate-180" />
            </button>
            <input type="month" value={month} onChange={(e) => e.target.value && setMonth(e.target.value)}
              max={dayjs().format('YYYY-MM')}
              className="text-sm border border-surface-200 rounded-lg px-3 py-1.5 bg-white" />
            <button type="button" onClick={() => setMonth(dayjs(`${month}-01`).add(1, 'month').format('YYYY-MM'))}
              disabled={month >= dayjs().format('YYYY-MM')}
              className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
              title={t('portal.next_month')}>
              <ChevronRight size={16} className="rtl:rotate-180" />
            </button>
          </div>
        </div>

        {/* Counts per status for the month, plus the hours behind them */}
        {attSummary && (attSummary.by_status?.length > 0) && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {attSummary.by_status.map((s) => (
              <Card key={s.status} className="!p-4">
                <p className="text-2xl font-bold text-surface-900">{s.count}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className={`w-2 h-2 rounded-full ${
                    s.status === 'Absent' ? 'bg-red-500' : s.status === 'Late' || s.status === 'Half Day' ? 'bg-amber-500'
                      : s.status === 'On Leave' ? 'bg-brand-500' : s.status === 'Holiday' ? 'bg-surface-300' : 'bg-emerald-500'}`} />
                  <span className="text-xs text-surface-500">{t(`portal.at_${s.status.toLowerCase().replace(' ', '_')}`, s.status)}</span>
                </div>
              </Card>
            ))}
            <Card className="!p-4 bg-surface-50">
              <p className="text-2xl font-bold text-surface-900">{attSummary.total_hours}</p>
              <p className="text-xs text-surface-500 mt-1">{t('portal.total_hours')}</p>
            </Card>
          </div>
        )}

        {attLoading ? (
          <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
        ) : attendance.length === 0 ? (
          <Card><EmptyState icon={<Clock className="w-6 h-6 text-surface-400" />}
            title={t('portal.no_attendance')}
            description={t('portal.no_attendance_desc', { month: dayjs(`${month}-01`).format('MMMM YYYY') })} /></Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-100">
                  <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                    <th className="px-5 py-3 text-start font-semibold">{t('portal.date')}</th>
                    <th className="px-5 py-3 text-start font-semibold">{t('portal.day')}</th>
                    <th className="px-5 py-3 text-start font-semibold">{t('portal.check_in')}</th>
                    <th className="px-5 py-3 text-start font-semibold">{t('portal.check_out')}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t('portal.hours')}</th>
                    <th className="px-5 py-3 text-start font-semibold">{t('portal.status')}</th>
                    <th className="px-5 py-3 text-start font-semibold">{t('portal.notes')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {attendance.map((a) => (
                    <tr key={a.id} className={`hover:bg-surface-50/60 ${a.status === 'Absent' ? 'bg-red-50/40' : ''}`}>
                      <td className="px-5 py-2.5 font-medium text-surface-800">{a.work_date}</td>
                      <td className="px-5 py-2.5 text-surface-500">{dayjs(a.work_date).format('ddd')}</td>
                      <td className="px-5 py-2.5 font-mono text-surface-600">{a.check_in || '—'}</td>
                      <td className="px-5 py-2.5 font-mono text-surface-600">{a.check_out || '—'}</td>
                      <td className="px-5 py-2.5 text-end text-surface-700">{a.work_hours != null ? Number(a.work_hours).toFixed(2) : '—'}</td>
                      <td className="px-5 py-2.5">
                        <Badge className="text-[10px]" variant={attendanceTone[a.status] || 'info'}>
                          {t(`portal.at_${String(a.status || '').toLowerCase().replace(' ', '_')}`, a.status)}
                        </Badge>
                      </td>
                      <td className="px-5 py-2.5 text-xs text-surface-500 max-w-[16rem] truncate">{a.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ── Salary history ───────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-emerald-100 rounded-lg"><Banknote size={16} className="text-emerald-600" /></div>
          <h2 className="text-lg font-semibold text-surface-800">{t('portal.salary_section')}</h2>
          <Badge variant="active">{payslips.length}</Badge>
        </div>

        {payslips.length === 0 ? (
          <Card><EmptyState icon={<Banknote className="w-6 h-6 text-surface-400" />}
            title={t('portal.no_payslips')} description={t('portal.no_payslips_desc')} /></Card>
        ) : (
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-50 border-b border-surface-100">
                  <tr className="text-start text-[11px] uppercase tracking-wider text-surface-400">
                    <th className="px-5 py-3 text-start font-semibold">{t('portal.period')}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t('portal.basic')}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t('portal.allowances')}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t('portal.gross')}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t('portal.deductions')}</th>
                    <th className="px-5 py-3 text-end font-semibold">{t('portal.net')}</th>
                    <th className="px-5 py-3 text-start font-semibold">{t('portal.status')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-100">
                  {payslips.map((p) => (
                    <tr key={p.id} className="hover:bg-surface-50/60">
                      <td className="px-5 py-3 font-medium text-surface-800">{p.period}</td>
                      <td className="px-5 py-3 text-end text-surface-600">{money(p.basic_salary)}</td>
                      <td className="px-5 py-3 text-end text-surface-600">{money(p.allowances)}</td>
                      <td className="px-5 py-3 text-end text-surface-600">{money(p.gross)}</td>
                      <td className={`px-5 py-3 text-end ${Number(p.deductions) > 0 ? 'text-red-600' : 'text-surface-400'}`}>
                        {Number(p.deductions) > 0 ? `−${money(p.deductions)}` : money(0)}
                      </td>
                      <td className="px-5 py-3 text-end font-semibold text-surface-900">{money(p.net)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={p.run_status === 'Paid' ? 'active' : 'warning'} className="text-[10px]">
                          {t(`portal.st_${String(p.run_status || '').toLowerCase()}`, p.run_status)}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-surface-50 border-t border-surface-200">
                  <tr>
                    <td colSpan={5} className="px-5 py-3 text-end text-xs font-semibold text-surface-500">
                      {t('portal.total_paid')}
                    </td>
                    <td className="px-5 py-3 text-end font-bold text-surface-900">{money(totalPaid)}</td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}
      </div>

      {/* ── Leave ────────────────────────────────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-amber-100 rounded-lg"><CalendarDays size={16} className="text-amber-600" /></div>
          <h2 className="text-lg font-semibold text-surface-800">{t('portal.leave_section')}</h2>
          <Badge variant="warning">{t('portal.days_left', { days: totalRemaining })}</Badge>
        </div>

        {shownBalances.length === 0 && leaveRequests.length === 0 ? (
          <Card><EmptyState icon={<CalendarDays className="w-6 h-6 text-surface-400" />}
            title={t('portal.no_leave')} description={t('portal.no_leave_desc')} /></Card>
        ) : (
          <>
            {shownBalances.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {shownBalances.map((b) => {
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
                {t('portal.leave_summary', { taken: takenThisYear, remaining: totalRemaining, year: currentYear })}
              </p>
            </Card>

            {leaveRequests.length > 0 && (
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
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-surface-100">
                      {leaveRequests.map((r) => (
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
                          <td className="px-5 py-3 text-surface-500 text-xs">
                            {r.approver_name || r.decided_by_name || '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </>
        )}
      </div>

      {hardwareItems.length === 0 && accountItems.length === 0 && (
        <Card className="!py-16">
          <EmptyState
            icon={<Package className="w-6 h-6 text-surface-400" />}
            title={t('portal.no_assets', 'No assets assigned')}
            description={t('portal.no_assets_desc', 'You don\'t have any assigned devices or accounts yet. Contact your IT department if you believe this is an error.')}
          />
        </Card>
      )}
    </div>
  );
}
