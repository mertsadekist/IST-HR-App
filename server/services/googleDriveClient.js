/**
 * Read-only Google Drive access for the attendance sync.
 *
 * Uses `google-auth-library` (786 KB) against the Drive REST API directly rather
 * than the `googleapis` package, which bundles every Google API and would add
 * hundreds of megabytes to the Docker image for the two endpoints we need:
 * list a folder, and download a file.
 *
 * Authenticates as a service account. There is no user, no consent screen and
 * no refresh-token lifecycle — access comes from the folder having been shared
 * with the service account's email, so it is scoped to that one folder and is
 * read-only. See docs/attendance_drive_sync_plan.md §3.
 */
import { JWT } from 'google-auth-library';

const SCOPE = 'https://www.googleapis.com/auth/drive.readonly';
const API = 'https://www.googleapis.com/drive/v3';

/**
 * The private key survives copy-paste in two shapes: with real newlines, or
 * with the literal two characters backslash-n as it appears inside the JSON key
 * file. Coolify's env editor produces either depending on how it was pasted, so
 * both are accepted rather than making the operator get it exactly right.
 */
function normaliseKey(raw) {
  let k = String(raw || '').trim();
  // Some UIs wrap the whole value in quotes; strip a matched pair.
  if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
    k = k.slice(1, -1);
  }
  return k.replace(/\\n/g, '\n');
}

/** @returns {{email: string, key: string, folderId: string}} */
export function driveConfig() {
  return {
    email: (process.env.GOOGLE_DRIVE_SA_EMAIL || '').trim(),
    key: normaliseKey(process.env.GOOGLE_DRIVE_SA_PRIVATE_KEY),
    folderId: (process.env.ATTENDANCE_DRIVE_FOLDER_ID || '').trim(),
  };
}

/** What is missing, in words the operator can act on. Empty array = ready. */
export function configProblems() {
  const { email, key, folderId } = driveConfig();
  const out = [];
  if (!email) out.push('GOOGLE_DRIVE_SA_EMAIL is not set');
  else if (!email.includes('@')) out.push('GOOGLE_DRIVE_SA_EMAIL does not look like an email address');
  if (!key) out.push('GOOGLE_DRIVE_SA_PRIVATE_KEY is not set');
  else if (!key.includes('BEGIN PRIVATE KEY')) {
    out.push('GOOGLE_DRIVE_SA_PRIVATE_KEY does not contain a PEM key — copy the whole `private_key` value from the JSON');
  }
  if (!folderId) out.push('ATTENDANCE_DRIVE_FOLDER_ID is not set');
  return out;
}

export const isConfigured = () => configProblems().length === 0;

let cached = null;
function client() {
  const problems = configProblems();
  if (problems.length) throw new Error(`Google Drive is not configured: ${problems.join('; ')}`);
  const { email, key } = driveConfig();
  // The JWT client refreshes its own access token, so this is safe to reuse.
  if (!cached || cached.email !== email) {
    cached = { email, jwt: new JWT({ email, key, scopes: [SCOPE] }) };
  }
  return cached.jwt;
}

/** Turns Google's error shapes into something a human can act on. */
function explain(err, context) {
  const status = err?.response?.status ?? err?.status;
  const body = err?.response?.data?.error;
  const reason = body?.errors?.[0]?.reason || body?.status || '';
  const message = body?.message || err?.message || 'Unknown error';

  if (status === 403 && /accessNotConfigured|SERVICE_DISABLED/i.test(`${reason} ${message}`)) {
    return new Error('The Google Drive API is not enabled for this project. Enable it in APIs & Services → Library.');
  }
  if (status === 403) {
    return new Error(`Access denied by Drive (${message}). Check the folder is shared with the service account's email as Viewer.`);
  }
  if (status === 404) {
    return new Error('Drive returned "not found". Either the folder id is wrong, or the folder has not been shared with the service account.');
  }
  if (/invalid_grant/i.test(message)) {
    return new Error('Google rejected the service account key (invalid_grant). The key may be wrong, revoked, or the server clock may be badly out of sync.');
  }
  return new Error(`${context}: ${message}`);
}

/**
 * Every file in the folder, newest name first. Paginated, so a folder with a
 * year of daily files comes back complete.
 *
 * Folders and trashed items are excluded by the query, so a stray subfolder does
 * not show up as a file to import.
 *
 * @returns {Promise<{id, name, md5Checksum, size, modifiedTime}[]>}
 */
export async function listFolderFiles(folderId = driveConfig().folderId, { max = 2000 } = {}) {
  const jwt = client();
  const files = [];
  let pageToken;
  try {
    do {
      const params = new URLSearchParams({
        q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
        fields: 'nextPageToken, files(id, name, md5Checksum, size, modifiedTime, mimeType)',
        orderBy: 'name desc',
        pageSize: '200',
        // Shared drives behave differently from My Drive; supporting both means
        // the folder can be moved into one later without this breaking.
        supportsAllDrives: 'true',
        includeItemsFromAllDrives: 'true',
      });
      if (pageToken) params.set('pageToken', pageToken);
      const res = await jwt.request({ url: `${API}/files?${params}` });
      files.push(...(res.data.files || []));
      pageToken = res.data.nextPageToken;
    } while (pageToken && files.length < max);
  } catch (err) {
    throw explain(err, 'Listing the Drive folder failed');
  }
  return files;
}

/**
 * A file's contents as text.
 *
 * `responseType: 'text'` matters: without it the client parses anything
 * JSON-shaped, and a CSV that happens to start with a brace would come back as
 * an object instead of the text the parser expects.
 */
export async function downloadFileText(fileId) {
  const jwt = client();
  try {
    const res = await jwt.request({
      url: `${API}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`,
      responseType: 'text',
    });
    return typeof res.data === 'string' ? res.data : String(res.data ?? '');
  } catch (err) {
    throw explain(err, `Downloading Drive file ${fileId} failed`);
  }
}

/**
 * Proves the credentials work and the folder is reachable, without downloading
 * anything. Used by the readiness check and the settings page.
 */
export async function testConnection() {
  const problems = configProblems();
  if (problems.length) return { ok: false, problems };
  try {
    const files = await listFolderFiles();
    return {
      ok: true,
      problems: [],
      file_count: files.length,
      newest: files[0] ? { name: files[0].name, modifiedTime: files[0].modifiedTime } : null,
    };
  } catch (err) {
    return { ok: false, problems: [err.message] };
  }
}
