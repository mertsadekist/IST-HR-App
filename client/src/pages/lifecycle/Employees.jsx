import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import { Users, Plus, Mail, Phone, Building2, Briefcase, X, Search } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '@api/axios';
import * as employeesApi from '@api/employeesApi';
import EmployeeOnboardingWizard from './components/EmployeeOnboardingWizard';
import { statusLabel, statusVariant } from './components/profile/profileUtils';
import { toast } from 'react-toastify';
import dayjs from 'dayjs';

const PAGE_SIZE = 50;

// The three list views, in button order. `statuses` is sent to the server as-is.
const STATUS_VIEWS = {
  current: { label: 'employees.filter_current', statuses: 'Active,Onboarding' },
  left: { label: 'employees.filter_left', statuses: 'Offboarding,Exited' },
  all: { label: 'employees.filter_all', statuses: null },
};

/**
 * The employee list. A row opens the full profile on its own page
 * (/employees/:id — see EmployeeProfile.jsx); it used to be a modal, which had
 * grown too small for everything a profile holds.
 */
export default function Employees() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { currentCompanyId } = useSelector((s) => s.entity);
  const [searchParams] = useSearchParams();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');   // what is typed
  const [query, setQuery] = useState('');     // what is sent, after the debounce
  // Which employees the list shows. Default is the people currently working here
  // (Active + Onboarding); leavers are one click away rather than mixed in.
  const [statusView, setStatusView] = useState('current'); // 'current' | 'left' | 'all'
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const queryRef = useRef('');
  const loadSeq = useRef(0);
  const [wizardOpen, setWizardOpen] = useState(false);
  // Photo bytes come from an authenticated endpoint, so an <img src> can't
  // fetch them directly — they're read as blobs into a map of object URLs
  // keyed by employee id.
  const [photoUrls, setPhotoUrls] = useState({});
  const photoUrlsRef = useRef({});

  // Old deep links (?open=<id>&tab=documents) now land on the profile page.
  useEffect(() => {
    const openId = searchParams.get('open');
    if (!openId) return;
    const tab = searchParams.get('tab');
    navigate(`/employees/${openId}${tab ? `?tab=${encodeURIComponent(tab)}` : ''}`, { replace: true });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Search is done on the server so it reaches every employee, not only the
  // page already loaded. Typing is debounced so each keystroke is not a request.
  useEffect(() => {
    const timer = setTimeout(() => {
      const next = search.trim();
      if (next === queryRef.current) return;
      queryRef.current = next;
      setPage(1); // a new search starts from the first page; both updates batch into one load
      setQuery(next);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // A different company starts again from the first page.
  useEffect(() => { setPage(1); }, [currentCompanyId]);

  useEffect(() => {
    loadEmployees();
  }, [currentCompanyId, query, statusView, page]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEmployees = async () => {
    const requestId = ++loadSeq.current; // a slower, older response must not overwrite a newer one
    setLoading(true);
    revokeAllPhotos(); // the previous company's blobs are no longer referenced
    try {
      const qs = new URLSearchParams({ limit: String(PAGE_SIZE), page: String(page) });
      if (currentCompanyId) qs.set('company_id', currentCompanyId);
      if (query) qs.set('search', query);
      if (STATUS_VIEWS[statusView].statuses) qs.set('status', STATUS_VIEWS[statusView].statuses);
      const { data } = await api.get(`/employees?${qs}`);
      if (requestId !== loadSeq.current) return;
      const list = data.data || data; // handle standard pagination response or flat array
      setTotal(Number(data.total ?? list.length) || 0);
      setTotalPages(Math.max(1, Number(data.totalPages) || 1));
      // A page past the end (people were removed meanwhile) falls back to the last one.
      if (data.totalPages && page > data.totalPages) { setPage(data.totalPages); return; }
      setEmployees(list);
      loadPhotos(list); // not awaited: avatars fill in as they arrive
    } catch {
      if (requestId === loadSeq.current) toast.error(t('toasts.t_failed_to_load_employees'));
    } finally {
      if (requestId === loadSeq.current) setLoading(false);
    }
  };

  const handleWizardComplete = () => {
    setWizardOpen(false);
    loadEmployees();
    toast.success(t('toasts.t_employee_successfully_onboarded'));
  };

  const handleOpenProfile = (emp) => navigate(`/employees/${emp.id}`);

  // Only employees that actually have a stored photo are fetched.
  const loadPhotos = async (list) => {
    const targets = (list || []).filter((e) => e.photo_path);
    if (!targets.length) return;
    const entries = await Promise.all(targets.map(async (e) => {
      try {
        const { data } = await employeesApi.getEmployeePhotoBytes(e.id);
        return [e.id, URL.createObjectURL(data)];
      } catch { return null; }
    }));
    setPhotoUrls((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        if (!entry) continue;
        const [id, url] = entry;
        if (next[id]) URL.revokeObjectURL(next[id]);
        next[id] = url;
      }
      return next;
    });
  };

  const revokeAllPhotos = () => {
    Object.values(photoUrlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    photoUrlsRef.current = {};
    setPhotoUrls({});
  };

  // Keep a ref copy so the unmount cleanup revokes the *current* URLs.
  useEffect(() => { photoUrlsRef.current = photoUrls; }, [photoUrls]);
  useEffect(() => () => { Object.values(photoUrlsRef.current).forEach((u) => URL.revokeObjectURL(u)); }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-surface-900 flex items-center gap-2">
            <Users className="text-brand-600" />
            {t('employees.title')}
          </h1>
          <p className="text-surface-500 mt-1">{t('employees.subtitle')}</p>
        </div>
        <Button onClick={() => setWizardOpen(true)} className="shrink-0 group shadow-lg shadow-brand-500/20">
          <Plus size={18} className="group-hover:rotate-90 transition-transform" />
          {t('employees.add_employee')}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="relative w-full max-w-md">
        <Search size={16} className="absolute start-3 top-1/2 -translate-y-1/2 text-surface-400 pointer-events-none" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('employees.search_placeholder')}
          aria-label={t('employees.search_label')}
          className="w-full text-sm bg-white border border-surface-200 rounded-xl ps-9 pe-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label={t('employees.search_clear')}
            className="absolute end-2 top-1/2 -translate-y-1/2 p-1 text-surface-400 hover:text-surface-700">
            <X size={14} />
          </button>
        )}
      </div>
      <div role="group" aria-label={t('employees.filter_label')} className="inline-flex rounded-xl border border-surface-200 bg-white p-0.5 text-sm shrink-0">
        {Object.entries(STATUS_VIEWS).map(([value, { label }]) => (
          <button key={value} type="button" aria-pressed={statusView === value} onClick={() => { setStatusView(value); setPage(1); }}
            className={`px-3 py-1.5 rounded-[10px] font-medium transition-colors ${statusView === value ? 'bg-brand-600 text-white' : 'text-surface-600 hover:bg-surface-50'}`}>
            {t(label)}
          </button>
        ))}
      </div>
      </div>

      <Card className="!p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-start text-sm whitespace-nowrap">
            <thead>
              <tr className="bg-surface-50 text-surface-500 border-b border-surface-200">
                <th className="p-4 font-semibold text-start">{t('employees.col_employee')}</th>
                <th className="p-4 font-semibold text-start">{t('employees.col_contact')}</th>
                <th className="p-4 font-semibold text-start">{t('employees.col_role_dept')}</th>
                <th className="p-4 font-semibold text-start">{t('employees.col_status')}</th>
                <th className="p-4 font-semibold text-start">{t('employees.col_joined')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-100">
              {loading ? (
                <tr><td colSpan="5" className="p-8 text-center text-surface-500">{t('employees.loading')}</td></tr>
              ) : employees.length === 0 ? (
                <tr><td colSpan="5" className="p-8 text-center text-surface-500">{t('employees.none_found')}</td></tr>
              ) : (
                employees.map(emp => (
                  <tr key={emp.id} onClick={() => handleOpenProfile(emp)} className="hover:bg-surface-50/50 transition-colors cursor-pointer">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-brand-100 text-brand-700 flex items-center justify-center font-bold shrink-0">
                          {photoUrls[emp.id]
                            ? <img src={photoUrls[emp.id]} alt="" className="w-full h-full object-cover" />
                            : <>{emp.first_name?.[0]}{emp.last_name?.[0]}</>}
                        </div>
                        <div>
                          <div className="font-semibold text-surface-900">{emp.first_name} {emp.last_name}</div>
                          <div className="text-xs text-surface-500">{emp.company_name || t('employees.no_company')}</div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-surface-600"><Mail size={14}/> {emp.email}</div>
                      <div className="flex items-center gap-2 text-surface-500 mt-1"><Phone size={14}/> {emp.phone || t('empProfile.not_set')}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 text-surface-800"><Briefcase size={14} className="text-brand-500"/> {emp.job_title_text || emp.job_title_name}</div>
                      <div className="flex items-center gap-2 text-surface-500 mt-1"><Building2 size={14}/> {emp.department_name}</div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant={statusVariant(emp.status)}>{statusLabel(t, emp.status)}</Badge>
                        {!!emp.is_owner && <Badge variant="info">{t('employees.owner_badge')}</Badge>}
                      </div>
                    </td>
                    <td className="p-4 text-surface-600">
                      {emp.start_date ? dayjs(emp.start_date).format('MMM D, YYYY') : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {/* Without this, anyone beyond the first page of results simply could not be
            reached — they existed but never appeared. */}
        {total > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-surface-100 text-sm text-surface-600">
            <span>{t('employees.showing_range', { from: (page - 1) * PAGE_SIZE + 1, to: Math.min(page * PAGE_SIZE, total), total })}</span>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="secondary" disabled={page <= 1 || loading} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                  {t('employees.page_prev')}
                </Button>
                <span className="tabular-nums">{t('employees.page_of', { page, pages: totalPages })}</span>
                <Button size="sm" variant="secondary" disabled={page >= totalPages || loading} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                  {t('employees.page_next')}
                </Button>
              </div>
            )}
          </div>
        )}
      </Card>

      {wizardOpen && (
        <EmployeeOnboardingWizard 
          open={wizardOpen} 
          onClose={() => setWizardOpen(false)} 
          onComplete={handleWizardComplete} 
        />
      )}
    </div>
  );
}
