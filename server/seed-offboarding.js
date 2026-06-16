import pool from './config/db.js';

const steps = [
  {
    step_number: 1,
    name: 'Resignation Acceptance & Notice Period',
    owner: 'HR Manager',
    sla: '1 business day',
    items: [
      'Review and acknowledge resignation/termination letter',
      'Confirm last working day (LWD)',
      'Notify line manager and department head',
      'Update employee status to Offboarding in system',
      'Send exit confirmation email to employee',
      'Calculate notice period and any buy-out if applicable'
    ]
  },
  {
    step_number: 2,
    name: 'Knowledge Transfer & Handover',
    owner: 'Line Manager',
    sla: '5 business days',
    items: [
      'Create knowledge transfer document',
      'Identify and brief replacement/backup employee',
      'Transfer ongoing projects and responsibilities',
      'Document all pending tasks and deadlines',
      'Share critical passwords and access credentials securely',
      'Complete handover sign-off with manager'
    ]
  },
  {
    step_number: 3,
    name: 'IT & System Access Revocation',
    owner: 'IT Department',
    sla: 'On LWD',
    items: [
      'Backup employee email and data',
      'Revoke email and Microsoft 365 access',
      'Disable VPN and remote access',
      'Remove from Active Directory / LDAP groups',
      'Revoke CRM, ERP, and internal tool access',
      'Disable biometric/access card entry',
      'Transfer shared drive files to manager'
    ]
  },
  {
    step_number: 4,
    name: 'Asset Return & Equipment Collection',
    owner: 'IT / Admin',
    sla: 'On LWD',
    items: [
      'Collect company laptop/desktop',
      'Collect mobile phone (if company-provided)',
      'Collect access cards and office keys',
      'Collect uniform/branded items (if applicable)',
      'Collect company credit card',
      'Verify all assets returned against asset register',
      'Print and sign Asset Handover Receipt'
    ]
  },
  {
    step_number: 5,
    name: 'Financial Clearance & EOSB',
    owner: 'Finance / HR',
    sla: '3 business days',
    items: [
      'Calculate End of Service Benefit (EOSB)',
      'Settle pending expense claims and reimbursements',
      'Deduct any outstanding loans or advances',
      'Calculate unused annual leave balance',
      'Process final salary payment',
      'Prepare final settlement statement',
      'Issue salary transfer letter to bank'
    ]
  },
  {
    step_number: 6,
    name: 'Exit Interview',
    owner: 'HR Specialist',
    sla: '2 business days before LWD',
    items: [
      'Schedule exit interview with employee',
      'Conduct exit interview and capture feedback',
      'Document key reasons for departure',
      'Record suggestions for improvement',
      'Update exit interview database/report'
    ]
  },
  {
    step_number: 7,
    name: 'Legal & Document Processing',
    owner: 'HR / PRO',
    sla: '5 business days after LWD',
    items: [
      'Generate Experience/Service Letter',
      'Generate Salary Certificate (if requested)',
      'Process work permit/visa cancellation',
      'Cancel medical insurance',
      'Process Emirates ID return (if applicable)',
      'Update labor ministry portal',
      'Archive employee file and records'
    ]
  },
  {
    step_number: 8,
    name: 'Final Sign-Off & Closure',
    owner: 'HR Manager',
    sla: '1 business day after LWD',
    items: [
      'Verify all clearance steps are completed',
      'Obtain employee signature on clearance form',
      'Issue No Objection Certificate (NOC) if applicable',
      'Send farewell communication to team',
      'Update employee status to Exited in system',
      'Close offboarding case'
    ]
  }
];

async function seed() {
  const companyIds = [1, 2];
  
  // Clear existing templates
  await pool.query('DELETE FROM offboarding_step_template_items');
  await pool.query('DELETE FROM offboarding_step_templates');
  console.log('Cleared old templates');
  
  for (const companyId of companyIds) {
    for (const step of steps) {
      const [result] = await pool.query('INSERT INTO offboarding_step_templates SET ?', {
        company_id: companyId,
        departure_type: null,
        step_number: step.step_number,
        name: step.name,
        owner: step.owner,
        sla: step.sla,
        sort_order: step.step_number
      });
      
      for (let i = 0; i < step.items.length; i++) {
        await pool.query('INSERT INTO offboarding_step_template_items SET ?', {
          template_step_id: result.insertId,
          label: step.items[i],
          sort_order: i + 1
        });
      }
    }
    console.log(`Templates seeded for company ${companyId}`);
  }
  
  const [[count]] = await pool.query('SELECT COUNT(*) as cnt FROM offboarding_step_templates');
  const [[itemCount]] = await pool.query('SELECT COUNT(*) as cnt FROM offboarding_step_template_items');
  console.log(`Done! ${count.cnt} steps with ${itemCount.cnt} checklist items total.`);
  process.exit(0);
}

seed().catch(e => { console.error(e); process.exit(1); });
