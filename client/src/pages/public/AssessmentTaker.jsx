import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as publicApi from '@api/publicApi';
import CountdownTimer from '@components/CountdownTimer';
import { Loader2, AlertCircle, CheckCircle2, Clock, PauseCircle } from 'lucide-react';

const apiErr = (e, f) => e?.response?.data?.error || f;
const Center = ({ children }) => <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">{children}</div>;

export default function AssessmentTaker() {
  const { t } = useTranslation();
  const { token } = useParams();

  const [step, setStep] = useState('loading'); // loading · error · intro · countdown · stage · paused · result
  const [data, setData] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [qIndex, setQIndex] = useState(0);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState(null);
  const submittedRef = useRef(false);
  const saveTimers = useRef({});

  const load = useCallback(async () => {
    try {
      const { data: d } = await publicApi.getAssessment(token);
      setData(d);
      setAnswers(d.answers || {});
      setQIndex(0);
      setConfirmError(null);
      submittedRef.current = false;
      if (d.status === 'Pending') setStep('intro');
      else if (d.status === 'InProgress') setStep('stage');
      else if (d.status === 'Paused') setStep('paused');
      else {
        const { data: r } = await publicApi.getAssessmentResult(token);
        setResult(r);
        setStep('result');
      }
    } catch (e) {
      setError(apiErr(e, t('assessment.error_generic')));
      setStep('error');
    }
  }, [token, t]);

  useEffect(() => { load(); }, [load]);

  const beginCountdown = () => setStep('countdown');
  const handleCountdownExpire = useCallback(async () => {
    try {
      await publicApi.startAssessment(token);
      await load();
    } catch (e) {
      setError(apiErr(e, t('assessment.error_generic')));
      setStep('error');
    }
  }, [token, load, t]);

  const updateAnswer = (question, patch) => {
    // Editing after a confirm un-confirms it locally too — a confirmation only
    // means something for the content the applicant actually saw when they gave it.
    setAnswers((p) => ({ ...p, [question.id]: { ...p[question.id], ...patch, confirmed: false } }));
    setConfirmError(null);
    clearTimeout(saveTimers.current[question.id]);
    saveTimers.current[question.id] = setTimeout(() => {
      publicApi.saveAssessmentAnswer(token, question.id, patch).catch(() => {});
    }, 700);
  };

  const confirmCurrent = async () => {
    const q = data.stage.questions[qIndex];
    const patch = q.type === 'multiple_choice'
      ? { selected_option_key: answers[q.id]?.selected_option_key }
      : { answer_text: answers[q.id]?.answer_text };
    const hasContent = q.type === 'multiple_choice' ? !!patch.selected_option_key : !!(patch.answer_text && patch.answer_text.trim());
    if (!hasContent) { setConfirmError(t('assessment.confirm_needs_answer')); return; }
    setConfirming(true);
    setConfirmError(null);
    try {
      await publicApi.confirmAssessmentAnswer(token, q.id, patch);
      setAnswers((p) => ({ ...p, [q.id]: { ...p[q.id], confirmed: true } }));
    } catch (e) {
      setConfirmError(apiErr(e, t('assessment.error_generic')));
    } finally {
      setConfirming(false);
    }
  };

  const submitStage = useCallback(async (force = false) => {
    if (submittedRef.current) return;
    if (!force) {
      const firstUnconfirmed = data.stage.questions.findIndex((q) => !answers[q.id]?.confirmed);
      if (firstUnconfirmed !== -1) {
        setQIndex(firstUnconfirmed);
        setConfirmError(t('assessment.confirm_all_first'));
        return;
      }
    }
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const { data: r } = await publicApi.submitAssessmentStage(token, data.stage.stage_order, force ? { force: true } : undefined);
      if (r.completed) {
        const { data: res } = await publicApi.getAssessmentResult(token);
        setResult(res);
        setStep('result');
      } else {
        await load();
      }
    } catch (e) {
      submittedRef.current = false;
      const unconfirmed = e.response?.data?.unconfirmed;
      if (unconfirmed?.length) {
        const idx = data.stage.questions.findIndex((q) => q.question_order === unconfirmed[0]);
        if (idx !== -1) setQIndex(idx);
        setConfirmError(t('assessment.confirm_all_first'));
      } else {
        setError(apiErr(e, t('assessment.error_generic')));
      }
    } finally {
      setSubmitting(false);
    }
  }, [token, data, answers, load, t]);

  if (step === 'loading') return <Center><Loader2 className="w-8 h-8 animate-spin text-violet-600" /></Center>;
  if (step === 'error') return <Center><div className="text-center max-w-sm"><AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-2" /><p className="text-slate-600">{error}</p></div></Center>;

  if (step === 'intro') {
    return (
      <Center>
        <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-lg w-full">
          <h1 className="text-xl font-bold text-slate-900">{data.applicant_name}</h1>
          <p className="text-slate-500 text-sm mt-0.5">{data.position_title}</p>
          <div className="mt-4 p-3 bg-slate-50 rounded-xl text-sm text-slate-600">{t('assessment.instructions_body')}</div>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {data.stage_overview.map((s) => (
              <li key={s.stage_order} className="flex items-center justify-between">
                <span>{t('assessment.current_stage_n', { n: s.stage_order })} — {s.name}</span>
                <span className="text-slate-400 inline-flex items-center gap-1"><Clock size={12} /> {s.duration_minutes}m</span>
              </li>
            ))}
          </ul>
          <button
            onClick={beginCountdown}
            className="mt-5 w-full py-2.5 rounded-xl text-white font-medium bg-violet-600 hover:bg-violet-700 transition-colors"
          >
            {t('assessment.start_assessment')}
          </button>
        </div>
      </Center>
    );
  }

  if (step === 'countdown') {
    return (
      <Center>
        <div className="text-center">
          <p className="text-slate-500 mb-2">{t('assessment.get_ready')}</p>
          <CountdownTimer
            seconds={5}
            onExpire={handleCountdownExpire}
            className="text-6xl font-bold text-violet-600 tabular-nums"
          />
        </div>
      </Center>
    );
  }

  if (step === 'paused') {
    return (
      <Center>
        <div className="text-center max-w-sm">
          <PauseCircle className="w-10 h-10 text-amber-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-slate-800">{t('assessment.paused_title')}</h2>
          <p className="text-slate-500 text-sm mt-1">{t('assessment.paused_body')}</p>
        </div>
      </Center>
    );
  }

  if (step === 'result') {
    const map = {
      Passed: ['result_passed_title', 'result_passed_body'],
      'HR Review Required': ['result_hr_review_title', 'result_hr_review_body'],
      Failed: ['result_failed_title', 'result_failed_body'],
      'Assessment Completed': ['result_completed_title', 'result_completed_body'],
    };
    const [titleKey, bodyKey] = map[result?.final_status] || map['Assessment Completed'];
    return (
      <Center>
        <div className="text-center max-w-sm">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
          <h2 className="text-lg font-semibold text-slate-800">{t(`assessment.${titleKey}`)}</h2>
          <p className="text-slate-500 text-sm mt-1">{t(`assessment.${bodyKey}`)}</p>
        </div>
      </Center>
    );
  }

  // step === 'stage'
  const stage = data.stage;
  const q = stage.questions[qIndex];
  const isConfirmed = !!answers[q.id]?.confirmed;
  const confirmedCount = stage.questions.filter((qq) => answers[qq.id]?.confirmed).length;
  const isLast = qIndex === stage.questions.length - 1;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{t('assessment.current_stage_n', { n: stage.stage_order })} — {stage.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">
              {t('assessment.question_progress', { current: qIndex + 1, total: stage.questions.length })}
              {' · '}
              {t('assessment.confirmed_progress', { confirmed: confirmedCount, total: stage.questions.length })}
            </p>
          </div>
          <CountdownTimer deadlineAt={data.stage_deadline_at} onExpire={() => submitStage(true)} className="text-lg font-bold text-violet-600 tabular-nums shrink-0" />
        </div>
        <div className="max-w-2xl mx-auto mt-2 flex gap-1">
          {stage.questions.map((qq, i) => (
            <button
              key={qq.id}
              type="button"
              onClick={() => setQIndex(i)}
              aria-label={t('assessment.question_progress', { current: i + 1, total: stage.questions.length })}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                answers[qq.id]?.confirmed ? 'bg-emerald-500' : i === qIndex ? 'bg-violet-500' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-4">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="text-sm font-medium text-slate-800">{qIndex + 1}. {q.question_text}</p>
            {isConfirmed && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-600 shrink-0">
                <CheckCircle2 size={14} /> {t('assessment.confirmed')}
              </span>
            )}
          </div>

          {q.type === 'multiple_choice' ? (
            <div className="space-y-2">
              {(q.options || []).map((o) => (
                <label key={o.key} className={`block px-3 py-2 rounded-xl border text-sm cursor-pointer transition-colors ${
                  answers[q.id]?.selected_option_key === o.key ? 'border-violet-500 bg-violet-50' : 'border-slate-200 hover:bg-slate-50'
                }`}>
                  <input
                    type="radio" name={`q_${q.id}`} className="mr-2"
                    checked={answers[q.id]?.selected_option_key === o.key}
                    onChange={() => updateAnswer(q, { selected_option_key: o.key })}
                  />
                  {o.text}
                </label>
              ))}
            </div>
          ) : (
            <textarea
              rows={7}
              value={answers[q.id]?.answer_text || ''}
              onChange={(e) => updateAnswer(q, { answer_text: e.target.value })}
              placeholder={t('assessment.type_answer_ph')}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
            />
          )}

          {confirmError && <p className="text-xs text-red-500 mt-2">{confirmError}</p>}

          <button
            onClick={confirmCurrent}
            disabled={confirming || isConfirmed}
            className={`mt-3 w-full py-2 rounded-xl text-sm font-medium transition-colors ${
              isConfirmed ? 'bg-emerald-50 text-emerald-600 cursor-default' : 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50'
            }`}
          >
            {isConfirmed ? t('assessment.answer_confirmed') : confirming ? t('assessment.confirming') : t('assessment.confirm_answer')}
          </button>
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={() => setQIndex((i) => Math.max(0, i - 1))}
            disabled={qIndex === 0}
            className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 disabled:opacity-40"
          >
            {t('assessment.previous')}
          </button>
          {!isLast ? (
            <button
              onClick={() => setQIndex((i) => Math.min(stage.questions.length - 1, i + 1))}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-slate-800 text-white hover:bg-slate-900"
            >
              {t('assessment.next')}
            </button>
          ) : (
            <button
              onClick={() => submitStage(false)}
              disabled={submitting}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {submitting ? t('assessment.submitting') : t('assessment.submit_stage')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
