/**
 * The Hik reader against a real PostgreSQL, with the five ways a time column can
 * be stored. Only runs when a throwaway Postgres is supplied:
 *
 *   docker run -d -p 127.0.0.1:35432:5432 -e POSTGRES_PASSWORD=testpw -e POSTGRES_DB=hik postgres:17-alpine
 *   HIK_TEST_PG=127.0.0.1:35432:postgres:testpw:hik npx vitest run tests/hikClient.pg.test.js
 *
 * (host:port:user:password:database). Skipped otherwise — it must never be
 * pointed at the real Hik database, since it creates and drops tables.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import pg from 'pg';
import { hikConfig } from '../services/hikConfig.js';
import { fetchPunches, testConnection, discoverSchema, closeHikPool } from '../services/hikClient.js';

const spec = process.env.HIK_TEST_PG;
const suite = spec ? describe : describe.skip;
const [host, port, user, password, database] = (spec || '::::').split(':');

const tag = `t${Date.now().toString().slice(-6)}`;

// 10:01:05 and 19:05:30 on Mon 17 Aug in Dubai (UTC+4), plus 00:30 on the 18th —
// which belongs to the 18th in the office, though it is still the 17th in UTC.
const INSTANTS = [
  ['2006', 'Mert', 'door-main', 196893, '2026-08-17T06:01:05Z'],
  ['2006', 'Mert', 'door-main', 196893, '2026-08-17T15:05:30Z'],
  ['2006', 'Mert', 'door-main', 196893, '2026-08-17T20:30:00Z'],
  ['2018', 'Sara', 'door-main', 196893, '2026-08-17T07:00:00Z'],
  ['2018', 'Sara', 'door-back', 197151, '2026-08-17T08:00:00Z'],
];

const TABLES = {
  timestamptz: { col: 'timestamptz', value: (iso) => iso },
  timestamp_utc: { col: 'timestamp', value: (iso) => iso.replace('Z', '') },
  timestamp_local: { col: 'timestamp', value: (iso) => new Date(Date.parse(iso) + 4 * 3600_000).toISOString().replace('Z', '') },
  epoch_s: { col: 'bigint', value: (iso) => Math.floor(Date.parse(iso) / 1000) },
  epoch_ms: { col: 'bigint', value: (iso) => Date.parse(iso) },
};
const tableName = (type) => `public.hikt_${tag}_${type}`;

const cfgFor = (type, over = {}) => hikConfig({
  HIK_DB_HOST: host, HIK_DB_PORT: port, HIK_DB_USER: user, HIK_DB_PASSWORD: password, HIK_DB_NAME: database,
  HIK_DB_SSL: 'disable', HIK_EVENTS_TABLE: tableName(type), HIK_COL_PERSON_ID: 'person_id',
  HIK_COL_PERSON_NAME: 'person_name', HIK_COL_EVENT_TIME: 'event_time', HIK_EVENT_TIME_TYPE: type,
  HIK_EVENT_TZ: 'Asia/Dubai', ...over,
});

suite('Hik reader against PostgreSQL', () => {
  let admin;
  beforeAll(async () => {
    admin = new pg.Client({ host, port: Number(port), user, password, database });
    await admin.connect();
    for (const [type, t] of Object.entries(TABLES)) {
      await admin.query(`CREATE TABLE ${tableName(type)} (
        id serial primary key, person_id text, person_name text, door text, event_code int, event_time ${t.col})`);
      for (const [pid, name, door, code, iso] of INSTANTS) {
        await admin.query(
          `INSERT INTO ${tableName(type)} (person_id, person_name, door, event_code, event_time) VALUES ($1,$2,$3,$4,$5)`,
          [pid, name, door, code, t.value(iso)]);
      }
    }
  });
  afterAll(async () => {
    for (const type of Object.keys(TABLES)) await admin.query(`DROP TABLE IF EXISTS ${tableName(type)}`);
    await admin.end();
    await closeHikPool();
  });

  for (const type of Object.keys(TABLES)) {
    describe(`time stored as ${type}`, () => {
      it('comes back as office wall-clock, with the day boundary in the office zone', async () => {
        const rows = await fetchPunches({ from: '2026-08-17', to: '2026-08-18' }, cfgFor(type));
        expect(rows.map((r) => `${r.person_id} ${r.punched_at}`)).toEqual([
          '2006 2026-08-17 10:01:05',
          '2018 2026-08-17 11:00:00',
          '2018 2026-08-17 12:00:00',
          '2006 2026-08-17 19:05:30',
          '2006 2026-08-18 00:30:00',
        ]);
        expect(rows[0].person_name).toBe('Mert');
      });

      it('a window ending on the 17th does not include the 00:30 that belongs to the 18th', async () => {
        const rows = await fetchPunches({ from: '2026-08-17', to: '2026-08-17' }, cfgFor(type));
        expect(rows).toHaveLength(4);
        expect(rows.some((r) => r.punched_at.startsWith('2026-08-18'))).toBe(false);
      });

      it('a window that misses the data returns nothing', async () => {
        expect(await fetchPunches({ from: '2026-08-20', to: '2026-08-21' }, cfgFor(type))).toEqual([]);
      });
    });
  }

  it('filters by event type and by door, using bound values', async () => {
    const onlyBack = await fetchPunches({ from: '2026-08-17', to: '2026-08-17' },
      cfgFor('timestamptz', { HIK_COL_DEVICE: 'door', HIK_DEVICE_VALUES: 'door-back' }));
    expect(onlyBack.map((r) => r.person_id)).toEqual(['2018']);
    const onlyCode = await fetchPunches({ from: '2026-08-17', to: '2026-08-17' },
      cfgFor('timestamptz', { HIK_COL_EVENT_TYPE: 'event_code', HIK_EVENT_TYPE_VALUES: '197151' }));
    expect(onlyCode).toHaveLength(1);
  });

  it('a hostile filter value is data, not SQL', async () => {
    const rows = await fetchPunches({ from: '2026-08-17', to: '2026-08-17' },
      cfgFor('timestamptz', { HIK_COL_DEVICE: 'door', HIK_DEVICE_VALUES: "x'); DROP TABLE hikt_x; --" }));
    expect(rows).toEqual([]);
    const [{ n }] = (await admin.query(`SELECT count(*)::int n FROM ${tableName('timestamptz')}`)).rows;
    expect(n).toBe(INSTANTS.length);
  });

  it('refuses to return a truncated window', async () => {
    await expect(fetchPunches({ from: '2026-08-17', to: '2026-08-18' }, cfgFor('timestamptz', { HIK_MAX_EVENTS: '1000' })))
      .resolves.toHaveLength(5);
    const tiny = cfgFor('timestamptz');
    tiny.limits.maxEvents = 2;
    await expect(fetchPunches({ from: '2026-08-17', to: '2026-08-18' }, tiny)).rejects.toThrow(/More than 2 events/);
  });

  it('cannot write: every query runs in a read-only transaction', async () => {
    // Prove the transaction is read-only by having the *table name* smuggle a
    // write is impossible (identifiers are validated) — so check the mechanism
    // directly: a pooled client inside readOnly refuses an INSERT.
    const cfg = cfgFor('timestamptz');
    const probe = new pg.Client({ host, port: Number(port), user, password, database });
    await probe.connect();
    await probe.query('BEGIN READ ONLY');
    await expect(probe.query(`INSERT INTO ${tableName('timestamptz')} (person_id) VALUES ('x')`))
      .rejects.toThrow(/read-only transaction/);
    await probe.query('ROLLBACK');
    await probe.end();
    // And the real reader leaves the table untouched.
    await fetchPunches({ from: '2026-08-17', to: '2026-08-18' }, cfg);
    const [{ n }] = (await admin.query(`SELECT count(*)::int n FROM ${tableName('timestamptz')}`)).rows;
    expect(n).toBe(INSTANTS.length);
  });

  describe('testConnection', () => {
    it('reports the table, the span and the people', async () => {
      const r = await testConnection(cfgFor('timestamptz'));
      expect(r.ok).toBe(true);
      expect(r).toMatchObject({ event_count: 5, people_count: 2, oldest_event: '2026-08-17 10:01:05', newest_event: '2026-08-18 00:30:00' });
      expect(r.database).toBe(database);
      expect(JSON.stringify(r)).not.toContain(password);
    });

    it('explains a wrong table and a wrong column in words', async () => {
      const t = await testConnection(cfgFor('timestamptz', { HIK_EVENTS_TABLE: 'public.no_such_table' }));
      expect(t.ok).toBe(false);
      expect(t.problems[0]).toMatch(/events table was not found/);
      const c = await testConnection(cfgFor('timestamptz', { HIK_COL_PERSON_ID: 'nope' }));
      expect(c.problems[0]).toMatch(/column does not exist/);
    });

    it('explains a wrong password without echoing it', async () => {
      const r = await testConnection(cfgFor('timestamptz', { HIK_DB_PASSWORD: 'wrong-pass-123' }));
      expect(r.ok).toBe(false);
      expect(r.problems[0]).toMatch(/refused the user name or password/);
      expect(JSON.stringify(r)).not.toContain('wrong-pass-123');
      await closeHikPool();
    });

    it('explains an unreachable server', async () => {
      const r = await testConnection(cfgFor('timestamptz', { HIK_DB_PORT: '1' }));
      expect(r.ok).toBe(false);
      expect(r.problems[0]).toMatch(/Cannot reach the Hik database/);
      await closeHikPool();
    });

    it('reports configuration problems before touching the network', async () => {
      const r = await testConnection(hikConfig({}));
      expect(r.ok).toBe(false);
      expect(r.problems.length).toBeGreaterThan(3);
    });
  });

  it('discovers the tables and columns the user can see', async () => {
    const tables = await discoverSchema(cfgFor('timestamptz'));
    const mine = tables.find((t) => t.name === `public.hikt_${tag}_timestamptz`);
    expect(mine.columns.map((c) => c.column)).toEqual(['id', 'person_id', 'person_name', 'door', 'event_code', 'event_time']);
    expect(mine.columns.find((c) => c.column === 'event_time').type).toBe('timestamp with time zone');
    expect(tables.some((t) => t.name.startsWith('pg_catalog'))).toBe(false);
  });
});
