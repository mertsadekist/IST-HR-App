# Work Schedules & Attendance Exceptions — revised plan

Supersedes the 90-section draft. The revision follows two answers that changed the
design materially, plus what the live database actually contains.

Companion document: [`attendance_drive_sync_plan.md`](attendance_drive_sync_plan.md)
(the acquisition layer, already built and running). **Nothing here changes that
layer.** The sync stays a dumb, unconditional importer; everything below happens
*after* a row lands.

---

## 1. The two answers, and what they changed

### Answer 1 — the feed will never carry a punch list

> The device software takes the login records and treats the **last** login of the
> day as the check-out.

So the CSV gives exactly two wall-clock times per employee per day: **first punch
→ `check_in`, last punch → `check_out`**. Nothing in between, ever.

Three consequences, all load-bearing:

1. **Break time cannot be measured.** It must be a *policy attribute of the
   schedule* (deduct 60 minutes), never something derived from punches.
   `worked_gross = check_out − check_in`; `worked_net = worked_gross − schedule.break_minutes`.
2. **The lunch trap.** An employee who punches out at 13:00 for lunch and forgets
   to punch back in has 13:00 as their *last* punch — so the file reports a normal
   check-out at 13:00, which naively reads as a six-hour early departure. This is
   the single most likely source of false accusations in the whole feature, and it
   needs its own exception type (§6, `IMPLAUSIBLE_PUNCH`), not the early-departure
   one.
3. §22 of the original draft (inferring a missing check-out from an `IN/OUT/IN`
   sequence) is **deleted**. It has no data to run on. The simple rule replaces it:
   `check_in` present and `check_out` NULL — or equal to `check_in` — is a missing
   punch. The current feed already produces this shape (one such row in August), so
   it is detectable.

### Answer 2 — schedules are real, and the device cannot express them

| Company | Mon–Fri | Saturday | Sunday |
|---|---|---|---|
| **IST Markets LTD** (id 2, 4 staff) | 10:00–19:00 | off | off |
| **IST Real Estate LLC** (id 1, 18 staff) | 10:00–19:00 | 10:00–15:00 | off |

Plus a standing variant: **staff who do not take the one-hour meal break may leave
at 18:00 instead of 19:00.**

The device applies **one global schedule to everyone**. Verified: every
Drive-synced row carries `scheduled_in = 10:00`, `scheduled_out = 19:00` — one
distinct pair across the whole table.

That makes the device's own late/early figures **provably wrong** for two real
cases: every IST Real Estate Saturday (it would report a 4-hour early departure
for a completed shift) and every no-break employee (a 1-hour early departure,
daily, forever). The schedule engine is therefore not a refinement — it is the fix
for numbers that are already incorrect.

### The variant needs no special mechanism

The "no meal break" case is **not** an exception, an override field, or a flag. It
is a fourth schedule whose day rows end at 18:00 with `break_minutes = 0`. Both
schedules expect the same 8 net hours, so a single formula covers both. Seed four:

1. `IST Real Estate — Standard` (Mon–Fri 10–19, Sat 10–15, break 60)
2. `IST Real Estate — No Meal Break` (Mon–Fri 10–18, Sat 10–15, break 0)
3. `IST Markets — Standard` (Mon–Fri 10–19, break 60)
4. `IST Markets — No Meal Break` (Mon–Fri 10–18, break 0)

Four schedules for 22 employees, and no branch in the code for the variant.

---

## 2. Who is authoritative

**Our engine decides. The device's figures are kept as raw reference.**

This must be settled in the schema, not in prose, because `late_minutes` and
`early_leave_minutes` **currently hold the device's values** and the employee
portal reports built this month read those columns.

- Add `device_late_minutes`, `device_early_leave_minutes`; backfill from the
  existing columns.
- `late_minutes` / `early_leave_minutes` become the system's computed values.
  The portal, the PDF reports and the payroll page then show correct numbers with
  **no client change**.
- Surface the two side by side only when they differ by more than a threshold —
  that difference is a free health check on the device's configuration.

**Rows corrected by hand are never recomputed.** Recompute only
`source IN ('Drive Sync','CSV Import')`. The 891 `source = 'Manual'` rows keep
whatever HR entered and get `evaluation_locked = 1`. This is non-negotiable #6 of
the original draft, and it is already how the importer behaves.

