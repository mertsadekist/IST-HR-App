// English knowledge-base content. Mirror every `id` in ar.js.
// Article shape: { id, route, group, roles, icon, title, overview, whenToUse,
//   diagram:{type:'flow', steps:[]} (optional), images:[{src,caption}] (files live in /public/kb),
//   steps:[{title,detail}], tips:[], faq:[{q,a}], related:[] }

const articles = [
  // ───────────────────────── Getting started / concepts ─────────────────────────
  {
    id: 'login', route: '/login', group: 'start', roles: null, icon: 'Lock',
    title: 'Signing in',
    overview: 'The login screen authenticates you into the IST HR System management portal. After you sign in you land on the Dashboard, scoped to the company (Entity) you last worked on.',
    whenToUse: 'Every time you open the system or after your session expires and you are logged out.',
    steps: [
      { title: 'Enter your username', detail: 'Use the username an administrator created for you (not your email unless that is your username).' },
      { title: 'Enter your password', detail: 'Click the eye icon to reveal what you typed if you want to verify it.' },
      { title: 'Click Sign In', detail: 'On success you are redirected to the Dashboard; on failure the system tells you the credentials are invalid.' },
    ],
    tips: [
      'Switch the interface language (العربية / English) any time from the globe icon in the top bar — the whole layout flips to RTL for Arabic.',
      'Sessions last 24 hours; after that you simply sign in again.',
    ],
    faq: [
      { q: 'I forgot my password — what do I do?', a: 'Ask an administrator to reset it from Operations → Users → open your user → Reset password. There is no self-service reset.' },
      { q: 'Why am I sent back to the login page?', a: 'Your session token expired (tokens last 24h) or you signed out — just sign in again.' },
      { q: 'Can I use the system in Arabic?', a: 'Yes. Use the language toggle (العربية) in the top bar; the entire interface, including layout direction (RTL), switches instantly.' },
    ],
    related: ['dashboard', 'roles', 'users'],
  },
  {
    id: 'dashboard', route: '/dashboard', group: 'start', roles: null, icon: 'LayoutDashboard',
    title: 'Dashboard',
    overview: 'A real-time overview of the selected company: four headline counters, the live recruitment pipeline, a 6-month hiring trend, and a recent-activity feed. A banner confirms whether the AI engine (DeepSeek) is connected for CV scoring, letter generation and interview questions.',
    whenToUse: 'As your daily starting point to gauge recruitment and headcount at a glance, and to confirm the system and AI are online.',
    images: [
      { src: 'dashbpard.jpg', caption: 'The Dashboard: KPI cards (candidates, open vacancies, active employees, hires this month), the AI status banner, the recruitment pipeline distribution, the 6-month hires trend, and a recent-activity feed — all scoped to the selected Entity in the sidebar.' },
    ],
    steps: [
      { title: 'Pick the company (Entity)', detail: 'Use the Entity switcher at the top of the sidebar — every figure on the dashboard reflects the selected company.' },
      { title: 'Read the KPI cards', detail: 'Totals for candidates, open vacancies, active employees and this month’s hires.' },
      { title: 'Scan the pipeline & trend', detail: 'See how candidates are distributed across stages (New Applicants → Offer Made) and how hiring has trended over the last 6 months.' },
      { title: 'Check recent activity', detail: 'The feed lists the latest create/update/delete and login events with who did them and when.' },
    ],
    tips: [
      'All numbers follow the selected Entity — switch companies to compare them.',
      'If the AI banner shows “Connected”, CV scoring and letter generation are available; if not, ask an admin to check the AI key.',
    ],
    faq: [
      { q: 'Why are my numbers zero?', a: 'You may have the wrong company selected, or no data has been entered for that entity yet.' },
      { q: 'Does the dashboard auto-refresh?', a: 'It loads fresh data each time you open it or switch companies.' },
      { q: 'What is the activity feed?', a: 'A short, live extract of the Audit Log showing the most recent actions across the company you can see.' },
    ],
    related: ['entity', 'reports', 'ats', 'audit'],
  },
  {
    id: 'entity', route: null, group: 'start', roles: null, icon: 'Building2',
    title: 'Switching companies (Entity)',
    overview: 'The system manages ONE organization that owns several companies. The Entity switcher at the top of the sidebar selects which company you are working on; everything you view or create belongs to it. The role you hold decides your permissions — the Entity decides which company’s data you see.',
    whenToUse: 'Before entering or reviewing any data — always confirm the correct company is selected.',
    diagram: { type: 'flow', steps: ['Open the Entity dropdown', 'Pick a company', 'All pages scope to it', 'Create/view data under it'] },
    images: [
      { src: 'company-switcher.jpg', caption: 'The Entity switcher sits at the top of the sidebar, just under your name. Internal staff can switch between every company in the organization.' },
    ],
    steps: [
      { title: 'Find the Entity dropdown', detail: 'It sits just under your name at the top of the sidebar.' },
      { title: 'Select a company', detail: 'There is no “All companies” option — a specific company must always be selected.' },
      { title: 'Work normally', detail: 'Employees, assets, leave, letters, payroll, reports, etc. are all saved under and filtered by the chosen company.' },
    ],
    tips: [
      'Internal staff (admin, HR manager, recruiter) can see every company and switch freely; an employee only ever sees their own.',
      'A wrong Entity is the usual reason data “does not appear” — switch and recheck before assuming something is missing.',
    ],
    faq: [
      { q: 'Why can’t I pick “All companies”?', a: 'By design — every record must belong to a specific company, so you always choose one.' },
      { q: 'I added data but a colleague can’t see it.', a: 'They are probably viewing a different Entity. Ask them to switch to the same company.' },
      { q: 'Who can see all companies?', a: 'admin, hr_manager and recruiter roles are organization-wide; an employee is pinned to their own company.' },
    ],
    related: ['roles', 'dashboard', 'companies'],
  },
  {
    id: 'roles', route: null, group: 'start', roles: null, icon: 'ShieldCheck',
    title: 'Roles & permissions',
    overview: 'Each user has a role that controls what they can do. Because this is one organization with several companies, roles govern permissions — not which company’s data is visible (that is the Entity). There are four roles: admin, hr_manager, recruiter and employee.',
    whenToUse: 'When deciding what access to give a new user, or to understand why an action is blocked for you.',
    images: [
      { src: 'roles-permissions.jpg', caption: 'The roles reference: admin (full access), hr_manager (full HR, no deletes, companies view-only), recruiter (recruitment only) and employee (personal portal only).' },
    ],
    steps: [
      { title: 'admin', detail: 'Everything: settings, user management, creating/editing/deleting companies, deleting any record, and all companies.' },
      { title: 'hr_manager', detail: 'Manages every HR module and structural settings across all companies; cannot DELETE anything, cannot add/edit companies (view only), and cannot manage users.' },
      { title: 'recruiter', detail: 'Recruitment only — candidates, vacancies, ATS board and applicants.' },
      { title: 'employee', detail: 'Self-service portal only: their own assigned assets and account credentials.' },
    ],
    tips: ['Grant the least role a person needs. User & role management stays with admins to prevent privilege escalation.'],
    faq: [
      { q: 'Why does HR get “Insufficient permissions” when deleting?', a: 'Deleting is restricted to admins by design; hr_manager can do everything except delete — the delete buttons are hidden for them.' },
      { q: 'Why can’t HR add a company?', a: 'Creating/editing/deleting companies is admin-only; HR sees companies as read-only.' },
      { q: 'Can HR manage users?', a: 'No — only admins manage users and roles, which keeps the no-delete and company rules enforceable.' },
    ],
    related: ['users', 'entity', 'companies'],
  },
  {
    id: 'send-documents', route: null, group: 'start', roles: ['admin', 'hr_manager'], icon: 'Send',
    title: 'Sending documents by email (PDF + letterhead)',
    overview: 'Across the app you can email a document as a PDF with a bilingual cover message — “as per your request, please find attached …”. When the issuing company has an uploaded letterhead, the content is composed onto it; otherwise a clean branded layout is used. Every send is recorded in the Email Log.',
    whenToUse: 'To send a legal letter, employment offer, asset handover receipt or report to an employee, manager or HR.',
    diagram: { type: 'flow', steps: ['Open the document', 'Send by Email (PDF)', 'Recipient + cover note', 'Composed onto letterhead', 'Sent + logged'] },
    images: [
      { src: 'sending-documents-by-email.jpg', caption: 'The Send-by-email dialog: recipient, optional CC (manager/HR), and a cover message. The document is rendered to PDF in your browser (so Arabic and RTL come out exactly as shown) and attached.' },
    ],
    steps: [
      { title: 'Open the document', detail: 'On a letter, offer, receipt or report, click “Send by Email (PDF)” (or use Print/Download to preview first).' },
      { title: 'Fill recipient + note', detail: 'Enter the email, an optional CC (manager/HR), and an optional cover message.' },
      { title: 'Send', detail: 'The PDF is generated in your browser, composed onto the company letterhead, attached, and emailed — then recorded in the Email Log.' },
    ],
    tips: [
      'Upload each company’s letterhead in Settings → Companies (admin) and tune the top margin so text sits below the printed header.',
      'Use “Download PDF” first to preview the exact output before sending.',
    ],
    faq: [
      { q: 'Email isn’t sending — why?', a: 'SMTP must be configured and verified in Settings → Email (admin), and email sending must be enabled.' },
      { q: 'The letterhead overlaps the text.', a: 'Increase the top margin for that company in Settings → Companies → Letterhead.' },
      { q: 'Does it work in Arabic?', a: 'Yes — the PDF is rendered from the on-screen content, so Arabic and RTL come out exactly as shown.' },
    ],
    related: ['legal-letters', 'companies', 'email-settings', 'email-log'],
  },

  // ───────────────────────── Recruitment ─────────────────────────
  {
    id: 'ats', route: '/ats', group: 'recruitment', roles: ['admin', 'hr_manager', 'recruiter'], icon: 'Kanban',
    title: 'ATS Pipeline',
    overview: 'A Kanban board of candidates grouped by recruitment stage. Each column is a configurable stage (New Applicants → Shortlisted → … → Offer Made → Success). Drag a card between columns to move a candidate forward instantly.',
    whenToUse: 'To see, at a glance, where every candidate stands in the hiring process and to advance them.',
    diagram: { type: 'flow', steps: ['New Applicants', 'Shortlisted', 'Contacted', 'Interview', 'Offer Made', 'Success'] },
    images: [
      { src: 'ats-pipeline.jpg', caption: 'The ATS Pipeline Kanban board. Columns are the recruitment stages; drag a candidate card from one column to the next to update their stage.' },
    ],
    steps: [
      { title: 'Filter by vacancy', detail: 'Optionally narrow the board to a single open position.' },
      { title: 'Drag to move stage', detail: 'Drag a candidate card to another column to update their stage immediately.' },
      { title: 'Refresh', detail: 'Reload to pull in changes made by colleagues.' },
    ],
    tips: ['Stage names, colors and order are configurable in Settings → System Config → ATS Stages.'],
    faq: [
      { q: 'How do I add a candidate to the board?', a: 'Add them in the Candidates page; they appear here automatically at the default stage.' },
      { q: 'Moving a card failed.', a: 'You may lack permission or the network dropped — refresh and try again.' },
    ],
    related: ['candidates', 'vacancies', 'applicants', 'system-config'],
  },
  {
    id: 'candidates', route: '/candidates', group: 'recruitment', roles: ['admin', 'hr_manager', 'recruiter'], icon: 'Users',
    title: 'Candidates',
    overview: 'The central list of candidates with search, status filter and pagination. Add or edit candidates, upload and AI-parse their CV, and open a full profile with experience, salary history, a timeline, notes and an AI summary.',
    whenToUse: 'To register applicants, review their details, and move them through the hiring pipeline.',
    images: [
      { src: 'candidates.jpg', caption: 'The Candidates list with search, status filter (Active / Hired / Failed / Blacklisted) and pagination. Click a row to open the full candidate profile.' },
      { src: 'add-candidate.jpg', caption: 'Add Candidate: enter name, contact and target vacancy manually, or upload a CV to auto-fill the fields with AI.' },
    ],
    steps: [
      { title: 'Add a candidate', detail: 'Click Add Candidate and fill name, contact and vacancy; or upload a CV to auto-fill via AI.' },
      { title: 'Read the CV data', detail: 'In the profile, “Read CV data” parses the uploaded CV into experience, skills, languages and more.' },
      { title: 'Manage status & stage', detail: 'Update status, add notes, and move the candidate through the pipeline.' },
    ],
    tips: [
      'Salary and experience shown come from the real parsed CV — nothing is fabricated.',
      'Re-run “Read CV data” after uploading a new CV to refresh the extracted fields.',
    ],
    faq: [
      { q: 'The CV didn’t parse.', a: 'Ensure it’s a PDF/DOC/DOCX with selectable text; scanned images can’t be read. Then click “Read CV data”.' },
      { q: 'Why is experience/salary empty?', a: 'The CV didn’t contain it — the system only shows what it actually found.' },
      { q: 'How do I delete a candidate?', a: 'Only admins can delete; HR can edit and change status.' },
    ],
    related: ['ats', 'cv-scorer', 'vacancies', 'applicants'],
  },
  {
    id: 'vacancies', route: '/vacancies', group: 'recruitment', roles: ['admin', 'hr_manager', 'recruiter'], icon: 'FileText',
    title: 'Vacancies',
    overview: 'Create and manage open positions, then publish them to a public, branded Careers page and share the link in campaigns. Applications submitted there land under Applicants.',
    whenToUse: 'When you open a role and want to receive applications, internally or publicly.',
    images: [
      { src: 'vacancies.jpg', caption: 'The Vacancies list with search and status filter; each row shows the title, status and headcount, with publish and copy-link actions.' },
      { src: 'create-vacancy.jpg', caption: 'Create Vacancy: title, department, location, employment type, salary, description and requirements.' },
    ],
    steps: [
      { title: 'Create a vacancy', detail: 'Add title, department, location, employment type, salary, description and requirements.' },
      { title: 'Publish', detail: 'Publish to generate a public Careers page, then copy its link to share externally.' },
      { title: 'Track applicants', detail: 'Applications from the public page appear under Applicants with the source captured.' },
    ],
    tips: ['Use a clear, public-friendly title and description — it appears on the careers page candidates see.'],
    faq: [
      { q: 'Where is the public link?', a: 'Publish the vacancy, then use “Copy public link”; it opens the Careers page for that role.' },
      { q: 'Can I close a vacancy?', a: 'Yes — set its status; closed roles stop accepting public applications.' },
    ],
    related: ['careers', 'applicants', 'ats', 'cv-scorer'],
  },
  {
    id: 'applicants', route: '/applicants', group: 'recruitment', roles: ['admin', 'hr_manager', 'recruiter'], icon: 'Inbox',
    title: 'Applicants',
    overview: 'Candidates who applied through your public Careers pages. Review each application and CV, star-rate for triage, schedule interviews, record structured evaluations, move stages, and convert a hire into an onboarding record.',
    whenToUse: 'To process inbound applications from public job postings end-to-end.',
    diagram: { type: 'flow', steps: ['Application received', 'Review + rate', 'Interview', 'Evaluate', 'Convert to onboarding'] },
    images: [
      { src: 'applicants.jpg', caption: 'The Applicants inbox: filter by vacancy/stage or search, star-rate for quick triage, and open an application to review the CV, schedule interviews and add evaluations.' },
    ],
    steps: [
      { title: 'Filter & open', detail: 'Filter by vacancy/stage or search, then open an application to see details and the CV.' },
      { title: 'Interview & evaluate', detail: 'Schedule interviews (this can send an invite) and add structured evaluations.' },
      { title: 'Advance or convert', detail: 'Move the stage, reject with a reason, or convert an accepted candidate into an onboarding record.' },
    ],
    tips: ['Star-rate applicants for quick triage; the rating shows on the list.'],
    faq: [
      { q: 'No applicants are showing.', a: 'Publish a vacancy and share its public link to start receiving applications.' },
      { q: 'What does “Convert to onboarding” do?', a: 'It creates a linked onboarding record so the hire flows straight into the joining process.' },
      { q: 'Can I download the CV?', a: 'Yes — use the CV button on the row or in the detail view.' },
    ],
    related: ['vacancies', 'careers', 'onboarding', 'candidates'],
  },
  {
    id: 'cv-scorer', route: '/cv-scorer', group: 'recruitment', roles: ['admin', 'hr_manager', 'recruiter'], icon: 'Target',
    title: 'CV Scorer',
    overview: 'Create a vacancy profile (must-have / nice-to-have skills, seniority, minimum experience) and let AI score candidates against it, then generate tailored interview questions or draft a full job description.',
    whenToUse: 'To objectively compare candidates to a role’s requirements and speed up screening.',
    diagram: { type: 'flow', steps: ['Create profile', 'Score candidates (AI)', 'Review fit + summary', 'Generate questions / JD'] },
    images: [
      { src: 'cv-scorer.jpg', caption: 'CV Scorer: profiles list and AI-generated scores with a fit level and summary per candidate.' },
      { src: 'cv-scorer-create-profile.jpg', caption: 'Create a scoring profile: job title, seniority, minimum experience, and must-have / nice-to-have skills.' },
    ],
    steps: [
      { title: 'Create a profile', detail: 'Define job title, seniority, minimum experience, and must-have / nice-to-have skills.' },
      { title: 'Score candidates', detail: 'Run AI scoring to rank candidates with a fit level and a short rationale.' },
      { title: 'Generate aids', detail: 'Produce tailored interview questions or a job description from the profile.' },
    ],
    tips: ['Specific must-have skill lists produce sharper scores — be precise.'],
    faq: [
      { q: 'Scoring failed.', a: 'The AI service may be unavailable, or a candidate has no parsed CV; ensure CVs are uploaded and try again.' },
      { q: 'Are scores final decisions?', a: 'No — they are a screening aid; combine them with interviews and evaluations.' },
    ],
    related: ['candidates', 'vacancies', 'ats', 'skills'],
  },
  {
    id: 'careers', route: null, group: 'recruitment', roles: ['admin', 'hr_manager', 'recruiter'], icon: 'Globe',
    title: 'Public Careers page',
    overview: 'The branded, public application page for a published vacancy. Candidates review the role, accept a privacy/data-protection consent, fill a form and upload a CV. It is fully bilingual and shows the company logo and brand colors automatically.',
    whenToUse: 'Share its link in job ads and campaigns to collect applications directly into Applicants.',
    diagram: { type: 'flow', steps: ['Review role', 'Privacy consent', 'Fill form + CV', 'Submitted → Applicants'] },
    steps: [
      { title: 'Publish the vacancy', detail: 'From Vacancies, publish the role and copy the public link.' },
      { title: 'Share with UTM (optional)', detail: 'Append UTM parameters to the link to track which campaign produced each application.' },
      { title: 'Receive applications', detail: 'Submissions arrive under Applicants with the source captured.' },
    ],
    tips: ['The page picks up the company logo and brand colors automatically; it is fully bilingual.'],
    faq: [
      { q: 'Applicants say the page is unavailable.', a: 'The vacancy must be published and open; check its status and deadline.' },
      { q: 'Is consent required?', a: 'Yes — applicants must accept the privacy/data-protection terms before submitting.' },
    ],
    related: ['vacancies', 'applicants'],
  },

  // ───────────────────────── Employee lifecycle ─────────────────────────
  {
    id: 'employees', route: '/employees', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'Users',
    title: 'Employee Directory',
    overview: 'The directory of active staff. Add employees through a guided 5-step wizard — the “Employee Onboarding Hub” (Docs & AI → Personal → Placement → Assets → Access) — with optional CV/passport auto-fill, then open any employee to view their profile and upload/download official documents.',
    whenToUse: 'To register current and historical employees, maintain their records, and store their official documents.',
    diagram: { type: 'flow', steps: ['Docs & AI', 'Personal', 'Placement & Compensation', 'Assets', 'System Access'] },
    images: [
      { src: 'employees-hub.jpg', caption: 'The Employee Directory: staff rows with contact, role, department and status; open a profile for full details and the documents tab.' },
      { src: 'employee-onboarding-hub-docs-ai.jpg', caption: 'Step 1 — Docs & AI: upload a CV or passport and let AI extract the candidate’s details to pre-fill the wizard.' },
      { src: 'employee-onboarding-hub-personal-details.jpg', caption: 'Step 2 — Personal: first/last name, email, phone and nationality (auto-filled from the document when available).' },
      { src: 'employee-onboarding-hub-placement-compensation.jpg', caption: 'Step 3 — Placement & Compensation: company, department, job title, basic & full salary, and the REAL original start date.' },
      { src: 'employee-onboarding-hub-allocate-company-assets.jpg', caption: 'Step 4 — Assets: optionally allocate company equipment/accounts to the new employee right from the wizard.' },
      { src: 'employee-onboarding-hub-system-access.jpg', caption: 'Step 5 — System Access: optionally create a login so the employee can reach their self-service portal.' },
    ],
    steps: [
      { title: 'Start the wizard', detail: 'Click Add Employee. On step 1 (Docs & AI) you can upload a CV/passport to auto-fill name, email, phone and nationality.' },
      { title: 'Enter placement & pay', detail: 'Company, department, job title, basic & full salary, and the REAL original start date (vital for seniority and end-of-service).' },
      { title: 'Allocate assets (optional)', detail: 'Assign equipment or accounts to the employee during onboarding.' },
      { title: 'Create access (optional)', detail: 'Create a login so the employee reaches their portal; pick the right role.' },
      { title: 'Upload documents', detail: 'Open the profile → Documents tab → upload contracts, ID, visa and certificates by category.' },
    ],
    tips: [
      'For migration of existing staff, enter each employee’s real joining date and salary before going live — never use today’s date.',
      'Uploaded documents are stored on persistent storage and survive redeploys.',
    ],
    faq: [
      { q: 'How do I add old employees in bulk?', a: 'Add them one by one via the wizard, department by department, with correct start dates and Active status.' },
      { q: 'Where do uploaded documents go?', a: 'They are kept securely per employee and persist across deployments.' },
      { q: 'Why enter the original start date?', a: 'Seniority and end-of-service (EOSB) calculations depend on it — never use today’s date for existing staff.' },
    ],
    related: ['onboarding', 'assets', 'leave', 'payroll-runs'],
  },
  {
    id: 'onboarding', route: '/onboarding', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'UserCheck',
    title: 'Onboarding',
    overview: 'A gated, stage-based hiring workflow that takes a new hire from CV to a fully onboarded employee: CV → HR review → offer → signed offer → documents → visa → bank → completed. Each stage unlocks only when its requirements are met; completion automatically adds the person to the Employee Directory.',
    whenToUse: 'For every new hire, to run a consistent joining process with documents, offer, visa and bank steps.',
    diagram: { type: 'flow', steps: ['CV', 'HR review', 'Offer', 'Signed offer', 'Documents', 'Visa', 'Bank', 'Completed'] },
    images: [
      { src: 'employee-onboarding.jpg', caption: 'The Onboarding list: a stage-based hiring workflow. Use “Add New Employee” to start a record, or it is created automatically when you convert an applicant.' },
      { src: 'employee-onboarding-onboarding-candidate.jpg', caption: 'A new onboarding record at the CV stage — upload the candidate CV so AI can extract the profile.' },
      { src: 'employee-onboarding-under-hr-review.jpg', caption: 'HR review: verify the extracted profile, then approve to proceed to the offer stage.' },
      { src: 'employee-onboarding-employment-offers.jpg', caption: 'Employment offer: create the offer with role, salary and terms.' },
      { src: 'employee-onboarding-offer-email-preview.jpg', caption: 'Preview the offer email before sending it to the candidate.' },
      { src: 'employee-onboarding-signed-offer.jpg', caption: 'Signed offer: upload the candidate’s signed copy and verify it to unlock the next stage.' },
      { src: 'employee-onboarding-required-documents.jpg', caption: 'Required Documents: a checklist of documents to collect (passport, photo, certificates …).' },
      { src: 'employee-onboarding-required-documents-verified.jpg', caption: 'Documents marked Verified — the stage requirement is satisfied.' },
      { src: 'employee-onboarding-visa-residency-steps.jpg', caption: 'Visa / Residency steps: track each immigration step to completion.' },
      { src: 'employee-onboarding-bank-details-for-salary-transfer.jpg', caption: 'Bank details for salary transfer, captured before completion.' },
      { src: 'employee-onboarding-send-document-by-email.jpg', caption: 'Send any onboarding document (e.g. the offer) by email as a PDF, composed onto the company letterhead.' },
      { src: 'employee-onboarding-onboarding-completed.jpg', caption: 'All stages complete — advancing finalizes the record and adds the person to the Employee Directory as Active.' },
    ],
    steps: [
      { title: 'Start & upload CV', detail: 'Add a new onboarding and upload the candidate CV; AI extracts the profile.' },
      { title: 'Review & approve', detail: 'HR verifies the profile, then approves to proceed to the offer.' },
      { title: 'Offer → signed offer', detail: 'Create and send the employment offer; upload the signed copy and verify it.' },
      { title: 'Documents → visa → bank', detail: 'Collect required documents, track visa/residency steps, and record bank details.' },
      { title: 'Advance to complete', detail: 'When all stages are satisfied, advancing finalizes the record and adds the employee to the Directory.' },
    ],
    tips: [
      'The “Advance stage” button stays disabled until the current stage’s requirements are satisfied — the panel lists what is pending.',
      'Applicants you convert to onboarding land here automatically.',
    ],
    faq: [
      { q: 'Why can’t I advance the stage?', a: 'Required items are missing — the panel lists what’s pending (e.g. an unverified profile or missing documents).' },
      { q: 'What happens at completion?', a: 'The candidate becomes an Active employee in the Employee Directory, linked to this record.' },
      { q: 'Can I send the offer as a PDF on letterhead?', a: 'Yes — preview the offer, then “Send as PDF”; it composes onto the company letterhead if one is set.' },
    ],
    related: ['applicants', 'employees', 'send-documents', 'system-config'],
  },
  {
    id: 'leave', route: '/leave', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'CalendarDays',
    title: 'Leave Management',
    overview: 'Submit and manage leave requests, set per-employee entitlements (balances), and define leave types (paid/unpaid, default days). HR approves or rejects requests, and balances update automatically. Unpaid leave feeds into payroll deductions.',
    whenToUse: 'To handle time-off requests and track the remaining balance per employee.',
    diagram: { type: 'flow', steps: ['Request', 'Pending', 'HR approves / rejects', 'Balance updated'] },
    images: [
      { src: 'leave-management.jpg', caption: 'Leave Management: requests with status, plus tabs for leave types and per-employee balances.' },
      { src: 'leave-management-new-leave-request.jpg', caption: 'New leave request: pick the leave type and dates; HR can also file on behalf of an employee.' },
    ],
    steps: [
      { title: 'Create a request', detail: 'Choose leave type and dates; HR can file on behalf of an employee.' },
      { title: 'Approve / reject', detail: 'HR acts on pending requests; a rejection note is recommended.' },
      { title: 'Manage types & balances', detail: 'Define leave types and set yearly entitlements per employee.' },
    ],
    tips: ['Set entitlements at the start of the year so remaining balances are accurate.'],
    faq: [
      { q: 'How are balances calculated?', a: 'Entitled minus used, per type per year; approved leave reduces the remaining balance.' },
      { q: 'Can an employee request for themselves?', a: 'Yes; HR can also file on behalf of any employee.' },
      { q: 'Does unpaid leave affect payroll?', a: 'Yes — unpaid leave days feed into payroll run deductions.' },
    ],
    related: ['attendance', 'payroll-runs', 'employees'],
  },
  {
    id: 'attendance', route: '/attendance', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'Clock',
    title: 'Attendance',
    overview: 'Daily check-in/check-out and a monthly summary by status (Present, Late, Absent, On Leave, etc.). HR can add or correct records and filter by employee, date range and status. Absence days flow into payroll deductions.',
    whenToUse: 'To record working time and review monthly attendance per employee.',
    images: [
      { src: 'attendance.jpg', caption: 'Attendance: a month picker with summary badges by status, filters (employee, date range, status), and a records table with hours.' },
      { src: 'attendance-record-attendance.jpg', caption: 'Record attendance: HR adds a record for an employee with date, times and status.' },
      { src: 'attendance-record-attendance-1.jpg', caption: 'The status (e.g. Late) is derived automatically from the check-in time against working hours.' },
    ],
    steps: [
      { title: 'Check in / out', detail: 'Employees record their own time; the status (e.g. Late) is derived automatically.' },
      { title: 'Review the month', detail: 'Pick a month to see totals by status and total hours.' },
      { title: 'Add / correct records (HR)', detail: 'HR can add a record for an employee with the correct date, times and status.' },
    ],
    tips: ['Absence days flow into payroll deductions, so keep attendance accurate before generating a run.'],
    faq: [
      { q: 'How is “Late” determined?', a: 'It is derived from the check-in time against the working hours.' },
      { q: 'Can HR fix a wrong record?', a: 'Yes — add or edit a record with the correct times and status.' },
    ],
    related: ['leave', 'payroll-runs', 'employees'],
  },
  {
    id: 'payroll-runs', route: '/payroll-runs', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'Banknote',
    title: 'Payroll Runs',
    overview: 'Generate a monthly payroll run that pulls salaries and allowances and computes deductions from unpaid leave and absences. Review per-employee payslips, then approve the draft and (admin) mark it paid. Employees can see their own payslips.',
    whenToUse: 'Once a month, to compute and finalize salaries for the selected company.',
    diagram: { type: 'flow', steps: ['Pick month', 'Generate', 'Review payslips', 'Approve', 'Mark paid'] },
    images: [
      { src: 'payroll-runs.jpg', caption: 'Payroll Runs: monthly runs with status; open a run to inspect each employee’s basic, allowances, deductions and net pay.' },
    ],
    steps: [
      { title: 'Generate the run', detail: 'Choose the month and generate; the system computes gross, deductions and net per employee.' },
      { title: 'Review payslips', detail: 'Open the run to inspect each employee’s basic, allowances, unpaid/absence deductions and net.' },
      { title: 'Approve & pay', detail: 'Approve the draft, then (admin) mark it paid.' },
    ],
    tips: ['Finalize leave and attendance for the month before generating, so deductions are correct.'],
    faq: [
      { q: 'Where do deductions come from?', a: 'Unpaid leave days and absence days for the period are pulled automatically.' },
      { q: 'Who can mark a run as paid?', a: 'Admins; HR can generate and approve.' },
      { q: 'Can I delete a run?', a: 'A draft run can be deleted by an admin; approved/paid runs are kept.' },
    ],
    related: ['leave', 'attendance', 'payroll'],
  },
  {
    id: 'salary-reviews', route: '/salary-reviews', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'TrendingUp',
    title: 'Salary Reviews',
    overview: 'The annual salary re-evaluation workflow. HR prepares one review cycle per company per year, listing every active employee with their current salary; propose a new salary and effective date per person, work through a UAE labor-law compliance checklist (contract addendum, MOHRE update, WPS update) and attach proof documents, then submit it for the company’s designated approver to sign off through the system. Once approved, the raise is applied to payroll automatically on its effective date.',
    whenToUse: 'At year-end (or whenever compensation is re-evaluated) to run a documented, auditable salary-increase process instead of ad-hoc paperwork.',
    diagram: { type: 'flow', steps: ['Draft', 'Fill new salaries', 'Submit', 'Approver decides', 'Applied on effective date'] },
    steps: [
      { title: 'Start a review', detail: 'Click New Review and pick the year; every Active employee in the selected company is added automatically with their current salary.' },
      { title: 'Propose new salaries', detail: 'Enter each employee’s new basic/full salary and an effective date; a badge flags a proposal that falls outside the job title’s salary band. Skip anyone who isn’t getting a change.' },
      { title: 'Work the compliance checklist', detail: 'Each employee gets 3 default UAE actions — sign the contract addendum, update the MOHRE labor contract, update the WPS registration — tick them off (or add custom ones) and upload proof documents as you complete them.' },
      { title: 'Submit for approval', detail: 'Submitting is blocked until every employee has a salary and effective date. The company’s designated approver is notified in-app and by email.' },
      { title: 'Approver decides', detail: 'The approver (never the person who prepared it) opens the review and Approves or Rejects — a rejection requires a note and sends the review back to Draft for revision.' },
      { title: 'Generate the letter & apply', detail: 'Generate an AI-drafted, letterhead-composed Salary Revision Letter to print/email, then upload the final signed copy. Approved raises apply to the employee record automatically on their effective date — no manual step.' },
    ],
    tips: [
      'Set the company’s Salary Review Approver first in Settings → Companies (admin) — otherwise any admin can approve, and no one is stuck waiting.',
      'The person who prepares a review can never approve their own review, even if they are an admin — this is enforced by the system.',
      'Raises only take effect on their chosen effective date; the record updates and the employee is notified automatically that day.',
    ],
    faq: [
      { q: 'Who approves a salary review?', a: 'The company’s designated Salary Review Approver (set by an admin in Settings → Companies). If none is set, any admin may approve — except the person who prepared the review.' },
      { q: 'When does the new salary actually apply?', a: 'Automatically on the effective date you set per employee — the system checks periodically and updates the employee record with no manual step.' },
      { q: 'What are the 3 default actions for?', a: 'They track the UAE labor-law paperwork a salary change usually requires: a signed contract addendum, updating the MOHRE labor contract, and updating the WPS salary registration. You can add more per employee.' },
      { q: 'Can I still edit salaries after submitting?', a: 'No — once submitted, edit is locked. If the approver rejects it, use Reopen to bring it back to Draft and revise.' },
      { q: 'Does this replace Payroll Runs?', a: 'No — Salary Reviews updates the employee’s stored salary; Payroll Runs then computes each month’s pay from that updated salary.' },
    ],
    related: ['payroll-runs', 'employees', 'companies', 'payroll', 'send-documents'],
  },
  {
    id: 'assets', route: '/assets', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'Laptop',
    title: 'Assets & Equipment',
    overview: 'Assign company assets to employees — Hardware (linked to Inventory), Software, and Accounts (with encrypted passwords). Print or email a handover receipt, reveal account passwords with permission, and process returns.',
    whenToUse: 'When handing equipment or accounts to staff and tracking custody.',
    images: [
      { src: 'assets.jpg', caption: 'Assets & Equipment: assignments with a status filter; print/email a handover receipt or process a return.' },
      { src: 'assets-assign-asset.jpg', caption: 'Assign Asset: pick the employee and company, choose the type (Hardware / Account / Software), optionally pick an Inventory item, then set name, identifier, workspace, access level and issue date.' },
      { src: 'assets-assign-asset-1.jpg', caption: 'For Hardware you can select an available Inventory item — its details auto-fill and the item flips to “Assigned”.' },
      { src: 'assets-assign-asset-2.jpg', caption: 'For Accounts, store the username, URL and password — the password is encrypted and only revealed briefly with permission.' },
    ],
    steps: [
      { title: 'Assign an asset', detail: 'Pick the employee, company and type; for hardware, select an Inventory item to auto-fill its details.' },
      { title: 'Store account credentials', detail: 'For accounts, enter username/password/URL — the password is stored encrypted and revealed only with permission.' },
      { title: 'Receipt & return', detail: 'Print or email a handover receipt; on return, click Return and set the condition.' },
    ],
    tips: ['Hardware assets pull from Inventory and flip that item to “Assigned”; returning frees it again.'],
    faq: [
      { q: 'How are passwords protected?', a: 'They are encrypted (AES-256) and only shown briefly when an authorized user reveals them.' },
      { q: 'How do I send the receipt on letterhead?', a: 'Use the send/print button; it composes the receipt onto the company letterhead if one is set.' },
      { q: 'What happens on return?', a: 'The asset is marked Returned and any linked Inventory item becomes Available again.' },
    ],
    related: ['inventory', 'asset-catalog', 'my-assets', 'send-documents'],
  },
  {
    id: 'inventory', route: '/inventory', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'Package',
    title: 'Inventory',
    overview: 'The registry of all physical equipment: asset code, serial, brand/model, purchase date & cost, warranty, condition and status. Each item has a printable QR/barcode label and a full movement history.',
    whenToUse: 'To record every device the company owns and track its lifecycle and assignment.',
    images: [
      { src: 'asset-inventory.jpg', caption: 'Inventory: filterable equipment list with condition and status; open an item for its QR/barcode and movement history.' },
      { src: 'asset-inventory-add-item.jpg', caption: 'Add item: platform/type, asset code, serial, brand/model, purchase date & cost, warranty and condition.' },
    ],
    steps: [
      { title: 'Add equipment', detail: 'Enter platform/type, asset code, serial, brand/model, purchase date & cost, warranty and condition.' },
      { title: 'Track status', detail: 'Available → Assigned (via Assets) → In Repair / Retired / Lost as needed.' },
      { title: 'Labels & history', detail: 'Print the QR/barcode label; open an item to see its full movement history.' },
    ],
    tips: ['Enter real purchase dates and costs for accurate depreciation in reports.'],
    faq: [
      { q: 'How does an item become “Assigned”?', a: 'When you assign it to an employee from the Assets page.' },
      { q: 'Can I print labels?', a: 'Yes — each item has a printable QR code and barcode.' },
    ],
    related: ['assets', 'asset-catalog'],
  },
  {
    id: 'performance', route: '/performance', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'TrendingUp',
    title: 'Performance',
    overview: 'Create quarterly performance targets per employee (target amount + KPI/objective notes), capture sign-off, and email the target to the employee.',
    whenToUse: 'To set and track quarterly goals and KPIs for staff.',
    diagram: { type: 'flow', steps: ['Create target', 'Share / email', 'Employee signs', 'Track quarter'] },
    images: [
      { src: 'performance.jpg', caption: 'Performance: quarterly targets per employee, filterable by quarter.' },
      { src: 'performance-add-target.jpg', caption: 'Add target: select the employee and quarter, set the target amount and KPI/objective notes.' },
    ],
    steps: [
      { title: 'Create a target', detail: 'Select employee and quarter, set the target amount and KPI/objective notes.' },
      { title: 'Sign & send', detail: 'Capture sign-off and email the target to the employee.' },
      { title: 'Filter by quarter', detail: 'Review targets per quarter and remove outdated ones.' },
    ],
    tips: ['Write specific, measurable KPI notes so reviews are objective.'],
    faq: [
      { q: 'Can I email the target?', a: 'Yes — use the email action on the target.' },
      { q: 'How are quarters chosen?', a: 'Filter and create targets by the quarter selector.' },
    ],
    related: ['kpi', 'employees'],
  },
  {
    id: 'offboarding', route: '/offboarding', group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'DoorOpen',
    title: 'Offboarding',
    overview: 'Run a structured exit process: initiate with the employee, last working day and departure type, then progress through stages with checklists, knowledge transfer, document collection and asset return — ending in the bilingual handover sheet.',
    whenToUse: 'When an employee is leaving, to ensure a clean, documented exit.',
    diagram: { type: 'flow', steps: ['Initiate', 'Knowledge transfer', 'Asset return', 'Clearance', 'Handover sheet'] },
    images: [
      { src: 'offboarding.jpg', caption: 'Offboarding: exit records with their stage and progress.' },
      { src: 'offboarding-initiate-offboarding.jpg', caption: 'Initiate offboarding: choose the departure type and last working day.' },
      { src: 'offboarding-initiate-offboarding-emp.jpg', caption: 'Select the departing employee to start the exit workflow.' },
      { src: 'offboarding-initiate-offboarding-emp-1.jpg', caption: 'Confirm the employee and exit details before creating the record.' },
    ],
    steps: [
      { title: 'Initiate', detail: 'Select the employee, last working day and departure type.' },
      { title: 'Work the stages', detail: 'Complete checklists, capture knowledge-transfer items and collect documents.' },
      { title: 'Handover sheet', detail: 'Generate the bilingual handover & receipt sheet for signatures.' },
    ],
    tips: ['Use the handover sheet to verify all assets are physically returned before final clearance.'],
    faq: [
      { q: 'Where is the end-of-service calculation?', a: 'Use Compliance → Payroll & Labor Law → Exit Settlement Calculator to compute EOSB.' },
      { q: 'What is the handover sheet?', a: 'A printable bilingual document listing knowledge-transfer tasks and assets to return, with signature blocks.' },
    ],
    related: ['handover-sheet', 'payroll', 'assets'],
  },
  {
    id: 'handover-sheet', route: null, group: 'lifecycle', roles: ['admin', 'hr_manager'], icon: 'FileText',
    title: 'Handover Sheet',
    overview: 'A printable, bilingual (Arabic/English) offboarding document listing knowledge-transfer tasks and the assets to return, with signature blocks for the employee, line manager and HR.',
    whenToUse: 'During offboarding, to produce the formal handover & receipt document for signing.',
    diagram: { type: 'flow', steps: ['Open from offboarding', 'Review tasks & assets', 'Print', 'Collect signatures'] },
    steps: [
      { title: 'Open it', detail: 'From an offboarding record, open the handover sheet.' },
      { title: 'Review & print', detail: 'It auto-lists knowledge-transfer items and the employee’s active assets; print it.' },
      { title: 'Sign', detail: 'Employee, line manager and HR sign; verify physical asset receipt.' },
    ],
    tips: ['The sheet is intentionally bilingual on one page so all parties can read and sign.'],
    faq: [
      { q: 'Why is it in both languages?', a: 'It is a formal signed document; showing Arabic and English together avoids ambiguity.' },
      { q: 'Where do the assets come from?', a: 'Active assets assigned to the employee are pulled in automatically.' },
    ],
    related: ['offboarding', 'assets'],
  },

  // ───────────────────────── Compliance ─────────────────────────
  {
    id: 'legal-letters', route: '/legal-letters', group: 'compliance', roles: ['admin', 'hr_manager'], icon: 'Scale',
    title: 'Legal Letters',
    overview: 'Generate official letters (Salary Certificate, Experience, NOC, Warning, Termination, Show Cause, etc.) with AI-assisted content for an employee, then preview, print or email them as a PDF — composed onto the issuing company’s letterhead when one is set.',
    whenToUse: 'Whenever an employee needs a formal letter from the company.',
    diagram: { type: 'flow', steps: ['Pick template', 'Choose company + employee', 'AI drafts content', 'Preview', 'Print / Email (PDF)'] },
    images: [
      { src: 'legal-letters.jpg', caption: 'Legal Letters: generated letters with preview, print and email actions; add your own templates too.' },
      { src: 'legal-letters-generate-letter.jpg', caption: 'Generate a letter: pick the letter type, the issuing company and the employee.' },
      { src: 'legal-letters-generate-letter-1.jpg', caption: 'Provide any template-specific fields; AI drafts the letter using the employee and company data.' },
    ],
    steps: [
      { title: 'Choose a template', detail: 'Click a letter type (or Generate) and select the issuing company and the employee.' },
      { title: 'Fill fields & generate', detail: 'Provide any template-specific fields; AI drafts the letter using employee + company data.' },
      { title: 'Print or email', detail: 'Open the letter and Print or “Send by Email (PDF)” — it is composed onto the selected company’s letterhead.' },
    ],
    tips: [
      'The letter is issued under the company you pick on the form — not necessarily the employee’s own company.',
      'Generate a fresh letter after uploading a letterhead so it composes correctly.',
    ],
    faq: [
      { q: 'It shows the wrong company name.', a: 'Pick the correct company in the generate form — the letter (and letterhead) follow your selection.' },
      { q: 'The letterhead overlaps the text.', a: 'Increase the top margin for that company in Settings → Companies → Letterhead.' },
      { q: 'Can I add my own letter type?', a: 'Yes — “Add Template” lets admins/HR create new letter templates (see System Config → Letter Templates).' },
    ],
    related: ['send-documents', 'companies', 'company-docs', 'system-config'],
  },
  {
    id: 'company-docs', route: '/company-docs', group: 'compliance', roles: ['admin', 'hr_manager'], icon: 'FileArchive',
    title: 'Company Documents',
    overview: 'A repository for official company documents organized by category (policies, safety, compliance, training…). Upload, search, filter and download files per company.',
    whenToUse: 'To store and share the company’s official documents and policies.',
    images: [
      { src: 'company-docs.jpg', caption: 'Company Documents: a category filter and search over the documents stored for the selected company.' },
      { src: 'company-docs-upload-document.jpg', caption: 'Upload a document and assign it to a category for the current company.' },
    ],
    steps: [
      { title: 'Create categories', detail: 'Organize documents into categories (e.g. Policy, Safety, Compliance).' },
      { title: 'Upload', detail: 'Upload a file and assign it to a category for the current company.' },
      { title: 'Find & download', detail: 'Search or filter by category, then download what you need.' },
    ],
    tips: ['Documents are scoped to the selected company (Entity).'],
    faq: [
      { q: 'Who can delete documents?', a: 'Deleting is admin-only; HR can upload and download.' },
      { q: 'Are files kept safely?', a: 'Yes — stored on persistent storage that survives redeploys.' },
    ],
    related: ['legal-letters', 'companies'],
  },
  {
    id: 'payroll', route: '/payroll', group: 'compliance', roles: ['admin', 'hr_manager'], icon: 'Calculator',
    title: 'Payroll & Labor Law',
    overview: 'UAE labor-law calculators and reference tables across five tabs: Exit Settlement Calculator (EOSB per Federal Decree-Law No. 33 of 2021), Work Permit & Visa Law, Absence & Lateness, Attendance Report, and the Exit Decision Matrix. This is distinct from the monthly Payroll Runs.',
    whenToUse: 'For settlements at exit and to understand UAE deduction and visa rules — separate from monthly salary processing.',
    diagram: { type: 'flow', steps: ['Pick a tab', 'Enter employee data', 'Calculate', 'Review result'] },
    images: [
      { src: 'payroll-labour-law-employee-exit-settlement-calculator.jpg', caption: 'Exit Settlement Calculator (UAE Federal Decree-Law No. 33 of 2021): wages, start/last-working dates, exit type, visa type, unused leave, unpaid days, notice and deductions → Calculate Final Settlement.' },
      { src: 'payroll-labour-law-work-permit-only-vs-full-employer-sponsored-visa.jpg', caption: 'Work Permit & Visa Law: a reference comparing a work-permit-only arrangement vs. a full employer-sponsored visa.' },
      { src: 'payroll-labour-law-work-permit-only-vs-absence-lateness.jpg', caption: 'Absence & Lateness: the rules used to derive deductions from absence and lateness.' },
      { src: 'payroll-labour-law-attendance-report.jpg', caption: 'Attendance Report: an attendance-based summary that supports payroll and labor-law decisions.' },
      { src: 'payroll-labour-law-exit-decision-matrix.jpg', caption: 'Exit Decision Matrix: a reference matrix for exit scenarios and their entitlements.' },
    ],
    steps: [
      { title: 'Open the right tab', detail: 'Choose Exit Settlement, Work Permit & Visa, Absence & Lateness, Attendance Report or Exit Decision Matrix.' },
      { title: 'Enter inputs', detail: 'For EOSB: basic/full wage, start & last working day, exit & visa type, unused leave, unpaid days, notice and deductions.' },
      { title: 'Calculate & use', detail: 'Compute the final settlement and apply the figures in offboarding or the final settlement.' },
    ],
    tips: ['This is a calculator/reference; the actual monthly salary processing happens in Payroll Runs.'],
    faq: [
      { q: 'Difference from Payroll Runs?', a: 'Payroll Runs computes monthly salaries; this page is for EOSB and UAE labor-law calculations and references.' },
      { q: 'Which law does EOSB follow?', a: 'UAE Federal Decree-Law No. 33 of 2021, by tenure, contract/exit type and visa type.' },
    ],
    related: ['payroll-runs', 'offboarding'],
  },

  // ───────────────────────── Analytics ─────────────────────────
  {
    id: 'reports', route: '/reports', group: 'analytics', roles: ['admin', 'hr_manager'], icon: 'BarChart3',
    title: 'Reports',
    overview: 'Built-in reports — recruitment pipeline, candidate journey, employees overview and onboarding progress. Print or download each as a PDF (composed onto the company letterhead) or email it with a cover message.',
    whenToUse: 'For periodic insight into recruitment and workforce, and to share snapshots.',
    images: [
      { src: 'reports.jpg', caption: 'Reports: switch between the available reports, then Print / Download (PDF on letterhead) or Send by Email.' },
    ],
    steps: [
      { title: 'Pick a report', detail: 'Switch tabs between the available reports.' },
      { title: 'Export', detail: 'Print/Download as PDF (composed onto the company letterhead) or email it.' },
    ],
    tips: ['Reports follow the selected Entity — switch company to compare.'],
    faq: [
      { q: 'Can I email a report?', a: 'Yes — “Send by Email (PDF)” attaches it with a cover message.' },
      { q: 'Why is a report empty?', a: 'No data exists for the selected company/period yet.' },
    ],
    related: ['dashboard', 'kpi', 'org-chart'],
  },
  {
    id: 'kpi', route: '/kpi', group: 'analytics', roles: ['admin', 'hr_manager'], icon: 'Trophy',
    title: 'KPI Tracker',
    overview: 'Log hiring events against reward tiers, confirm hires, and view summary stats (total hires, fulfilled tiers, rewards). Tiers (amount, icon, label) are configurable in System Config.',
    whenToUse: 'To track recruitment KPIs and tier-based rewards for hires.',
    diagram: { type: 'flow', steps: ['Create tiers', 'Log a hire', 'Assign tier', 'Confirm', 'Summary stats'] },
    images: [
      { src: 'kpi-tracker.jpg', caption: 'KPI Tracker: logged hires against reward tiers, with summary stats for hires, fulfilled tiers and rewards.' },
      { src: 'kpi-tracker-log-hire.jpg', caption: 'Log a hire: record the hire event and assign the reward tier(s).' },
    ],
    steps: [
      { title: 'Create tiers', detail: 'Define reward tiers with an amount, icon and label (System Config → KPI Tiers).' },
      { title: 'Log & confirm hires', detail: 'Record a hire event, assign tier(s), and confirm it.' },
      { title: 'Read the summary', detail: 'See totals: hires, fulfilled tiers and rewards.' },
    ],
    tips: ['Configure tiers first in System Config so hires can be assigned to them.'],
    faq: [
      { q: 'How do I add a tier?', a: 'Create a KPI tier with its amount/label in System Config → KPI Tiers; then assign it when logging a hire.' },
      { q: 'Can I delete a hire entry?', a: 'Yes — remove an entry from the list (admin).' },
    ],
    related: ['performance', 'reports', 'system-config'],
  },
  {
    id: 'audit', route: '/audit', group: 'analytics', roles: ['admin'], icon: 'ClipboardList',
    title: 'Audit Log',
    overview: 'A complete trail of system actions — who did what, in which module, when, with details. Search and filter by module, and export as JSON. Admin only.',
    whenToUse: 'For security, compliance and troubleshooting — to see exactly what changed and by whom.',
    images: [
      { src: 'audit-log.jpg', caption: 'Audit Log: searchable, module-filterable rows of every action (user, action, module, time, detail), with JSON export.' },
    ],
    steps: [
      { title: 'Search & filter', detail: 'Find entries by user, action or detail, and narrow by module.' },
      { title: 'Export', detail: 'Export the filtered log as JSON for records or analysis.' },
    ],
    tips: ['Entries are recorded automatically for create/update/delete and key actions.'],
    faq: [
      { q: 'Who can see the audit log?', a: 'Admins only.' },
      { q: 'Is it scoped per company?', a: 'It records actions across the data the admin can access; a selected Entity narrows it.' },
    ],
    related: ['users', 'email-log'],
  },
  {
    id: 'email-log', route: '/email-log', group: 'analytics', roles: ['admin', 'hr_manager'], icon: 'Mail',
    title: 'Email Log',
    overview: 'A record of every outgoing email with its delivery status (Sent / Failed / Queued), recipient, subject, related module and timestamp. Open any entry for the full content that was sent.',
    whenToUse: 'To confirm an email was sent and to troubleshoot delivery problems.',
    images: [
      { src: 'email-log.jpg', caption: 'Email Log: outgoing emails with status, recipient, subject and module; filter by status and module or search.' },
      { src: 'email-log-1.jpg', caption: 'Open an entry to read the full email content and metadata.' },
    ],
    steps: [
      { title: 'Search & filter', detail: 'Filter by status (Sent/Failed/Queued) and related module, or search by recipient/subject.' },
      { title: 'Open a detail', detail: 'View the full email content and metadata.' },
    ],
    tips: ['If many emails show Failed, check the SMTP configuration in Settings → Email.'],
    faq: [
      { q: 'An email failed — what now?', a: 'Open it to see the error; verify SMTP settings and resend from the source action.' },
      { q: 'Does it store the email body?', a: 'Yes — the detail view shows the full content that was sent.' },
    ],
    related: ['email-settings', 'send-documents'],
  },
  {
    id: 'org-chart', route: '/org-chart', group: 'analytics', roles: ['admin', 'hr_manager'], icon: 'Network',
    title: 'Org Chart',
    overview: 'An interactive chart of the selected company’s departments and job titles. Pan and zoom, and click a department to see its job titles and headcounts.',
    whenToUse: 'To visualize and review the organizational structure of a company.',
    images: [
      { src: 'organization-chart.jpg', caption: 'The Organization Chart: a pan-and-zoom canvas of departments and job titles, built from Settings → Departments & Titles.' },
    ],
    steps: [
      { title: 'Select a company', detail: 'Pick the entity whose structure you want to view.' },
      { title: 'Explore', detail: 'Pan/zoom the canvas and click nodes to inspect departments and titles.' },
    ],
    tips: ['Structure comes from Departments & Titles in Settings — keep those up to date.'],
    faq: [
      { q: 'The chart is empty.', a: 'Add departments and job titles for the company in Settings → Departments & Titles.' },
      { q: 'Can I edit the chart here?', a: 'No — it visualizes data managed in Settings.' },
    ],
    related: ['departments', 'employees'],
  },

  // ───────────────────────── Operations & Settings ─────────────────────────
  {
    id: 'users', route: '/users', group: 'operations', roles: ['admin'], icon: 'UserCog',
    title: 'User Management',
    overview: 'Create and manage system users, assign roles (admin, hr_manager, recruiter, employee), set their company/department, and reset passwords. Admin only.',
    whenToUse: 'To give staff access and control what each person can do.',
    images: [
      { src: 'user-management.jpg', caption: 'User Management: users with their name, role and company; edit role/company/department or reset a password.' },
      { src: 'user-management-add-user.jpg', caption: 'Add user: username, name, email, password and role; assign a company/department where relevant.' },
    ],
    steps: [
      { title: 'Add a user', detail: 'Set username, name, email, password and role; assign a company/department if relevant.' },
      { title: 'Edit or reset', detail: 'Change a user’s role or details, or reset their password.' },
      { title: 'Mind the roles', detail: 'Pick the least role needed — see the Roles & permissions article.' },
    ],
    tips: ['Only admins manage users; this keeps the no-delete / company-view rules enforceable for HR.'],
    faq: [
      { q: 'Why is this page admin-only?', a: 'Managing users/roles could escalate privileges, so it is restricted to admins.' },
      { q: 'How do I reset a password?', a: 'Open the user and use Reset password.' },
      { q: 'Can I change a user’s company?', a: 'Yes — edit the user; internal HR roles are organization-wide regardless.' },
    ],
    related: ['roles', 'audit'],
  },
  {
    id: 'companies', route: '/settings/companies', group: 'operations', roles: ['admin', 'hr_manager'], icon: 'Building2',
    title: 'Companies',
    overview: 'Manage the companies (entities) in the organization: name, short code, currency, brand colors, logo, and the A4 letterhead used on generated PDFs. Admins add/edit/delete; HR views only.',
    whenToUse: 'To set up each company and its branding/letterhead before issuing documents.',
    images: [
      { src: 'settings-companies.jpg', caption: 'Settings → Companies: company cards with code, currency and logo. Admins manage them; HR sees them read-only.' },
      { src: 'settings-companies-add-company.jpg', caption: 'Add company (admin): name, short code, currency, industry, contact, logo and brand colors.' },
      { src: 'settings-companies-edit-company.jpg', caption: 'Edit company: details, brand colors, and upload the A4 letterhead with content margins (mm) used on generated PDFs.' },
    ],
    steps: [
      { title: 'Create a company', detail: 'Admin: add name, short code, currency, industry, contact, logo and brand colors.' },
      { title: 'Upload a letterhead', detail: 'In the company edit form, upload an A4 letterhead (PDF/PNG/JPG) and set content margins (mm).' },
      { title: 'Tune margins', detail: 'Adjust top/bottom/left/right so document text sits clear of the header/footer.' },
    ],
    tips: [
      'Letterhead and company create/edit/delete are admin-only; HR sees companies read-only.',
      'After uploading a letterhead, generate a document to preview and fine-tune the margins.',
    ],
    faq: [
      { q: 'Why can’t HR add a company?', a: 'By design — company create/edit/delete is admin-only; HR has view access.' },
      { q: 'Where is the letterhead used?', a: 'On generated legal letters, offers, receipts and reports when you send/print them as PDF.' },
      { q: 'The letterhead overlaps text.', a: 'Increase the top margin for that company and re-preview.' },
    ],
    related: ['send-documents', 'legal-letters', 'roles'],
  },
  {
    id: 'departments', route: '/settings/departments', group: 'operations', roles: ['admin', 'hr_manager'], icon: 'Network',
    title: 'Departments & Titles',
    overview: 'Manage each company’s departments and the job titles within them — including seniorities with salary bands and required skills.',
    whenToUse: 'To define the org structure used across employees, vacancies and the org chart.',
    images: [
      { src: 'settings-departments.jpg', caption: 'Settings → Departments & Titles: departments per company; expand one to manage its job titles.' },
      { src: 'settings-departments-create-department.jpg', caption: 'Create a department for the selected company.' },
      { src: 'settings-departments-create-job-title.jpg', caption: 'Create a job title under a department, with seniorities, salary bands and required skills.' },
      { src: 'settings-departments-edit-job-title.jpg', caption: 'Edit a job title’s seniorities, salary bands and skills.' },
    ],
    steps: [
      { title: 'Pick the company', detail: 'Departments are per company.' },
      { title: 'Add departments', detail: 'Create departments, then expand to manage their job titles.' },
      { title: 'Define titles', detail: 'Add job titles with seniorities, salary bands and required skills.' },
    ],
    tips: ['This structure feeds the Org Chart and employee/vacancy assignment.'],
    faq: [
      { q: 'Who can delete a department?', a: 'Admins; HR can add/edit.' },
      { q: 'Where do job titles appear?', a: 'When assigning roles to employees and on the org chart.' },
    ],
    related: ['org-chart', 'skills', 'employees'],
  },
  {
    id: 'skills', route: '/settings/skills', group: 'operations', roles: ['admin', 'hr_manager'], icon: 'Wrench',
    title: 'Skills Library',
    overview: 'Maintain skill categories and individual skills used for evaluating candidates and employees, and for CV scoring and job-title definitions.',
    whenToUse: 'To curate the skills referenced in CV scoring, job titles and evaluations.',
    images: [
      { src: 'settings-skills.jpg', caption: 'Settings → Skills Library: expandable skill categories, each holding individual skills used across the system.' },
    ],
    steps: [
      { title: 'Create categories', detail: 'Group skills under categories.' },
      { title: 'Add skills', detail: 'Add individual skills under each category.' },
    ],
    tips: ['Well-organized skills improve CV scoring and job-title definitions.'],
    faq: [
      { q: 'Where are skills used?', a: 'In CV Scorer profiles, job titles and candidate evaluations.' },
      { q: 'Who can delete skills?', a: 'Admins; HR can add/edit.' },
    ],
    related: ['cv-scorer', 'departments'],
  },
  {
    id: 'asset-catalog', route: '/settings/catalog', group: 'operations', roles: ['admin', 'hr_manager'], icon: 'Box',
    title: 'Asset Catalog',
    overview: 'Define the TYPES of assets before adding actual items: categories and platforms classified as Hardware, Account or Software. The catalog drives Inventory and Assets.',
    whenToUse: 'First-time setup of asset/equipment types, before entering inventory.',
    diagram: { type: 'flow', steps: ['Create categories', 'Add platforms/types', 'Used in Inventory & Assets'] },
    images: [
      { src: 'settings-asset-catalog.jpg', caption: 'Settings → Asset Catalog: categories and the platforms/types within them, classified as Hardware, Account or Software.' },
      { src: 'settings-create-category.jpg', caption: 'Create a category (e.g. Laptops, Phones, Software Accounts) with an icon and color.' },
      { src: 'settings-create-platform.jpg', caption: 'Add a platform/type under a category, classified as Hardware / Account / Software, with allowed companies.' },
    ],
    steps: [
      { title: 'Create categories', detail: 'Add categories (e.g. Laptops, Phones, Software Accounts) with an icon and color.' },
      { title: 'Add platforms/types', detail: 'Under each category add platforms classified as Hardware / Account / Software, with allowed companies.' },
    ],
    tips: ['Set up the catalog first — Inventory items and assigned Assets reference these types.'],
    faq: [
      { q: 'Difference between catalog and inventory?', a: 'Catalog = the “types”; Inventory = the actual physical items of those types.' },
      { q: 'Who can delete catalog entries?', a: 'Admins; HR can add/edit.' },
    ],
    related: ['inventory', 'assets'],
  },
  {
    id: 'system-config', route: '/settings/system', group: 'operations', roles: ['admin'], icon: 'Settings',
    title: 'System Config',
    overview: 'Admin configuration across five tabs: ATS Stages (the recruitment pipeline order), Onboarding Templates, Offboarding Templates, Letter Templates, and KPI Tiers. Changes here shape the ATS board, the onboarding/offboarding flows, the letters you can generate, and KPI rewards. Admin only.',
    whenToUse: 'To tailor the system’s workflows and templates to your processes.',
    images: [
      { src: 'settings-system-config-ats-stages.jpg', caption: 'ATS Stages: define, color and reorder the recruitment pipeline stages (drag to reorder; mark Default / Success / Fail).' },
      { src: 'settings-system-config-ats-stages-add-stage.jpg', caption: 'Add an ATS stage with its name, color and outcome type.' },
      { src: 'settings-system-config-onboarding-templates.jpg', caption: 'Onboarding Templates: the stages/steps used by the stage-based onboarding workflow.' },
      { src: 'settings-system-config-offboarding-templates.jpg', caption: 'Offboarding Templates: the checklist steps used by the exit workflow.' },
      { src: 'settings-system-config-letter-templates.jpg', caption: 'Letter Templates: the letter types available in Legal Letters; add or edit your own.' },
      { src: 'settings-system-config-kpi-tiers.jpg', caption: 'KPI Tiers: the reward tiers (amount, icon, label) used by the KPI Tracker.' },
    ],
    steps: [
      { title: 'Configure ATS stages', detail: 'Reorder/define the recruitment pipeline stages used on the ATS board.' },
      { title: 'Set workflow templates', detail: 'Configure onboarding/offboarding stages & templates and letter templates.' },
      { title: 'Manage KPI tiers', detail: 'Define the reward tiers used by the KPI Tracker.' },
    ],
    tips: ['Changes here affect the ATS board, onboarding/offboarding flows, letters and KPI tracking across the app.'],
    faq: [
      { q: 'Why admin-only?', a: 'It changes core workflow structure, so it is restricted to admins.' },
      { q: 'Will reordering ATS stages affect existing candidates?', a: 'Candidates keep their stage; the board simply reflects the new order.' },
    ],
    related: ['ats', 'kpi', 'templates'],
  },
  {
    id: 'email-settings', route: '/settings/email', group: 'operations', roles: ['admin'], icon: 'Mail',
    title: 'Email Settings (SMTP)',
    overview: 'Configure the outgoing email server (SMTP host, port, credentials, sender identity), test the connection, and enable/disable sending. Admin only.',
    whenToUse: 'Once during setup so the system can send offers, letters, notifications and documents.',
    images: [
      { src: 'settings-email-configuration.jpg', caption: 'Settings → Email: SMTP host & port, username & password, sender identity, a Test Connection button, and the enable-sending switch.' },
    ],
    steps: [
      { title: 'Enter SMTP details', detail: 'Host, port, username, password and the From/Reply-To identity.' },
      { title: 'Test the connection', detail: 'Re-enter the password and click Test Connection to verify before saving.' },
      { title: 'Save & enable', detail: 'Save the configuration and keep “Enable Email Sending” on.' },
    ],
    tips: [
      'Port 465 = implicit TLS; port 587 = STARTTLS — the system selects the right mode by port automatically.',
      'Re-type the SMTP password to test/verify; it is stored encrypted.',
    ],
    faq: [
      { q: '“Missing credentials” error?', a: 'Re-enter the SMTP password in the field and save; it must be supplied to authenticate.' },
      { q: '“Wrong version number” error?', a: 'A port/TLS mismatch — the system derives TLS from the port; use 465 (TLS) or 587 (STARTTLS).' },
      { q: 'Why is the Email tab hidden for me?', a: 'Email & System Config are admin-only.' },
    ],
    related: ['email-log', 'send-documents', 'templates'],
  },
  {
    id: 'templates', route: '/settings/templates', group: 'operations', roles: ['admin', 'hr_manager'], icon: 'FileText',
    title: 'Email Templates',
    overview: 'Preview and manage the email templates the system uses (candidate received, leave approved, onboarding stage, offer letter, document delivery, etc.) and the variables each supports.',
    whenToUse: 'To review or adjust the wording of automated and manual emails.',
    images: [
      { src: 'settings-email-template-manager.jpg', caption: 'Settings → Templates: the email templates used across recruitment, onboarding, leave and assets — preview each one.' },
      { src: 'settings-email-template-manager-template-key.jpg', caption: 'Each template has a key and a set of variables it supports; preview how it renders with sample data.' },
    ],
    steps: [
      { title: 'Browse templates', detail: 'See all templates used across recruitment, onboarding, leave, assets, etc.' },
      { title: 'Preview', detail: 'Preview how a template renders with sample data and its variables.' },
    ],
    tips: ['Use the 📧 buttons across the app to send messages built from these templates.'],
    faq: [
      { q: 'Where are these templates sent from?', a: 'Various modules trigger them automatically, and you can send some manually via the email buttons.' },
      { q: 'Can I change variables?', a: 'You can manage template content and the variables it supports.' },
    ],
    related: ['email-settings', 'email-log', 'system-config'],
  },

  // ───────────────────────── Employee portal ─────────────────────────
  {
    id: 'my-assets', route: '/portal/my-assets', group: 'portal', roles: ['employee', 'admin', 'hr_manager'], icon: 'Shield',
    title: 'My Assets & Accounts',
    overview: 'Your personal self-service view: the hardware assigned to you and the software/account credentials issued to you. Reveal a password briefly (it auto-hides) and copy your credentials.',
    whenToUse: 'To check what equipment and accounts you have, and to retrieve your login details.',
    images: [
      { src: 'my-assets-accounts.jpg', caption: 'My Assets & Accounts: the devices assigned to you and your account credentials — reveal a password briefly or copy username/password.' },
    ],
    steps: [
      { title: 'View your devices', detail: 'See the hardware assigned to you with its serial/code.' },
      { title: 'Get account credentials', detail: 'For accounts, reveal the password (it hides automatically) or copy username/password.' },
    ],
    tips: ['Passwords are revealed only briefly for security; copy them rather than leaving them on screen.'],
    faq: [
      { q: 'I see “No assets assigned”.', a: 'Nothing has been assigned to you yet — contact HR.' },
      { q: 'Why does the password hide itself?', a: 'For security, revealed passwords auto-hide after a few seconds.' },
      { q: 'Can I edit my assets here?', a: 'No — this is a read-only personal view; HR manages assignments.' },
    ],
    related: ['assets'],
  },
];

export default articles;
