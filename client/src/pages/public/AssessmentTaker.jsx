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
  const submittedRef = useRef(false);
  const saveTimers = useRef({});

  const load = useCallback(async () => {
    try {
      const { data: d } = await publicApi.getAssessment(token);
      setData(d);
      setAnswers(d.answers || {});
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
    setAnswers((p) => ({ ...p, [question.id]: { ...p[question.id], ...patch } }));
    clearTimeout(saveTimers.current[question.id]);
    saveTimers.current[question.id] = setTimeout(() => {
      publicApi.saveAssessmentAnswer(token, question.id, patch).catch(() => {});
    }, 700);
  };

  const submitStage = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setSubmitting(true);
    try {
      const { data: r } = await publicApi.submitAssessmentStage(token, data.stage.stage_order);
      if (r.completed) {
        const { data: res } = await publicApi.getAssessmentResult(token);
        setResult(res);
        setStep('result');
      } else {
        await load();
      }
    } catch (e) {
      submittedRef.current = false;
      setError(apiErr(e, t('assessment.error_generic')));
    } finally {
      setSubmitting(false);
    }
  }, [token, data, load, t]);

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
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="sticky top-0 z-10 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">{t('assessment.current_stage_n', { n: stage.stage_order })} — {stage.name}</p>
          </div>
          <CountdownTimer deadlineAt={data.stage_deadline_at} onExpire={submitStage} className="text-lg font-bold text-violet-600 tabular-nums" />
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {stage.questions.map((q, idx) => (
          <div key={q.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <p className="text-sm font-medium text-slate-800 mb-3">{idx + 1}. {q.question_text}</p>
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
                rows={4}
                value={answers[q.id]?.answer_text || ''}
                onChange={(e) => updateAnswer(q, { answer_text: e.target.value })}
                placeholder={t('assessment.type_answer_ph')}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500"
              />
            )}
          </div>
        ))}

        <button
          onClick={submitStage}
          disabled={submitting}
          className="w-full py-2.5 rounded-xl text-white font-medium bg-violet-600 hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {submitting ? t('assessment.submitting') : t('assessment.submit_stage')}
        </button>
      </div>
    </div>
  );
}
