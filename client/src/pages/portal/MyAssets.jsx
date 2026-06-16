import { useState, useEffect, useRef, useCallback } from 'react';
import * as portalApi from '@api/portalApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import {
  Shield, Monitor, Laptop, Copy, Eye, EyeOff,
  ExternalLink, Package, Wifi, BarChart3, Lock, Unlock,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

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

export default function MyAssets() {
  const { t } = useTranslation();
  const [assets, setAssets] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealedPasswords, setRevealedPasswords] = useState({});
  const [revealingId, setRevealingId] = useState(null);
  const timersRef = useRef({});

  useEffect(() => {
    loadData();
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [assetsRes, inventoryRes] = await Promise.all([
        portalApi.getMyAssets().catch(() => ({ data: [] })),
        portalApi.getMyInventory().catch(() => ({ data: [] })),
      ]);
      setAssets(assetsRes.data || []);
      setInventory(inventoryRes.data || []);
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

  // Separate hardware items from account items
  const hardwareItems = assets.filter(a => a.asset_type === 'Hardware');
  const accountItems = assets.filter(a => a.asset_type !== 'Hardware');
  const hasAnything = hardwareItems.length > 0 || accountItems.length > 0 || inventory.length > 0;

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
        <div className="absolute top-1/2 right-1/4 w-20 h-20 bg-white/5 rounded-full" />
        <div className="relative flex items-center gap-4">
          <div className="p-3 bg-white/15 rounded-xl backdrop-blur-sm">
            <Shield className="text-white" size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">
              {t('portal.my_assets_title', 'My Assets & Accounts')}
            </h1>
            <p className="text-brand-200 text-sm mt-0.5">
              {t('portal.my_assets_subtitle', 'View your assigned devices and account credentials')}
            </p>
          </div>
          <div className="ml-auto flex gap-3">
            <div className="text-center bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
              <span className="block text-2xl font-bold text-white">{hardwareItems.length + inventory.length}</span>
              <span className="text-xs text-brand-200">{t('portal.devices', 'Devices')}</span>
            </div>
            <div className="text-center bg-white/10 rounded-xl px-4 py-2 backdrop-blur-sm">
              <span className="block text-2xl font-bold text-white">{accountItems.length}</span>
              <span className="text-xs text-brand-200">{t('portal.accounts', 'Accounts')}</span>
            </div>
          </div>
        </div>
      </div>

      {!hasAnything ? (
        <Card className="!py-16">
          <EmptyState
            icon={<Package className="w-6 h-6 text-surface-400" />}
            title={t('portal.no_assets', 'No assets assigned')}
            description={t('portal.no_assets_desc', 'You don\'t have any assigned devices or accounts yet. Contact your IT department if you believe this is an error.')}
          />
        </Card>
      ) : (
        <>
          {/* Hardware Section */}
          {(hardwareItems.length > 0 || inventory.length > 0) && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-blue-100 rounded-lg">
                  <Monitor size={16} className="text-blue-600" />
                </div>
                <h2 className="text-lg font-semibold text-surface-800">
                  {t('portal.hardware_section', 'Assigned Hardware')}
                </h2>
                <Badge variant="info">{hardwareItems.length + inventory.length}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Hardware from assets */}
                {hardwareItems.map(item => (
                  <div
                    key={`asset-${item.id}`}
                    className="group bg-white rounded-2xl border border-surface-100 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl group-hover:from-blue-100 group-hover:to-blue-200 transition-colors">
                        <Laptop size={20} className="text-blue-600" />
                      </div>
                      <Badge variant="active" className="text-[10px]" dot>
                        {t(`portal.${(item.status || 'active').toLowerCase()}`, item.status || 'Active')}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-surface-800 mb-2">{item.name}</h3>
                    <div className="space-y-1.5 text-xs text-surface-500">
                      {item.asset_type && (
                        <div className="flex justify-between">
                          <span>{t('portal.type', 'Type')}</span>
                          <span className="font-medium text-surface-600">{item.asset_type}</span>
                        </div>
                      )}
                      {item.identifier && (
                        <div className="flex justify-between">
                          <span>{t('portal.serial', 'Serial / ID')}</span>
                          <span className="font-mono font-medium text-surface-600">{item.identifier}</span>
                        </div>
                      )}
                      {item.workspace && (
                        <div className="flex justify-between">
                          <span>{t('portal.workspace', 'Workspace')}</span>
                          <span className="font-medium text-surface-600">{item.workspace}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {/* Hardware from inventory */}
                {inventory.map(item => (
                  <div
                    key={`inv-${item.id}`}
                    className="group bg-white rounded-2xl border border-surface-100 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="p-2 bg-gradient-to-br from-violet-50 to-violet-100 rounded-xl group-hover:from-violet-100 group-hover:to-violet-200 transition-colors">
                        <Package size={20} className="text-violet-600" />
                      </div>
                      <Badge variant={item.condition_status === 'New' ? 'active' : 'info'} className="text-[10px]">
                        {item.condition_status || 'Good'}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-surface-800 mb-1">
                      {item.brand} {item.model}
                    </h3>
                    <div className="space-y-1.5 text-xs text-surface-500">
                      {item.asset_code && (
                        <div className="flex justify-between items-center">
                          <span>{t('portal.asset_code', 'Asset Code')}</span>
                          <span className="flex items-center gap-1 font-mono font-medium text-surface-600">
                            <BarChart3 size={10} className="text-brand-400" />
                            {item.asset_code}
                          </span>
                        </div>
                      )}
                      {item.serial_number && (
                        <div className="flex justify-between">
                          <span>{t('portal.serial_number', 'Serial')}</span>
                          <span className="font-mono font-medium text-surface-600">{item.serial_number}</span>
                        </div>
                      )}
                      {item.location && (
                        <div className="flex justify-between">
                          <span>{t('portal.location', 'Location')}</span>
                          <span className="font-medium text-surface-600">{item.location}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Accounts Section */}
          {accountItems.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-violet-100 rounded-lg">
                  <Lock size={16} className="text-violet-600" />
                </div>
                <h2 className="text-lg font-semibold text-surface-800">
                  {t('portal.accounts_section', 'Accounts & Credentials')}
                </h2>
                <Badge variant="brand">{accountItems.length}</Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {accountItems.map(item => {
                  const icon = getPlatformIcon(item.platform_name || item.asset_type);
                  const isRevealed = !!revealedPasswords[item.id];
                  const isRevealing = revealingId === item.id;
                  const passwordDisplay = isRevealed ? revealedPasswords[item.id] : '••••••••';

                  return (
                    <div
                      key={`account-${item.id}`}
                      className="group bg-white rounded-2xl border border-surface-100 shadow-sm hover:shadow-lg hover:border-brand-200 transition-all duration-300 overflow-hidden"
                    >
                      {/* Top accent bar */}
                      <div className="h-1 bg-gradient-to-r from-brand-500 via-violet-500 to-purple-500" />

                      <div className="p-5">
                        {/* Header */}
                        <div className="flex items-start gap-3 mb-4">
                          <div className="text-2xl flex-shrink-0 p-2 bg-surface-50 rounded-xl">{icon}</div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-surface-800 truncate">
                              {item.platform_name || item.name}
                            </h3>
                            <span className="text-xs text-surface-400">
                              {item.asset_type === 'Account' ? t('portal.account', 'Account') : t('portal.software', 'Software')}
                            </span>
                          </div>
                          <Badge variant="active" className="text-[10px] flex-shrink-0" dot>
                            {t('portal.active', 'Active')}
                          </Badge>
                        </div>

                        {/* Username */}
                        {(item.identifier || item.username) && (
                          <div className="bg-surface-50 rounded-xl px-3 py-2.5 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="min-w-0 flex-1">
                                <span className="text-[10px] uppercase tracking-wider text-surface-400 font-medium block">
                                  {t('portal.username', 'Username')}
                                </span>
                                <span className="text-sm font-medium text-surface-700 truncate block">
                                  {item.identifier || item.username}
                                </span>
                              </div>
                              <button
                                onClick={() => handleCopy(item.identifier || item.username, 'Username')}
                                className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors flex-shrink-0"
                                title={t('portal.copy_username', 'Copy username')}
                              >
                                <Copy size={14} />
                              </button>
                            </div>
                          </div>
                        )}

                        {/* Password */}
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
                                <button
                                  onClick={() => handleCopy(revealedPasswords[item.id], 'Password')}
                                  className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                                  title={t('portal.copy_password', 'Copy password')}
                                >
                                  <Copy size={14} />
                                </button>
                              )}
                              <button
                                onClick={() => handleRevealPassword(item.id)}
                                disabled={isRevealing}
                                className={`p-1.5 rounded-lg transition-colors flex-shrink-0 ${
                                  isRevealed
                                    ? 'text-amber-500 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-surface-400 hover:text-brand-600 hover:bg-brand-50'
                                }`}
                                title={isRevealed ? t('portal.hide_password', 'Hide password') : t('portal.reveal_password', 'Reveal password')}
                              >
                                {isRevealing ? (
                                  <div className="w-3.5 h-3.5 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
                                ) : isRevealed ? (
                                  <EyeOff size={14} />
                                ) : (
                                  <Eye size={14} />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* URL */}
                        {item.url && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 text-xs text-brand-600 hover:text-brand-700 transition-colors group/link"
                          >
                            <ExternalLink size={12} />
                            <span className="group-hover/link:underline truncate">{item.url}</span>
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
    </div>
  );
}
