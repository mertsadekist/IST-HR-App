/**
 * Pure scoring/threshold logic for the Job Applicant Assessment System.
 * No DB access here — callers pass in already-loaded rows. Mirrors the style
 * of leavePolicyService.js: small, testable functions with no side effects.
 */

/** Sums each question's score for a stage. HR's override wins over the AI score when present. */
export function scoreStage(questions, answersByQuestionId) {
  let total = 0;
  for (const q of questions) {
    const a = answersByQuestionId.get(q.id);
    if (!a) continue;
    const score = a.hr_override_score != null ? Number(a.hr_override_score) : Number(a.ai_score || 0);
    total += score;
  }
  return Math.round(total * 100) / 100;
}

export function stagePassed(stageScore, passingScore) {
  return stageScore >= passingScore;
}

/** True if any answer in the given set still needs a human look. */
export function anyFlaggedForReview(answers) {
  return answers.some((a) => a.ai_flagged_review && a.hr_override_score == null);
}

/**
 * Decides the session's terminal outcome once a stage fails or the last
 * stage is submitted. Does not decide whether to *stop* — callers check
 * `stagePassed` and whether more stages remain first.
 */
export function finalStatus({ passed, isLastStage, flagged }) {
  if (!passed) return flagged ? 'HR Review Required' : 'Failed';
  if (isLastStage) return flagged ? 'HR Review Required' : 'Passed';
  return null; // mid-assessment pass — not terminal yet
}
