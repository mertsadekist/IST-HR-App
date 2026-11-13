import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Inbox, Plus, FileText, Receipt, HandCoins, LifeBuoy, MessageSquare, Loader2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import ApprovalProgress from '@components/approvals/ApprovalProgress';
import RequestDetail from '@components/requests/RequestDetail';
import * as requestsApi from '@api/requestsApi';
import {
  REQUEST_TYPES, LETTER_TYPES, EXPENSE_CATEGORIES, CASE_CATEGORIES, OPEN_STATUSES,
  slug, statusVariant, money, requestTitle,
} from '@utils/requests';

const ICONS = { letter: FileText, expense: Receipt, advance: HandCoins, case: LifeBuoy };
const EMPTY = {
  letter: { letter_type: '', addressed_to: '', purpose: '', language: 'en' },
  expense: { category: '', amount: '', expense_date: '', description: '' },
  advance: { amount: '', months: '1', reason: '' },
  case: { category: '', subject: '', description: '' },
};

/**
 * The employee's requests to HR: a letter (salary certificate, NOC…), an expense
 * to be reimbursed, a salary advance, or a case. Each one is followed here to
 * the end — the issued letter to download, the payroll month it is paid in,
 * HR's replies.
 */
export default function MyRequests() {
  const { t } = useTranslation();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, rows: [] });
  const [newType, setNewType] = useState(null);
  const [form, setForm] = useState({});
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    let off = false;
    requestsApi.getRequests()
      .then(({ data }) => { if (!off) setState({ key: reload, rows: data }); })
      .catch(() => { if (!off) setState({ key: reload, rows: [] }); });
    return () => { off = true; };
  }, [reload]);

  const rows = state.rows;
  const openCount = rows.filter((r) => OPEN_STATUSES.includes(r.status)).length;
  const start = (type) => { setNewType(type); setForm({ ...EMPTY[type] }); setFile(null); };
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));
  const today = new Date().toISOString().slice(0, 10);

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('type', newType);
      for (const [k, v] of Object.entries(form)) fd.append(k, v);
      if (file) fd.append('file', file);
      const { data } = await requestsApi.createRequest(fd);
      toast.success(data.in_approval_chain ? t('requests.sent_chain') : t('requests.sent'));
      setNewType(null);
      setReload((n) => n + 1);
    } catch (err) { toast.error(err?.response?.data?.error || t('common.operation_failed')); }
    finally { setSaving(false); }
  };

  const instalment = newType === 'advance' && Number(form.amount) > 0 && Number(form.months) > 0
    ? money(Number(form.amount) / Number(form.months)) : null;

  return (
    <PortalShell icon={Inbox} title={t('requests.my_title')} subtitle={t('requests.my_subtitle')}
      stats={[{ value: openCount, label: t('requests.open') }, { value: rows.length, label: t('requests.total') }]}>
      {/* What can be asked for */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {REQUEST_TYPES.map((type) => {
          const Icon = ICONS[type];
          return (
            <button key={type} type="button" onClick={() => start(type)}
              className="text-start bg-white border border-surface-200 rounded-2xl p-4 hover:border-brand-300 hover:shadow-sm transition">
              <div className="flex items-center gap-2 mb-1">
                <span className="p-2 rounded-xl bg-brand-50 text-brand-700"><Icon size={18} /></span>
                <Plus size={14} className="ms-auto text-surface-400" />
              </div>
              <p className="font-semibold text-surface-900 text-sm">{t(`requests.new.${type}`)}</p>
              <p className="text-xs text-surface-500 mt-0.5">{t(`requests.new_desc.${type}`)}</p>
            </button>
          );
        })}
      </div>

      {state.key !== reload ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : rows.length === 0 ? (
        <Card><EmptyState icon={<Inbox className="w-6 h-6 text-surface-400" />} title={t('requests.none')} description={t('requests.none_desc')} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-surface-100">
            {rows.map((r) => {
              const Icon = ICONS[r.type];
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpenId(r.id)} className="w-full text-start px-5 py-3 hover:bg-surface-50/60 flex items-start gap-3">
                    <span className="p-2 rounded-xl bg-surface-50 text-surface-600 shrink-0"><Icon size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-surface-800 truncate">{requestTitle(t, r)}</p>
                      <p className="text-xs text-surface-500">
                        {t(`requests.type.${r.type}`)} · {String(r.created_at).slice(0, 10)}
                        {r.amount != null && <> · {money(r.amount)}</>}
                        {r.result_files > 0 && <> · <span className="text-emerald-700">{t('requests.ready_to_download')}</span></>}
                      </p>
                      {OPEN_STATUSES.includes(r.status) && r.approval?.status === 'Pending' && (
                        <div className="mt-1"><ApprovalProgress t={t} approval={r.approval} compact /></div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.comment_count > 0 && <span className="inline-flex items-center gap-1 text-xs text-surface-400"><MessageSquare size={12} />{r.comment_count}</span>}
                      <Badge className="text-[10px]" variant={statusVariant(r.status)}>{t(`requests.status.${slug(r.status)}`)}</Badge>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* New request */}
      <Modal open={!!newType} onClose={() => setNewType(null)} title={newType ? t(`requests.new.${newType}`) : ''} size="md">
        {newType && (
          <form onSubmit={submit} className="space-y-4">
            {newType === 'letter' && (<>
              <Select label={t('requests.f.letter_type')} required value={form.letter_type} onChange={set('letter_type')}
                options={LETTER_TYPES.map((v) => ({ value: v, label: t(`requests.letter_type.${slug(v)}`) }))} placeholder={t('common.select')} />
              <Input label={t('requests.f.addressed_to')} value={form.addressed_to} onChange={set('addressed_to')} placeholder={t('requests.to_whom')} maxLength={200} />
              <Input label={t('requests.f.purpose')} required value={form.purpose} onChange={set('purpose')} placeholder={t('requests.purpose_ph')} maxLength={300} />
              <Select label={t('requests.f.language')} value={form.language} onChange={set('language')}
                options={['en', 'ar', 'both'].map((v) => ({ value: v, label: t(`requests.lang.${v}`) }))} />
            </>)}
            {newType === 'expense' && (<>
              <div className="grid grid-cols-2 gap-4">
                <Select label={t('requests.f.category')} required value={form.category} onChange={set('category')}
                  options={EXPENSE_CATEGORIES.map((v) => ({ value: v, label: t(`requests.expense_cat.${v}`) }))} placeholder={t('common.select')} />
                <Input type="number" step="0.01" min="0" label={t('requests.f.amount')} required value={form.amount} onChange={set('amount')} />
              </div>
              <Input type="date" label={t('requests.f.expense_date')} required value={form.expense_date} max={today} onChange={set('expense_date')} />
              <Input label={t('requests.f.description')} required value={form.description} onChange={set('description')} maxLength={500} />
            </>)}
            {newType === 'advance' && (<>
              <div className="grid grid-cols-2 gap-4">
                <Input type="number" step="0.01" min="0" label={t('requests.f.amount')} required value={form.amount} onChange={set('amount')} />
                <Input type="number" min="1" max="24" label={t('requests.f.months')} required value={form.months} onChange={set('months')} />
              </div>
              {instalment && <p className="text-xs rounded-xl bg-surface-50 border border-surface-200 p-3 text-surface-600">{t('requests.instalment_preview', { amount: instalment, months: form.months })}</p>}
              <Input label={t('requests.f.reason')} required value={form.reason} onChange={set('reason')} maxLength={500} />
            </>)}
            {newType === 'case' && (<>
              <Select label={t('requests.f.category')} required value={form.category} onChange={set('category')}
                options={CASE_CATEGORIES.map((v) => ({ value: v, label: t(`requests.case_cat.${v}`) }))} placeholder={t('common.select')} />
              <Input label={t('requests.f.subject')} required value={form.subject} onChange={set('subject')} maxLength={150} />
              <div>
                <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('requests.f.description')}</label>
                <textarea required value={form.description} onChange={set('description')} rows={4} maxLength={2000}
                  className="w-full text-sm bg-white border border-surface-200 rounded-xl px-3 py-2" />
              </div>
            </>)}
            <div>
              <label className="block text-sm font-medium text-surface-700 mb-1.5">
                {newType === 'expense' ? t('requests.receipt') : t('requests.attachment_optional')}
              </label>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx" onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-surface-600 file:me-3 file:rounded-lg file:border-0 file:bg-surface-100 file:px-3 file:py-1.5" />
            </div>
            <p className="text-xs text-surface-500">{t(`requests.after.${newType}`)}</p>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="secondary" onClick={() => setNewType(null)}>{t('common.cancel')}</Button>
              <Button type="submit" loading={saving}>{t('requests.send')}</Button>
            </div>
          </form>
        )}
      </Modal>

      {openId && <RequestDetail t={t} id={openId} onClose={() => setOpenId(null)} onChanged={() => setReload((n) => n + 1)} />}
    </PortalShell>
  );
}