---

## 3. Timezone — one rule

All times in the feed are **local wall-clock strings**; the server runs UTC.

Every value in this feature — punch times, schedule times, grace periods,
thresholds — stays wall-clock and is compared in **minutes since midnight**. No
`Date` objects, no UTC conversion, anywhere in the evaluator. Dates come out of
MySQL through `DATE_FORMAT`, as elsewhere in this codebase (a DATE read into a JS
`Date` shifts a day; that bug has already been paid for once here).

The reference zone is **Asia/Dubai**, and it belongs to the schedule row, so a
future company in another zone does not force a rewrite.

---

## 4. Schema — 6 new tables, not 14

Additive only. Each goes in both `server/config/ensureSchema.js`
(`TABLE_GUARDS` / `COLUMN_GUARDS`) and a new idempotent
`server/apply_work_schedules.mjs` appended to `scripts/migrate.sh`.

| Table | Purpose |
|---|---|
| `work_schedules` | id, company_id, name_en, name_ar, timezone, grace_in_minutes, grace_out_minutes, half_day_threshold_pct, is_default, active |
| `work_schedule_days` | schedule_id, weekday 0–6, is_working, start_time, end_time, break_minutes |
| `employee_work_schedules` | employee_id, schedule_id, effective_from, effective_to NULL, assigned_by — **effective-dated**, so a change in September does not reinterpret August |
| `holidays` | company_id NULL = all companies, holiday_date, name_en, name_ar |
| `attendance_exceptions` | the case file: attendance_id, employee_id, work_date, company_id, type, severity, computed values, status, resolution, resolved_by, resolved_at, notes |
| `attendance_exception_files` | proof documents — mirrors the `onboarding_files` pattern (`company_id`, `storage_key`, `uploaded_by`), on the `/data/uploads` volume |

New columns on `attendance`: `schedule_id`, `schedule_snapshot` JSON,
`expected_in`, `expected_out`, `expected_minutes`, `worked_minutes_net`,
`device_late_minutes`, `device_early_leave_minutes`, `evaluated_at`,
`evaluation_version`, `evaluation_locked`.

### Two tables from the original draft are deliberately refused

- **`attendance_daily_summaries` — dropped.** `attendance` is already unique on
  `(employee_id, work_date)`: identical grain. A second table at the same grain is
  two competing truths about one day, and they will drift. The computed fields go
  onto `attendance` itself.
- **A new request/approval subsystem — dropped.** `leave_requests` + `leave_types`
  already do submit → approve/reject → `decided_by` → balances → reports, and the
  employee portal already posts into it. Excuse, permission, remote-work and
  shift-swap are all "employee asks, manager decides". They become leave types
  (with an hours unit where needed), not a parallel inbox that HR will ignore.

`schedule_snapshot` is the historical-integrity mechanism (§17/§64 of the draft):
the resolved rule for that specific day, frozen on the row. That is cheaper and
far more robust than a graph of versioned policy tables, and it makes a
re-evaluation reproducible a year later.

---

## 5. The evaluator — one ordered function

`server/services/attendanceEvaluator.js`, a **pure** function
`evaluateDay({ employee, date, row, schedule, holidays, approvedLeave })` →
`{ status, late_minutes, early_leave_minutes, worked_minutes_net, exceptions[] }`.
Pure means it is unit-testable without a database, like `attendanceFileParser.js`.

Order is the design. It runs top to bottom and **stops at the first terminal step**:

1. Resolve the schedule for `(employee, date)` from `employee_work_schedules`.
   No assignment → company default. Still none → `NO_SCHEDULE` exception, stop.
2. **Holiday** → `status = 'Holiday'`. Punches present → `WORKED_ON_DAY_OFF`. Stop.
3. **Weekly day off** → same treatment. Stop.
4. **Approved leave covers the date** → `status = 'On Leave'`. Punches present →
   `LEAVE_OVERLAP` (informational — the leave may need cancelling). Stop.
5. **No punches at all** → `ABSENT_NO_RECORD`, `status = 'Absent'`. Stop.
6. **`check_out` missing or equal to `check_in`** → `MISSING_PUNCH`. Stop —
   deliberately compute *no* hours, *no* early departure.
