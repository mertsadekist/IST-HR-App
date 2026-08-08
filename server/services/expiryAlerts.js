/**
 * Shared "warn once per threshold" logic for anything with an expiry date.
 *
 * Used by domain renewals and company-document expiry. Extracted rather than
 * copied because the subtle part is the suppression rule, and two drifting
 * copies of it would mean one of them quietly stops warning.
 *
 * The rule: a record crossing 60 days gets the 60-day notice, then later the
 * 30-day notice, and so on — but never the same notice twice, and never a
 * looser notice after a tighter one. Alerting on every scheduler pass trains
 * everyone to ignore the warning, and then the thing expires anyway.
 */

/**
 * Which threshold bucket a date falls into.
 * @param {number|null} daysLeft
 * @param {number[]} thresholds e.g. [60, 30, 14, 7, 1]
 * @returns {string|null} the threshold as a string, 'expired', or null when not due
 */
export function thresholdFor(daysLeft, thresholds) {
  if (daysLeft == null) return null;
  // Already past is its own, loudest case.
  if (daysLeft < 0) return 'expired';
  for (const t of [...thresholds].sort((a, b) => a - b)) {
    if (daysLeft <= t) return String(t);
  }
  return null;
}

/**
 * Has this record already been warned at this level or a tighter one?
 * @param {string|null} sent the highest threshold already alerted
 * @param {string} threshold the threshold now due
 */
export function alreadyAlerted(sent, threshold) {
  if (!sent) return false;
  if (sent === threshold) return true;
  // 'expired' is terminal; otherwise a smaller number is newer and more urgent,
  // so it must still go out.
  if (sent === 'expired') return true;
  if (threshold === 'expired') return false;
  return Number(threshold) >= Number(sent);
}
