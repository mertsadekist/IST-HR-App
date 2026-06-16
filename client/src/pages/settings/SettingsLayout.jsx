import { NavLink, Outlet } from 'react-router-dom';
import { Building2, Network, Wrench, Box, Settings2, Mail, FileText } from 'lucide-react';
import { cn } from '@utils/cn';
import { useTranslation } from 'react-i18next';

export default function SettingsLayout() {
  const { t } = useTranslation();

  const settingsTabs = [
    { path: '/settings/companies', icon: Building2, label: t('nav.companies') },
    { path: '/settings/departments', icon: Network, label: t('nav.departments') },
    { path: '/settings/skills', icon: Wrench, label: t('nav.skills') },
    { path: '/settings/catalog', icon: Box, label: t('nav.asset_catalog') },
    { path: '/settings/system', icon: Settings2, label: t('nav.system_config') },
    { path: '/settings/email', icon: Mail, label: t('nav.email_config', 'Email') },
    { path: '/settings/templates', icon: FileText, label: t('nav.templates', 'Templates') },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900">{t('settings.title')}</h1>
        <p className="text-surface-500 mt-0.5 text-sm">{t('settings.subtitle')}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-card border border-surface-100 overflow-x-auto">
        {settingsTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <NavLink
              key={tab.path}
              to={tab.path}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium whitespace-nowrap transition-all',
                  isActive
                    ? 'bg-brand-700 text-white shadow-sm'
                    : 'text-surface-600 hover:bg-surface-50 hover:text-surface-800'
                )
              }
            >
              <Icon size={16} />
              {tab.label}
            </NavLink>
          );
        })}
      </div>

      {/* Content */}
      <Outlet />
    </div>
  );
}
