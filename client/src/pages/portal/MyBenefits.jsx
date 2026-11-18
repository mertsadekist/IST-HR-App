import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HeartHandshake, Loader2, HeartPulse, Plane } from 'lucide-react';
import Card from '@components/ui/Card';
import PortalShell from './PortalShell';
import * as benefitsApi from '@api/benefitsApi';

/** The employee's own medical insurance and air ticket, read only. */
export default function MyBenefits() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loaded: false, data: null });

  useEffect(() => {
    let off = false;
    benefitsApi.getMyBenefits()
      .then(({ data }) => { if (!off) setState({ loaded: true, data }); })
      .catch(() => { if (!off) setState({ loaded: true, data: null }); });
    return () => { off = true; };
  }, []);

  const d = state.data;
  return (
    <PortalShell icon={HeartHandshake} title={t('benefits.my_title')} subtitle={t('benefits.my_subtitle')}>
      {!state.loaded ? <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div> : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="!p-5 space-y-2">
            <h3 className="font-semibold text-surface-900 flex items-center gap-2"><HeartPulse size={18} className="text-rose-500" /> {t('benefits.insurance')}</h3>
            {!d?.insurance ? <p className="text-sm text-surface-400">{t('benefits.no_insurance')}</p> : (
              <dl className="text-sm grid grid-cols-2 gap-y-1">
                <dt className="text-surface-500">{t('benefits.provider')}</dt><dd>{d.insurance.provider}</dd>
                <dt className="text-surface-500">{t('benefits.policy_number')}</dt><dd>{d.insurance.policy_number || '—'}</dd>
                <dt className="text-surface-500">{t('benefits.category')}</dt><dd>{d.insurance.category || '—'}</dd>
                <dt className="text-surface-500">{t('benefits.card_number')}</dt><dd className="font-mono">{d.insurance.card_number || '—'}</dd>
                <dt className="text-surface-500">{t('benefits.valid_until')}</dt><dd>{d.insurance.end_date || d.insurance.policy_end || '—'}</dd>
                {d.insurance.dependents?.length > 0 && (<>
                  <dt className="text-surface-500 col-span-2 mt-2">{t('benefits.dependents')}</dt>
                  {d.insurance.dependents.map((x, i) => <dd key={i} className="col-span-2 text-surface-700">{x.name} · {t(`benefits.relation.${String(x.relation).toLowerCase()}`)}</dd>)}
                </>)}
              </dl>
            )}
          </Card>
          <Card className="!p-5 space-y-2">
            <h3 className="font-semibold text-surface-900 flex items-center gap-2"><Plane size={18} className="text-sky-600" /> {t('benefits.ticket')}</h3>
            {!d?.ticket ? <p className="text-sm text-surface-400">{t('benefits.no_ticket')}</p> : (
              <>
                <p className="text-sm text-surface-700">{t('benefits.ticket_line', { n: d.ticket.frequency_months, cls: d.ticket.ticket_class, dest: d.ticket.destination || '—' })}</p>
                {d.next_ticket_due && <p className="text-sm font-medium text-brand-700">{t('benefits.next_due', { date: d.next_ticket_due })}</p>}
                {d.usages?.length > 0 && <p className="text-xs text-surface-500">{t('benefits.last_used', { date: d.usages[0].used_on })}</p>}
              </>
            )}
          </Card>
        </div>
      )}
    </PortalShell>
  );
}
