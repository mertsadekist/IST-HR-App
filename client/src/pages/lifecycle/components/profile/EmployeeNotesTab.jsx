import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { StickyNote, Pin, PinOff, Pencil, Trash2, Lock, Send, X, Check } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import * as employeesApi from '@api/employeesApi';

const MAX = 5000;
const initials = (name) => String(name || '?').split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();

/**
 * HR's internal notes on the employee — never shown to the employee. Each note
 * keeps the name of the person who wrote it and when; only the author can edit
 * their note, anyone in HR can pin one to the top, and only an admin deletes.
 */
export default function EmployeeNotesTab({ employee, t }) {
  const me = useSelector((s) => s.auth.user);
  const isAdmin = me?.role === 'admin';
  const [notes, setNotes] = useState([]);
  const [loadedFor, setLoadedFor] = useState(null);
  const loading = loadedFor !== employee.id;
  const [draft, setDraft] = useState('');
  const [pinNew, setPinNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(null); // { id, body }

  useEffect(() => {
    let alive = true;
    const id = employee.id;
    employeesApi.getEmployeeNotes(id)
      .then(({ data }) => { if (alive) setNotes(Array.isArray(data) ? data : []); })
      .catch(() => { if (alive) { setNotes([]); toast.error(t('empProfile.notes_load_failed')); } })
      .finally(() => { if (alive) setLoadedFor(id); });
    return () => { alive = false; };
  }, [employee.id, t]);

  const sort = (list) => [...list].sort((a, b) => (Number(b.pinned) - Number(a.pinned))
    || String(b.created_at).localeCompare(String(a.created_at)) || b.id - a.id);
  const replace = (n) => setNotes((list) => sort(list.map((x) => (x.id === n.id ? { ...n, pinned: !!n.pinned } : x))));

  const add = async () => {
    const body = draft.trim();
    if (!body) return;
    setSaving(true);
    try {
      const { data } = await employeesApi.addEmployeeNote(employee.id, { body, pinned: pinNew });
      setNotes((list) => sort([{ ...data, pinned: !!data.pinned }, ...list]));
      setDraft(''); setPinNew(false);
      toast.success(t('empProfile.note_saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('empProfile.note_save_failed'));
    } finally { setSaving(false); }
  };

  const saveEdit = async () => {
    try {
      const { data } = await employeesApi.updateEmployeeNote(employee.id, editing.id, { body: editing.body });
      replace(data);
      setEditing(null);
      toast.success(t('empProfile.note_saved'));
    } catch (err) { toast.error(err.response?.data?.error || t('empProfile.note_save_failed')); }
  };

  const togglePin = async (n) => {
    try {
      const { data } = await employeesApi.updateEmployeeNote(employee.id, n.id, { pinned: !n.pinned });
      replace(data);
    } catch (err) { toast.error(err.response?.data?.error || t('common.operation_failed')); }
  };

  const remove = async (n) => {
    const res = await confirmDelete(t('empProfile.note_delete_what', { name: n.author_name }));
    if (!res.isConfirmed) return;
    try {
      await employeesApi.deleteEmployeeNote(employee.id, n.id);
      setNotes((list) => list.filter((x) => x.id !== n.id));
      toast.success(t('common.deleted'));
    } catch { toast.error(t('common.delete_failed')); }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="rounded-2xl border border-surface-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <StickyNote size={16} className="text-brand-600" />
          <h3 className="text-sm font-bold text-surface-900">{t('empProfile.notes_add')}</h3>
          <span className="ms-auto inline-flex items-center gap-1 text-[11px] text-surface-500"><Lock size={12} /> {t('empProfile.notes_private')}</span>
        </div>
        <textarea value={draft} onChange={(e) => setDraft(e.target.value.slice(0, MAX))} rows={3}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) add(); }}
          placeholder={t('empProfile.notes_placeholder')}
          className="w-full text-sm bg-surface-50 border border-surface-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 resize-y" />
        <div className="flex items-center justify-between gap-2 mt-2 flex-wrap">
          <label className="inline-flex items-center gap-1.5 text-xs text-surface-600 cursor-pointer">
            <input type="checkbox" checked={pinNew} onChange={(e) => setPinNew(e.target.checked)} className="rounded border-surface-300 text-brand-600" />
            {t('empProfile.note_pin_new')}
          </label>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-surface-400 tabular-nums">{draft.length}/{MAX}</span>
            <Button size="sm" onClick={add} loading={saving} disabled={!draft.trim()}><Send size={14} /> {t('empProfile.note_save')}</Button>
          </div>
        </div>
      </div>

      {loading ? (
        <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : notes.length === 0 ? (
        <Card><EmptyState icon={<StickyNote className="w-6 h-6 text-surface-400" />} title={t('empProfile.notes_none')} description={t('empProfile.notes_none_desc')} /></Card>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => {
            const mine = n.created_by === me?.id;
            const isEditing = editing?.id === n.id;
            return (
              <li key={n.id} className={`rounded-2xl border p-4 ${n.pinned ? 'border-amber-200 bg-amber-50/50' : 'border-surface-200 bg-white'}`}>
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-bold shrink-0">{initials(n.author_name)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-surface-900">{n.author_name}</span>
                      {mine && <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-50 text-brand-700">{t('empProfile.note_you')}</span>}
                      {n.pinned && <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-800"><Pin size={10} /> {t('empProfile.note_pinned')}</span>}
                      <span className="text-[11px] text-surface-400" title={dayjs(n.created_at).format('YYYY-MM-DD HH:mm')}>
                        {dayjs(n.created_at).format('MMM D, YYYY · HH:mm')}
                        {n.updated_at && ` · ${t('empProfile.note_edited')}`}
                      </span>
                      <div className="ms-auto flex items-center gap-0.5">
                        <button type="button" onClick={() => togglePin(n)} className="p-1.5 rounded-lg text-surface-400 hover:text-amber-600 hover:bg-amber-50"
                          title={t(n.pinned ? 'empProfile.note_unpin' : 'empProfile.note_pin')}>
                          {n.pinned ? <PinOff size={14} /> : <Pin size={14} />}
                        </button>
                        {mine && !isEditing && (
                          <button type="button" onClick={() => setEditing({ id: n.id, body: n.body })} className="p-1.5 rounded-lg text-surface-400 hover:text-brand-600 hover:bg-brand-50" title={t('common.edit')}>
                            <Pencil size={14} />
                          </button>
                        )}
                        {isAdmin && (
                          <button type="button" onClick={() => remove(n)} className="p-1.5 rounded-lg text-surface-400 hover:text-red-600 hover:bg-red-50" title={t('common.delete')}>
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                    {isEditing ? (
                      <div className="mt-2 space-y-2">
                        <textarea value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value.slice(0, MAX) })} rows={3}
                          className="w-full text-sm bg-white border border-surface-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-brand-500/30" />
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => setEditing(null)}><X size={14} /> {t('common.cancel')}</Button>
                          <Button size="sm" onClick={saveEdit} disabled={!editing.body.trim()}><Check size={14} /> {t('common.save')}</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-surface-700 mt-1.5 whitespace-pre-wrap break-words leading-relaxed">{n.body}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
