import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import * as assessmentsApi from '@api/assessmentsApi';
import Button from '@components/ui/Button';
import Badge from '@components/ui/Badge';
import { toast } from 'react-toastify';
import {
  Send, Copy, ClipboardList, PauseCircle, PlayCircle, Ban, ArrowRightCircle,
  ChevronDown, ChevronRight, RefreshCw, AlertTriangle,
} from 'lucide-react';

const STATUS_VARIANT = { Pending: 'pending', InProgress: 'info', Paused: 'warning', Stopped: 'danger', Completed: 'success' };
const FINAL_STATUS_VARIANT = { Passed: 'success', Failed: 'danger', 'HR Review Required': 'warning', 'Assessment Completed': 'info' };
const apiErr = (e, f) => e?.response?.data?.error || f;

export default function AssessmentPanel({ applicationId }) {
  const { t } = useTranslation();
  const [sessions, setSessions] = useState([]);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await assessmentsApi.listSessions(applicationId);
      setSessions(data);
      if (data[0]) {
        const { data: full } = await assessmentsApi.getSession(data[0].id);
        setDetail(full);
      } else {
        setDetail(null);
      }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [applicationId]);

  const copyLink = async (token) => {
    const link = `${window.location.origin}/assessment/${token}`;
    try { await navigator.clipboard.writeText(link); toast.success(t('assessment.link_copied')); }
    catch { window.prompt(t('assessment.copy_link'), link); }
  };

  const send = async () => {
    setBusy(true);
    try {
      const { data } = await assessmentsApi.createSession(applicationId);
      toast.success(t('assessment.session_created'));
      await load();
      await copyLink(data.token);
    } catch (e) { toast.error(apiErr(e, t('assessment.send_failed'))); }
    finally { setBusy(false); }
  };

  const run = async (fn, successMsg) => {
    setBusy(true);
    try { await fn(); if (successMsg) toast.success(successMsg); await load(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
    finally { setBusy(false); }
  };

  if (loading) return null;
  const latest = sessions[0];

  return (
    <div className="pt-2 border-t border-surface-100 space-y-2">
      <h4 className="text-xs font-semibold text-surface-500 uppercase flex items-center gap-1"><ClipboardList size={12} /> {t('assessment.title')}</h4>

      {!latest ? (
        <Button size="sm" variant="ghost" onClick={send} loading={busy}><Send size={13} /> {t('assessment.send_assessment')}</Button>
      ) : (
        <div className="text-sm border border-surface-100 rounded-lg p-2.5 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant={STATUS_VARIANT[latest.status] || 'info'} className="text-[10px]">{latest.status}</Badge>
            {detail?.final_status && <Badge variant={FINAL_STATUS_VARIANT[detail.final_status] || 'info'} className="text-[10px]">{detail.final_status}</Badge>}
            <span className="text-xs text-surface-400">{latest.template_name} v{latest.version_no}</span>
            {latest.status === 'InProgress' && <span className="text-xs text-surface-500">{t('assessment.current_stage_n', { n: latest.current_stage })}</span>}
          </div>

          {detail && (detail.stage1_score != null || detail.stage2_score != null || detail.stage3_score != null) && (
            <div className="flex items-center gap-3 text-xs text-surface-600">
              <span>{t('assessment.stage_score', { n: 1, score: detail.stage1_score ?? '—' })}</span>
              <span>{t('assessment.stage_score', { n: 2, score: detail.stage2_score ?? '—' })}</span>
              <span>{t('assessment.stage_score', { n: 3, score: detail.stage3_score ?? '—' })}</span>
              <span className="font-semibold text-surface-800">{t('assessment.overall_score', { score: detail.overall_score ?? '—' })}</span>
            </div>
          )}

          {detail?.consistency_flag ? (
            <div className="flex items-start gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              <span>{detail.consistency_note || t('assessment.consistency_flagged')}</span>
            </div>
          ) : null}

          <div className="flex items-center gap-2 flex-wrap">
            <Button size="sm" variant="ghost" onClick={() => copyLink(latest.token)}><Copy size={13} /> {t('assessment.copy_link')}</Button>
            {latest.status === 'InProgress' && (
              <Button size="sm" variant="ghost" onClick={() => run(() => assessmentsApi.pauseSession(latest.id), t('assessment.paused_ok'))} loading={busy}>
                <PauseCircle size={13} /> {t('assessment.pause')}
              </Button>
            )}
            {latest.status === 'Paused' && (
              <Button size="sm" variant="ghost" onClick={() => run(() => assessmentsApi.resumeSession(latest.id), t('assessment.resumed_ok'))} loading={busy}>
                <PlayCircle size={13} /> {t('assessment.resume')}
              </Button>
            )}
            {!['Completed', 'Stopped'].includes(latest.status) && (
              <Button size="sm" variant="ghost" onClick={() => run(() => assessmentsApi.stopSession(latest.id), t('assessment.stopped_ok'))} loading={busy}>
                <Ban size={13} /> {t('assessment.stop')}
              </Button>
            )}
            {detail?.final_status === 'HR Review Required' && (
              <Button size="sm" onClick={() => run(() => assessmentsApi.advanceSession(latest.id), t('assessment.advanced_ok'))} loading={busy}>
                <ArrowRightCircle size={13} /> {t('assessment.advance')}
              </Button>
            )}
            <button onClick={() => setReviewOpen((o) => !o)} className="text-xs text-brand-600 hover:underline ml-auto">
              {reviewOpen ? t('assessment.hide_answers') : t('assessment.review_answers')}
            </button>
          </div>

          {reviewOpen && detail && (
            <div className="space-y-2 pt-1">
              {detail.stages.map((stage) => (
                <StageReview
                  key={stage.id}
                  stage={stage}
                  answers={detail.answers}
                  expanded={expandedStage === stage.id}
                  onToggle={() => setExpandedStage((s) => (s === stage.id ? null : stage.id))}
                  onReload={load}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StageReview({ stage, answers, expanded, onToggle, onReload }) {
  const stageAnswers = stage.questions.map((q) => ({ q, a: answers.find((x) => x.question_id === q.id) }));
  return (
    <div className="border border-surface-100 rounded-lg">
      <button onClick={onToggle} className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-surface-700">
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        {stage.name}
      </button>
      {expanded && (
        <div className="px-2.5 pb-2 space-y-2">
          {stageAnswers.map(({ q, a }) => <AnswerRow key={q.id} question={q} answer={a} onReload={onReload} />)}
        </div>
      )}
    </div>
  );
}

function AnswerRow({ question, answer, onReload }) {
  const { t } = useTranslation();
  const [score, setScore] = useState(answer?.hr_override_score ?? '');
  const [note, setNote] = useState(answer?.hr_note || '');
  const [busy, setBusy] = useState(false);

  const reevaluate = async () => {
    setBusy(true);
    try { await assessmentsApi.reevaluateAnswer(answer.id); toast.success(t('assessment.reevaluated_ok')); onReload(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
    finally { setBusy(false); }
  };
  const saveOverride = async () => {
    setBusy(true);
    try { await assessmentsApi.overrideAnswer(answer.id, { hr_override_score: score === '' ? null : Number(score), hr_note: note }); toast.success(t('assessment.override_saved')); onReload(); }
    catch (e) { toast.error(apiErr(e, t('common.operation_failed'))); }
    finally { setBusy(false); }
  };

  const answerText = question.type === 'multiple_choice'
    ? (question.options || []).find((o) => o.key === answer?.selected_option_key)?.text || answer?.selected_option_key || t('assessment.no_answer')
    : (answer?.answer_text || t('assessment.no_answer'));
  const effectiveScore = answer?.hr_override_score ?? answer?.ai_score;

  return (
    <div className="bg-surface-50/60 rounded-lg p-2 space-y-1.5">
      <p className="text-xs font-medium text-surface-700">{question.question_text}</p>
      <p className="text-xs text-surface-600 whitespace-pre-line">{answerText}</p>
      <div className="flex items-center gap-2 flex-wrap text-[11px]">
        <Badge variant={effectiveScore == null ? 'inactive' : 'info'} className="text-[10px]">
          {t('assessment.score_of', { score: effectiveScore ?? '—', weight: question.weight })}
        </Badge>
        {answer?.ai_flagged_review && answer?.hr_override_score == null && <Badge variant="warning" className="text-[10px]">{t('assessment.needs_review')}</Badge>}
      </div>
      {answer?.ai_evaluation && <p className="text-[11px] text-surface-500 italic">{answer.ai_evaluation}</p>}
      {question.type !== 'multiple_choice' && (
        <div className="flex items-center gap-1.5 flex-wrap pt-1">
          <input type="number" min="0" max={question.weight} value={score} onChange={(e) => setScore(e.target.value)}
            placeholder={t('assessment.override_score_ph')} className="w-20 text-xs border border-surface-200 rounded-lg px-2 py-1" />
          <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t('assessment.hr_note_ph')}
            className="flex-1 min-w-[120px] text-xs border border-surface-200 rounded-lg px-2 py-1" />
          <Button size="sm" variant="ghost" onClick={saveOverride} loading={busy}>{t('common.save')}</Button>
          <Button size="sm" variant="ghost" onClick={reevaluate} loading={busy}><RefreshCw size={12} /> {t('assessment.reevaluate')}</Button>
        </div>
      )}
    </div>
  );
}
