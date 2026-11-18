import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { toast } from 'react-toastify';
import { Loader2, RotateCcw, Save } from 'lucide-react';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import * as rolesApi from '@api/rolesApi';

/**
 * Which modules each role may open. What a role may change inside a module is
 * still fixed per action on the server; this decides what it can reach at all.
 */
export default function RolePermissions() {
  const { t } = useTranslation();
  const isAdmin = useSelector((s) => s.auth.user?.role) === 'admin';
  const [data, setData] = useState(null);
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let off = false;
    rolesApi.getRoles().then(({ data: d }) => {
      if (off) return;
      setData(d); setDraft(Object.fromEntries(d.roles.map((r) => [r.role, r.modules])));
    }).catch(() => { if (!off) toast.error(t('common.failed_load')); });
    return () => { off = true; };
  }, [t]);

  if (!isAdmin) return <Card className="!p-5"><p className="text-sm text-surface-500">{t('roles.admin_only')}</p></Card>;
  if (!data) return <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-brand-600 animate-spin" /></div>;

  const toggle = (role, m) => setDraft((d) => ({ ...d, [role]: d[role].includes(m) ? d[role].filter((x) => x !== m) : [...d[role], m] }));
  const save = async (role, reset) => {
    setBusy(role);
    try {
      const { data: r } = await rolesApi.saveRole(role, reset ? null : draft[role]);
      setData((d) => ({ ...d, roles: d.roles.map((x) => (x.role === role ? { ...x, modules: r.modules, customised: r.customised } : x)) }));
      setDraft((d) => ({ ...d, [role]: r.modules }));
      toast.success(t('roles.saved'));
    } catch (e) { toast.error(e?.response?.data?.error || t('common.operation_failed')); }
    finally { setBusy(null); }
  };
  const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

  return (
    <Card className="!p-0 overflow-x-auto">
      <div className="p-4 border-b border-surface-100">
        <h3 className="font-semibold text-surface-900">{t('roles.title')}</h3>
        <p className="text-xs text-surface-500 mt-0.5">{t('roles.desc')}</p>
      </div>
      <table className="w-full text-sm">
        <thead className="text-xs text-surface-500">
          <tr>
            <th className="text-start p-3">{t('roles.role')}</th>
            {data.modules.map((m) => <th key={m} className="p-2 font-medium">{t(`roles.module_${m}`)}</th>)}
            <th className="p-3" />
          </tr>
        </thead>
        <tbody>
          {data.roles.map((r) => {
            const mods = draft[r.role] || [];
            const dirty = !same(mods, r.modules);
            return (
              <tr key={r.role} className="border-t border-surface-50">
                <td className="p-3">
                  <div className="font-medium text-surface-900">{t(`roles.role_${r.role}`)}</div>
                  <div className="text-[11px] text-surface-400">{t('roles.users', { count: r.users })}{r.customised && <> · <Badge variant="pending">{t('roles.customised')}</Badge></>}</div>
                </td>
                {data.modules.map((m) => (
                  <td key={m} className="p-2 text-center">
                    <input type="checkbox" className="w-4 h-4" disabled={!r.editable} checked={mods.includes(m)} onChange={() => toggle(r.role, m)}
                      aria-label={`${t(`roles.role_${r.role}`)} — ${t(`roles.module_${m}`)}`} />
                  </td>
                ))}
                <td className="p-3 whitespace-nowrap text-end">
                  {r.editable ? (
                    <div className="inline-flex gap-1">
                      {r.customised && (
                        <Button size="sm" variant="secondary" onClick={() => save(r.role, true)} disabled={busy === r.role} title={t('roles.reset')}><RotateCcw size={13} /></Button>
                      )}
                      <Button size="sm" onClick={() => save(r.role, false)} loading={busy === r.role} disabled={!dirty}><Save size={13} /> {t('common.save')}</Button>
                    </div>
                  ) : <span className="text-[11px] text-surface-400">{t('roles.fixed')}</span>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}
