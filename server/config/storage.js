/**
 * Centralized file-storage location.
 *
 * All uploaded files (CVs, employee documents, signed offers, handover receipts,
 * asset images, onboarding files, application CVs) live UNDER a single base
 * directory. In production this MUST point at a mounted persistent volume so the
 * files survive container rebuilds / redeploys (e.g. Coolify persistent storage):
 *
 *     UPLOADS_DIR=/data/uploads
 *
 * In development it defaults to <project-root>/uploads (independent of cwd).
 */
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(__dirname, '..', '..', 'uploads');

// Ensure the base directory exists at startup.
try { fs.mkdirSync(UPLOADS_DIR, { recursive: true }); } catch { /* created lazily per-subdir below */ }

/** Absolute path for a file/sub-folder under the uploads base. */
export function uploadPath(...segments) {
  return path.join(UPLOADS_DIR, ...segments);
}

/** Like uploadPath() but also creates the (sub)directory. Returns the path. */
export function ensureUploadDir(...segments) {
  const p = uploadPath(...segments);
  fs.mkdirSync(p, { recursive: true });
  return p;
}