7. **Plausibility:** `worked_gross` below ~50% of expected, or `check_out` before
   14:00 on a full day → `IMPLAUSIBLE_PUNCH` (the lunch trap). Stop.
8. Only now: `late = check_in − expected_in − grace_in`,
   `early = expected_out − grace_out − check_out`, `net = gross − break_minutes`.
9. Material thresholds → `LATE_ARRIVAL`, `EARLY_DEPARTURE`, `INSUFFICIENT_HOURS`.

**At most one blocking exception per day**, because steps 2–7 are terminal. Without
that rule one forgotten punch generates four separate cases and the queue becomes
unusable.

Re-running the evaluator on the same day is idempotent: exceptions are keyed on
`(employee_id, work_date, type)`, so a re-run updates rather than duplicates, and
an exception that no longer applies is closed as `Auto-resolved` — never deleted,
so the audit trail survives.

---

## 6. Exception types and statuses

**Eight types**, each grounded in something this data actually produces:

| Type | Blocking | Note |
|---|---|---|
| `MISSING_PUNCH` | yes | 1 case in August already |
| `IMPLAUSIBLE_PUNCH` | yes | the lunch trap |
| `ABSENT_NO_RECORD` | yes | 4 cases in August; **deducts pay** — see §7 |
| `LATE_ARRIVAL` | no | 5 cases |
| `EARLY_DEPARTURE` | no | 8 cases, from 10 to 144 minutes |
| `INSUFFICIENT_HOURS` | no | → `Half Day` |
| `WORKED_ON_DAY_OFF` | no | **not a violation** — a compensation candidate. 17 IST Markets Saturday rows and 2 IST Real Estate Sunday rows exist today |
| `LEAVE_OVERLAP` | no | informational |

**Five statuses**, not thirteen: `Open`, `Awaiting Employee`, `Awaiting Manager`,
`Resolved`, `Waived`.

**Material thresholds are the difference between a working queue and a dead one.**
August ran 166 rows with 18 deviations — roughly 50 a month at full coverage,
which one person can handle. But several early departures were 10 minutes. A
10-minute case is noise: it should be recorded on the row and aggregated in the
monthly report, never opened as a case needing an explanation and a document.
Suggested defaults, configurable per schedule: grace 10 minutes in / 10 out; a
case opens above 30 minutes late or 30 minutes early.

---

## 7. Payroll — advisory, never a block

Verified current behaviour (`services/payrollService.js`, `routes/payroll.js:93`):
deduction = `(unpaid leave days + COUNT(status='Absent') for the period) × gross/30`.
Late and early departures are **not** deducted. `Half Day` is **not** handled at all
— it deducts nothing today.

So two things follow:

- "No automatic deduction" is not the status quo for absence — absence *is*
  deducted automatically, and any day the evaluator marks `Absent` costs the
  employee a full day's gross. That is precisely why shadow mode (§9) is not
  optional. Good news from the check: no `Absent` row currently sits on a
  non-working day, so there is **no live wrong deduction to correct**.
- If the evaluator starts issuing `Half Day`, it silently deducts nothing. Decide
  the intent before Phase 3 rather than discovering it in a payslip.

Blocking payroll on unresolved exceptions (§40–42) is **rejected**. Four open
cases would freeze the month's payroll for 22 people, on a page the accountant now
owns. Instead: the run page shows the unresolved count for the period with a link
into the queue, and generating anyway is permitted and recorded in the audit log
with a reason.

---

## 8. Permissions — extend, do not invent

The draft's 15 granular permissions do not fit this system. Authorisation here is
**role-based**: `ROLE_MODULES` + `requireModule` for whole routers, `authorize()`
for writes (see [`roles_and_permissions.md`](roles_and_permissions.md)). A
permission table is its own project.

| Role | Schedules | Exception queue |
|---|---|---|
| `admin`, `hr_manager` | create / assign | full, waive, resolve |
| `accountant` | read | read + payroll advisory |
| `employee` | read own | see own, respond, upload proof (via the portal) |
| `recruiter` | none | none |

---

## 9. Phases

