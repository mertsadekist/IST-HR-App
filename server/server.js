import app from './app.js';
import pool from './config/db.js';
import { ensureSchema } from './config/ensureSchema.js';
import { getAppSetting } from './services/appSettings.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`\n🚀 IST HR API Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  await ensureSchema(); // self-heal additive columns/tables (attendance_id, app_settings)
  // Operate in the configured timezone (UI setting → APP_TZ env → Asia/Dubai).
  const tz = await getAppSetting('timezone', process.env.APP_TZ || process.env.TZ || 'Asia/Dubai');
  if (tz) { process.env.TZ = tz; console.log(`🕒 App timezone: ${tz}`); }
});
