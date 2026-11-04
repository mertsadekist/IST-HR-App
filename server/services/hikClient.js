/**
 * Read-only access to the Hik Central database (PostgreSQL).
 *
 * This module can only ever read:
 *
 *   - every query runs inside `BEGIN READ ONLY`, so even a database user that was
 *     granted write rights cannot change anything through this code;
 *   - `statement_timeout` is set per transaction, so a slow table cannot hold the
 *     HR server's event loop waiting on it forever;
 *   - identifiers (table, columns) come from validated configuration and are
 *     double-quoted; every *value* — the time window, the filters — is a bound
 *     parameter. Nothing from an event row ever reaches a query.
 *
 * The recommended deployment still creates a SELECT-only role on the Hik side
 * (see docs/attendance_hik_sync.md); the read-only transaction is the second lock.
 */
import pg from 'pg';
import { hikConfig, configProblems, quoteQualified, quoteIdent } from './hikConfig.js';
import { addDays } from './hikRules.js';

const WALL = "'YYYY-MM-DD HH24:MI:SS'";

/**
 * A text column holding an ISO-like date-time, as a timestamp — or NULL when the
 * text is not one. CASE guarantees the pattern is checked before the cast, so one
 * malformed row is skipped instead of failing the whole read. Any trailing
 * fraction or offset is ignored; the time type says which zone the text is in.
 */
const textAsTimestamp = (col) =>
  `(CASE WHEN ${col}::text ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}:[0-9]{2}' `
  + `THEN substr(${col}::text, 1, 19)::timestamp END)`;

/** SQL for "this column as office wall-clock text", given $1 = the time zone. */
export function wallClockExpr(col, timeType) {
  switch (timeType) {
    case 'text_local': return `to_char(${textAsTimestamp(col)}, ${WALL})`;
    case 'text_utc': return `to_char((${textAsTimestamp(col)} AT TIME ZONE 'UTC') AT TIME ZONE $1, ${WALL})`;
    case 'timestamptz': return `to_char(${col} AT TIME ZONE $1, ${WALL})`;
    case 'timestamp_local': return `to_char(${col}, ${WALL})`;
    case 'timestamp_utc': return `to_char((${col} AT TIME ZONE 'UTC') AT TIME ZONE $1, ${WALL})`;
    case 'epoch_s': return `to_char(to_timestamp(${col}) AT TIME ZONE $1, ${WALL})`;
    case 'epoch_ms': return `to_char(to_timestamp(${col} / 1000.0) AT TIME ZONE $1, ${WALL})`;
    default: throw new Error(`Unsupported time type "${timeType}"`);
  }
}

/**
 * `col >= from AND col < to`, written against the raw column so an index on it can
 * be used. $1 = time zone, $2 = from, $3 = to (office wall-clock strings).
 */
export function rangePredicate(col, timeType) {
  const lo = '$2::timestamp';
  const hi = '$3::timestamp';
  switch (timeType) {
    case 'timestamptz':
      return `${col} >= (${lo} AT TIME ZONE $1) AND ${col} < (${hi} AT TIME ZONE $1)`;
    case 'timestamp_local':
      return `${col} >= ${lo} AND ${col} < ${hi}`;
    case 'timestamp_utc':
      return `${col} >= ((${lo} AT TIME ZONE $1) AT TIME ZONE 'UTC') AND ${col} < ((${hi} AT TIME ZONE $1) AT TIME ZONE 'UTC')`;
    case 'epoch_s':
      return `${col} >= extract(epoch from (${lo} AT TIME ZONE $1)) AND ${col} < extract(epoch from (${hi} AT TIME ZONE $1))`;
    case 'epoch_ms':
      return `${col} >= extract(epoch from (${lo} AT TIME ZONE $1)) * 1000 AND ${col} < extract(epoch from (${hi} AT TIME ZONE $1)) * 1000`;
    // Text cannot use an index on the raw column the way the types above do; the
    // tables this serves are small enough that a scan every few minutes is fine.
    case 'text_local':
      return `${textAsTimestamp(col)} >= ${lo} AND ${textAsTimestamp(col)} < ${hi}`;
    case 'text_utc':
      return `${textAsTimestamp(col)} >= ((${lo} AT TIME ZONE $1) AT TIME ZONE 'UTC') AND ${textAsTimestamp(col)} < ((${hi} AT TIME ZONE $1) AT TIME ZONE 'UTC')`;
    default: throw new Error(`Unsupported time type "${timeType}"`);
  }
}