**Phase 1 — Foundations. No behaviour change. ✅ Delivered.** The four tables
(`work_schedules`, `work_schedule_days`, `employee_work_schedules`, `holidays`),
`services/workScheduleService.js` (pure resolution + the snapshot the evaluator
will freeze), `routes/workSchedules.js`, a Settings → Work Schedules page with
schedule builder / coverage / holiday calendar, and a Schedule tab on the employee
file. The four IST schedules are seeded by `apply_work_schedules.mjs`; all 22
active staff resolve through their company default, so IST Real Estate Saturdays
come out as a 300-minute working day and IST Markets Saturdays as a day off.
Still to do by hand: enter the 2026 holiday list, and assign anyone whose shift
differs from their company default (the no-meal-break staff).

**Phase 2 — The evaluator in shadow mode. ✅ Delivered.** `evaluateDay()` (pure,
in `services/attendanceEvaluator.js`), `attendance_exceptions` +
`attendance_evaluation_runs`, `eval_*` columns beside the stored ones on
`attendance`, a runner invoked after every sync, and an **Attendance Checks** page
comparing the engine against the record. `runEvaluation` throws if asked to run
live, so the shadow guarantee is enforced in code rather than by convention.

Three guards were added after the first run against live data produced 104
absences that were all artefacts. Each is the same principle as the terminal
steps — refuse to conclude from missing data:

- **the day must have been observed.** The first run marked all 27 staff absent
  on 13 Aug purely because that morning's file had not arrived. Live, that is 27
  people losing a day's gross to a late sync.
- **the employee must be on the device.** Somebody with no `attendance_id` is not
  in the fingerprint system; a daily absence says nothing true about them.
- **the employee must appear at least once in the range.** Otherwise it is an
  offboarded person whose `end_date` was never entered — one finding, not one
  case per working day.

Those three cut the first run from 146 exceptions to 83, and the remaining
absences concentrated in four people rather than spreading across the calendar.

Two implementation notes worth keeping:

- **`check_in` / `check_out` are `DATETIME`, not `TIME`**, and the MySQL driver
  returns them shifted to UTC — a punch stored as 11:38 arrives in JavaScript as
  07:38Z. Every read formats inside MySQL (`TIME_FORMAT`) to get the wall clock
  that was actually recorded. Reading the column directly would put every
  calculation four hours out.
- The evaluator works in **seconds and rounds to minutes**, because the device
  rounds too. Truncating disagreed with it by a minute on about half of all rows
  and buried the real differences in noise.

**Phase 3 — Live.** The evaluator writes authoritative values (Drive Sync / CSV
rows only, never `Manual`), the queue gets its five statuses and proof upload, the
employee can respond from the portal shell already built, and the 05:00 email gains
an exceptions section beside the ones it already reports.

**Phase 4 — Advisory and reports.** The payroll-run warning, a monthly exception
report on letterhead (reusing `printDoc.js`), and exception history in the
employee file.

Cut from the original draft: the escalation engine with deadlines (premature at 22
staff), the six request types, granular permissions, `attendance_daily_summaries`,
punch-sequence inference, and Branch — which does not exist in this schema at all
(there are `companies` and `departments`, nothing between).

---

## 10. Prerequisites — do these before Phase 2

1. **The 242 attendance rows filed under the wrong company.** Previously reported as
   untidy; the schedule engine promotes it to a **correctness blocker**, because a
   row's company selects the schedule. An IST Markets employee's row sitting under
   IST Real Estate would be judged against a Saturday shift they do not work.
2. **The two unmatched device IDs** (4001 Majd Barshiny, 4033 Mohammed Saif) — add,
   map, or ignore. Unmapped punches are invisible to the evaluator, and an absent
   day it never sees is an absent day nobody reviews.
3. **The 45 pre-existing test failures.** Adding a subsystem of this size on top of
   that noise means new breakage hides inside old breakage.

---

## 11. Open decisions

1. **Half Day and pay** — deduct half a day, or record it and leave pay alone?
   Payroll ignores the status entirely today (§7).
2. **`WORKED_ON_DAY_OFF`** — record only, grant time off in lieu, or pay it? There
   are already 19 such rows in the data. The draft's compensation-is-not-overtime
   distinction is right; what remains is choosing the policy.
3. **Thresholds** — are 10-minute grace and a 30-minute case threshold the right
   defaults for IST, or should they differ per company?
4. **Who reviews** — every case to one HR person, or routed to the employee's
   department manager? Routing needs a manager on the employee record; a single
   queue needs nothing new.
