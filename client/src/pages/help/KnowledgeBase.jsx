import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import { getArticles, GROUP_ORDER } from '@/data/kb';
import AnnotatedScreen from './diagrams/AnnotatedScreen';
import FlowDiagram from './diagrams/FlowDiagram';
import {
  Lock, LayoutDashboard, Building2, ShieldCheck, Send, Kanban, Users, FileText, Inbox, Target, Globe,
  UserCheck, CalendarDays, Clock, Banknote, Laptop, Package, TrendingUp, DoorOpen, Scale, FileArchive,
  Calculator, BarChart3, Trophy, ClipboardList, Mail, Network, UserCog, Settings, Box, Shield,
  HelpCircle, Search, ChevronRight, BookOpen, Lightbulb, MessageCircleQuestion,
} from 'lucide-react';

const ICONS = {
  Lock, LayoutDashboard, Building2, ShieldCheck, Send, Kanban, Users, FileText, Inbox, Target, Globe,
  UserCheck, CalendarDays, Clock, Banknote, Laptop, Package, TrendingUp, DoorOpen, Scale, FileArchive,
  Calculator, BarChart3, Trophy, ClipboardList, Mail, Network, UserCog, Settings, Box, Shield, BookOpen,
};
const Icon = ({ name, ...p }) => { const C = ICONS[name] || FileText; return <C {...p} />; };

export default function KnowledgeBase() {
  const { t, i18n } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const role = user?.role;
  const [sp, setSp] = useSearchParams();
  const [query, setQuery] = useState('');

  const articles = getArticles(i18n.language);
  const visible = useMemo(
    () => articles.filter((a) => !a.roles || a.roles.includes(role)),
    [articles, role]
  );

  const q = query.trim().toLowerCase();
  const filtered = useMemo(() => {
    if (!q) return visible;
    return visible.filter((a) =>
      [a.title, a.overview, ...(a.faq || []).flatMap((f) => [f.q, f.a])]
        .join(' ').toLowerCase().includes(q)
    );
  }, [visible, q]);

  const activeId = sp.get('article');
  const active = visible.find((a) => a.id === activeId) || filtered[0] || visible[0] || null;
  const select = (id) => setSp(id ? { article: id } : {}, { replace: true });

  const groups = GROUP_ORDER
    .map((g) => ({ id: g, items: filtered.filter((a) => a.group === g) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-brand-gradient flex items-center justify-center text-white shadow-sm"><BookOpen size={20} /></div>
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('kb.title', 'Knowledge Base')}</h1>
          <p className="text-surface-500 text-sm">{t('kb.subtitle', 'How to use every page, with suggested questions')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-5 items-start">
        {/* Left: search + grouped list */}
        <Card className="!p-3 lg:sticky lg:top-4">
          <div className="flex items-center gap-2 bg-surface-50 rounded-xl px-3 py-2 mb-3 border border-surface-100">
            <Search size={15} className="text-surface-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('kb.search_ph', 'Search help…')}
              className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 outline-none flex-1" />
          </div>
          {groups.length === 0 ? (
            <p className="text-sm text-surface-400 px-2 py-6 text-center">{t('kb.no_results', 'No articles found')}</p>
          ) : (
            <div className="space-y-3 max-h-[70vh] overflow-auto pr-1">
              {groups.map((g) => (
                <div key={g.id}>
                  <p className="text-[10px] font-semibold text-surface-400 uppercase tracking-wider px-2 mb-1">{t(`kb.group_${g.id}`, g.id)}</p>
                  {g.items.map((a) => (
                    <button key={a.id} onClick={() => select(a.id)}
                      className={`w-full text-start flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${active?.id === a.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-surface-600 hover:bg-surface-50'}`}>
                      <Icon name={a.icon} size={15} className={active?.id === a.id ? 'text-brand-600' : 'text-surface-400'} />
                      <span className="truncate">{a.title}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Right: article */}
        {!active ? (
          <Card><EmptyState icon={<HelpCircle className="w-6 h-6 text-surface-400" />} title={t('kb.no_results', 'No articles found')} /></Card>
        ) : (
          <Card className="!p-6 space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-brand-50 flex items-center justify-center text-brand-600 shrink-0"><Icon name={active.icon} size={20} /></div>
              <div>
                <h2 className="text-xl font-bold text-surface-900">{active.title}</h2>
                <p className="text-surface-600 mt-1 text-sm leading-relaxed">{active.overview}</p>
              </div>
            </div>

            {active.whenToUse && (
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-sm text-amber-800">
                <span className="font-semibold">{t('kb.when_to_use', 'When to use')}: </span>{active.whenToUse}
              </div>
            )}

            {active.diagram && (
              active.diagram.type === 'flow'
                ? <FlowDiagram steps={active.diagram.steps} />
                : <AnnotatedScreen items={active.diagram.items} />
            )}

            {active.steps?.length > 0 && (
              <div>
                <h3 className="font-semibold text-surface-800 mb-2">{t('kb.steps', 'Step by step')}</h3>
                <ol className="space-y-2">
                  {active.steps.map((s, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 w-6 h-6 shrink-0 rounded-full bg-brand-gradient text-white text-xs font-bold flex items-center justify-center">{i + 1}</span>
                      <div><span className="font-medium text-surface-800">{s.title}</span>{s.detail && <span className="text-surface-600"> — {s.detail}</span>}</div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {active.tips?.length > 0 && (
              <div>
                <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-1.5"><Lightbulb size={16} className="text-amber-500" /> {t('kb.tips', 'Tips')}</h3>
                <ul className="space-y-1.5">
                  {active.tips.map((tip, i) => <li key={i} className="text-sm text-surface-600 flex gap-2"><span className="text-brand-400 mt-1">•</span><span>{tip}</span></li>)}
                </ul>
              </div>
            )}

            {active.faq?.length > 0 && (
              <div>
                <h3 className="font-semibold text-surface-800 mb-2 flex items-center gap-1.5"><MessageCircleQuestion size={16} className="text-brand-500" /> {t('kb.faq', 'Suggested questions')}</h3>
                <div className="space-y-1.5">
                  {active.faq.map((f, i) => (
                    <details key={i} className="group rounded-xl border border-surface-100 bg-surface-50/40 px-3 py-2">
                      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 text-sm font-medium text-surface-800">
                        <span>{f.q}</span>
                        <ChevronRight size={15} className="text-surface-400 transition-transform group-open:rotate-90 rtl:rotate-180 rtl:group-open:-rotate-90 shrink-0" />
                      </summary>
                      <p className="text-sm text-surface-600 mt-2 leading-relaxed">{f.a}</p>
                    </details>
                  ))}
                </div>
              </div>
            )}

            {active.related?.length > 0 && (
              <div className="pt-2 border-t border-surface-100">
                <h3 className="font-semibold text-surface-800 mb-2 text-sm">{t('kb.related', 'Related')}</h3>
                <div className="flex flex-wrap gap-2">
                  {active.related
                    .map((rid) => visible.find((a) => a.id === rid))
                    .filter(Boolean)
                    .map((r) => (
                      <button key={r.id} onClick={() => select(r.id)} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-100 hover:bg-brand-50 hover:text-brand-700 text-xs text-surface-600 transition-colors">
                        <Icon name={r.icon} size={12} /> {r.title}
                      </button>
                    ))}
                </div>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );
}
