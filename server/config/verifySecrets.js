/**
 * Startup validation of the cryptographic secrets.
 *
 * `cryptoService.getKey()` accepts any string and SHA-256s it to 32 bytes, which
 * means a key of "password" is silently accepted and every stored credential is
 * then trivially decryptable. A weak or duplicated key is a deployment mistake,
 * and the only safe place to catch it is before the process starts serving.
 *
 * In production a failure is fatal — better to refuse to boot than to store
 * credentials under a key that offers no protection. In development it is a loud
 * warning, so a local database seeded under an old key stays workable.
 *
 * See docs/secrets_protection_design.md §3.
 */

const MIN_LENGTH = 32;

// Values that appear in tutorials, .env.example files and copy-paste deploys.
const KNOWN_PLACEHOLDERS = [
  'changeme', 'change_me', 'secret', 'mysecret', 'password', 'your-secret-key',
  'your_secret_key', 'supersecret', 'test', 'dev', 'development', 'jwtsecret',
  'encryptionkey', 'replace-me', 'todo', 'xxxxxxxx',
];

/**
 * Rejects strings with too little variety to be a real key: a single repeated
 * character, an obvious ascending run, or very few distinct characters overall.
 */
function looksLowEntropy(value) {
  if (/^(.)\1*$/.test(value)) return true;                    // "aaaaaaaa…"
  if (/^(0123456789|abcdefgh|12345678)/i.test(value)) return true;
  const distinct = new Set(value).size;
  return distinct < Math.min(10, Math.ceil(value.length / 3));
}

/**
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function checkSecrets(env = process.env) {
  const errors = [];
  const warnings = [];

  const check = (name, value, { minLength = MIN_LENGTH } = {}) => {
    if (!value) { errors.push(`${name} is not set.`); return; }
    const v = String(value);
    if (v.length < minLength) {
      errors.push(`${name} is only ${v.length} characters — at least ${minLength} are required.`);
    }
    if (KNOWN_PLACEHOLDERS.includes(v.toLowerCase())) {
      errors.push(`${name} is a well-known placeholder value.`);
    }
    if (looksLowEntropy(v)) {
      errors.push(`${name} has too little variety to be a real key.`);
    }
  };

  check('JWT_SECRET', env.JWT_SECRET);
  check('ENCRYPTION_KEY', env.ENCRYPTION_KEY);

  // The two must be independent: reusing one secret means a leak of either
  // compromises both session forgery and stored-credential decryption.
  if (env.JWT_SECRET && env.ENCRYPTION_KEY && env.JWT_SECRET === env.ENCRYPTION_KEY) {
    errors.push('ENCRYPTION_KEY must not be the same value as JWT_SECRET.');
  }

  // A 64-character hex string is used as 32 raw bytes; anything else is hashed,
  // which works but loses entropy the operator may believe they supplied.
  if (env.ENCRYPTION_KEY && !/^[0-9a-fA-F]{64}$/.test(String(env.ENCRYPTION_KEY))) {
    warnings.push('ENCRYPTION_KEY is not 64 hex characters, so it is SHA-256 hashed to derive the key. '
      + 'Prefer a real 32-byte key: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
  }

  return { errors, warnings };
}

/**
 * Call once at boot. Throws in production when a secret is unusable.
 */
export function verifySecrets({ env = process.env, isProduction = env.NODE_ENV === 'production' } = {}) {
  const { errors, warnings } = checkSecrets(env);

  for (const w of warnings) console.warn(`⚠️  ${w}`);

  if (errors.length) {
    const detail = errors.map((e) => `   • ${e}`).join('\n');
    if (isProduction) {
      throw new Error(`Refusing to start — cryptographic secrets are not safe:\n${detail}`);
    }
    console.warn(`\n⚠️  WEAK CRYPTOGRAPHIC SECRETS (fatal in production):\n${detail}\n`);
  } else if (!warnings.length) {
    console.log('🔐 Secrets check passed');
  }
  return { errors, warnings };
}
