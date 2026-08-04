import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as accessApi from '@api/digitalAccessApi';
import * as settingsApi from '@api/settingsApi';
import * as employeesApi from '@api/employeesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { confirmDelete, confirmAction } from '@utils/confirm';
import {
  KeyRound, Plus, Search, RefreshCw, ShieldAlert, ShieldCheck, Ban,
  CheckCircle2, Trash2, Edit3, Crown, Clock, Users,
} from 'lucide-react';

const OWNER_SCOPES = ['RE', 'MKT', 'GRP'];
// Admin and above — the elevated band the PRD reports on.
const PRIVILEGED = ['Admin', 'Super Admin', 'Owner'];

const statusVariant = (s) => ({
  Active: 'active', Assigned: 'info', 'Pending Activation': 'warning',
  Available: 'success', Suspended: 'warning', Revoked: 'danger', Archived: 'inactive',
}[s] || 'info');

const emptyForm = (companyId) => ({
  company_id: companyId ? String(companyId) : '', platform_id: '', employee_id: '',
  platform_name: '', workspace_business_name: '', account_page_name: '', account_page_url: '',
  business_portfolio_url: '', business_portfolio_id: '', business_id: '', ad_account_id: '',
  page_channel_workspace_id: '',
  team_member_full_name: '', team_member_profile_url: '', team_member_email: '',
  username: '', login_email: '', registered_phone: '',
  access_level: 'Viewer', page_access_level: '', ads_access_level: '',
  has_admin_access: false, has_owner_access: false, can_manage_users: false,
  seat_type: 'Not a seat', seat_consumes_inventory: false,
  status: 'Pending Activation', assigned_on: '', last_access_review: '',
  two_factor_enabled: false, vault_secret_reference: '', managed_by: '', notes: '',
  owner_scope: 'GRP',
});

