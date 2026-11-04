/**
 * The Hik configuration and the SQL built from it. No network.
 *
 * Table and column names come from environment variables and end up inside SQL,
 * where identifiers cannot be bound as parameters. These tests exist to make sure
 * that path can only ever produce a quoted identifier — and that every value
 * (the time window, the filters) stays a bound parameter.
 */
import { describe, it, expect } from 'vitest';
import {
  hikConfig, configProblems, quoteQualified, quoteIdent, isConfigured,
} from '../services/hikConfig.js';
import { buildEventsQuery, wallClockExpr, rangePredicate } from '../services/hikClient.js';

const goodEnv = {
  HIK_DB_HOST: 'hik.example.test', HIK_DB_USER: 'reader', HIK_DB_PASSWORD: 'pw', HIK_DB_NAME: 'hikdb',
  HIK_EVENTS_TABLE: 'public.attendance_events', HIK_COL_PERSON_ID: 'person_id',
  HIK_COL_EVENT_TIME: 'event_time', HIK_EVENT_TIME_TYPE: 'timestamptz', HIK_EVENT_TZ: 'Asia/Dubai',
};
const cfgOf = (over = {}) => hikConfig({ ...goodEnv, ...over });

describe('configuration', () => {
  it('is complete with the required variables', () => {
    expect(configProblems(cfgOf())).toEqual([]);
    expect(isConfigured(cfgOf())).toBe(true);
  });

  it('names exactly what is missing, and never prints a secret', () => {
    const problems = configProblems(hikConfig({}));
    expect(problems).toContain('HIK_DB_HOST is not set');
    expect(problems).toContain('HIK_EVENTS_TABLE is not set');
    const withSecret = configProblems(cfgOf({ HIK_DB_PASSWORD: 'hunter2-secret', HIK_DB_HOST: '' }));
    expect(withSecret.join(' ')).not.toContain('hunter2-secret');
  });

  it('defaults TLS on in production and off in development', () => {
    expect(hikConfig({ ...goodEnv, NODE_ENV: 'production' }).db.ssl).toBe('require');
    expect(hikConfig({ ...goodEnv, NODE_ENV: 'development' }).db.ssl).toBe('disable');
  });

  it('rejects an unknown TLS mode, time type or time zone', () => {
    expect(configProblems(cfgOf({ HIK_DB_SSL: 'sometimes' })).join()).toMatch(/HIK_DB_SSL/);
    expect(configProblems(cfgOf({ HIK_EVENT_TIME_TYPE: 'banana' })).join()).toMatch(/HIK_EVENT_TIME_TYPE/);
    expect(configProblems(cfgOf({ HIK_EVENT_TZ: 'Mars/Olympus' })).join()).toMatch(/time zone/);
  });

  it('clamps numeric settings instead of trusting them', () => {
    const c = cfgOf({ HIK_SYNC_INTERVAL_MINUTES: '0', HIK_SYNC_LOOKBACK_DAYS: '9999', HIK_MIN_STAY_MINUTES: 'abc' });
    expect(c.schedule.intervalMinutes).toBe(1);
    expect(c.schedule.lookbackDays).toBe(31);
    expect(c.rules.minStayMinutes).toBe(30);
  });

  it('ignores a malformed start date', () => {
    expect(cfgOf({ HIK_SYNC_START_DATE: 'yesterday' }).schedule.startDate).toBeNull();
    expect(cfgOf({ HIK_SYNC_START_DATE: '2026-08-01' }).schedule.startDate).toBe('2026-08-01');
  });

  it('a filter value without its column is a configuration error, not a silent no-op', () => {
    expect(configProblems(cfgOf({ HIK_EVENT_TYPE_VALUES: '1,2' })).join()).toMatch(/needs HIK_COL_EVENT_TYPE/);
    expect(configProblems(cfgOf({ HIK_DEVICE_VALUES: 'door1' })).join()).toMatch(/needs HIK_COL_DEVICE/);
  });
});

describe('identifiers can only ever be quoted names', () => {
  it('quotes plain and schema-qualified names', () => {
    expect(quoteQualified('events')).toBe('"events"');
    expect(quoteQualified('public.events')).toBe('"public"."events"');
    expect(quoteIdent('person_id')).toBe('"person_id"');
  });

  const attacks = [
    'events; DROP TABLE users', 'events--', 'ev"ents', "ev'ents", 'a.b.c', 'events UNION SELECT 1',
    '1events', '', ' ', 'public.', '.events', 'ev ents', 'ev\nents','ev/*x*/ents',
  ];
  for (const bad of attacks) {
    it(`refuses ${JSON.stringify(bad)}`, () => {
      expect(quoteQualified(bad)).toBeNull();
    });
  }

  it('turns an unsafe configured name into a configuration problem, so it never reaches a query', () => {
    expect(configProblems(cfgOf({ HIK_EVENTS_TABLE: 'events; DROP TABLE x' })).join()).toMatch(/HIK_EVENTS_TABLE/);
    expect(configProblems(cfgOf({ HIK_COL_PERSON_ID: 'id" OR 1=1 --' })).join()).toMatch(/HIK_COL_PERSON_ID/);
  });

  it('refuses to build a query from an unsafe name even if validation were skipped', () => {
    expect(() => buildEventsQuery(cfgOf({ HIK_COL_EVENT_TIME: 'x; DROP TABLE y' }), { from: '2026-08-01', to: '2026-08-02' }))
      .toThrow(/not configured/);
  });
});

