import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import { Download, Loader2, DatabaseBackup } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import { downloadBlob } from '@utils/pdf';
import * as api from '@api/backupApi';

const size = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

/**
 * The nightly database backups kept on the server volume. Platform admins only:
 * a backup holds every company's data.
 */
export default function Backups() {
  const { t } = useTranslation();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, data: null, denied: false });
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let off = false;
    api.listNightly().then(({ data }) => { if (!off) setState({ key: reload, data, denied: false }); })
      .catch((e) => { if (!off) setState({ key: reload, data: null, denied: e?.response?.status === 403 }); });
    return () => { off = true; };
  }, [reload]);

  const loaded = state.key === reload;
  const runNow = async () => {
    setBusy('run');
    try { const { data } = await api.runNightly(); toast.success(t('backups.done', { name: data.name, rows: data.rows })); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(null); }
  };
  const download = async (name) => {
    setBusy(name);
    try { const res = await api.downloadNightly(name); downloadBlob(res.data, name); }
    catch { toast.error(t('common.operation_failed')); }
    finally { setBusy(null); }
  };

  if (!loaded) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;
  if (state.denied || !state.data) return <Card className="!p-5"><p className="text-sm text-surface-500">{t('backups.platform_only')}</p></Card>;
  const d = state.data;
  return (
    <div className="space-y-4">
      <Card className="!p-4 flex items-start gap-3">
        <div className="flex-1">
          <h3 className="font-semibold text-surface-900 flex items-center gap-2">{t('backups.title')}
            {d.enabled ? <Badge variant="success">{t('backups.on')}</Badge> : <Badge variant="inactive">{t('backups.off')}</Badge>}</h3>
          <p className="text-xs text-surface-500 mt-0.5">{t('backups.desc', { keep: d.keep })}</p>
          <p className="text-xs text-amber-700 mt-1">{t('backups.offsite')}</p>
        </div>
        <Button onClick={runNow} loading={busy === 'run'}><DatabaseBackup size={14} /> {t('backups.run_now')}</Button>
      </Card>
      <Card className="!p-0 overflow-hidden">
        {d.backups.length === 0 ? <p className="text-sm text-surface-400 text-center py-6">{t('backups.none')}</p> : (
          <table className="w-full text-sm">
            <tbody>
              {d.backups.map((b) => (
                <tr key={b.name} className="border-t border-surface-50 first:border-t-0">
                  <td className="p-3 font-mono text-xs">{b.name}</td>
                  <td className="p-3 text-xs text-surface-500">{dayjs(b.created_at).format('YYYY-MM-DD HH:mm')}</td>
                  <td className="p-3 text-xs text-surface-500">{size(b.size)}</td>
                  <td className="p-3 text-end">
                    <Button size="sm" variant="secondary" onClick={() => download(b.name)} loading={busy === b.name}><Download size={13} /> {t('backups.download')}</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
