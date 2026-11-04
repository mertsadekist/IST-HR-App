/**
 * Everything the Hik Central sync reads from the environment, validated once.
 *
 * Nothing about the Hik database's layout is hard-coded: the table and column
 * names come from HIK_* variables, so the same code works against whatever the
 * synchronised copy turns out to look like. That makes the names *operator
 * input that ends up in SQL*, and identifiers cannot be bound as parameters — so
 * they are checked against a strict pattern and double-quoted before they go
 * anywhere near a query. A value that does not match is a configuration problem,
 * never something to be escaped and used.
 *
 * Secrets (HIK_DB_PASSWORD) are runtime-only, like every other credential here.
 */

const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

/** How the event-time column is stored, and so how it becomes office wall-clock. */
export const TIME_TYPES = Object.freeze([
  'timestamptz',      // timestamp with time zone — unambiguous, the best case
  'timestamp_local',  // timestamp without tz, already in office local time
  'timestamp_utc',    // timestamp without tz, holding UTC
  'epoch_s',          // integer seconds since 1970
  'epoch_ms',         // integer milliseconds since 1970
]);

const SSL_MODES = Object.freeze(['require', 'verify', 'disable']);

/** `"public"."events"` from `public.events`, or null if either part is unsafe. */
export function quoteQualified(name) {
  const parts = String(name || '').trim().split('.');
  if (parts.length < 1 || parts.length > 2) return null;
  if (!parts.every((p) => IDENT.test(p))) return null;
  return parts.map((p) => `"${p}"`).join('.');
}

export function quoteIdent(name) {
  const n = String(name || '').trim();
  return IDENT.test(n) ? `"${n}"` : null;
}

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);
const int = (v, fallback, min, max) => {
  const n = parseInt(String(v ?? '').trim(), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

function validTimeZone(tz) {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

/**
 * The effective configuration. Read from `env` each call so tests (and a changed
 * variable) are picked up without a restart of the module graph.
 */
export function hikConfig(env = process.env) {
  const tz = (env.HIK_EVENT_TZ || env.TZ || env.APP_TZ || 'Asia/Dubai').trim();
  return {
    db: {
      host: (env.HIK_DB_HOST || '').trim(),
      port: int(env.HIK_DB_PORT, 5432, 1, 65535),
      user: (env.HIK_DB_USER || '').trim(),
      password: env.HIK_DB_PASSWORD || '',
      database: (env.HIK_DB_NAME || '').trim(),
      ssl: (env.HIK_DB_SSL || (env.NODE_ENV === 'production' ? 'require' : 'disable')).trim().toLowerCase(),
      sslCaBase64: (env.HIK_DB_SSL_CA || '').trim(),
    },
    source: {
      table: (env.HIK_EVENTS_TABLE || '').trim(),
      colPerson: (env.HIK_COL_PERSON_ID || '').trim(),
      colName: (env.HIK_COL_PERSON_NAME || '').trim(),
      colTime: (env.HIK_COL_EVENT_TIME || '').trim(),
      timeType: (env.HIK_EVENT_TIME_TYPE || 'timestamptz').trim().toLowerCase(),
      // Optional narrowing: which rows of the table are real door entries.
      colEventType: (env.HIK_COL_EVENT_TYPE || '').trim(),
      eventTypes: list(env.HIK_EVENT_TYPE_VALUES),
      colDevice: (env.HIK_COL_DEVICE || '').trim(),
      devices: list(env.HIK_DEVICE_VALUES),
    },
    tz,
    rules: {
      // Two taps close together are a door double-tap, not "arrived" and "left".
      minStayMinutes: int(env.HIK_MIN_STAY_MINUTES, 30, 0, 600),
    },
    schedule: {
      intervalMinutes: int(env.HIK_SYNC_INTERVAL_MINUTES, 5, 1, 120),
      lookbackDays: int(env.HIK_SYNC_LOOKBACK_DAYS, 2, 0, 31),
      finalizeHour: int(env.HIK_FINALIZE_HOUR, 5, 0, 23),
      finalizeMinute: int(env.HIK_FINALIZE_MINUTE, 0, 0, 59),
      startDate: /^\d{4}-\d{2}-\d{2}$/.test((env.HIK_SYNC_START_DATE || '').trim())
        ? env.HIK_SYNC_START_DATE.trim() : null,
    },
    limits: {
      statementTimeoutMs: int(env.HIK_STATEMENT_TIMEOUT_MS, 20000, 1000, 120000),
      maxEvents: int(env.HIK_MAX_EVENTS, 200000, 1000, 2000000),
      maxBackfillDays: 93,
    },
  };
}

/**
 * What is wrong with the configuration, in words an operator can act on. Empty
 * means the sync may run. Never includes a secret's value.
 */
export function configProblems(cfg = hikConfig()) {
  const p = [];
  const { db, source } = cfg;
  if (!db.host) p.push('HIK_DB_HOST is not set');
  if (!db.user) p.push('HIK_DB_USER is not set');
  if (!db.password) p.push('HIK_DB_PASSWORD is not set');
  if (!db.database) p.push('HIK_DB_NAME is not set');
  if (!SSL_MODES.includes(db.ssl)) p.push(`HIK_DB_SSL must be one of ${SSL_MODES.join(', ')}`);

  if (!source.table) p.push('HIK_EVENTS_TABLE is not set');
  else if (!quoteQualified(source.table)) p.push('HIK_EVENTS_TABLE must be a table name like events or public.events (letters, digits, underscore)');

  const need = [['HIK_COL_PERSON_ID', source.colPerson], ['HIK_COL_EVENT_TIME', source.colTime]];
  for (const [k, v] of need) {
    if (!v) p.push(`${k} is not set`);
    else if (!quoteIdent(v)) p.push(`${k} must be a plain column name`);
  }
  const optional = [
    ['HIK_COL_PERSON_NAME', source.colName],
    ['HIK_COL_EVENT_TYPE', source.colEventType],
    ['HIK_COL_DEVICE', source.colDevice],
  ];
  for (const [k, v] of optional) if (v && !quoteIdent(v)) p.push(`${k} must be a plain column name`);
  if (source.eventTypes.length && !source.colEventType) p.push('HIK_EVENT_TYPE_VALUES needs HIK_COL_EVENT_TYPE');
  if (source.devices.length && !source.colDevice) p.push('HIK_DEVICE_VALUES needs HIK_COL_DEVICE');
  if (!TIME_TYPES.includes(source.timeType)) p.push(`HIK_EVENT_TIME_TYPE must be one of ${TIME_TYPES.join(', ')}`);
  if (!validTimeZone(cfg.tz)) p.push(`HIK_EVENT_TZ "${cfg.tz}" is not a valid time zone`);
  return p;
}

export function isConfigured(cfg = hikConfig()) {
  return configProblems(cfg).length === 0;
}