export default function DigitalAccess() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';

  const [rows, setRows] = useState([]);
  const [options, setOptions] = useState({ access_levels: [], statuses: [], seat_types: [] });
  const [platforms, setPlatforms] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [privilegedOnly, setPrivilegedOnly] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm(currentCompanyId));

  const [reports, setReports] = useState(null);
  const [showReports, setShowReports] = useState(false);

  const scopeParams = currentCompanyId ? { company_id: currentCompanyId } : {};

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await accessApi.getDigitalAccess({
        ...scopeParams,
        ...(ownerFilter ? { owner_scope: ownerFilter } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(privilegedOnly ? { privileged: '1' } : {}),
        ...(search ? { search } : {}),
      });
      setRows(data);
    } catch { toast.error(t('digital_access.load_failed')); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId, ownerFilter, statusFilter, privilegedOnly, search, t]);

  useEffect(() => { const id = setTimeout(load, search ? 300 : 0); return () => clearTimeout(id); }, [load, search]);

  useEffect(() => {
    accessApi.getAccessOptions().then(({ data }) => setOptions(data)).catch(() => {});
    settingsApi.getPlatformCatalog().then(({ data }) => setPlatforms(data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    employeesApi.getEmployees({ ...scopeParams, limit: 200 })
      .then(({ data }) => setEmployees(data.data || data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId]);

  const loadReports = async () => {
    try { const { data } = await accessApi.getAccessReports(scopeParams); setReports(data); }
    catch { toast.error(t('digital_access.reports_failed')); }
  };

  const update = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const openAdd = () => { setEditing(null); setForm(emptyForm(currentCompanyId)); setModalOpen(true); };
  const openEdit = (r) => {
    setEditing(r);
    setForm({
      ...emptyForm(r.company_id),
      ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? '' : v])),
      platform_id: r.platform_id ? String(r.platform_id) : '',
      employee_id: r.employee_id ? String(r.employee_id) : '',
      company_id: String(r.company_id),
      has_admin_access: !!r.has_admin_access, has_owner_access: !!r.has_owner_access,
      can_manage_users: !!r.can_manage_users, seat_consumes_inventory: !!r.seat_consumes_inventory,
      two_factor_enabled: !!r.two_factor_enabled,
    });
    setModalOpen(true);
  };

  // Picking a catalogue platform fills the name and category rather than asking twice.
  const pickPlatform = (id) => {
    const p = platforms.find((x) => String(x.id) === String(id));
    setForm((prev) => ({
      ...prev, platform_id: id,
      platform_name: p?.name || prev.platform_name,
      owner_scope: p?.owner_scope || prev.owner_scope,
    }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.platform_name) { toast.error(t('digital_access.platform_required')); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: form.company_id ? parseInt(form.company_id) : undefined,
        platform_id: form.platform_id ? parseInt(form.platform_id) : null,
        employee_id: form.employee_id ? parseInt(form.employee_id) : null,
      };
      if (editing) await accessApi.updateAccess(editing.id, payload, scopeParams);
      else await accessApi.createAccess(payload);
      toast.success(editing ? t('digital_access.saved') : t('digital_access.granted'));
      setModalOpen(false); load(); if (showReports) loadReports();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.error'));
    } finally { setSaving(false); }
  };

  const revoke = async (r) => {
    const res = await confirmAction(t('digital_access.revoke_title'),
      t('digital_access.revoke_desc', { platform: r.platform_name, who: r.team_member_full_name || r.team_member_email || '—' }));
    if (!res?.isConfirmed) return;
    try {
      await accessApi.revokeAccess(r.id, {}, scopeParams);
      toast.success(t('digital_access.revoked'));
      load(); if (showReports) loadReports();
    } catch (err) { toast.error(err.response?.data?.error || t('common.error')); }
  };

  const markReviewed = async (r) => {
    try {
      await accessApi.reviewAccess(r.id, scopeParams);
      toast.success(t('digital_access.reviewed'));
      load(); if (showReports) loadReports();
    } catch { toast.error(t('common.error')); }
  };

  const remove = async (r) => {
    const res = await confirmDelete(`"${r.platform_name}" access`);
    if (!res.isConfirmed) return;
    try { await accessApi.deleteAccess(r.id, scopeParams); toast.success(t('common.deleted')); load(); }
    catch (err) { toast.error(err.response?.data?.error || t('common.delete_failed')); }
  };

  const reportBlocks = reports ? [
    { key: 'privileged', icon: ShieldAlert, tone: 'text-amber-600', rows: reports.privileged },
    { key: 'owners', icon: Crown, tone: 'text-violet-600', rows: reports.owners },
    { key: 'no_two_factor', icon: ShieldAlert, tone: 'text-red-600', rows: reports.no_two_factor },
    { key: 'overdue_review', icon: Clock, tone: 'text-orange-600', rows: reports.overdue_review },
    { key: 'pending_revoke', icon: Ban, tone: 'text-red-600', rows: reports.pending_revoke },
    { key: 'unused_seats', icon: KeyRound, tone: 'text-blue-600', rows: reports.unused_seats },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('digital_access.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('digital_access.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={() => { const n = !showReports; setShowReports(n); if (n && !reports) loadReports(); }}>
            <ShieldCheck size={14} /> {t('digital_access.reports')}
          </Button>
          <Button variant="secondary" onClick={load}><RefreshCw size={14} /></Button>
          <Button onClick={openAdd}><Plus size={16} /> {t('digital_access.grant_access')}</Button>
        </div>
      </div>

      {/* Governance reports the PRD names explicitly */}
      {showReports && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-2">
            <ShieldCheck size={16} className="text-brand-600" />
            <h3 className="font-semibold text-surface-800">{t('digital_access.reports')}</h3>
            {reports && <span className="text-xs text-surface-400">{t('digital_access.review_window', { days: reports.review_days })}</span>}
          </div>
          {!reports ? (
            <div className="p-5 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-surface-100">
              {reportBlocks.map(({ key, icon: Icon, tone, rows: list }) => (
                <div key={key} className="p-4 border-surface-100 sm:border-e last:sm:border-e-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={14} className={tone} />
                    <span className="text-xs font-semibold text-surface-700">{t(`digital_access.rpt_${key}`)}</span>
                    <span className={`ms-auto text-sm font-bold ${list.length ? tone : 'text-surface-300'}`}>{list.length}</span>
                  </div>
                  {list.length === 0 ? (
                    <p className="text-[10px] text-surface-400">{t('digital_access.rpt_none')}</p>
                  ) : (
                    <ul className="space-y-1">
                      {list.slice(0, 4).map((x) => (
                        <li key={x.id} className="text-[11px] text-surface-600 truncate">
                          {x.platform_name} · {x.team_member_full_name || x.employee_name || '—'}
                        </li>
                      ))}
                      {list.length > 4 && <li className="text-[10px] text-surface-400">+{list.length - 4}</li>}
                    </ul>
                  )}
                </div>
              ))}
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Users size={14} className="text-sky-600" />
                  <span className="text-xs font-semibold text-surface-700">{t('digital_access.rpt_cross_entity')}</span>
                  <span className={`ms-auto text-sm font-bold ${reports.cross_entity.length ? 'text-sky-600' : 'text-surface-300'}`}>{reports.cross_entity.length}</span>
                </div>
                {reports.cross_entity.length === 0 ? (
                  <p className="text-[10px] text-surface-400">{t('digital_access.rpt_none')}</p>
                ) : (
                  <ul className="space-y-1">
                    {reports.cross_entity.slice(0, 4).map((x) => (
                      <li key={x.team_member_email} className="text-[11px] text-surface-600 truncate">
                        {x.team_member_email} · {x.owner_scopes}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('digital_access.search_ph')}
            className="w-full ps-9 pe-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus" />
        </div>
        <div className="flex gap-1">
          {['', ...OWNER_SCOPES].map((o) => (
            <button key={o || 'all'} onClick={() => setOwnerFilter(o)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${ownerFilter === o ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
              {o ? t(`asset_catalog.owner_${o}`) : t('asset_catalog.owner_all')}
            </button>
          ))}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-surface-200 rounded-xl input-focus min-w-[140px]">
          <option value="">{t('digital_access.all_statuses')}</option>
          {options.statuses.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={() => setPrivilegedOnly((v) => !v)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${privilegedOnly ? 'bg-amber-500 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
          <ShieldAlert size={12} className="inline me-1" />{t('digital_access.privileged_only')}
        </button>
        <Badge variant="brand">{rows.length}</Badge>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<KeyRound className="w-6 h-6 text-surface-400" />}
          title={t('digital_access.empty')} description={t('digital_access.empty_desc')}
          action={<Button onClick={openAdd}><Plus size={16} /> {t('digital_access.grant_access')}</Button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs">
                <tr>
                  <th className="text-start p-3">{t('digital_access.th_platform')}</th>
                  <th className="text-start p-3">{t('digital_access.th_holder')}</th>
                  <th className="p-3">{t('digital_access.th_level')}</th>
                  <th className="p-3">{t('digital_access.th_seat')}</th>
                  <th className="p-3">{t('digital_access.th_2fa')}</th>
                  <th className="p-3">{t('digital_access.th_review')}</th>
                  <th className="p-3">{t('digital_access.th_status')}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-surface-50 group hover:bg-surface-50/50">
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {r.category_icon && <span>{r.category_icon}</span>}
                        <span className="font-medium text-surface-800">{r.platform_name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">{r.owner_scope}</span>
                      </div>
                      {(r.account_page_name || r.workspace_business_name) && (
                        <p className="text-[10px] text-surface-400 mt-0.5 truncate max-w-[220px]">
                          {r.account_page_name || r.workspace_business_name}
                        </p>
                      )}
                    </td>
                    <td className="p-3">
                      <p className="text-surface-800">{r.team_member_full_name || r.employee_name || '—'}</p>
                      {r.team_member_email && <p className="text-[10px] text-surface-400">{r.team_member_email}</p>}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${
                        PRIVILEGED.includes(r.access_level) ? 'bg-amber-100 text-amber-800' : 'bg-surface-100 text-surface-600'}`}>
                        {r.access_level}
                      </span>
                      {r.has_owner_access && <Crown size={11} className="inline ms-1 text-violet-600" />}
                    </td>
                    <td className="p-3 text-center text-xs text-surface-500">
                      {r.seat_consumes_inventory ? t('digital_access.seat_consumes') : (r.seat_type === 'Not a seat' ? '—' : r.seat_type)}
                    </td>
                    <td className="p-3 text-center">
                      {r.two_factor_enabled
                        ? <CheckCircle2 size={14} className="inline text-emerald-600" />
                        : <ShieldAlert size={14} className="inline text-red-500" title={t('digital_access.no_2fa')} />}
                    </td>
                    <td className="p-3 text-center text-xs text-surface-500">{r.last_access_review || '—'}</td>
                    <td className="p-3 text-center"><Badge variant={statusVariant(r.status)} className="text-[10px]">{r.status}</Badge></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => markReviewed(r)} title={t('digital_access.mark_reviewed')}
                          className="p-1.5 text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                          <CheckCircle2 size={14} />
                        </button>
                        <button onClick={() => openEdit(r)} title={t('common.edit')}
                          className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                          <Edit3 size={14} />
                        </button>
                        {!['Revoked', 'Archived'].includes(r.status) && (
                          <button onClick={() => revoke(r)} title={t('digital_access.revoke')}
                            className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Ban size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => remove(r)} title={t('common.delete')}
                            className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)}
        title={editing ? t('digital_access.edit_title') : t('digital_access.grant_title')} size="xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label={t('digital_access.platform')} value={form.platform_id} onChange={(e) => pickPlatform(e.target.value)}
              options={platforms.map((p) => ({ value: String(p.id), label: p.name }))} placeholder={t('digital_access.pick_platform')} />
            <Input label={t('digital_access.platform_name')} required value={form.platform_name}
              onChange={(e) => update('platform_name', e.target.value)} />
            <Select label={t('asset_catalog.owner_scope')} value={form.owner_scope} onChange={(e) => update('owner_scope', e.target.value)}
              options={OWNER_SCOPES.map((s) => ({ value: s, label: t(`asset_catalog.owner_${s}`) }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label={t('digital_access.workspace')} value={form.workspace_business_name} onChange={(e) => update('workspace_business_name', e.target.value)} />
            <Input label={t('digital_access.account_page_name')} value={form.account_page_name} onChange={(e) => update('account_page_name', e.target.value)} />
            <Input label={t('digital_access.account_page_url')} placeholder="https://..." value={form.account_page_url} onChange={(e) => update('account_page_url', e.target.value)} />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Input label={t('digital_access.business_id')} value={form.business_id} onChange={(e) => update('business_id', e.target.value)} />
            <Input label={t('digital_access.ad_account_id')} value={form.ad_account_id} onChange={(e) => update('ad_account_id', e.target.value)} />
            <Input label={t('digital_access.page_id')} value={form.page_channel_workspace_id} onChange={(e) => update('page_channel_workspace_id', e.target.value)} />
            <Input label={t('digital_access.portfolio_id')} value={form.business_portfolio_id} onChange={(e) => update('business_portfolio_id', e.target.value)} />
          </div>

          {/* Who holds it. The PRD refuses a first name or a team label — a full
              profile name and the invited corporate login are both required. */}
          <div className="p-3 rounded-xl bg-surface-50 space-y-3">
            <p className="text-xs font-semibold text-surface-700">{t('digital_access.holder_section')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Select label={t('digital_access.employee')} value={form.employee_id} onChange={(e) => update('employee_id', e.target.value)}
                options={employees.map((x) => ({ value: String(x.id), label: `${x.first_name} ${x.last_name}` }))}
                placeholder={t('digital_access.external_holder')} />
              <Input label={t('digital_access.full_name')} value={form.team_member_full_name} onChange={(e) => update('team_member_full_name', e.target.value)} />
              <Input label={t('digital_access.member_email')} value={form.team_member_email} onChange={(e) => update('team_member_email', e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input label={t('digital_access.profile_url')} placeholder="https://..." value={form.team_member_profile_url} onChange={(e) => update('team_member_profile_url', e.target.value)} />
              <Input label={t('digital_access.username')} value={form.username} onChange={(e) => update('username', e.target.value)} />
              <Input label={t('digital_access.registered_phone')} value={form.registered_phone} onChange={(e) => update('registered_phone', e.target.value)} />
            </div>
          </div>

          {/* Rights */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label={t('digital_access.access_level')} value={form.access_level} onChange={(e) => update('access_level', e.target.value)}
              options={options.access_levels.map((l) => ({ value: l, label: l }))} />
            <Select label={t('digital_access.page_level')} value={form.page_access_level} onChange={(e) => update('page_access_level', e.target.value)}
              options={options.access_levels.map((l) => ({ value: l, label: l }))} placeholder="—" />
            <Select label={t('digital_access.ads_level')} value={form.ads_access_level} onChange={(e) => update('ads_access_level', e.target.value)}
              options={options.access_levels.map((l) => ({ value: l, label: l }))} placeholder="—" />
          </div>
          <div className="flex flex-wrap gap-4">
            {[['has_admin_access', 'flag_admin'], ['has_owner_access', 'flag_owner'], ['can_manage_users', 'flag_manage_users'], ['two_factor_enabled', 'flag_2fa']].map(([f, k]) => (
              <label key={f} className="flex items-center gap-2 text-xs text-surface-700">
                <input type="checkbox" checked={!!form[f]} onChange={(e) => update(f, e.target.checked)} className="rounded" />
                {t(`digital_access.${k}`)}
              </label>
            ))}
          </div>
          <p className="text-[10px] text-surface-400 -mt-2">{t('digital_access.flag_hint')}</p>

          {/* Seat accounting */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label={t('digital_access.seat_type')} value={form.seat_type} onChange={(e) => update('seat_type', e.target.value)}
              options={options.seat_types.map((s) => ({ value: s, label: s }))} />
            <label className="flex items-end gap-2 text-xs text-surface-700 pb-2">
              <input type="checkbox" checked={!!form.seat_consumes_inventory} onChange={(e) => update('seat_consumes_inventory', e.target.checked)} className="rounded" />
              {t('digital_access.consumes_seat')}
            </label>
            <Select label={t('digital_access.status')} value={form.status} onChange={(e) => update('status', e.target.value)}
              options={options.statuses.map((s) => ({ value: s, label: s }))} />
          </div>
          <p className="text-[10px] text-surface-400 -mt-2">{t('digital_access.consumes_seat_hint')}</p>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input label={t('digital_access.assigned_on')} type="date" value={form.assigned_on} onChange={(e) => update('assigned_on', e.target.value)} />
            <Input label={t('digital_access.last_review')} type="date" value={form.last_access_review} onChange={(e) => update('last_access_review', e.target.value)} />
            <Input label={t('lifecycle.vault_reference')} placeholder="VAULT-SOCIAL-014" value={form.vault_secret_reference} onChange={(e) => update('vault_secret_reference', e.target.value)} />
            <Input label={t('digital_access.managed_by')} placeholder="Technology / Data" value={form.managed_by} onChange={(e) => update('managed_by', e.target.value)} />
          </div>
          <p className="text-[10px] text-surface-500">{t('digital_access.no_password_note')}</p>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('digital_access.notes')}</label>
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('digital_access.grant_access')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
