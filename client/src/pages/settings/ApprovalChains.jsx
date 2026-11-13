import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { GitBranch, Plus, Trash2, ArrowUp, ArrowDown, Loader2, ShieldCheck } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import * as approvalsApi from '@api/approvalsApi';
import { stepLabel } from '@utils/approvals';

const PROCESSES = ['leave', 'overtime'];
const blankStep = { type: 'direct_manager' };

/**
 * The approval steps a leave request or an overtime day goes through before HR's
 * final decision. One chain per process for all companies, and optionally a
 * different one for a single company. No chain: HR decides directly, as before.
 */
export default function ApprovalChains() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const { items: companies } = useSelector((s) => s.companies);
  const [process, setProcess] = useState('leave');
  const [companyId, setCompanyId] = useState(0);
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, chains: [] });
  const [steps, setSteps] = useState([]);
  const [approvers, setApprovers] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let off = false;
    approvalsApi.getChains()
      .then(({ data }) => { if (!off) setState({ key: reload, chains: data }); })
      .catch(() => { if (!off) { setState({ key: reload, chains: [] }); toast.error(t('common.failed_load')); } });
    return () => { off = true; };
  }, [reload, t]);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let off = false;
    approvalsApi.getApprovers().then(({ data }) => { if (!off) setApprovers(data); }).catch(() => {});
    return () => { off = true; };
  }, [isAdmin]);

  const current = state.chains.find((c) => c.process === process && Number(c.company_id) === Number(companyId));
  const fallback = Number(companyId) ? state.chains.find((c) => c.process === process && Number(c.company_id) === 0) : null;
  // Load the chosen chain into the editor whenever the choice or the data changes.
  const editorKey = `${process}:${companyId}:${state.key}`;
  const [loadedKey, setLoadedKey] = useState(null);
  if (state.key !== null && loadedKey !== editorKey) {
    setLoadedKey(editorKey);
    setSteps((current?.steps || []).map((s) => ({ ...s })));
  }

  const set = (i, patch) => setSteps((l) => l.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const move = (i, d) => setSteps((l) => { const x = [...l]; const [s] = x.splice(i, 1); x.splice(i + d, 0, s); return x; });
  const save = async () => {
    setSaving(true);
    try {
      await approvalsApi.saveChain({ process, company_id: Number(companyId), steps });
      toast.success(steps.length ? t('approvals.saved') : t('approvals.removed'));
      setReload((r) => r + 1);
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setSaving(false); }
  };

  const input = 'text-sm bg-white border border-surface-200 rounded-lg px-3 py-2';
  if (state.key === null) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-surface-900 flex items-center gap-2"><GitBranch size={18} className="text-brand-600" /> {t('approvals.title')}</h2>
        <p className="text-sm text-surface-500">{t('approvals.subtitle')}</p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="flex gap-1 bg-surface-50 p-1 rounded-xl">
          {PROCESSES.map((p) => (
            <button key={p} type="button" onClick={() => setProcess(p)}
              className={`px-3 py-2 rounded-lg text-xs font-medium ${process === p ? 'bg-brand-600 text-white' : 'text-surface-600 hover:bg-surface-100'}`}>
              {p === 'leave' ? t('approvals.process_leave') : t('approvals.process_overtime')}
            </button>
          ))}
        </div>
        <select value={companyId} onChange={(e) => setCompanyId(Number(e.target.value))} className={input} aria-label={t('approvals.company')}>
          <option value={0}>{t('approvals.all_companies')}</option>
          {companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {fallback && !current && (
        <p className="text-xs text-surface-500">{t('approvals.uses_group_chain', { steps: fallback.steps.map((s) => stepLabel(t, s)).join(' → ') })}</p>
      )}

      <Card className="!p-4 space-y-2">
        {steps.length === 0 && <p className="text-sm text-surface-500">{t('approvals.no_chain')}</p>}
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2 flex-wrap">
            <span className="w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-semibold flex items-center justify-center">{i + 1}</span>
            <select disabled={!isAdmin} value={s.type} onChange={(e) => set(i, { type: e.target.value, role: undefined, user_id: undefined })} className={input}>
              <option value="direct_manager">{t('approvals.step_direct_manager')}</option>
              <option value="second_manager">{t('approvals.step_second_manager')}</option>
              <option value="role">{t('approvals.step_role')}</option>
              <option value="user">{t('approvals.step_user')}</option>
            </select>
            {s.type === 'role' && (
              <select disabled={!isAdmin} value={s.role || ''} onChange={(e) => set(i, { role: e.target.value })} className={input}>
                <option value="">{t('approvals.choose_role')}</option>
                <option value="hr_manager">{t('approvals.role_hr_manager')}</option>
                <option value="accountant">{t('approvals.role_accountant')}</option>
                <option value="admin">{t('approvals.role_admin')}</option>
              </select>
            )}
            {s.type === 'user' && (
              <select disabled={!isAdmin} value={s.user_id || ''} onChange={(e) => set(i, { user_id: Number(e.target.value) })} className={input}>
                <option value="">{t('approvals.choose_person')}</option>
                {approvers.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
              </select>
            )}
            {isAdmin && (
              <span className="ms-auto flex gap-1">
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} className="p-1.5 text-surface-400 hover:text-surface-700 disabled:opacity-30" aria-label="up"><ArrowUp size={14} /></button>
                <button type="button" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="p-1.5 text-surface-400 hover:text-surface-700 disabled:opacity-30" aria-label="down"><ArrowDown size={14} /></button>
                <button type="button" onClick={() => setSteps((l) => l.filter((_, j) => j !== i))} className="p-1.5 text-surface-400 hover:text-red-600" aria-label={t('common.delete')}><Trash2 size={14} /></button>
              </span>
            )}
          </div>
        ))}
        <div className="flex items-center gap-2 pt-2 border-t border-surface-100 text-sm text-surface-600">
          <ShieldCheck size={16} className="text-emerald-600" /> {t('approvals.final_hr')}
        </div>
      </Card>

      {isAdmin && (
        <div className="flex justify-between gap-2">
          <Button variant="secondary" onClick={() => setSteps((l) => [...l, { ...blankStep }])} disabled={steps.length >= 6}><Plus size={14} /> {t('approvals.add_step')}</Button>
          <Button onClick={save} loading={saving}>{t('common.save')}</Button>
        </div>
      )}
      <p className="text-[11px] text-surface-400">{t('approvals.rules_note')}</p>
    </div>
  );
}
