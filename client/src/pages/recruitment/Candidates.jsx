import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as candidatesApi from '@api/candidatesApi';
import * as vacanciesApi from '@api/vacanciesApi';
import * as settingsApi from '@api/settingsApi';
import * as aiApi from '@api/aiApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, Edit3, Trash2, Users, Search, ChevronLeft, ChevronRight, Mail, Phone, Globe, Star, ArrowRight, Sparkles, Loader2, User, Clock, FileText, Brain, Upload, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import EmailButton from '@components/email/EmailButton';

export default function Candidates() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);

  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [stages, setStages] = useState([]);
  const [vacancies, setVacancies] = useState([]);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    first_name: '', last_name: '', email: '', phone: '', nationality: '',
    company_id: '', vacancy_id: '', current_stage_id: '', notes: '', applied_date: '',
    cv_text: '', cv_file_name: ''
  });

  // Move modal
  const [moveModalOpen, setMoveModalOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState(null);
  const [moveStageId, setMoveStageId] = useState('');
  const [moveNotes, setMoveNotes] = useState('');
  const [moving, setMoving] = useState(false);

  // Profile view
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileCandidate, setProfileCandidate] = useState(null);
  const [profileTab, setProfileTab] = useState('overview');
  const [aiSummary, setAiSummary] = useState('');
  const [summarizing, setSummarizing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [watiTags, setWatiTags] = useState(null);

  useEffect(() => { loadCandidates(); loadMeta(); }, [currentCompanyId, page, statusFilter]);

  const loadMeta = async () => {
    try {
      const [stgRes] = await Promise.all([settingsApi.getAtsStages()]);
      setStages(stgRes.data);

      const params = currentCompanyId ? { company_id: currentCompanyId, status: 'Open' } : { status: 'Open' };
      const vacRes = await vacanciesApi.getVacancies({ ...params, limit: 100 });
      setVacancies(vacRes.data.data || []);
    } catch { /* ignore */ }
  };

  const loadCandidates = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      const { data } = await candidatesApi.getCandidates(params);
      setCandidates(data.data);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch {
      toast.error('Failed to load candidates');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => { setPage(1); loadCandidates(); };

  const openAdd = () => {
    setEditing(null);
    const defaultCompany = currentCompanyId || (companies.length > 0 ? String(companies[0].id) : '');
    const defaultStage = stages.find(s => s.is_default)?.id || (stages.length > 0 ? stages[0].id : '');
    setForm({
      first_name: '', last_name: '', email: '', phone: '', nationality: '',
      company_id: defaultCompany, vacancy_id: '', current_stage_id: String(defaultStage),
      notes: '', applied_date: dayjs().format('YYYY-MM-DD'),
      cv_text: '', cv_file_name: ''
    });
    setModalOpen(true);
  };

  const openEdit = (c) => {
    setEditing(c);
    setForm({
      first_name: c.first_name || '', last_name: c.last_name || '', email: c.email || '',
      phone: c.phone || '', nationality: c.nationality || '',
      company_id: String(c.company_id) || '', vacancy_id: c.vacancy_id ? String(c.vacancy_id) : '',
      current_stage_id: c.current_stage_id ? String(c.current_stage_id) : '',
      notes: c.notes || '', applied_date: c.applied_date ? dayjs(c.applied_date).format('YYYY-MM-DD') : '',
    });
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.first_name || !form.last_name || !form.company_id) {
      toast.error('First name, last name, and company are required');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        company_id: parseInt(form.company_id),
        vacancy_id: form.vacancy_id ? parseInt(form.vacancy_id) : null,
        current_stage_id: form.current_stage_id ? parseInt(form.current_stage_id) : null,
        applied_date: form.applied_date || null,
      };
      if (editing) {
        await candidatesApi.updateCandidate(editing.id, payload);
        toast.success('Candidate updated');
      } else {
        await candidatesApi.createCandidate(payload);
        toast.success('Candidate added');
      }
      setModalOpen(false);
      loadCandidates();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c) => {
    const result = await confirmDelete(`"${c.first_name} ${c.last_name}"`);
    if (result.isConfirmed) {
      try {
        await candidatesApi.deleteCandidate(c.id);
        toast.success('Candidate deleted');
        loadCandidates();
      } catch {
        toast.error('Delete failed');
      }
    }
  };

  // Move candidate to different stage
  const openMove = (c) => {
    setMoveTarget(c);
    setMoveStageId(c.current_stage_id ? String(c.current_stage_id) : '');
    setMoveNotes('');
    setMoveModalOpen(true);
  };

  const handleMove = async () => {
    if (!moveStageId) { toast.error('Select a stage'); return; }
    setMoving(true);
    try {
      const result = await candidatesApi.moveCandidate(moveTarget.id, {
        stage_id: parseInt(moveStageId), notes: moveNotes,
      });
      const rd = result.data;
      if (rd.is_success) toast.success(`🎉 ${t('recruitment.hired')}`);
      else if (rd.is_fail) toast.info(`${t('recruitment.moved_to')} ${rd.stage}`);
      else toast.success(`${t('recruitment.moved_to')} ${rd.stage}`);
      setMoveModalOpen(false);
      loadCandidates();
    } catch (err) {
      toast.error('Move failed');
    } finally {
      setMoving(false);
    }
  };

  const update = (field, value) => setForm(p => ({ ...p, [field]: value }));

  const openProfile = (c) => {
    setProfileCandidate(c);
    setProfileTab('overview');
    setAiSummary('');
    setProfileOpen(true);
  };

  const handleSummarize = async () => {
    if (!profileCandidate) return;
    setSummarizing(true);
    try {
      const { data } = await aiApi.summarizeCandidate({
        candidate_data: {
          name: `${profileCandidate.first_name} ${profileCandidate.last_name}`,
          email: profileCandidate.email,
          phone: profileCandidate.phone,
          nationality: profileCandidate.nationality,
          vacancy: profileCandidate.vacancy_title,
          stage: profileCandidate.stage_name,
          status: profileCandidate.status,
          notes: profileCandidate.notes,
          applied_date: profileCandidate.applied_date,
          cv_text: profileCandidate.cv_text || '',
        }
      });
      setAiSummary(data.summary);
      setProfileTab('ai');
    } catch {
      setAiSummary(t('recruitment.ai_unavailable'));
      setProfileTab('ai');
    } finally { setSummarizing(false); }
  };

  const handleUploadCV = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profileCandidate) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const { data } = await candidatesApi.uploadCV(profileCandidate.id, fd);
      toast.success(`CV uploaded: ${data.file_name}`);
      if (data.extracted?.email || data.extracted?.phone) {
        toast.info(`Auto-extracted: ${Object.entries(data.extracted).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
      }
      // Re-fetch the candidate from the server to get updated fields (e.g. ai_analysis, cv_text, first_name)
      const { data: updatedCand } = await candidatesApi.getCandidate(profileCandidate.id);
      setProfileCandidate(updatedCand);
      loadCandidates();
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleReadCV = async () => {
    if (!profileCandidate) return;
    setUploading(true);
    const tId = toast.loading('Reading CV and extracting data…');
    try {
      await candidatesApi.parseCandidateCV(profileCandidate.id);
      const { data: updatedCand } = await candidatesApi.getCandidate(profileCandidate.id);
      setProfileCandidate(updatedCand);
      loadCandidates();
      toast.update(tId, { render: 'CV data extracted', type: 'success', isLoading: false, autoClose: 2500 });
    } catch (err) {
      toast.update(tId, { render: err.response?.data?.error || 'Failed to read CV', type: 'error', isLoading: false, autoClose: 3500 });
    } finally { setUploading(false); }
  };

  const handleAutoParseCV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('cv', file);
      const { data } = await candidatesApi.parseCV(fd);
      if (data.success && data.extracted) {
        setForm(prev => ({
          ...prev,
          first_name: data.extracted.first_name || prev.first_name,
          last_name: data.extracted.last_name || prev.last_name,
          email: data.extracted.email || prev.email,
          phone: data.extracted.phone || prev.phone,
          nationality: data.extracted.nationality || prev.nationality,
          cv_text: data.cv_text,
          cv_file_name: data.file_name
        }));
        toast.success(t('recruitment.cv_parsed_success', 'CV parsed and form auto-filled!'));
      }
    } catch {
      toast.error(t('recruitment.cv_parse_failed', 'Failed to parse CV'));
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const loadWatiTags = async (c) => {
    try {
      const { data } = await candidatesApi.getWatiTags(c.id);
      setWatiTags(data);
      setProfileTab('wati');
    } catch { toast.error('Failed to generate tags'); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('recruitment.candidates')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('recruitment.candidates_subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <label className="cursor-pointer bg-brand-50 px-3 py-1.5 rounded-lg border border-brand-200 text-sm font-medium text-brand-700 hover:bg-brand-100 transition-colors shadow-sm flex items-center justify-center">
            <Brain size={16} className="mr-2" /> {t('recruitment.upload_cv', 'Upload CV')} (AI)
            <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={(e) => {
              openAdd();
              setTimeout(() => handleAutoParseCV(e), 100);
            }} />
          </label>
          <Button onClick={openAdd}><Plus size={16} /> {t('recruitment.add_candidate')}</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
          <input
            type="text" placeholder={t('recruitment.search_candidates')}
            value={search} onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus"
          />
        </div>
        <div className="flex gap-1">
          {[{v: '', l: t('recruitment.all_statuses')}, {v: 'Active', l: t('recruitment.active')}, {v: 'Hired', l: t('recruitment.hired')}, {v: 'Failed', l: t('recruitment.failed')}, {v: 'Blacklisted', l: t('recruitment.blacklisted')}].map(s => (
            <button key={s.v} onClick={() => { setStatusFilter(s.v); setPage(1); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                statusFilter === s.v ? 'bg-brand-700 text-white' : 'bg-surface-100 text-surface-600 hover:bg-surface-200'
              }`}>{s.l}</button>
          ))}
        </div>
        <Badge variant="brand">{total} {t('recruitment.candidates_count')}</Badge>
      </div>

      {/* Table */}
      {loading ? (
        <Card className="!p-6 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/2 mb-4" /><div className="h-4 bg-surface-100 rounded w-1/3" /></Card>
      ) : candidates.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-6 h-6 text-surface-400" />}
            title={search || statusFilter ? t('recruitment.no_matching_candidates') : t('recruitment.no_candidates')}
            description={t('recruitment.first_candidate')}
            action={!search && !statusFilter && <Button onClick={openAdd}><Plus size={16} /> {t('recruitment.add_candidate')}</Button>}
          />
        </Card>
      ) : (
        <>
          <Card className="!p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-surface-100 bg-surface-50/60">
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.candidate')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.contact')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.company')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.vacancy')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.stage')}</th>
                    <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.status')}</th>
                    <th className="text-right px-5 py-3 font-medium text-surface-500">{t('recruitment.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {candidates.map((c) => (
                    <tr key={c.id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors group">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-xs shrink-0">
                            {c.first_name?.charAt(0)}{c.last_name?.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-surface-800 cursor-pointer hover:text-brand-600 transition-colors" onClick={() => openProfile(c)}>{c.first_name} {c.last_name}</p>
                            {c.nationality && <p className="text-xs text-surface-400">{c.nationality}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="space-y-0.5">
                          {c.email && <p className="text-xs text-surface-500 flex items-center gap-1"><Mail size={10} /> {c.email}</p>}
                          {c.phone && <p className="text-xs text-surface-500 flex items-center gap-1"><Phone size={10} /> {c.phone}</p>}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded-md text-xs font-medium text-white"
                          style={{ backgroundColor: c.color_primary || '#6D28D9' }}>{c.short_code}</span>
                      </td>
                      <td className="px-5 py-3 text-surface-600 text-xs">{c.vacancy_title || '—'}</td>
                      <td className="px-5 py-3">
                        {c.stage_name ? (
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-semibold"
                            style={{ backgroundColor: c.stage_color, color: c.stage_text_color }}>
                            {c.stage_name}
                          </span>
                        ) : <span className="text-surface-400 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={c.status === 'Active' ? 'active' : c.status === 'Hired' ? 'success' : 'danger'} className="text-[10px]">
                          {t(`recruitment.${c.status.toLowerCase().replace(' ', '_')}`)}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openMove(c)} title="Move Stage"
                            className="p-1.5 text-surface-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <ArrowRight size={14} />
                          </button>
                          {c.email && (
                            <EmailButton
                              variant="icon"
                              size="sm"
                              to={c.email}
                              toName={`${c.first_name} ${c.last_name}`}
                              templateType="candidate_received"
                              templateData={{ applied_position: c.vacancy_title || '' }}
                              relatedModule="candidates"
                              relatedId={c.id}
                              companyId={c.company_id}
                            />
                          )}
                          <button onClick={() => openEdit(c)} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                            <Edit3 size={14} />
                          </button>
                          <button onClick={() => handleDelete(c)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-surface-400">{t('recruitment.page_of', { page, totalPages })} ({total} {t('recruitment.total')})</p>
              <div className="flex gap-1.5">
                <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /> {t('recruitment.prev')}</Button>
                <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>{t('recruitment.next')} <ChevronRight size={14} /></Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Add/Edit Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? t('recruitment.edit_candidate') : t('recruitment.add_candidate')} size="lg">
        <form onSubmit={handleSave} className="space-y-4">
          {!editing && (
            <div className="bg-brand-50 border border-brand-100 rounded-xl p-4 flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-brand-100 flex items-center justify-center text-brand-600">
                  <Brain size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-brand-900">{t('recruitment.auto_parse_cv', 'Auto-Parse CV (AI)')}</h4>
                  <p className="text-xs text-brand-600">{t('recruitment.auto_parse_desc', 'Upload a PDF or DOCX to auto-fill candidate details.')}</p>
                </div>
              </div>
              <label className="cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-brand-200 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors shadow-sm">
                <Upload size={14} className="inline mr-1" /> {t('recruitment.upload_cv', 'Upload CV')}
                <input type="file" className="hidden" accept=".pdf,.doc,.docx,.txt" onChange={handleAutoParseCV} />
              </label>
            </div>
          )}
          {form.cv_file_name && !editing && (
             <p className="text-xs text-emerald-600 font-medium -mt-2 mb-2">✓ {t('recruitment.loaded', 'Loaded:')} {form.cv_file_name}</p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('recruitment.first_name')} required placeholder={t('recruitment.john', 'John')} value={form.first_name} onChange={(e) => update('first_name', e.target.value)} />
            <Input label={t('recruitment.last_name')} required placeholder={t('recruitment.doe', 'Doe')} value={form.last_name} onChange={(e) => update('last_name', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('recruitment.email')} type="email" placeholder={t('recruitment.email_placeholder', 'john@example.com')} value={form.email} onChange={(e) => update('email', e.target.value)} />
            <Input label={t('recruitment.phone')} placeholder={t('recruitment.phone_placeholder', '+971 50 123 4567')} value={form.phone} onChange={(e) => update('phone', e.target.value)} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('recruitment.nationality')} placeholder={t('recruitment.nationality_placeholder', 'e.g. UAE')} value={form.nationality} onChange={(e) => update('nationality', e.target.value)} />
            <Select label={t('recruitment.company')} required value={form.company_id} onChange={(e) => update('company_id', e.target.value)}
              options={companies.map(c => ({ value: String(c.id), label: c.name }))} placeholder={t('recruitment.select_company')} />
            <Input label={t('recruitment.applied_date')} type="date" value={form.applied_date} onChange={(e) => update('applied_date', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select label={t('recruitment.vacancy')} value={form.vacancy_id} onChange={(e) => update('vacancy_id', e.target.value)}
              options={vacancies.filter(v => !form.company_id || v.company_id === parseInt(form.company_id)).map(v => ({ value: String(v.id), label: v.title }))}
              placeholder={t('recruitment.optional')} />
            <Select label={t('recruitment.current_stage')} value={form.current_stage_id} onChange={(e) => update('current_stage_id', e.target.value)}
              options={stages.map(s => ({ value: String(s.id), label: s.name }))} placeholder={t('recruitment.select_stage')} />
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('recruitment.notes')}</label>
            <textarea placeholder={t('recruitment.cand_notes_placeholder', 'Notes about the candidate...')} value={form.notes} onChange={(e) => update('notes', e.target.value)} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{editing ? t('recruitment.save_changes') : t('recruitment.add_candidate')}</Button>
          </div>
        </form>
      </Modal>

      <Modal open={moveModalOpen} onClose={() => setMoveModalOpen(false)} title={`${t('recruitment.move_stage')} ${moveTarget?.first_name} ${moveTarget?.last_name}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-surface-500">{t('recruitment.select_pipeline_stage', 'Select the new pipeline stage:')}</p>
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {stages.map(s => (
              <button
                key={s.id}
                onClick={() => setMoveStageId(String(s.id))}
                className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all text-left ${
                  moveStageId === String(s.id)
                    ? 'ring-2 ring-brand-500'
                    : 'hover:bg-surface-50'
                }`}
              >
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold"
                  style={{ backgroundColor: s.color, color: s.text_color }}>{s.name}</span>
                {s.is_success && <Badge variant="success" className="text-[9px] ml-auto">✓ {t('recruitment.hire')}</Badge>}
                {s.is_fail && <Badge variant="danger" className="text-[9px] ml-auto">✕ {t('recruitment.fail')}</Badge>}
              </button>
            ))}
          </div>
          <div>
            <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('recruitment.notes')} ({t('recruitment.optional').replace('...', '')})</label>
            <textarea placeholder={t('recruitment.move_notes')} value={moveNotes} onChange={(e) => setMoveNotes(e.target.value)} rows={2}
              className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setMoveModalOpen(false)}>{t('common.cancel')}</Button>
            <Button onClick={handleMove} loading={moving}>{t('recruitment.move_stage')}</Button>
          </div>
        </div>
      </Modal>

      {/* Profile View Modal */}
      <Modal open={profileOpen} onClose={() => setProfileOpen(false)} title={profileCandidate ? `${profileCandidate.first_name} ${profileCandidate.last_name}` : t('recruitment.profile')} size="xl">
        {profileCandidate && (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-surface-50 p-1 rounded-xl flex-wrap">
              {[{k:'overview',l:t('recruitment.overview'),i:User},{k:'details',l:t('recruitment.experience_salary'),i:Star},{k:'timeline',l:t('recruitment.timeline'),i:Clock},{k:'notes',l:t('recruitment.notes_tab'),i:FileText},{k:'ai',l:t('recruitment.ai_summary'),i:Brain},{k:'wati',l:t('recruitment.wati_tags'),i:Tag},{k:'cv',l:t('recruitment.cv'),i:Upload}].map(t => (
                <button key={t.k} onClick={() => setProfileTab(t.k)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${profileTab === t.k ? 'bg-brand-700 text-white shadow-sm' : 'text-surface-600 hover:bg-surface-100'}`}>
                  <t.i size={12} /> {t.l}
                </button>
              ))}
              <Button size="sm" className="ml-auto" onClick={handleSummarize} loading={summarizing}>
                <Sparkles size={12} /> {t('recruitment.summarize')}
              </Button>
            </div>

            {/* Overview Tab */}
            {profileTab === 'overview' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-3">
                  <h3 className="font-semibold text-surface-700 text-sm">{t('recruitment.personal_info')}</h3>
                  {[[t('recruitment.name'), `${profileCandidate.first_name} ${profileCandidate.last_name}`],
                    [t('recruitment.email'), profileCandidate.email],[t('recruitment.phone'), profileCandidate.phone],
                    [t('recruitment.nationality'), profileCandidate.nationality],[t('recruitment.applied'), profileCandidate.applied_date ? dayjs(profileCandidate.applied_date).format('MMM D, YYYY') : '—'],
                  ].map(([label, val]) => (
                    <div key={label} className="flex justify-between py-1.5 px-3 bg-surface-50 rounded-lg text-sm">
                      <span className="text-surface-500">{label}</span>
                      <span className="font-medium text-surface-800">{val || '—'}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  <h3 className="font-semibold text-surface-700 text-sm">{t('recruitment.recruitment_info')}</h3>
                  <div className="flex justify-between py-1.5 px-3 bg-surface-50 rounded-lg text-sm">
                    <span className="text-surface-500">{t('recruitment.company')}</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: profileCandidate.color_primary || '#6D28D9' }}>{profileCandidate.short_code}</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 bg-surface-50 rounded-lg text-sm">
                    <span className="text-surface-500">{t('recruitment.vacancy')}</span>
                    <span className="font-medium text-surface-800">{profileCandidate.vacancy_title || '—'}</span>
                  </div>
                  <div className="flex justify-between py-1.5 px-3 bg-surface-50 rounded-lg text-sm">
                    <span className="text-surface-500">{t('recruitment.stage')}</span>
                    {profileCandidate.stage_name ? <span className="px-2 py-0.5 rounded text-[10px] font-semibold" style={{ backgroundColor: profileCandidate.stage_color, color: profileCandidate.stage_text_color }}>{profileCandidate.stage_name}</span> : <span>—</span>}
                  </div>
                  <div className="flex justify-between py-1.5 px-3 bg-surface-50 rounded-lg text-sm">
                    <span className="text-surface-500">{t('recruitment.status')}</span>
                    <Badge variant={profileCandidate.status === 'Active' ? 'active' : profileCandidate.status === 'Hired' ? 'success' : 'danger'} className="text-[10px]">{t(`recruitment.${profileCandidate.status.toLowerCase().replace(' ', '_')}`)}</Badge>
                  </div>
                  {profileCandidate.ai_score && <div className="flex justify-between py-1.5 px-3 bg-surface-50 rounded-lg text-sm">
                    <span className="text-surface-500">{t('recruitment.ai_score')}</span>
                    <span className="font-bold text-brand-700">{profileCandidate.ai_score}%</span>
                  </div>}
                </div>
              </div>
            )}

            {/* Experience & Salary Tab — real parsed CV data only (no fabricated values) */}
            {profileTab === 'details' && (() => {
              let cv = {};
              try { cv = profileCandidate.ai_analysis ? (typeof profileCandidate.ai_analysis === 'string' ? JSON.parse(profileCandidate.ai_analysis) : profileCandidate.ai_analysis) : {}; }
              catch { cv = {}; }
              const work = Array.isArray(cv.work_history) ? cv.work_history : [];
              const edu = Array.isArray(cv.education) ? cv.education : [];
              const skills = Array.isArray(cv.skills) ? cv.skills : [];
              const languages = Array.isArray(cv.languages) ? cv.languages : [];
              const certs = Array.isArray(cv.certifications) ? cv.certifications : [];
              const sal = cv.expected_salary || {};
              const hasSalary = sal && [sal.basic_salary, sal.housing, sal.transport, sal.total_package].some((v) => v && v !== '—');
              const hasAny = work.length || edu.length || skills.length || languages.length || certs.length || hasSalary || cv.summary;

              if (!hasAny) {
                return (
                  <div className="py-10 text-center">
                    <Brain size={28} className="mx-auto text-surface-300 mb-2" />
                    <p className="text-sm text-surface-500 mb-1">No CV data extracted yet.</p>
                    <p className="text-xs text-surface-400 mb-4">{profileCandidate.cv_text ? 'A CV is on file — read it to extract the full profile.' : 'Upload the candidate CV from the CV tab, then read it.'}</p>
                    {profileCandidate.cv_text && (
                      <Button onClick={handleReadCV} loading={uploading}><Sparkles size={15} /> {t('recruitment.read_cv', 'Read CV data')}</Button>
                    )}
                  </div>
                );
              }

              return (
                <div className="space-y-5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    {cv.current_job_title && <p className="text-sm text-surface-600"><span className="text-surface-400">Current title:</span> <strong>{cv.current_job_title}</strong>{cv.total_experience_years ? ` · ${cv.total_experience_years} yrs experience` : ''}</p>}
                    {profileCandidate.cv_text && <Button size="sm" variant="ghost" onClick={handleReadCV} loading={uploading}><Sparkles size={14} /> {t('recruitment.reread_cv', 'Re-read CV')}</Button>}
                  </div>
                  {cv.summary && <p className="text-sm text-surface-600 bg-surface-50 rounded-xl p-3 border border-surface-200">{cv.summary}</p>}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Work History */}
                    <Card className="!p-4 bg-surface-50 border-surface-200">
                      <h3 className="font-semibold text-surface-800 text-sm mb-4 flex items-center gap-2"><Clock size={16} className="text-brand-600"/> {t('recruitment.work_history')}</h3>
                      {work.length === 0 ? <p className="text-xs text-surface-400">Not found in CV.</p> : (
                        <div className="space-y-4 relative before:absolute before:inset-0 before:ml-2 before:-translate-x-px before:h-full before:w-0.5 before:bg-surface-200">
                          {work.map((j, i) => (
                            <div key={i} className="relative pl-6">
                              <div className="absolute left-0 top-1 w-4 h-4 rounded-full border-2 border-brand-500 bg-white" />
                              <h4 className="text-sm font-bold text-surface-800">{j.title}</h4>
                              <div className="text-xs text-brand-600 font-medium">{j.company} <span className="text-surface-400">| {j.duration}</span></div>
                              {j.desc && <p className="text-[10px] text-surface-500 mt-1">{j.desc}</p>}
                              {Array.isArray(j.achievements) && j.achievements.length > 0 && (
                                <ul className="text-[10px] text-surface-500 mt-1 list-disc ml-3.5 space-y-0.5">{j.achievements.map((a, k) => <li key={k}>{a}</li>)}</ul>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>

                    {/* Education */}
                    <Card className="!p-4 bg-surface-50 border-surface-200">
                      <h3 className="font-semibold text-surface-800 text-sm mb-4 flex items-center gap-2"><Star size={16} className="text-brand-600"/> {t('recruitment.education')}</h3>
                      {edu.length === 0 ? <p className="text-xs text-surface-400">Not found in CV.</p> : (
                        <div className="space-y-3">
                          {edu.map((e, i) => (
                            <div key={i} className="bg-white p-3 border border-surface-200 rounded-xl shadow-sm">
                              <h4 className="text-sm font-bold text-surface-800">{e.degree}</h4>
                              {e.school && <div className="text-xs text-surface-500 mt-1">{e.school}</div>}
                              {e.year && <div className="text-[10px] font-medium text-brand-600 mt-1">Graduated: {e.year}</div>}
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* Skills · Languages · Certifications */}
                  {(skills.length > 0 || languages.length > 0 || certs.length > 0) && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {skills.length > 0 && (
                        <Card className="!p-4 bg-surface-50 border-surface-200">
                          <h3 className="font-semibold text-surface-800 text-sm mb-2">Skills</h3>
                          <div className="flex flex-wrap gap-1.5">{skills.map((s, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-brand-50 text-brand-700">{s}</span>)}</div>
                        </Card>
                      )}
                      {languages.length > 0 && (
                        <Card className="!p-4 bg-surface-50 border-surface-200">
                          <h3 className="font-semibold text-surface-800 text-sm mb-2">Languages</h3>
                          <div className="flex flex-wrap gap-1.5">{languages.map((l, i) => <span key={i} className="text-[11px] px-2 py-0.5 rounded-md bg-surface-100 text-surface-600">{l}</span>)}</div>
                        </Card>
                      )}
                      {certs.length > 0 && (
                        <Card className="!p-4 bg-surface-50 border-surface-200">
                          <h3 className="font-semibold text-surface-800 text-sm mb-2">Certifications</h3>
                          <ul className="text-xs text-surface-600 list-disc ml-4 space-y-0.5">{certs.map((c, i) => <li key={i}>{c}</li>)}</ul>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* Salary expectations — only if stated in the CV */}
                  {hasSalary && (
                    <Card className="!p-4 border-emerald-200 bg-emerald-50">
                      <h3 className="font-semibold text-emerald-800 text-sm mb-3 flex items-center gap-2">💰 {t('recruitment.salary_package')} <span className="text-[10px] font-normal text-emerald-600">(as stated in CV)</span></h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[['basic_salary', t('recruitment.basic_salary')], ['housing', t('recruitment.housing')], ['transport', t('recruitment.transport')]].map(([k, label]) => (
                          <div key={k} className="bg-white p-3 rounded-lg border border-emerald-100 text-center">
                            <div className="text-[10px] text-surface-500 uppercase font-semibold">{label}</div>
                            <div className="text-lg font-bold text-emerald-700">{sal[k] || '—'}</div>
                          </div>
                        ))}
                        <div className="bg-emerald-600 p-3 rounded-lg text-center shadow-md">
                          <div className="text-[10px] text-emerald-100 uppercase font-semibold">{t('recruitment.total_package')}</div>
                          <div className="text-lg font-bold text-white">{sal.total_package || '—'}</div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>
              );
            })()}

            {/* Timeline Tab */}
            {profileTab === 'timeline' && (
              <div className="space-y-3">
                <div className="border-l-2 border-brand-200 pl-4 space-y-4">
                  {profileCandidate.applied_date && <div className="relative"><div className="absolute -left-[21px] top-1 w-3 h-3 bg-brand-500 rounded-full" /><p className="text-sm font-medium text-surface-800">{t('recruitment.application_received')}</p><p className="text-xs text-surface-400">{dayjs(profileCandidate.applied_date).format('MMM D, YYYY')}</p></div>}
                  {profileCandidate.stage_name && <div className="relative"><div className="absolute -left-[21px] top-1 w-3 h-3 bg-emerald-500 rounded-full" /><p className="text-sm font-medium text-surface-800">{t('recruitment.current_stage')}: {profileCandidate.stage_name}</p><p className="text-xs text-surface-400">{t('recruitment.status')}: {t(`recruitment.${profileCandidate.status.toLowerCase().replace(' ', '_')}`)}</p></div>}
                  <div className="relative"><div className="absolute -left-[21px] top-1 w-3 h-3 bg-surface-300 rounded-full" /><p className="text-sm font-medium text-surface-800">{t('recruitment.record_created')}</p><p className="text-xs text-surface-400">{dayjs(profileCandidate.created_at).format('MMM D, YYYY h:mm A')}</p></div>
                </div>
              </div>
            )}

            {/* Notes Tab */}
            {profileTab === 'notes' && (
              <div className="space-y-3">
                <div className="bg-surface-50 rounded-xl p-4 min-h-[120px]">
                  <p className="text-sm text-surface-700 whitespace-pre-wrap">{profileCandidate.notes || t('recruitment.no_notes')}</p>
                </div>
              </div>
            )}

            {/* AI Summary Tab */}
            {profileTab === 'ai' && (
              <div className="space-y-3">
                {aiSummary ? (
                  <div className="p-4 bg-gradient-to-br from-brand-50 to-purple-50 border border-brand-200 rounded-xl">
                    <div className="flex items-center gap-2 mb-2"><Sparkles size={14} className="text-brand-600" /><span className="text-xs font-semibold text-brand-700">{t('recruitment.ai_generated_summary')}</span></div>
                    <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">{aiSummary}</p>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Brain size={32} className="mx-auto mb-2 text-surface-300" />
                    <p className="text-sm text-surface-400">{t('recruitment.ai_summary')}</p>
                  </div>
                )}
              </div>
            )}

            {/* WATI Tags Tab */}
            {profileTab === 'wati' && (
              <div className="space-y-3">
                {watiTags ? (
                  <div className="space-y-3">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-xl">
                      <p className="text-xs font-semibold text-green-700 mb-1">{t('recruitment.wati_contact_name')}</p>
                      <p className="text-sm font-medium text-green-900">{watiTags.wati_name}</p>
                      {watiTags.phone && <p className="text-xs text-green-600 mt-0.5">{watiTags.phone}</p>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-surface-600 mb-2">{t('recruitment.generated_tags')}</p>
                      <div className="flex flex-wrap gap-1.5">{watiTags.tags.map((t, i) => <span key={i} className="px-2 py-1 bg-surface-100 text-surface-700 rounded-lg text-[11px] font-mono">{t}</span>)}</div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Tag size={32} className="mx-auto mb-2 text-surface-300" />
                    <p className="text-sm text-surface-400 mb-3">{t('recruitment.generate_tags')}</p>
                    <Button size="sm" onClick={() => loadWatiTags(profileCandidate)}><Tag size={12} /> {t('recruitment.generate_tags')}</Button>
                  </div>
                )}
              </div>
            )}

            {/* CV Tab */}
            {profileTab === 'cv' && (
              <div className="space-y-3">
                <div className="border-2 border-dashed border-surface-200 rounded-xl p-6 text-center">
                  <Upload size={28} className="mx-auto mb-2 text-surface-300" />
                  <p className="text-sm text-surface-500 mb-2">{profileCandidate.cv_file_name ? `${t('recruitment.current_cv')}: ${profileCandidate.cv_file_name}` : t('recruitment.no_cv')}</p>
                  <label className="cursor-pointer">
                    <input type="file" accept=".pdf,.doc,.docx,.txt" className="hidden" onChange={handleUploadCV} />
                    <Button size="sm" as="span" loading={uploading}><Upload size={12} /> {profileCandidate.cv_file_name ? t('recruitment.replace_cv') : t('recruitment.upload_cv')}</Button>
                  </label>
                  <p className="text-[10px] text-surface-400 mt-2">{t('recruitment.supports_formats')}</p>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => { openEdit(profileCandidate); setProfileOpen(false); }}><Edit3 size={14} /> {t('common.edit')}</Button>
              <Button variant="secondary" onClick={() => { openMove(profileCandidate); setProfileOpen(false); }}><ArrowRight size={14} /> {t('recruitment.move_stage')}</Button>
              <Button onClick={() => setProfileOpen(false)}>{t('recruitment.close')}</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
