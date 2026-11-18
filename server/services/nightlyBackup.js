/**
 * Nightly database backup to the persistent volume.
 *
 * Every table (structure and rows) goes into one gzipped JSON file under
 * <uploads>/backups, and only the newest few are kept. This protects against a
 * bad change or a deleted record; it does NOT protect against losing the
 * server, since the files sit on the same machine. An off-site copy needs
 * storage credentials (S3 or similar), set up outside the app.
 *
 * The files hold every company's data, password hashes included, so they are
 * listed and downloaded by a platform admin only.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { once } from 'events';
import { ensureUploadDir } from '../config/storage.js';

export const BACKUP_DIR_NAME = 'backups';
export const BACKUP_FILE_RE = /^hr-backup-\d{4}-\d{2}-\d{2}-\d{4}\.json\.gz$/;
const BATCH = 5000;

const pad = (n) => String(n).padStart(2, '0');
/** hr-backup-2026-11-18-0230.json.gz, in local time. */
export function backupFileName(d = new Date()) {
  return `hr-backup-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json.gz`;
}

/** The backup files to delete so that only the newest `keep` remain. */
export function expiredBackups(names, keep) {
  return names.filter((n) => BACKUP_FILE_RE.test(n)).sort().reverse().slice(Math.max(1, keep));
}

export const backupDir = () => ensureUploadDir(BACKUP_DIR_NAME);

export function listBackups() {
  const dir = backupDir();
  return fs.readdirSync(dir).filter((n) => BACKUP_FILE_RE.test(n)).sort().reverse()
    .map((name) => { const st = fs.statSync(path.join(dir, name)); return { name, size: st.size, created_at: st.mtime.toISOString() }; });
}

/**
 * Write a full backup and prune old ones.
 * @returns {Promise<{name:string, size:number, tables:number, rows:number, removed:string[]}>}
 */
export async function runBackup(pool, { keep = Number(process.env.BACKUP_KEEP) || 14 } = {}) {
  const dir = backupDir();
  const name = backupFileName();
  const tmp = path.join(dir, `${name}.part`);
  const gz = zlib.createGzip({ level: 6 });
  const out = fs.createWriteStream(tmp);
  gz.pipe(out);
  const write = async (s) => { if (!gz.write(s)) await once(gz, 'drain'); };

  const [tables] = await pool.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
  const names = tables.map((t) => Object.values(t)[0]);
  let total = 0;
  await write(`{"version":"3","created_at":${JSON.stringify(new Date().toISOString())},"tables":{`);
  for (const [ti, table] of names.entries()) {
    const [[ddl]] = await pool.query(`SHOW CREATE TABLE \`${table.replace(/`/g, '')}\``);
    await write(`${ti ? ',' : ''}${JSON.stringify(table)}:{"create":${JSON.stringify(ddl['Create Table'])},"rows":[`);
    let first = true;
    for (let offset = 0; ; offset += BATCH) {
      const [rows] = await pool.query(`SELECT * FROM \`${table.replace(/`/g, '')}\` LIMIT ? OFFSET ?`, [BATCH, offset]);
      for (const r of rows) { await write(`${first ? '' : ','}${JSON.stringify(r)}`); first = false; }
      total += rows.length;
      if (rows.length < BATCH) break;
    }
    await write(']}');
  }
  await write('}}');
  gz.end();
  await once(out, 'finish');
  fs.renameSync(tmp, path.join(dir, name));

  const removed = expiredBackups(fs.readdirSync(dir), keep);
  for (const old of removed) { try { fs.unlinkSync(path.join(dir, old)); } catch { /* already gone */ } }
  return { name, size: fs.statSync(path.join(dir, name)).size, tables: names.length, rows: total, removed };
}
