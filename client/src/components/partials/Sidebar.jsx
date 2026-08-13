import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentCompany } from '@store/slices/entitySlice';
import {
  LayoutDashboard, Kanban, Users, FileText, Target, UserCheck,
  Laptop, TrendingUp, DoorOpen, Scale, FileArchive, Calculator,
  BarChart3, ClipboardList, Trophy, Network, UserCog, Settings,
  Sparkles, ChevronDown, X, Package, Shield, Mail, Send,
  CalendarDays, Clock, Banknote, Inbox, HelpCircle, KeyRound, Share2, Globe,
  Boxes, Layers, CloudDownload, ScanEye
} from 'lucide-react';
import { cn } from '@utils/cn';

// Audiences, named so the intent survives the next role that gets added.
// These mirror server/config/permissions.js — the menu only decides what is
// worth showing; the API is what actually grants or refuses.
const HR_ONLY = ['admin', 'hr_manager'];
const HR_AND_FINANCE = ['admin', 'hr_manager', 'accountant'];
// Everyone except the employee, whose whole menu is their own portal.
const WITH_DASHBOARD = ['admin', 'hr_manager', 'recruiter', 'accountant'];

// The single source of the navigation structure, built from `t` so there is no
// second untranslated copy to drift out of sync.
const buildMenuGroups = (t) => [
  {
      label: '',
      // Not for the employee: the dashboard is a company overview — headcount,
      // hiring trend, everyone's activity — and none of it is theirs to read.
      roles: WITH_DASHBOARD,
      items: [
        { path: '/dashboard', icon: LayoutDashboard, label: t('nav.dashboard') },
      ],
    },
    {
      label: t('nav.recruitment'),
      roles: ['admin', 'hr_manager', 'recruiter'],
      items: [
        { path: '/ats', icon: Kanban, label: t('nav.pipeline') },
        { path: '/candidates', icon: Users, label: t('nav.candidates') },
        { path: '/vacancies', icon: FileText, label: t('nav.vacancies') },
        { path: '/applicants', icon: Inbox, label: t('nav.applicants', 'Applicants') },
        { path: '/cv-scorer', icon: Target, label: t('nav.cv_scorer', 'CV Scorer') },
      ],
    },
    {
      label: t('nav.hr_management'),
      // The accountant reaches this group for two entries only: payroll runs,
      // and the employee records payroll is calculated from. Everything else
      // here is HR's to run, so each item says who it is for rather than the
      // group deciding for all nine.
      roles: HR_AND_FINANCE,
      items: [
        { path: '/employees', icon: Users, label: t('nav.employees', 'Employees'), roles: HR_AND_FINANCE },
        { path: '/onboarding', icon: UserCheck, label: t('nav.onboarding'), roles: HR_ONLY },
        { path: '/quick-offer', icon: Send, label: t('nav.quick_offer', 'Quick Offer'), roles: HR_ONLY },
        { path: '/leave', icon: CalendarDays, label: t('nav.leave', 'Leave'), roles: HR_ONLY },
        { path: '/attendance', icon: Clock, label: t('nav.attendance', 'Attendance'), roles: HR_ONLY },
        { path: '/attendance/sync', icon: CloudDownload, label: t('nav.attendance_sync'), roles: HR_ONLY },
        { path: '/attendance/exceptions', icon: ScanEye, label: t('nav.attendance_exceptions'), roles: HR_ONLY },
        { path: '/payroll-runs', icon: Banknote, label: t('nav.payroll_runs', 'Payroll Runs'), roles: HR_AND_FINANCE },
        { path: '/salary-reviews', icon: TrendingUp, label: t('nav.salary_reviews', 'Salary Reviews'), roles: HR_ONLY },
        { path: '/performance', icon: TrendingUp, label: t('nav.performance', 'Performance'), roles: HR_ONLY },
        { path: '/offboarding', icon: DoorOpen, label: t('nav.offboarding'), roles: HR_ONLY },
      ],
    },
    {
      // Everything the Company Assets & Access module covers: physical stock,
      // what is issued to whom, platform seats and credentials, social accounts,
      // and the domains the rest of it depends on. Six entries, so the group can
      // be folded away — it starts open, and a collapse the user chooses sticks.
      label: t('nav.assets_access'),
      key: 'assets_access',
      collapsible: true,
      icon: Boxes,
      roles: HR_AND_FINANCE,
      items: [
        { path: '/assets', icon: Laptop, label: t('nav.assets') },
        { path: '/inventory', icon: Package, label: t('nav.inventory', 'Inventory') },
        { path: '/digital-access', icon: KeyRound, label: t('nav.digital_access') },
        { path: '/social-governance', icon: Share2, label: t('nav.social_governance') },
        { path: '/domains', icon: Globe, label: t('nav.domains') },
        { path: '/settings/catalog', icon: Layers, label: t('nav.asset_catalog') },
      ],
    },
    {
      label: t('nav.compliance'),
      roles: HR_AND_FINANCE,
      items: [
        { path: '/legal-letters', icon: Scale, label: t('nav.legal_letters') },
        { path: '/company-docs', icon: FileArchive, label: t('nav.company_docs') },
        { path: '/payroll', icon: Calculator, label: t('nav.payroll') },
      ],
    },
    {
      label: t('nav.analytics'),
      roles: ['admin', 'hr_manager'],
      items: [
        { path: '/reports', icon: BarChart3, label: t('nav.reports') },
        { path: '/audit', icon: ClipboardList, label: t('nav.audit_logs'), roles: ['admin', 'hr_manager'] },
        { path: '/kpi', icon: Trophy, label: t('nav.kpi_tracker') },
        { path: '/email-log', icon: Mail, label: t('nav.email_log', 'Email Log'), roles: ['admin', 'hr_manager'] },
      ],
    },
    {
      label: t('nav.operations'),
      roles: ['admin', 'hr_manager'],
      items: [
        { path: '/org-chart', icon: Network, label: t('nav.org_chart') },
        // User management stays admin-only (prevents privilege escalation).
        { path: '/users', icon: UserCog, label: t('nav.users', 'Users'), roles: ['admin'] },
        { path: '/settings', icon: Settings, label: t('nav.settings') },
      ],
    },
    {
      label: t('nav.my_portal', 'MY PORTAL'),
      roles: ['employee', 'admin', 'hr_manager', 'accountant'],
      items: [
        { path: '/portal/my-assets', icon: Shield, label: t('nav.my_assets', 'My Assets & Accounts') },
        { path: '/portal/attendance', icon: Clock, label: t('nav.my_attendance') },
        { path: '/portal/salary', icon: Banknote, label: t('nav.my_salary') },
        { path: '/portal/leave', icon: CalendarDays, label: t('nav.my_leave') },
      ],
    },
    {
      label: t('nav.help', 'HELP'),
      // The help centre is a tour of pages an employee has none of, so for them
      // it is one more thing to ignore. My Portal is the entire menu.
      roles: WITH_DASHBOARD,
      items: [
        { path: '/help', icon: HelpCircle, label: t('nav.help_center', 'Help Center') },
      ],
    },
  ];

