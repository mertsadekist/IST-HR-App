/**
 * Database setup script — Creates all tables and seeds initial data.
 * Run: node setup-db.js
 */
import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '..', '.env') });

async function setup() {
  console.log('🔄 Connecting to MySQL...');

  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306'),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    multipleStatements: true,
    charset: 'utf8mb4',
    connectTimeout: 15000,
  });

  try {
    const conn = await pool.getConnection();
    console.log('✅ MySQL connected');
    conn.release();

    // ============================================
    // Create all tables
    // ============================================
    console.log('🔄 Creating tables...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        short_code VARCHAR(10) NOT NULL UNIQUE,
        logo LONGTEXT NULL,
        address TEXT NULL,
        phone VARCHAR(50) NULL,
        email VARCHAR(255) NULL,
        website VARCHAR(255) NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'AED',
        industry VARCHAR(100) NULL,
        crm_platform VARCHAR(100) NULL,
        color_primary VARCHAR(20) DEFAULT '#6D28D9',
        color_secondary VARCHAR(20) DEFAULT '#1D1245',
        status ENUM('Active','Inactive') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NULL,
        role ENUM('admin','hr_manager','recruiter','employee') DEFAULT 'employee',
        company_id INT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        last_login_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id INT AUTO_INCREMENT PRIMARY KEY,
        company_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        description TEXT NULL,
        head_count_limit INT NULL,
        parent_dept_id INT NULL,
        icon VARCHAR(10) DEFAULT '📁',
        sort_order INT DEFAULT 0,
        status ENUM('Active','Inactive') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_dept_id) REFERENCES departments(id) ON DELETE SET NULL,
        UNIQUE KEY uq_dept_company (company_id, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_titles (
        id INT AUTO_INCREMENT PRIMARY KEY,
        department_id INT NOT NULL,
        company_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description TEXT NULL,
        status ENUM('Active','Inactive') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_title_seniorities (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_title_id INT NOT NULL,
        level VARCHAR(50) NOT NULL,
        salary_min DECIMAL(12,2) NULL,
        salary_max DECIMAL(12,2) NULL,
        FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS skill_categories (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        icon VARCHAR(10) DEFAULT '🎯',
        color VARCHAR(20) DEFAULT '#6D28D9',
        sort_order INT DEFAULT 0,
        status ENUM('Active','Archived') DEFAULT 'Active',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS skills (
        id INT AUTO_INCREMENT PRIMARY KEY,
        category_id INT NOT NULL,
        name VARCHAR(255) NOT NULL,
        status ENUM('Active','Archived') DEFAULT 'Active',
        FOREIGN KEY (category_id) REFERENCES skill_categories(id) ON DELETE CASCADE,
        UNIQUE KEY uq_skill_name (category_id, name)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS job_title_skills (
        job_title_id INT NOT NULL,
        skill_id INT NOT NULL,
        is_required BOOLEAN DEFAULT TRUE,
        PRIMARY KEY (job_title_id, skill_id),
        FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE CASCADE,
        FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS ats_stages (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        color VARCHAR(20) DEFAULT '#EDE9FE',
        text_color VARCHAR(20) DEFAULT '#5B21B6',
        sort_order INT NOT NULL,
        is_success BOOLEAN DEFAULT FALSE,
        is_fail BOOLEAN DEFAULT FALSE,
        is_default BOOLEAN DEFAULT FALSE,
        status ENUM('Active','Inactive') DEFAULT 'Active'
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS vacancies (
        id INT AUTO_INCREMENT PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        company_id INT NOT NULL,
        department_id INT NULL,
        job_title_id INT NULL,
        head_count INT DEFAULT 1,
        status ENUM('Draft','Open','On Hold','Closed') DEFAULT 'Draft',
        description TEXT NULL,
        requirements TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        closed_at TIMESTAMP NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL,
        FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE SET NULL,
        FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS candidates (
        id INT AUTO_INCREMENT PRIMARY KEY,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        email VARCHAR(255) NULL,
        phone VARCHAR(50) NULL,
        nationality VARCHAR(100) NULL,
        score TINYINT DEFAULT 0,
        vacancy_id INT NULL,
        company_id INT NOT NULL,
        current_stage_id INT NULL,
        notes TEXT NULL,
        applied_date DATE NULL,
        status ENUM('Active','Hired','Failed','Blacklisted') DEFAULT 'Active',
        cv_text LONGTEXT NULL,
        cv_file_name VARCHAR(255) NULL,
        ai_score DECIMAL(5,2) NULL,
        ai_analysis JSON NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (vacancy_id) REFERENCES vacancies(id) ON DELETE SET NULL,
        FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
        FOREIGN KEY (current_stage_id) REFERENCES ats_stages(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    await pool.query(`CREATE TABLE IF NOT EXISTS candidate_skills (candidate_id INT NOT NULL, skill_id INT NOT NULL, proficiency ENUM('Beginner','Intermediate','Advanced','Expert') DEFAULT 'Intermediate', PRIMARY KEY (candidate_id, skill_id), FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE, FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS candidate_stage_history (id INT AUTO_INCREMENT PRIMARY KEY, candidate_id INT NOT NULL, stage_id INT NOT NULL, moved_by INT NULL, notes TEXT NULL, moved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE, FOREIGN KEY (stage_id) REFERENCES ats_stages(id) ON DELETE CASCADE, FOREIGN KEY (moved_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS candidate_documents (id INT AUTO_INCREMENT PRIMARY KEY, candidate_id INT NOT NULL, file_name VARCHAR(255) NOT NULL, file_type VARCHAR(100) NULL, file_size INT NULL, file_data LONGBLOB NULL, doc_type ENUM('CV','ID','Certificate','Other') DEFAULT 'CV', uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS employees (id INT AUTO_INCREMENT PRIMARY KEY, candidate_id INT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, email VARCHAR(255) NULL, phone VARCHAR(50) NULL, nationality VARCHAR(100) NULL, company_id INT NOT NULL, department_id INT NULL, job_title_id INT NULL, job_title_text VARCHAR(255) NULL, start_date DATE NULL, end_date DATE NULL, basic_salary DECIMAL(12,2) NULL, full_salary DECIMAL(12,2) NULL, status ENUM('Onboarding','Active','Offboarding','Exited') DEFAULT 'Onboarding', created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (candidate_id) REFERENCES candidates(id) ON DELETE SET NULL, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL, FOREIGN KEY (job_title_id) REFERENCES job_titles(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS onboarding_records (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, company_id INT NOT NULL, status ENUM('In Progress','Completed','Cancelled') DEFAULT 'In Progress', started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP NULL, FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS onboarding_steps (id INT AUTO_INCREMENT PRIMARY KEY, onboarding_id INT NOT NULL, step_number INT NOT NULL, name VARCHAR(255) NOT NULL, owner VARCHAR(100) NULL, sla VARCHAR(100) NULL, status ENUM('Locked','Open','Complete') DEFAULT 'Locked', notes TEXT NULL, opened_at TIMESTAMP NULL, completed_at TIMESTAMP NULL, FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS onboarding_checklist_items (id INT AUTO_INCREMENT PRIMARY KEY, step_id INT NOT NULL, label VARCHAR(500) NOT NULL, is_checked BOOLEAN DEFAULT FALSE, sort_order INT DEFAULT 0, checked_at TIMESTAMP NULL, FOREIGN KEY (step_id) REFERENCES onboarding_steps(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS onboarding_step_templates (id INT AUTO_INCREMENT PRIMARY KEY, company_id INT NOT NULL, step_number INT NOT NULL, name VARCHAR(255) NOT NULL, owner VARCHAR(100) NULL, sla VARCHAR(100) NULL, sort_order INT DEFAULT 0, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS onboarding_step_template_items (id INT AUTO_INCREMENT PRIMARY KEY, template_step_id INT NOT NULL, label VARCHAR(500) NOT NULL, sort_order INT DEFAULT 0, FOREIGN KEY (template_step_id) REFERENCES onboarding_step_templates(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS asset_categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, icon VARCHAR(10) DEFAULT '💻', color VARCHAR(20) DEFAULT '#374151', sort_order INT DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS platform_catalog (id INT AUTO_INCREMENT PRIMARY KEY, category_id INT NOT NULL, name VARCHAR(255) NOT NULL, asset_type ENUM('Hardware','Account','Software') DEFAULT 'Account', description TEXT NULL, inventory_total INT DEFAULT 0, status ENUM('Active','Inactive') DEFAULT 'Active', FOREIGN KEY (category_id) REFERENCES asset_categories(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS platform_companies (platform_id INT NOT NULL, company_id INT NOT NULL, PRIMARY KEY (platform_id, company_id), FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE CASCADE, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS asset_assignments (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, platform_id INT NULL, company_id INT NOT NULL, name VARCHAR(255) NOT NULL, asset_type ENUM('Hardware','Account','Software') DEFAULT 'Account', workspace VARCHAR(255) NULL, access_level VARCHAR(100) NULL, identifier VARCHAR(255) NULL, issued_date DATE NULL, expected_return DATE NULL, returned_date DATE NULL, status ENUM('Active','Returned','Deactivated','Missing') DEFAULT 'Active', condition_note VARCHAR(100) NULL, notes TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE, FOREIGN KEY (platform_id) REFERENCES platform_catalog(id) ON DELETE SET NULL, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS performance_targets (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, company_id INT NOT NULL, quarter VARCHAR(10) NOT NULL, target_amount DECIMAL(12,2) NULL, currency VARCHAR(10) DEFAULT 'AED', kpi_notes TEXT NULL, status ENUM('Active','Inactive') DEFAULT 'Active', signed_at TIMESTAMP NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS offboarding_records (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, company_id INT NOT NULL, departure_type ENUM('Resignation','Termination','End of Contract','Mutual Agreement') NOT NULL, last_working_day DATE NOT NULL, reason TEXT NULL, basic_salary DECIMAL(12,2) NULL, full_salary DECIMAL(12,2) NULL, employment_start DATE NULL, eosb_amount DECIMAL(12,2) NULL, leave_encashment DECIMAL(12,2) NULL, deductions DECIMAL(12,2) DEFAULT 0, total_settlement DECIMAL(12,2) NULL, status ENUM('In Progress','Completed','Cancelled') DEFAULT 'In Progress', started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, completed_at TIMESTAMP NULL, FOREIGN KEY (employee_id) REFERENCES employees(id) ON DELETE CASCADE, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS offboarding_steps (id INT AUTO_INCREMENT PRIMARY KEY, offboarding_id INT NOT NULL, step_number INT NOT NULL, name VARCHAR(255) NOT NULL, owner VARCHAR(100) NULL, sla VARCHAR(100) NULL, status ENUM('Locked','Open','Complete') DEFAULT 'Locked', notes TEXT NULL, opened_at TIMESTAMP NULL, completed_at TIMESTAMP NULL, FOREIGN KEY (offboarding_id) REFERENCES offboarding_records(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS offboarding_checklist_items (id INT AUTO_INCREMENT PRIMARY KEY, step_id INT NOT NULL, label VARCHAR(500) NOT NULL, is_checked BOOLEAN DEFAULT FALSE, sort_order INT DEFAULT 0, checked_at TIMESTAMP NULL, FOREIGN KEY (step_id) REFERENCES offboarding_steps(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS offboarding_step_templates (id INT AUTO_INCREMENT PRIMARY KEY, company_id INT NOT NULL, departure_type VARCHAR(50) NULL, step_number INT NOT NULL, name VARCHAR(255) NOT NULL, owner VARCHAR(100) NULL, sla VARCHAR(100) NULL, sort_order INT DEFAULT 0, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS offboarding_step_template_items (id INT AUTO_INCREMENT PRIMARY KEY, template_step_id INT NOT NULL, label VARCHAR(500) NOT NULL, sort_order INT DEFAULT 0, FOREIGN KEY (template_step_id) REFERENCES offboarding_step_templates(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS letter_templates (id INT AUTO_INCREMENT PRIMARY KEY, type VARCHAR(50) NOT NULL, name VARCHAR(255) NOT NULL, icon VARCHAR(10) DEFAULT '📄', fields_config JSON NOT NULL, body_template LONGTEXT NOT NULL, sort_order INT DEFAULT 0, status ENUM('Active','Inactive') DEFAULT 'Active') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS generated_letters (id INT AUTO_INCREMENT PRIMARY KEY, template_id INT NULL, company_id INT NOT NULL, letter_type VARCHAR(50) NOT NULL, recipient_name VARCHAR(255) NOT NULL, field_values JSON NOT NULL, rendered_html LONGTEXT NULL, generated_by INT NULL, generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (template_id) REFERENCES letter_templates(id) ON DELETE SET NULL, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY (generated_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS doc_categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, slug VARCHAR(100) NOT NULL UNIQUE, icon VARCHAR(10) DEFAULT '📁', color VARCHAR(20) DEFAULT '#374151', bg_color VARCHAR(20) DEFAULT '#F1F5F9', sort_order INT DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS company_documents (id INT AUTO_INCREMENT PRIMARY KEY, company_id INT NOT NULL, category VARCHAR(100) NOT NULL, file_name VARCHAR(255) NOT NULL, file_type VARCHAR(100) NULL, file_size INT NULL, file_data LONGBLOB NULL, uploaded_by INT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY (uploaded_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS kpi_tiers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, label VARCHAR(255) NOT NULL, amount DECIMAL(10,2) NOT NULL, currency VARCHAR(10) DEFAULT 'AED', icon VARCHAR(10) DEFAULT '🏅', criteria TEXT NULL, sort_order INT DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS kpi_targets (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, target_value DECIMAL(10,2) NOT NULL, unit VARCHAR(50) NOT NULL, sort_order INT DEFAULT 0) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS kpi_hires (id INT AUTO_INCREMENT PRIMARY KEY, employee_name VARCHAR(255) NOT NULL, role VARCHAR(255) NULL, company_id INT NOT NULL, join_date DATE NOT NULL, commission DECIMAL(10,2) DEFAULT 0, status ENUM('Pending','Confirmed') DEFAULT 'Pending', notes TEXT NULL, created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);
    await pool.query(`CREATE TABLE IF NOT EXISTS kpi_hire_tiers (kpi_hire_id INT NOT NULL, kpi_tier_id INT NOT NULL, PRIMARY KEY (kpi_hire_id, kpi_tier_id), FOREIGN KEY (kpi_hire_id) REFERENCES kpi_hires(id) ON DELETE CASCADE, FOREIGN KEY (kpi_tier_id) REFERENCES kpi_tiers(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS audit_logs (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NULL, user_name VARCHAR(255) NOT NULL, module VARCHAR(100) NOT NULL, action VARCHAR(100) NOT NULL, detail TEXT NULL, ip_address VARCHAR(50) NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await pool.query(`CREATE TABLE IF NOT EXISTS cv_scorer_profiles (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(255) NOT NULL, company_id INT NULL, department VARCHAR(255) NULL, location VARCHAR(255) NULL, employment_type VARCHAR(100) NULL, seniority VARCHAR(100) NULL, reports_to VARCHAR(255) NULL, salary_range VARCHAR(100) NULL, min_years_exp INT DEFAULT 0, must_have_skills JSON NULL, nice_have_skills JSON NULL, required_tools JSON NULL, required_languages JSON NULL, required_industries JSON NULL, keywords JSON NULL, education_level VARCHAR(50) NULL, weights JSON NULL, created_by INT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL, FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    console.log('✅ All 40 tables created');

    // ============================================
    // Seed data
    // ============================================

    // Admin user
    const [existingAdmin] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
    if (!existingAdmin.length) {
      console.log('🔄 Creating admin user...');
      // Use ADMIN_INITIAL_PASSWORD if provided, otherwise generate a strong random one.
      const initialPassword = process.env.ADMIN_INITIAL_PASSWORD || crypto.randomBytes(12).toString('base64url');
      const hash = await bcrypt.hash(initialPassword, 12);
      await pool.query('INSERT INTO users SET ?', {
        username: 'admin', password_hash: hash, name: 'System Admin',
        email: 'admin@ist.com', role: 'admin', is_active: true,
      });
      console.log('✅ Admin user created (username: admin)');
      console.log('🔑 INITIAL ADMIN PASSWORD (shown once — store it, then change it):', initialPassword);
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // ATS stages
    const [existingStages] = await pool.query('SELECT COUNT(*) as count FROM ats_stages');
    if (existingStages[0].count === 0) {
      console.log('🔄 Seeding ATS stages...');
      const stages = [
        { name: 'New Applicants', color: '#EDE9FE', text_color: '#5B21B6', sort_order: 1, is_default: true },
        { name: 'Shortlisted', color: '#DBEAFE', text_color: '#1E40AF', sort_order: 2 },
        { name: 'Contacted', color: '#D1FAE5', text_color: '#065F46', sort_order: 3 },
        { name: 'Scheduled Interview', color: '#FEF3C7', text_color: '#92400E', sort_order: 4 },
        { name: '1st Interview', color: '#FECACA', text_color: '#991B1B', sort_order: 5 },
        { name: '2nd Interview', color: '#FED7AA', text_color: '#9A3412', sort_order: 6 },
        { name: 'Assessment', color: '#E0E7FF', text_color: '#3730A3', sort_order: 7 },
        { name: 'Offer Made', color: '#CFFAFE', text_color: '#155E75', sort_order: 8 },
        { name: 'Offer Accepted', color: '#ECFDF5', text_color: '#047857', sort_order: 9 },
        { name: 'Joining Process', color: '#FEF9C3', text_color: '#854D0E', sort_order: 10 },
        { name: 'Success', color: '#BBF7D0', text_color: '#166534', sort_order: 11, is_success: true },
        { name: 'Failed', color: '#FECACA', text_color: '#991B1B', sort_order: 12, is_fail: true },
        { name: 'Blacklisted', color: '#374151', text_color: '#F9FAFB', sort_order: 13, is_fail: true },
      ];
      for (const s of stages) {
        await pool.query('INSERT INTO ats_stages SET ?', { ...s, is_default: s.is_default || false, is_success: s.is_success || false, is_fail: s.is_fail || false });
      }
      console.log('✅ ATS stages seeded (13 stages)');
    } else {
      console.log('ℹ️  ATS stages already exist');
    }

    // Document categories
    const [existingCats] = await pool.query('SELECT COUNT(*) as count FROM doc_categories');
    if (existingCats[0].count === 0) {
      console.log('🔄 Seeding document categories...');
      const cats = [
        { name: 'Trade Licenses', slug: 'trade-licenses', icon: '📜', color: '#0369A1', bg_color: '#DBEAFE', sort_order: 1 },
        { name: 'Contracts', slug: 'contracts', icon: '📋', color: '#7C3AED', bg_color: '#EDE9FE', sort_order: 2 },
        { name: 'Insurance', slug: 'insurance', icon: '🛡️', color: '#059669', bg_color: '#D1FAE5', sort_order: 3 },
        { name: 'Legal Forms', slug: 'legal-forms', icon: '⚖️', color: '#DC2626', bg_color: '#FEE2E2', sort_order: 4 },
        { name: 'Policies', slug: 'policies', icon: '📐', color: '#D97706', bg_color: '#FEF3C7', sort_order: 5 },
        { name: 'Other', slug: 'other', icon: '📁', color: '#374151', bg_color: '#F1F5F9', sort_order: 6 },
      ];
      for (const c of cats) await pool.query('INSERT INTO doc_categories SET ?', c);
      console.log('✅ Document categories seeded');
    }

    console.log('\n✨ Database setup complete!\n');
    await pool.end();
    process.exit(0);
  } catch (err) {
    console.error('❌ Setup failed:', err);
    process.exit(1);
  }
}

setup();
