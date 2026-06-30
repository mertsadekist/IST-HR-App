import pool from '../config/db.js';

// Small key/value accessor for global app settings (table ensured at boot).
export async function getAppSetting(key, fallback = null) {
  try {
    const [[row]] = await pool.query('SELECT v FROM app_settings WHERE k = ?', [key]);
    return row && row.v != null ? row.v : fallback;
  } catch {
    return fallback;
  }
}

export async function setAppSetting(key, value) {
  await pool.query(
    'INSERT INTO app_settings (k, v) VALUES (?, ?) ON DUPLICATE KEY UPDATE v = VALUES(v)',
    [key, value]
  );
}