const COLLAPSE_KEY = 'sidebar.collapsedGroups';

export default function Sidebar({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const { items: companies } = useSelector((state) => state.companies);
  const { currentCompanyId } = useSelector((state) => state.entity);
  const canSwitchEntity = user?.role !== 'employee';

  // Which collapsible groups the user has closed. Persisted, because a sidebar
  // that reopens every group on reload is not actually collapsible.
  const [collapsed, setCollapsed] = useState(() => {
    try { return JSON.parse(localStorage.getItem(COLLAPSE_KEY)) || {}; } catch { return {}; }
  });
  const toggleGroup = (key) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(next)); } catch { /* private mode */ }
      return next;
    });
  };

  // A company must always be selected (no "ALL" mode). When companies load, if
  // none is selected — or the persisted one is no longer available — default to
  // the first company.
  useEffect(() => {
    if (companies.length > 0) {
      const valid = companies.some((c) => c.id === currentCompanyId);
      if (!valid) dispatch(setCurrentCompany(companies[0].id));
    }
  }, [companies, currentCompanyId, dispatch]);

  const localizedMenuGroups = buildMenuGroups(t);

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50',
        'w-64 bg-white border-r border-surface-100 shadow-sidebar',
        'flex flex-col h-screen',
        'transform transition-transform duration-300 lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full'
      )}>
        {/* Header */}
        <div className="p-5 border-b border-surface-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-gradient rounded-xl flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-surface-900">IST HR System</h1>
                <p className="text-xs text-surface-400">Management Portal</p>
              </div>
            </div>
            <button onClick={onClose} className="lg:hidden p-1 text-surface-400 hover:text-surface-600">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* User info */}
        <div className="px-5 py-3 border-b border-surface-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xs">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-surface-900 truncate">{user?.name}</p>
              <p className="text-xs text-surface-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Entity selector (a company must always be selected — no ALL).
            Hidden for the employee: tenantScope pins them to their own company
            from the token, so a switcher would offer a choice that changes
            nothing. */}
        {companies.length > 0 && canSwitchEntity && (
          <div className="px-4 py-3 border-b border-surface-100">
            <label htmlFor="entity-select" className="block text-[10px] font-semibold text-surface-400 uppercase tracking-wider mb-1.5">Entity</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full"
                style={{ backgroundColor: companies.find((c) => c.id === currentCompanyId)?.color_primary || '#6D28D9' }} />
              <select
                id="entity-select"
                value={currentCompanyId ?? ''}
                onChange={(e) => dispatch(setCurrentCompany(Number(e.target.value)))}
                className="w-full text-sm font-medium text-surface-800 bg-white border border-surface-200 rounded-lg pl-7 pr-8 py-2 appearance-none cursor-pointer hover:border-brand-300 focus:ring-2 focus:ring-brand-200 focus:border-brand-400"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.short_code})</option>
                ))}
              </select>
              <ChevronDown size={15} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
            </div>
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
          {localizedMenuGroups
            .filter(group => !group.roles || group.roles.includes(user?.role))
            .map((group, gi) => {
            const items = group.items.filter(item => !item.roles || item.roles.includes(user?.role));
            if (!items.length) return null;

            const isItemActive = (item) => location.pathname === item.path
              // Settings owns its sub-routes, except the catalogue, which is
              // listed under Assets & Access and highlights there instead.
              || (item.path === '/settings' && location.pathname.startsWith('/settings')
                  && location.pathname !== '/settings/catalog');

            const holdsCurrentPage = items.some(isItemActive);
            // The user's choice wins; the effect above handles landing inside a
            // group that was closed.
            const isCollapsed = group.collapsible && !!collapsed[group.key];
            const GroupIcon = group.icon;

            return (
              <div key={group.key || gi}>
                {group.label && (group.collapsible ? (
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.key)}
                    aria-expanded={!isCollapsed}
                    className={cn(
                      'w-full flex items-center gap-2 px-3 py-2 mt-3 rounded-xl transition-colors',
                      holdsCurrentPage ? 'text-brand-700' : 'text-surface-500 hover:bg-surface-50 hover:text-surface-800'
                    )}
                  >
                    {GroupIcon && <GroupIcon size={16} className={holdsCurrentPage ? 'text-brand-600' : 'text-surface-400'} />}
                    <span className="text-[10px] font-semibold uppercase tracking-wider flex-1 text-start">{group.label}</span>
                    <ChevronDown
                      size={14}
                      className={cn('transition-transform duration-200 text-surface-400', isCollapsed && '-rotate-90 rtl:rotate-90')}
                    />
                  </button>
                ) : (
                  <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-3 pt-4 pb-1.5">
                    {group.label}
                  </p>
                ))}

                {/* Collapsed still shows the page you are on, so landing here by
                    URL never hides it — and the group stays folded, which is
                    what the user asked for by folding it. */}
                {(isCollapsed ? items.filter(isItemActive) : items).map((item) => {
                  const Icon = item.icon;
                  const isActive = isItemActive(item);
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={cn(
                        'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
                        // Nested items sit in from the group header so the
                        // hierarchy is visible at a glance.
                        group.collapsible && 'ms-3',
                        isActive
                          ? 'bg-brand-50 text-brand-700'
                          : 'text-surface-600 hover:bg-surface-50 hover:text-surface-900'
                      )}
                    >
                      <Icon size={18} className={isActive ? 'text-brand-600' : 'text-surface-400'} />
                      {item.label}
                    </NavLink>
                  );
                })}
              </div>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-surface-100">
          <p className="text-xs text-surface-400 text-center">v2.5 · MySQL + AI</p>
        </div>
      </aside>
    </>
  );
}
