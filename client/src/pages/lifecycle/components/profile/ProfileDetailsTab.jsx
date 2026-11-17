import { useState, useMemo } from 'react';
import { useSelector } from 'react-redux';
import { Users, Briefcase, Pencil, X, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import * as employeesApi from '@api/employeesApi';
import * as departmentsApi from '@api/departmentsApi';
import EmailBuilder from './EmailBuilder';
import { statusLabel, statusVariant } from './profileUtils';

const field = 'w-full text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5';
const fieldLabel = 'block text-surface-500 text-[10px] mb-0.5';

function Row({ label, children }) {
  return (
    <div className="flex justify-between items-center gap-3 py-1.5 border-b border-surface-100 last:border-0">
      <span className="text-surface-500">{label}</span>
      <span className="font-semibold text-surface-800 text-end break-all">{children}</span>
    </div>
  );
}

function Section({ icon: Icon, title, children }) {
  return (
    <div className="space-y-3 bg-white p-4 rounded-xl border border-surface-200">
      <h3 className="font-bold text-surface-900 text-sm border-b border-surface-100 pb-2 flex items-center gap-1.5">
        <Icon size={16} className="text-brand-600" />
        {title}
      </h3>
      {children}
    </div>
  );
}

/**
 * Personal and employment details, plus the identifiers that are saved inline
 * (WPS numbers, attendance ID, owner flag, portal login).
 *
 * `onChange(patch)` merges fresh fields into the page's copy of the employee.
 */
export default function ProfileDetailsTab({ employee, onChange, t, isAdmin }) {
  const { items: companies } = useSelector((s) => s.companies);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [departments, setDepartments] = useState([]);
  // Everyone in the organization who can be picked as a direct manager.
  const [managerOptions, setManagerOptions] = useState([]);
  const [attId, setAttId] = useState(employee.attendance_id || '');
  const [savingAtt, setSavingAtt] = useState(false);
  const [savingOwner, setSavingOwner] = useState(false);
  const [wpsIds, setWpsIds] = useState({ work_permit_no: employee.work_permit_no || '', personal_no: employee.personal_no || '' });
  const [savingWps, setSavingWps] = useState(false);
  const [creatingLogin, setCreatingLogin] = useState(false);
  const [newLoginCreds, setNewLoginCreds] = useState(null);

  // Official mail domains of the employee's own company (not the selected entity).
  const companyDomains = useMemo(() => {
    const co = companies.find((c) => c.id === employee.company_id);
    return String(co?.email_domains || '').split(',').map((d) => d.trim()).filter(Boolean);
  }, [companies, employee.company_id]);

  const set = (k) => (e) => setEditForm((f) => ({ ...f, [k]: e.target.value }));
  const na = t('empProfile.not_set');
  const money = (v) => (v ? `${Number(v).toLocaleString()} ${t('empProfile.aed')}` : na);

  const startEdit = async () => {
    setEditForm({
      first_name: employee.first_name || '', last_name: employee.last_name || '',
      email: employee.email || '', phone: employee.phone || '', nationality: employee.nationality || '',
      department_id: employee.department_id ? String(employee.department_id) : '',
      job_title_text: employee.job_title_text || employee.job_title_name || '',
      basic_salary: employee.basic_salary ?? '', full_salary: employee.full_salary ?? '',
      start_date: employee.start_date ? dayjs(employee.start_date).format('YYYY-MM-DD') : '',
      status: employee.status || 'Active',
      labour_contract_status: employee.labour_contract_status || 'Not Issued',
      manager_employee_id: employee.manager_employee_id ? String(employee.manager_employee_id) : '',
    });
    try {
      const { data } = await departmentsApi.getDepartments({ company_id: employee.company_id });
      setDepartments(data.data || data || []);
    } catch { /* ignore */ }
    try {
      const { data } = await employeesApi.getOrgPeople();
      setManagerOptions(data || []);
    } catch { setManagerOptions([]); }
    setEditMode(true);
  };

  const saveProfile = async () => {
    if (!editForm.first_name || !editForm.last_name) {
      toast.error(t('employees.first_last_required'));
      return;
    }
    setSavingProfile(true);
    try {
      const patch = {
        ...editForm,
        department_id: editForm.department_id ? Number(editForm.department_id) : null,
        basic_salary: editForm.basic_salary === '' ? null : Number(editForm.basic_salary),
        full_salary: editForm.full_salary === '' ? null : Number(editForm.full_salary),
        start_date: editForm.start_date || null,
        manager_employee_id: editForm.manager_employee_id ? Number(editForm.manager_employee_id) : null,
      };
      await employeesApi.updateEmployee(employee.id, patch);
      const { data } = await employeesApi.getEmployee(employee.id);
      onChange(data);
      setEditMode(false);
      toast.success(t('employees.profile_saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('employees.profile_save_failed'));
    } finally {
      setSavingProfile(false);
    }
  };

  const createLogin = async () => {
    setCreatingLogin(true);
    try {
      const { data } = await employeesApi.createEmployeeLogin(employee.id);
      setNewLoginCreds({ username: data.username, password: data.password });
      onChange({ user_id: data.user_id, username: data.username });
      toast.success(t('employees.login_created'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('employees.login_create_failed'));
    } finally {
      setCreatingLogin(false);
    }
  };

  const saveAttendanceId = async () => {
    setSavingAtt(true);
    try {
      await employeesApi.updateEmployee(employee.id, { attendance_id: attId || null });
      onChange({ attendance_id: attId });
      toast.success(t('employees.attendance_id_saved'));
    } catch {
      toast.error(t('employees.attendance_id_save_failed'));
    } finally {
      setSavingAtt(false);
    }
  };

  // Company owner = exempt from attendance and attendance-driven deductions.
  // Admin-only on the server; saved immediately, like the Attendance ID.
  const toggleOwner = async (next) => {
    setSavingOwner(true);
    try {
      await employeesApi.updateEmployee(employee.id, { is_owner: next });
      onChange({ is_owner: next });
      toast.success(t(next ? 'employees.owner_saved_on' : 'employees.owner_saved_off'));
    } catch {
      toast.error(t('employees.owner_save_failed'));
    } finally {
      setSavingOwner(false);
    }
  };

  // WPS identifiers save inline rather than only through edit mode — they are
  // filled in one pass across many employees.
  const saveWpsIds = async () => {
    setSavingWps(true);
    const patch = {
      work_permit_no: wpsIds.work_permit_no.trim() || null,
      personal_no: wpsIds.personal_no.trim() || null,
    };
    try {
      await employeesApi.updateEmployee(employee.id, patch);
      onChange(patch);
      toast.success(t('employees.wps_ids_saved'));
    } catch (err) {
      toast.error(err.response?.data?.error || t('employees.wps_ids_save_failed'));
    } finally {
      setSavingWps(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end gap-2">
        {editMode ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}><X size={14} /> {t('common.cancel')}</Button>
            <Button size="sm" onClick={saveProfile} loading={savingProfile}>{t('common.save')}</Button>
          </>
        ) : (
          <Button size="sm" variant="secondary" onClick={startEdit}><Pencil size={14} /> {t('common.edit')}</Button>
        )}
      </div>

      {employee.labour_contract_status !== 'Issued' && (
        <div className="p-3 rounded-xl bg-red-50 border border-red-200 flex items-start gap-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700 leading-relaxed">{t('employees.probation_notice')}</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 items-start">
        <Section icon={Users} title={t('empProfile.personal_info')}>
          {editMode ? (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div><label className={fieldLabel}>{t('recruitment.first_name')}</label><input value={editForm.first_name} onChange={set('first_name')} className={field} /></div>
                <div><label className={fieldLabel}>{t('recruitment.last_name')}</label><input value={editForm.last_name} onChange={set('last_name')} className={field} /></div>
              </div>
              <div>
                <label className={fieldLabel}>{t('empProfile.f_email')}</label>
                <EmailBuilder value={editForm.email} onChange={(v) => setEditForm((f) => ({ ...f, email: v }))}
                  companyDomains={companyDomains} contracted={editForm.labour_contract_status === 'Issued'} t={t} />
              </div>
              <div><label className={fieldLabel}>{t('empProfile.f_phone')}</label><input value={editForm.phone} onChange={set('phone')} className={field} /></div>
              <div><label className={fieldLabel}>{t('empProfile.f_nationality')}</label><input value={editForm.nationality} onChange={set('nationality')} className={field} /></div>
            </div>
          ) : (
            <div className="text-xs">
              <Row label={t('empProfile.f_name')}>{employee.first_name} {employee.last_name}</Row>
              <Row label={t('empProfile.f_email')}>{employee.email || na}</Row>
              <Row label={t('empProfile.f_phone')}>{employee.phone || na}</Row>
              <Row label={t('empProfile.f_nationality')}>{employee.nationality || na}</Row>
            </div>
          )}
        </Section>

        <Section icon={Briefcase} title={t('empProfile.employment_details')}>
          {editMode ? (
            <div className="space-y-2">
              <Row label={t('empProfile.f_company')}>{employee.company_name || na}</Row>
              <div>
                <label className={fieldLabel}>{t('empProfile.f_department')}</label>
                <select value={editForm.department_id} onChange={set('department_id')} className={field}>
                  <option value="">{t('employees.no_department')}</option>
                  {departments.map((d) => <option key={d.id} value={String(d.id)}>{d.name}</option>)}
                </select>
              </div>
              <div><label className={fieldLabel}>{t('empProfile.f_job_title')}</label><input value={editForm.job_title_text} onChange={set('job_title_text')} className={field} /></div>
              <div>
                <label className={fieldLabel}>{t('org.manager')}</label>
                <select value={editForm.manager_employee_id} onChange={set('manager_employee_id')} className={field}>
                  <option value="">{t('org.no_manager')}</option>
                  {managerOptions.filter((p) => p.id !== employee.id).map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name}{p.job_title ? ` — ${p.job_title}` : ''}{p.short_code ? ` (${p.short_code})` : ''}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className={fieldLabel}>{t('empProfile.f_status')}</label>
                  <select value={editForm.status} onChange={set('status')} className={field}>
                    {['Onboarding', 'Active', 'Offboarding', 'Exited'].map((s) => <option key={s} value={s}>{statusLabel(t, s)}</option>)}
                  </select>
                </div>
                <div>
                  <label className={fieldLabel}>{t('employees.labour_contract_status')}</label>
                  <select value={editForm.labour_contract_status} onChange={set('labour_contract_status')} className={field}>
                    <option value="Not Issued">{t('employees.lc_not_issued')}</option>
                    <option value="Issued">{t('employees.lc_issued')}</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className={fieldLabel}>{t('employees.basic_salary')}</label><input value={editForm.basic_salary} onChange={set('basic_salary')} type="number" className={field} /></div>
                <div><label className={fieldLabel}>{t('employees.full_salary')}</label><input value={editForm.full_salary} onChange={set('full_salary')} type="number" className={field} /></div>
              </div>
              <div><label className={fieldLabel}>{t('empProfile.f_join')}</label><input value={editForm.start_date} onChange={set('start_date')} type="date" className={field} /></div>
            </div>
          ) : (
            <div className="text-xs">
              <Row label={t('empProfile.f_company')}>{employee.company_name || na}</Row>
              <Row label={t('empProfile.f_department')}>{employee.department_name || na}</Row>
              <Row label={t('empProfile.f_job_title')}>{employee.job_title_text || employee.job_title_name || na}</Row>
              <Row label={t('org.manager')}>{employee.manager_name || t('org.no_manager')}</Row>
              <Row label={t('empProfile.f_status')}><Badge variant={statusVariant(employee.status)}>{statusLabel(t, employee.status)}</Badge></Row>
              <Row label={t('employees.labour_contract_status')}>
                <Badge variant={employee.labour_contract_status === 'Issued' ? 'success' : 'danger'}>
                  {t(employee.labour_contract_status === 'Issued' ? 'employees.lc_issued' : 'employees.lc_not_issued')}
                </Badge>
              </Row>
              <Row label={t('employees.basic_salary')}><span className="text-emerald-600">{money(employee.basic_salary)}</span></Row>
              <Row label={t('employees.full_salary')}><span className="text-emerald-700">{money(employee.full_salary)}</span></Row>
              <Row label={t('empProfile.f_join')}>{employee.start_date ? dayjs(employee.start_date).format('MMM D, YYYY') : na}</Row>
            </div>
          )}
        </Section>

        <Section icon={ShieldCheck} title={t('empProfile.identifiers_access')}>
          {/* WPS identifiers — mandatory on the Ministry of Labour salary file. */}
          <div>
            <label className="block text-surface-600 font-semibold text-xs mb-1">{t('employees.wps_ids')}</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['work_permit_no', t('employees.work_permit_no_full'), 9],
                ['personal_no', t('employees.personal_no_full'), 14],
              ].map(([key, label, len]) => {
                const val = wpsIds[key];
                // Live length feedback: the MOL rejects a file with a wrong-width number.
                const wrongLen = val.trim().length > 0 && val.trim().length !== len;
                return (
                  <div key={key}>
                    <label className="block text-surface-400 text-[10px] mb-0.5">{label}</label>
                    <input value={val} onChange={(e) => setWpsIds((p) => ({ ...p, [key]: e.target.value }))}
                      inputMode="numeric" placeholder={'0'.repeat(len)}
                      className={`w-full text-xs font-mono bg-white border rounded-lg px-2 py-1.5 ${wrongLen ? 'border-amber-400' : 'border-surface-200'}`} />
                    {wrongLen && <p className="text-[10px] text-amber-600 mt-0.5">{t('employees.wps_len_warning', { expected: len, actual: val.trim().length })}</p>}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-2 mt-2">
              <Button size="sm" onClick={saveWpsIds} loading={savingWps}>{t('common.save')}</Button>
              {(!employee.work_permit_no || !employee.personal_no) && (
                <span className="text-[10px] text-red-500">{t('employees.wps_ids_required')}</span>
              )}
            </div>
            <p className="text-[10px] text-surface-400 mt-1">{t('employees.wps_ids_hint')}</p>
          </div>
          <div className="pt-3 border-t border-surface-100">
            <label className="block text-surface-600 font-semibold text-xs mb-1">{t('employees.attendance_id')}</label>
            <div className="flex gap-2">
              <input value={attId} onChange={(e) => setAttId(e.target.value)} placeholder="4035"
                className="flex-1 text-xs bg-white border border-surface-200 rounded-lg px-2 py-1.5" />
              <Button size="sm" onClick={saveAttendanceId} loading={savingAtt}>{t('common.save')}</Button>
            </div>
            <p className="text-[10px] text-surface-400 mt-1">{t('employees.attendance_id_hint')}</p>
          </div>
          <div className="pt-3 border-t border-surface-100">
            <label className="flex items-center gap-2 text-xs text-surface-700 font-medium cursor-pointer">
              <input type="checkbox" checked={!!employee.is_owner} disabled={!isAdmin || savingOwner}
                onChange={(e) => toggleOwner(e.target.checked)}
                className="rounded border-surface-300 text-brand-600" />
              {t('employees.owner_label')}
            </label>
            <p className="text-[10px] text-surface-400 mt-1">{t('employees.owner_hint')}</p>
            {!isAdmin && <p className="text-[10px] text-amber-600 mt-0.5">{t('employees.owner_admin_only')}</p>}
          </div>
          <div className="pt-3 border-t border-surface-100">
            <label className="block text-surface-600 font-semibold text-xs mb-1">{t('employees.login_account')}</label>
            {/* The fresh credentials come first: creating the login also sets
                user_id, and the password is shown this once only. */}
            {newLoginCreds ? (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2 text-[11px] space-y-1">
                <p className="font-semibold text-amber-800">{t('employees.login_created_hint')}</p>
                <p>{t('employees.username')}: <span className="font-mono font-semibold">{newLoginCreds.username}</span></p>
                <p>{t('employees.password')}: <span className="font-mono font-semibold">{newLoginCreds.password}</span></p>
              </div>
            ) : employee.user_id ? (
              <p className="text-[11px] text-emerald-600 font-medium">{t('employees.has_login')} ({employee.username})</p>
            ) : (
              <Button size="sm" variant="secondary" onClick={createLogin} loading={creatingLogin}>{t('employees.create_login')}</Button>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
