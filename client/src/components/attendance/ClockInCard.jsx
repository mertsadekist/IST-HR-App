import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { LogIn, LogOut, MapPin } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import * as clockApi from '@api/clockApi';

/** The browser's position, or null when unavailable or refused. */
function locate() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}

/**
 * Clock in / out from the portal, when an admin has switched it on for this
 * person. Hidden otherwise. The location is taken at the moment of the punch.
 */
export default function ClockInCard({ t, onPunched }) {
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, s: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    clockApi.getStatus()
      .then(({ data }) => { if (!off) setState({ key: reload, s: data }); })
      .catch(() => { if (!off) setState({ key: reload, s: { available: false } }); });
    return () => { off = true; };
  }, [reload]);

  const s = state.key === reload ? state.s : null;
  if (!s?.available) return null;

  const go = async () => {
    setBusy(true);
    try {
      const pos = await locate();
      if (!pos && s.require_location) { toast.error(t('clock.location_needed')); return; }
      const { data } = await clockApi.punch({ kind: s.next, ...(pos || {}) });
      toast.success(t(data.kind === 'in' ? 'clock.clocked_in' : 'clock.clocked_out', { time: data.at }) + (data.recorded ? '' : ` ${t('clock.door_kept')}`));
      setReload((n) => n + 1);
      onPunched?.();
    } catch (e) {
      const r = e?.response?.data;
      toast.error(r?.reason ? t(`clock.reason.${r.reason}`, { distance: r.distance_m ?? '', site: r.site ?? '' }) : t('common.operation_failed'));
    } finally { setBusy(false); }
  };

  return (
    <Card className="!p-4 flex items-center gap-4 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-surface-900">{t('clock.title')}</p>
        <p className="text-xs text-surface-500">
          {s.today?.check_in ? t('clock.in_at', { time: s.today.check_in }) : t('clock.not_in')}
          {s.today?.check_out ? ` · ${t('clock.out_at', { time: s.today.check_out })}` : ''}
          {s.sites?.length > 0 && <span className="inline-flex items-center gap-1 ms-2"><MapPin size={11} /> {s.sites.join(' · ')}</span>}
        </p>
      </div>
      <Button onClick={go} loading={busy} variant={s.next === 'in' ? 'primary' : 'secondary'}>
        {s.next === 'in' ? <><LogIn size={16} /> {t('clock.clock_in')}</> : <><LogOut size={16} /> {t('clock.clock_out')}</>}
      </Button>
    </Card>
  );
}
