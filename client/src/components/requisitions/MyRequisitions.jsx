import { useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, X } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import ApprovalProgress from '@components/approvals/ApprovalProgress';
import RequisitionForm from './RequisitionForm';
import * as requisitionsApi from '@api/requisitionsApi';

const statusVariant = { Pending: 'warning', Approved: 'success', Rejected: 'danger', Cancelled: 'inactive' };

/** A manager's hiring requests on My Team, with the button to raise one. */
export default function MyRequisitions({ t, people = [] }) {
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, rows: [] });
  const [form, setForm] = useState(false);

  useEffect(() => {
    let off = false;
    requisitionsApi.getRequisitions()
      .then(({ data }) => { if (!off) setState({ key: reload, rows: data }); })
      .catch(() => { if (!off) setState({ key: reload, rows: [] }); });
    return () => { off = true; };
  }, [reload]);

  const cancel = async (r) => {
    try { await requisitionsApi.cancelRequisition(r.id); toast.success(t('requisitions.cancelled')); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
  };

  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <h3 className="text-sm font-semibold text-surface-800">{t('requisitions.mine')}</h3>
        <Button size="sm" className="ms-auto" onClick={() => setForm(true)}><Plus size={14} /> {t('requisitions.new')}</Button>
      </div>
      {state.rows.length === 0 ? (
        <p className="text-xs text-surface-400 px-5 pb-4">{t('requisitions.none_mine')}</p>
      ) : (
        <ul className="divide-y divide-surface-100">
          {state.rows.map((r) => (
            <li key={r.id} className="px-5 py-3 space-y-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-surface-800 flex-1 truncate">{r.title} <span className="text-xs text-surface-500">× {r.head_count}</span></p>
                <Badge variant={statusVariant[r.status]} className="text-[10px]">{t(`requisitions.status.${r.status.toLowerCase()}`)}</Badge>
                {r.status === 'Pending' && (
                  <button type="button" onClick={() => cancel(r)} title={t('requisitions.withdraw')} aria-label={t('requisitions.withdraw')}
                    className="p-1 text-surface-400 hover:text-red-600"><X size={14} /></button>
                )}
              </div>
              {r.status === 'Pending' && r.approval && <ApprovalProgress t={t} approval={r.approval} compact />}
              {r.decision_note && <p className="text-xs text-surface-500">{r.decision_note}</p>}
            </li>
          ))}
        </ul>
      )}
      {form && <RequisitionForm t={t} people={people} onClose={() => setForm(false)} onSaved={() => { setForm(false); setReload((n) => n + 1); }} />}
    </Card>
  );
}
