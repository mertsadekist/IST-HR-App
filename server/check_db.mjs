// Credentials come from .env via the shared pool — never hardcode secrets here.
import pool from './config/db.js';

// Check employees
const [empCount] = await pool.query('SELECT COUNT(*) as cnt FROM employees');
console.log('Employee count:', empCount[0].cnt);

// Check candidates
const [candCount] = await pool.query('SELECT COUNT(*) as cnt FROM candidates');
console.log('Candidates count:', candCount[0].cnt);

const [hired] = await pool.query("SELECT COUNT(*) as cnt FROM candidates WHERE status = 'Hired'");
console.log('Hired candidates:', hired[0].cnt);

// Show all tables
const [tables] = await pool.query('SHOW TABLES');
console.log('Tables:', tables.map(t => Object.values(t)[0]).join(', '));

// Check companies
const [companies] = await pool.query('SELECT id, name, short_code FROM companies');
console.log('Companies:', JSON.stringify(companies));

// Check onboarding
try {
  const [onb] = await pool.query('SELECT COUNT(*) as cnt FROM onboarding');
  console.log('Onboarding records:', onb[0].cnt);
} catch(e) { console.log('No onboarding table'); }

// Check employees table structure
const [cols] = await pool.query('DESCRIBE employees');
console.log('Employee columns:', cols.map(c => c.Field).join(', '));

await pool.end();
