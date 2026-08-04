import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as socialApi from '@api/socialApi';
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
  Share2, Plus, RefreshCw, ShieldAlert, ShieldCheck, Crown, Clock, Users, Mail,
  CreditCard, UserMinus, CheckCircle2, Edit3, Trash2, Layers, AlertTriangle, Search,
} from 'lucide-react';

const SCOPES = ['RE', 'MKT'];
const PRIVILEGED = ['Admin', 'Super Admin', 'Owner'];

const accountStatusVariant = (s) => ({
  Active: 'active', 'To Be Completed': 'warning', Inactive: 'inactive', Suspended: 'danger', Archived: 'inactive',
}[s] || 'info');
const accessStatusVariant = (s) => ({
  Active: 'active', 'Pending Entry': 'warning', 'Pending Approval': 'warning', Suspended: 'danger', Removed: 'inactive',
}[s] || 'info');

// Rights the PRD tracks separately; billing and user management are the two that
// carry the most risk, so they read distinctly in the UI.
const RIGHTS = [
  'can_publish', 'can_reply_moderate', 'can_view_analytics',
  'can_create_ads', 'can_edit_campaigns', 'can_manage_billing', 'can_manage_users',
];

const emptyAccount = (scope) => ({
  owner_scope: scope || 'RE', platform: '', account_type: '',
  account_name: '', account_url: '', account_id: '', username_handle: '',
  business_manager_name: '', business_manager_url: '', business_manager_id: '',
  ads_manager_platform: '', ads_account_name: '', ads_account_url: '', ads_account_id: '',
  page_creator_name: '', page_creator_profile_url: '', page_creator_email: '',
  ads_creator_name: '', ads_creator_profile_url: '', ads_creator_email: '',
  creation_date: '', primary_business_owner: '', backup_admin: '', billing_owner: '', payment_method_owner: '',
  pixel_dataset_id: '', catalogue_commerce_id: '',
  recovery_email: '', recovery_phone: '', two_factor_enabled: false,
  status: 'To Be Completed', last_ownership_review: '', vault_secret_reference: '', notes: '',
});

const emptyAccess = (accountId, layer) => ({
  social_account_id: accountId || '', employee_id: '', asset_layer: layer || 'Page / Profile / Channel',
  asset_name: '', asset_id: '', asset_url: '',
  team_member_name: '', team_member_profile_url: '', team_member_email: '',
  department: '', job_title: '', access_level: 'Viewer',
  ...Object.fromEntries(RIGHTS.map((r) => [r, false])),
  granted_by_name: '', granted_by_profile_url: '', date_granted: '',
  status: 'Active', two_factor_enabled: false, last_access_review: '', vault_secret_reference: '', notes: '',
});

