import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Plus, Trash2, Save, Loader2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import * as payApi from '@api/payrollApi';

const input = 'w-full text-sm border border-surface-200 rounded-lg px-3 py-2 bg-white';
const label = 'text-xs font-semibold text-surface-700';

/** {k: v} ⇄ [{k, v}] so rows can be edited (and briefly be blank) in order. */
const toRows = (o) => Object.entries(o || {}).map(([k, v]) => ({ k, v }));
const toObj = (rows) => Object.fromEntries(rows.filter((r) => String(r.k).trim()).map((r) => [String(r.k).trim(), String(r.v).trim()]));

/**
 * What the bank SIF and the Zoho Books journal need: the employer's WPS identity
 * per company, the routing code of each employee bank, and the account names.
 */
export default function PayrollExportsSettings() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const [data, setData] = useState(null);
  const [routing, setRouting] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    payApi.getExportSettings().then(({ data: d }) => {
      if (off) return;
      setData(d); setRouting(toRows(d.settings.routing_codes)); setAccounts(toRows(d.settings.zoho.accounts));
    }).catch(() => { if (!off) toast.error(t('common.failed_load')); });
    return () => { off = true; };
  }, [t]);

  if (!data) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;
  const ro = !isAdmin;
  const s = data.settings;
  const setS = (patch) => setData((d) => ({ ...d, settings: { ...d.settings, ...patch } }));
  const setCompany = (id, patch) => setS({ companies: { ...s.companies, [id]: { ...(s.companies[id] || {}), ...patch } } });
  const setZoho = (patch) => setS({ zoho: { ...s.zoho, ...patch } });

  const save = async () => {
    setSaving(true);
    try {
      const body = { ...s, routing_codes: toObj(routing), zoho: { ...s.zoho, accounts: toObj(accounts) } };
      const { data: saved } = await payApi.saveExportSettings(body);
      setData((d) => ({ ...d, settings: saved })); setRouting(toRows(saved.routing_codes)); setAccounts(toRows(saved.zoho.accounts));
      toast.success(t('payroll_exports.saved'));
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setSaving(false); }
  };

  const pairEditor = (rows, setRows, keyPh, valPh, keyClass) => (
    <div className="space-y-2 mt-2">
      {rows.map((r, i) => (
        <div key={i} className="flex gap-2 items-center">
          <input disabled={ro} value={r.k} placeholder={keyPh} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, k: e.target.value } : x)))} className={`${input} ${keyClass}`} />
          <input disabled={ro} value={r.v} placeholder={valPh} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, v: e.target.value } : x)))} className={input} />
          {!ro && <button type="button" onClick={() => setRows(rows.filter((_, j) => j !== i))} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>}
        </div>
      ))}
      {!ro && <button type="button" onClick={() => setRows([...rows, { k: '', v: '' }])} className="text-xs text-brand-700 inline-flex items-center gap-1"><Plus size={12} /> {t('payroll_exports.add_row')}</button>}
    </div>
  );

  return (
    <div className="space-y-4">
      <Card className="!p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-surface-900">{t('payroll_exports.sif_title')}</h3>
          <p className="text-xs text-surface-500 mt-0.5">{t('payroll_exports.sif_desc')}</p>
        </div>
        <div className="space-y-2">
          {data.companies.map((c) => (
            <div key={c.id} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
              <div className="text-sm font-medium text-surface-800 sm:pb-2">{c.name}</div>
              <div><span className={label}>{t('payroll_exports.employer_id')}</span>
                <input disabled={ro} value={s.companies[c.id]?.employer_id || ''} onChange={(e) => setCompany(c.id, { employer_id: e.target.value })}
                  placeholder={c.mol_id ? String(c.mol_id).padStart(13, '0') : t('payroll_exports.employer_id_ph')} className={`${input} mt-1`} /></div>
              <div><span className={label}>{t('payroll_exports.employer_routing')}</span>
                <input disabled={ro} value={s.companies[c.id]?.bank_routing_code || ''} onChange={(e) => setCompany(c.id, { bank_routing_code: e.target.value })}
                  placeholder={t('payroll_exports.nine_digits')} className={`${input} mt-1`} /></div>
            </div>
          ))}
        </div>
        <div className="pt-2">
          <span className={label}>{t('payroll_exports.routing_codes')}</span>
          <p className="text-[11px] text-surface-400">{t('payroll_exports.routing_hint')}</p>
          {pairEditor(routing, setRouting, t('payroll_exports.bank_code'), t('payroll_exports.routing_code'), 'max-w-[9rem]')}
        </div>
      </Card>

      <Card className="!p-5 space-y-3">
        <div>
          <h3 className="font-semibold text-surface-900">{t('payroll_exports.zoho_title')}</h3>
          <p className="text-xs text-surface-500 mt-0.5">{t('payroll_exports.zoho_desc')}</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div><span className={label}>{t('payroll_exports.expense_account')}</span>
            <input disabled={ro} value={s.zoho.expense_account} onChange={(e) => setZoho({ expense_account: e.target.value })} className={`${input} mt-1`} /></div>
          <div><span className={label}>{t('payroll_exports.payable_account')}</span>
            <input disabled={ro} value={s.zoho.payable_account} onChange={(e) => setZoho({ payable_account: e.target.value })} className={`${input} mt-1`} /></div>
          <div><span className={label}>{t('payroll_exports.deduction_account')}</span>
            <input disabled={ro} value={s.zoho.deduction_account} onChange={(e) => setZoho({ deduction_account: e.target.value })} className={`${input} mt-1`} /></div>
          <div><span className={label}>{t('payroll_exports.cost_centre')}</span>
            <select disabled={ro} value={s.zoho.cost_centre} onChange={(e) => setZoho({ cost_centre: e.target.value })} className={`${input} mt-1`}>
              <option value="department">{t('payroll_exports.cc_department')}</option>
              <option value="none">{t('payroll_exports.cc_none')}</option>
            </select></div>
          <div><span className={label}>{t('payroll_exports.reference_prefix')}</span>
            <input disabled={ro} value={s.zoho.reference_prefix} onChange={(e) => setZoho({ reference_prefix: e.target.value })} className={`${input} mt-1`} /></div>
        </div>
        <div>
          <span className={label}>{t('payroll_exports.code_accounts')}</span>
          <p className="text-[11px] text-surface-400">{t('payroll_exports.code_accounts_hint')}</p>
          {pairEditor(accounts, setAccounts, t('payroll_exports.line_code'), t('payroll_exports.account'), 'max-w-[11rem]')}
        </div>
      </Card>

      {isAdmin ? (
        <div className="flex justify-end"><Button onClick={save} loading={saving}><Save size={14} /> {t('common.save')}</Button></div>
      ) : <p className="text-[11px] text-surface-400">{t('payroll_exports.admin_only')}</p>}
    </div>
  );
}
