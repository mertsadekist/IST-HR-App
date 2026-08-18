import { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import * as assessmentsApi from '@api/assessmentsApi';
import Card from '@components/ui/Card';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import Modal from '@components/ui/Modal';
import Input from '@components/ui/Input';
import Select from '@components/ui/Select';
import EmptyState from '@components/ui/EmptyState';
import { confirmDelete } from '@utils/confirm';
import { toast } from 'react-toastify';
import { Plus, Edit3, Trash2, ClipboardList, Lock, GitBranch } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const QUESTION_TYPES = ['multiple_choice', 'short_answer', 'open_ended', 'scenario'];
const EMPTY_QUESTION = {
  type: 'short_answer', question_text: '', weight: 10, options: [{ key: 'A', text: '' }, { key: 'B', text: '' }],
  correct_option_key: '', expected_answer: '', ai_eval_instructions: '', consistency_pair_question_id: '',
};

function QuestionModal({ open, onClose, stage, editing, earlierQuestions, onSaved }) {
  const { t } = useTranslation();
  const [form, setForm] = useState(EMPTY_QUESTION);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        type: editing.type, question_text: editing.question_text, weight: editing.weight,
        options: editing.options && editing.options.length ? editing.options : EMPTY_QUESTION.options,
        correct_option_key: editing.correct_option_key || '', expected_answer: editing.expected_answer || '',
        ai_eval_instructions: editing.ai_eval_instructions || '',
        consistency_pair_question_id: editing.consistency_pair_question_id ? String(editing.consistency_pair_question_id) : '',
      });
    } else {
      setForm(EMPTY_QUESTION);
    }
  }, [editing, open]);

  const update = (field, value) => setForm((p) => ({ ...p, [field]: value }));
  const updateOption = (idx, value) => setForm((p) => ({ ...p, options: p.options.map((o, i) => (i === idx ? { ...o, text: value } : o)) }));
  const addOption = () => setForm((p) => ({ ...p, options: [...p.options, { key: String.fromCharCode(65 + p.options.length), text: '' }] }));
  const removeOption = (idx) => setForm((p) => ({ ...p, options: p.options.filter((_, i) => i !== idx) }));

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.question_text.trim()) { toast.error(t('assessment.question_text_required')); return; }
    setSaving(true);
    try {
      const payload = {
        type: form.type, question_text: form.question_text, weight: Number(form.weight) || 10,
        options: form.type === 'multiple_choice' ? form.options : null,
        correct_option_key: form.type === 'multiple_choice' ? (form.correct_option_key || null) : null,
        expected_answer: form.expected_answer || null,
        ai_eval_instructions: form.ai_eval_instructions || null,
        consistency_pair_question_id: form.consistency_pair_question_id || null,
      };
      if (editing) await assessmentsApi.updateQuestion(editing.id, payload);
      else await assessmentsApi.createQuestion(stage.id, payload);
      toast.success(t('assessment.question_saved'));
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.delete_failed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={editing ? t('assessment.edit_question') : t('assessment.add_question')} size="lg">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Select
            label={t('assessment.question_type')} value={form.type}
            onChange={(e) => update('type', e.target.value)}
            options={QUESTION_TYPES.map((v) => ({ value: v, label: t(`assessment.type_${v}`) }))}
          />
          <Input label={t('assessment.weight')} type="number" min="1" max="100" value={form.weight} onChange={(e) => update('weight', e.target.value)} />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('assessment.question_text')}</label>
          <textarea value={form.question_text} onChange={(e) => update('question_text', e.target.value)} rows={3}
            className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
        </div>

        {form.type === 'multiple_choice' && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-surface-700">{t('assessment.options')}</label>
            {form.options.map((o, idx) => (
              <div key={o.key} className="flex items-center gap-2">
                <span className="w-6 text-xs font-semibold text-surface-400">{o.key}</span>
                <input value={o.text} onChange={(e) => updateOption(idx, e.target.value)}
                  className="flex-1 px-3 py-2 text-sm bg-white border border-surface-200 rounded-xl input-focus" />
                {form.options.length > 2 && (
                  <button type="button" onClick={() => removeOption(idx)} className="p-1.5 text-surface-400 hover:text-red-600"><Trash2 size={14} /></button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <Button type="button" variant="secondary" size="sm" onClick={addOption}><Plus size={14} /> {t('assessment.add_option')}</Button>
              <Select
                label={t('assessment.correct_option')} value={form.correct_option_key}
                onChange={(e) => update('correct_option_key', e.target.value)}
                options={form.options.map((o) => ({ value: o.key, label: o.key }))}
                containerClassName="w-32"
              />
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('assessment.expected_answer')}</label>
          <textarea value={form.expected_answer} onChange={(e) => update('expected_answer', e.target.value)} rows={2}
            className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-surface-700 mb-1.5">{t('assessment.ai_eval_instructions')}</label>
          <textarea value={form.ai_eval_instructions} onChange={(e) => update('ai_eval_instructions', e.target.value)} rows={2}
            className="w-full px-3 py-2.5 text-sm bg-white border border-surface-200 rounded-xl input-focus transition-all resize-none" />
        </div>

        {earlierQuestions.length > 0 && (
          <Select
            label={t('assessment.consistency_pair')} value={form.consistency_pair_question_id}
            onChange={(e) => update('consistency_pair_question_id', e.target.value)}
            options={[{ value: '', label: t('assessment.none') }, ...earlierQuestions.map((q) => ({ value: String(q.id), label: `${q.stage_name} — ${q.question_text.slice(0, 60)}` }))]}
            placeholder={t('assessment.none')}
          />
        )}

        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" variant="secondary" onClick={onClose}>{t('common.cancel')}</Button>
          <Button type="submit" loading={saving}>{t('assessment.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}

export default function AssessmentTemplateEditor({ open, onClose, vacancy }) {
  const { t } = useTranslation();
  const { user } = useSelector((s) => s.auth);
  const isAdmin = user?.role === 'admin';

  const [template, setTemplate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [activeStageIdx, setActiveStageIdx] = useState(0);
  const [questionModal, setQuestionModal] = useState({ open: false, stage: null, editing: null });

  useEffect(() => { if (open && vacancy) load(); }, [open, vacancy?.id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await assessmentsApi.listTemplates({ vacancy_id: vacancy.id });
      const existing = data.find((tpl) => tpl.status !== 'Archived') || data[0];
      if (!existing) { setTemplate(null); return; }
      const { data: full } = await assessmentsApi.getTemplate(existing.id);
      setTemplate(full);
      setActiveStageIdx(0);
    } catch {
      toast.error(t('assessment.load_failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    setCreating(true);
    try {
      await assessmentsApi.createTemplate({
        vacancy_id: vacancy.id, company_id: vacancy.company_id, name: vacancy.title, position_title: vacancy.title,
      });
      toast.success(t('assessment.template_created'));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || t('assessment.load_failed'));
    } finally {
      setCreating(false);
    }
  };

  const handlePublishVersion = async () => {
    setPublishing(true);
    try {
      await assessmentsApi.publishVersion(template.id, {});
      toast.success(t('assessment.version_published'));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || t('assessment.load_failed'));
    } finally {
      setPublishing(false);
    }
  };

  const handleStageField = async (stage, field, value) => {
    setTemplate((p) => ({ ...p, stages: p.stages.map((s) => (s.id === stage.id ? { ...s, [field]: value } : s)) }));
    try {
      await assessmentsApi.updateStage(stage.id, { [field]: value });
    } catch (err) {
      toast.error(err.response?.data?.error || t('assessment.load_failed'));
      await load();
    }
  };

  const handleDeleteQuestion = async (q) => {
    const result = await confirmDelete(q.question_text.slice(0, 60));
    if (!result.isConfirmed) return;
    try {
      await assessmentsApi.deleteQuestion(q.id);
      toast.success(t('assessment.question_deleted'));
      await load();
    } catch (err) {
      toast.error(err.response?.data?.error || t('common.delete_failed'));
    }
  };

  if (!vacancy) return null;
  const activeStage = template?.stages?.[activeStageIdx] || null;
  const earlierQuestions = template && activeStage
    ? template.stages.filter((s) => s.stage_order < activeStage.stage_order).flatMap((s) => s.questions.map((q) => ({ ...q, stage_name: s.name })))
    : [];

  return (
    <Modal open={open} onClose={onClose} title={`${vacancy.title} — ${t('assessment.template')}`} size="xl">
      {loading ? (
        <div className="h-40 flex items-center justify-center text-surface-400 text-sm">{t('assessment.loading')}</div>
      ) : !template ? (
        <EmptyState
          icon={<ClipboardList className="w-6 h-6 text-surface-400" />}
          title={t('assessment.no_template')}
          description={t('assessment.no_template_desc')}
          action={<Button onClick={handleCreate} loading={creating}><Plus size={16} /> {t('assessment.create_template')}</Button>}
        />
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={template.status === 'Active' ? 'success' : template.status === 'Draft' ? 'pending' : 'inactive'}>{template.status}</Badge>
              <Badge variant="info"><GitBranch size={11} /> v{template.version?.version_no}</Badge>
              {template.locked && <Badge variant="warning"><Lock size={11} /> {t('assessment.locked_notice')}</Badge>}
            </div>
            {template.locked && (
              <Button size="sm" variant="secondary" onClick={handlePublishVersion} loading={publishing}>
                <GitBranch size={14} /> {t('assessment.publish_new_version')}
              </Button>
            )}
          </div>

          {/* Stage tabs */}
          <div className="flex gap-1 border-b border-surface-100">
            {template.stages.map((s, idx) => (
              <button
                key={s.id}
                onClick={() => setActiveStageIdx(idx)}
                className={`px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                  idx === activeStageIdx ? 'border-brand-700 text-brand-700' : 'border-transparent text-surface-500 hover:text-surface-700'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>

          {activeStage && (
            <div className="space-y-4">
              <Card className="!p-4">
                <div className="grid grid-cols-3 gap-3">
                  <Input
                    label={t('assessment.stage_name')} value={activeStage.name} disabled={template.locked}
                    onChange={(e) => handleStageField(activeStage, 'name', e.target.value)}
                  />
                  <Input
                    label={t('assessment.duration_minutes')} type="number" min="1" value={activeStage.duration_minutes} disabled={template.locked}
                    onChange={(e) => handleStageField(activeStage, 'duration_minutes', Number(e.target.value))}
                  />
                  <Input
                    label={t('assessment.passing_score')} type="number" min="0" max={activeStage.max_score} value={activeStage.passing_score} disabled={template.locked}
                    onChange={(e) => handleStageField(activeStage, 'passing_score', Number(e.target.value))}
                  />
                </div>
                <div className="mt-3">
                  <Badge variant={activeStage.questions.reduce((n, q) => n + q.weight, 0) === activeStage.max_score ? 'success' : 'warning'}>
                    {t('assessment.weight_total', { sum: activeStage.questions.reduce((n, q) => n + q.weight, 0), max: activeStage.max_score })}
                  </Badge>
                </div>
              </Card>

              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-surface-700">{t('assessment.questions')}</h3>
                {!template.locked && (
                  <Button size="sm" onClick={() => setQuestionModal({ open: true, stage: activeStage, editing: null })}>
                    <Plus size={14} /> {t('assessment.add_question')}
                  </Button>
                )}
              </div>

              {activeStage.questions.length === 0 ? (
                <p className="text-sm text-surface-400 py-6 text-center">{t('assessment.no_questions')}</p>
              ) : (
                <div className="space-y-2">
                  {activeStage.questions.map((q) => (
                    <Card key={q.id} className="!p-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant="brand">{t(`assessment.type_${q.type}`)}</Badge>
                          <span className="text-xs text-surface-400">{t('assessment.weight')}: {q.weight}</span>
                          {q.consistency_pair_question_id && <Badge variant="warning">{t('assessment.consistency_pair')}</Badge>}
                        </div>
                        <p className="text-sm text-surface-800 truncate">{q.question_text}</p>
                      </div>
                      {!template.locked && (
                        <div className="flex gap-1 shrink-0">
                          <button onClick={() => setQuestionModal({ open: true, stage: activeStage, editing: q })} className="p-1.5 text-surface-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors">
                            <Edit3 size={14} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDeleteQuestion(q)} className="p-1.5 text-surface-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <QuestionModal
        open={questionModal.open}
        onClose={() => setQuestionModal({ open: false, stage: null, editing: null })}
        stage={questionModal.stage}
        editing={questionModal.editing}
        earlierQuestions={earlierQuestions}
        onSaved={() => { setQuestionModal({ open: false, stage: null, editing: null }); load(); }}
      />
    </Modal>
  );
}
