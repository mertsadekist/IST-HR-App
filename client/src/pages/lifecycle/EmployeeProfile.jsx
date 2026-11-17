import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import {
  ArrowLeft, Camera, Loader2, Download, Mail, Phone, Building2, CalendarDays, UserRound, Hash,
  LayoutDashboard, IdCard, FileText, Banknote, Clock, CalendarClock, Plane, Wallet, Landmark, Laptop, History, UserX, GraduationCap,
  StickyNote, Inbox, ClipboardCheck, Scale,
} from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import EmptyState from '@components/ui/EmptyState';
import * as employeesApi from '@api/employeesApi';
import { printElementWithLetterhead, waitForPaint } from '@utils/printDoc';
import EmployeeHistoryReport from './components/EmployeeHistoryReport';
import EmployeeDocumentsTab from './components/EmployeeDocumentsTab';
import EmployeePayComponentsTab from './components/EmployeePayComponentsTab';
import EmployeeTrainingTab from './components/EmployeeTrainingTab';
import ProfileDetailsTab from './components/profile/ProfileDetailsTab';
import EmployeeOverviewTab from './components/profile/EmployeeOverviewTab';
import EmployeePayslipsTab from './components/profile/EmployeePayslipsTab';
import EmployeeAttendanceTab from './components/profile/EmployeeAttendanceTab';
import EmployeeScheduleTab from './components/profile/EmployeeScheduleTab';
import EmployeeLeaveTab from './components/profile/EmployeeLeaveTab';
import EmployeeBankTab from './components/profile/EmployeeBankTab';
import EmployeeAssetsTab from './components/profile/EmployeeAssetsTab';
import EmployeeTimelineTab from './components/profile/EmployeeTimelineTab';
import EmployeeNotesTab from './components/profile/EmployeeNotesTab';
import EmployeeRequestsTab from './components/profile/EmployeeRequestsTab';
import EmployeeReviewsTab from './components/profile/EmployeeReviewsTab';
import EmployeeSalaryReviewsTab from './components/profile/EmployeeSalaryReviewsTab';
import IdentityDocuments, { ExpiryAlerts } from './components/profile/IdentityDocuments';
import DocumentViewer from './components/profile/DocumentViewer';
import { statusLabel, statusVariant, tenureText } from './components/profile/profileUtils';

const PAYROLL_ROLES = ['admin', 'hr_manager', 'accountant'];   // GET /payroll/payslips/:id
const ATTENDANCE_ROLES = ['admin', 'hr_manager', 'hr_specialist']; // isHR() on /attendance
const MANAGE_ROLES = ['admin', 'hr_manager'];                   // documents, schedule, secrets, appraisals
const NOTE_ROLES = ['admin', 'hr_manager', 'hr_specialist'];    // /employees/:id/notes
const REQUEST_ROLES = ['admin', 'hr_manager', 'accountant'];    // STAFF in routes/requests.js

/**
 * The full employee profile, on its own page so every section has room:
 * /employees/:id?tab=<key>. The tab is kept in the URL, so a link (e.g. from
 * the Document Radar) can open a profile straight on the right section and the
 * browser's back button returns to it.
 */