/**
 * The events query for an inclusive date range. Pure: returns text + params.
 *
 * @param {object} cfg   hikConfig() output (already validated)
 * @param {{from: string, to: string}} range  'YYYY-MM-DD', both inclusive
 */
export function buildEventsQuery(cfg, { from, to }) {
  const s = cfg.source;
  const table = quoteQualified(s.table);
  const person = quoteIdent(s.colPerson);
  const time = quoteIdent(s.colTime);
  if (!table || !person || !time) throw new Error('Hik source is not configured');

  const params = [cfg.tz, `${from} 00:00:00`, `${addDays(to, 1)} 00:00:00`];
  // `$1::text IS NOT NULL` is always true; it makes every query reference $1, which
  // Postgres insists on even for the one time type that needs no zone conversion.
  const where = ['$1::text IS NOT NULL', `${person} IS NOT NULL`, `${time} IS NOT NULL`, rangePredicate(time, s.timeType)];

  if (s.colEventType && s.eventTypes.length) {
    params.push(s.eventTypes);
    where.push(`${quoteIdent(s.colEventType)}::text = ANY($${params.length})`);
  }
  if (s.colDevice && s.devices.length) {
    params.push(s.devices);
    where.push(`${quoteIdent(s.colDevice)}::text = ANY($${params.length})`);
  }
  params.push(cfg.limits.maxEvents + 1);

  const name = s.colName && quoteIdent(s.colName);
  const text = `SELECT ${person}::text AS person_id, `
    + `${name ? `${name}::text` : 'NULL::text'} AS person_name, `
    + `${wallClockExpr(time, s.timeType)} AS punched_at `
    + `FROM ${table} WHERE ${where.join(' AND ')} ORDER BY ${time} LIMIT $${params.length}`;
  return { text, params };
}

let pool = null;
let poolKey = '';

function sslOption(db) {
  if (db.ssl === 'disable') return false;
  if (db.ssl === 'verify') {
    const ca = db.sslCaBase64 ? Buffer.from(db.sslCaBase64, 'base64').toString('utf8') : undefined;
    return { rejectUnauthorized: true, ...(ca ? { ca } : {}) };
  }
  // 'require': encrypted, certificate not verified. Stops passive sniffing of the
  // credentials and the punches; 'verify' is what stops an active interceptor.
  return { rejectUnauthorized: false };
}

function getPool(cfg) {
  const key = JSON.stringify(cfg.db);
  if (pool && key === poolKey) return pool;
  if (pool) pool.end().catch(() => {});
  pool = new pg.Pool({
    host: cfg.db.host, port: cfg.db.port, user: cfg.db.user,
    password: cfg.db.password, database: cfg.db.database,
    ssl: sslOption(cfg.db),
    max: 2,
    connectionTimeoutMillis: 8000,
    idleTimeoutMillis: 30000,
    application_name: 'ist-hr-attendance-sync',
  });
  // An idle client dropped by the server must not crash the process.
  pool.on('error', (e) => console.error('Hik pool error:', e.message));
  poolKey = key;
  return pool;
}

