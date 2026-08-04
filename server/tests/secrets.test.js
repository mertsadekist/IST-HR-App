/**
 * Startup validation of the cryptographic secrets (docs/secrets_protection_design.md §3).
 *
 * The point of these tests is that a weak or duplicated key must be caught before
 * the process serves traffic, because `cryptoService.getKey()` will happily
 * SHA-256 the string "password" into a valid-looking 32-byte key.
 * Pure unit tests: no database needed.
 */
import { describe, it, expect } from 'vitest';
import { checkSecrets, verifySecrets } from '../config/verifySecrets.js';

const strongA = 'a3f1c9d47b2e8056fa1d3c7e9b4028af6d5e1c8b7a90f234d6e5c1b8a7f09321';
const strongB = '7c2e5a91d4b8036fe1a9c7d53b840621fa8e5d1c9b7034a2f6e5d1c8b9a70432';

describe('checkSecrets', () => {
  it('accepts two independent 32-byte hex keys', () => {
    const { errors, warnings } = checkSecrets({ JWT_SECRET: strongA, ENCRYPTION_KEY: strongB });
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
  });

  it('rejects a missing key', () => {
    const { errors } = checkSecrets({ JWT_SECRET: strongA });
    expect(errors.some((e) => /ENCRYPTION_KEY is not set/.test(e))).toBe(true);
  });

  it('rejects a short key', () => {
    const { errors } = checkSecrets({ JWT_SECRET: strongA, ENCRYPTION_KEY: 'short' });
    expect(errors.some((e) => /at least 32/.test(e))).toBe(true);
  });

  it('rejects a well-known placeholder even at full length', () => {
    const { errors } = checkSecrets({ JWT_SECRET: strongA, ENCRYPTION_KEY: 'changeme' });
    expect(errors.some((e) => /placeholder/.test(e))).toBe(true);
  });

  it('rejects a repeated-character key', () => {
    const { errors } = checkSecrets({ JWT_SECRET: strongA, ENCRYPTION_KEY: 'a'.repeat(64) });
    expect(errors.some((e) => /too little variety/.test(e))).toBe(true);
  });

  it('rejects reusing one secret for both purposes', () => {
    const { errors } = checkSecrets({ JWT_SECRET: strongA, ENCRYPTION_KEY: strongA });
    expect(errors.some((e) => /must not be the same value as JWT_SECRET/.test(e))).toBe(true);
  });

  it('warns, but does not fail, when the key is not raw hex', () => {
    const passphrase = 'correct-horse-battery-staple-9f2b-Xq7!';
    const { errors, warnings } = checkSecrets({ JWT_SECRET: strongA, ENCRYPTION_KEY: passphrase });
    expect(errors).toEqual([]);
    expect(warnings.some((w) => /SHA-256 hashed/.test(w))).toBe(true);
  });
});

describe('verifySecrets', () => {
  it('throws in production when a secret is unusable', () => {
    expect(() => verifySecrets({
      env: { JWT_SECRET: strongA, ENCRYPTION_KEY: 'changeme' }, isProduction: true,
    })).toThrow(/Refusing to start/);
  });

  it('warns but continues outside production, so a local database stays workable', () => {
    expect(() => verifySecrets({
      env: { JWT_SECRET: strongA, ENCRYPTION_KEY: 'changeme' }, isProduction: false,
    })).not.toThrow();
  });

  it('passes cleanly with good secrets in production', () => {
    expect(() => verifySecrets({
      env: { JWT_SECRET: strongA, ENCRYPTION_KEY: strongB }, isProduction: true,
    })).not.toThrow();
  });
});
