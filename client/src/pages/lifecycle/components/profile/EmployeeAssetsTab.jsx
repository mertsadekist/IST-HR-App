import { useState, useEffect } from 'react';
import { Laptop, KeyRound, Package } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import * as assetsApi from '@api/assetsApi';

/**
 * Everything handed to the employee during their employment — hardware, company
 * accounts and software licences — including items already returned, so the tab
 * doubles as a handover record. Credentials are never rendered from the list
 * payload: revealing one goes through the dedicated audited endpoint.
 */
const ASSET_ICONS = { Hardware: Laptop, Account: KeyRound, Software: Package };
const ASSET_STATUS_VARIANT = { Active: 'success', Returned: 'info', Deactivated: 'neutral', Missing: 'danger' };

export default function EmployeeAssetsTab({ employee, t, canReveal }) {
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState({});
  const [revealing, setRevealing] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // No status filter: returned/deactivated items are part of the record.
    assetsApi.getAssets({ employee_id: employee.id })
      .then(({ data }) => { if (!cancelled) setAssets(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setAssets([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employee.id]);

  const reveal = async (a) => {
    setRevealing(a.id);
    try {
      const { data } = await assetsApi.revealPassword(a.id);
      setRevealed((p) => ({ ...p, [a.id]: data.password }));
    } catch (err) { toast.error(err.response?.data?.error || t('common.operation_failed')); }
    finally { setRevealing(null); }
  };

  const active = assets.filter((a) => a.status === 'Active');
  const closed = assets.filter((a) => a.status !== 'Active');

  const row = (a) => {
    const Icon = ASSET_ICONS[a.asset_type] || Package;
    return (
      <div key={a.id} className="p-3 rounded-xl border border-surface-100">
        <div className="flex items-start gap-2.5">
          <Icon size={15} className="text-brand-500 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-surface-900">{a.name}</span>
              <Badge variant={ASSET_STATUS_VARIANT[a.status] || 'info'} className="text-[10px]">{a.status}</Badge>
              <span className="text-[10px] text-surface-400">{a.asset_type}</span>
              {a.platform_name && <span className="text-[10px] text-surface-400">· {a.platform_name}</span>}
            </div>
            <div className="text-[11px] text-surface-500 mt-0.5 space-y-0.5">
              {a.identifier && <p>{t('employees.asset_identifier')}: <span className="font-mono">{a.identifier}</span></p>}
              {a.account_username && <p>{t('employees.asset_username')}: <span className="font-mono">{a.account_username}</span></p>}
              {a.workspace && <p>{t('employees.asset_workspace')}: {a.workspace}</p>}
              {a.access_level && <p>{t('employees.asset_access')}: {a.access_level}</p>}
              <p>
                {t('employees.asset_issued')}: {a.issued_date ? dayjs(a.issued_date).format('MMM D, YYYY') : '—'}
                {a.returned_date ? ` · ${t('employees.asset_returned')}: ${dayjs(a.returned_date).format('MMM D, YYYY')}` : ''}
                {a.condition_note ? ` · ${a.condition_note}` : ''}
              </p>
              {a.notes && <p className="whitespace-pre-wrap">{a.notes}</p>}
              {a.handover_receipt_file && (
                <p className="text-emerald-600">
                  ✓ {t('employees.asset_receipt_on_file')}: {a.handover_receipt_file}
                  {a.handover_receipt_uploaded_at ? ` (${dayjs(a.handover_receipt_uploaded_at).format('MMM D, YYYY')})` : ''}
                </p>
              )}
              {revealed[a.id] && (
                <p className="text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                  {t('employees.password')}: <span className="font-mono font-semibold">{revealed[a.id]}</span>
                </p>
              )}
            </div>
          </div>
          {canReveal && a.has_password && !revealed[a.id] && (
            <Button size="sm" variant="secondary" onClick={() => reveal(a)} loading={revealing === a.id}>
              <KeyRound size={12} /> {t('employees.reveal_password')}
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (loading) return <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="card p-3 animate-pulse"><div className="h-3 bg-surface-200 rounded w-1/3" /></div>)}</div>;
  if (!assets.length) {
    return <Card><EmptyState icon={<Laptop className="w-5 h-5 text-surface-400" />} title={t('employees.no_assets')} description={t('employees.no_assets_desc')} /></Card>;
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 flex-wrap">
        <Badge variant="success">{active.length} {t('employees.assets_held')}</Badge>
        {closed.length > 0 && <Badge variant="info">{closed.length} {t('employees.assets_closed')}</Badge>}
      </div>

      {active.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-surface-800">{t('employees.assets_currently_held')}</h4>
          {active.map(row)}
        </div>
      )}
      {closed.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-surface-800">{t('employees.assets_returned_history')}</h4>
          {closed.map(row)}
        </div>
      )}
    </div>
  );
}
