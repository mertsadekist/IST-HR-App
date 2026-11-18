import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Megaphone, Loader2 } from 'lucide-react';
import Card from '@components/ui/Card';
import Badge from '@components/ui/Badge';
import EmptyState from '@components/ui/EmptyState';
import PortalShell from './PortalShell';
import * as hrApi from '@api/hrServicesApi';

/** Company announcements: newest first, unread ones marked; opening one marks it read. */
export default function MyAnnouncements() {
  const { t } = useTranslation();
  const [state, setState] = useState({ loaded: false, items: [] });
  const [open, setOpen] = useState(null);

  useEffect(() => {
    let off = false;
    hrApi.getAnnouncements()
      .then(({ data }) => { if (!off) setState({ loaded: true, items: data.filter((a) => a.live) }); })
      .catch(() => { if (!off) setState({ loaded: true, items: [] }); });
    return () => { off = true; };
  }, []);

  const toggle = (a) => {
    setOpen(open === a.id ? null : a.id);
    if (!a.is_read) {
      hrApi.markAnnouncementRead(a.id).catch(() => {});
      setState((s) => ({ ...s, items: s.items.map((x) => (x.id === a.id ? { ...x, is_read: true } : x)) }));
    }
  };
  const unread = state.items.filter((a) => !a.is_read).length;

  return (
    <PortalShell icon={Megaphone} title={t('announcements.title')} subtitle={t('announcements.subtitle')}
      stats={[{ value: unread, label: t('announcements.unread') }]}>
      {!state.loaded ? (
        <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>
      ) : state.items.length === 0 ? (
        <Card><EmptyState icon={<Megaphone className="w-6 h-6 text-surface-400" />} title={t('announcements.none')} /></Card>
      ) : (
        <div className="space-y-2">
          {state.items.map((a) => (
            <Card key={a.id} className={`!p-0 overflow-hidden ${a.priority === 'important' ? 'border-s-4 border-s-red-500' : ''}`}>
              <button type="button" onClick={() => toggle(a)} className="w-full text-start px-5 py-3 flex items-center gap-3 hover:bg-surface-50/60">
                {!a.is_read && <span className="w-2 h-2 rounded-full bg-brand-600 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className={`truncate ${a.is_read ? 'text-surface-700' : 'font-semibold text-surface-900'}`}>{a.title}</p>
                  <p className="text-xs text-surface-400">{String(a.published_at).slice(0, 10)}{a.company_name ? ` · ${a.company_name}` : ''}</p>
                </div>
                {a.priority === 'important' && <Badge variant="danger" className="text-[10px]">{t('announcements.important')}</Badge>}
              </button>
              {open === a.id && <div className="px-5 pb-4 text-sm text-surface-700 whitespace-pre-wrap">{a.body}</div>}
            </Card>
          ))}
        </div>
      )}
    </PortalShell>
  );
}