export default function EmployeeProfile() {
  const { t } = useTranslation();
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const role = useSelector((s) => s.auth.user?.role);
  const { items: companies } = useSelector((s) => s.companies);
  const isAdmin = role === 'admin';
  const canPayroll = PAYROLL_ROLES.includes(role);
  const canAttendance = ATTENDANCE_ROLES.includes(role);
  const canManage = MANAGE_ROLES.includes(role);
  const canNotes = NOTE_ROLES.includes(role);
  const canRequests = REQUEST_ROLES.includes(role);

  const [employee, setEmployee] = useState(null);
  const [loadState, setLoadState] = useState({ id: null, failed: false });
  const loading = loadState.id !== id;
  const [photoUrl, setPhotoUrl] = useState(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [historyData, setHistoryData] = useState(null);
  const [exporting, setExporting] = useState(false);
  const reportRef = useRef(null);
  const sectionRef = useRef(null);
  // The employee's documents, for the identity cards and expiry alerts above
  // the tabs. Reloaded when the Documents tab uploads or edits one.
  const [docs, setDocs] = useState({ key: null, list: [] });
  const [docsVersion, setDocsVersion] = useState(0);
  const docsKey = `${id}:${docsVersion}`;
  const docsLoading = docs.key === null || !docs.key.startsWith(`${id}:`);
  const [viewIndex, setViewIndex] = useState(null);

  // Grouped so fifteen sections stay easy to scan: a side menu on desktop, a
  // scrolling row on a phone. Each section only appears for roles the server
  // lets read it.
  const groups = [
    { key: 'general', label: t('empProfile.grp_general'), tabs: [
      { key: 'overview', icon: LayoutDashboard, label: t('empProfile.tab_overview') },
      { key: 'profile', icon: IdCard, label: t('employees.profile_tab') },
      { key: 'documents', icon: FileText, label: t('employees.documents_tab') },
      canNotes && { key: 'notes', icon: StickyNote, label: t('empProfile.tab_notes') },
    ] },
    { key: 'pay', label: t('empProfile.grp_pay'), tabs: [
      canPayroll && { key: 'payslips', icon: Banknote, label: t('empProfile.tab_payslips') },
      { key: 'pay', icon: Wallet, label: t('pay_components.tab') },
      canPayroll && { key: 'salary_reviews', icon: Scale, label: t('empProfile.tab_salary_reviews') },
      { key: 'bank', icon: Landmark, label: t('employees.bank_tab') },
    ] },
    { key: 'time', label: t('empProfile.grp_time'), tabs: [
      canAttendance && { key: 'attendance', icon: Clock, label: t('empProfile.tab_attendance') },
      { key: 'schedule', icon: CalendarClock, label: t('employees.schedule_tab') },
      { key: 'leave', icon: Plane, label: t('employees.leave_tab') },
    ] },
    { key: 'work', label: t('empProfile.grp_work'), tabs: [
      canRequests && { key: 'requests', icon: Inbox, label: t('empProfile.tab_requests') },
      canManage && { key: 'reviews', icon: ClipboardCheck, label: t('empProfile.tab_reviews') },
      { key: 'training', icon: GraduationCap, label: t('training.tab') },
    ] },
    { key: 'records', label: t('empProfile.grp_records'), tabs: [
      { key: 'assets', icon: Laptop, label: t('employees.assets_tab') },
      { key: 'timeline', icon: History, label: t('empProfile.tab_timeline') },
    ] },
  ].map((g) => ({ ...g, tabs: g.tabs.filter(Boolean) })).filter((g) => g.tabs.length);
  const tabs = groups.flatMap((g) => g.tabs);
  const requested = searchParams.get('tab');
  const activeTab = tabs.some((x) => x.key === requested) ? requested : 'overview';
  const current = tabs.find((x) => x.key === activeTab);
  const openTab = (key) => {
    setSearchParams(key === 'overview' ? {} : { tab: key }, { replace: true });
    // Bring the section into view only when it has scrolled above the screen.
    const top = sectionRef.current?.getBoundingClientRect().top;
    if (top != null && top < 0) sectionRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    let alive = true;
    employeesApi.getEmployee(id)
      .then(({ data }) => { if (alive) { setEmployee(data); setLoadState({ id, failed: false }); } })
      .catch(() => { if (alive) { setEmployee(null); setLoadState({ id, failed: true }); } });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    let alive = true;
    employeesApi.getEmployeeDocuments(id)
      .then(({ data }) => { if (alive) setDocs({ key: docsKey, list: Array.isArray(data) ? data : [] }); })
      .catch(() => { if (alive) setDocs({ key: docsKey, list: [] }); });
    return () => { alive = false; };
  }, [id, docsKey]);
  const openDoc = (d) => setViewIndex(docs.list.findIndex((x) => x.id === d.id));

  // Photo bytes come from an authenticated endpoint, so they are read as a
  // blob. Tagged with the employee id so another profile's photo never shows.
  const photoId = employee?.photo_path ? employee.id : null;
  useEffect(() => {
    if (!photoId) return undefined;
    let alive = true;
    employeesApi.getEmployeePhotoBytes(photoId)
      .then(({ data }) => { if (alive) setPhotoUrl({ id: photoId, url: URL.createObjectURL(data) }); })
      .catch(() => {});
    return () => { alive = false; };
  }, [photoId]);
  useEffect(() => () => { if (photoUrl) URL.revokeObjectURL(photoUrl.url); }, [photoUrl]);
  const photoSrc = photoId && photoUrl?.id === photoId ? photoUrl.url : null;

  const handlePhotoPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setPhotoBusy(true);
    try {
      const fd = new FormData();
      fd.append('photo', file);
      await employeesApi.uploadEmployeePhoto(employee.id, fd);
      const { data } = await employeesApi.getEmployee(employee.id);
      setEmployee(data);
      // Fetched here as well: the stored path can stay the same on a re-upload,
      // which would not re-run the effect above.
      const { data: bytes } = await employeesApi.getEmployeePhotoBytes(data.id);
      setPhotoUrl({ id: data.id, url: URL.createObjectURL(bytes) });
      toast.success(t('employees.photo_saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('employees.photo_save_failed'));
    } finally { setPhotoBusy(false); }
  };

  const exportHistory = async () => {
    setExporting(true);
    try {
      const { data } = await employeesApi.getEmployeeHistory(employee.id);
      setHistoryData(data);
      await waitForPaint(); // let the off-screen report commit before capture
      const name = `${employee.first_name}-${employee.last_name}`.replace(/\s+/g, '');
      await printElementWithLetterhead(reportRef.current, employee.company_id, `employee-record-${name}.pdf`);
    } catch (err) {
      toast.error(err.response?.data?.error || err.message || t('employees.export_failed'));
    } finally { setExporting(false); }
  };

  const mergeEmployee = (patch) => setEmployee((p) => (p ? { ...p, ...patch } : p));

  const backLink = (
    <Link to="/employees" className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-brand-700">
      <ArrowLeft size={16} className="rtl:rotate-180" /> {t('empProfile.back')}
    </Link>
  );

  if (loading) {
    return (
      <div className="space-y-5 animate-fade-in">
        {backLink}
        <div className="h-44 rounded-2xl bg-surface-100 animate-pulse" />
        <div className="h-10 rounded-xl bg-surface-100 animate-pulse" />
        <div className="h-64 rounded-2xl bg-surface-100 animate-pulse" />
      </div>
    );
  }

  if (loadState.failed || !employee) {
    return (
      <div className="space-y-5 animate-fade-in">
        {backLink}
        <Card><EmptyState icon={<UserX className="w-6 h-6 text-surface-400" />} title={t('empProfile.not_found')} description={t('empProfile.not_found_desc')} /></Card>
      </div>
    );
  }

  const fullName = `${employee.first_name || ''} ${employee.last_name || ''}`.trim();
  const facts = [
    { icon: Building2, label: t('empProfile.f_company'), value: employee.company_name },
    { icon: CalendarDays, label: t('empProfile.f_join'), value: employee.start_date ? `${dayjs(employee.start_date).format('MMM D, YYYY')} · ${tenureText(t, employee.start_date)}` : null },
    { icon: UserRound, label: t('org.manager'), value: employee.manager_name || t('org.no_manager') },
    { icon: Mail, label: t('empProfile.f_email'), value: employee.email, href: employee.email ? `mailto:${employee.email}` : null },
    { icon: Phone, label: t('empProfile.f_phone'), value: employee.phone, href: employee.phone ? `tel:${employee.phone}` : null },
    { icon: Hash, label: t('employees.attendance_id'), value: employee.attendance_id },
  ];

  let body;
  switch (activeTab) {
    case 'profile': body = <ProfileDetailsTab key={employee.id} employee={employee} onChange={mergeEmployee} t={t} isAdmin={isAdmin} />; break;
    case 'documents': body = <EmployeeDocumentsTab employee={employee} t={t} canEdit={canManage} onChanged={() => setDocsVersion((v) => v + 1)} />; break;
    case 'payslips': body = <EmployeePayslipsTab employee={employee} t={t} />; break;
    case 'attendance': body = <EmployeeAttendanceTab employee={employee} t={t} />; break;
    case 'schedule': body = <EmployeeScheduleTab employee={employee} t={t} canEdit={canManage} />; break;
    case 'leave': body = <EmployeeLeaveTab employee={employee} t={t} />; break;
    case 'pay': body = <EmployeePayComponentsTab employee={employee} t={t} canEdit={canManage} />; break;
    case 'bank': body = <EmployeeBankTab employee={employee} t={t} isAdmin={isAdmin} />; break;
    case 'assets': body = <EmployeeAssetsTab employee={employee} t={t} canReveal={canManage} />; break;
    case 'training': body = <EmployeeTrainingTab employee={employee} t={t} canEdit={canManage} />; break;
    case 'timeline': body = <EmployeeTimelineTab employee={employee} t={t} />; break;
    case 'notes': body = <EmployeeNotesTab employee={employee} t={t} />; break;
    case 'requests': body = <EmployeeRequestsTab employee={employee} t={t} />; break;
    case 'reviews': body = <EmployeeReviewsTab employee={employee} t={t} />; break;
    case 'salary_reviews': body = <EmployeeSalaryReviewsTab employee={employee} t={t} />; break;
    default: body = <EmployeeOverviewTab employee={employee} t={t} canPayroll={canPayroll} canAttendance={canAttendance} onOpenTab={openTab} />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        {backLink}
        <Button size="sm" variant="secondary" onClick={exportHistory} loading={exporting}>
          <Download size={14} /> {t('employees.export_record')}
        </Button>
      </div>

      {/* Hero: who this is, at a glance */}
      <div className="rounded-2xl border border-brand-100 bg-white overflow-hidden shadow-sm">
        <div className="h-20 bg-gradient-to-r from-brand-600 via-brand-500 to-brand-400" />
        <div className="px-5 sm:px-6 pb-5">
          <div className="flex flex-col sm:flex-row sm:items-end gap-4 -mt-10">
            <label className={`relative group shrink-0 w-fit ${photoBusy ? 'pointer-events-none' : 'cursor-pointer'}`} title={t('employees.change_photo')}>
              <span className="block w-24 h-24 rounded-2xl overflow-hidden bg-brand-100 text-brand-700 ring-4 ring-white shadow-md">
                {photoSrc ? (
                  <img src={photoSrc} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="w-full h-full flex items-center justify-center text-2xl font-bold">
                    {employee.first_name?.[0]}{employee.last_name?.[0]}
                  </span>
                )}
              </span>
              <span className="absolute inset-0 rounded-2xl bg-black/45 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                {photoBusy ? <Loader2 size={20} className="text-white animate-spin" /> : <Camera size={20} className="text-white" />}
              </span>
              <input type="file" className="hidden" accept="image/png,image/jpeg,image/webp" onChange={handlePhotoPick} disabled={photoBusy} />
            </label>
            <div className="min-w-0 flex-1 sm:pb-1">
              <h1 className="text-2xl font-bold text-surface-900 truncate">{fullName}</h1>
              <p className="text-sm text-surface-600 truncate">
                {employee.job_title_text || employee.job_title_name || t('employees.no_job_title')}
                {employee.department_name ? ` · ${employee.department_name}` : ''}
              </p>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap sm:pb-1">
              <Badge variant={statusVariant(employee.status)}>{statusLabel(t, employee.status)}</Badge>
              {!!employee.is_owner && <Badge variant="info">{t('employees.owner_badge')}</Badge>}
              <Badge variant={employee.labour_contract_status === 'Issued' ? 'success' : 'danger'}>
                {t('employees.labour_contract_status')}: {t(employee.labour_contract_status === 'Issued' ? 'employees.lc_issued' : 'employees.lc_not_issued')}
              </Badge>
            </div>
          </div>

          <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-x-4 gap-y-3 mt-5 pt-4 border-t border-surface-100">
            {facts.map((f) => (
              <div key={f.label} className="flex items-start gap-2 min-w-0">
                <f.icon size={15} className="text-brand-500 mt-0.5 shrink-0" />
                <div className="min-w-0">
                  <dt className="text-[11px] text-surface-400">{f.label}</dt>
                  <dd className="text-xs font-semibold text-surface-800 truncate" title={f.value || ''}>
                    {f.value ? (f.href ? <a href={f.href} className="hover:text-brand-700">{f.value}</a> : f.value) : <span className="text-surface-300">{t('empProfile.not_set')}</span>}
                  </dd>
                </div>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {/* Identity and residency, and every expiry that needs action, always in view */}
      <ExpiryAlerts docs={docs.list} t={t} onOpen={openDoc} />
      <IdentityDocuments docs={docs.list} loading={docsLoading} t={t} onOpen={openDoc} onAdd={() => openTab('documents')} />

      {/* Sections: grouped side menu on desktop, a scrolling row on smaller screens */}
      <div ref={sectionRef} className="scroll-mt-4 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-5 lg:items-start">
        <nav aria-label={t('employees.employee_profile')}
          className="sticky top-0 z-20 -mx-1 px-1 py-1 bg-surface-50/90 backdrop-blur lg:top-4 lg:mx-0 lg:p-0 lg:bg-transparent lg:backdrop-blur-none">
          {/* Phone / tablet */}
          <div role="tablist" className="lg:hidden flex gap-1 overflow-x-auto rounded-xl border border-surface-200 bg-white p-1 shadow-sm [scrollbar-width:thin]">
            {tabs.map((tab) => {
              const on = tab.key === activeTab;
              return (
                <button key={tab.key} type="button" role="tab" aria-selected={on} onClick={() => openTab(tab.key)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${on ? 'bg-brand-600 text-white shadow-sm' : 'text-surface-600 hover:bg-surface-100'}`}>
                  <tab.icon size={15} className={on ? 'text-white' : 'text-surface-400'} />
                  {tab.label}
                </button>
              );
            })}
          </div>
          {/* Desktop */}
          <div role="tablist" aria-orientation="vertical" className="hidden lg:block rounded-2xl border border-surface-200 bg-white p-2 shadow-sm space-y-3">
            {groups.map((g) => (
              <div key={g.key}>
                <p className="px-3 pt-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-surface-400">{g.label}</p>
                <div className="space-y-0.5">
                  {g.tabs.map((tab) => {
                    const on = tab.key === activeTab;
                    return (
                      <button key={tab.key} type="button" role="tab" aria-selected={on} onClick={() => openTab(tab.key)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-start transition-colors ${on ? 'bg-brand-50 text-brand-700 font-semibold ring-1 ring-brand-100' : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'}`}>
                        <tab.icon size={16} className={on ? 'text-brand-600' : 'text-surface-400'} />
                        <span className="truncate">{tab.label}</span>
                        {on && <span className="ms-auto w-1.5 h-1.5 rounded-full bg-brand-500" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <section role="tabpanel" className="min-h-[300px] min-w-0 mt-4 lg:mt-0">
          {current && (
            <div className="hidden lg:flex items-center gap-2 mb-4">
              <current.icon size={18} className="text-brand-600" />
              <h2 className="text-lg font-bold text-surface-900">{current.label}</h2>
            </div>
          )}
          {body}
        </section>
      </div>

      <DocumentViewer employeeId={employee.id} docs={docs.list} index={viewIndex}
        onIndexChange={setViewIndex} onClose={() => setViewIndex(null)} t={t} />

      {/* Off-screen printable report — captured by html2canvas on export */}
      <div style={{ position: 'fixed', left: '-9999px', top: 0, width: '800px' }} aria-hidden="true">
        {historyData && (
          <EmployeeHistoryReport
            ref={reportRef}
            data={historyData}
            company={companies.find((c) => c.id === employee.company_id)}
          />
        )}
      </div>
    </div>
  );
}