/** Runs one read-only statement and returns its rows. */
async function readOnly(cfg, text, params = []) {
  const client = await getPool(cfg).connect();
  try {
    await client.query('BEGIN READ ONLY');
    await client.query(`SET LOCAL statement_timeout = ${Number(cfg.limits.statementTimeoutMs) | 0}`);
    const res = await client.query(text, params);
    await client.query('COMMIT');
    return res.rows;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Door events between two dates, inclusive, as office wall-clock punches.
 *
 * @returns {Promise<{person_id: string, person_name: string, punched_at: string}[]>}
 * @throws when the configuration is incomplete or the result hit the safety cap —
 *   a truncated window would silently produce wrong "last punches".
 */
export async function fetchPunches({ from, to }, cfg = hikConfig()) {
  const problems = configProblems(cfg);
  if (problems.length) throw new Error(`Hik sync is not configured: ${problems[0]}`);
  const { text, params } = buildEventsQuery(cfg, { from, to });
  let rows;
  try {
    rows = await readOnly(cfg, text, params);
  } catch (err) {
    // The raw driver text can name the server and the user; the page and the email
    // get the classified version.
    throw new Error(classify(err));
  }
  if (rows.length > cfg.limits.maxEvents) {
    throw new Error(`More than ${cfg.limits.maxEvents} events between ${from} and ${to} — narrow the range`);
  }
  return rows;
}

/**
 * Proves the connection and the mapping without importing anything.
 * Never throws; problems come back as text.
 */
export async function testConnection(cfg = hikConfig()) {
  const problems = configProblems(cfg);
  if (problems.length) return { ok: false, problems };
  try {
    const s = cfg.source;
    const table = quoteQualified(s.table);
    const time = quoteIdent(s.colTime);
    const person = quoteIdent(s.colPerson);
    const [head] = await readOnly(cfg, `SELECT current_database() AS db, version() AS version`);
    const [stats] = await readOnly(cfg,
      `SELECT count(*)::bigint AS total, count(DISTINCT ${person}::text)::bigint AS people, `
      + `${wallClockExpr(`min(${time})`, s.timeType)} AS oldest, `
      + `${wallClockExpr(`max(${time})`, s.timeType)} AS newest FROM ${table} WHERE $1::text IS NOT NULL`, [cfg.tz]);
    return {
      ok: true,
      problems: [],
      database: head.db,
      server_version: String(head.version).split(' on ')[0],
      event_count: Number(stats.total),
      people_count: Number(stats.people),
      oldest_event: stats.oldest,
      newest_event: stats.newest,
      diagnostics: {
        host: cfg.db.host, port: cfg.db.port, table: s.table, time_type: s.timeType,
        time_zone: cfg.tz, tls: cfg.db.ssl, server_time_utc: new Date().toISOString(),
      },
    };
  } catch (err) {
    return { ok: false, problems: [classify(err)] };
  }
}

/** Turns a driver error into something an operator can act on. */
function classify(err) {
  const m = String(err?.message || err);
  if (err?.code === '28P01' || /password authentication failed/i.test(m)) return 'The database refused the user name or password';
  if (err?.code === '3D000') return 'That database does not exist on the server';
  if (err?.code === '42P01') return 'The events table was not found — check HIK_EVENTS_TABLE';
  if (err?.code === '42703') return 'A configured column does not exist — check the HIK_COL_* variables';
  // e.g. "operator does not exist: text >= timestamp" — the column is stored
  // differently from what HIK_EVENT_TIME_TYPE says.
  if (err?.code === '42883' || err?.code === '22007' || err?.code === '22008') {
    return 'The time column is not stored the way HIK_EVENT_TIME_TYPE says — check its type (text columns use text_local or text_utc)';
  }
  if (err?.code === '42501') return 'The database user is not allowed to read that table';
  if (err?.code === '57014') return 'The query timed out — is the time column indexed?';
  if (/ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EHOSTUNREACH/.test(m + (err?.code || ''))) return `Cannot reach the Hik database (${err.code || m})`;
  if (/SSL|TLS|certificate/i.test(m)) return 'TLS problem talking to the Hik database — see HIK_DB_SSL';
  return `The Hik database returned an error${err?.code ? ` (${err.code})` : ''}`;
}

/**
 * Lists the tables and columns the configured user can see, so the HIK_* mapping
 * can be filled in from facts rather than guesses. Read-only; system schemas are
 * excluded.
 */
export async function discoverSchema(cfg = hikConfig()) {
  const rows = await readOnly(cfg,
    `SELECT c.table_schema, c.table_name, c.column_name, c.data_type
       FROM information_schema.columns c
       JOIN information_schema.tables t
         ON t.table_schema = c.table_schema AND t.table_name = c.table_name
      WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY c.table_schema, c.table_name, c.ordinal_position
      LIMIT 5000`);
  const tables = new Map();
  for (const r of rows) {
    const k = `${r.table_schema}.${r.table_name}`;
    if (!tables.has(k)) tables.set(k, []);
    tables.get(k).push({ column: r.column_name, type: r.data_type });
  }
  return [...tables.entries()].map(([name, columns]) => ({ name, columns }));
}

export async function closeHikPool() {
  if (pool) { await pool.end().catch(() => {}); pool = null; poolKey = ''; }
}

export { configProblems, hikConfig };
