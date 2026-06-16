import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;

function getKey() {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    // A dedicated encryption key is mandatory. Refuse to start in production;
    // in development, fail loudly rather than silently reusing the JWT secret.
    throw new Error(
      'ENCRYPTION_KEY is not set. Generate a 32-byte hex key ' +
      '(node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))") ' +
      'and set ENCRYPTION_KEY in your environment.'
    );
  }
  // If hex string (64 chars = 32 bytes), convert to buffer
  if (key.length === 64) return Buffer.from(key, 'hex');
  // Otherwise hash it to get 32 bytes
  return crypto.createHash('sha256').update(key).digest();
}

/**
 * Encrypt a plaintext string using AES-256-GCM
 * @returns {{ encrypted: string, iv: string, tag: string }}
 */
export function encrypt(plainText) {
  if (!plainText) return { encrypted: null, iv: null, tag: null };
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(plainText, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return {
    encrypted,
    iv: iv.toString('hex'),
    tag
  };
}

/**
 * Decrypt an encrypted string using AES-256-GCM
 * @returns {string} plaintext
 */
export function decrypt(encrypted, iv, tag) {
  if (!encrypted || !iv || !tag) return null;
  try {
    const key = getKey();
    const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    console.error('Decryption failed:', err.message);
    return null;
  }
}
