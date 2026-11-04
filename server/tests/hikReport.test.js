/**
 * The daily close email, and the scheduler's time-of-day arithmetic. Pure.
 */
import { describe, it, expect } from 'vitest';
import { msUntilNext } from '../services/dailySchedule.js';
import { buildSyncReport } from '../services/attendanceSyncReport.js';

describe('msUntilNext', () => {
  const at = (h, m) => new Date(2026, 7, 10, h, m, 0, 0); // 10 Aug 2026, local

  it('waits until later today when the hour has not passed', () => {
    expect(msUntilNext(5, 0, at(2, 0))).toBe(3 * 3600_000);
  });

  it('rolls to tomorrow once the hour has passed', () => {
    expect(msUntilNext(5, 0, at(6, 0))).toBe(23 * 3600_000);
  });

  it('rolls over rather than firing instantly when it is exactly the time', () => {
    expect(msUntilNext(5, 0, at(5, 0))).toBe(24 * 3600_000);
  });

  it('is always in the future', () => {
    for (const h of [0, 4, 5, 13, 23]) expect(msUntilNext(5, 0, at(h, 30))).toBeGreaterThan(0);
  });

  it('honours the minute', () => {
    expect(msUntilNext(5, 30, at(5, 0))).toBe(30 * 60_000);
  });
});

describe('the daily close email', () => {
  const summary = {
    from: '2026-08-16', to: '2026-08-17', finalized: true,
    events_read: 140, people_seen: 22, inserted: 20, updated: 2, unchanged: 5,
    absences: [{ employee: 'Sara Hashem', date: '2026-08-17' }],
    on_leave: [{ employee: 'Yatra Mulmi', date: '2026-08-17', leave_type: 'Annual Leave' }],
    unmatched: [{ person_id: '4001', name: 'Majd Barshiny', days: 2, punches: 4 }],
    ambiguous_ids: ['9999'],
    missing_checkout: [{ employee: 'Shinaritah', date: '2026-08-17', check_in: '10:19:13' }],
    skipped_manual: [{ employee: 'Mert Sadek', date: '2026-08-17' }],
    not_observed_days: [], no_schedule: [], errors: [],
  };

  it('leads with what happened', () => {
    const r = buildSyncReport({ status: 'Completed', summary, runDate: '2026-08-18' });
    expect(r.subject).toMatch(/Attendance closed for 2026-08-16 → 2026-08-17/);
    expect(r.html).toContain('140');
  });

  it('lists every category that needs a human', () => {
    const { html } = buildSyncReport({ status: 'Completed', summary, runDate: '2026-08-18' });
    expect(html).toMatch(/Marked absent/);
    expect(html).toContain('Sara Hashem');
    expect(html).toMatch(/Recorded as leave/);
    expect(html).toContain('Annual Leave');
    expect(html).toMatch(/Unknown person IDs/);
    expect(html).toContain('Majd Barshiny');
    expect(html).toMatch(/One punch only/);
    expect(html).toMatch(/Left alone — corrected by hand/);
    expect(html).toMatch(/more than one employee/);
  });

  it('escapes names rather than letting them into the markup', () => {
    const { html } = buildSyncReport({
      status: 'Completed', runDate: '2026-08-18',
      summary: { ...summary, unmatched: [{ person_id: '1', name: '<script>x</script>', days: 1, punches: 1 }] },
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('warns loudly when the feed was silent, and says nobody was marked absent', () => {
    const { html, text } = buildSyncReport({
      status: 'Completed', runDate: '2026-08-18', summary: { ...summary, not_observed_days: ['2026-08-17'], absences: [] },
    });
    expect(html).toMatch(/no door punches at all for 2026-08-17/);
    expect(html).toMatch(/Nobody was marked absent/);
    expect(text).toMatch(/nobody marked absent/);
  });

  it('carries the reason when it failed', () => {
    const r = buildSyncReport({ status: 'Failed', summary: {}, runDate: '2026-08-18', error: 'Cannot reach the Hik database' });
    expect(r.subject).toMatch(/failed/i);
    expect(r.html).toContain('Cannot reach the Hik database');
  });

  it('has a plain-text alternative that carries the unknown ids', () => {
    const r = buildSyncReport({ status: 'Completed', summary, runDate: '2026-08-18' });
    expect(r.text).toContain('4001');
    expect(r.text).not.toContain('<');
  });
});

describe('the close email carries the schedule checks', () => {
  const withEval = {
    from: '2026-08-13', to: '2026-08-13', events_read: 90, people_seen: 20, inserted: 20, updated: 0,
    unmatched: [], absences: [], on_leave: [], errors: [],
    evaluation: {
      days_evaluated: 24, exceptions_opened: 3, exceptions_closed: 1, disagreements: 5,
      shadow: { started_at: '2026-08-13', day: 1, total_days: 28, complete: false },
      days_not_observed: [],
      opened_cases: [
        { employee: 'Sara Hashem', date: '2026-08-13', type: 'ABSENT_NO_RECORD', severity: 'Blocking', detail: 'x' },
        { employee: 'Mayas Barshiny', date: '2026-08-13', type: 'LATE_ARRIVAL', severity: 'Review', detail: 'x' },
        { employee: 'Nawar Eskef', date: '2026-08-13', type: 'EARLY_DEPARTURE', severity: 'Review', detail: 'x' },
      ],
    },
  };

  it('says twice that nothing was applied', () => {
    const { html } = buildSyncReport({ status: 'Completed', summary: withEval, runDate: '2026-08-13' });
    expect(html).toMatch(/shadow mode/i);
    expect(html).toMatch(/Nothing below has been applied/i);
    expect(html).toMatch(/No attendance record, status or payroll figure was changed/i);
  });

  it('names the blocking cases but only counts the rest', () => {
    const { html } = buildSyncReport({ status: 'Completed', summary: withEval, runDate: '2026-08-13' });
    expect(html).toContain('Sara Hashem');
    expect(html).not.toContain('Mayas Barshiny');
    expect(html).toMatch(/and 2 for review/);
  });

  it('says plainly when the engine agreed with everything', () => {
    const quiet = { ...withEval, evaluation: { ...withEval.evaluation, exceptions_opened: 0, disagreements: 0, opened_cases: [] } };
    expect(buildSyncReport({ status: 'Completed', summary: quiet, runDate: '2026-08-13' }).html).toMatch(/agreed with every day/i);
  });

  it('reports a day the feed did not cover, so nobody reads absence into it', () => {
    const gap = { ...withEval, evaluation: { ...withEval.evaluation, days_not_observed: ['2026-08-13'] } };
    expect(buildSyncReport({ status: 'Completed', summary: gap, runDate: '2026-08-13' }).html)
      .toMatch(/nobody was marked absent for those days/i);
  });

  it('omits the section when the checks did not run, and says so when they failed', () => {
    expect(buildSyncReport({ status: 'Completed', summary: { ...withEval, evaluation: undefined }, runDate: '2026-08-13' }).html)
      .not.toMatch(/Schedule checks/);
    const { html } = buildSyncReport({
      status: 'Completed', runDate: '2026-08-13',
      summary: { ...withEval, evaluation: undefined, evaluation_error: 'connection lost' },
    });
    expect(html).toContain('connection lost');
    expect(html).toMatch(/sync itself is unaffected/i);
  });
});
