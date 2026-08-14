// Idempotent migration: the company's leave policy, as configuration.
//
// The nine types the policy recognises, their eligibility rules, and — the part
// the old model could not hold at all — their pay tiers.
//
// Sick leave is ninety days a year at three rates: fifteen at full pay, thirty at
// half, forty-five unpaid. Maternity is sixty at two rates plus forty-five unpaid
// for complications. `leave_types.is_paid` is one flag per type and cannot say
// that, so tiers live in their own table and the rate depends on how much of the
// type the employee has already taken this year.
//
// Annual leave is service-based: thirty days after a completed year, two days per
// completed month between six and twelve, and nothing statutory below six. Below
// six months anything granted is Management's discretion, which the system
// records as an explicit balance override rather than a rule — so `accrual` says
// how the entitlement is derived and the override still wins.
//
// Existing types are updated in place, never replaced: `leave_requests` points at
// them and the history has to keep resolving. Two types the policy does not
// recognise — 'Immediate Leave' and 'Planned Leave.' — are deactivated rather
// than deleted, and the requests on them are remapped by
// apply_remap_legacy_leave.mjs.
//
// Safe to re-run. Types are matched by name; tiers are replaced wholesale for the
// types this file owns, so correcting a rate here and re-running applies it.
import pool from './config/db.js';

const COLUMNS = [
  ['description', 'ALTER TABLE leave_types ADD COLUMN description TEXT NULL'],
  // How the yearly entitlement is arrived at. 'Service Based' means ask
  // leavePolicyService.annualEntitlement rather than trusting default_days.
  ['accrual', "ALTER TABLE leave_types ADD COLUMN accrual ENUM('Fixed','Service Based','Per Event') NOT NULL DEFAULT 'Fixed'"],
  // Minimum completed months of service before the type may be used at all.
  ['eligibility_months', 'ALTER TABLE leave_types ADD COLUMN eligibility_months SMALLINT NOT NULL DEFAULT 0'],
  ['max_days_per_request', 'ALTER TABLE leave_types ADD COLUMN max_days_per_request DECIMAL(6,2) NULL'],
  // Emergency leave comes out of the annual balance, not its own.
  ['deducts_from_leave_type_id', 'ALTER TABLE leave_types ADD COLUMN deducts_from_leave_type_id INT NULL'],
  ['requires_document', 'ALTER TABLE leave_types ADD COLUMN requires_document BOOLEAN NOT NULL DEFAULT FALSE'],
  ['notice_days', 'ALTER TABLE leave_types ADD COLUMN notice_days SMALLINT NULL'],
  ['sort_order', 'ALTER TABLE leave_types ADD COLUMN sort_order SMALLINT NOT NULL DEFAULT 0'],
];

const TIER_TABLE = `CREATE TABLE IF NOT EXISTS leave_type_tiers (
   id            INT AUTO_INCREMENT PRIMARY KEY,
   leave_type_id INT NOT NULL,
   from_day      DECIMAL(6,2) NOT NULL,
   -- NULL means open-ended. Anything past the last tier is unpaid, never free.
   to_day        DECIMAL(6,2) NULL,
   pay_factor    DECIMAL(3,2) NOT NULL,
   label         VARCHAR(60) NULL,
   UNIQUE KEY uq_tier_type_from (leave_type_id, from_day),
   FOREIGN KEY (leave_type_id) REFERENCES leave_types(id) ON DELETE CASCADE
 ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`;

const FULL = 1;
const HALF = 0.5;
const NONE = 0;

