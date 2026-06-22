import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as cvScorerApi from '@api/cvScorerApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Brain, Plus, Zap, FileSearch, MessageSquare, FileText, Trash2, Loader2, ChevronDown, ChevronUp, Star } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function CVScorer() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin'; // delete is admin-only
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [questions, setQuestions] = useState(null);
  const [jd, setJD] = useState(null);
  const [genLoading, setGenLoading] = useState('');

  // Profile form
  const [profileModal, setProfileModal] = useState(false);
  const [profileForm, setProfileForm] = useState({
    title: '', company_id: '', department: '', seniority: '', min_years_exp: '',
    must_have_skills: '', nice_have_skills: '', salary_range: '',
  });
  const [saving, setSaving] = useState(false);

  // Expandable profile
  const [expanded, setExpanded] = useState(null);

  useEffect(() => { loadProfiles(); }, [currentCompanyId]);

  const loadProfiles = async () => {
    setLoading(true);
    try {
      const params = currentCompanyId ? { company_id: currentCompanyId } : {};
      const { data } = await cvScorerApi.getProfiles(params);
      setProfiles(data);
    } catch { toast.error(t('common.failed_load')); }
    finally { setLoading(false); }
  };

  const handleCreateProfile = async (e) => {
    e.preventDefault();
    if (!profileForm.title) { toast.error(t('toasts.t_title_required')); return; }
    setSaving(true);
    try {
      const data = {
        ...profileForm,
        company_id: profileForm.company_id ? parseInt(profileForm.company_id) : null,
        min_years_exp: profileForm.min_years_exp ? parseInt(profileForm.min_years_exp) : 0,
        must_have_skills: profileForm.must_have_skills ? profileForm.must_have_skills.split(',').map(s => s.trim()).filter(Boolean) : [],
        nice_have_skills: profileForm.nice_have_skills ? profileForm.nice_have_skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      };
      await cvScorerApi.createProfile(data);
      toast.success(t('toasts.t_vacancy_profile_created'));
      setProfileModal(false);
      loadProfiles();
    } catch { toast.error(t('common.error')); }
    finally { setSaving(false); }
  };

  const handleScore = async (profile) => {
    setScoring(true);
    setResults(null);
    try {
      const { data } = await cvScorerApi.scoreCandidates({ profile_id: profile.id });
      setResults(data);
      toast.success(`${t('recruitment.candidates_scored')} ${data.results?.length || 0}`);
    } catch { toast.error(t('toasts.t_scoring_failed')); }
    finally { setScoring(false); }
  };

  const handleGenerateQuestions = async (profile) => {
    setGenLoading('questions');
    try {
      const skills = typeof profile.must_have_skills === 'string' ? JSON.parse(profile.must_have_skills) : (profile.must_have_skills || []);
      const { data } = await cvScorerApi.generateQuestions({ profile_title: profile.title, skills, seniority: profile.seniority });
      setQuestions(data.questions);
    } catch { toast.error(t('common.error')); }
    finally { setGenLoading(''); }
  };

  const handleGenerateJD = async (profile) => {
    setGenLoading('jd');
    try {
      const skills = typeof profile.must_have_skills === 'string' ? JSON.parse(profile.must_have_skills) : (profile.must_have_skills || []);
      const { data } = await cvScorerApi.generateJD({ title: profile.title, department: profile.department, must_have_skills: skills, seniority: profile.seniority });
      setJD(data.jd);
    } catch { toast.error(t('common.error')); }
    finally { setGenLoading(''); }
  };

  const handleDelete = async (profile) => {
    const r = await confirmDelete(`profile "${profile.title}"`);
    if (r.isConfirmed) { try { await cvScorerApi.deleteProfile(profile.id); toast.success(t('common.deleted')); loadProfiles(); } catch { toast.error(t('common.error')); } }
  };

  const parseSkills = (val) => {
    if (!val) return [];
    if (typeof val === 'string') { try { return JSON.parse(val); } catch { return []; } }
    return val;
  };

  const fitColor = (level) => {
    if (!level) return 'info';
    if (level.includes('Strong')) return 'success';
    if (level.includes('Good')) return 'brand';
    if (level.includes('Partial')) return 'warning';
    return 'danger';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold text-surface-900">{t('recruitment.cv_scorer')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('recruitment.cv_scorer_desc')}</p></div>
        <Button onClick={() => { setProfileForm({ title: '', company_id: currentCompanyId ? String(currentCompanyId) : '', department: '', seniority: '', min_years_exp: '', must_have_skills: '', nice_have_skills: '', salary_range: '' }); setProfileModal(true); }}>
          <Plus size={16} /> {t('recruitment.new_vacancy_profile')}
        </Button>
      </div>

      {/* Profiles */}
      {loading ? (
        <div className="space-y-3">{[1,2].map(i => <Card key={i} className="!p-4 animate-pulse"><div className="h-4 bg-surface-200 rounded w-1/3 mb-2" /><div className="h-3 bg-surface-100 rounded w-2/3" /></Card>)}</div>
      ) : profiles.length === 0 ? (
        <Card><EmptyState icon={<Brain className="w-6 h-6 text-surface-400" />} title={t('recruitment.no_profiles')} description={t('recruitment.no_profiles_desc')}
          action={<Button onClick={() => setProfileModal(true)}><Plus size={16} /> {t('recruitment.create_profile')}</Button>} /></Card>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => {
            const skills = parseSkills(p.must_have_skills);
            const niceSkills = parseSkills(p.nice_have_skills);
            const isExpanded = expanded === p.id;
            return (
              <Card key={p.id} className="!p-0 overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-surface-800">{p.title}</h3>
                        {p.short_code && <span className="px-2 py-0.5 rounded text-[10px] font-medium text-white" style={{ backgroundColor: '#6D28D9' }}>{p.short_code}</span>}
                      </div>
                      <div className="flex gap-3 mt-1.5 text-xs text-surface-400 flex-wrap">
                        {p.department && <span>{p.department}</span>}
                        {p.seniority && <span>• {p.seniority}</span>}
                        {p.min_years_exp > 0 && <span>• {p.min_years_exp}+ {t('recruitment.years')}</span>}
                        {p.salary_range && <span>• {p.salary_range}</span>}
                      </div>
                      {skills.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">{skills.map((s, i) => <Badge key={i} variant="brand" className="text-[9px]">{s}</Badge>)}</div>
                      )}
                    </div>
                    <div className="flex gap-1.5 ml-3">
                      <Button size="sm" onClick={() => handleScore(p)} loading={scoring}><Zap size={13} /> {t('recruitment.score')}</Button>
                      <Button size="sm" variant="secondary" onClick={() => handleGenerateQuestions(p)} loading={genLoading === 'questions'}><MessageSquare size={13} /></Button>
                      <Button size="sm" variant="secondary" onClick={() => handleGenerateJD(p)} loading={genLoading === 'jd'}><FileText size={13} /></Button>
                      <button onClick={() => setExpanded(isExpanded ? null : p.id)} className="p-2 text-surface-400 hover:text-surface-600 hover:bg-surface-100 rounded-lg transition-colors">
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </button>
                      {isAdmin && <button onClick={() => handleDelete(p)} className="p-2 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>}
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="border-t border-surface-100 bg-surface-50/50 p-5 text-xs text-surface-600 space-y-2">
                    {niceSkills.length > 0 && <div><span className="font-medium text-surface-700">{t('recruitment.nice_to_have', 'Nice to have')}:</span> {niceSkills.join(', ')}</div>}
                    <div className="flex gap-6">
                      {p.location && <span><b>{t('recruitment.location', 'Location')}:</b> {p.location}</span>}
                      {p.employment_type && <span><b>{t('recruitment.type', 'Type')}:</b> {p.employment_type}</span>}
                      {p.reports_to && <span><b>{t('recruitment.reports_to', 'Reports to')}:</b> {p.reports_to}</span>}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Scoring Results */}
      {results && (
        <Card className="!p-0 overflow-hidden">
          <div className="p-5 border-b border-surface-100 bg-gradient-to-r from-brand-50/50 to-transparent">
            <h2 className="font-semibold text-surface-800 flex items-center gap-2"><FileSearch size={18} className="text-brand-500" /> {t('recruitment.scoring_results')} — {results.profile}</h2>
            <p className="text-xs text-surface-400 mt-0.5">{results.results?.length || 0} {t('recruitment.candidates_scored')}</p>
          </div>
          {results.results?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead><tr className="border-b border-surface-100 bg-surface-50/60">
                  <th className="text-left px-5 py-3 font-medium text-surface-500 w-8">#</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.candidate')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.score')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.fit_level')}</th>
                  <th className="text-left px-5 py-3 font-medium text-surface-500">{t('recruitment.summary')}</th>
                </tr></thead>
                <tbody>
                  {results.results.map((r, i) => (
                    <tr key={r.candidate_id} className="border-b border-surface-50 hover:bg-surface-50/50 transition-colors">
                      <td className="px-5 py-3 text-surface-400 text-xs">{i + 1}</td>
                      <td className="px-5 py-3 font-medium text-surface-800">{r.name}</td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-2 bg-surface-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${r.score?.overall || r.score?.score || 0}%`, backgroundColor: (r.score?.overall || r.score?.score || 0) >= 70 ? '#059669' : (r.score?.overall || r.score?.score || 0) >= 50 ? '#d97706' : '#dc2626' }} />
                          </div>
                          <span className="font-bold text-sm" style={{ color: (r.score?.overall || r.score?.score || 0) >= 70 ? '#059669' : (r.score?.overall || r.score?.score || 0) >= 50 ? '#d97706' : '#dc2626' }}>
                            {r.score?.overall || r.score?.score || 0}%
                          </span>
                        </div>
                      </td>
                      <td className="px-5 py-3"><Badge variant={fitColor(r.score?.fit_level)} className="text-[10px]">{r.score?.fit_level || '—'}</Badge></td>
                      <td className="px-5 py-3 text-xs text-surface-500 max-w-xs truncate">{r.score?.summary || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-6 text-center text-surface-400 text-sm">{t('recruitment.no_candidates_to_score')}</div>
          )}
        </Card>
      )}

      {/* Questions Modal */}
      <Modal open={!!questions} onClose={() => setQuestions(null)} title={t('recruitment.ai_interview_questions')} size="lg">
        {questions && (
          <div className="space-y-3 max-h-[60vh] overflow-y-auto">
            {(Array.isArray(questions) ? questions : questions?.questions || [String(questions)]).map((q, i) => (
              <div key={i} className="p-3 bg-surface-50 rounded-xl">
                <p className="text-sm font-medium text-surface-800">{typeof q === 'object' ? q.question : q}</p>
                {q?.type && <Badge variant="info" className="text-[9px] mt-1">{q.type}</Badge>}
                {q?.what_to_look_for && <p className="text-[10px] text-surface-400 mt-1">💡 {q.what_to_look_for}</p>}
              </div>
            ))}
          </div>
        )}
      </Modal>

      {/* JD Modal */}
      <Modal open={!!jd} onClose={() => setJD(null)} title={t('recruitment.ai_job_description')} size="lg">
        {jd && (
          <div className="space-y-3">
            <div className="bg-white border border-surface-200 rounded-xl p-6 text-sm whitespace-pre-wrap max-h-[60vh] overflow-y-auto leading-relaxed">{jd}</div>
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => { navigator.clipboard.writeText(jd); toast.success(t('recruitment.copied')); }}>{t('recruitment.copy')}</Button>
              <Button onClick={() => setJD(null)}>{t('recruitment.close')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Create Profile Modal */}
      <Modal open={profileModal} onClose={() => setProfileModal(false)} title={t('recruitment.create_profile')} size="lg">
        <form onSubmit={handleCreateProfile} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label={t('recruitment.job_title')} required placeholder={t('recruitment.title_scorer_placeholder', 'e.g. Senior Developer')} value={profileForm.title} onChange={(e) => setProfileForm(p => ({ ...p, title: e.target.value }))} />
            <Select label={t('lifecycle.company')} value={profileForm.company_id} onChange={(e) => setProfileForm(p => ({ ...p, company_id: e.target.value }))}
              options={companies.map(c => ({ value: String(c.id), label: c.name }))} placeholder={t('recruitment.select_placeholder', 'Select...')} />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <Input label={t('recruitment.department')} placeholder={t('recruitment.dept_placeholder', 'e.g. Engineering')} value={profileForm.department} onChange={(e) => setProfileForm(p => ({ ...p, department: e.target.value }))} />
            <Select label={t('recruitment.seniority')} value={profileForm.seniority} onChange={(e) => setProfileForm(p => ({ ...p, seniority: e.target.value }))}
              options={['Junior', 'Mid-Level', 'Senior', 'Lead', 'Manager', 'Director', 'C-Level']} placeholder={t('recruitment.select_placeholder', 'Select...')} />
            <Input label={t('recruitment.min_years_exp')} type="number" placeholder="0" value={profileForm.min_years_exp} onChange={(e) => setProfileForm(p => ({ ...p, min_years_exp: e.target.value }))} />
          </div>
          <Input label={t('recruitment.must_have_skills')} placeholder={t('recruitment.must_skills_placeholder', 'React, Node.js, TypeScript')} value={profileForm.must_have_skills} onChange={(e) => setProfileForm(p => ({ ...p, must_have_skills: e.target.value }))} />
          <Input label={t('recruitment.nice_have_skills')} placeholder={t('recruitment.nice_skills_placeholder', 'AWS, Docker, GraphQL')} value={profileForm.nice_have_skills} onChange={(e) => setProfileForm(p => ({ ...p, nice_have_skills: e.target.value }))} />
          <Input label={t('recruitment.salary_range')} placeholder={t('recruitment.salary_placeholder', 'e.g. 15,000-25,000 AED')} value={profileForm.salary_range} onChange={(e) => setProfileForm(p => ({ ...p, salary_range: e.target.value }))} />
          <div className="p-3 bg-brand-50 border border-brand-200 rounded-xl text-xs text-brand-700">
            {t('recruitment.ai_warning')}
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={() => setProfileModal(false)}>{t('common.cancel')}</Button>
            <Button type="submit" loading={saving}>{t('recruitment.create_profile')}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
