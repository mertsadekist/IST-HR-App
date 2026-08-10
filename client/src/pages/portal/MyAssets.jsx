import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as portalApi from '@api/portalApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import { toast } from 'react-toastify';
import {
  Shield, Monitor, Laptop, Copy, Eye, EyeOff, ExternalLink, Package, Lock, FileCheck,
} from 'lucide-react';

const platformIcons = {
  Email: '📧', Software: '💻', Website: '🌐', VPN: '🔐', Cloud: '☁️', Database: '🗄️',
};

const getPlatformIcon = (type) => {
  if (!type) return '💻';
  const key = Object.keys(platformIcons).find((k) => type.toLowerCase().includes(k.toLowerCase()));
  return key ? platformIcons[key] : '💻';
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
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState({});
  const [revealingId, setRevealingId] = useState(null);
  const timersRef = useRef({});

  useEffect(() => {
    portalApi.getMyAssets()
      .then(({ data }) => setAssets(data || []))
      .catch(() => toast.error(t('portal.load_error', 'Failed to load your assets')))
      .finally(() => setLoading(false));
    const timers = timersRef.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleReveal = useCallback(async (id) => {
    if (revealed[id]) {
      setRevealed((prev) => { const next = { ...prev }; delete next[id]; return next; });
      if (timersRef.current[id]) { clearTimeout(timersRef.current[id]); delete timersRef.current[id]; }
      return;
    }
    setRevealingId(id);
    try {
      const res = await portalApi.revealMyPassword(id);
      const password = res.data?.password || res.data;
      setRevealed((prev) => ({ ...prev, [id]: password }));
      // Back to dots on its own, so a credential is not left on a shared screen.
      timersRef.current[id] = setTimeout(() => {
        setRevealed((prev) => { const next = { ...prev }; delete next[id]; return next; });
        delete timersRef.current[id];
      }, 10000);
    } catch {
      toast.error(t('portal.reveal_error', 'Failed to reveal password'));
    } finally { setRevealingId(null); }
  }, [revealed, t]);

  const copy = (text, label) => {
    navigator.clipboard.writeText(text)
      .then(() => toast.success(t('portal.copied', `${label} copied to clipboard`)))
      .catch(() => toast.error(t('portal.copy_error', 'Failed to copy')));
  };

  const hardware = assets.filter((a) => a.asset_type === 'Hardware');
  const accounts = assets.filter((a) => a.asset_type !== 'Hardware');

  return (
    <PortalShell
      icon={Shield}
      title={t('portal.my_assets_title', 'My Assets & Accounts')}
      subtitle={t('portal.my_assets_subtitle', 'View your assigned devices and account credentials')}
      stats={[
        { value: hardware.length, label: t('portal.devices', 'Devices') },
        { value: accounts.length, label: t('portal.accounts', 'Accounts') },
      ]}
    >
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="!p-5 animate-pulse">
              <div className="h-4 bg-surface-200 rounded w-1/2 mb-3" />
              <div className="h-3 bg-surface-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-surface-100 rounded w-1/3" />
            </Card>
          ))}
        </div>
      ) : assets.length === 0 ? (
        <Card className="!py-16">
          <EmptyState icon={<Package className="w-6 h-6 text-surface-400" />}
            title={t('portal.no_assets', 'No assets assigned')}
            description={t('portal.no_assets_desc', 'You don\'t have any assigned devices or accounts yet. Contact your IT department if you believe this is an error.')} />
        </Card>
      ) : (
        <>
          {hardware.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><Monitor size={16} className="text-blue-600" /></div>
                <h2 className="text-lg font-semibold text-surface-800">{t('portal.hardware_section', 'Assigned Hardware')}</h2>
                <Badge variant="info">{hardware.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {hardware.map((item) => (
                  <div key={item.id} className="group bg-white rounded-2xl border border-surface-100 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300">
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl"><Laptop size={20} className="text-blue-600" /></div>
                      <Badge variant="active" className="text-[10px]" dot>
                        {t(`portal.${(item.status || 'active').toLowerCase()}`, item.status || 'Active')}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-surface-800 mb-2">
                      {item.name}
                      {(item.brand || item.model) && (
                        <span className="text-surface-400 font-normal"> — {[item.brand, item.model].filter(Boolean).join(' ')}</span>
                      )}
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

          {accounts.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-100 rounded-lg"><Lock size={16} className="text-violet-600" /></div>
                <h2 className="text-lg font-semibold text-surface-800">{t('portal.accounts_section', 'Accounts & Credentials')}</h2>
                <Badge variant="brand">{accounts.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accounts.map((item) => {
                  const isRevealed = !!revealed[item.id];
                  const isRevealing = revealingId === item.id;
                  // The handover form stores this as account_username;
                  // `identifier` is the fallback for older rows.
                  const username = item.account_username || item.identifier;
                  return (
                    <div key={item.id} className="group bg-white rounded-2xl border border-surface-100 shadow-sm hover:shadow-lg hover:border-brand-200 transition-all duration-300 overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-brand-500 via-violet-500 to-purple-500" />
                      <div className="p-5">
                        <div className="flex items-start gap-3 mb-4">
                          <div className="text-2xl flex-shrink-0 p-2 bg-surface-50 rounded-xl">
                            {getPlatformIcon(item.platform_name || item.asset_type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-surface-800 truncate">{item.platform_name || item.name}</h3>
                            <span className="text-xs text-surface-400">
                              {item.platform_name && item.name !== item.platform_name ? item.name
                                : (item.asset_type === 'Account' ? t('portal.account', 'Account') : t('portal.software', 'Software'))}
                            </span>
                          </div>
                          <Badge variant="active" className="text-[10px] flex-shrink-0" dot>{t('portal.active', 'Active')}</Badge>
                        </div>

                        {username && (
                          <div className="bg-surface-50 rounded-xl px-3 py-2.5 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] uppercase tracking-wider text-surface-400 font-medium block">{t('portal.username', 'Username')}</span>
                                <span className="text-sm font-medium text-surface-700 truncate block">{username}</span>
                              </div>
                              <button onClick={() => copy(username, 'Username')} title={t('portal.copy_username', 'Copy username')}
                                className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex-shrink-0">
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>
                        )}

                        {item.has_password && (
                          <div className="bg-surface-50 rounded-xl px-3 py-2.5 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] uppercase tracking-wider text-surface-400 font-medium block">{t('portal.password', 'Password')}</span>
                                <div className="flex items-center gap-2">
                                  <span className={`text-sm font-medium truncate block ${isRevealed ? 'font-mono text-surface-700' : 'text-surface-400 tracking-widest'}`}>
                                    {isRevealed ? revealed[item.id] : '••••••••'}
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
                                  <button onClick={() => copy(revealed[item.id], 'Password')} title={t('portal.copy_password', 'Copy password')}
                                    className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                                    <Copy size={14} />
                                  </button>
                                )}
                                <button onClick={() => handleReveal(item.id)} disabled={isRevealing}
                                  title={isRevealed ? t('portal.hide_password', 'Hide password') : t('portal.reveal_password', 'Reveal password')}
                                  className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${isRevealed
                                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-surface-400 hover:text-brand-600 hover:bg-brand-50'}`}>
                                  {isRevealing ? <div className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                    : isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

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
        </>
      )}
    </PortalShell>
  );
}