export default function SocialGovernance() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';
  const scopeParams = currentCompanyId ? { company_id: currentCompanyId } : {};

  const [tab, setTab] = useState('accounts');
  const [accounts, setAccounts] = useState([]);
  const [access, setAccess] = useState([]);
  const [options, setOptions] = useState({ asset_layers: [], account_statuses: [], access_statuses: [], access_levels: [], rights: [] });
  const [employees, setEmployees] = useState([]);
  const [governance, setGovernance] = useState(null);
  const [loading, setLoading] = useState(true);

  const [scopeFilter, setScopeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [layerFilter, setLayerFilter] = useState('');

  const [detail, setDetail] = useState(null);
  const [accModal, setAccModal] = useState(false);
  const [accForm, setAccForm] = useState(emptyAccount());
  const [editingAcc, setEditingAcc] = useState(null);
  const [accSaving, setAccSaving] = useState(false);

  const [accessModal, setAccessModal] = useState(false);
  const [accessForm, setAccessForm] = useState(emptyAccess());
  const [editingAccess, setEditingAccess] = useState(null);
  const [accessSaving, setAccessSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [accRes, acsRes, govRes] = await Promise.all([
        socialApi.getSocialAccounts({ ...scopeParams, ...(scopeFilter ? { owner_scope: scopeFilter } : {}), ...(search ? { search } : {}) }),
        socialApi.getSocialAccess({ ...scopeParams, ...(scopeFilter ? { owner_scope: scopeFilter } : {}), ...(layerFilter ? { asset_layer: layerFilter } : {}), ...(search ? { search } : {}) }),
        socialApi.getGovernance(scopeParams),
      ]);
      setAccounts(accRes.data); setAccess(acsRes.data); setGovernance(govRes.data);
    } catch { toast.error(t('social.load_failed')); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId, scopeFilter, layerFilter, search, t]);

  useEffect(() => { const id = setTimeout(load, search ? 300 : 0); return () => clearTimeout(id); }, [load, search]);

  useEffect(() => {
    socialApi.getSocialOptions().then(({ data }) => setOptions(data)).catch(() => {});
  }, []);
  useEffect(() => {
    employeesApi.getEmployees({ ...scopeParams, limit: 200 })
      .then(({ data }) => setEmployees(data.data || data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId]);

  const openDetail = async (a) => {
    try { const { data } = await socialApi.getSocialAccount(a.id, scopeParams); setDetail(data); }
    catch { toast.error(t('social.load_failed')); }
  };

  // ── account CRUD ──
  const openAddAcc = () => { setEditingAcc(null); setAccForm(emptyAccount(scopeFilter || 'RE')); setAccModal(true); };
  const openEditAcc = (a) => {
    setEditingAcc(a);
    setAccForm({ ...emptyAccount(), ...Object.fromEntries(Object.entries(a).map(([k, v]) => [k, v == null ? '' : v])), two_factor_enabled: !!a.two_factor_enabled });
    setAccModal(true);
  };
  const saveAcc = async (e) => {
    e.preventDefault();
    if (!accForm.platform) { toast.error(t('social.platform_required')); return; }
    setAccSaving(true);
    try {
      if (editingAcc) await socialApi.updateSocialAccount(editingAcc.id, accForm, scopeParams);
      else await socialApi.createSocialAccount({ ...accForm, company_id: currentCompanyId });
      toast.success(editingAcc ? t('social.account_saved') : t('social.account_created'));
      setAccModal(false); load(); if (detail) openDetail(detail);
    } catch (err) { toast.error(err.response?.data?.error || t('common.error')); }
    finally { setAccSaving(false); }
  };
  const reviewAcc = async (a) => {
    try { await socialApi.reviewSocialAccount(a.id, scopeParams); toast.success(t('social.reviewed')); load(); }
    catch { toast.error(t('common.error')); }
  };
  const removeAcc = async (a) => {
    const res = await confirmDelete(`${a.owner_scope} ${a.platform} — ${t('social.and_its_access_rows')}`);
    if (!res.isConfirmed) return;
    try { await socialApi.deleteSocialAccount(a.id, scopeParams); toast.success(t('common.deleted')); setDetail(null); load(); }
    catch (err) { toast.error(err.response?.data?.error || t('common.delete_failed')); }
  };

  // ── access CRUD ──
  const openAddAccess = (accountId, layer) => {
    setEditingAccess(null); setAccessForm(emptyAccess(accountId ? String(accountId) : '', layer)); setAccessModal(true);
  };
  const openEditAccess = (x) => {
    setEditingAccess(x);
    setAccessForm({
      ...emptyAccess(), ...Object.fromEntries(Object.entries(x).map(([k, v]) => [k, v == null ? '' : v])),
      social_account_id: String(x.social_account_id), employee_id: x.employee_id ? String(x.employee_id) : '',
      ...Object.fromEntries(RIGHTS.map((r) => [r, !!x[r]])), two_factor_enabled: !!x.two_factor_enabled,
    });
    setAccessModal(true);
  };
  const saveAccess = async (e) => {
    e.preventDefault();
    if (!accessForm.social_account_id) { toast.error(t('social.account_required')); return; }
    if (!accessForm.team_member_name.trim()) { toast.error(t('social.holder_required')); return; }
    setAccessSaving(true);
    try {
      const payload = {
        ...accessForm,
        social_account_id: parseInt(accessForm.social_account_id),
        employee_id: accessForm.employee_id ? parseInt(accessForm.employee_id) : null,
      };
      if (editingAccess) await socialApi.updateSocialAccess(editingAccess.id, payload, scopeParams);
      else await socialApi.createSocialAccess(payload);
      toast.success(editingAccess ? t('social.access_saved') : t('social.access_granted'));
      setAccessModal(false); load(); if (detail) openDetail(detail);
    } catch (err) { toast.error(err.response?.data?.error || t('common.error')); }
    finally { setAccessSaving(false); }
  };
  const removeAccess = async (x) => {
    const res = await confirmAction(t('social.remove_access_title'),
      t('social.remove_access_desc', { who: x.team_member_name, layer: x.asset_layer }));
    if (!res?.isConfirmed) return;
    try { await socialApi.removeSocialAccess(x.id, {}, scopeParams); toast.success(t('social.access_removed')); load(); if (detail) openDetail(detail); }
    catch (err) { toast.error(err.response?.data?.error || t('common.error')); }
  };
  const removeEverywhere = async (x) => {
    const res = await confirmAction(t('social.remove_all_title'),
      t('social.remove_all_desc', { who: x.team_member_name || x.team_member_email }));
    if (!res?.isConfirmed) return;
    try {
      const { data } = await socialApi.removePersonEverywhere(
        { social_account_id: x.social_account_id, team_member_email: x.team_member_email }, scopeParams);
      toast.success(t('social.removed_layers', { count: data.removed }));
      load(); if (detail) openDetail(detail);
    } catch (err) { toast.error(err.response?.data?.error || t('common.error')); }
  };

  const govBlocks = governance ? [
    { key: 'missing_backup_admin', icon: ShieldAlert, tone: 'text-red-600', rows: governance.missing_backup_admin, label: (x) => `${x.owner_scope} ${x.platform}` },
    { key: 'two_factor_gaps', icon: ShieldAlert, tone: 'text-red-600', rows: governance.two_factor_gaps, label: (x) => `${x.owner_scope} ${x.platform}` },
    { key: 'personal_email_risk', icon: Mail, tone: 'text-orange-600', rows: governance.personal_email_risk, label: (x) => `${x.owner_scope} ${x.platform}` },
    { key: 'missing_creator_provenance', icon: Users, tone: 'text-amber-600', rows: governance.missing_creator_provenance, label: (x) => `${x.owner_scope} ${x.platform}` },
    { key: 'overdue_ownership_review', icon: Clock, tone: 'text-orange-600', rows: governance.overdue_ownership_review, label: (x) => `${x.owner_scope} ${x.platform}` },
    { key: 'privileged_no_two_factor', icon: Crown, tone: 'text-red-600', rows: governance.privileged_no_two_factor, label: (x) => `${x.team_member_name} · ${x.platform}` },
    { key: 'billing_holders', icon: CreditCard, tone: 'text-violet-600', rows: governance.billing_holders, label: (x) => `${x.team_member_name} · ${x.platform}` },
    { key: 'incomplete_access_identity', icon: AlertTriangle, tone: 'text-amber-600', rows: governance.incomplete_access_identity, label: (x) => `${x.team_member_name} · ${x.platform}` },
    { key: 'cross_entity_access', icon: Users, tone: 'text-sky-600', rows: governance.cross_entity_access, label: (x) => `${x.team_member_email} · ${x.owner_scopes}` },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('social.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('social.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={load}><RefreshCw size={14} /></Button>
          {tab === 'accounts'
            ? <Button onClick={openAddAcc}><Plus size={16} /> {t('social.add_account')}</Button>
            : <Button onClick={() => openAddAccess()}><Plus size={16} /> {t('social.grant_access')}</Button>}
        </div>
      </div>

      {/* Governance panel — an inventory nobody reviews is a list, not a control */}
      {governance && (
        <Card className="!p-0 overflow-hidden">
          <div className="px-5 py-3 border-b border-surface-100 flex items-center gap-2 flex-wrap">
            <ShieldCheck size={16} className="text-brand-600" />
            <h3 className="font-semibold text-surface-800">{t('social.governance')}</h3>
            <span className="text-xs text-surface-400">{t('social.review_window', { days: governance.review_days })}</span>
            {governance.pending_completion > 0 && (
              <Badge variant="warning" className="ms-auto text-[10px]">
                {t('social.pending_completion', { count: governance.pending_completion })}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 divide-surface-100">
            {govBlocks.map(({ key, icon: Icon, tone, rows, label }) => (
              <div key={key} className="p-4 border-surface-100 sm:border-e last:sm:border-e-0">
                <div className="flex items-center gap-2 mb-2">
                  <Icon size={14} className={tone} />
                  <span className="text-xs font-semibold text-surface-700">{t(`social.gov_${key}`)}</span>
                  <span className={`ms-auto text-sm font-bold ${rows.length ? tone : 'text-surface-300'}`}>{rows.length}</span>
                </div>
                {rows.length === 0 ? (
                  <p className="text-[10px] text-surface-400">{t('social.gov_none')}</p>
                ) : (
                  <ul className="space-y-1">
                    {rows.slice(0, 4).map((x, i) => (
                      <li key={x.id || x.team_member_email || i} className="text-[11px] text-surface-600 truncate">{label(x)}</li>
                    ))}
                    {rows.length > 4 && <li className="text-[10px] text-surface-400">+{rows.length - 4}</li>}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabs + filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          {['accounts', 'access'].map((k) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${tab === k ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
              {t(`social.tab_${k}`)}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {['', ...SCOPES].map((s) => (
            <button key={s || 'all'} onClick={() => setScopeFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${scopeFilter === s ? 'bg-brand-600 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'}`}>
              {s ? t(`asset_catalog.owner_${s}`) : t('asset_catalog.owner_all')}
            </button>
          ))}
        </div>
        {tab === 'access' && (
          <select value={layerFilter} onChange={(e) => setLayerFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-surface-200 rounded-xl input-focus min-w-[180px]">
            <option value="">{t('social.all_layers')}</option>
            {options.asset_layers.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
        )}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('social.search_ph')}
            className="w-full ps-9 pe-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus" />
        </div>
        <Badge variant="brand">{tab === 'accounts' ? accounts.length : access.length}</Badge>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : tab === 'accounts' ? (
        accounts.length === 0 ? (
          <Card><EmptyState icon={<Share2 className="w-6 h-6 text-surface-400" />} title={t('social.no_accounts')}
            description={t('social.no_accounts_desc')} action={<Button onClick={openAddAcc}><Plus size={16} /> {t('social.add_account')}</Button>} /></Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {accounts.map((a) => (
              <Card key={a.id} hover className="!p-4 cursor-pointer" onClick={() => openDetail(a)}>
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-surface-900">{a.platform}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 font-semibold">{a.owner_scope}</span>
                    </div>
                    <p className="text-xs text-surface-500 truncate mt-0.5">{a.account_name || a.account_type || '—'}</p>
                  </div>
                  <Badge variant={accountStatusVariant(a.status)} className="text-[10px] shrink-0">{a.status}</Badge>
                </div>
                <div className="flex items-center gap-3 mt-3 text-[11px] text-surface-500">
                  <span className="flex items-center gap-1"><Layers size={11} /> {a.access_count} {t('social.grants')}</span>
                  {a.two_factor_enabled
                    ? <span className="flex items-center gap-1 text-emerald-600"><ShieldCheck size={11} /> 2FA</span>
                    : <span className="flex items-center gap-1 text-red-500"><ShieldAlert size={11} /> {t('social.no_2fa')}</span>}
                  {!a.backup_admin && <span className="text-red-500">{t('social.no_backup')}</span>}
                </div>
              </Card>
            ))}
          </div>
        )
      ) : access.length === 0 ? (
        <Card><EmptyState icon={<Users className="w-6 h-6 text-surface-400" />} title={t('social.no_access')}
          description={t('social.no_access_desc')} action={<Button onClick={() => openAddAccess()}><Plus size={16} /> {t('social.grant_access')}</Button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs">
                <tr>
                  <th className="text-start p-3">{t('social.th_asset')}</th>
                  <th className="text-start p-3">{t('social.th_layer')}</th>
                  <th className="text-start p-3">{t('social.th_person')}</th>
                  <th className="p-3">{t('social.th_level')}</th>
                  <th className="p-3">{t('social.th_rights')}</th>
                  <th className="p-3">{t('social.th_2fa')}</th>
                  <th className="p-3">{t('social.th_status')}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {access.map((x) => (
                  <tr key={x.id} className="border-t border-surface-50 group hover:bg-surface-50/50">
                    <td className="p-3">
                      <span className="font-medium text-surface-800">{x.platform}</span>
                      <span className="ms-2 text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-600">{x.owner_scope}</span>
                    </td>
                    <td className="p-3 text-xs text-surface-600">{x.asset_layer}</td>
                    <td className="p-3">
                      <p className="text-surface-800">{x.team_member_name}</p>
                      {x.team_member_email && <p className="text-[10px] text-surface-400">{x.team_member_email}</p>}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`text-[11px] px-2 py-0.5 rounded font-semibold ${PRIVILEGED.includes(x.access_level) ? 'bg-amber-100 text-amber-800' : 'bg-surface-100 text-surface-600'}`}>
                        {x.access_level}
                      </span>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex justify-center gap-1">
                        {x.can_manage_billing && <CreditCard size={12} className="text-violet-600" title={t('social.right_can_manage_billing')} />}
                        {x.can_manage_users && <Users size={12} className="text-red-500" title={t('social.right_can_manage_users')} />}
                        <span className="text-[10px] text-surface-400">{RIGHTS.filter((rk) => x[rk]).length}/7</span>
                      </div>
                    </td>
                    <td className="p-3 text-center">
                      {x.two_factor_enabled ? <CheckCircle2 size={14} className="inline text-emerald-600" /> : <ShieldAlert size={14} className="inline text-red-500" />}
                    </td>
                    <td className="p-3 text-center"><Badge variant={accessStatusVariant(x.status)} className="text-[10px]">{x.status}</Badge></td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => socialApi.reviewSocialAccess(x.id, scopeParams).then(() => { toast.success(t('social.reviewed')); load(); })}
                          title={t('social.mark_reviewed')} className="p-1.5 text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg">
                          <CheckCircle2 size={14} />
                        </button>
                        <button onClick={() => openEditAccess(x)} title={t('common.edit')}
                          className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><Edit3 size={14} /></button>
                        {x.status !== 'Removed' && (
                          <>
                            <button onClick={() => removeAccess(x)} title={t('social.remove_this_layer')}
                              className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><UserMinus size={14} /></button>
                            {x.team_member_email && (
                              <button onClick={() => removeEverywhere(x)} title={t('social.remove_all_layers')}
                                className="px-2 py-1 rounded-lg text-[10px] font-semibold bg-red-50 text-red-700 hover:bg-red-100 whitespace-nowrap">
                                {t('social.all_layers')}
                              </button>
                            )}
                          </>
                        )}
                        {isAdmin && (
                          <button onClick={async () => {
                            const res = await confirmDelete(`"${x.team_member_name}" ${x.asset_layer}`);
                            if (!res.isConfirmed) return;
                            try { await socialApi.deleteSocialAccess(x.id, scopeParams); toast.success(t('common.deleted')); load(); }
                            catch { toast.error(t('common.delete_failed')); }
                          }} title={t('common.delete')} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
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

      {/* Account detail — the three layers side by side */}
      <Modal open={!!detail} onClose={() => setDetail(null)}
        title={detail ? `${detail.owner_scope} · ${detail.platform}` : ''} size="xl">
        {detail && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap p-3 bg-surface-50 rounded-xl">
              <Badge variant={accountStatusVariant(detail.status)}>{detail.status}</Badge>
              {detail.account_url && <a href={detail.account_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline truncate max-w-[240px]">{detail.account_url}</a>}
              <div className="ms-auto flex gap-2">
                <Button size="sm" variant="secondary" onClick={() => reviewAcc(detail)}><CheckCircle2 size={13} /> {t('social.mark_reviewed')}</Button>
                <Button size="sm" variant="secondary" onClick={() => openEditAcc(detail)}><Edit3 size={13} /> {t('common.edit')}</Button>
                {isAdmin && <Button size="sm" variant="danger" onClick={() => removeAcc(detail)}><Trash2 size={13} /></Button>}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {[
                ['social.f_account_name', detail.account_name], ['social.f_handle', detail.username_handle],
                ['social.f_business_manager', detail.business_manager_name], ['social.f_ads_account', detail.ads_account_name],
                ['social.f_page_creator', detail.page_creator_name], ['social.f_page_creator_url', detail.page_creator_profile_url],
                ['social.f_ads_creator', detail.ads_creator_name], ['social.f_primary_owner', detail.primary_business_owner],
                ['social.f_backup_admin', detail.backup_admin], ['social.f_billing_owner', detail.billing_owner],
                ['social.f_recovery_email', detail.recovery_email], ['social.f_last_review', detail.last_ownership_review],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-2 border-b border-surface-50 pb-1">
                  <span className="text-surface-500">{t(k)}</span>
                  <span className={`font-medium truncate max-w-[55%] ${v ? 'text-surface-800' : 'text-red-500'}`}>{v || t('social.not_recorded')}</span>
                </div>
              ))}
            </div>

            {/* One column per layer — the model the PRD insists on */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
              {options.asset_layers.map((layer) => {
                const rows = (detail.access || []).filter((x) => x.asset_layer === layer);
                return (
                  <Card key={layer} className="!p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Layers size={13} className="text-brand-600" />
                      <span className="text-[11px] font-semibold text-surface-700 flex-1">{layer}</span>
                      <button onClick={() => openAddAccess(detail.id, layer)} className="p-1 text-surface-400 hover:text-brand-600 rounded"><Plus size={13} /></button>
                    </div>
                    {rows.length === 0 ? (
                      <p className="text-[10px] text-surface-400">{t('social.no_one_here')}</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {rows.map((x) => (
                          <li key={x.id} className="text-[11px]">
                            <div className="flex items-center gap-1">
                              <span className={`font-medium ${x.status === 'Removed' ? 'text-surface-400 line-through' : 'text-surface-800'}`}>{x.team_member_name}</span>
                              {x.can_manage_billing && <CreditCard size={10} className="text-violet-600" />}
                              {!x.two_factor_enabled && x.status !== 'Removed' && <ShieldAlert size={10} className="text-red-500" />}
                            </div>
                            <span className="text-[10px] text-surface-400">{x.access_level} · {RIGHTS.filter((rk) => x[rk]).length}/7</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </Modal>

      {/* Account form */}
      <Modal open={accModal} onClose={() => setAccModal(false)} title={editingAcc ? t('social.edit_account') : t('social.add_account')} size="xl">
        <form onSubmit={saveAcc} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Select label={t('social.entity')} value={accForm.owner_scope} onChange={(e) => setAccForm((p) => ({ ...p, owner_scope: e.target.value }))}
              options={SCOPES.map((s) => ({ value: s, label: t(`asset_catalog.owner_${s}`) }))} />
            <Input label={t('social.platform')} required value={accForm.platform} onChange={(e) => setAccForm((p) => ({ ...p, platform: e.target.value }))} />
            <Input label={t('social.account_type')} value={accForm.account_type} onChange={(e) => setAccForm((p) => ({ ...p, account_type: e.target.value }))} />
            <Select label={t('social.status')} value={accForm.status} onChange={(e) => setAccForm((p) => ({ ...p, status: e.target.value }))}
              options={options.account_statuses.map((s) => ({ value: s, label: s }))} />
          </div>
          <p className="text-[10px] text-surface-500">{t('social.entity_hint')}</p>

          {[
            { title: 'social.sec_page', fields: [['account_name'], ['account_url'], ['account_id'], ['username_handle']] },
            { title: 'social.sec_business', fields: [['business_manager_name'], ['business_manager_url'], ['business_manager_id'], ['pixel_dataset_id']] },
            { title: 'social.sec_ads', fields: [['ads_manager_platform'], ['ads_account_name'], ['ads_account_url'], ['ads_account_id']] },
            { title: 'social.sec_creators', fields: [['page_creator_name'], ['page_creator_profile_url'], ['page_creator_email'], ['ads_creator_name'], ['ads_creator_profile_url'], ['ads_creator_email']] },
            { title: 'social.sec_ownership', fields: [['primary_business_owner'], ['backup_admin'], ['billing_owner'], ['payment_method_owner'], ['catalogue_commerce_id']] },
            { title: 'social.sec_recovery', fields: [['recovery_email'], ['recovery_phone'], ['vault_secret_reference']] },
          ].map(({ title, fields }) => (
            <div key={title} className="p-3 rounded-xl bg-surface-50 space-y-3">
              <p className="text-xs font-semibold text-surface-700">{t(title)}</p>
              {title === 'social.sec_creators' && <p className="text-[10px] text-surface-500">{t('social.creators_hint')}</p>}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {fields.map(([f]) => (
                  <Input key={f} label={t(`social.f_${f}`)} value={accForm[f]} onChange={(e) => setAccForm((p) => ({ ...p, [f]: e.target.value }))} />
                ))}
              </div>
            </div>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label={t('social.f_creation_date')} type="date" value={accForm.creation_date} onChange={(e) => setAccForm((p) => ({ ...p, creation_date: e.target.value }))} />
            <Input label={t('social.f_last_ownership_review')} type="date" value={accForm.last_ownership_review} onChange={(e) => setAccForm((p) => ({ ...p, last_ownership_review: e.target.value }))} />
            <label className="flex items-end gap-2 text-xs text-surface-700 pb-2">
              <input type="checkbox" checked={!!accForm.two_factor_enabled} onChange={(e) => setAccForm((p) => ({ ...p, two_factor_enabled: e.target.checked }))} className="rounded" />
              {t('social.f_two_factor_enabled')}
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('social.f_notes')}</label>
            <textarea value={accForm.notes} onChange={(e) => setAccForm((p) => ({ ...p, notes: e.target.value }))} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus resize-none" />
          </div>
          <p className="text-[10px] text-surface-500">{t('social.no_password_note')}</p>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setAccModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={accSaving}>{editingAcc ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>

      {/* Access form */}
      <Modal open={accessModal} onClose={() => setAccessModal(false)} title={editingAccess ? t('social.edit_access') : t('social.grant_access')} size="xl">
        <form onSubmit={saveAccess} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Select label={t('social.account')} value={accessForm.social_account_id} onChange={(e) => setAccessForm((p) => ({ ...p, social_account_id: e.target.value }))}
              options={accounts.map((a) => ({ value: String(a.id), label: `${a.owner_scope} · ${a.platform}` }))} placeholder={t('social.pick_account')} />
            <Select label={t('social.asset_layer')} value={accessForm.asset_layer} onChange={(e) => setAccessForm((p) => ({ ...p, asset_layer: e.target.value }))}
              options={options.asset_layers.map((l) => ({ value: l, label: l }))} />
            <Select label={t('social.access_level')} value={accessForm.access_level} onChange={(e) => setAccessForm((p) => ({ ...p, access_level: e.target.value }))}
              options={options.access_levels.map((l) => ({ value: l, label: l }))} />
          </div>
          <p className="text-[10px] text-surface-500">{t('social.layer_hint')}</p>

          <div className="p-3 rounded-xl bg-surface-50 space-y-3">
            <p className="text-xs font-semibold text-surface-700">{t('social.holder_section')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select label={t('social.employee')} value={accessForm.employee_id} onChange={(e) => setAccessForm((p) => ({ ...p, employee_id: e.target.value }))}
                options={employees.map((x) => ({ value: String(x.id), label: `${x.first_name} ${x.last_name}` }))} placeholder={t('social.external_holder')} />
              <Input label={t('social.f_team_member_name')} required value={accessForm.team_member_name} onChange={(e) => setAccessForm((p) => ({ ...p, team_member_name: e.target.value }))} />
              <Input label={t('social.f_team_member_email')} value={accessForm.team_member_email} onChange={(e) => setAccessForm((p) => ({ ...p, team_member_email: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input label={t('social.f_team_member_profile_url')} placeholder="https://..." value={accessForm.team_member_profile_url} onChange={(e) => setAccessForm((p) => ({ ...p, team_member_profile_url: e.target.value }))} />
              <Input label={t('social.f_department')} value={accessForm.department} onChange={(e) => setAccessForm((p) => ({ ...p, department: e.target.value }))} />
              <Input label={t('social.f_job_title')} value={accessForm.job_title} onChange={(e) => setAccessForm((p) => ({ ...p, job_title: e.target.value }))} />
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-surface-700 mb-2">{t('social.rights_section')}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {RIGHTS.map((rk) => (
                <label key={rk} className={`flex items-center gap-2 text-xs px-2 py-1.5 rounded-lg ${
                  accessForm[rk] && (rk === 'can_manage_billing' || rk === 'can_manage_users') ? 'bg-red-50 text-red-800' : 'text-surface-700'}`}>
                  <input type="checkbox" checked={!!accessForm[rk]} onChange={(e) => setAccessForm((p) => ({ ...p, [rk]: e.target.checked }))} className="rounded" />
                  {t(`social.right_${rk}`)}
                </label>
              ))}
            </div>
            <p className="text-[10px] text-surface-500 mt-1">{t('social.rights_hint')}</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Select label={t('social.status')} value={accessForm.status} onChange={(e) => setAccessForm((p) => ({ ...p, status: e.target.value }))}
              options={options.access_statuses.map((s) => ({ value: s, label: s }))} />
            <Input label={t('social.f_date_granted')} type="date" value={accessForm.date_granted} onChange={(e) => setAccessForm((p) => ({ ...p, date_granted: e.target.value }))} />
            <Input label={t('social.f_last_access_review')} type="date" value={accessForm.last_access_review} onChange={(e) => setAccessForm((p) => ({ ...p, last_access_review: e.target.value }))} />
            <label className="flex items-end gap-2 text-xs text-surface-700 pb-2">
              <input type="checkbox" checked={!!accessForm.two_factor_enabled} onChange={(e) => setAccessForm((p) => ({ ...p, two_factor_enabled: e.target.checked }))} className="rounded" />
              {t('social.f_two_factor_enabled')}
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label={t('social.f_granted_by_name')} value={accessForm.granted_by_name} onChange={(e) => setAccessForm((p) => ({ ...p, granted_by_name: e.target.value }))} />
            <Input label={t('social.f_granted_by_profile_url')} placeholder="https://..." value={accessForm.granted_by_profile_url} onChange={(e) => setAccessForm((p) => ({ ...p, granted_by_profile_url: e.target.value }))} />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setAccessModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={accessSaving}>{editingAccess ? t('common.save') : t('social.grant_access')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
