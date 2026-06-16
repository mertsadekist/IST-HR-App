require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');
const fs = require('fs');

async function run() {
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 30000,
  });
  
  console.log('Connected to database');
  
  const sqlFile = process.argv[2] || 'migrations/email_system.sql';
  const sql = fs.readFileSync(require('path').join(__dirname, sqlFile), 'utf8');
  
  // Split by semicolons but ignore comments
  const statements = sql.split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));
  
  for (const stmt of statements) {
    try {
      await pool.query(stmt);
      console.log('✅', stmt.substring(0, 70).replace(/\n/g, ' '));
    } catch (err) {
      console.log('⚠️ SKIP:', err.message.substring(0, 100));
    }
  }
  
  console.log('\n✅ Migration complete!');
  process.exit(0);
}

run().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
