import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
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
  DoorOpen, RefreshCw, Play, AlertTriangle, CheckCircle2, EyeOff, Undo2, History,
  CalendarCheck, Database, CalendarRange,
} from 'lucide-react';
import dayjs from 'dayjs';

const apiErr = (e, f) => e?.response?.data?.error || f;

const runTone = { Completed: 'active', Failed: 'danger', Running: 'info' };

const parseSummary = (s) => (s && typeof s === 'string' ? JSON.parse(s) : s) || null;

export default function AttendanceSync() {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(null);
  const [test, setTest] = useState(null);
  const [schema, setSchema] = useState(null);
  const [ignoreFor, setIgnoreFor] = useState(null);
  const [ignoreReason, setIgnoreReason] = useState('');
  const [range, setRange] = useState({ from: '', to: '', finalize: false, fill_only: true });

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

  const written = (r) => (r.summary?.inserted || 0) + (r.summary?.updated || 0);

  const runNow = async (overwriteManual = false) => {
    setBusy('run');
    try {
      const { data: r } = await attendanceApi.syncRun({ overwrite_manual: overwriteManual });
      if (r.skipped) toast.info(r.reason);
      else if (r.ok) toast.success(t('sync.run_done', { rows: written(r), punches: r.summary?.events_read || 0 }));
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

  const closeDays = async () => {
    setBusy('finalize');
    try {
      const { data: r } = await attendanceApi.syncFinalize({});
      if (r.skipped) toast.info(r.reason);
      else if (r.ok) {
        toast.success(t('sync.finalize_done', {
          absent: r.summary?.absences?.length || 0, leave: r.summary?.on_leave?.length || 0,
        }));
      } else toast.error(r.error || t('sync.run_failed'));
      load();
    } catch (e) { toast.error(apiErr(e, t('sync.run_failed'))); }
    finally { setBusy(null); }
  };

  const backfill = async (e) => {
    e.preventDefault();
    if (!range.from) { toast.warning(t('sync.backfill_need_dates')); return; }
    setBusy('backfill');
    try {
      const { data: r } = await attendanceApi.syncBackfill({
        from: range.from, to: range.to || undefined, finalize: range.finalize, fill_only: range.fill_only,
      });
      if (r.ok) toast.success(t('sync.backfill_done', { rows: written(r), kept: r.summary?.kept_existing || 0 }));
      else toast.error(r.error || t('sync.run_failed'));
      load();
    } catch (err) { toast.error(apiErr(err, t('sync.run_failed'))); }
    finally { setBusy(null); }
  };

  const runTest = async () => {
    setBusy('test');
    try {
      const { data: r } = await attendanceApi.syncTest();
      setTest(r);
      if (r.ok) toast.success(t('sync.test_ok', { count: r.event_count }));
      else toast.error(r.problems?.[0] || t('sync.test_failed'));
    } catch (e) { toast.error(apiErr(e, t('sync.test_failed'))); }
    finally { setBusy(null); }
  };

  const showSchema = async () => {
    setBusy('schema');
    try {
      const { data: r } = await attendanceApi.syncSchema();
      setSchema(r.tables);
      toast.success(t('sync.schema_loaded', { count: r.tables.length }));
    } catch (e) { toast.error(apiErr(e, t('sync.test_failed'))); }
    finally { setBusy(null); }
  };

  const saveIgnore = async (e) => {
    e.preventDefault();
    try {
      await attendanceApi.syncIgnore({
        device_id: ignoreFor.person_id, device_name: ignoreFor.name || undefined,
        reason: ignoreReason.trim() || undefined,
      });
      toast.success(t('sync.ignored', { id: ignoreFor.person_id }));
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

  const unmatched = data?.unmatched || [];
  const fmt = (v) => (v ? dayjs(v).format('DD MMM YYYY HH:mm') : t('sync.never'));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <DoorOpen size={22} className="text-brand-600" /> {t('sync.title')}
          </h1>
          <p className="text-surface-500 mt-0.5 text-sm">
            {t('sync.subtitle', {
              minutes: data?.interval_minutes ?? 5, hour: String(data?.finalize_hour ?? 5).padStart(2, '0'),
            })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="secondary" size="sm" onClick={runTest} loading={busy === 'test'}>
            <CheckCircle2 size={14} /> {t('sync.test')}
          </Button>
          {isAdmin && (
            <Button variant="secondary" size="sm" onClick={showSchema} loading={busy === 'schema'}>
              <Database size={14} /> {t('sync.show_schema')}
            </Button>
          )}
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
              ? t('sync.test_result_ok', {
                db: test.database, events: test.event_count, people: test.people_count,
                oldest: test.oldest_event || '—', newest: test.newest_event || '—',
              })
              : test.problems?.join(' · ')}
          </p>
          {/* Nothing here is secret: no password, no key. It is what an operator
              compares against the HIK_* variables when something is off. */}
          {test.diagnostics && (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-3 pt-3 border-t border-surface-200/60 text-[11px]">
              {[
                ['sync.diag_host', `${test.diagnostics.host}:${test.diagnostics.port}`],
                ['sync.diag_table', test.diagnostics.table],
                ['sync.diag_time_type', test.diagnostics.time_type],
                ['sync.diag_time_zone', test.diagnostics.time_zone],
                ['sync.diag_tls', test.diagnostics.tls],
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

      {schema && (
        <Card className="!p-5">
          <h2 className="text-sm font-semibold text-surface-800">{t('sync.schema_title')}</h2>
          <p className="text-xs text-surface-500 mb-3">{t('sync.schema_help')}</p>
          <div className="max-h-96 overflow-auto space-y-3">
            {schema.map((tb) => (
              <div key={tb.name}>
                <p className="font-mono text-xs font-semibold text-surface-800">{tb.name}</p>
                <p className="font-mono text-[11px] text-surface-500 break-words">
                  {tb.columns.map((c) => `${c.column} (${c.type})`).join(' · ')}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Where the feed stands */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { l: t('sync.last_sync'), v: fmt(data?.last_sync_at) },
          { l: t('sync.newest_punch'), v: data?.last_event_at ? dayjs(data.last_event_at).format('DD MMM HH:mm') : t('sync.none') },
          { l: t('sync.unmatched'), v: unmatched.length, warn: unmatched.length > 0 },
          { l: t('sync.last_error'), v: data?.last_error || t('sync.none'), warn: !!data?.last_error, small: true },
        ].map((s) => (
          <div key={s.l} className={`rounded-xl border p-3 ${s.warn ? 'border-amber-200 bg-amber-50' : 'border-surface-200 bg-white'}`}>
            <p className={`${s.small ? 'text-xs break-words' : 'text-lg'} font-bold ${s.warn ? 'text-amber-800' : 'text-surface-900'}`}>{s.v}</p>
            <p className="text-[11px] text-surface-500 mt-0.5">{s.l}</p>
          </div>
        ))}
      </div>

      <Card className="!p-5">
        <h2 className="text-sm font-semibold text-surface-800 mb-2">{t('sync.rules_title')}</h2>
        <ul className="text-xs text-surface-600 space-y-1 ps-5 list-disc">
          <li>{t('sync.rule_first')}</li>
          <li>{t('sync.rule_last')}</li>
          <li>{t('sync.rule_double', { minutes: data?.min_stay_minutes ?? 30 })}</li>
          <li>{t('sync.rule_today')}</li>
        </ul>
      </Card>

      {/* Unknown person ids — the list that needs action */}
      {unmatched.length > 0 && (
        <Card className="!p-5">
          <h2 className="text-sm font-semibold text-surface-800 mb-1">{t('sync.unmatched_title')}</h2>
          <p className="text-xs text-surface-500 mb-3">{t('sync.unmatched_help')}</p>
          <div className="space-y-2">
            {unmatched.map((u) => (
              <div key={u.person_id} className="flex items-center gap-3 p-2.5 rounded-xl border border-surface-200">
                <span className="font-mono text-xs bg-surface-100 px-2 py-1 rounded">{u.person_id}</span>
                <span className="text-sm text-surface-700">{u.name || '—'}</span>
                <span className="text-xs text-surface-400">{t('sync.unmatched_detail', { punches: u.punches, days: u.days })}</span>
                <Button size="sm" variant="ghost" className="ms-auto"
                  onClick={() => { setIgnoreFor(u); setIgnoreReason(''); }}>
                  <EyeOff size={14} /> {t('sync.ignore')}
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Closing days and loading earlier periods */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="!p-5">
          <h2 className="text-sm font-semibold text-surface-800 flex items-center gap-2">
            <CalendarCheck size={15} className="text-surface-400" /> {t('sync.finalize_now')}
          </h2>
          <p className="text-xs text-surface-500 mt-1 mb-3">{t('sync.finalize_help')}</p>
          <Button size="sm" variant="secondary" onClick={closeDays} loading={busy === 'finalize'} disabled={!data?.configured}>
            <CalendarCheck size={14} /> {t('sync.finalize_now')}
          </Button>
          <Button size="sm" variant="ghost" className="ms-2 text-amber-700" onClick={overwriteRun} disabled={!data?.configured}>
            {t('sync.overwrite_run')}
          </Button>
        </Card>

        {isAdmin && (
          <Card className="!p-5">
            <h2 className="text-sm font-semibold text-surface-800 flex items-center gap-2">
              <CalendarRange size={15} className="text-surface-400" /> {t('sync.backfill_title')}
            </h2>
            <p className="text-xs text-surface-500 mt-1 mb-3">{t('sync.backfill_help')}</p>
            <form onSubmit={backfill} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input type="date" label={t('sync.from')} value={range.from}
                  onChange={(e) => setRange({ ...range, from: e.target.value })} />
                <Input type="date" label={t('sync.to')} value={range.to}
                  onChange={(e) => setRange({ ...range, to: e.target.value })} />
              </div>
              <label className="flex items-start gap-2 text-xs text-surface-700">
                <input type="checkbox" className="mt-0.5" checked={range.fill_only}
                  onChange={(e) => setRange({ ...range, fill_only: e.target.checked })} />
                <span>
                  {t('sync.backfill_fill_only')}
                  <span className="block text-[11px] text-surface-500">{t('sync.backfill_fill_only_hint')}</span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-xs text-surface-700">
                <input type="checkbox" className="mt-0.5" checked={range.finalize}
                  onChange={(e) => setRange({ ...range, finalize: e.target.checked })} />
                <span>
                  {t('sync.backfill_finalize')}
                  <span className="block text-[11px] text-amber-700">{t('sync.backfill_finalize_hint')}</span>
                </span>
              </label>
              <Button type="submit" size="sm" loading={busy === 'backfill'} disabled={!data?.configured}>
                <History size={14} /> {t('sync.backfill_run')}
              </Button>
            </form>
          </Card>
        )}
      </div>

      {/* Runs */}
      <Card className="!p-0 overflow-hidden">
        <div className="p-4 border-b border-surface-100 flex items-center gap-2">
          <History size={16} className="text-surface-400" />
          <h2 className="text-sm font-semibold text-surface-800">{t('sync.runs_title')}</h2>
          <Badge variant="info" className="text-[10px]">{data?.runs?.length || 0}</Badge>
        </div>
        {!data?.runs?.length ? (
          <EmptyState icon={<DoorOpen className="w-6 h-6 text-surface-400" />}
            title={t('sync.no_runs')} description={t('sync.no_runs_desc')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 border-b border-surface-100">
                <tr className="text-[11px] uppercase tracking-wider text-surface-400">
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.when')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.trigger')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.range')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.status')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('sync.punches')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('sync.rows_new')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('sync.rows_updated')}</th>
                  <th className="px-5 py-3 text-end font-semibold">{t('sync.absent')}</th>
                  <th className="px-5 py-3 text-start font-semibold">{t('sync.detail')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-100">
                {data.runs.map((r) => {
                  const s = parseSummary(r.summary);
                  const gap = s?.not_observed_days?.length;
                  return (
                    <tr key={r.id} className={`hover:bg-surface-50/60 ${r.status === 'Failed' ? 'bg-red-50/40' : ''}`}>
                      <td className="px-5 py-2.5 text-xs text-surface-600 whitespace-nowrap">{dayjs.unix(r.started_ts).format('DD MMM HH:mm')}</td>
                      <td className="px-5 py-2.5 text-surface-700">{t(`sync.trigger_${r.trigger_type}`)}</td>
                      <td className="px-5 py-2.5 text-xs text-surface-600 whitespace-nowrap">
                        {r.date_from ? (r.date_from === r.date_to ? r.date_from : `${r.date_from} → ${r.date_to}`) : '—'}
                      </td>
                      <td className="px-5 py-2.5">
                        <Badge variant={runTone[r.status] || 'info'} className="text-[10px]">{t(`sync.status_${r.status}`)}</Badge>
                      </td>
                      <td className="px-5 py-2.5 text-end text-surface-600">{r.events_read}</td>
                      <td className="px-5 py-2.5 text-end text-emerald-700">{r.rows_inserted}</td>
                      <td className="px-5 py-2.5 text-end text-surface-600">{r.rows_updated}</td>
                      <td className="px-5 py-2.5 text-end text-surface-600">{r.absences}</td>
                      <td className="px-5 py-2.5 text-xs text-surface-500 max-w-[18rem] truncate">
                        {r.error || (gap ? s.not_observed_days.join(', ') : '')}
                      </td>
                    </tr>
                  );
                })}
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
                {isAdmin && (
                  <Button size="sm" variant="ghost" className="ms-auto" onClick={() => unignore(d)}>
                    <Undo2 size={14} /> {t('sync.unignore')}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Modal open={!!ignoreFor} onClose={() => setIgnoreFor(null)} title={t('sync.ignore_title')} size="sm">
        {ignoreFor && (
          <form onSubmit={saveIgnore} className="space-y-4">
            <p className="text-sm text-surface-600">
              {t('sync.ignore_confirm', { id: ignoreFor.person_id, name: ignoreFor.name || '—' })}
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
