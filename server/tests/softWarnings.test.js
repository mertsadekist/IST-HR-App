import { describe, it, expect } from 'vitest';
import { isConfirmed, holdForConfirmation, overrideNote, expiryBeforeIssue } from '../services/softWarnings.js';

/** A response double that records what the route sent. */
const fakeRes = () => {
  const out = { status: null, body: null };
  return {
    out,
    status(c) { out.status = c; return this; },
    json(b) { out.body = b; return this; },
  };
};
const W = [{ code: 'expiry_before_issue', message: 'The expiry date is before the issue date.' }];

describe('isConfirmed', () => {
  it('accepts the values JSON and multipart forms actually send', () => {
    for (const v of [true, 1, 'true', '1']) expect(isConfirmed({ body: { confirm_warnings: v } })).toBe(true);
    for (const v of [false, 0, 'false', '', undefined]) expect(isConfirmed({ body: { confirm_warnings: v } })).toBe(false);
    expect(isConfirmed({})).toBe(false);
  });
});

describe('holdForConfirmation', () => {
  it('answers 409 needs_confirmation and tells the route to stop', () => {
    const res = fakeRes();
    expect(holdForConfirmation({ body: {} }, res, W)).toBe(true);
    expect(res.out.status).toBe(409);
    expect(res.out.body.needs_confirmation).toBe(true);
    expect(res.out.body.warnings).toEqual(W);
    expect(res.out.body.error).toContain('expiry date is before');
  });
  it('lets the request through once confirmed', () => {
    const res = fakeRes();
    expect(holdForConfirmation({ body: { confirm_warnings: 'true' } }, res, W)).toBe(false);
    expect(res.out.status).toBeNull();
  });
  it('does nothing when there is nothing to warn about', () => {
    const res = fakeRes();
    expect(holdForConfirmation({ body: {} }, res, [])).toBe(false);
    expect(holdForConfirmation({ body: {} }, res, undefined)).toBe(false);
    expect(res.out.status).toBeNull();
  });
});

describe('overrideNote', () => {
  it('records an override only when warnings existed and were confirmed', () => {
    expect(overrideNote({ body: { confirm_warnings: true } }, W)).toContain('expiry_before_issue');
    expect(overrideNote({ body: {} }, W)).toBe('');
    expect(overrideNote({ body: { confirm_warnings: true } }, [])).toBe('');
  });
});

describe('expiryBeforeIssue', () => {
  it('flags only a genuinely earlier expiry', () => {
    expect(expiryBeforeIssue('2026-05-01', '2026-04-01').code).toBe('expiry_before_issue');
    expect(expiryBeforeIssue('2026-05-01', '2026-05-01')).toBeNull();
    expect(expiryBeforeIssue('2026-05-01', '2027-05-01')).toBeNull();
    expect(expiryBeforeIssue(null, '2026-04-01')).toBeNull();
    expect(expiryBeforeIssue('2026-05-01', null)).toBeNull();
  });
});