// The policy, in order.
const POLICY = [
  {
    name: 'Annual Leave', default_days: 30, is_paid: 1, paid_mode: 'Full',
    accrual: 'Service Based', eligibility_months: 6, notice_days: 60, sort_order: 10,
    description: '30 calendar days per year after one completed year of service. '
      + 'Between six and twelve months: two calendar days per completed month. Below six months there is no '
      + 'statutory entitlement unless Management approves one. Requests are expected two months in advance. '
      + 'Public holidays falling inside approved annual leave count as part of it. Accrued but unused leave is '
      + 'paid out on termination.',
    tiers: [{ from_day: 1, to_day: null, pay_factor: FULL, label: 'Full pay' }],
  },
  {
    name: 'Sick Leave', default_days: 90, is_paid: 1, paid_mode: 'Full',
    accrual: 'Fixed', eligibility_months: 0, requires_document: 1, sort_order: 20,
    description: '90 calendar days per year once probation is complete: the first 15 at full pay, the next 30 '
      + 'at half pay, the remaining 45 unpaid. A medical certificate from a licensed practitioner is required '
      + 'for any absence beyond one consecutive day, or earlier if HR asks. Without it the absence may be '
      + 'treated as unpaid or unauthorised.',
    tiers: [
      { from_day: 1, to_day: 15, pay_factor: FULL, label: 'First 15 days — full pay' },
      { from_day: 16, to_day: 45, pay_factor: HALF, label: 'Next 30 days — half pay' },
      { from_day: 46, to_day: 90, pay_factor: NONE, label: 'Remaining 45 days — unpaid' },
    ],
  },
  {
    name: 'Emergency Leave', default_days: 0, is_paid: 1, paid_mode: 'Full',
    accrual: 'Per Event', deducts_from: 'Annual Leave', sort_order: 30,
    description: 'For unforeseen personal or family emergencies requiring immediate absence. Granted at '
      + "Management's discretion; the Reporting Manager and HR must be told as soon as reasonably possible and "
      + 'supporting documents may be requested. Deducted from Annual Leave unless Management approves otherwise, '
      + 'and treated as unpaid leave once the annual balance is exhausted.',
    tiers: [{ from_day: 1, to_day: null, pay_factor: FULL, label: 'Paid from annual balance' }],
  },
  {
    name: 'Maternity Leave', default_days: 60, is_paid: 1, paid_mode: 'Full',
    accrual: 'Per Event', requires_document: 1, sort_order: 40,
    description: '60 calendar days: the first 45 at full pay, the next 15 at half pay. Up to 45 further days '
      + 'unpaid where medical complications of pregnancy or childbirth are certified. On return, a nursing '
      + 'mother is entitled to one or two daily nursing breaks totalling up to one hour a day for six months '
      + 'from the birth, counted as paid working time.',
    tiers: [
      { from_day: 1, to_day: 45, pay_factor: FULL, label: 'First 45 days — full pay' },
      { from_day: 46, to_day: 60, pay_factor: HALF, label: 'Next 15 days — half pay' },
      { from_day: 61, to_day: 105, pay_factor: NONE, label: 'Up to 45 days — unpaid, certified complications' },
    ],
  },
  {
    name: 'Parental Leave', default_days: 5, is_paid: 1, paid_mode: 'Full',
    accrual: 'Per Event', max_days_per_request: 5, sort_order: 50,
    description: 'Five working days at full pay, available to both mother and father, to be taken within six '
      + "months of the child's birth. May be taken consecutively or separately.",
    tiers: [{ from_day: 1, to_day: 5, pay_factor: FULL, label: 'Five working days — full pay' }],
  },
  {
    name: 'Bereavement Leave', default_days: 5, is_paid: 1, paid_mode: 'Full',
    accrual: 'Per Event', max_days_per_request: 5, sort_order: 60,
    description: 'Five days at full pay on the death of a spouse. Three days at full pay on the death of a '
      + 'parent, child, sibling, grandchild or grandparent. Leave runs from the date of death; supporting '
      + 'documentation may reasonably be requested.',
    tiers: [{ from_day: 1, to_day: null, pay_factor: FULL, label: 'Full pay' }],
  },
  {
    name: 'Unpaid Leave', default_days: 0, is_paid: 0, paid_mode: 'None',
    accrual: 'Per Event', sort_order: 70,
    description: 'Available once all other leave balances are exhausted, subject to Company approval and '
      + 'business requirements. May affect salary, leave accrual and other benefits where the law permits. A '
      + 'public holiday falling inside unpaid leave is not a paid holiday and stays part of the unpaid period.',
    tiers: [{ from_day: 1, to_day: null, pay_factor: NONE, label: 'Unpaid' }],
  },
  {
    name: 'Unauthorized Absence', default_days: 0, is_paid: 0, paid_mode: 'None',
    accrual: 'Per Event', sort_order: 80,
    description: 'Failure to report for work without prior approval or valid justification. May lead to salary '
      + "deduction, disciplinary action, and termination in serious or repeated cases under the Company's "
      + 'Disciplinary Policy and UAE Labour Law. Recorded here so a deduction has a named basis; the attendance '
      + 'engine raises these as cases on the Attendance Checks page.',
    tiers: [{ from_day: 1, to_day: null, pay_factor: NONE, label: 'Unpaid' }],
  },
];

