/**
 * Fixes from the security audit that can be proved without a database.
 */
import { describe, it, expect } from 'vitest';
import path from 'path';
import { uploadPath, UPLOADS_DIR } from '../config/storage.js';
import { rateLimit } from '../middleware/rateLimit.js';

describe('uploadPath cannot leave the uploads volume', () => {
  it('resolves ordinary names inside it', () => {
    expect(uploadPath('employee_docs', 'abc123.pdf')).toBe(path.resolve(UPLOADS_DIR, 'employee_docs', 'abc123.pdf'));
  });

  it('refuses a stored name that climbs out of it', () => {
    // The shape of the attack: a client-supplied file_path saved with a record and
    // read back by the download and delete routes.
    for (const evil of ['../../../../etc/passwd', 'a/../../../b', '/etc/passwd']) {
      expect(() => uploadPath('employee_docs', evil), evil).toThrow(/escapes/);
    }
  });

  it('refuses a climb that hides in the folder segment too', () => {
    expect(() => uploadPath('..', 'x')).toThrow(/escapes/);
  });
});

describe('rate limit buckets do not depend on URL case', () => {
  const hit = (limiter, url, ip = '1.2.3.4') => {
    const [baseUrl, ...rest] = [url];
    const req = { baseUrl, path: '', ip, connection: {} };
    let status = 200;
    const res = { setHeader() {}, status(c) { status = c; return this; }, json() { return this; } };
    limiter(req, res, () => {});
    return status;
  };

  it('counts /api/auth/login, /API/AUTH/LOGIN and a trailing slash against the same allowance', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 3 });
    const variants = ['/api/auth/login', '/API/auth/login', '/api/AUTH/login', '/api/auth/login/', '/Api/Auth/Login'];
    const statuses = variants.map((v) => hit(limiter, v));
    expect(statuses).toEqual([200, 200, 200, 429, 429]);
  });

  it('still separates different clients and different endpoints', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1 });
    expect(hit(limiter, '/api/a', '9.9.9.1')).toBe(200);
    expect(hit(limiter, '/api/a', '9.9.9.2')).toBe(200);
    expect(hit(limiter, '/api/b', '9.9.9.1')).toBe(200);
    expect(hit(limiter, '/api/a', '9.9.9.1')).toBe(429);
  });
});
