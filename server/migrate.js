import db from './config/db.js';

async function run() {
  try {
    const [cols] = await db.query(`SHOW COLUMNS FROM users LIKE 'department_id'`);
    if (cols.length === 0) {
      await db.query('ALTER TABLE users ADD COLUMN department_id INT NULL');
      await db.query('ALTER TABLE users ADD FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL');
      console.log('Successfully altered users table');
    } else {
      console.log('Column already exists');
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
