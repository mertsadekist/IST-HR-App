import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { BookOpenCheck, Loader2, Download, CheckCircle2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import Button from '@components/ui/Button';
import Modal from '@components/ui/Modal';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import * as hrApi from '@api/hrServicesApi';
import { keyOf, saveBlob } from '@utils/hrServices';

/**
 * Company policies. Those that ask for it are read and acknowledged here; a
 * new version of a policy asks again.
 */
export default function MyPolicies() {
  const { t } = useTranslation();
  const [reload, setReload] = useState(0);
  const [state, setState] = useState({ key: null, items: [] });
  const [openId, setOpenId] = useState(null);
  const [detail, setDetail] = useState({ id: null, p: null });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    hrApi.getPolicies()
      .then(({ data }) => { if (!off) setState({ key: reload, items: data }); })
      .catch(() => { if (!off) setState({ key: reload, items: [] }); });
    return () => { off = true; };
  }, [reload]);

  useEffect(() => {
    if (!openId) return undefined;
    let off = false;
    hrApi.getPolicy(openId).then(({ data }) => { if (!off) setDetail({ id: openId, p: data }); }).catch(() => {});
    return () => { off = true; };
  }, [openId]);

  const pending = state.items.filter((p) => p.requires_ack && !p.my_ack).length;
  const p = detail.id === openId ? detail.p : null;
  const ack = async () => {
    setBusy(true);
    try { await hrApi.acknowledgePolicy(openId); toast.success(t('policies.acknowledged')); setOpenId(null); setReload((n) => n + 1); }
    catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(false); }
  };
  const download = async () => {
    try { const { data } = await hrApi.downloadPolicy(openId); saveBlob(data, p?.file_name || 'policy.pdf'); }
    catch { toast.error(t('common.operation_failed')); }
  };

  return (
    <PortalShell icon={BookOpenCheck} title={t('policies.my_title')} subtitle={t('policies.my_subtitle')}
      stats={[{ value: pending, label: t('policies.to_acknowledge') }]}>
      {state.key !== reload ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : state.items.length === 0 ? (
        <Card><EmptyState icon={<BookOpenCheck className="w-6 h-6 text-surface-400" />} title={t('policies.none')} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <ul className="divide-y divide-surface-100">
            {state.items.map((x) => (
              <li key={x.id}>
                <button type="button" onClick={() => setOpenId(x.id)} className="w-full text-start px-5 py-3 flex items-center gap-3 hover:bg-surface-50/60">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-surface-800 truncate">{x.title}</p>
                    <p className="text-xs text-surface-400">{t(`policies.cat.${keyOf(x.category)}`)} · {t('policies.version', { n: x.version })}{x.ack_due && !x.my_ack ? ` · ${t('policies.due', { date: x.ack_due })}` : ''}</p>
                  </div>
                  {x.requires_ack ? (
                    x.my_ack ? <Badge variant="success" className="text-[10px]">{t('policies.acked_on', { date: x.my_ack })}</Badge>
                      : <Badge variant="warning" className="text-[10px]">{t('policies.needs_ack')}</Badge>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {openId && (
        <Modal open onClose={() => setOpenId(null)} size="lg" title={p ? `${p.title} · ${t('policies.version', { n: p.version })}` : t('policies.policy')}>
          {!p ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div> : (
            <div className="space-y-4">
              {p.body && <div className="text-sm text-surface-700 whitespace-pre-wrap max-h-[50vh] overflow-y-auto border border-surface-100 rounded-xl p-4">{p.body}</div>}
              {p.has_file && <Button size="sm" variant="secondary" onClick={download}><Download size={14} /> {t('policies.download')}</Button>}
              {!!p.requires_ack && (
                p.my_ack ? (
                  <p className="flex items-center gap-2 text-sm text-emerald-700"><CheckCircle2 size={16} /> {t('policies.you_acked', { at: p.my_ack })}</p>
                ) : (
                  <div className="border-t border-surface-100 pt-4 flex items-center gap-3 flex-wrap">
                    <p className="text-xs text-surface-600 flex-1">{t('policies.ack_statement')}</p>
                    <Button onClick={ack} loading={busy}><CheckCircle2 size={16} /> {t('policies.acknowledge')}</Button>
                  </div>
                )
              )}
            </div>
          )}
        </Modal>
      )}
    </PortalShell>
  );
}