// Not in the policy. Deactivated, not deleted — leave_requests point at them.
const RETIRE = ['Immediate Leave', 'Planned Leave.'];

async function columnExists(table, col) {
  const [r] = await pool.query(
    `SELECT COUNT(*) c FROM information_schema.columns
      WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`, [table, col]);
  return r[0].c > 0;
}

try {
  for (const [col, ddl] of COLUMNS) {
    if (!(await columnExists('leave_types', col))) {
      await pool.query(ddl);
      console.log(`leave_types.${col} added`);
    }
  }
  await pool.query(TIER_TABLE);
  console.log('table leave_type_tiers ready');

  // Pass one: the types themselves, so deducts_from can be resolved after.
  for (const p of POLICY) {
    const [[existing]] = await pool.query(
      'SELECT id FROM leave_types WHERE name = ? AND company_id IS NULL', [p.name]);
    const fields = {
      name: p.name,
      default_days: p.default_days,
      is_paid: p.is_paid,
      paid_mode: p.paid_mode,
      description: p.description,
      accrual: p.accrual,
      eligibility_months: p.eligibility_months || 0,
      max_days_per_request: p.max_days_per_request ?? null,
      requires_document: p.requires_document ? 1 : 0,
      notice_days: p.notice_days ?? null,
      sort_order: p.sort_order,
      status: 'Active',
    };
    if (existing) {
      await pool.query('UPDATE leave_types SET ? WHERE id = ?', [fields, existing.id]);
      console.log(`  updated ${p.name}`);
    } else {
      await pool.query('INSERT INTO leave_types SET ?', { ...fields, company_id: null });
      console.log(`  created ${p.name}`);
    }
  }

  // Pass two: the annual link for emergency leave.
  const [[annual]] = await pool.query(
    "SELECT id FROM leave_types WHERE name = 'Annual Leave' AND company_id IS NULL");
  for (const p of POLICY.filter((x) => x.deducts_from)) {
    const [[target]] = await pool.query(
      'SELECT id FROM leave_types WHERE name = ? AND company_id IS NULL', [p.deducts_from]);
    if (target) {
      await pool.query('UPDATE leave_types SET deducts_from_leave_type_id = ? WHERE name = ? AND company_id IS NULL',
        [target.id, p.name]);
      console.log(`  ${p.name} draws on ${p.deducts_from}`);
    }
  }

  // Pass three: tiers. Replaced wholesale so a corrected rate here takes effect.
  for (const p of POLICY) {
    const [[type]] = await pool.query(
      'SELECT id FROM leave_types WHERE name = ? AND company_id IS NULL', [p.name]);
    if (!type) continue;
    await pool.query('DELETE FROM leave_type_tiers WHERE leave_type_id = ?', [type.id]);
    for (const t of p.tiers) {
      await pool.query('INSERT INTO leave_type_tiers SET ?', {
        leave_type_id: type.id, from_day: t.from_day, to_day: t.to_day,
        pay_factor: t.pay_factor, label: t.label,
      });
    }
  }
  const [[tc]] = await pool.query('SELECT COUNT(*) n FROM leave_type_tiers');
  console.log(`${tc.n} tier row(s) written`);

  for (const name of RETIRE) {
    const [r] = await pool.query(
      "UPDATE leave_types SET status = 'Inactive', description = ? WHERE name = ? AND company_id IS NULL",
      ['Not recognised by the company leave policy. Kept so historical requests still resolve; '
        + 'existing requests were remapped — see apply_remap_legacy_leave.mjs.', name]);
    if (r.affectedRows) console.log(`  retired ${name}`);
  }

  const [rows] = await pool.query(`
    SELECT lt.name, lt.accrual, lt.default_days, lt.status,
           (SELECT COUNT(*) FROM leave_type_tiers t WHERE t.leave_type_id = lt.id) tiers,
           (SELECT COUNT(*) FROM leave_requests lr WHERE lr.leave_type_id = lt.id) requests
      FROM leave_types lt WHERE lt.company_id IS NULL ORDER BY lt.sort_order, lt.name`);
  console.log('\nleave types now:');
  for (const r of rows) {
    console.log(`  ${String(r.name).padEnd(22)} ${String(r.accrual).padEnd(14)} `
      + `${String(r.default_days).padStart(6)}d  ${r.tiers} tier(s)  ${r.requests} request(s)  ${r.status}`);
  }
  console.log('\nLEAVE_POLICY MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
