import { useDispatch, useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { stopImpersonation } from '@store/slices/authSlice';
import { toast } from 'react-toastify';
import { UserCheck, LogOut, Loader2 } from 'lucide-react';

/**
 * Always-on notice that this is somebody else's account.
 *
 * Deliberately not dismissible and deliberately loud. The single worst outcome
 * of a "login as" feature is an operator who has forgotten whose account they
 * are in and takes an action believing it is their own, so the banner sits
 * above everything for as long as the session lasts.
 */
export default function ImpersonationBanner() {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, impersonatedBy } = useSelector((s) => s.auth);
  const [leaving, setLeaving] = useState(false);

  if (!impersonatedBy) return null;

  const back = async () => {
    setLeaving(true);
    const res = await dispatch(stopImpersonation());
    setLeaving(false);
    if (stopImpersonation.fulfilled.match(res)) {
      toast.success(t('impersonation.returned'));
      navigate('/users');
    } else {
      toast.error(res.payload || t('common.error'));
      navigate('/login');
    }
  };

  return (
    <div className="bg-amber-500 text-amber-950 px-4 py-2 flex items-center justify-between gap-3 flex-wrap shadow-sm">
      <div className="flex items-center gap-2 min-w-0">
        <UserCheck size={16} className="shrink-0" />
        <p className="text-sm font-medium truncate">
          {t('impersonation.banner', { name: user?.name, role: user?.role })}
        </p>
        <span className="text-xs opacity-80 hidden sm:inline">
          {t('impersonation.as_admin', { admin: impersonatedBy.name })}
        </span>
      </div>
      <button type="button" onClick={back} disabled={leaving}
        className="flex items-center gap-1.5 text-xs font-semibold bg-amber-950/10 hover:bg-amber-950/20 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-60">
        {leaving ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
        {t('impersonation.return')}
      </button>
    </div>
  );
}
