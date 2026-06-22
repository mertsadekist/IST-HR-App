import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as usersApi from '@api/usersApi';
import * as departmentsApi from '@api/departmentsApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, Edit3, Trash2, ShieldCheck, Key, UserCog, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const roles = [
  { value: 'admin', label: 'Admin' },
  { value: 'hr_manager', label: 'HR Manager' },
  { value: 'recruiter', label: 'Recruiter' },
  { value: 'employee', label: 'Employee' },
];

const roleColors = {
  admin: 'danger',
  hr_manager: 'brand',
  recruiter: 'info',
  employee: 'active',
};

export default function UserManagement() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { user: currentUser } = useSelector((s) => s.auth);
  const isAdmin = currentUser?.role === 'admin'; // delete is admin-only
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [passModalOpen, setPassModalOpen] = useState(false);
  const [passUser, setPassUser] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [form, setForm] = useState({
    username: '', name: '', email: '', role: 'employee', company_id: '', department_id: '', password: '', is_active: true,
  });

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, dRes] = await Promise.all([
        usersApi.getUsers(),
        departmentsApi.getDepartments()
      ]);
      setUsers(uRes.data);
      setDepartments(dRes.data);
    } catch {
      toast.error(t('toasts.t_failed_to_load_data'));
    } finally {
      setLoading(false);
    }
  };

  const openAdd = () => {
    setEditing(null);
    setForm({ username: '', name: '', email: '', role: 'employee', company_id: '', department_id: '', password: '', is_active: true });
    setModalOpen(true);
  };

  const openEdit = (user) => {
    setEditing(user);
    setForm({
      username: user.username, name: user.name, email: user.email || '',
      role: user.role, company_id: user.company_id ? String(user.company_id) : '',
      department_id: user.department_id ? String(user.department_id) : '', password: '', is_active: user.is_active,
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.username || !form.name || !form.role) {
      toast.error(t('toasts.t_username_name_and_role_are_required'));
      return;
    }
    if (!editing && !form.password) {
      toast.error(t('toasts.t_password_is_required_for_new_users'));
      return;
    }
    setSaving(true);
    try {
      const payload = { 
        ...form, 
        company_id: form.company_id ? parseInt(form.company_id) : null,
        department_id: form.department_id ? parseInt(form.department_id) : null
      };
      if (editing) {
        if (!payload.password) delete payload.password;
        await usersApi.updateUser(editing.id, payload);
        toast.success(t('toasts.t_user_updated'));
      } else {
        await usersApi.createUser(payload);
        toast.success(t('toasts.t_user_created'));
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (user) => {
    if (user.id === currentUser?.id) {
      toast.error(t('toasts.t_you_cannot_delete_your_own_account'));
      return;
    }
    const result = await confirmDelete(`user "${user.name}"`);
    if (result.isConfirmed) {
      try {
        await usersApi.deleteUser(user.id);
        toast.success(t('toasts.t_user_deleted'));
        loadData();
      } catch (err) {
        toast.error(err.response?.data?.error || 'Delete failed');
      }
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error(t('toasts.t_password_must_be_at_least_6_characters'));
      return;
    }
    try {
      await usersApi.resetPassword(passUser.id, { password: newPassword });
      toast.success(`Password reset for ${passUser.name}`);
      setPassModalOpen(false);
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Reset failed');
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  const filtered = users.filter((u) =>
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.role.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('user_management.title')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('user_management.subtitle')}</p>
        </div>
        <Button onClick={openAdd}><Plus size={16} /> {t('user_management.add_user')}</Button>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-surface-200/60">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input type="text" placeholder={t('user_management.search')} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-surface-50 border-none rounded-xl input-focus" />
        </div>
        <Badge variant="brand">{users.length} users</Badge>
      </div>

      {/* Table */}
      {loading ? (
        <Card className="animate-pulse !p-8"><div className="h-4 bg-surface-200 rounded w-1/2 mb-4" /><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : filtered.length === 0 ? (
        <Card><EmptyState icon={<UserCog className="w-6 h-6 text-surface-400" />} title={searchQuery ? t('user_management.no_matching_users') : t('user_management.no_users')} /></Card>
      ) : (
        <Card className="!p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-100 bg-surface-50/60">
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('user_management.user')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('user_management.username')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('user_management.role')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('user_management.company')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('user_management.department', 'Department')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('user_management.status')}</th>
                  <th className="text-right px-5 py-3 font-medium text-surface-500">{t('user_management.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((user) => {
                  const company = companies.find((c) => c.id === user.company_id);
                  return (
                    <tr key={user.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xs">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-surface-900">{user.name}</p>
                            {user.email && <p className="text-xs text-surface-400">{user.email}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-surface-600 font-mono text-xs">{user.username}</td>
                      <td className="px-5 py-3">
                        <Badge variant={roleColors[user.role] || 'info'}>
                          <ShieldCheck size={12} /> {user.role.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-surface-600">
                        {company ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: company.color_primary }} />
                            {company.short_code}
                          </span>
                        ) : (
                          <span className="text-surface-400">{t('user_management.all_companies') || 'All'}</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-surface-600 text-xs">
                        {user.department_name ? user.department_name : <span className="text-surface-400">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={user.is_active ? 'active' : 'inactive'} dot>
                          {user.is_active ? t('user_management.active') : t('user_management.inactive')}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" onClick={() => { setPassUser(user); setPassModalOpen(true); }} title={t('user_management.reset_password')}>
                            <Key size={14} />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => openEdit(user)} title={t('common.edit')}>
                            <Edit3 size={14} />
                          </Button>
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(user)}
                              className={user.id === currentUser?.id ? 'opacity-30 cursor-not-allowed' : 'text-red-500 hover:!bg-red-50'}
                              disabled={user.id === currentUser?.id} title={t('common.delete')}>
                              <Trash2 size={14} />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Add/Edit User Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('user_management.edit_user') : t('user_management.add_user')} size="md">
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('user_management.full_name')} required placeholder="e.g. John Doe" value={form.name} onChange={(e) => update('name', e.target.value)} />
            <Input label={t('user_management.username')} required placeholder="e.g. johndoe" value={form.username} onChange={(e) => update('username', e.target.value)} disabled={!!editing} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('user_management.email')} type="email" placeholder="user@company.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
            <Select
              label={t('user_management.role')}
              required
              value={form.role}
              onChange={(e) => update('role', e.target.value)}
              options={roles}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label={t('user_management.company')}
              value={form.company_id}
              onChange={(e) => { update('company_id', e.target.value); update('department_id', ''); }}
              options={[{ value: '', label: t('user_management.all_companies') }, ...companies.map((c) => ({ value: String(c.id), label: c.name }))]}
              placeholder="..."
            />
            <Select
              label={t('user_management.department', 'Department')}
              value={form.department_id}
              onChange={(e) => update('department_id', e.target.value)}
              options={[{ value: '', label: '...' }, ...departments.filter(d => !form.company_id || d.company_id === parseInt(form.company_id)).map((d) => ({ value: String(d.id), label: d.name }))]}
              placeholder="..."
              disabled={!form.company_id}
            />
          </div>
          <div className="grid grid-cols-1 gap-4">
            <Input
              label={editing ? t('user_management.new_password_keep') : t('user_management.password')}
              type="password"
              required={!editing}
              placeholder={t('user_management.min_6_chars')}
              value={form.password}
              onChange={(e) => update('password', e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-surface-700">{t('user_management.active')}</label>
            <button type="button" onClick={() => update('is_active', !form.is_active)}
              className={`relative w-11 h-6 rounded-full transition-colors ${form.is_active ? 'bg-brand-600' : 'bg-surface-300'}`}>
              <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-all ${form.is_active ? 'left-5.5' : 'left-0.5'}`}
                style={{ left: form.is_active ? '22px' : '2px' }} />
            </button>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('common.save') : t('user_management.create_user')}</Button>
          </div>
        </form>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={passModalOpen} onClose={() => setPassModalOpen(false)} title={t('user_management.reset_password')} size="sm">
        <p className="text-sm text-surface-500 mb-4">{t('user_management.reset_password_for')} <strong>{passUser?.name}</strong></p>
        <Input label={t('user_management.new_password')} type="password" placeholder={t('user_management.min_6_chars')} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
        <div className="flex justify-end gap-3 mt-4">
          <Button type="button" variant="secondary" onClick={() => setPassModalOpen(false)}>{t('common.cancel')}</Button>
          <Button onClick={handleResetPassword}>{t('user_management.reset_password')}</Button>
        </div>
      </Modal>
    </div>
  );
}
