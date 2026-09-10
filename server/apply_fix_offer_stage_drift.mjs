/**
 * Repair onboarding records whose stage claims an offer was accepted when it
 * was not.
 *
 * How they got there: "Advance stage" only checked that an offer had been
 * *sent*, so a record could be pushed to OFFER_ACCEPTED while the candidate had
 * not answered — and if the offer was then rejected, the stage kept the claim.
 * The offers panel keys off the stage, so those records also lost the button
 * for raising a replacement offer: a rejection turned into a dead end.
 *
 * The gate is fixed in onboardingStageService.js, but that only stops new drift.
 * These are the records already sitting in the wrong place.
 *
 * Where each one goes:
 *   a Draft or Sent offer is live  → OFFER_SENT   (the process really is there)
 *   nothing live                   → HR_APPROVED  (write them a new offer)
 *
 * Terminal records are left alone — a cancelled or completed record is history,
 * and rewriting history to be tidier is not a repair.
 *
 * Idempotent: a second run finds nothing to do.
 */
import pool from './config/db.js';

const run = async () => {
  const [drifted] = await pool.query(`
    SELECT o.id, o.company_id, o.stage,
           COALESCE(CONCAT(p.first_name, ' ', p.last_name), CONCAT('#', o.id)) AS who,
           (SELECT COUNT(*) FROM onboarding_offers f
             WHERE f.onboarding_id = o.id AND f.status IN ('Draft', 'Sent')) AS live_offers
      FROM onboarding_records o
      LEFT JOIN onboarding_profiles p ON p.onboarding_id = o.id
     WHERE o.stage = 'OFFER_ACCEPTED'
       AND NOT EXISTS (
         SELECT 1 FROM onboarding_offers f
          WHERE f.onboarding_id = o.id AND f.status = 'Accepted')`);

  if (!drifted.length) {
    console.log('  no onboarding records claim an accepted offer they do not have');
    await pool.end();
    return;
  }

  for (const r of drifted) {
    const to = r.live_offers > 0 ? 'OFFER_SENT' : 'HR_APPROVED';
    await pool.query('UPDATE onboarding_records SET stage = ? WHERE id = ?', [to, r.id]);
    await pool.query('INSERT INTO onboarding_events SET ?', {
      onboarding_id: r.id,
      company_id: r.company_id,
      user_id: null,
      user_name: 'System',
      event_type: 'stage_corrected',
      from_stage: r.stage,
      to_stage: to,
      detail: 'Stage said the offer was accepted, but no accepted offer exists. '
        + `Corrected to ${to} so a new offer can be raised.`,
    });
    console.log(`  ${String(r.who).padEnd(28)} OFFER_ACCEPTED → ${to}`);
  }

  console.log(`✔ corrected ${drifted.length} onboarding record(s)`);
  await pool.end();
};

run().catch((e) => { console.error('apply_fix_offer_stage_drift failed:', e.message); process.exit(1); });
