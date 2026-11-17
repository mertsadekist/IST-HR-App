import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { AlertOctagon, ChevronRight, CheckCircle2 } from 'lucide-react';
import Card from '@components/ui/Card';
import * as complianceApi from '@api/complianceApi';

const TONE = {
  critical: 'bg-red-50 text-red-700 border-red-200',
  high: 'bg-amber-50 text-amber-800 border-amber-200',
  medium: 'bg-sky-50 text-sky-800 border-sky-200',
  low: 'bg-surface-50 text-surface-600 border-surface-200',
};

/**
 * "Needs your attention": everything overdue or at risk across the system,
 * most urgent first, each a link to where it is fixed. Hidden when clear.
 */
export default function AttentionList({ t }) {
  const { currentCompanyId } = useSelector((s) => s.entity);
  const key = currentCompanyId ?? 'all';
  const [state, setState] = useState({ key: null, items: [] });

  useEffect(() => {
    let off = false;
    complianceApi.getAttention()
      .then(({ data }) => { if (!off) setState({ key, items: data.items }); })
      .catch(() => { if (!off) setState({ key, items: [] }); });
    return () => { off = true; };
  }, [key]);

  if (state.key !== key) return null;
  return (
    <Card className="!p-0 overflow-hidden">
      <div className="flex items-center gap-2 px-5 pt-4 pb-2">
        <AlertOctagon size={18} className="text-red-600" />
        <h2 className="font-semibold text-surface-900">{t('attention.title')}</h2>
        <span className="ms-auto text-xs text-surface-400">{t('attention.subtitle')}</span>
      </div>
      {state.items.length === 0 ? (
        <p className="flex items-center gap-2 px-5 pb-4 text-sm text-emerald-700"><CheckCircle2 size={16} /> {t('attention.clear')}</p>
      ) : (
        <ul className="divide-y divide-surface-50">
          {state.items.map((it) => (
            <li key={it.key}>
              <Link to={it.link} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-50/60">
                <span className={`shrink-0 min-w-[36px] text-center rounded-lg border px-2 py-0.5 text-sm font-bold ${TONE[it.severity]}`}>{it.count}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-surface-800">{t(`attention.item.${it.key}`, { count: it.count })}</p>
                  {it.examples?.length > 0 && <p className="text-[11px] text-surface-400 truncate">{it.examples.join(' · ')}{it.count > it.examples.length ? ' …' : ''}</p>}
                </div>
                <span className={`text-[10px] uppercase tracking-wide rounded px-1.5 py-0.5 border ${TONE[it.severity]}`}>{t(`attention.severity.${it.severity}`)}</span>
                <ChevronRight size={14} className="text-surface-300 rtl:rotate-180" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
