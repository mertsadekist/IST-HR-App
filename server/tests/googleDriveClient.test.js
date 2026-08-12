/**
 * The Drive client's pure parts: reading configuration and saying clearly what
 * is wrong with it. No network — the request paths are exercised by
 * check_drive_sync.mjs against the real folder.
 *
 * The private key is the field most likely to arrive mangled, because it makes
 * a round trip through a JSON file and an environment-variable editor before it
 * gets here. These pin the shapes that must keep working.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { driveConfig, configProblems, isConfigured } from '../services/googleDriveClient.js';

const KEY_BODY = 'MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQ';
const REAL_PEM = `-----BEGIN PRIVATE KEY-----\n${KEY_BODY}\n-----END PRIVATE KEY-----\n`;
const ESCAPED_PEM = `-----BEGIN PRIVATE KEY-----\\n${KEY_BODY}\\n-----END PRIVATE KEY-----\\n`;

const VARS = ['GOOGLE_DRIVE_SA_EMAIL', 'GOOGLE_DRIVE_SA_PRIVATE_KEY', 'ATTENDANCE_DRIVE_FOLDER_ID'];
let saved;

beforeEach(() => {
  saved = Object.fromEntries(VARS.map((v) => [v, process.env[v]]));
  for (const v of VARS) delete process.env[v];
});
afterEach(() => {
  for (const v of VARS) {
    if (saved[v] === undefined) delete process.env[v];
    else process.env[v] = saved[v];
  }
});

const setAll = (key = REAL_PEM) => {
  process.env.GOOGLE_DRIVE_SA_EMAIL = 'sa@proj.iam.gserviceaccount.com';
  process.env.GOOGLE_DRIVE_SA_PRIVATE_KEY = key;
  process.env.ATTENDANCE_DRIVE_FOLDER_ID = '1MeYGbZGV0F21On1YgHe54';
};

describe('the private key, however it was pasted', () => {
  it('accepts a key with real newlines', () => {
    setAll(REAL_PEM);
    expect(driveConfig().key).toContain('\n');
    expect(driveConfig().key.split('\n')[0]).toBe('-----BEGIN PRIVATE KEY-----');
  });

  it('accepts a key with literal backslash-n, as it appears inside the JSON file', () => {
    setAll(ESCAPED_PEM);
    const k = driveConfig().key;
    expect(k).not.toContain('\\n');
    expect(k.split('\n')[0]).toBe('-----BEGIN PRIVATE KEY-----');
    expect(k.split('\n')[1]).toBe(KEY_BODY);
  });

  it('strips wrapping quotes some env editors add', () => {
    setAll(`"${ESCAPED_PEM}"`);
    expect(driveConfig().key.startsWith('-----BEGIN')).toBe(true);
    expect(driveConfig().key).not.toContain('"');
  });

  it('trims stray whitespace around the email and folder id', () => {
    setAll();
    process.env.GOOGLE_DRIVE_SA_EMAIL = '  sa@proj.iam.gserviceaccount.com  ';
    process.env.ATTENDANCE_DRIVE_FOLDER_ID = ' 1MeYGbZ \n';
    expect(driveConfig().email).toBe('sa@proj.iam.gserviceaccount.com');
    expect(driveConfig().folderId).toBe('1MeYGbZ');
  });
});

describe('saying what is wrong, in words the operator can act on', () => {
  it('is not configured when nothing is set', () => {
    expect(isConfigured()).toBe(false);
    expect(configProblems()).toHaveLength(3);
  });

  it('names each missing variable', () => {
    const p = configProblems().join(' | ');
    expect(p).toContain('GOOGLE_DRIVE_SA_EMAIL');
    expect(p).toContain('GOOGLE_DRIVE_SA_PRIVATE_KEY');
    expect(p).toContain('ATTENDANCE_DRIVE_FOLDER_ID');
  });

  it('catches the whole JSON file pasted in instead of just the key', () => {
    setAll('{"type":"service_account","private_key_id":"abc"}');
    expect(configProblems()[0]).toMatch(/does not contain a PEM key/);
  });

  it('catches an email that is not one', () => {
    setAll();
    process.env.GOOGLE_DRIVE_SA_EMAIL = 'my-service-account';
    expect(configProblems()[0]).toMatch(/does not look like an email/);
  });

  it('is configured once all three are present and well-formed', () => {
    setAll();
    expect(configProblems()).toEqual([]);
    expect(isConfigured()).toBe(true);
  });
});
