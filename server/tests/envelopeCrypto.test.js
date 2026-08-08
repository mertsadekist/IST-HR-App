/**
 * Envelope encryption (docs/secrets_protection_design.md §2, security step 4).
 *
 * These assert the properties the design exists for: one compromised data key
 * exposes one record, a ciphertext cannot be moved between rows, and rotating
 * the master key does not orphan anything.
 * Pure unit tests: no database.
 */
import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret, aadFor, isLegacyRecord, isEnvelopeRecord, needsRewrap } from '../services/envelopeCrypto.js';
import { getKeyProvider, availableKeyVersions } from '../services/keyProvider.js';

const K1 = 'a3f1c9d47b2e8056fa1d3c7e9b4028af6d5e1c8b7a90f234d6e5c1b8a7f09321';
const K2 = '7c2e5a91d4b8036fe1a9c7d53b840621fa8e5d1c9b7034a2f6e5d1c8b9a70432';

// A provider bound to explicit key material, so the tests never depend on the
// developer's own .env.
const providerWith = (env) => {
  const real = getKeyProvider('local');
  const saved = { ...process.env };
  return {
    name: 'test',
    wrapDek(dek, v) { Object.assign(process.env, env); try { return real.wrapDek(dek, v); } finally { process.env = { ...saved }; } },
    unwrapDek(w) { Object.assign(process.env, env); try { return real.unwrapDek(w); } finally { process.env = { ...saved }; } },
  };
};

const P1 = providerWith({ ENCRYPTION_KEY: K1, ENCRYPTION_KEY_VERSION: '1' });
const AAD = aadFor({ table: 'asset_assignments', id: 42, field: 'password', companyId: 7 });

describe('aadFor', () => {
  it('binds table, row, field and company into one identity', () => {
    expect(AAD).toBe('asset_assignments:42:password:7');
  });
});

describe('encrypt / decrypt round trip', () => {
  it('returns the original value', () => {
    const rec = encryptSecret('hunter2-correct-horse', AAD, P1);
    expect(decryptSecret(rec, AAD, P1)).toBe('hunter2-correct-horse');
  });

  it('never stores the plaintext', () => {
    const rec = encryptSecret('topsecret42', AAD, P1);
    expect(JSON.stringify(rec)).not.toContain('topsecret42');
  });

  it('uses a fresh data key and IV every time, so two identical secrets differ', () => {
    const a = encryptSecret('same-value', AAD, P1);
    const b = encryptSecret('same-value', AAD, P1);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.iv).not.toBe(b.iv);
    expect(a.dek_wrapped).not.toBe(b.dek_wrapped);
  });

  it('refuses an empty value rather than storing something meaningless', () => {
    expect(() => encryptSecret('', AAD, P1)).toThrow();
    expect(() => encryptSecret(null, AAD, P1)).toThrow();
  });
});

describe('AAD binds a ciphertext to its own row', () => {
  it('fails to decrypt when the row id changes', () => {
    const rec = encryptSecret('secret', AAD, P1);
    const otherRow = aadFor({ table: 'asset_assignments', id: 43, field: 'password', companyId: 7 });
    expect(decryptSecret(rec, otherRow, P1)).toBeNull();
  });

  it('fails to decrypt when the owning company changes', () => {
    const rec = encryptSecret('secret', AAD, P1);
    const otherCompany = aadFor({ table: 'asset_assignments', id: 42, field: 'password', companyId: 9 });
    expect(decryptSecret(rec, otherCompany, P1)).toBeNull();
  });

  it('fails when the ciphertext is tampered with', () => {
    const rec = encryptSecret('secret', AAD, P1);
    const flipped = rec.ciphertext.slice(0, -2) + (rec.ciphertext.endsWith('00') ? '11' : '00');
    expect(decryptSecret({ ...rec, ciphertext: flipped }, AAD, P1)).toBeNull();
  });

  it('fails when the wrapped data key is swapped for another record', () => {
    const a = encryptSecret('secret-a', AAD, P1);
    const b = encryptSecret('secret-b', AAD, P1);
    expect(decryptSecret({ ...a, dek_wrapped: b.dek_wrapped, dek_wrap_iv: b.dek_wrap_iv, dek_wrap_tag: b.dek_wrap_tag }, AAD, P1)).toBeNull();
  });
});

describe('key rotation', () => {
  it('opens a record written under an older master key', () => {
    const old = providerWith({ ENCRYPTION_KEY: K1, ENCRYPTION_KEY_VERSION: '1' });
    const rec = encryptSecret('written-under-v1', AAD, old);
    expect(rec.key_version).toBe(1);

    // After rotation the new key is current and the old one is retained.
    const rotated = providerWith({ ENCRYPTION_KEY: K2, ENCRYPTION_KEY_VERSION: '2', ENCRYPTION_KEY_V1: K1 });
    expect(decryptSecret(rec, AAD, rotated)).toBe('written-under-v1');
  });

  it('cannot open the record if the superseded key is dropped', () => {
    const old = providerWith({ ENCRYPTION_KEY: K1, ENCRYPTION_KEY_VERSION: '1' });
    const rec = encryptSecret('written-under-v1', AAD, old);
    const dropped = providerWith({ ENCRYPTION_KEY: K2, ENCRYPTION_KEY_VERSION: '2' });
    expect(decryptSecret(rec, AAD, dropped)).toBeNull();
  });

  it('lists the key versions the process can still unwrap', () => {
    expect(availableKeyVersions({ ENCRYPTION_KEY: K2, ENCRYPTION_KEY_V1: K1, ENCRYPTION_KEY_VERSION: '1' })).toEqual([1]);
    expect(availableKeyVersions({ ENCRYPTION_KEY: K2, ENCRYPTION_KEY_V1: K1, ENCRYPTION_KEY_V3: K1 })).toEqual([1, 3]);
  });
});

describe('record classification', () => {
  it('spots a row still on the old direct-key scheme', () => {
    expect(isLegacyRecord({ encrypted_password: 'abc' })).toBe(true);
    expect(isLegacyRecord({ encrypted_password: 'abc', dek_wrapped: 'x' })).toBe(false);
    expect(isLegacyRecord({})).toBe(false);
  });

  it('spots a row already on envelope encryption', () => {
    expect(isEnvelopeRecord({ dek_wrapped: 'x' })).toBe(true);
    expect(isEnvelopeRecord({ encrypted_password: 'abc' })).toBe(false);
  });

  it('flags a record wrapped by a superseded key for re-wrapping', () => {
    expect(needsRewrap({ dek_wrapped: 'x', key_version: 1 })).toBe(false); // current is 1 here
    expect(needsRewrap({ dek_wrapped: 'x', key_version: 99 })).toBe(true);
    expect(needsRewrap({ encrypted_password: 'abc' })).toBe(false);
  });
});

describe('key provider selection', () => {
  it('rejects an unknown provider name', () => {
    expect(() => getKeyProvider('magic')).toThrow(/Unknown KEY_PROVIDER/);
  });

  it('does not silently fall back to local when kms is selected but unconfigured', () => {
    expect(() => getKeyProvider('kms').wrapDek(Buffer.alloc(32))).toThrow(/no KMS client is configured/);
  });
});
