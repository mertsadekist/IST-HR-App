import { useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useSelector, useDispatch } from 'react-redux';
import { setCurrentCompany } from '@store/slices/entitySlice';
import {
  LayoutDashboard, Kanban, Users, FileText, Target, UserCheck,
  Laptop, TrendingUp, DoorOpen, Scale, FileArchive, Calculator,
  BarChart3, ClipboardList, Trophy, Network, UserCog, Settings,
  Sparkles, ChevronDown, X, Package, Shield, Mail,
  CalendarDays, Clock, Banknote, Inbox
} from 'lucide-react';
import { cn } from '@utils/cn';

const menuGroups = [
  {
    label: '',
    items: [
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    ],
  },
  {
    label: 'RECRUITMENT',
    roles: ['admin', 'hr_manager', 'recruiter'],
    items: [
      { path: '/ats', icon: Kanban, label: 'ATS Pipeline' },
      { path: '/candidates', icon: Users, label: 'Candidates' },
      { path: '/vacancies', icon: FileText, label: 'Vacancies' },
      { path: '/cv-scorer', icon: Target, label: 'CV Scorer' },
    ],
  },
  {
    label: 'EMPLOYEE LIFECYCLE',
    roles: ['admin', 'hr_manager'],
    items: [
      { path: '/employees', icon: Users, label: 'Employees' },
      { path: '/onboarding', icon: UserCheck, label: 'Onboarding' },
      { path: '/assets', icon: Laptop, label: 'Assets' },
      { path: '/performance', icon: TrendingUp, label: 'Performance' },
      { path: '/offboarding', icon: DoorOpen, label: 'Offboarding' },
    ],
  },
  {
    label: 'LEGAL / DOCS',
    roles: ['admin', 'hr_manager'],
    items: [
      { path: '/legal-letters', icon: Scale, label: 'Legal Letters' },
      { path: '/company-docs', icon: FileArchive, label: 'Company Docs' },
      { path: '/payroll', icon: Calculator, label: 'Payroll & Law' },
    ],
  },
  {
    label: 'ANALYTICS',
    roles: ['admin', 'hr_manager'],
    items: [
      { path: '/reports', icon: BarChart3, label: 'Reports' },
      { path: '/audit', icon: ClipboardList, label: 'Audit Log', roles: ['admin'] },
      { path: '/kpi', icon: Trophy, label: 'KPI Tracker' },
    ],
  },
  {
    label: 'ADMIN',
    roles: ['admin'],
    items: [
      { path: '/org-chart', icon: Network, label: 'Org Chart' },
      { path: '/users', icon: UserCog, label: 'Users' },
      { path: '/settings', icon: Settings, label: 'Settings' },
    ],
  },
];

export default function Sidebar({ isOpen, onClose }) {
  const dispatch = useDispatch();
  const location = useLocation();
  const { t } = useTranslation();
  const { user } = useSelector((state) => state.auth);
  const { items: companies } = useSelector((state) => state.companies);
  const { currentCompanyId } = useSelector((state) => state.entity);

  // A company must always be selected (no "ALL" mode). When companies load, if
  // none is selected — or the persisted one is no longer available — default to
  // the first company.
  useEffect(() => {
    if (companies.length > 0) {
      const valid = companies.some((c) => c.id === currentCompanyId);
      if (!valid) dispatch(setCurrentCompany(companies[0].id));
    }
  }, [companies, currentCompanyId, dispatch]);

  // Localized menu groups
  const localizedMenuGroups = [
    {
      label: '',
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
      roles: ['admin', 'hr_manager'],
      items: [
        { path: '/employees', icon: Users, label: t('nav.employees', 'Employees') },
        { path: '/onboarding', icon: UserCheck, label: t('nav.onboarding') },
        { path: '/leave', icon: CalendarDays, label: t('nav.leave', 'Leave') },
        { path: '/attendance', icon: Clock, label: t('nav.attendance', 'Attendance') },
        { path: '/payroll-runs', icon: Banknote, label: t('nav.payroll_runs', 'Payroll Runs') },
        { path: '/assets', icon: Laptop, label: t('nav.assets') },
        { path: '/inventory', icon: Package, label: t('nav.inventory', 'Inventory') },
        { path: '/performance', icon: TrendingUp, label: t('nav.performance', 'Performance') },
        { path: '/offboarding', icon: DoorOpen, label: t('nav.offboarding') },
      ],
    },
    {
      label: t('nav.compliance'),
      roles: ['admin', 'hr_manager'],
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
        { path: '/audit', icon: ClipboardList, label: t('nav.audit_logs'), roles: ['admin'] },
        { path: '/kpi', icon: Trophy, label: t('nav.kpi_tracker') },
        { path: '/email-log', icon: Mail, label: t('nav.email_log', 'Email Log'), roles: ['admin'] },
      ],
    },
    {
      label: t('nav.operations'),
      roles: ['admin'],
      items: [
        { path: '/org-chart', icon: Network, label: t('nav.org_chart') },
        { path: '/users', icon: UserCog, label: t('nav.users', 'Users') },
        { path: '/settings', icon: Settings, label: t('nav.settings') },
      ],
    },
    {
      label: t('nav.my_portal', 'MY PORTAL'),
      roles: ['employee', 'admin', 'hr_manager'],
      items: [
        { path: '/portal/my-assets', icon: Shield, label: t('nav.my_assets', 'My Assets & Accounts') },
      ],
    },
  ];

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

        {/* Entity selector (a company must always be selected — no ALL) */}
        {companies.length > 0 && (
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
            .map((group, gi) => (
            <div key={gi}>
              {group.label && (
                <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-3 pt-4 pb-1.5">
                  {group.label}
                </p>
              )}
              {group.items
                .filter(item => !item.roles || item.roles.includes(user?.role))
                .map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path ||
                  (item.path === '/settings' && location.pathname.startsWith('/settings'));
                return (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    onClick={onClose}
                    className={cn(
                      'flex items-center gap-3 px-3 py-2 rounded-xl text-sm font-medium transition-all duration-200',
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
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-surface-100">
          <p className="text-xs text-surface-400 text-center">v2.0 · MySQL + AI</p>
        </div>
      </aside>
    </>
  );
}
