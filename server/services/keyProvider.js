/**
 * Where the master key lives — docs/secrets_protection_design.md §3.
 *
 * Envelope encryption never uses this key on the data itself. It only wraps and
 * unwraps the small per-record data keys, which is the whole reason a KMS can be
 * dropped in later without re-encrypting anything: swap the provider and
 * re-wrap the DEKs.
 *
 * PROVIDERS
 *   local  the master key comes from ENCRYPTION_KEY in the process environment.
 *          This is what the Coolify deployment uses today.
 *   kms    the master key never enters this process; wrap/unwrap are calls to
 *          AWS KMS, GCP KMS or Azure Key Vault. The seam is here and is
 *          exercised by the same tests; the provider itself needs an account and
 *          credentials, which is a deployment decision, not a code one.
 *
 * KEY VERSIONS
 * Rotation is why `key_version` is stored beside every wrapped DEK. Set
 * ENCRYPTION_KEY to the new key and ENCRYPTION_KEY_V1..N to the older ones, and
 * both continue to unwrap while records migrate to the current version on next
 * write. Without this, rotating the key orphans every existing ciphertext, which
 * is why in practice it never gets rotated at all.
 */
import crypto from 'crypto';

export const CURRENT_KEY_VERSION = Number(process.env.ENCRYPTION_KEY_VERSION || 1);

/** Accepts 64 hex chars as 32 raw bytes; anything else is hashed to 32 bytes. */
function toKey(material) {
  if (/^[0-9a-fA-F]{64}$/.test(material)) return Buffer.from(material, 'hex');
  return crypto.createHash('sha256').update(material).digest();
}

/**
 * Master key material for a version. Version N reads ENCRYPTION_KEY_VN, and the
 * current version falls back to ENCRYPTION_KEY so an existing deployment keeps
 * working untouched.
 */
function masterKeyFor(version, env = process.env) {
  const explicit = env[`ENCRYPTION_KEY_V${version}`];
  const material = explicit || (version === CURRENT_KEY_VERSION ? env.ENCRYPTION_KEY : null);
  if (!material) {
    throw new Error(
      `No master key available for key_version ${version}. `
      + `Set ENCRYPTION_KEY_V${version} to the key that was in use when those records were written.`);
  }
  return toKey(material);
}

const localProvider = {
  name: 'local',
  /** @returns {{wrapped: string, iv: string, tag: string, keyVersion: number}} */
  wrapDek(dek, version = CURRENT_KEY_VERSION) {
    const key = masterKeyFor(version);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const wrapped = Buffer.concat([cipher.update(dek), cipher.final()]);
    return {
      wrapped: wrapped.toString('hex'),
      iv: iv.toString('hex'),
      tag: cipher.getAuthTag().toString('hex'),
      keyVersion: version,
    };
  },
  /** @returns {Buffer} the raw data key */
  unwrapDek({ wrapped, iv, tag, keyVersion }) {
    const key = masterKeyFor(keyVersion ?? CURRENT_KEY_VERSION);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(wrapped, 'hex')), decipher.final()]);
  },
};

// The seam a real KMS plugs into. Left explicit rather than silently falling
// back to local, so a deployment that believes it is using a KMS finds out at
// boot instead of after it has written records under a process-resident key.
const kmsProvider = {
  name: 'kms',
  wrapDek() {
    throw new Error(
      'KEY_PROVIDER=kms is selected but no KMS client is configured. '
      + 'Implement wrapDek/unwrapDek against your provider SDK in services/keyProvider.js, '
      + 'or set KEY_PROVIDER=local. See docs/secrets_protection_design.md §3.');
  },
  unwrapDek() { return kmsProvider.wrapDek(); },
};

const PROVIDERS = { local: localProvider, kms: kmsProvider };

export function getKeyProvider(name = process.env.KEY_PROVIDER || 'local') {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown KEY_PROVIDER "${name}". Valid values: ${Object.keys(PROVIDERS).join(', ')}`);
  return provider;
}

/** Which key versions this process can still unwrap — used by the boot check. */
export function availableKeyVersions(env = process.env) {
  const versions = new Set();
  if (env.ENCRYPTION_KEY) versions.add(CURRENT_KEY_VERSION);
  for (const k of Object.keys(env)) {
    const m = /^ENCRYPTION_KEY_V(\d+)$/.exec(k);
    if (m) versions.add(Number(m[1]));
  }
  return [...versions].sort((a, b) => a - b);
}
