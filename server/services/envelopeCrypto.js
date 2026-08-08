/**
 * Envelope encryption for stored secrets — docs/secrets_protection_design.md §2.
 *
 * The old scheme encrypted every secret directly under one process-wide key, so
 * a single leaked ENCRYPTION_KEY decrypted every credential ever stored, and
 * rotating it would have orphaned all of them.
 *
 *   master key (KEK)  ──wraps──▶  per-record data key (DEK)  ──encrypts──▶  secret
 *   never touches the             random 32 bytes, stored              AES-256-GCM
 *   data, only the DEK            wrapped beside the ciphertext
 *
 * What this buys, concretely:
 *   • A compromised DEK exposes ONE record, not the whole table.
 *   • Rotation re-wraps small DEKs instead of re-encrypting every secret, and
 *     `key_version` lets old and new master keys coexist while records migrate.
 *   • A database backup holds only wrapped DEKs and ciphertext. Without the
 *     master key — which lives outside the database — it is inert. That is the
 *     main reason to do this at all.
 *   • AAD binds each ciphertext to its own row, so copying a ciphertext from one
 *     record into another fails authentication instead of decrypting. That is a
 *     real privilege-escalation trick, not a theoretical one.
 */
import crypto from 'crypto';
import { getKeyProvider, CURRENT_KEY_VERSION } from './keyProvider.js';

const ALGO = 'aes-256-gcm';

/**
 * The additional authenticated data for a record. Any change to the identity of
 * the row — table, id, field, owning company — makes the ciphertext refuse to
 * decrypt.
 */
export function aadFor({ table, id, field, companyId }) {
  return `${table}:${id}:${field}:${companyId ?? ''}`;
}

/**
 * @returns {{ciphertext:string, iv:string, tag:string, dek_wrapped:string,
 *            dek_wrap_iv:string, dek_wrap_tag:string, key_version:number, aad_context:string}}
 */
export function encryptSecret(plaintext, aadContext, provider = getKeyProvider()) {
  if (plaintext == null || plaintext === '') throw new Error('encryptSecret requires a value');

  const dek = crypto.randomBytes(32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, dek, iv);
  cipher.setAAD(Buffer.from(aadContext, 'utf8'));
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  const wrap = provider.wrapDek(dek, CURRENT_KEY_VERSION);
  dek.fill(0); // do not leave the data key sitting in memory longer than needed

  return {
    ciphertext: ciphertext.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
    dek_wrapped: wrap.wrapped,
    dek_wrap_iv: wrap.iv,
    dek_wrap_tag: wrap.tag,
    key_version: wrap.keyVersion,
    aad_context: aadContext,
  };
}

/**
 * @returns {string|null} the plaintext, or null when the record cannot be
 * authenticated — a wrong AAD, a tampered ciphertext or a missing key version
 * all land here rather than throwing into a route.
 */
export function decryptSecret(record, aadContext, provider = getKeyProvider()) {
  try {
    const dek = provider.unwrapDek({
      wrapped: record.dek_wrapped,
      iv: record.dek_wrap_iv,
      tag: record.dek_wrap_tag,
      keyVersion: record.key_version,
    });
    const decipher = crypto.createDecipheriv(ALGO, dek, Buffer.from(record.iv, 'hex'));
    decipher.setAAD(Buffer.from(aadContext ?? record.aad_context ?? '', 'utf8'));
    decipher.setAuthTag(Buffer.from(record.tag, 'hex'));
    const out = Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'hex')), decipher.final()]);
    dek.fill(0);
    return out.toString('utf8');
  } catch (err) {
    console.error('Envelope decryption failed:', err.message);
    return null;
  }
}

/** A row is still on the old direct-key scheme when it has no wrapped DEK. */
export const isLegacyRecord = (row) => !!row?.encrypted_password && !row?.dek_wrapped;

/** A row already migrated to envelope encryption. */
export const isEnvelopeRecord = (row) => !!row?.dek_wrapped;

/** Does this row need re-wrapping because the master key has moved on? */
export const needsRewrap = (row) => isEnvelopeRecord(row) && Number(row.key_version) !== CURRENT_KEY_VERSION;
