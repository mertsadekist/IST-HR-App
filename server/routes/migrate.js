import { Router } from 'express';
import pool from '../config/db.js';
import { auth } from '../middleware/auth.js';
import { authorize } from '../middleware/rbac.js';

const router = Router();

/**
 * POST /api/migrate/localStorage
 * Import data from old localStorage v1 format into MySQL
 * Expects: { companies, departments, candidates, vacancies, employees, ... }
 */
router.post('/localStorage', auth, authorize('admin'), async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const { companies, departments, jobTitles, candidates, vacancies, employees,
      skills, skillCategories } = req.body;

    const results = { imported: {}, errors: [] };

    // 1. Companies
    if (companies?.length) {
      let count = 0;
      for (const c of companies) {
        try {
          await conn.query('INSERT IGNORE INTO companies SET ?', {
            name: c.name, short_code: c.shortCode || c.short_code || c.name.substring(0, 5).toUpperCase(),
            address: c.address, phone: c.phone, email: c.email, website: c.website,
            currency: c.currency || 'AED', industry: c.industry,
            color_primary: c.colorPrimary || c.color_primary || '#6D28D9',
          });
          count++;
        } catch (e) { results.errors.push(`Company "${c.name}": ${e.message}`); }
      }
      results.imported.companies = count;
    }

    // 2. Departments
    if (departments?.length) {
      let count = 0;
      for (const d of departments) {
        try {
          // Find company by name or short_code
          let companyId = d.company_id;
          if (!companyId && d.company) {
            const [[co]] = await conn.query('SELECT id FROM companies WHERE name = ? OR short_code = ?', [d.company, d.company]);
            companyId = co?.id;
          }
          if (companyId) {
            await conn.query('INSERT IGNORE INTO departments SET ?', {
              name: d.name, company_id: companyId, head_of_department: d.head || d.headOfDepartment || null,
            });
            count++;
          }
        } catch (e) { results.errors.push(`Department "${d.name}": ${e.message}`); }
      }
      results.imported.departments = count;
    }

    // 3. Job Titles
    if (jobTitles?.length) {
      let count = 0;
      for (const jt of jobTitles) {
        try {
          let deptId = jt.department_id;
          if (!deptId && jt.department) {
            const [[dep]] = await conn.query('SELECT id FROM departments WHERE name = ?', [jt.department]);
            deptId = dep?.id;
          }
          if (deptId) {
            await conn.query('INSERT IGNORE INTO job_titles SET ?', {
              title: jt.title || jt.name, department_id: deptId,
            });
            count++;
          }
        } catch (e) { results.errors.push(`Job title "${jt.title || jt.name}": ${e.message}`); }
      }
      results.imported.jobTitles = count;
    }

    // 4. Skill categories + skills
    if (skillCategories?.length) {
      let count = 0;
      for (const sc of skillCategories) {
        try {
          const [r] = await conn.query('INSERT IGNORE INTO skill_categories SET ?', { name: sc.name });
          if (sc.skills?.length) {
            for (const s of sc.skills) {
              await conn.query('INSERT IGNORE INTO skills SET ?', { name: s.name || s, category_id: r.insertId || sc.id });
            }
          }
          count++;
        } catch (e) { results.errors.push(`Skill category "${sc.name}": ${e.message}`); }
      }
      results.imported.skillCategories = count;
    }

    // 5. Candidates
    if (candidates?.length) {
      let count = 0;
      for (const c of candidates) {
        try {
          let companyId = c.company_id;
          if (!companyId && c.company) {
            const [[co]] = await conn.query('SELECT id FROM companies WHERE name = ? OR short_code = ?', [c.company, c.company]);
            companyId = co?.id;
          }
          await conn.query('INSERT IGNORE INTO candidates SET ?', {
            first_name: c.firstName || c.first_name || c.name?.split(' ')[0] || 'Unknown',
            last_name: c.lastName || c.last_name || c.name?.split(' ').slice(1).join(' ') || '',
            email: c.email || '', phone: c.phone || '', nationality: c.nationality || '',
            company_id: companyId, status: c.status || 'Active', notes: c.notes || '',
          });
          count++;
        } catch (e) { results.errors.push(`Candidate "${c.name || c.first_name}": ${e.message}`); }
      }
      results.imported.candidates = count;
    }

    // 6. Employees
    if (employees?.length) {
      let count = 0;
      for (const e of employees) {
        try {
          let companyId = e.company_id;
          if (!companyId && e.company) {
            const [[co]] = await conn.query('SELECT id FROM companies WHERE name = ? OR short_code = ?', [e.company, e.company]);
            companyId = co?.id;
          }
          await conn.query('INSERT IGNORE INTO employees SET ?', {
            first_name: e.firstName || e.first_name || e.name?.split(' ')[0] || 'Unknown',
            last_name: e.lastName || e.last_name || e.name?.split(' ').slice(1).join(' ') || '',
            email: e.email || '', phone: e.phone || '', nationality: e.nationality || '',
            company_id: companyId, start_date: e.startDate || e.start_date || new Date(),
            basic_salary: e.basicSalary || e.basic_salary || 0,
            status: e.status || 'Active',
          });
          count++;
        } catch (e2) { results.errors.push(`Employee: ${e2.message}`); }
      }
      results.imported.employees = count;
    }

    await conn.commit();
    res.json({ success: true, ...results });
  } catch (err) {
    await conn.rollback();
    console.error('Migration error:', err);
    res.status(500).json({ error: 'Migration failed', details: err.message });
  } finally {
    conn.release();
  }
});

export default router;
