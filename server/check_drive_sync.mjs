// Dry run for the attendance Drive sync — READS ONLY, WRITES NOTHING.
//
// Run this once the three environment variables are set, before letting the
// importer near the attendance table:
//
//   node check_drive_sync.mjs
//
// It proves the credentials work, lists the folder, says which files the sync
// would take and which it would leave alone, parses the newest one, and shows
// exactly which employees it would match — all without touching a single row.
//
// Nothing here inserts, updates or deletes. The only database access is reading
// the ledger and the employee list.
import pool from './config/db.js';
import { configProblems, listFolderFiles, downloadFileText, driveConfig } from './services/googleDriveClient.js';
import { parseAttendanceCsv, summarise, businessDateFromName } from './services/attendanceFileParser.js';

const line = (c = '─') => console.log(c.repeat(70));
const yes = (s) => `  ok   ${s}`;
const no = (s) => `  --   ${s}`;

try {
  line('═');
  console.log('  ATTENDANCE DRIVE SYNC — DRY RUN (nothing is written)');
  line('═');

  // ── 1. Configuration ──────────────────────────────────────────────────────
  console.log('\n1. Configuration');
  const problems = configProblems();
  if (problems.length) {
    for (const p of problems) console.log(no(p));
    console.log('\nSet these in the environment and run again. See docs/attendance_drive_sync_plan.md §9a.');
    process.exit(1);
  }
  const { email, folderId } = driveConfig();
  console.log(yes(`service account: ${email}`));
  console.log(yes(`folder id: ${folderId}`));

  // ── 2. Can we see the folder? ─────────────────────────────────────────────
  console.log('\n2. Reaching the folder');
  const files = await listFolderFiles();
  console.log(yes(`${files.length} file(s) visible`));
  if (!files.length) {
    console.log(no('The folder is empty, or it was shared with a different account than the one above.'));
  }

  // ── 3. What the ledger already knows ──────────────────────────────────────
  console.log('\n3. Against the ledger');
  const [ledger] = await pool.query(
    'SELECT drive_file_id, file_name, status, md5_checksum FROM attendance_sync_files');
  const known = new Map(ledger.map((r) => [r.drive_file_id, r]));
  console.log(`  ledger holds ${ledger.length} file(s) from previous runs`);

  const startDate = process.env.ATTENDANCE_SYNC_START_DATE || null;
  if (startDate) console.log(`  start date floor: ${startDate} (anything earlier is skipped)`);
  else console.log('  no start-date floor set — the real run will default it to its first day');

  const wouldImport = [];
  const wouldSkip = [];
  for (const f of files) {
    const bd = businessDateFromName(f.name);
    const prev = known.get(f.id);
    if (!/\.csv$/i.test(f.name)) { wouldSkip.push([f, 'not a .csv']); continue; }
    if (!bd) { wouldSkip.push([f, 'no date in the filename']); continue; }
    if (startDate && bd < startDate) { wouldSkip.push([f, `older than the start date (${bd})`]); continue; }
    if (prev && prev.status === 'Imported' && prev.md5_checksum === f.md5Checksum) {
      wouldSkip.push([f, 'already imported, unchanged']); continue;
    }
    if (prev && prev.md5_checksum && prev.md5_checksum !== f.md5Checksum) {
      wouldImport.push([f, 're-uploaded since last import — checksum changed']); continue;
    }
    wouldImport.push([f, prev ? `previously ${prev.status}` : 'new']);
  }

  console.log(`\n  WOULD IMPORT (${wouldImport.length}):`);
  for (const [f, why] of wouldImport) console.log(`    ${f.name.padEnd(32)} ${why}`);
  console.log(`\n  WOULD SKIP (${wouldSkip.length}):`);
  for (const [f, why] of wouldSkip.slice(0, 15)) console.log(`    ${f.name.padEnd(32)} ${why}`);
  if (wouldSkip.length > 15) console.log(`    … and ${wouldSkip.length - 15} more`);

  // ── 4. Parse the newest candidate ─────────────────────────────────────────
  const target = wouldImport[0]?.[0] || files[0];
  if (!target) {
    console.log('\nNothing to inspect. Done.');
    process.exit(0);
  }

  console.log(`\n4. Parsing ${target.name}`);
  const text = await downloadFileText(target.id);
  const parsed = parseAttendanceCsv(text, target.name);
  if (parsed.errors.length) {
    for (const e of parsed.errors) console.log(no(e));
  } else {
    console.log(yes(`${parsed.rows.length} row(s), business date ${parsed.businessDate}`));
  }
  for (const w of parsed.warnings) console.log(`  warn  ${w}`);
  const s = summarise(parsed.rows);
  console.log(`  present ${s.present} · late ${s.late} · absent ${s.absent} `
    + `· left early ${s.left_early} · missing punch ${s.missing_punch}`);

  // ── 5. Who would it match? ────────────────────────────────────────────────
  console.log('\n5. Matching device IDs to employees');
  const [emps] = await pool.query(
    `SELECT id, attendance_id, CONCAT(first_name, ' ', last_name) AS name, company_id, status
       FROM employees WHERE attendance_id IS NOT NULL AND attendance_id <> ''`);
  const byDevice = new Map(emps.map((e) => [String(e.attendance_id).trim(), e]));
  const [ignored] = await pool.query('SELECT device_id FROM attendance_ignored_devices');
  const ignoredSet = new Set(ignored.map((i) => i.device_id));

  const matched = [], unmatched = [], skippedIgnored = [];
  for (const r of parsed.rows) {
    if (ignoredSet.has(r.device_id)) { skippedIgnored.push(r); continue; }
    const e = byDevice.get(r.device_id);
    if (e) matched.push({ r, e }); else unmatched.push(r);
  }
  console.log(yes(`${matched.length} matched`));
  if (skippedIgnored.length) console.log(`  ${skippedIgnored.length} on the ignore list`);
  if (unmatched.length) {
    console.log(`\n  UNMATCHED (${unmatched.length}) — these need a decision:`);
    for (const r of unmatched) console.log(`    device ${r.device_id.padEnd(8)} "${r.name}"`);
  }

  // ── 6. Would anything be left alone? ──────────────────────────────────────
  console.log('\n6. Existing rows for that day');
  if (matched.length) {
    const ids = matched.map((m) => m.e.id);
    const [existing] = await pool.query(
      `SELECT employee_id, source, status FROM attendance
        WHERE work_date = ? AND employee_id IN (?)`, [parsed.businessDate, ids]);
    const bySource = existing.reduce((a, x) => ({ ...a, [x.source]: (a[x.source] || 0) + 1 }), {});
    console.log(`  ${existing.length} row(s) already exist for ${parsed.businessDate}: `
      + (Object.entries(bySource).map(([k, v]) => `${k} ${v}`).join(', ') || 'none'));
    const manual = existing.filter((x) => x.source === 'Manual');
    if (manual.length) {
      console.log(`  ${manual.length} of them are Manual and would be LEFT ALONE (your decision §9.6)`);
    }
  }

  // ── 7. Company disagreements, reported never acted on ─────────────────────
  const COMPANY_HINT = { 'IST Markets': 2, 'IST Real Estate': 1 };
  const disagreements = [];
  for (const { r, e } of matched) {
    const tail = r.department_path.split('>').pop().trim();
    const claimed = COMPANY_HINT[tail];
    if (claimed && claimed !== e.company_id) {
      disagreements.push(`${e.name}: file says ${tail} (${claimed}), record says company ${e.company_id}`);
    }
  }
  console.log('\n7. Company disagreements between the file and the records');
  if (!disagreements.length) console.log(yes('none'));
  else {
    console.log(`  ${disagreements.length} — reported in the daily email, never acted on:`);
    for (const d of disagreements) console.log(`    ${d}`);
  }

  line('═');
  console.log('  DRY RUN COMPLETE — no rows were written.');
  line('═');
} catch (e) {
  console.error('\nDRY RUN FAILED:', e.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
