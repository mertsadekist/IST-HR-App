// Credentials come from .env via the shared pool — never hardcode secrets here.
import pool from './config/db.js';

async function run() {
  try {
    // 1. Create employee_documents table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS employee_documents (
        id INT AUTO_INCREMENT PRIMARY KEY,
        employee_id INT NOT NULL,
        category VARCHAR(100) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(1000) NOT NULL,
        parsed_data JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('Created employee_documents table.');

    // 2. Add employee_id to users if not exists
    const [columns] = await pool.query('SHOW COLUMNS FROM users LIKE "employee_id"');
    if (columns.length === 0) {
      await pool.query('ALTER TABLE users ADD COLUMN employee_id INT NULL, ADD FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE SET NULL');
      console.log('Added employee_id to users.');
    } else {
      console.log('employee_id already exists in users.');
    }

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
