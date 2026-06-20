import { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import * as candidatesApi from '@api/candidatesApi';
import * as settingsApi from '@api/settingsApi';
import * as vacanciesApi from '@api/vacanciesApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { toast } from 'react-toastify';
import { Users, Phone, Mail, ArrowRight, GripVertical, Kanban, Filter, RefreshCw } from 'lucide-react';
import { useTranslation } from 'react-i18next';

export default function AtsPipeline() {
  const { t } = useTranslation();
  const { items: companies } = useSelector((s) => s.companies);
  const { currentCompanyId } = useSelector((s) => s.entity);

  const [stages, setStages] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vacancies, setVacancies] = useState([]);
  const [vacancyFilter, setVacancyFilter] = useState('');
  const [dragging, setDragging] = useState(null);
  const [dragOver, setDragOver] = useState(null);

  useEffect(() => { loadAll(); }, [currentCompanyId, vacancyFilter]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [stgRes] = await Promise.all([settingsApi.getAtsStages()]);
      setStages(stgRes.data.filter(s => s.status === 'Active'));

      const params = { limit: 500, status: 'Active' };
      if (currentCompanyId) params.company_id = currentCompanyId;
      if (vacancyFilter) params.vacancy_id = vacancyFilter;
      const candRes = await candidatesApi.getCandidates(params);
      setCandidates(candRes.data.data || []);

      const vacParams = currentCompanyId ? { company_id: currentCompanyId, limit: 100 } : { limit: 100 };
      const vacRes = await vacanciesApi.getVacancies(vacParams);
      setVacancies(vacRes.data.data || []);
    } catch (err) {
      toast.error(t('toasts.t_failed_to_load_pipeline'));
    } finally {
      setLoading(false);
    }
  };

  // Drag and Drop handlers
  const handleDragStart = (e, candidate) => {
    setDragging(candidate);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', candidate.id);
  };

  const handleDragOver = (e, stageId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(stageId);
  };

  const handleDragLeave = () => {
    setDragOver(null);
  };

  const handleDrop = async (e, stageId) => {
    e.preventDefault();
    setDragOver(null);
    if (!dragging || dragging.current_stage_id === stageId) { setDragging(null); return; }

    const stage = stages.find(s => s.id === stageId);
    try {
      const result = await candidatesApi.moveCandidate(dragging.id, { stage_id: stageId });
      const rd = result.data;
      if (rd.is_success) toast.success(`🎉 ${dragging.first_name} ${dragging.last_name} ${t('recruitment.hired')}`);
      else if (rd.is_fail) toast.info(`${dragging.first_name} ${t('recruitment.moved_to').toLowerCase()} ${stage.name}`);
      else toast.success(`${t('recruitment.moved_to')} ${stage.name}`);
      loadAll();
    } catch (err) {
      toast.error(t('toasts.t_failed_to_move_candidate'));
    }
    setDragging(null);
  };

  const getCandidatesForStage = (stageId) => {
    return candidates.filter(c => c.current_stage_id === stageId);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div><h1 className="text-2xl font-bold text-surface-900">{t('recruitment.ats_pipeline')}</h1></div>
        </div>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="w-72 shrink-0 animate-pulse">
              <div className="h-8 bg-surface-200 rounded-xl mb-3" />
              <div className="space-y-2">
                <div className="h-24 bg-surface-100 rounded-xl" />
                <div className="h-24 bg-surface-100 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-surface-900">{t('recruitment.ats_pipeline')}</h1>
          <p className="text-surface-500 mt-0.5 text-sm">{t('recruitment.ats_pipeline_desc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={vacancyFilter}
            onChange={(e) => setVacancyFilter(e.target.value)}
            options={[{ value: '', label: t('recruitment.all_vacancies') }, ...vacancies.map(v => ({ value: String(v.id), label: v.title }))]}
            className="!w-52"
          />
          <Button variant="secondary" onClick={loadAll}><RefreshCw size={14} /> {t('recruitment.refresh')}</Button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="brand">{candidates.length} {t('recruitment.candidates_count')}</Badge>
        <Badge variant="info">{stages.length} {t('recruitment.stages_count')}</Badge>
        {vacancyFilter && <Badge variant="warning">{t('recruitment.filtered_by_vacancy')}</Badge>}
      </div>

      {/* Kanban Board */}
      <div className="flex gap-4 overflow-x-auto pb-6 -mx-6 px-6" style={{ minHeight: '60vh' }}>
        {stages.map((stage) => {
          const stageCandidates = getCandidatesForStage(stage.id);
          const isOver = dragOver === stage.id;
          return (
            <div
              key={stage.id}
              className={`w-72 shrink-0 flex flex-col transition-all duration-200 ${isOver ? 'scale-[1.02]' : ''}`}
              onDragOver={(e) => handleDragOver(e, stage.id)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, stage.id)}
            >
              {/* Stage header */}
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl mb-2.5 shadow-sm"
                style={{ backgroundColor: stage.color }}
              >
                <span className="text-xs font-bold" style={{ color: stage.text_color }}>{stage.name}</span>
                <span className="ml-auto w-5 h-5 rounded-full bg-white/30 flex items-center justify-center text-[10px] font-bold" style={{ color: stage.text_color }}>
                  {stageCandidates.length}
                </span>
                {stage.is_success && <span className="text-[10px]">✅</span>}
                {stage.is_fail && <span className="text-[10px]">❌</span>}
              </div>

              {/* Cards container */}
              <div
                className={`flex-1 space-y-2 p-1.5 rounded-xl transition-all min-h-[100px] ${
                  isOver ? 'bg-brand-50/50 ring-2 ring-brand-300 ring-dashed' : 'bg-surface-50/50'
                }`}
              >
                {stageCandidates.length === 0 ? (
                  <div className="text-center py-8 text-xs text-surface-400">
                    {t('recruitment.drop_candidates_here')}
                  </div>
                ) : (
                  stageCandidates.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, c)}
                      className={`bg-white rounded-xl p-3 shadow-sm border border-surface-100 cursor-grab active:cursor-grabbing
                        hover:shadow-md hover:border-brand-200 transition-all group
                        ${dragging?.id === c.id ? 'opacity-40 scale-95' : ''}`}
                    >
                      <div className="flex items-start gap-2">
                        <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center text-brand-700 font-semibold text-[10px] shrink-0">
                          {c.first_name?.charAt(0)}{c.last_name?.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-surface-800 text-xs truncate">{c.first_name} {c.last_name}</p>
                          {c.vacancy_title && (
                            <p className="text-[10px] text-surface-400 truncate">{c.vacancy_title}</p>
                          )}
                        </div>
                        {c.ai_score && (
                          <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                            {Number(c.ai_score).toFixed(0)}%
                          </span>
                        )}
                      </div>
                      {/* Contact info */}
                      <div className="mt-2 space-y-0.5">
                        {c.email && <p className="text-[10px] text-surface-400 flex items-center gap-1 truncate"><Mail size={9} /> {c.email}</p>}
                        {c.phone && <p className="text-[10px] text-surface-400 flex items-center gap-1"><Phone size={9} /> {c.phone}</p>}
                      </div>
                      {/* Company badge */}
                      <div className="mt-2 flex items-center gap-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white"
                          style={{ backgroundColor: c.color_primary || '#6D28D9' }}>{c.short_code}</span>
                        {c.nationality && <span className="text-[9px] text-surface-400">{c.nationality}</span>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
