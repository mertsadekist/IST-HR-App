import app from './app.js';
import pool from './config/db.js';
import { ensureSchema } from './config/ensureSchema.js';

const PORT = process.env.PORT || 3001;

app.listen(PORT, async () => {
  console.log(`\n🚀 IST HR API Server running on http://localhost:${PORT}`);
  console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔑 Environment: ${process.env.NODE_ENV || 'development'}\n`);
  await ensureSchema(); // self-heal additive columns (e.g. employees.attendance_id)
});
