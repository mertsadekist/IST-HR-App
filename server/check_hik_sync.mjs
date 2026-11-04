// Checks the Hik Central connection from the command line. Reads, never writes —
// neither the Hik database nor the HR database is changed.
//
//   node check_hik_sync.mjs                 verify the configuration + connection
//   node check_hik_sync.mjs --discover      list the tables/columns the Hik user can see
//   node check_hik_sync.mjs --preview [N]   show first/last punch per person for the
//                                           last N days (default 2) and which person
//                                           ids match an employee's Attendance ID
//
// Run it on the server (or locally with the same HIK_* variables in .env) before
// switching the live sync on. Nothing secret is printed.
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config({ path: path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env') });

const { hikConfig, configProblems } = await import('./services/hikConfig.js');
const { testConnection, discoverSchema, fetchPunches, closeHikPool } = await import('./services/hikClient.js');
const { groupPunches, addDays, localDate } = await import('./services/hikRules.js');

const args = process.argv.slice(2);
const cfg = hikConfig();

async function main() {
  const problems = configProblems(cfg);
  if (args.includes('--discover')) {
    // Only the connection settings matter for discovery; the table mapping is
    // what this is meant to help fill in.
    const connection = problems.filter((p) => /HIK_DB_|SSL/.test(p));
    if (connection.length) { console.log('Connection settings missing:\n - ' + connection.join('\n - ')); return 1; }
    const tables = await discoverSchema(cfg);
    console.log(`${tables.length} table(s)/view(s) visible:\n`);
    for (const t of tables) {
      console.log(t.name);
      for (const c of t.columns) console.log(`    ${c.column}  (${c.type})`);
    }
    console.log('\nPick the one that holds door events, then set HIK_EVENTS_TABLE, HIK_COL_PERSON_ID,');
    console.log('HIK_COL_EVENT_TIME and HIK_EVENT_TIME_TYPE accordingly.');
    return 0;
  }

  if (problems.length) {
    console.log('Configuration is incomplete:\n - ' + problems.join('\n - '));
    console.log('\nSee .env.example (the Hik Central block) and docs/attendance_hik_sync.md.');
    return 1;
  }

  const t = await testConnection(cfg);
  if (!t.ok) { console.log('FAILED:\n - ' + t.problems.join('\n - ')); return 1; }
  console.log(`Connected to "${t.database}" (${t.server_version})`);
  console.log(`  ${t.event_count} event(s) from ${t.people_count} person id(s)`);
  console.log(`  oldest ${t.oldest_event}   newest ${t.newest_event}  (${cfg.tz})`);
  console.log(`  TLS: ${t.diagnostics.tls}`);

  if (args.includes('--preview')) {
    const i = args.indexOf('--preview');
    const n = Math.min(31, Math.max(0, parseInt(args[i + 1], 10) || 2));
    const today = localDate(cfg.tz);
    const from = addDays(today, -n);
    const events = await fetchPunches({ from, to: today }, cfg);
    const buckets = [...groupPunches(events).values()].sort((a, b) => a.date.localeCompare(b.date) || a.person_id.localeCompare(b.person_id));
    console.log(`\n${events.length} punch(es), ${buckets.length} person-day(s) between ${from} and ${today}:\n`);

    let known = new Map();
    try {
      const { default: pool } = await import('./config/db.js');
      const [emps] = await pool.query(
        "SELECT attendance_id, CONCAT(first_name, ' ', last_name) AS name FROM employees WHERE attendance_id IS NOT NULL AND attendance_id <> ''");
      known = new Map(emps.map((e) => [String(e.attendance_id).trim(), e.name]));
      await pool.end();
    } catch (e) {
      console.log(`(could not read employees from the HR database: ${e.message})`);
    }

    const unmatched = new Set();
    for (const b of buckets) {
      const who = known.get(b.person_id);
      if (known.size && !who) unmatched.add(`${b.person_id} ${b.person_name || ''}`.trim());
      const last = b.times[b.times.length - 1];
      console.log(`${b.date}  ${b.person_id.padEnd(10)} ${(who || b.person_name || '?').padEnd(26)} `
        + `in ${b.times[0]}  out ${b.times.length > 1 ? last : '—'}  (${b.times.length} punch${b.times.length === 1 ? '' : 'es'})`);
    }
    if (unmatched.size) {
      console.log(`\nPerson ids with no matching employee Attendance ID (${unmatched.size}):`);
      for (const u of unmatched) console.log(`  ${u}`);
    }
  }
  return 0;
}

let code = 1;
try { code = await main(); } catch (e) { console.error('ERROR:', e.message); } finally { await closeHikPool(); }
process.exit(code);
