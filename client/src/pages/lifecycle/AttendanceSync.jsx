import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import * as attendanceApi from '@api/attendanceApi';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import EmptyState from '@components/ui/EmptyState';
import { confirmAction } from '@utils/confirm';
import { toast } from 'react-toastify';
import {
  CloudDownload, RefreshCw, Play, AlertTriangle, CheckCircle2, EyeOff, Undo2, FileText,
} from 'lucide-react';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || f;

const fileTone = { Imported: 'active', Failed: 'danger', Skipped: 'inactive', Pending: 'warning' };
const runTone = { Completed: 'active', Failed: 'danger', 'No File': 'warning', Running: 'info' };

export default function AttendanceSync() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [test, setTest] = useState(null);
  const [ignoreFor, setIgnoreFor] = useState(null);
  const [ignoreReason, setIgnoreReason] = useState('');

  // State is written only once the response is back, so neither the effect nor
  // the refreshes after an action set state synchronously.
  const load = useCallback(() => attendanceApi.syncStatus()
    .then(({ data: d }) => { setData(d); })
    .catch((e) => { toast.error(apiErr(e, t('common.failed_load'))); })
    .finally(() => setLoading(false)), [t]);

  useEffect(() => {
    let alive = true;
    attendanceApi.syncStatus()
      .then(({ data: d }) => { if (alive) setData(d); })
      .catch(() => { if (alive) toast.error(t('common.failed_load')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [t]);

  const runNow = async (overwriteManual = false) => {
    setBusy('run');
    try {
      const { data: r } = await attendanceApi.syncRun({ overwrite_manual: overwriteManual });
      if (r.skipped) toast.info(r.reason);
      else if (r.status === 'No File') toast.warning(t('sync.no_new_file'));
      else if (r.ok) toast.success(t('sync.run_done', { files: r.summary?.files_imported || 0, rows: (r.summary?.inserted || 0) + (r.summary?.updated || 0) }));
      else toast.error(r.error || t('sync.run_failed'));
      load();
    } catch (e) { toast.error(apiErr(e, t('sync.run_failed'))); }
    finally { setBusy(null); }
  };

  const overwriteRun = async () => {
    // Overwriting hand corrections is the one action here that destroys work
    // somebody did deliberately, so it asks first and says what it will do.
    const r = await confirmAction(t('sync.overwrite_title'), t('sync.overwrite_warning'));
    if (r?.isConfirmed) runNow(true);
  };

  const retry = async (f) => {
    setBusy(`retry-${f.drive_file_id}`);
    try {
      await attendanceApi.syncRetry(f.drive_file_id);
      toast.success(t('sync.retried', { name: f.file_name }));
      load();
    } catch (e) { toast.error(apiErr(e, t('sync.run_failed'))); }
    finally { setBusy(null); }
  };

  const runTest = async () => {
    setBusy('test');
    try {
      const { data: r } = await attendanceApi.syncTest();
      setTest(r);
      if (r.ok) toast.success(t('sync.test_ok', { count: r.file_count }));
      else toast.error(r.problems?.[0] || t('sync.test_failed'));
    } catch (e) { toast.error(apiErr(e, t('sync.test_failed'))); }
    finally { setBusy(null); }
  };

  const saveIgnore = async (e) => {
    e.preventDefault();
    try {
      await attendanceApi.syncIgnore({
        device_id: ignoreFor.device_id, device_name: ignoreFor.name, reason: ignoreReason.trim() || undefined,
      });
      toast.success(t('sync.ignored', { id: ignoreFor.device_id }));
      setIgnoreFor(null); setIgnoreReason(''); load();
    } catch (err) { toast.error(apiErr(err, t('common.error'))); }
  };

  const unignore = async (d) => {
    try {
      await attendanceApi.syncUnignore(d.device_id);
      toast.success(t('sync.unignored', { id: d.device_id }));
      load();
    } catch (e) { toast.error(apiErr(e, t('common.error'))); }
  };

  if (loading) return <Card className="!p-8 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>;

  const lastRun = data?.runs?.[0];
  const lastSummary = lastRun?.summary
    ? (typeof lastRun.summary === 'string' ? JSON.parse(lastRun.summary) : lastRun.summary)
    : null;
  const unmatched = lastSummary?.unmatched || [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <CloudDownload size={22} className="text-brand-600" /> {t('sync.title')}
          </h1>
          <p className="text-surface-500 mt-0.5 text-sm">
            {t('sync.subtitle', { hour: String(data?.scheduled_hour ?? 5).padStart(2, '0') })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={runTest} loading={busy === 'test'}>
            <CheckCircle2 size={14} /> {t('sync.test')}
          </Button>
          <Button variant="secondary" size="sm" onClick={load}><RefreshCw size={14} /></Button>
          <Button size="sm" onClick={() => runNow(false)} loading={busy === 'run'} disabled={!data?.configured}>
            <Play size={14} /> {t('sync.run_now')}
          </Button>
        </div>
      </div>

      {/* Not configured is the normal first state, so it explains itself */}
      {!data?.configured && (
        <Card className="!p-4 border-amber-200 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900 flex items-center gap-2">
            <AlertTriangle size={16} /> {t('sync.not_configured')}
          </p>
          <ul className="text-xs text-amber-800 mt-2 space-y-1 ps-5 list-disc">
            {data?.config_problems?.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <p className="text-xs text-amber-700 mt-2">{t('sync.not_configured_help')}</p>
        </Card>
      )}

      {test && (
        <Card className={`!p-4 ${test.ok ? 'border-emerald-200 bg-emerald-50' : 'border-red-200 bg-red-50'}`}>
          <p className={`text-sm font-medium ${test.ok ? 'text-emerald-800' : 'text-red-800'}`}>
            {test.ok
              ? t('sync.test_result_ok', { count: test.file_count, newest: test.newest?.name || '—' })
              : test.problems?.join(' · ')}
          </p>
          {/* None of this is secret — the key id is the identifier shown in the
              Keys list in Google Cloud, and the server time is what tells a
              clock-skew rejection apart from a revoked key. Shown on success
              too, so the working values can be compared against later. */}
          {test.diagnostics && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 pt-3 border-t border-surface-200/60 text-[11px]">
              {[
                ['sync.diag_account', test.diagnostics.service_account],
                ['sync.diag_key_id', test.diagnostics.key_id],
                ['sync.diag_key_length', test.diagnostics.key_length],
                ['sync.diag_folder', test.diagnostics.folder_id],
                ['sync.diag_server_time', test.diagnostics.server_time_utc],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-3">
                  <dt className="text-surface-500 shrink-0">{t(k)}</dt>
                  <dd className="font-mono text-surface-700 text-end break-all">{v ?? '—'}</dd>
                </div>
              ))}
            </dl>
          )}
        </Card>
      )}

      {/* Last run */}
      {lastRun && (
        <Card className="!p-5">
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-sm font-semibold text-surface-800">{t('sync.last_run')}</h2>
            <Badge variant={runTone[lastRun.status] || 'info'} className="text-[10px]">{lastRun.status}</Badge>
            <span className="text-xs text-surface-400 ms-auto">
              {dayjs(lastRun.started_at).format('DD MMM YYYY HH:mm')} · {lastRun.trigger_type}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
            {[
              { v: lastRun.files_seen, l: t('sync.files_seen') },
              { v: lastRun.files_imported, l: t('sync.files_imported') },
              { v: lastSummary?.inserted ?? 0, l: t('sync.rows_new') },
              { v: lastSummary?.updated ?? 0, l: t('sync.rows_updated') },
              { v: unmatched.length, l: t('sync.unmatched'), warn: unmatched.length > 0 },
            ].map((s, i) => (
              <div key={i} className={`rounded-xl border p-3 ${s.warn ? 'border-amber-200 bg-amber-50' : 'border-surface-200'}`}>
                <p className={`text-xl font-bold ${s.warn ? 'text-amber-800' : 'text-surface-900'}`}>{s.v}</p>
                <p className="text-[11px] text-surface-500 mt-0.5">{s.l}</p>
              </div>
            ))}
          </div>
          {lastRun.error && <p className="text-xs text-red-700 mt-3">{lastRun.error}</p>}
        </Card>
      )}

      {/* Unknown device IDs — the list that needs action */}
      {unmatched.length > 0 && (
        <Card className="!p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-1">{t('sync.unmatched_title')}</h2>
          <p className="text-xs text-surface-500 mb-3">{t('sync.unmatched_help')}</p>
          <div className="space-y-2">
            {unmatched.map((u) => (
              <div key={u.device_id} className="flex items-center gap-3 p-2.5 rounded-xl border border-surface-200">
                <span className="font-mono text-xs bg-surface-100 px-2 py-1 rounded">{u.device_id}</span>
                <span className="text-sm text-surface-700">{u.name || '—'}</span>
                <Button size="sm" variant="ghost" className="ms-auto"
                  onClick={() => { setIgnoreFor(u); setIgnoreReason(''); }}>
                  <EyeOff size={14} /> {t('sync.ignore')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Files */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-surface-100 flex items-center gap-2">
          <FileText size={16} className="text-surface-400" />
          <h2 className="text-sm font-semibold text-surface-800">{t('sync.files_title')}</h2>
          <Badge variant="info" className="text-[10px]">{data?.files?.length || 0}</Badge>
          <Button size="sm" variant="ghost" className="ms-auto text-amber-700" onClick={overwriteRun}
            disabled={!data?.configured}>
            {t('sync.overwrite_run')}
          </Button>
        </div>
        {!data?.files?.length ? (
          <EmptyState icon={<CloudDownload className="w-6 h-6 text-surface-400" />}
            title={t('sync.no_files')} description={t('sync.no_files_desc')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.file')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.day')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.status')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('sync.rows')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('sync.rows_new')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('sync.rows_updated')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.detail')}</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {data.files.map((f) => (
                  <tr key={f.id} className={`hover:bg-surface-50/60 ${f.status === 'Failed' ? 'bg-red-50/40' : ''}`}>
                    <td className="px-5 py-2.5 font-mono text-xs text-surface-700">{f.file_name}</td>
                    <td className="px-5 py-2.5 text-surface-600">{f.business_date || '—'}</td>
                    <td className="px-5 py-2.5">
                      <Badge variant={fileTone[f.status] || 'info'} className="text-[10px]">{f.status}</Badge>
                    </td>
                    <td className="px-5 py-2.5 text-end text-surface-600">{f.rows_total ?? '—'}</td>
                    <td className="px-5 py-2.5 text-end text-emerald-700">{f.inserted ?? '—'}</td>
                    <td className="px-5 py-2.5 text-end text-surface-600">{f.updated ?? '—'}</td>
                    <td className="px-5 py-2.5 text-xs text-surface-500 max-w-[18rem] truncate">
                      {f.error || f.skip_reason || (f.imported_at ? dayjs(f.imported_at).format('DD MMM HH:mm') : '')}
                    </td>
                    <td className="px-5 py-2.5 text-end">
                      {f.status === 'Failed' && (
                        <Button size="sm" variant="ghost" loading={busy === `retry-${f.drive_file_id}`}
                          onClick={() => retry(f)}>
                          <RefreshCw size={13} /> {t('sync.retry')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Ignore list */}
      {data?.ignored?.length > 0 && (
        <Card className="!p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-3">{t('sync.ignored_title')}</h2>
          <div className="space-y-2">
            {data.ignored.map((d) => (
              <div key={d.id} className="flex items-center gap-3 p-2.5 rounded-xl border border-surface-200">
                <span className="font-mono text-xs bg-surface-100 px-2 py-1 rounded">{d.device_id}</span>
                <span className="text-sm text-surface-700">{d.device_name || '—'}</span>
                {d.reason && <span className="text-xs text-surface-400">· {d.reason}</span>}
                <Button size="sm" variant="ghost" className="ms-auto" onClick={() => unignore(d)}>
                  <Undo2 size={14} /> {t('sync.unignore')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!ignoreFor} onClose={() => setIgnoreFor(null)} title={t('sync.ignore_title')} size="sm">
        {ignoreFor && (
          <form onSubmit={saveIgnore} className="space-y-4">
            <p className="text-sm text-surface-600">
              {t('sync.ignore_confirm', { id: ignoreFor.device_id, name: ignoreFor.name || '—' })}
            </p>
            <Input label={t('sync.ignore_reason')} value={ignoreReason} placeholder={t('sync.ignore_reason_ph')}
              onChange={(e) => setIgnoreReason(e.target.value)} />
            <div className="flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => setIgnoreFor(null)}>{t('common.cancel')}</Button>
              <Button type="submit"><EyeOff size={14} /> {t('sync.ignore')}</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
