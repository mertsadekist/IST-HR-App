// Idempotent migration: move requests filed on types the policy does not
// recognise onto the ones it does.
//
// Two types existed before the policy was written down and are not in it:
//
//   'Immediate Leave'  → Emergency Leave
//       Both describe an unforeseen absence at short notice. The policy calls it
//       Emergency Leave, grants it at Management's discretion and deducts it from
//       the annual balance. Note this CHANGES the money: Immediate Leave was
//       flatly unpaid, while Emergency Leave is paid out of the annual balance
//       and only becomes unpaid once that balance is exhausted. The five affected
//       requests are all one or two days for staff with annual balance remaining,
//       so the effect is that they stop being deducted — which is what the policy
//       says should have happened.
//
//   'Planned Leave.'   → Annual Leave
//       Leave requested in advance is annual leave under the policy. The single
//       affected request is still Pending, so nothing has been paid on it either
//       way.
//
// The old types are left in place, deactivated, so a reader of the audit trail can
// still see what was originally chosen. The remap is recorded per request in the
// decision_note so the change is visible on the request itself and not only here.
//
// Safe to re-run: matches on the old type ids, which are empty after the first run.
import pool from './config/db.js';

const MAP = [
  { from: 'Immediate Leave', to: 'Emergency Leave' },
  { from: 'Planned Leave.', to: 'Annual Leave' },
];

const NOTE = (from, to) => `[Policy alignment ${new Date().toISOString().slice(0, 10)}] `
  + `Originally filed as "${from}", which the company leave policy does not recognise. `
  + `Reclassified as "${to}".`;

try {
  let moved = 0;
  for (const m of MAP) {
    const [[fromType]] = await pool.query(
      'SELECT id FROM leave_types WHERE name = ? AND company_id IS NULL', [m.from]);
    const [[toType]] = await pool.query(
      'SELECT id FROM leave_types WHERE name = ? AND company_id IS NULL', [m.to]);
    if (!fromType || !toType) {
      console.log(`  ${m.from} → ${m.to}: one of the types is absent, skipped`);
      continue;
    }

    const [affected] = await pool.query(
      `SELECT lr.id, lr.status, lr.days, CONCAT(e.first_name, ' ', e.last_name) name,
              DATE_FORMAT(lr.start_date, '%Y-%m-%d') d
         FROM leave_requests lr JOIN employees e ON e.id = lr.employee_id
        WHERE lr.leave_type_id = ?`, [fromType.id]);
    if (!affected.length) {
      console.log(`  ${m.from} → ${m.to}: nothing left to move`);
      continue;
    }

    for (const r of affected) {
      await pool.query(
        `UPDATE leave_requests
            SET leave_type_id = ?,
                decision_note = TRIM(CONCAT(COALESCE(decision_note, ''), ' ', ?))
          WHERE id = ?`,
        [toType.id, NOTE(m.from, m.to), r.id]);
      console.log(`    #${r.id} ${r.name} ${r.d} (${r.days}d, ${r.status})`);
      moved++;
    }

    // The balance rows follow the request. An approved request debited the old
    // type's balance; leaving that behind would show the employee having used
    // days of a type nobody can file against any more.
    const [bal] = await pool.query(
      `UPDATE leave_balances SET leave_type_id = ? WHERE leave_type_id = ?
        AND NOT EXISTS (SELECT 1 FROM (SELECT * FROM leave_balances) x
                         WHERE x.employee_id = leave_balances.employee_id
                           AND x.leave_type_id = ? AND x.year = leave_balances.year)`,
      [toType.id, fromType.id, toType.id]);
    if (bal.affectedRows) console.log(`    ${bal.affectedRows} balance row(s) moved with them`);
    // Anything that could not move because the target row already exists is
    // folded in, then dropped.
    const [folded] = await pool.query(
      `UPDATE leave_balances tgt
         JOIN leave_balances src
           ON src.employee_id = tgt.employee_id AND src.year = tgt.year AND src.leave_type_id = ?
          SET tgt.used = tgt.used + src.used
        WHERE tgt.leave_type_id = ?`, [fromType.id, toType.id]);
    if (folded.affectedRows) console.log(`    ${folded.affectedRows} balance row(s) folded into the target`);
    await pool.query('DELETE FROM leave_balances WHERE leave_type_id = ?', [fromType.id]);

    console.log(`  ${m.from} → ${m.to}: ${affected.length} request(s) moved`);
  }

  const [left] = await pool.query(`
    SELECT lt.name, COUNT(lr.id) n FROM leave_types lt
      LEFT JOIN leave_requests lr ON lr.leave_type_id = lt.id
     WHERE lt.status = 'Inactive' GROUP BY lt.id HAVING n > 0`);
  console.log(`\n${moved} request(s) reclassified`);
  if (left.length) {
    console.log('still pointing at a retired type:');
    for (const l of left) console.log(`  ${l.name}: ${l.n}`);
  } else {
    console.log('no request points at a retired type any more');
  }
  console.log('REMAP_LEGACY_LEAVE MIGRATION OK');
} catch (e) {
  console.error('MIGRATION ERROR:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
