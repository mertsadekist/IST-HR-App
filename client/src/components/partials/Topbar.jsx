import { useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate, useLocation } from 'react-router-dom';
import { logout } from '@store/slices/authSlice';
import { Menu, LogOut, Bell, Search, Globe, Check, CheckCheck, HelpCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { articleIdForRoute } from '@/data/kb';
import dayjs from 'dayjs';
import * as notificationsApi from '@api/notificationsApi';

function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const ref = useRef(null);

  const loadCount = async () => {
    try { const { data } = await notificationsApi.unreadCount(); setUnread(data.count || 0); } catch { /* ignore */ }
  };
  const loadList = async () => {
    try { const { data } = await notificationsApi.list({ limit: 15 }); setItems(data || []); } catch { /* ignore */ }
  };

  useEffect(() => {
    loadCount();
    const id = setInterval(loadCount, 60000); // poll unread count each minute
    return () => clearInterval(id);
  }, []);

  // close on outside click
  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) await loadList();
  };
  const openItem = async (n) => {
    if (!n.is_read) { try { await notificationsApi.markRead(n.id); } catch { /* ignore */ } }
    setOpen(false);
    loadCount();
    if (n.link) navigate(n.link);
  };
  const markAll = async () => {
    try { await notificationsApi.markAllRead(); } catch { /* ignore */ }
    setUnread(0); loadList();
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="p-2 text-surface-400 hover:text-surface-700 hover:bg-surface-100 rounded-xl transition-colors relative">
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 bg-accent-coral text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-2xl shadow-card border border-surface-100 z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-surface-100">
            <span className="text-sm font-semibold text-surface-800">Notifications</span>
            {items.some((n) => !n.is_read) && (
              <button onClick={markAll} className="text-xs text-brand-600 hover:underline flex items-center gap-1"><CheckCheck size={13} /> Mark all read</button>
            )}
          </div>
          <div className="max-h-96 overflow-auto">
            {items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-surface-400">No notifications</p>
            ) : items.map((n) => (
              <button key={n.id} onClick={() => openItem(n)}
                className={`w-full text-left px-4 py-2.5 border-b border-surface-50 hover:bg-surface-50 transition-colors ${!n.is_read ? 'bg-brand-50/40' : ''}`}>
                <div className="flex items-start gap-2">
                  {!n.is_read ? <span className="w-2 h-2 rounded-full bg-brand-500 mt-1.5 shrink-0" /> : <Check size={12} className="text-surface-300 mt-1 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-surface-800 truncate">{n.title}</p>
                    {n.body && <p className="text-xs text-surface-500 line-clamp-2">{n.body}</p>}
                    <p className="text-[10px] text-surface-400 mt-0.5">{dayjs(n.created_at).format('MMM D, HH:mm')}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function Topbar({ onMenuClick }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useSelector((state) => state.auth);
  const { t, i18n } = useTranslation();

  const openHelp = () => {
    const id = articleIdForRoute(location.pathname);
    navigate(id ? `/help?article=${id}` : '/help');
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const toggleLanguage = () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    i18n.changeLanguage(newLang);
    document.documentElement.dir = newLang === 'ar' ? 'rtl' : 'ltr';
  };

  return (
    <header className="h-16 bg-white border-b border-surface-100 px-6 flex items-center justify-between shrink-0">
      {/* Left */}
      <div className="flex items-center gap-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 text-surface-500 hover:text-surface-700 hover:bg-surface-100 rounded-xl transition-colors"
        >
          <Menu size={20} />
        </button>
        <div className="hidden md:flex items-center gap-2 bg-surface-50 rounded-xl px-3 py-2 w-64 border border-surface-100">
          <Search size={16} className="text-surface-400" />
          <input
            type="text"
            placeholder={t('topbar.search_placeholder')}
            className="bg-transparent text-sm text-surface-700 placeholder:text-surface-400 outline-none flex-1"
          />
        </div>
      </div>

      {/* Right */}
      <div className="flex items-center gap-3">
        <button onClick={toggleLanguage} className="flex items-center gap-2 p-2 text-sm font-medium text-surface-600 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors">
          <Globe size={18} />
          <span className="hidden sm:inline">{t('topbar.language')}</span>
        </button>

        <button onClick={openHelp} title={t('nav.help_center', 'Help Center')} className="p-2 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-xl transition-colors">
          <HelpCircle size={20} />
        </button>

        <NotificationBell />

        <div className="flex items-center gap-3 ml-2">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-surface-900">{user?.name}</p>
            <p className="text-xs text-surface-400 capitalize">{user?.role?.replace('_', ' ')}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </header>
  );
}
