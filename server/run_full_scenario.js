import axios from 'axios';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from parent (root)
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const API_URL = 'http://localhost:3001/api';

async function run() {
  console.log('================================================================');
  console.log('🚀 STARTING FULL E2E BUSINESS SCENARIO TESTING FOR IST HR SYSTEM');
  console.log('================================================================\n');

  // 1. Setup direct DB connection for setup/cleanup
  const pool = await mysql.createPool({
    host: process.env.DB_HOST || '147.93.27.94',
    port: parseInt(process.env.DB_PORT || '5458'),
    user: process.env.DB_USER || 'mysql',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'default',
  });

  console.log('✅ Connected to MySQL database directly for data synchronization.');

  // Cleanup previous test data to allow fresh run
  console.log('🧹 Cleaning up any previous "ISTTECH" test data...');
  try {
    const [[testCompany]] = await pool.query('SELECT id FROM companies WHERE short_code = "ISTTECH"');
    if (testCompany) {
      console.log(`   Found old company ID ${testCompany.id}, cascading deletion...`);
      await pool.query('DELETE FROM companies WHERE id = ?', [testCompany.id]);
      console.log('   Cleanup complete.');
    } else {
      console.log('   No previous test data found. Starting fresh.');
    }
  } catch (err) {
    console.error('⚠️ Cleanup warning:', err.message);
  }

  // 2. Authenticate
  console.log('\n🔐 [Authentication] Logging in as admin...');
  let token;
  try {
    const res = await axios.post(`${API_URL}/auth/login`, {
      username: 'admin',
      password: 'admin123'
    });
    token = res.data.token;
    console.log('   Success! JWT Token obtained:', token.slice(0, 15) + '...');
  } catch (err) {
    console.error('❌ Authentication failed:', err.response?.data || err.message);
    process.exit(1);
  }

  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  // 3. Create Company
  console.log('\n🏢 [Company Creation] Creating company "IST Technology Solutions LLC"...');
  let companyId;
  try {
    const res = await axios.post(`${API_URL}/companies`, {
      name: 'IST Technology Solutions LLC',
      short_code: 'ISTTECH',
      currency: 'AED',
      address: 'Dubai Internet City, Building 3, Office 401',
      phone: '+97145551234',
      email: 'info@isttech.com',
      website: 'www.isttech.com',
      industry: 'Technology & Software',
      crm_platform: 'Salesforce',
      color_primary: '#0ea5e9',
      color_secondary: '#0f172a',
      status: 'Active'
    }, authHeaders);
    companyId = res.data.id;
    console.log(`   Success! Company created. ID: ${companyId}`);
  } catch (err) {
    console.error('❌ Company creation failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 4. Create Departments
  console.log('\n📁 [Department Creation] Creating departments...');
  let devDeptId, qaDeptId;
  try {
    const devRes = await axios.post(`${API_URL}/departments`, {
      company_id: companyId,
      name: 'Software Development',
      description: 'Custom software development, product planning and testing.',
      head_count_limit: 20,
      icon: '💻',
      sort_order: 1,
      status: 'Active'
    }, authHeaders);
    devDeptId = devRes.data.id;
    console.log(`   Success! "Software Development" created. ID: ${devDeptId}`);

    const qaRes = await axios.post(`${API_URL}/departments`, {
      company_id: companyId,
      name: 'Quality Assurance',
      description: 'Software quality testing and automated systems.',
      head_count_limit: 10,
      icon: '🔍',
      sort_order: 2,
      status: 'Active'
    }, authHeaders);
    qaDeptId = qaRes.data.id;
    console.log(`   Success! "Quality Assurance" created. ID: ${qaDeptId}`);
  } catch (err) {
    console.error('❌ Department creation failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 5. Create Job Titles
  console.log('\n💼 [Job Title Creation] Creating Senior React Developer job title...');
  let jobTitleId;
  try {
    const res = await axios.post(`${API_URL}/job-titles`, {
      company_id: companyId,
      department_id: devDeptId,
      title: 'Senior React Developer',
      description: 'Senior frontend engineer specializing in React, Redux and Vite.',
      status: 'Active',
      seniorities: [
        { level: 'Senior', salary_min: 20000, salary_max: 35000 }
      ]
    }, authHeaders);
    jobTitleId = res.data.id;
    console.log(`   Success! "Senior React Developer" created. ID: ${jobTitleId}`);
  } catch (err) {
    console.error('❌ Job title creation failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 6. Seed Onboarding/Offboarding step templates for ISTTECH directly in DB
  console.log('\n🌱 [Templates Seeding] Seeding onboarding and offboarding step templates in DB...');
  try {
    // A. Onboarding step templates
    const [obStep1] = await pool.query('INSERT INTO onboarding_step_templates (company_id, step_number, name, owner, sla, sort_order) VALUES (?, 1, "IT Setup & Hardware", "IT Department", "2 days", 1)', [companyId]);
    await pool.query('INSERT INTO onboarding_step_template_items (template_step_id, label, sort_order) VALUES (?, "Allocate MacBook Pro M3 Laptop", 1), (?, "Setup Slack & Corporate Email", 2)', [obStep1.insertId, obStep1.insertId]);

    const [obStep2] = await pool.query('INSERT INTO onboarding_step_templates (company_id, step_number, name, owner, sla, sort_order) VALUES (?, 2, "HR Documentation", "HR Operations", "3 days", 2)', [companyId]);
    await pool.query('INSERT INTO onboarding_step_template_items (template_step_id, label, sort_order) VALUES (?, "Collect passport copy & signed contract", 1), (?, "Submit medical insurance form", 2)', [obStep2.insertId, obStep2.insertId]);

    console.log('   Seeded 2 Onboarding Step Templates with checklists.');

    // B. Offboarding step templates
    const [offStep1] = await pool.query('INSERT INTO offboarding_step_templates (company_id, step_number, name, owner, sla, sort_order) VALUES (?, 1, "Resignation Formalities", "HR Operations", "1 day", 1)', [companyId]);
    await pool.query('INSERT INTO offboarding_step_template_items (template_step_id, label, sort_order) VALUES (?, "Receive formal resignation letter", 1), (?, "Define Last Working Day and announce to team", 2)', [offStep1.insertId, offStep1.insertId]);

    const [offStep2] = await pool.query('INSERT INTO offboarding_step_templates (company_id, step_number, name, owner, sla, sort_order) VALUES (?, 2, "Asset Recovery", "IT Department", "2 days", 2)', [companyId]);
    await pool.query('INSERT INTO offboarding_step_template_items (template_step_id, label, sort_order) VALUES (?, "Return MacBook Pro M3 Laptop", 1), (?, "Deactivate Google workspace & Slack", 2)', [offStep2.insertId, offStep2.insertId]);

    const [offStep3] = await pool.query('INSERT INTO offboarding_step_templates (company_id, step_number, name, owner, sla, sort_order) VALUES (?, 3, "Final Financial Clearance", "Finance Department", "5 days", 3)', [companyId]);
    await pool.query('INSERT INTO offboarding_step_template_items (template_step_id, label, sort_order) VALUES (?, "Calculate final payroll & EOSB", 1), (?, "Transfer final settlement & close visa file", 2)', [offStep3.insertId, offStep3.insertId]);

    console.log('   Seeded 3 Offboarding Step Templates with checklists.');
  } catch (err) {
    console.error('❌ Template seeding failed:', err.message);
    process.exit(1);
  }

  // 7. Create Candidate (Simulated ATS entry)
  console.log('\n🎯 [Candidate Creation] Creating candidate "Ahmad Al-Farsi"...');
  let candidateId;
  try {
    const res = await axios.post(`${API_URL}/candidates`, {
      first_name: 'Ahmad',
      last_name: 'Al-Farsi',
      email: 'ahmad.alfarsi@isttech.com',
      phone: '+971501112222',
      nationality: 'Emirati',
      company_id: companyId,
      status: 'Active'
    }, authHeaders);
    candidateId = res.data.id;
    console.log(`   Success! Candidate created. ID: ${candidateId}`);
  } catch (err) {
    console.error('❌ Candidate creation failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 8. Hire Candidate (Move candidate to a success stage to trigger auto-hiring)
  console.log('\n🎉 [ATS Hiring Workflow] Hiring candidate by moving them to the "Success" stage...');
  let employeeId, onboardingId;
  try {
    // Get ats stages
    const stagesRes = await axios.get(`${API_URL}/settings/ats-stages`, authHeaders);
    const successStage = stagesRes.data.find(s => s.is_success === 1 || s.name === 'Success');
    if (!successStage) throw new Error('Success stage not found in ats_stages settings');

    console.log(`   Found Success Stage ID: ${successStage.id} (${successStage.name})`);
    
    // Move candidate
    const moveRes = await axios.put(`${API_URL}/candidates/${candidateId}/move`, {
      stage_id: successStage.id,
      notes: 'Passed all interview stages with flying colors, offer accepted.'
    }, authHeaders);

    console.log('   Success! Candidate moved to hired stage.');

    // Wait a brief second and fetch newly hired employee from database
    const [empRows] = await pool.query('SELECT * FROM employees WHERE candidate_id = ?', [candidateId]);
    if (!empRows.length) throw new Error('Employee record was not automatically created during hiring cascade!');
    employeeId = empRows[0].id;
    console.log(`   Success! Employee record automatically created. ID: ${employeeId}`);

    const [obRows] = await pool.query('SELECT * FROM onboarding_records WHERE employee_id = ?', [employeeId]);
    if (!obRows.length) throw new Error('Onboarding record was not automatically created during hiring cascade!');
    onboardingId = obRows[0].id;
    console.log(`   Success! Onboarding record automatically created. ID: ${onboardingId}`);
  } catch (err) {
    console.error('❌ ATS Hiring Workflow failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 9. Initialize Onboarding Steps
  console.log('\n📝 [Onboarding Processing] Initializing onboarding steps from company templates...');
  try {
    const res = await axios.post(`${API_URL}/onboarding/${onboardingId}/init`, {}, authHeaders);
    console.log(`   Success! Initialized ${res.data.steps_created} onboarding steps.`);

    // Fetch steps and checklist items
    const detailRes = await axios.get(`${API_URL}/onboarding/${onboardingId}`, authHeaders);
    const steps = detailRes.data.steps;

    console.log('   Steps to process:');
    for (const step of steps) {
      console.log(`     - Step ${step.step_number}: "${step.name}" (${step.status})`);
      for (const item of step.checklist_items) {
        console.log(`        [${item.is_checked ? 'x' : ' '}] Check item: "${item.label}" (ID: ${item.id})`);
        
        // Toggle checklist item to checked
        await axios.put(`${API_URL}/onboarding/checklist/${item.id}`, { is_checked: true }, authHeaders);
      }
      // Complete step
      console.log(`     Completing Step ${step.step_number}...`);
      await axios.put(`${API_URL}/onboarding/steps/${step.id}/complete`, {}, authHeaders);
    }

    // Verify employee status became Active
    const [activeEmp] = await pool.query('SELECT status FROM employees WHERE id = ?', [employeeId]);
    console.log(`   Success! Onboarding completed. Employee status is now: ${activeEmp[0].status}`);
  } catch (err) {
    console.error('❌ Onboarding processing failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 10. Allocating Assets
  console.log('\n💻 [Asset Allocation] Assigning assets to the active employee...');
  let assetId;
  try {
    // Omit platform_id to avoid quantity mismatch issues, setting details in the name
    const assetRes = await axios.post(`${API_URL}/assets`, {
      employee_id: employeeId,
      company_id: companyId,
      name: 'Apple MacBook Pro M3 Max (Serial: MP3M-99281-XYZ)',
      asset_type: 'Hardware',
      workspace: 'Dubai Headquarters',
      access_level: 'Local Admin',
      identifier: 'MP3M-99281-XYZ',
      issued_date: new Date().toISOString().split('T')[0],
      status: 'Active',
      notes: 'Brand new, issued in original box.'
    }, authHeaders);
    assetId = assetRes.data.id;
    console.log(`   Success! Asset 1 (MacBook Pro) allocated. ID: ${assetId}`);

    await axios.post(`${API_URL}/assets`, {
      employee_id: employeeId,
      company_id: companyId,
      name: 'Corporate GSuite Account',
      asset_type: 'Account',
      workspace: 'Google Workspace',
      access_level: 'Employee',
      identifier: 'ahmad.alfarsi@isttech.com',
      issued_date: new Date().toISOString().split('T')[0],
      status: 'Active',
      notes: 'Provisioned automatically.'
    }, authHeaders);
    console.log('   Success! Asset 2 (GSuite Account) allocated.');
  } catch (err) {
    console.error('❌ Asset allocation failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 11. Upload Mock Handover Receipt
  console.log('\n📄 [Asset Handover Receipt] Simulating signed receipt upload...');
  try {
    // Generate a dummy buffer to simulate a PDF upload
    const dummyPdfContent = Buffer.from('%PDF-1.4 ... dummy signed receipt ...');
    
    // We will use native global FormData (Node v20+)
    const formData = new FormData();
    const blob = new Blob([dummyPdfContent], { type: 'application/pdf' });
    formData.append('receipt', blob, 'ahmad_alfarsi_macbook_receipt_signed.pdf');

    // Make multipart request using axios
    const uploadRes = await axios.post(`${API_URL}/assets/${assetId}/upload-receipt`, formData, {
      headers: {
        ...authHeaders.headers,
        'Content-Type': 'multipart/form-data'
      }
    });

    console.log(`   Success! Handover receipt uploaded: "${uploadRes.data.file_name}"`);

    // Verify DB updated
    const [assetRows] = await pool.query('SELECT handover_receipt_file FROM asset_assignments WHERE id = ?', [assetId]);
    console.log('   Database verification:', assetRows[0]);
  } catch (err) {
    console.error('❌ Signed receipt upload failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 12. Setup Salary & Allowances (Payroll Settings)
  console.log('\n💵 [Payroll Setup] Setting up salary & allowances for the employee...');
  try {
    await axios.put(`${API_URL}/employees/${employeeId}`, {
      basic_salary: 22000,
      full_salary: 34000, // Basic 22,000 + allowances (Housing: 8,000 + Transport: 4,000)
      department_id: devDeptId,
      job_title_id: jobTitleId,
    }, authHeaders);

    const empRes = await axios.get(`${API_URL}/employees/${employeeId}`, authHeaders);
    console.log(`   Success! Salaries successfully saved:`);
    console.log(`     - Basic Salary: AED ${empRes.data.basic_salary}`);
    console.log(`     - Full Salary: AED ${empRes.data.full_salary}`);
  } catch (err) {
    console.error('❌ Payroll setup failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 13. Initiate Offboarding Workflow (EOSB Calculation)
  console.log('\n🚪 [Offboarding Clearance] Initiating resignation & calculating End of Service Benefit (EOSB)...');
  let offboardingId;
  try {
    // Set start date to exactly 2 years ago so we have a meaningful EOSB tenure
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    await pool.query('UPDATE employees SET start_date = ? WHERE id = ?', [twoYearsAgo, employeeId]);
    console.log(`   [Backdate] Backdated employee start date to: ${twoYearsAgo.toISOString().split('T')[0]}`);

    const res = await axios.post(`${API_URL}/offboarding`, {
      employee_id: employeeId,
      departure_type: 'Resignation',
      last_working_day: '2026-06-30',
      reason: 'Relocating to another city for personal reasons.'
    }, authHeaders);

    offboardingId = res.data.id;
    console.log(`   Success! Offboarding clearance record initialized. ID: ${offboardingId}`);
    console.log(`   📊 Calculated UAE End of Service Benefit (EOSB): AED ${res.data.eosb_amount}`);
  } catch (err) {
    console.error('❌ Offboarding initiation failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 14. Complete Offboarding Clearance Steps
  console.log('\n🗝️  [Offboarding Checklist] Processing final offboarding checklist...');
  try {
    const detailRes = await axios.get(`${API_URL}/offboarding/${offboardingId}`, authHeaders);
    const steps = detailRes.data.steps;

    console.log('   Steps to clear:');
    for (const step of steps) {
      console.log(`     - Step ${step.step_number}: "${step.name}" (${step.status})`);
      for (const item of step.checklist_items) {
        console.log(`        [${item.is_checked ? 'x' : ' '}] Check item: "${item.label}" (ID: ${item.id})`);
        
        // Toggle checklist item
        await axios.put(`${API_URL}/offboarding/checklist/${item.id}`, { is_checked: true }, authHeaders);
      }
      // Complete step
      console.log(`     Completing Step ${step.step_number}...`);
      await axios.put(`${API_URL}/offboarding/steps/${step.id}/complete`, {}, authHeaders);
    }

    // Verify employee status became Exited
    const [exitedEmp] = await pool.query('SELECT status, end_date FROM employees WHERE id = ?', [employeeId]);
    console.log(`   Success! Clearance completed.`);
    console.log(`   Database verification: Employee status is now: "${exitedEmp[0].status}", exit date: ${exitedEmp[0].end_date}`);
  } catch (err) {
    console.error('❌ Offboarding checklist failed:', err.response?.data || err.message);
    process.exit(1);
  }

  // 15. Verify Audit Logs
  console.log('\n📝 [Audit Logs Verification] Verifying administrative trail...');
  try {
    const auditRes = await axios.get(`${API_URL}/audit?limit=10`, authHeaders);
    console.log('   Recent Audit entries generated by E2E test:');
    const logs = auditRes.data.data.slice(0, 5);
    for (const log of logs) {
      console.log(`     [${log.created_at}] - ${log.user_name} on ${log.module} (${log.action}): ${log.detail}`);
    }
    console.log('\n   Success! Audit trail perfectly verified.');
  } catch (err) {
    console.error('❌ Audit logs verification failed:', err.response?.data || err.message);
    process.exit(1);
  }

  console.log('\n================================================================');
  console.log('🏆 E2E BUSINESS SCENARIO COMPLETED AND VERIFIED 100% SUCCESSFULLY');
  console.log('================================================================');

  await pool.end();
}

run().catch(console.error);
