import { useState, useEffect } from 'react';
import { Building2, ShieldCheck, Pencil, X, Upload, FileText, Download, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import * as employeesApi from '@api/employeesApi';

/**
 * Payroll bank account for one employee, plus the bank-stamped IBAN letter that
 * evidences it. The account cannot be marked Verified until that letter is on
 * file, and editing the account clears verification (a changed account needs a
 * fresh letter).
 */
const BANK_FIELDS = [
  ['bank_name', 'employees.bank_name', true],
  ['account_holder_name', 'employees.account_holder', true],
  ['account_number', 'employees.account_number', true],
  ['iban', 'employees.iban', true],
  ['swift_code', 'employees.swift'],
  ['branch_name', 'employees.branch'],
];
const TRANSFER_METHODS = ['Bank Transfer', 'WPS', 'Cheque', 'Cash'];

export default function EmployeeBankTab({ employee, t, isAdmin }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try { const res = await employeesApi.getEmployeeBank(employee.id); setData(res.data); }
    catch { setData(null); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [employee.id]);

  const bank = data?.bank;
  const letters = (data?.files || []).filter((f) => f.kind === 'iban_letter');
  const hasLetter = letters.length > 0;

  const startEdit = () => {
    setForm({
      bank_name: bank?.bank_name || '', account_holder_name: bank?.account_holder_name || `${employee.first_name} ${employee.last_name}`,
      account_number: bank?.account_number || '', iban: bank?.iban || '', swift_code: bank?.swift_code || '',
      branch_name: bank?.branch_name || '', transfer_method: bank?.transfer_method || 'Bank Transfer',
      salary_currency: bank?.salary_currency || '', notes: bank?.notes || '',
    });
    setEditing(true);
  };

  const save = async () => {
    setSaving(true);
    try {
      await employeesApi.saveEmployeeBank(employee.id, form);
      toast.success(t('employees.bank_saved'));
      setEditing(false);
      await load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.save_failed')); }
    finally { setSaving(false); }
  };

  const uploadLetter = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'iban_letter');
      await employeesApi.uploadEmployeeBankFile(employee.id, fd);
      toast.success(t('employees.iban_letter_uploaded'));
      await load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.upload_failed')); }
    finally { setBusy(false); }
  };

  const verify = async () => {
    setBusy(true);
    try {
      await employeesApi.verifyEmployeeBank(employee.id);
      toast.success(t('employees.bank_verified'));
      await load();
    } catch (err) { toast.error(err.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(false); }
  };

  const download = async (f) => {
    try {
      const res = await employeesApi.downloadEmployeeBankFile(employee.id, f.id);
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url; a.download = f.file_name || 'iban-letter';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch { toast.error(t('toasts.t_failed_to_download_document')); }
  };

  const removeFile = async (f) => {
    const res = await confirmDelete(`"${f.file_name}"`);
    if (!res.isConfirmed) return;
    try { await employeesApi.deleteEmployeeBankFile(employee.id, f.id); toast.success(t('common.deleted')); await load(); }
    catch { toast.error(t('common.delete_failed')); }
  };

  if (loading) return <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="card p-3 animate-pulse"><div className="h-3 bg-surface-200 rounded w-1/3" /></div>)}</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="font-bold text-surface-900 text-sm">{t('employees.bank_details')}</h3>
          {bank && (
            <Badge variant={bank.verified ? 'success' : 'warning'}>
              {t(bank.verified ? 'employees.bank_is_verified' : 'employees.bank_unverified')}
            </Badge>
          )}
        </div>
        {!editing && (
          <div className="flex gap-2">
            {bank && !bank.verified && (
              <Button size="sm" onClick={verify} loading={busy} disabled={!hasLetter}
                title={!hasLetter ? t('employees.iban_letter_required') : undefined}>
                <ShieldCheck size={14} /> {t('employees.verify_bank')}
              </Button>
            )}
            <Button size="sm" variant="secondary" onClick={startEdit}>
              <Pencil size={14} /> {bank ? t('common.edit') : t('employees.add_bank')}
            </Button>
          </div>
        )}
      </div>

      {editing ? (
        <div className="space-y-2 bg-surface-50 p-4 rounded-xl border border-surface-200">
          {BANK_FIELDS.map(([k, label, req]) => (
            <div key={k}>
              <label className="text-xs font-semibold text-surface-700">{t(label)}{req && <span className="text-red-500"> *</span>}</label>
              <input value={form[k] || ''} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
                className={`w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5 mt-1 ${k === 'iban' ? 'font-mono uppercase' : ''}`} />
            </div>
          ))}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-semibold text-surface-700">{t('employees.transfer_method')}</label>
              <select value={form.transfer_method} onChange={(e) => setForm((f) => ({ ...f, transfer_method: e.target.value }))}
                className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5 mt-1">
                {TRANSFER_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-surface-700">{t('employees.salary_currency')}</label>
              <input value={form.salary_currency || ''} onChange={(e) => setForm((f) => ({ ...f, salary_currency: e.target.value }))}
                placeholder="AED" className="w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5 mt-1" />
            </div>
          </div>
          <p className="text-[10px] text-amber-600">{t('employees.bank_edit_resets_verification')}</p>
          <div className="flex justify-end gap-2 pt-1">
            <Button size="sm" variant="secondary" onClick={() => setEditing(false)}><X size={14} /> {t('common.cancel')}</Button>
            <Button size="sm" onClick={save} loading={saving}>{t('common.save')}</Button>
          </div>
        </div>
      ) : !bank ? (
        <Card><EmptyState icon={<Building2 className="w-5 h-5 text-surface-400" />} title={t('employees.no_bank_details')} description={t('employees.no_bank_desc')} /></Card>
      ) : (
        <div className="bg-surface-50 p-4 rounded-xl border border-surface-200 space-y-2 text-xs">
          {BANK_FIELDS.map(([k, label]) => (
            <div key={k} className="flex justify-between gap-3">
              <span className="text-surface-500">{t(label)}</span>
              <span className={`font-semibold text-surface-800 text-right break-all ${k === 'iban' ? 'font-mono' : ''}`}>{bank[k] || '—'}</span>
            </div>
          ))}
          <div className="flex justify-between"><span className="text-surface-500">{t('employees.transfer_method')}</span><span className="font-semibold text-surface-800">{bank.transfer_method || '—'}</span></div>
          {bank.salary_currency && <div className="flex justify-between"><span className="text-surface-500">{t('employees.salary_currency')}</span><span className="font-semibold text-surface-800">{bank.salary_currency}</span></div>}
          {bank.verified && (
            <div className="flex justify-between pt-2 border-t border-surface-200">
              <span className="text-surface-500">{t('employees.verified_by')}</span>
              <span className="font-semibold text-emerald-700">{bank.verified_by_name || '—'}{bank.verified_at ? ` · ${dayjs(bank.verified_at).format('MMM D, YYYY')}` : ''}</span>
            </div>
          )}
          {bank.notes && <p className="text-[11px] text-surface-500 pt-1 whitespace-pre-wrap">{bank.notes}</p>}
        </div>
      )}

      {/* Bank-stamped IBAN letter */}
      <div className="border-t border-surface-200 pt-3">
        <div className="flex items-center justify-between mb-1">
          <h4 className="text-xs font-bold text-surface-800">{t('employees.iban_letter')}</h4>
          <label className={`text-xs px-2.5 py-1 rounded-lg cursor-pointer ${busy ? 'opacity-50 pointer-events-none' : ''} bg-surface-100 hover:bg-surface-200 text-surface-700`}>
            <Upload size={12} className="inline -mt-0.5 mr-1" /> {t('employees.upload_iban_letter')}
            <input type="file" className="hidden" accept=".pdf,.png,.jpg,.jpeg,.webp" onChange={uploadLetter} disabled={busy} />
          </label>
        </div>
        <p className="text-[10px] text-surface-400 mb-2">{t('employees.iban_letter_hint')}</p>
        {!hasLetter ? (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-700">
            {t('employees.iban_letter_required')}
          </div>
        ) : (
          <div className="space-y-1.5">
            {letters.map((f) => (
              <div key={f.id} className="flex items-center gap-2 p-2 rounded-lg border border-surface-100 text-xs">
                <FileText size={13} className="text-brand-500 shrink-0" />
                <span className="flex-1 min-w-0 truncate">{f.file_name}</span>
                <span className="text-[10px] text-surface-400 whitespace-nowrap">{dayjs(f.uploaded_at).format('MMM D, YYYY')}{f.uploaded_by_name ? ` · ${f.uploaded_by_name}` : ''}</span>
                <button onClick={() => download(f)} className="p-1 text-surface-400 hover:text-brand-600"><Download size={13} /></button>
                {isAdmin && <button onClick={() => removeFile(f)} className="p-1 text-surface-400 hover:text-red-600"><Trash2 size={13} /></button>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
