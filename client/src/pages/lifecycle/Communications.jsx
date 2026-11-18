import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Megaphone, Plus, Loader2, Send, Archive, Bell, Trash2, Users, Upload } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import * as hrApi from '@api/hrServicesApi';
import { confirmDelete } from '@utils/confirm';
import { POLICY_CATEGORIES, keyOf } from '@utils/hrServices';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 mt-1 bg-white';
const label = 'text-xs font-semibold text-surface-700';
const statusVariant = { Draft: 'inactive', Published: 'success', Retired: 'warning' };

/**
 * Announcements to employees, and policies they acknowledge. An admin's go to
 * every company; an HR manager's to the selected company.
 */
export default function Communications() {
  const { t } = useTranslation();
  const [tab, setTab] = useState('announcements');
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2"><Megaphone className="text-brand-600" /> {t('communications.title')}</h1>
        <p className="text-sm text-surface-500 mt-1">{t('communications.subtitle')}</p>
      </div>
      <div className="flex gap-1 border-b border-surface-100">
        {['announcements', 'policies'].map((tb) => (
          <button key={tb} type="button" onClick={() => setTab(tb)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === tb ? 'border-brand-600 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'}`}>{t(`communications.tab_${tb}`)}</button>
        ))}
      </div>
      {tab === 'announcements' ? <Announcements t={t} /> : <Policies t={t} />}
    </div>
  );
}

function Announcements({ t }) {
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${reload}`;
  const [state, setState] = useState({ key: null, items: [] });
  const [form, setForm] = useState(null);

  useEffect(() => {
    let off = false;
    hrApi.getAnnouncements()
      .then(({ data }) => { if (!off) setState({ key, items: data }); })
      .catch(() => { if (!off) setState({ key, items: [] }); });
    return () => { off = true; };
  }, [key]);

  const save = async (publish) => {
    try {
      const body = { ...form, publish };
      if (form.id) await hrApi.updateAnnouncement(form.id, body); else await hrApi.createAnnouncement(body);
      toast.success(publish ? t('communications.published') : t('communications.saved'));
      setForm(null); setReload((n) => n + 1);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const remove = async (a) => {
    if (!(await confirmDelete(`"${a.title}"`)).isConfirmed) return;
    try { await hrApi.deleteAnnouncement(a.id); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setForm({ title: '', body: '', priority: 'normal', expires_on: '' })}><Plus size={16} /> {t('communications.new_announcement')}</Button>
      </div>
      {state.key !== key ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        : state.items.length === 0 ? <Card><p className="text-sm text-surface-400 text-center py-6">{t('communications.no_announcements')}</p></Card> : (
          <Card className="!p-0 overflow-hidden">
            <ul className="divide-y divide-surface-100">
              {state.items.map((a) => (
                <li key={a.id} className="px-5 py-3 flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <button type="button" onClick={() => setForm({ ...a, expires_on: a.expires_on || '' })} className="font-medium text-surface-800 hover:text-brand-700 text-start">{a.title}</button>
                    <p className="text-xs text-surface-400">
                      {a.published_at ? t('communications.published_on', { date: String(a.published_at).slice(0, 10) }) : t('communications.draft')}
                      {' · '}{a.company_name || t('communications.all_companies')}
                      {a.expires_on && ` · ${t('communications.until', { date: a.expires_on })}`}
                      {a.published_at && ` · ${t('communications.read_by', { n: a.read_count })}`}
                    </p>
                  </div>
                  {a.priority === 'important' && <Badge variant="danger" className="text-[10px]">{t('announcements.important')}</Badge>}
                  {a.published_at && !a.live && <Badge variant="inactive" className="text-[10px]">{t('communications.expired')}</Badge>}
                  {isAdmin && <button type="button" onClick={() => remove(a)} className="p-1 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>}
                </li>
              ))}
            </ul>
          </Card>
        )}
      {form && (
        <Modal open onClose={() => setForm(null)} title={form.id ? form.title : t('communications.new_announcement')} size="md">
          <div className="space-y-3">
            <div><label className={label}>{t('communications.f_title')} *</label><input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} maxLength={200} className={input} /></div>
            <div><label className={label}>{t('communications.f_body')} *</label><textarea rows={6} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} className={input} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className={label}>{t('communications.f_priority')}</label>
                <select value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))} className={input}>
                  <option value="normal">{t('communications.priority_normal')}</option><option value="important">{t('announcements.important')}</option>
                </select></div>
              <div><label className={label}>{t('communications.f_expires')}</label><input type="date" value={form.expires_on} onChange={(e) => setForm((p) => ({ ...p, expires_on: e.target.value }))} className={input} /></div>
            </div>
            {!form.id && isAdmin && <p className="text-[11px] text-surface-500">{t('communications.group_hint')}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setForm(null)}>{t('common.cancel')}</Button>
              {!form.published_at && <Button variant="secondary" onClick={() => save(false)}>{t('communications.save_draft')}</Button>}
              <Button onClick={() => save(!form.published_at)}><Send size={14} /> {form.published_at ? t('common.save') : t('communications.publish')}</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Policies({ t }) {
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [reload, setReload] = useState(0);
  const key = `${currentCompanyId ?? 'all'}:${reload}`;
  const [state, setState] = useState({ key: null, items: [] });
  const [form, setForm] = useState(null);
  const [file, setFile] = useState(null);
  const [acks, setAcks] = useState(null); // { policy, data }

  useEffect(() => {
    let off = false;
    hrApi.getPolicies()
      .then(({ data }) => { if (!off) setState({ key, items: data }); })
      .catch(() => { if (!off) setState({ key, items: [] }); });
    return () => { off = true; };
  }, [key]);

  const refresh = () => setReload((n) => n + 1);
  const act = async (fn, ok) => {
    try { const r = await fn(); toast.success(ok(r?.data)); refresh(); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const save = async () => {
    const fd = new FormData();
    for (const k of ['title', 'category', 'body', 'ack_due']) fd.append(k, form[k] ?? '');
    fd.append('requires_ack', form.requires_ack ? '1' : '0');
    if (file) fd.append('file', file);
    try {
      if (form.id) await hrApi.updatePolicy(form.id, fd); else await hrApi.createPolicy(fd);
      toast.success(t('communications.saved')); setForm(null); setFile(null); refresh();
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };
  const openForm = async (p) => {
    if (!p) { setForm({ title: '', category: 'Other', body: '', requires_ack: true, ack_due: '' }); return; }
    try { const { data } = await hrApi.getPolicy(p.id); setForm({ ...data, requires_ack: !!data.requires_ack, ack_due: data.ack_due || '', body: data.body || '' }); }
    catch { toast.error(t('common.failed_load')); }
  };
  const showAcks = async (p) => {
    try { const { data } = await hrApi.getPolicyAcks(p.id); setAcks({ policy: p, data }); }
    catch { toast.error(t('common.failed_load')); }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><Button onClick={() => openForm(null)}><Plus size={16} /> {t('communications.new_policy')}</Button></div>
      {state.key !== key ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
        : state.items.length === 0 ? <Card><p className="text-sm text-surface-400 text-center py-6">{t('policies.none')}</p></Card> : (
          <Card className="!p-0 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-surface-50 text-surface-500 text-xs"><tr>
                <th className="text-start p-3">{t('communications.f_title')}</th><th className="text-start p-3">{t('communications.col_status')}</th>
                <th className="text-start p-3">{t('communications.col_acks')}</th><th className="p-3" />
              </tr></thead>
              <tbody>
                {state.items.map((p) => (
                  <tr key={p.id} className="border-t border-surface-50">
                    <td className="p-3">
                      <button type="button" onClick={() => openForm(p)} className="text-surface-800 hover:text-brand-700 text-start">{p.title}</button>
                      <span className="block text-[11px] text-surface-400">{t(`policies.cat.${keyOf(p.category)}`)} · {p.company_name || t('communications.all_companies')}</span>
                    </td>
                    <td className="p-3"><Badge variant={statusVariant[p.status]} className="text-[10px]">{t(`communications.status_${p.status.toLowerCase()}`)}</Badge>
                      {p.status !== 'Draft' && <span className="text-[11px] text-surface-400 ms-1.5">{t('policies.version', { n: p.version })}</span>}</td>
                    <td className="p-3 text-xs">
                      {p.progress ? (
                        <button type="button" onClick={() => showAcks(p)} className="inline-flex items-center gap-1.5 hover:text-brand-700">
                          <Users size={12} /> {p.progress.done}/{p.progress.total} ({p.progress.percent}%)
                        </button>
                      ) : '—'}
                    </td>
                    <td className="p-3 text-end whitespace-nowrap">
                      {p.status !== 'Retired' && (
                        <Button size="sm" variant={p.status === 'Draft' ? 'primary' : 'secondary'}
                          onClick={() => act(() => hrApi.publishPolicy(p.id), (d) => t('communications.policy_published', { n: d?.version }))}>
                          <Send size={13} /> {p.status === 'Draft' ? t('communications.publish') : t('communications.republish')}
                        </Button>
                      )}
                      {p.status === 'Published' && !!p.requires_ack && (
                        <button type="button" onClick={() => act(() => hrApi.remindPolicy(p.id), (d) => t('communications.reminded', { n: d?.reminded ?? 0 }))}
                          className="p-1.5 text-surface-400 hover:text-brand-600" title={t('communications.remind')} aria-label={t('communications.remind')}><Bell size={14} /></button>
                      )}
                      {p.status === 'Published' && (
                        <button type="button" onClick={() => act(() => hrApi.retirePolicy(p.id), () => t('communications.retired'))}
                          className="p-1.5 text-surface-400 hover:text-amber-600" title={t('communications.retire')} aria-label={t('communications.retire')}><Archive size={14} /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      <p className="text-[11px] text-surface-400">{t('communications.policy_hint')}</p>

      {form && (
        <Modal open onClose={() => { setForm(null); setFile(null); }} title={form.id ? form.title : t('communications.new_policy')} size="lg">
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2"><label className={label}>{t('communications.f_title')} *</label><input value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} maxLength={200} className={input} /></div>
              <div><label className={label}>{t('communications.f_category')}</label>
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))} className={input}>
                  {POLICY_CATEGORIES.map((c) => <option key={c} value={c}>{t(`policies.cat.${keyOf(c)}`)}</option>)}
                </select></div>
            </div>
            <div><label className={label}>{t('communications.f_policy_text')}</label><textarea rows={8} value={form.body} onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))} className={input} /></div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <label className="flex items-center gap-2 text-sm text-surface-700 cursor-pointer">
                <Upload size={14} className="text-surface-400" />
                <span className="truncate">{file ? file.name : form.file_name || t('communications.attach_pdf')}</span>
                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </label>
              <div><label className={label}>{t('communications.f_ack_due')}</label><input type="date" value={form.ack_due} onChange={(e) => setForm((p) => ({ ...p, ack_due: e.target.value }))} className={input} /></div>
            </div>
            <label className="flex items-center gap-2 text-sm text-surface-700">
              <input type="checkbox" checked={!!form.requires_ack} onChange={(e) => setForm((p) => ({ ...p, requires_ack: e.target.checked }))} /> {t('communications.requires_ack')}
            </label>
            {form.status === 'Published' && <p className="text-[11px] text-amber-700">{t('communications.edit_published_hint')}</p>}
            {!form.id && isAdmin && <p className="text-[11px] text-surface-500">{t('communications.group_hint')}</p>}
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => { setForm(null); setFile(null); }}>{t('common.cancel')}</Button>
              <Button onClick={save}>{t('common.save')}</Button>
            </div>
          </div>
        </Modal>
      )}

      {acks && (
        <Modal open onClose={() => setAcks(null)} title={`${acks.policy.title} · ${t('policies.version', { n: acks.data.version })}`} size="md">
          <p className="text-sm text-surface-600 mb-3">{t('communications.ack_summary', { done: acks.data.progress.done, total: acks.data.progress.total })}</p>
          <ul className="divide-y divide-surface-50 max-h-[60vh] overflow-y-auto">
            {acks.data.people.map((p) => (
              <li key={p.id} className="py-2 flex items-center gap-2 text-sm">
                <span className="flex-1">{p.name}{p.department && <span className="text-[11px] text-surface-400 ms-1.5">{p.department}</span>}</span>
                {p.acknowledged_on ? <Badge variant="success" className="text-[10px]">{p.acknowledged_on}</Badge> : <Badge variant="warning" className="text-[10px]">{t('policies.needs_ack')}</Badge>}
              </li>
            ))}
          </ul>
        </Modal>
      )}
    </div>
  );
}
