import { useState, useEffect, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import * as domainsApi from '@api/domainsApi';
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
import { confirmDelete } from '@utils/confirm';
import {
  Globe, Plus, RefreshCw, Search, CalendarClock, AlertTriangle, CheckCircle2,
  Edit3, Trash2, BellRing, CreditCard,
} from 'lucide-react';
import dayjs from 'dayjs';

const OWNER_SCOPES = ['RE', 'MKT', 'GRP'];

const statusVariant = (s) => ({
  Active: 'active', Pending: 'warning', Expired: 'danger', Transferred: 'info', Cancelled: 'inactive',
}[s] || 'info');

// How urgent a renewal is. Anything in the past is the loudest case: the domain
// is already gone as far as the registrar is concerned.
const urgency = (days) => {
  if (days == null) return { tone: 'text-surface-400', key: 'none' };
  if (days < 0) return { tone: 'text-red-600 font-bold', key: 'expired' };
  if (days <= 7) return { tone: 'text-red-600 font-semibold', key: 'critical' };
  if (days <= 30) return { tone: 'text-orange-600 font-semibold', key: 'soon' };
  if (days <= 90) return { tone: 'text-amber-600', key: 'watch' };
  return { tone: 'text-surface-600', key: 'ok' };
};

const emptyForm = (companyId) => ({
  company_id: companyId ? String(companyId) : '', owner_scope: 'GRP', platform_id: '',
  account_or_domain_name: '', domain_name: '', registrar_provider: '', asset_kind: 'Domain',
  account_owner: '', technical_owner: '', billing_owner: '',
  dns_control_owner: '', hosting_control_owner: '', assigned_employee_id: '',
  renewal_date: '', auto_renew: false, account_status: 'Active',
  vault_secret_reference: '', notes: '',
});

export default function Domains() {
  const { t } = useTranslation();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';
  const scopeParams = currentCompanyId ? { company_id: currentCompanyId } : {};

  const [rows, setRows] = useState([]);
  const [watch, setWatch] = useState(null);
  const [options, setOptions] = useState({ asset_kinds: [], statuses: [], renewal_thresholds: [] });
  const [registrars, setRegistrars] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [ownerFilter, setOwnerFilter] = useState('');
  const [kindFilter, setKindFilter] = useState('');

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm(currentCompanyId));

  const [renewModal, setRenewModal] = useState(null);
  const [renewDate, setRenewDate] = useState('');
  const [renewing, setRenewing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [listRes, watchRes] = await Promise.all([
        domainsApi.getDomains({
          ...scopeParams,
          ...(ownerFilter ? { owner_scope: ownerFilter } : {}),
          ...(kindFilter ? { asset_kind: kindFilter } : {}),
          ...(search ? { search } : {}),
        }),
        domainsApi.getExpiring({ ...scopeParams, days: 90 }),
      ]);
      setRows(listRes.data); setWatch(watchRes.data);
    } catch { toast.error(t('domains.load_failed')); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId, ownerFilter, kindFilter, search, t]);

  useEffect(() => { const id = setTimeout(load, search ? 300 : 0); return () => clearTimeout(id); }, [load, search]);

  useEffect(() => {
    domainsApi.getDomainOptions().then(({ data }) => setOptions(data)).catch(() => {});
    // Only the registrars and hosting providers from the catalogue are relevant here.
    settingsApi.getPlatformCatalog({ owner_scope: undefined })
      .then(({ data }) => setRegistrars((data || []).filter((p) => p.category_name === 'Domains / Hosting / Infrastructure')))
      .catch(() => {});
  }, []);

  useEffect(() => {
    employeesApi.getEmployees({ ...scopeParams, limit: 200 })
      .then(({ data }) => setEmployees(data.data || data || [])).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentCompanyId]);

  const update = (f, v) => setForm((p) => ({ ...p, [f]: v }));

  const openAdd = () => { setEditing(null); setForm(emptyForm(currentCompanyId)); setModalOpen(true); };
  const openEdit = (d) => {
    setEditing(d);
    setForm({
      ...emptyForm(d.company_id),
      ...Object.fromEntries(Object.entries(d).map(([k, v]) => [k, v == null ? '' : v])),
      company_id: String(d.company_id),
      platform_id: d.platform_id ? String(d.platform_id) : '',
      assigned_employee_id: d.assigned_employee_id ? String(d.assigned_employee_id) : '',
      auto_renew: !!d.auto_renew,
    });
    setModalOpen(true);
  };

  const pickRegistrar = (id) => {
    const p = registrars.find((x) => String(x.id) === String(id));
    setForm((prev) => ({ ...prev, platform_id: id, registrar_provider: p?.name || prev.registrar_provider }));
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.account_or_domain_name) { toast.error(t('domains.name_required')); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: form.company_id ? parseInt(form.company_id) : undefined,
        platform_id: form.platform_id ? parseInt(form.platform_id) : null,
        assigned_employee_id: form.assigned_employee_id ? parseInt(form.assigned_employee_id) : null,
      };
      if (editing) await domainsApi.updateDomain(editing.id, payload, scopeParams);
      else await domainsApi.createDomain(payload);
      toast.success(editing ? t('domains.saved') : t('domains.created'));
      setModalOpen(false); load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.error')); }
    finally { setSaving(false); }
  };

  const openRenew = (d) => {
    setRenewModal(d);
    // A year forward from today is the usual registrar term, so offer it.
    setRenewDate(dayjs().add(1, 'year').format('YYYY-MM-DD'));
  };
  const submitRenew = async () => {
    setRenewing(true);
    try {
      await domainsApi.renewDomain(renewModal.id, { renewal_date: renewDate }, scopeParams);
      toast.success(t('domains.renewed'));
      setRenewModal(null); load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.error')); }
    finally { setRenewing(false); }
  };

  const remove = async (d) => {
    const res = await confirmDelete(`"${d.account_or_domain_name}"`);
    if (!res.isConfirmed) return;
    try { await domainsApi.deleteDomain(d.id, scopeParams); toast.success(t('common.deleted')); load(); }
    catch (err) { toast.error(err.response?.data?.error || t('common.delete_failed')); }
  };

  const runCheck = async () => {
    try {
      const { data } = await domainsApi.runRenewalCheck(scopeParams);
      toast.success(t('domains.check_done', { count: data.alerts_sent }));
      load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.error')); }
  };

  const cards = watch ? [
    { key: 'expired', value: watch.counts.expired, tone: 'from-red-500 to-red-700', icon: AlertTriangle },
    { key: 'within_7', value: watch.counts.within_7, tone: 'from-orange-500 to-orange-700', icon: CalendarClock },
    { key: 'within_30', value: watch.counts.within_30, tone: 'from-amber-500 to-amber-700', icon: CalendarClock },
    { key: 'no_billing_owner', value: watch.counts.no_billing_owner, tone: 'from-violet-600 to-purple-800', icon: CreditCard },
    { key: 'no_auto_renew', value: watch.counts.no_auto_renew, tone: 'from-brand-600 to-brand-800', icon: BellRing },
  ] : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('domains.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('domains.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && <Button variant="secondary" onClick={runCheck}><BellRing size={14} /> {t('domains.run_check')}</Button>}
          <Button variant="secondary" onClick={load}><RefreshCw size={14} /></Button>
          <Button onClick={openAdd}><Plus size={16} /> {t('domains.add')}</Button>
        </div>
      </div>

      {/* The watch-list, which is the reason this module exists */}
      {watch && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          {cards.map(({ key, value, tone, icon: Icon }) => (
            <div key={key} className={`relative overflow-hidden rounded-2xl bg-gradient-to-br ${tone} p-4 shadow-lg`}>
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/10 rounded-full -translate-y-6 translate-x-6" />
              <div className="relative">
                <div className="flex items-center gap-2 text-white/90 mb-2">
                  <div className="p-1.5 bg-white/20 rounded-lg"><Icon size={14} /></div>
                  <span className="text-xs font-medium">{t(`domains.card_${key}`)}</span>
                </div>
                <p className="text-2xl font-bold text-white">{value}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {watch && options.renewal_thresholds?.length > 0 && (
        <p className="text-[11px] text-surface-500">
          {t('domains.alert_note', { days: options.renewal_thresholds.join(', ') })}
        </p>
      )}

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('domains.search_ph')}
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
        <select value={kindFilter} onChange={(e) => setKindFilter(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-surface-200 rounded-xl input-focus min-w-[140px]">
          <option value="">{t('domains.all_kinds')}</option>
          {options.asset_kinds.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <Badge variant="brand">{rows.length}</Badge>
      </div>

      {loading ? (
        <div className="card p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3" /></div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Globe className="w-6 h-6 text-surface-400" />} title={t('domains.empty')}
          description={t('domains.empty_desc')} action={<Button onClick={openAdd}><Plus size={16} /> {t('domains.add')}</Button>} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs">
                <tr>
                  <th className="text-start p-3">{t('domains.th_name')}</th>
                  <th className="text-start p-3">{t('domains.th_registrar')}</th>
                  <th className="text-start p-3">{t('domains.th_owners')}</th>
                  <th className="p-3">{t('domains.th_renewal')}</th>
                  <th className="p-3">{t('domains.th_auto')}</th>
                  <th className="p-3">{t('domains.th_status')}</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((d) => {
                  const u = urgency(d.days_to_renewal);
                  return (
                    <tr key={d.id} className="border-t border-surface-50 group hover:bg-surface-50/50">
                      <td className="p-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-surface-800">{d.account_or_domain_name}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface-100 text-surface-600 font-semibold">{d.owner_scope}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">{d.asset_kind}</span>
                        </div>
                        {d.domain_name && d.domain_name !== d.account_or_domain_name && (
                          <p className="text-[10px] text-surface-400 mt-0.5">{d.domain_name}</p>
                        )}
                      </td>
                      <td className="p-3 text-xs text-surface-600">{d.registrar_provider || '—'}</td>
                      <td className="p-3 text-[10px] text-surface-500">
                        {/* Accountability is split on purpose: a domain lapses when
                            each of these assumes it was somebody else's renewal. */}
                        <div>{t('domains.o_technical')}: <span className={d.technical_owner ? 'text-surface-700' : 'text-red-500'}>{d.technical_owner || t('domains.unassigned')}</span></div>
                        <div>{t('domains.o_billing')}: <span className={d.billing_owner ? 'text-surface-700' : 'text-red-500'}>{d.billing_owner || t('domains.unassigned')}</span></div>
                        <div>{t('domains.o_dns')}: <span className={d.dns_control_owner ? 'text-surface-700' : 'text-surface-400'}>{d.dns_control_owner || '—'}</span></div>
                      </td>
                      <td className="p-3 text-center">
                        <p className={`text-xs ${u.tone}`}>{d.renewal_date || t('domains.no_date')}</p>
                        {d.days_to_renewal != null && (
                          <p className={`text-[10px] ${u.tone}`}>
                            {d.days_to_renewal < 0
                              ? t('domains.overdue_by', { days: Math.abs(d.days_to_renewal) })
                              : t('domains.in_days', { days: d.days_to_renewal })}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        {d.auto_renew
                          ? <CheckCircle2 size={14} className="inline text-emerald-600" title={t('domains.auto_on')} />
                          : <span className="text-[10px] text-surface-400">{t('domains.auto_off')}</span>}
                      </td>
                      <td className="p-3 text-center"><Badge variant={statusVariant(d.account_status)} className="text-[10px]">{d.account_status}</Badge></td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1">
                          {d.days_to_renewal != null && d.days_to_renewal <= 30 && (
                            <button onClick={() => openRenew(d)}
                              className="px-2 py-1 rounded-lg text-[11px] font-semibold bg-emerald-100 text-emerald-800 hover:bg-emerald-200 whitespace-nowrap">
                              {t('domains.mark_renewed')}
                            </button>
                          )}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => openEdit(d)} title={t('common.edit')}
                              className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg"><Edit3 size={14} /></button>
                            {isAdmin && (
                              <button onClick={() => remove(d)} title={t('common.delete')}
                                className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Record form */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('domains.edit') : t('domains.add')} size="xl">
        <form onSubmit={save} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input label={t('domains.f_account_or_domain_name')} required value={form.account_or_domain_name} onChange={(e) => update('account_or_domain_name', e.target.value)} />
            <Input label={t('domains.f_domain_name')} value={form.domain_name} onChange={(e) => update('domain_name', e.target.value)} />
            <Select label={t('domains.f_asset_kind')} value={form.asset_kind} onChange={(e) => update('asset_kind', e.target.value)}
              options={options.asset_kinds.map((k) => ({ value: k, label: k }))} />
            <Select label={t('asset_catalog.owner_scope')} value={form.owner_scope} onChange={(e) => update('owner_scope', e.target.value)}
              options={OWNER_SCOPES.map((s) => ({ value: s, label: t(`asset_catalog.owner_${s}`) }))} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Select label={t('domains.f_registrar_platform')} value={form.platform_id} onChange={(e) => pickRegistrar(e.target.value)}
              options={registrars.map((p) => ({ value: String(p.id), label: p.name }))} placeholder={t('domains.pick_registrar')} />
            <Input label={t('domains.f_registrar_provider')} value={form.registrar_provider} onChange={(e) => update('registrar_provider', e.target.value)} />
          </div>

          {/* Split accountability — the heart of the record */}
          <div className="p-3 rounded-xl bg-surface-50 space-y-3">
            <p className="text-xs font-semibold text-surface-700">{t('domains.owners_section')}</p>
            <p className="text-[10px] text-surface-500">{t('domains.owners_hint')}</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {['account_owner', 'technical_owner', 'billing_owner', 'dns_control_owner', 'hosting_control_owner'].map((f) => (
                <Input key={f} label={t(`domains.f_${f}`)} value={form[f]} onChange={(e) => update(f, e.target.value)} />
              ))}
              <Select label={t('domains.f_assigned_employee')} value={form.assigned_employee_id} onChange={(e) => update('assigned_employee_id', e.target.value)}
                options={employees.map((x) => ({ value: String(x.id), label: `${x.first_name} ${x.last_name}` }))} placeholder={t('domains.no_single_person')} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Input label={t('domains.f_renewal_date')} type="date" value={form.renewal_date} onChange={(e) => update('renewal_date', e.target.value)} />
            <label className="flex items-end gap-2 text-xs text-surface-700 pb-2">
              <input type="checkbox" checked={!!form.auto_renew} onChange={(e) => update('auto_renew', e.target.checked)} className="rounded" />
              {t('domains.f_auto_renew')}
            </label>
            <Select label={t('domains.f_account_status')} value={form.account_status} onChange={(e) => update('account_status', e.target.value)}
              options={options.statuses.map((s) => ({ value: s, label: s }))} />
            <Input label={t('lifecycle.vault_reference')} placeholder="VAULT-DNS-004" value={form.vault_secret_reference} onChange={(e) => update('vault_secret_reference', e.target.value)} />
          </div>
          <p className="text-[10px] text-surface-500">{t('domains.no_password_note')}</p>

          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('domains.f_notes')}</label>
            <textarea value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('common.add')}</Button>
          </div>
        </form>
      </Modal>

      {/* Renewal confirmation */}
      <Modal open={!!renewModal} onClose={() => setRenewModal(null)} title={t('domains.renew_title')} size="sm">
        {renewModal && (
          <div className="space-y-4">
            <div className="p-3 bg-surface-50 rounded-xl text-sm">
              <p className="font-semibold text-surface-800">{renewModal.account_or_domain_name}</p>
              <p className="text-xs text-surface-500">{renewModal.registrar_provider || '—'} · {t('domains.current_renewal')}: {renewModal.renewal_date || '—'}</p>
            </div>
            <p className="text-xs text-surface-600">{t('domains.renew_desc')}</p>
            <Input label={t('domains.new_renewal_date')} type="date" value={renewDate} onChange={(e) => setRenewDate(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setRenewModal(null)}>{t('common.cancel')}</Button>
              <Button onClick={submitRenew} loading={renewing}><CheckCircle2 size={14} /> {t('domains.confirm_renewed')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