describe('the events query', () => {
  const range = { from: '2026-08-17', to: '2026-08-18' };

  it('binds the window and the zone; nothing from the range is in the SQL text', () => {
    const { text, params } = buildEventsQuery(cfgOf(), range);
    expect(params.slice(0, 3)).toEqual(['Asia/Dubai', '2026-08-17 00:00:00', '2026-08-19 00:00:00']);
    expect(text).not.toContain('2026');
    expect(text).toContain('FROM "public"."attendance_events"');
    expect(text).toContain('"person_id"::text AS person_id');
  });

  it('takes the end date inclusively by reading up to the start of the next day', () => {
    const { params } = buildEventsQuery(cfgOf(), { from: '2026-08-31', to: '2026-08-31' });
    expect(params[2]).toBe('2026-09-01 00:00:00');
  });

  it('always references $1 so Postgres can type it, whatever the time type', () => {
    for (const t of ['timestamptz', 'timestamp_local', 'timestamp_utc', 'epoch_s', 'epoch_ms', 'text_local', 'text_utc']) {
      const { text } = buildEventsQuery(cfgOf({ HIK_EVENT_TIME_TYPE: t }), range);
      expect(text).toContain('$1');
    }
  });

  it('caps the rows it will return, one above the limit so truncation is detectable', () => {
    const { params, text } = buildEventsQuery(cfgOf({ HIK_MAX_EVENTS: '5000' }), range);
    expect(params[params.length - 1]).toBe(5001);
    expect(text).toMatch(/LIMIT \$\d+$/);
  });

  it('adds the optional filters as bound arrays', () => {
    const { text, params } = buildEventsQuery(cfgOf({
      HIK_COL_EVENT_TYPE: 'event_code', HIK_EVENT_TYPE_VALUES: '196893, 197151',
      HIK_COL_DEVICE: 'door_name', HIK_DEVICE_VALUES: 'Main Entrance',
    }), range);
    expect(text).toContain('"event_code"::text = ANY($4)');
    expect(text).toContain('"door_name"::text = ANY($5)');
    expect(params[3]).toEqual(['196893', '197151']);
    expect(params[4]).toEqual(['Main Entrance']);
  });

  it('selects a name only when one is mapped', () => {
    expect(buildEventsQuery(cfgOf(), range).text).toContain('NULL::text AS person_name');
    expect(buildEventsQuery(cfgOf({ HIK_COL_PERSON_NAME: 'person_name' }), range).text)
      .toContain('"person_name"::text AS person_name');
  });

  it('is a single read-only SELECT', () => {
    const { text } = buildEventsQuery(cfgOf(), range);
    expect(text.startsWith('SELECT ')).toBe(true);
    expect(text).not.toMatch(/;|\b(INSERT|UPDATE|DELETE|DROP|ALTER)\b/i);
  });
});

describe('time conversion', () => {
  it('turns every supported storage into office wall-clock text', () => {
    expect(wallClockExpr('"t"', 'timestamptz')).toContain('AT TIME ZONE $1');
    expect(wallClockExpr('"t"', 'timestamp_local')).toBe('to_char("t", \'YYYY-MM-DD HH24:MI:SS\')');
    expect(wallClockExpr('"t"', 'timestamp_utc')).toContain("AT TIME ZONE 'UTC'");
    expect(wallClockExpr('"t"', 'epoch_s')).toContain('to_timestamp("t")');
    expect(wallClockExpr('"t"', 'epoch_ms')).toContain('"t" / 1000.0');
    expect(() => wallClockExpr('"t"', 'weird')).toThrow();
  });

  it('range predicates stay on the raw column so an index can be used', () => {
    for (const t of ['timestamptz', 'timestamp_local', 'timestamp_utc', 'epoch_s', 'epoch_ms']) {
      const p = rangePredicate('"t"', t);
      expect(p.startsWith('"t" >=')).toBe(true);
      expect(p).not.toContain('to_char');
    }
  });

  it('reads a text column only when it looks like a date-time, so one bad row cannot fail the read', () => {
    for (const t of ['text_local', 'text_utc']) {
      for (const sql of [wallClockExpr('"t"', t), rangePredicate('"t"', t)]) {
        expect(sql).toContain('CASE WHEN "t"::text ~');
        expect(sql).toContain('::timestamp END');
      }
    }
    expect(wallClockExpr('"t"', 'text_utc')).toContain("AT TIME ZONE 'UTC'");
  });
});
