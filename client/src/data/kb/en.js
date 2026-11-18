// English knowledge-base content. Mirror every `id` in ar.js.
// Generated from the bilingual KB spec; article shape: { id, route, group, roles, icon, title, overview,
//   whenToUse, link?:{href,label}, diagram?:{type:"flow",steps}, images:[{src,caption}] (files in /public/kb),
//   steps:[{title,detail}], tips:[], faq:[{q,a}], related:[] }

const articles = [
  {
    "id": "whats-new",
    "route": null,
    "group": "start",
    "roles": null,
    "icon": "Sparkles",
    "title": "What’s new in v2.5",
    "overview": "Version 2.5 adds 27 features across payroll, attendance, leave, approvals, talent, employee services and administration. This article lists them with a link to each one’s guide. The illustrated updates guide (Arabic and English, with a screenshot of every new screen) opens from the button below.",
    "whenToUse": "When you want to see what changed recently, or share the changes with your team.",
    "link": {
      "href": "/kb/guide/index.html",
      "label": "Open the illustrated updates guide"
    },
    "images": [
      {
        "src": "payroll-off-cycle.jpg",
        "caption": "A new screen: the off-cycle payroll run."
      },
      {
        "src": "settings-payroll-exports.jpg",
        "caption": "A new settings page: the bank file (SIF) and Zoho Books journal."
      }
    ],
    "steps": [
      {
        "title": "Payroll",
        "detail": "Runs go through review and approval; off-cycle runs; the WPS bank file (SIF) for Wio; the Zoho Books journal; GPSSA pension for UAE nationals; loans and one-time items; overtime; final settlement."
      },
      {
        "title": "Attendance and leave",
        "detail": "A live board for today; a monthly shift roster; portal clock-in (off by default); study and Hajj leave, leave by the hour, balance adjustments, carry forward and a team calendar."
      },
      {
        "title": "Teams and approvals",
        "detail": "A direct manager for everyone, the org chart, My Team, approval chains per request type, My Approvals, and portal requests (letters, expenses, advances, cases)."
      },
      {
        "title": "Talent",
        "detail": "Appraisal cycles, hiring requests from managers, training and certificates with expiry alerts, and skills."
      },
      {
        "title": "Employee services",
        "detail": "Announcements and policies with acknowledgement, the disciplinary file, benefits (medical insurance and air tickets) and the employee change log."
      },
      {
        "title": "Oversight and administration",
        "detail": "Needs your attention on the dashboard, the compliance centre with Emiratisation, the document radar, editable role permissions, scheduled reports and the nightly backup."
      }
    ],
    "tips": [
      "Names, salaries and personal details in the screenshots are blurred on purpose.",
      "Every new page also has its own article in this help centre; use the search box."
    ],
    "faq": [
      {
        "q": "Is there something to set up before using the new features?",
        "a": "Yes, once: bank routing codes and the employer ID (Settings → Bank file and accounting), Zoho account names, a direct manager for every employee, approval chains, the GPSSA setting for each UAE national, and the insurance policies."
      },
      {
        "q": "Can I send the guide to the team?",
        "a": "Yes. The guide opens as its own page; copy its address from the browser and share it with colleagues who have an account."
      }
    ],
    "related": [
      "payroll-runs",
      "attendance-board",
      "approval-chains",
      "compliance-centre",
      "roles"
    ]
  },
  {
    "id": "dashboard",
    "route": "/dashboard",
    "group": "start",
    "roles": null,
    "icon": "LayoutDashboard",
    "title": "Dashboard",
    "overview": "The starting page for the selected company. At the top, Needs your attention lists what is late or at risk (overdue settlements, unapproved payroll, leave waiting over 3 days, expired documents, the Emiratisation gap), most urgent first. Below it: headline counters, the AI status banner, the recruitment pipeline, a 6-month hiring trend and recent activity.",
    "whenToUse": "At the start of every day, to see what needs action and how the company stands.",
    "images": [
      {
        "src": "dashboard.jpg",
        "caption": "The dashboard: Needs your attention at the top, then the counters, the AI banner, the pipeline and the hiring trend."
      }
    ],
    "steps": [
      {
        "title": "Check the company",
        "detail": "The Entity switcher at the top of the sidebar decides which company the figures belong to."
      },
      {
        "title": "Work through Needs your attention",
        "detail": "Each line shows a count, a severity tag and an arrow; click the arrow to open the page where you fix it."
      },
      {
        "title": "Read the counters",
        "detail": "Total candidates, open vacancies, active employees and this month’s hires."
      },
      {
        "title": "Scan the pipeline and trend",
        "detail": "Where candidates sit by stage, and hires over the last 6 months."
      },
      {
        "title": "Check recent activity",
        "detail": "The latest actions in the system, who did them and when."
      }
    ],
    "tips": [
      "Needs your attention is also the first tab of the Compliance centre.",
      "If a number looks wrong, check the Entity first."
    ],
    "faq": [
      {
        "q": "Why is Needs your attention empty?",
        "a": "Nothing is late or at risk for the company you can see. That is the goal."
      },
      {
        "q": "Do employees see the dashboard?",
        "a": "No. Employees open straight into their own portal; the dashboard is a company overview."
      }
    ],
    "related": [
      "compliance-centre",
      "entity",
      "reports"
    ]
  },
  {
    "id": "roles",
    "route": "/settings/roles",
    "group": "start",
    "roles": null,
    "icon": "ShieldCheck",
    "title": "Roles & permissions",
    "overview": "Every user has one of six roles. The role decides which parts of the system they can open and what they may change; the Entity decides which company’s data they see. Since v2.5 an admin can change which parts (modules) each role opens, from Settings → Roles and permissions.",
    "whenToUse": "When giving someone access, or to understand why a page or button is missing for you.",
    "images": [
      {
        "src": "settings-roles.jpg",
        "caption": "Settings → Roles and permissions: tick the modules each role can open; the admin row is fixed."
      }
    ],
    "steps": [
      {
        "title": "admin",
        "detail": "Everything, including users, settings, deletes, company records and role permissions."
      },
      {
        "title": "hr_manager",
        "detail": "All HR, payroll and settings work across companies; cannot delete or manage users."
      },
      {
        "title": "hr_specialist",
        "detail": "Day-to-day HR: employees, attendance, leave, documents, onboarding and offboarding checklists. No payroll, recruitment or settings."
      },
      {
        "title": "accountant",
        "detail": "Payroll and WPS, assets, subscriptions, domains and company documents. No recruitment or reports."
      },
      {
        "title": "recruiter",
        "detail": "Recruitment only: candidates, vacancies, the ATS board, applicants and the CV scorer."
      },
      {
        "title": "employee",
        "detail": "The self-service portal only: their own attendance, salary, leave, requests, assets, benefits and policies."
      }
    ],
    "tips": [
      "To narrow or widen a role, open Settings → Roles and permissions, tick the modules and click Save on that row. Restore the default undoes it.",
      "A change applies at the user’s next sign-in or page reload.",
      "Opening a module is not the same as changing it: approving, deleting and editing pay stay fixed per action."
    ],
    "faq": [
      {
        "q": "Why can HR not delete records?",
        "a": "Deleting is kept for admins on purpose, so mistakes can always be traced and undone."
      },
      {
        "q": "Can I create a new role?",
        "a": "No. There are six roles; you change what each one opens."
      },
      {
        "q": "Can the admin role be restricted?",
        "a": "No. It always has everything, so nobody can lock the system out of its own settings."
      }
    ],
    "related": [
      "users",
      "entity"
    ]
  },
  {
    "id": "login",
    "route": "/login",
    "group": "start",
    "roles": null,
    "icon": "Lock",
    "title": "Signing in",
    "overview": "The login screen authenticates you into the IST HR System management portal. After you sign in you land on the Dashboard, scoped to the company (Entity) you last worked on.",
    "whenToUse": "Every time you open the system or after your session expires and you are logged out.",
    "steps": [
      {
        "title": "Enter your username",
        "detail": "Use the username an administrator created for you (not your email unless that is your username)."
      },
      {
        "title": "Enter your password",
        "detail": "Click the eye icon to reveal what you typed if you want to verify it."
      },
      {
        "title": "Click Sign In",
        "detail": "On success you are redirected to the Dashboard; on failure the system tells you the credentials are invalid."
      }
    ],
    "tips": [
      "Switch the interface language (العربية / English) any time from the globe icon in the top bar — the whole layout flips to RTL for Arabic.",
      "Sessions last 24 hours; after that you simply sign in again."
    ],
    "faq": [
      {
        "q": "I forgot my password — what do I do?",
        "a": "Ask an administrator to reset it from Operations → Users → open your user → Reset password. There is no self-service reset."
      },
      {
        "q": "Why am I sent back to the login page?",
        "a": "Your session token expired (tokens last 24h) or you signed out — just sign in again."
      },
      {
        "q": "Can I use the system in Arabic?",
        "a": "Yes. Use the language toggle (العربية) in the top bar; the entire interface, including layout direction (RTL), switches instantly."
      }
    ],
    "related": [
      "dashboard",
      "roles",
      "users"
    ]
  },
  {
    "id": "entity",
    "route": null,
    "group": "start",
    "roles": null,
    "icon": "Building2",
    "title": "Switching companies (Entity)",
    "overview": "The system manages ONE organization that owns several companies. The Entity switcher at the top of the sidebar selects which company you are working on; everything you view or create belongs to it. The role you hold decides your permissions — the Entity decides which company’s data you see.",
    "whenToUse": "Before entering or reviewing any data — always confirm the correct company is selected.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Open the Entity dropdown",
        "Pick a company",
        "All pages scope to it",
        "Create/view data under it"
      ]
    },
    "images": [
      {
        "src": "company-switcher.jpg",
        "caption": "The Entity switcher sits at the top of the sidebar, just under your name. Internal staff can switch between every company in the organization."
      }
    ],
    "steps": [
      {
        "title": "Find the Entity dropdown",
        "detail": "It sits just under your name at the top of the sidebar."
      },
      {
        "title": "Select a company",
        "detail": "There is no “All companies” option — a specific company must always be selected."
      },
      {
        "title": "Work normally",
        "detail": "Employees, assets, leave, letters, payroll, reports, etc. are all saved under and filtered by the chosen company."
      }
    ],
    "tips": [
      "Internal staff (admin, HR manager, recruiter) can see every company and switch freely; an employee only ever sees their own.",
      "A wrong Entity is the usual reason data “does not appear” — switch and recheck before assuming something is missing."
    ],
    "faq": [
      {
        "q": "Why can’t I pick “All companies”?",
        "a": "By design — every record must belong to a specific company, so you always choose one."
      },
      {
        "q": "I added data but a colleague can’t see it.",
        "a": "They are probably viewing a different Entity. Ask them to switch to the same company."
      },
      {
        "q": "Who can see all companies?",
        "a": "admin, hr_manager and recruiter roles are organization-wide; an employee is pinned to their own company."
      }
    ],
    "related": [
      "roles",
      "dashboard",
      "companies"
    ]
  },
  {
    "id": "send-documents",
    "route": null,
    "group": "start",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Send",
    "title": "Sending documents by email (PDF + letterhead)",
    "overview": "Across the app you can email a document as a PDF with a bilingual cover message — “as per your request, please find attached …”. When the issuing company has an uploaded letterhead, the content is composed onto it; otherwise a clean branded layout is used. Every send is recorded in the Email Log.",
    "whenToUse": "To send a legal letter, employment offer, asset handover receipt or report to an employee, manager or HR.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Open the document",
        "Send by Email (PDF)",
        "Recipient + cover note",
        "Composed onto letterhead",
        "Sent + logged"
      ]
    },
    "images": [
      {
        "src": "sending-documents-by-email.jpg",
        "caption": "The Send-by-email dialog: recipient, optional CC (manager/HR), and a cover message. The document is rendered to PDF in your browser (so Arabic and RTL come out exactly as shown) and attached."
      }
    ],
    "steps": [
      {
        "title": "Open the document",
        "detail": "On a letter, offer, receipt or report, click “Send by Email (PDF)” (or use Print/Download to preview first)."
      },
      {
        "title": "Fill recipient + note",
        "detail": "Enter the email, an optional CC (manager/HR), and an optional cover message."
      },
      {
        "title": "Send",
        "detail": "The PDF is generated in your browser, composed onto the company letterhead, attached, and emailed — then recorded in the Email Log."
      }
    ],
    "tips": [
      "Upload each company’s letterhead in Settings → Companies (admin) and tune the top margin so text sits below the printed header.",
      "Use “Download PDF” first to preview the exact output before sending."
    ],
    "faq": [
      {
        "q": "Email isn’t sending — why?",
        "a": "SMTP must be configured and verified in Settings → Email (admin), and email sending must be enabled."
      },
      {
        "q": "The letterhead overlaps the text.",
        "a": "Increase the top margin for that company in Settings → Companies → Letterhead."
      },
      {
        "q": "Does it work in Arabic?",
        "a": "Yes — the PDF is rendered from the on-screen content, so Arabic and RTL come out exactly as shown."
      }
    ],
    "related": [
      "legal-letters",
      "companies",
      "email-settings",
      "email-log"
    ]
  },
  {
    "id": "ats",
    "route": "/ats",
    "group": "recruitment",
    "roles": [
      "admin",
      "hr_manager",
      "recruiter"
    ],
    "icon": "Kanban",
    "title": "ATS Pipeline",
    "overview": "A Kanban board of candidates grouped by recruitment stage. Each column is a configurable stage (New Applicants → Shortlisted → … → Offer Made → Success). Drag a card between columns to move a candidate forward instantly.",
    "whenToUse": "To see, at a glance, where every candidate stands in the hiring process and to advance them.",
    "diagram": {
      "type": "flow",
      "steps": [
        "New Applicants",
        "Shortlisted",
        "Contacted",
        "Interview",
        "Offer Made",
        "Success"
      ]
    },
    "images": [
      {
        "src": "ats.jpg",
        "caption": "The ATS Pipeline Kanban board. Columns are the recruitment stages; drag a candidate card from one column to the next to update their stage."
      }
    ],
    "steps": [
      {
        "title": "Filter by vacancy",
        "detail": "Optionally narrow the board to a single open position."
      },
      {
        "title": "Drag to move stage",
        "detail": "Drag a candidate card to another column to update their stage immediately."
      },
      {
        "title": "Refresh",
        "detail": "Reload to pull in changes made by colleagues."
      }
    ],
    "tips": [
      "Stage names, colors and order are configurable in Settings → System Config → ATS Stages."
    ],
    "faq": [
      {
        "q": "How do I add a candidate to the board?",
        "a": "Add them in the Candidates page; they appear here automatically at the default stage."
      },
      {
        "q": "Moving a card failed.",
        "a": "You may lack permission or the network dropped — refresh and try again."
      }
    ],
    "related": [
      "candidates",
      "vacancies",
      "applicants",
      "system-config"
    ]
  },
  {
    "id": "candidates",
    "route": "/candidates",
    "group": "recruitment",
    "roles": [
      "admin",
      "hr_manager",
      "recruiter"
    ],
    "icon": "Users",
    "title": "Candidates",
    "overview": "The central list of candidates with search, status filter and pagination. Add or edit candidates, upload and AI-parse their CV, and open a full profile with experience, salary history, a timeline, notes and an AI summary.",
    "whenToUse": "To register applicants, review their details, and move them through the hiring pipeline.",
    "images": [
      {
        "src": "candidates.jpg",
        "caption": "The Candidates list with search, status filter (Active / Hired / Failed / Blacklisted) and pagination. Click a row to open the full candidate profile."
      },
      {
        "src": "add-candidate.jpg",
        "caption": "Add Candidate: enter name, contact and target vacancy manually, or upload a CV to auto-fill the fields with AI."
      }
    ],
    "steps": [
      {
        "title": "Add a candidate",
        "detail": "Click Add Candidate and fill name, contact and vacancy; or upload a CV to auto-fill via AI."
      },
      {
        "title": "Read the CV data",
        "detail": "In the profile, “Read CV data” parses the uploaded CV into experience, skills, languages and more."
      },
      {
        "title": "Manage status & stage",
        "detail": "Update status, add notes, and move the candidate through the pipeline."
      }
    ],
    "tips": [
      "Salary and experience shown come from the real parsed CV — nothing is fabricated.",
      "Re-run “Read CV data” after uploading a new CV to refresh the extracted fields."
    ],
    "faq": [
      {
        "q": "The CV didn’t parse.",
        "a": "Ensure it’s a PDF/DOC/DOCX with selectable text; scanned images can’t be read. Then click “Read CV data”."
      },
      {
        "q": "Why is experience/salary empty?",
        "a": "The CV didn’t contain it — the system only shows what it actually found."
      },
      {
        "q": "How do I delete a candidate?",
        "a": "Only admins can delete; HR can edit and change status."
      }
    ],
    "related": [
      "ats",
      "cv-scorer",
      "vacancies",
      "applicants"
    ]
  },
  {
    "id": "vacancies",
    "route": "/vacancies",
    "group": "recruitment",
    "roles": [
      "admin",
      "hr_manager",
      "recruiter"
    ],
    "icon": "FileText",
    "title": "Vacancies",
    "overview": "Create and manage open positions, then publish them to a public, branded Careers page and share the link in campaigns. Applications submitted there land under Applicants.",
    "whenToUse": "When you open a role and want to receive applications, internally or publicly.",
    "images": [
      {
        "src": "vacancies.jpg",
        "caption": "The Vacancies list with search and status filter; each row shows the title, status and headcount, with publish and copy-link actions."
      },
      {
        "src": "create-vacancy.jpg",
        "caption": "Create Vacancy: title, department, location, employment type, salary, description and requirements."
      }
    ],
    "steps": [
      {
        "title": "Create a vacancy",
        "detail": "Add title, department, location, employment type, salary, description and requirements."
      },
      {
        "title": "Publish",
        "detail": "Publish to generate a public Careers page, then copy its link to share externally."
      },
      {
        "title": "Track applicants",
        "detail": "Applications from the public page appear under Applicants with the source captured."
      }
    ],
    "tips": [
      "Use a clear, public-friendly title and description — it appears on the careers page candidates see."
    ],
    "faq": [
      {
        "q": "Where is the public link?",
        "a": "Publish the vacancy, then use “Copy public link”; it opens the Careers page for that role."
      },
      {
        "q": "Can I close a vacancy?",
        "a": "Yes — set its status; closed roles stop accepting public applications."
      }
    ],
    "related": [
      "careers",
      "applicants",
      "ats",
      "cv-scorer"
    ]
  },
  {
    "id": "applicants",
    "route": "/applicants",
    "group": "recruitment",
    "roles": [
      "admin",
      "hr_manager",
      "recruiter"
    ],
    "icon": "Inbox",
    "title": "Applicants",
    "overview": "Candidates who applied through your public Careers pages. Review each application and CV, star-rate for triage, schedule interviews, record structured evaluations, move stages, and convert a hire into an onboarding record.",
    "whenToUse": "To process inbound applications from public job postings end-to-end.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Application received",
        "Review + rate",
        "Interview",
        "Evaluate",
        "Convert to onboarding"
      ]
    },
    "images": [
      {
        "src": "applicants.jpg",
        "caption": "The Applicants inbox: filter by vacancy/stage or search, star-rate for quick triage, and open an application to review the CV, schedule interviews and add evaluations."
      }
    ],
    "steps": [
      {
        "title": "Filter & open",
        "detail": "Filter by vacancy/stage or search, then open an application to see details and the CV."
      },
      {
        "title": "Interview & evaluate",
        "detail": "Schedule interviews (this can send an invite) and add structured evaluations."
      },
      {
        "title": "Advance or convert",
        "detail": "Move the stage, reject with a reason, or convert an accepted candidate into an onboarding record."
      }
    ],
    "tips": [
      "Star-rate applicants for quick triage; the rating shows on the list."
    ],
    "faq": [
      {
        "q": "No applicants are showing.",
        "a": "Publish a vacancy and share its public link to start receiving applications."
      },
      {
        "q": "What does “Convert to onboarding” do?",
        "a": "It creates a linked onboarding record so the hire flows straight into the joining process."
      },
      {
        "q": "Can I download the CV?",
        "a": "Yes — use the CV button on the row or in the detail view."
      }
    ],
    "related": [
      "vacancies",
      "careers",
      "onboarding",
      "candidates"
    ]
  },
  {
    "id": "cv-scorer",
    "route": "/cv-scorer",
    "group": "recruitment",
    "roles": [
      "admin",
      "hr_manager",
      "recruiter"
    ],
    "icon": "Target",
    "title": "CV Scorer",
    "overview": "Create a vacancy profile (must-have / nice-to-have skills, seniority, minimum experience) and let AI score candidates against it, then generate tailored interview questions or draft a full job description.",
    "whenToUse": "To objectively compare candidates to a role’s requirements and speed up screening.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Create profile",
        "Score candidates (AI)",
        "Review fit + summary",
        "Generate questions / JD"
      ]
    },
    "images": [
      {
        "src": "cv-scorer.jpg",
        "caption": "CV Scorer: profiles list and AI-generated scores with a fit level and summary per candidate."
      },
      {
        "src": "cv-scorer-create-profile.jpg",
        "caption": "Create a scoring profile: job title, seniority, minimum experience, and must-have / nice-to-have skills."
      }
    ],
    "steps": [
      {
        "title": "Create a profile",
        "detail": "Define job title, seniority, minimum experience, and must-have / nice-to-have skills."
      },
      {
        "title": "Score candidates",
        "detail": "Run AI scoring to rank candidates with a fit level and a short rationale."
      },
      {
        "title": "Generate aids",
        "detail": "Produce tailored interview questions or a job description from the profile."
      }
    ],
    "tips": [
      "Specific must-have skill lists produce sharper scores — be precise."
    ],
    "faq": [
      {
        "q": "Scoring failed.",
        "a": "The AI service may be unavailable, or a candidate has no parsed CV; ensure CVs are uploaded and try again."
      },
      {
        "q": "Are scores final decisions?",
        "a": "No — they are a screening aid; combine them with interviews and evaluations."
      }
    ],
    "related": [
      "candidates",
      "vacancies",
      "ats",
      "skills"
    ]
  },
  {
    "id": "requisitions",
    "route": "/requisitions",
    "group": "recruitment",
    "roles": [
      "admin",
      "hr_manager",
      "recruiter",
      "hr_specialist"
    ],
    "icon": "ClipboardList",
    "title": "Hiring requests",
    "overview": "Managers and HR ask for a new position here: job title, department, headcount, expected salary and the reason. The request goes through the approval chain for hiring requests (if one is set up), then to HR. Final approval creates a draft vacancy that recruitment completes and publishes.",
    "whenToUse": "When a team needs a new person or a replacement.",
    "images": [
      {
        "src": "requisitions.jpg",
        "caption": "Hiring requests with their status; Request a hire opens the form."
      }
    ],
    "steps": [
      {
        "title": "Click Request a hire",
        "detail": "Fill in the title, department, headcount, expected salary range and the reason (new role or replacement)."
      },
      {
        "title": "Follow the status",
        "detail": "Pending while it is in the approval chain, then Approved or Rejected with the reason."
      },
      {
        "title": "After approval",
        "detail": "A draft vacancy is created. Open Vacancies, complete the description and publish it."
      }
    ],
    "tips": [
      "Set the chain in Settings → Approval chains → Hiring request, for example direct manager then finance.",
      "Managers also see their requests under My Team."
    ],
    "faq": [
      {
        "q": "Who can approve?",
        "a": "Whoever the approval chain names, then HR."
      },
      {
        "q": "Is the vacancy published automatically?",
        "a": "No. It is created as a draft so recruitment can finish it first."
      }
    ],
    "related": [
      "vacancies",
      "approval-chains",
      "portal-team"
    ]
  },
  {
    "id": "careers",
    "route": null,
    "group": "recruitment",
    "roles": [
      "admin",
      "hr_manager",
      "recruiter"
    ],
    "icon": "Globe",
    "title": "Public Careers page",
    "overview": "The branded, public application page for a published vacancy. Candidates review the role, accept a privacy/data-protection consent, fill a form and upload a CV. It is fully bilingual and shows the company logo and brand colors automatically.",
    "whenToUse": "Share its link in job ads and campaigns to collect applications directly into Applicants.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Review role",
        "Privacy consent",
        "Fill form + CV",
        "Submitted → Applicants"
      ]
    },
    "steps": [
      {
        "title": "Publish the vacancy",
        "detail": "From Vacancies, publish the role and copy the public link."
      },
      {
        "title": "Share with UTM (optional)",
        "detail": "Append UTM parameters to the link to track which campaign produced each application."
      },
      {
        "title": "Receive applications",
        "detail": "Submissions arrive under Applicants with the source captured."
      }
    ],
    "tips": [
      "The page picks up the company logo and brand colors automatically; it is fully bilingual."
    ],
    "faq": [
      {
        "q": "Applicants say the page is unavailable.",
        "a": "The vacancy must be published and open; check its status and deadline."
      },
      {
        "q": "Is consent required?",
        "a": "Yes — applicants must accept the privacy/data-protection terms before submitting."
      }
    ],
    "related": [
      "vacancies",
      "applicants"
    ]
  },
  {
    "id": "employees",
    "route": "/employees",
    "group": "lifecycle",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist",
      "accountant"
    ],
    "icon": "Users",
    "title": "Employee Directory",
    "overview": "The directory of active staff. Add employees through a guided 5-step wizard — the “Employee Onboarding Hub” (Docs & AI → Personal → Placement → Assets → Access) — with optional CV/passport auto-fill, then open any employee to view their profile and upload/download official documents.",
    "whenToUse": "To register current and historical employees, maintain their records, and store their official documents.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Docs & AI",
        "Personal",
        "Placement & Compensation",
        "Assets",
        "System Access"
      ]
    },
    "images": [
      {
        "src": "employees.jpg",
        "caption": "The Employees Hub: current staff, people leaving, or everyone; open a row for the full profile."
      },
      {
        "src": "employee-profile.jpg",
        "caption": "The employee profile: header with company, manager and contact; identity documents; then tabs grouped General, Pay, Time & leave, Records."
      },
      {
        "src": "employee-onboarding-hub-docs-ai.jpg",
        "caption": "Step 1 — Docs & AI: upload a CV or passport and let AI extract the candidate’s details to pre-fill the wizard."
      },
      {
        "src": "employee-onboarding-hub-personal-details.jpg",
        "caption": "Step 2 — Personal: first/last name, email, phone and nationality (auto-filled from the document when available)."
      },
      {
        "src": "employee-onboarding-hub-placement-compensation.jpg",
        "caption": "Step 3 — Placement & Compensation: company, department, job title, basic & full salary, and the REAL original start date."
      },
      {
        "src": "employee-onboarding-hub-allocate-company-assets.jpg",
        "caption": "Step 4 — Assets: optionally allocate company equipment/accounts to the new employee right from the wizard."
      },
      {
        "src": "employee-onboarding-hub-system-access.jpg",
        "caption": "Step 5 — System Access: optionally create a login so the employee can reach their self-service portal."
      }
    ],
    "steps": [
      {
        "title": "Start the wizard",
        "detail": "Click Add Employee. On step 1 (Docs & AI) you can upload a CV/passport to auto-fill name, email, phone and nationality."
      },
      {
        "title": "Enter placement & pay",
        "detail": "Company, department, job title, basic & full salary, and the REAL original start date (vital for seniority and end-of-service)."
      },
      {
        "title": "Allocate assets (optional)",
        "detail": "Assign equipment or accounts to the employee during onboarding."
      },
      {
        "title": "Create access (optional)",
        "detail": "Create a login so the employee reaches their portal; pick the right role."
      },
      {
        "title": "Upload documents",
        "detail": "Open the profile → Documents tab → upload contracts, ID, visa and certificates by category."
      },
      {
        "title": "Use the profile tabs",
        "detail": "Overview (alerts and key figures), Profile details, Documents, Notes; Payslips, Salary breakdown, Salary reviews, Bank, Benefits; Attendance sheet, Work schedule, Leave, Requests; Performance, Training & skills, Assets, History, Change log."
      },
      {
        "title": "Set the direct manager and GPSSA",
        "detail": "Profile details → Edit: choose the direct manager (used by My Team and approvals) and the GPSSA pension scheme for UAE nationals."
      }
    ],
    "tips": [
      "For migration of existing staff, enter each employee’s real joining date and salary before going live — never use today’s date.",
      "Uploaded documents are stored on persistent storage and survive redeploys."
    ],
    "faq": [
      {
        "q": "How do I add old employees in bulk?",
        "a": "Add them one by one via the wizard, department by department, with correct start dates and Active status."
      },
      {
        "q": "Where do uploaded documents go?",
        "a": "They are kept securely per employee and persist across deployments."
      },
      {
        "q": "Why enter the original start date?",
        "a": "Seniority and end-of-service (EOSB) calculations depend on it — never use today’s date for existing staff."
      }
    ],
    "related": [
      "onboarding",
      "assets",
      "leave",
      "payroll-runs"
    ]
  },
  {
    "id": "onboarding",
    "route": "/onboarding",
    "group": "lifecycle",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "UserCheck",
    "title": "Onboarding",
    "overview": "A gated, stage-based hiring workflow that takes a new hire from CV to a fully onboarded employee: CV → HR review → offer → signed offer → documents → visa → bank → completed. Each stage unlocks only when its requirements are met; completion automatically adds the person to the Employee Directory.",
    "whenToUse": "For every new hire, to run a consistent joining process with documents, offer, visa and bank steps.",
    "diagram": {
      "type": "flow",
      "steps": [
        "CV",
        "HR review",
        "Offer",
        "Signed offer",
        "Documents",
        "Visa",
        "Bank",
        "Completed"
      ]
    },
    "images": [
      {
        "src": "onboarding.jpg",
        "caption": "The Onboarding list: a stage-based hiring workflow. Use “Add New Employee” to start a record, or it is created automatically when you convert an applicant."
      },
      {
        "src": "employee-onboarding-onboarding-candidate.jpg",
        "caption": "A new onboarding record at the CV stage — upload the candidate CV so AI can extract the profile."
      },
      {
        "src": "employee-onboarding-under-hr-review.jpg",
        "caption": "HR review: verify the extracted profile, then approve to proceed to the offer stage."
      },
      {
        "src": "employee-onboarding-employment-offers.jpg",
        "caption": "Employment offer: create the offer with role, salary and terms."
      },
      {
        "src": "employee-onboarding-offer-email-preview.jpg",
        "caption": "Preview the offer email before sending it to the candidate."
      },
      {
        "src": "employee-onboarding-signed-offer.jpg",
        "caption": "Signed offer: upload the candidate’s signed copy and verify it to unlock the next stage."
      },
      {
        "src": "employee-onboarding-required-documents.jpg",
        "caption": "Required Documents: a checklist of documents to collect (passport, photo, certificates …)."
      },
      {
        "src": "employee-onboarding-required-documents-verified.jpg",
        "caption": "Documents marked Verified — the stage requirement is satisfied."
      },
      {
        "src": "employee-onboarding-visa-residency-steps.jpg",
        "caption": "Visa / Residency steps: track each immigration step to completion."
      },
      {
        "src": "employee-onboarding-bank-details-for-salary-transfer.jpg",
        "caption": "Bank details for salary transfer, captured before completion."
      },
      {
        "src": "employee-onboarding-send-document-by-email.jpg",
        "caption": "Send any onboarding document (e.g. the offer) by email as a PDF, composed onto the company letterhead."
      },
      {
        "src": "employee-onboarding-onboarding-completed.jpg",
        "caption": "All stages complete — advancing finalizes the record and adds the person to the Employee Directory as Active."
      }
    ],
    "steps": [
      {
        "title": "Start & upload CV",
        "detail": "Add a new onboarding and upload the candidate CV; AI extracts the profile."
      },
      {
        "title": "Review & approve",
        "detail": "HR verifies the profile, then approves to proceed to the offer."
      },
      {
        "title": "Offer → signed offer",
        "detail": "Create and send the employment offer; upload the signed copy and verify it."
      },
      {
        "title": "Documents → visa → bank",
        "detail": "Collect required documents, track visa/residency steps, and record bank details."
      },
      {
        "title": "Advance to complete",
        "detail": "When all stages are satisfied, advancing finalizes the record and adds the employee to the Directory."
      }
    ],
    "tips": [
      "The “Advance stage” button stays disabled until the current stage’s requirements are satisfied — the panel lists what is pending.",
      "Applicants you convert to onboarding land here automatically."
    ],
    "faq": [
      {
        "q": "Why can’t I advance the stage?",
        "a": "Required items are missing — the panel lists what’s pending (e.g. an unverified profile or missing documents)."
      },
      {
        "q": "What happens at completion?",
        "a": "The candidate becomes an Active employee in the Employee Directory, linked to this record."
      },
      {
        "q": "Can I send the offer as a PDF on letterhead?",
        "a": "Yes — preview the offer, then “Send as PDF”; it composes onto the company letterhead if one is set."
      }
    ],
    "related": [
      "applicants",
      "employees",
      "send-documents",
      "system-config"
    ]
  },
  {
    "id": "quick-offer",
    "route": "/quick-offer",
    "group": "lifecycle",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "Send",
    "title": "Quick Offer",
    "overview": "Generate and send an employment offer letter without opening an onboarding record. Fill the form on the left; the letter on the right updates as you type, on the chosen company’s letterhead.",
    "whenToUse": "When you need an offer letter quickly, before or without the full onboarding workflow.",
    "images": [
      {
        "src": "quick-offer.jpg",
        "caption": "Quick Offer: the form on the left and the live letter on the right."
      }
    ],
    "steps": [
      {
        "title": "Choose the company",
        "detail": "The letter uses that company’s name and letterhead."
      },
      {
        "title": "Use a preset (optional)",
        "detail": "Presets such as Tele Sales Executive or Real Estate Agent fill the job title, salary structure and terms."
      },
      {
        "title": "Fill the details",
        "detail": "Candidate name and email, job title, department, location, employment type, manager, joining date, basic salary, commission, probation, working hours, leave, benefits, visa, insurance, notice period and offer expiry."
      },
      {
        "title": "Send or Download",
        "detail": "Email the offer as a PDF to the candidate or download it. Reset clears the form."
      }
    ],
    "tips": [
      "For a hire you will onboard, start from Onboarding instead so the offer is kept with the record.",
      "Check the letterhead margins in Settings → Companies if the text overlaps the header."
    ],
    "faq": [
      {
        "q": "Is the offer saved anywhere?",
        "a": "Sent offers appear in the Email Log; the form itself is not stored."
      },
      {
        "q": "Can I write in Arabic?",
        "a": "Yes; the PDF is rendered from the page so Arabic comes out as shown."
      }
    ],
    "related": [
      "onboarding",
      "email-log",
      "companies"
    ]
  },
  {
    "id": "document-radar",
    "route": "/document-radar",
    "group": "lifecycle",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "Radar",
    "title": "Document radar",
    "overview": "Employee passports, residence visas, Emirates IDs and labour cards by expiry date, and who has a required document missing. Alerts go out 90, 60, 30, 15 and 7 days before expiry. A UAE national is not asked for a residence visa.",
    "whenToUse": "Weekly, to renew documents before they lapse and to complete missing records.",
    "images": [
      {
        "src": "document-radar.jpg",
        "caption": "The radar: counters, filters, documents by expiry date, and missing documents per employee."
      }
    ],
    "steps": [
      {
        "title": "Read the counters",
        "detail": "Expired, expiring within 30 days, within 90 days, and employees missing a document."
      },
      {
        "title": "Filter",
        "detail": "Needs attention (≤ 90 days), Expired, ≤ 30 days, ≤ 90 days or All; by document type; or by name."
      },
      {
        "title": "Complete missing documents",
        "detail": "Click Add documents on a row to open that person’s Documents tab."
      },
      {
        "title": "Record each document fully",
        "detail": "Type, number, issue and expiry dates; without an expiry date the radar cannot track it."
      }
    ],
    "tips": [
      "Expired documents also appear in Needs your attention on the dashboard.",
      "Labour cards matter for the WPS file: an expired card holds up salary transfers."
    ],
    "faq": [
      {
        "q": "Who gets the alerts?",
        "a": "HR, by in-app notification, once per threshold."
      },
      {
        "q": "Why is a national listed without a visa?",
        "a": "They are not; nationals are excluded from the residence-visa check."
      }
    ],
    "related": [
      "employees",
      "compliance-centre"
    ]
  },
  {
    "id": "offboarding",
    "route": "/offboarding",
    "group": "lifecycle",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist",
      "accountant"
    ],
    "icon": "DoorOpen",
    "title": "Offboarding",
    "overview": "Run a structured exit process: initiate with the employee, last working day and departure type, then progress through stages with checklists, knowledge transfer, document collection and asset return — ending in the bilingual handover sheet.",
    "whenToUse": "When an employee is leaving, to ensure a clean, documented exit.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Initiate",
        "Knowledge transfer",
        "Asset return",
        "Clearance",
        "Handover sheet"
      ]
    },
    "images": [
      {
        "src": "offboarding.jpg",
        "caption": "Offboarding: exit records with their stage and progress."
      },
      {
        "src": "offboarding-initiate-offboarding.jpg",
        "caption": "Initiate offboarding: choose the departure type and last working day."
      },
      {
        "src": "offboarding-initiate-offboarding-emp.jpg",
        "caption": "Select the departing employee to start the exit workflow."
      },
      {
        "src": "offboarding-initiate-offboarding-emp-1.jpg",
        "caption": "Confirm the employee and exit details before creating the record."
      }
    ],
    "steps": [
      {
        "title": "Initiate",
        "detail": "Select the employee, last working day and departure type."
      },
      {
        "title": "Work the stages",
        "detail": "Complete checklists, capture knowledge-transfer items and collect documents."
      },
      {
        "title": "Handover sheet",
        "detail": "Generate the bilingual handover & receipt sheet for signatures."
      },
      {
        "title": "Calculate the final settlement",
        "detail": "In the record’s settlement section click Calculate: final salary, leave balance, gratuity and remaining loans and advances in one figure. Approve it, then mark it paid. It is due 14 days after the last working day; late ones appear in Needs your attention."
      }
    ],
    "tips": [
      "Use the handover sheet to verify all assets are physically returned before final clearance."
    ],
    "faq": [
      {
        "q": "Where is the end-of-service calculation?",
        "a": "Use Compliance → Payroll & Labor Law → Exit Settlement Calculator to compute EOSB."
      },
      {
        "q": "What is the handover sheet?",
        "a": "A printable bilingual document listing knowledge-transfer tasks and assets to return, with signature blocks."
      }
    ],
    "related": [
      "handover-sheet",
      "payroll",
      "assets"
    ]
  },
  {
    "id": "org-chart",
    "route": "/org-chart",
    "group": "lifecycle",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist",
      "accountant"
    ],
    "icon": "Network",
    "title": "Org Chart",
    "overview": "An interactive chart of the selected company’s departments and job titles. Pan and zoom, and click a department to see its job titles and headcounts.",
    "whenToUse": "To visualize and review the organizational structure of a company.",
    "images": [
      {
        "src": "org-chart.jpg",
        "caption": "The Organization Chart: a pan-and-zoom canvas of departments and job titles, built from Settings → Departments & Titles."
      }
    ],
    "steps": [
      {
        "title": "Select a company",
        "detail": "Pick the entity whose structure you want to view."
      },
      {
        "title": "Explore",
        "detail": "Pan/zoom the canvas and click nodes to inspect departments and titles."
      },
      {
        "title": "Set managers on the profile",
        "detail": "The chart is built from each employee’s direct manager (Profile details → Edit). People without a manager appear at the top level. Switch between By people and By department."
      }
    ],
    "tips": [
      "Structure comes from Departments & Titles in Settings — keep those up to date."
    ],
    "faq": [
      {
        "q": "The chart is empty.",
        "a": "Add departments and job titles for the company in Settings → Departments & Titles."
      },
      {
        "q": "Can I edit the chart here?",
        "a": "No — it visualizes data managed in Settings."
      }
    ],
    "related": [
      "departments",
      "employees"
    ]
  },
  {
    "id": "handover-sheet",
    "route": null,
    "group": "lifecycle",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "FileText",
    "title": "Handover Sheet",
    "overview": "A printable, bilingual (Arabic/English) offboarding document listing knowledge-transfer tasks and the assets to return, with signature blocks for the employee, line manager and HR.",
    "whenToUse": "During offboarding, to produce the formal handover & receipt document for signing.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Open from offboarding",
        "Review tasks & assets",
        "Print",
        "Collect signatures"
      ]
    },
    "steps": [
      {
        "title": "Open it",
        "detail": "From an offboarding record, open the handover sheet."
      },
      {
        "title": "Review & print",
        "detail": "It auto-lists knowledge-transfer items and the employee’s active assets; print it."
      },
      {
        "title": "Sign",
        "detail": "Employee, line manager and HR sign; verify physical asset receipt."
      }
    ],
    "tips": [
      "The sheet is intentionally bilingual on one page so all parties can read and sign."
    ],
    "faq": [
      {
        "q": "Why is it in both languages?",
        "a": "It is a formal signed document; showing Arabic and English together avoids ambiguity."
      },
      {
        "q": "Where do the assets come from?",
        "a": "Active assets assigned to the employee are pulled in automatically."
      }
    ],
    "related": [
      "offboarding",
      "assets"
    ]
  },
  {
    "id": "leave",
    "route": "/leave",
    "group": "time",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "CalendarDays",
    "title": "Leave",
    "overview": "Leave requests, the team calendar, balances, leave types and a report, in five tabs. Leave types can count calendar days or working days only; study leave and Hajj leave are included; employees can take part of a day by the hour. Balances can be adjusted with a reason, imported from a CSV, carried forward or paid out at year end.",
    "whenToUse": "To approve requests, plan cover, and keep balances correct before payroll.",
    "images": [
      {
        "src": "leave.jpg",
        "caption": "Requests: approve, reject or cancel. Names and reasons are blurred here."
      },
      {
        "src": "leave-calendar.jpg",
        "caption": "Calendar: who is off on each day of the month."
      },
      {
        "src": "leave-balances.jpg",
        "caption": "Balances: entitlements, adjustments, CSV import, year end and encashment."
      },
      {
        "src": "leave-management-new-leave-request.jpg",
        "caption": "New leave request: pick the leave type and dates; HR can also file on behalf of an employee."
      }
    ],
    "steps": [
      {
        "title": "Requests tab",
        "detail": "Filter by status. Approve or Reject; the approver sees who else in the team is off on the same days and any visa expiry."
      },
      {
        "title": "Calendar tab",
        "detail": "The month at a glance: who is on leave each day."
      },
      {
        "title": "Balances tab",
        "detail": "Set entitlement, Adjust balance (a reason is required), Import opening balances from a CSV, Encash days with salary, and Year end to carry forward or lapse days per type."
      },
      {
        "title": "Types tab",
        "detail": "Each type sets paid or unpaid, calendar or working days, yearly cap and carry-forward rule."
      },
      {
        "title": "Report tab",
        "detail": "Leave taken by person and type for a period."
      },
      {
        "title": "New Request",
        "detail": "HR can file leave for someone; employees use My Leave in the portal, with the days previewed before sending."
      }
    ],
    "tips": [
      "Approved unpaid leave is deducted in the payroll run of that month; finish approvals before generating payroll.",
      "If an approval chain is set for leave, the request reaches HR only after the chain.",
      "Carry forward stays off until the rule (maximum days and expiry) is set on the leave type."
    ],
    "faq": [
      {
        "q": "Can an employee take two hours off?",
        "a": "Yes, from the portal: a part day by the hour, counted against the balance in fractions of a day."
      },
      {
        "q": "Why are weekend days not counted?",
        "a": "That leave type counts working days only, from the employee’s schedule."
      },
      {
        "q": "How do I correct a balance?",
        "a": "Balances → Adjust balance, with the number of days and a reason; every adjustment is kept in the ledger."
      }
    ],
    "related": [
      "portal-leave",
      "approval-chains",
      "payroll-runs"
    ]
  },
  {
    "id": "attendance",
    "route": "/attendance",
    "group": "time",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "Clock",
    "title": "Attendance",
    "overview": "Attendance read from the office door (Hik Central): the first punch of the day is the check-in and the last punch is the check-out. It updates every few minutes, and a monthly summary shows totals by status (Present, Late, Absent, On Leave, etc.). HR can correct records and filter by employee, date range and status. Absence days flow into payroll deductions.",
    "whenToUse": "To record working time and review monthly attendance per employee.",
    "images": [
      {
        "src": "attendance.jpg",
        "caption": "Attendance: a month picker with summary badges by status, filters (employee, date range, status), and a records table with hours."
      },
      {
        "src": "attendance-record-attendance.jpg",
        "caption": "Record attendance: HR adds a record for an employee with date, times and status."
      },
      {
        "src": "attendance-record-attendance-1.jpg",
        "caption": "The status (e.g. Late) is derived automatically from the check-in time against working hours."
      }
    ],
    "steps": [
      {
        "title": "Walk through the door",
        "detail": "Employees are recorded by the office door reader — there is nothing to press in the system. Late is worked out from the first punch against the employee’s work schedule."
      },
      {
        "title": "Review the month",
        "detail": "Pick a month to see totals by status and total hours."
      },
      {
        "title": "Add / correct records (HR)",
        "detail": "HR can add or edit a record. A corrected day is marked Manual and the door feed never overwrites it."
      },
      {
        "title": "Days close at 05:00",
        "detail": "Each morning the previous day is closed: a working day with no punches becomes Absent, or On Leave if approved leave covers it. Holidays and rest days are never absences."
      },
      {
        "title": "Use the newer views",
        "detail": "The Live board shows today minute by minute, the Roster shows the month and plans shifts, and Attendance checks lists days the schedule engine disagrees with."
      }
    ],
    "tips": [
      "Absence days flow into payroll deductions, so keep attendance accurate before generating a run.",
      "Today’s check-out is only the last punch so far — early departure is judged once the day is over.",
      "If someone’s punches never appear, check the Attendance ID on their employee record matches their number in Hik Central."
    ],
    "faq": [
      {
        "q": "How is “Late” determined?",
        "a": "From the first door punch against the start time and grace period of the employee’s work schedule (or the company default)."
      },
      {
        "q": "Why is there no Check in button?",
        "a": "Once the door feed is connected the door is the record, so self check-in is switched off."
      },
      {
        "q": "Can HR fix a wrong record?",
        "a": "Yes — add or edit a record with the correct times and status."
      }
    ],
    "related": [
      "leave",
      "payroll-runs",
      "employees",
      "attendance-board",
      "attendance-roster",
      "attendance-sync",
      "attendance-checks"
    ]
  },
  {
    "id": "attendance-sync",
    "route": "/attendance/sync",
    "group": "time",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Fingerprint",
    "title": "Hik Central sync",
    "overview": "Door punches are read from Hik Central every 5 minutes. The first punch of the day is the check-in and the last is the check-out. Finished days are closed at 05:00: a working day with no punch becomes Absent, or On Leave when approved leave covers it.",
    "whenToUse": "To check the door feed is working, re-read a period, or fix people whose punches do not appear.",
    "images": [
      {
        "src": "attendance-sync.jpg",
        "caption": "Hik Central sync: test the connection, sync now, close days, load an earlier period and recent runs."
      }
    ],
    "steps": [
      {
        "title": "Test connection",
        "detail": "Confirms the system can read Hik Central."
      },
      {
        "title": "Sync now",
        "detail": "Reads the latest punches immediately instead of waiting for the next 5-minute pass."
      },
      {
        "title": "Close finished days",
        "detail": "Closes days that are over, marking absences and approved leave."
      },
      {
        "title": "Load an earlier period",
        "detail": "Re-reads a date range. Sync and overwrite corrections replaces manual edits too; use it carefully."
      },
      {
        "title": "Ignored person IDs",
        "detail": "Door IDs that belong to no employee (visitors, cleaners). Stop ignoring brings one back."
      }
    ],
    "tips": [
      "If someone’s punches never appear, compare the Attendance ID on their profile with their number in Hik Central.",
      "Recent runs shows each pass with punches read, new, updated and absent rows."
    ],
    "faq": [
      {
        "q": "A corrected day changed back. Why?",
        "a": "Only Sync and overwrite corrections does that; normal passes never overwrite a manual correction."
      },
      {
        "q": "Night shifts after midnight?",
        "a": "Not paired yet: the door gives the first and last punch of the calendar day."
      }
    ],
    "related": [
      "attendance",
      "attendance-board",
      "attendance-checks"
    ]
  },
  {
    "id": "attendance-board",
    "route": "/attendance/board",
    "group": "time",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "Activity",
    "title": "Live board",
    "overview": "Who is in, late, not in yet, expected later, on leave, absent or resting today, refreshed every minute from the office door. Each row shows the person, their state, today’s hours from their shift, first in and last seen.",
    "whenToUse": "During the day, to see who is in and who has not arrived.",
    "images": [
      {
        "src": "attendance-board.jpg",
        "caption": "The live board: counters by state, search, and one row per person."
      }
    ],
    "steps": [
      {
        "title": "Read the counters",
        "detail": "Not in yet, Late, In, Expected later, On leave, Absent, Rest day / holiday, No schedule."
      },
      {
        "title": "Filter",
        "detail": "Click a counter to show only that state; click it again to clear."
      },
      {
        "title": "Search",
        "detail": "By name or department."
      },
      {
        "title": "Check today’s hours",
        "detail": "The shift that applies today, including any shift set on the roster for this date."
      }
    ],
    "tips": [
      "No schedule means the person has no work schedule; set one in Settings → Work Schedules or on the roster."
    ],
    "faq": [
      {
        "q": "Why is someone Not in yet after they arrived?",
        "a": "Their door punch has not been read yet (every 5 minutes), or their Attendance ID does not match Hik Central."
      }
    ],
    "related": [
      "attendance-roster",
      "attendance-sync",
      "attendance"
    ]
  },
  {
    "id": "attendance-roster",
    "route": "/attendance/roster",
    "group": "time",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "CalendarRange",
    "title": "Roster",
    "overview": "The whole month per person and day. The Attendance view shows what happened; the Shifts view plans a shift or a day off for a specific date, overriding the weekly schedule.",
    "whenToUse": "To review a month at a glance, and to plan rotating shifts and days off.",
    "images": [
      {
        "src": "attendance-roster.jpg",
        "caption": "The roster in Attendance view: P present, L late, A absent, V leave, ? no record."
      }
    ],
    "steps": [
      {
        "title": "Pick the month",
        "detail": "Use the arrows next to the month name."
      },
      {
        "title": "Read the Attendance view",
        "detail": "P present, L late, H half day, A absent, V leave (faded: pending), PH public holiday, ? no record on a working day, dot: rest day."
      },
      {
        "title": "Switch to Shifts",
        "detail": "Faded cells are the weekly schedule; solid cells are a shift or day off set for that date; a moon marks a shift ending the next day."
      },
      {
        "title": "Paint shifts",
        "detail": "Pick a shift or day off, click a day or drag across several, then Save changes. Past days are re-checked against the new shift."
      }
    ],
    "tips": [
      "A shift set here wins over the weekly schedule for that date only."
    ],
    "faq": [
      {
        "q": "Does changing a past day change lateness?",
        "a": "Yes; saved changes re-check those days against the new shift."
      }
    ],
    "related": [
      "attendance-board",
      "work-schedules",
      "attendance"
    ]
  },
  {
    "id": "attendance-checks",
    "route": "/attendance/exceptions",
    "group": "time",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "ScanEye",
    "title": "Attendance checks",
    "overview": "What the schedule engine makes of each day, compared with what is recorded. It lists cases (for example a recorded absence on a rest day), per-employee totals, disagreements between the engine and the record, and the check runs.",
    "whenToUse": "Before payroll, to catch days that would deduct pay wrongly.",
    "images": [
      {
        "src": "attendance-exceptions.jpg",
        "caption": "Attendance checks: cases, per employee, disagreements and runs."
      }
    ],
    "steps": [
      {
        "title": "Run the checks",
        "detail": "Re-evaluates the period against the schedules. Clear and re-check starts over."
      },
      {
        "title": "Review Cases",
        "detail": "Each case explains what looks wrong; tick Open cases only to hide resolved ones."
      },
      {
        "title": "Per employee",
        "detail": "Totals of cases and absences per person."
      },
      {
        "title": "Record reason",
        "detail": "Explain a case you accept, so it does not come back."
      }
    ],
    "tips": [
      "Run the checks before generating payroll; absences flow into deductions."
    ],
    "faq": [
      {
        "q": "What is a disagreement?",
        "a": "A day where the engine’s verdict (present, absent, rest) differs from the stored attendance status."
      }
    ],
    "related": [
      "attendance",
      "payroll-runs"
    ]
  },
  {
    "id": "overtime",
    "route": "/overtime",
    "group": "time",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist",
      "accountant"
    ],
    "icon": "Timer",
    "title": "Overtime",
    "overview": "Overtime is detected from attendance or entered by hand, approved, then paid with salaries at the legal rates: 125% for normal hours and 150% for night hours and rest days, on basic pay / 30 / 8 per hour.",
    "whenToUse": "Each month before payroll.",
    "images": [
      {
        "src": "overtime.jpg",
        "caption": "Overtime: detect from attendance, review each day, approve or reject."
      }
    ],
    "steps": [
      {
        "title": "Pick the month",
        "detail": "Overtime is handled per month."
      },
      {
        "title": "Detect from attendance",
        "detail": "Finds days where people worked beyond their schedule."
      },
      {
        "title": "Review each day",
        "detail": "Approve the minutes that are due, reject the rest, or add a day by hand."
      },
      {
        "title": "Generate payroll",
        "detail": "Approved overtime becomes an Overtime line on the payslip of that month."
      }
    ],
    "tips": [
      "If an approval chain is set for overtime, the manager approves first.",
      "Rates can be adjusted by an admin if your policy differs."
    ],
    "faq": [
      {
        "q": "How is the hourly rate worked out?",
        "a": "Basic salary / 30 / 8, multiplied by the rate for the type of hour."
      },
      {
        "q": "Can I change approved overtime after payroll?",
        "a": "Once the run is approved it is final; correct it in the next month."
      }
    ],
    "related": [
      "payroll-runs",
      "attendance",
      "approval-chains"
    ]
  },
  {
    "id": "clock-in",
    "route": "/settings/clock-in",
    "group": "time",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "MapPinned",
    "title": "Portal clock-in",
    "overview": "Lets employees clock in and out from the portal, for people the office door does not see (field work, remote days). It is off by default. Every punch is stored with its location, accuracy, site and distance, and a door punch is never overwritten.",
    "whenToUse": "When some staff work away from the office and need their attendance recorded.",
    "images": [
      {
        "src": "settings-clock-in.jpg",
        "caption": "Settings → Portal clock-in: who can use it, the location rules and the sites."
      },
      {
        "src": "portal-attendance.jpg",
        "caption": "My Attendance in the portal: the Clock in card appears above the month when it is on for the person."
      }
    ],
    "steps": [
      {
        "title": "Switch it on (admin)",
        "detail": "Tick the switch at the top right."
      },
      {
        "title": "Choose who",
        "detail": "All employees, or Only the people listed (add them one by one)."
      },
      {
        "title": "Set the location rules",
        "detail": "Require the location, and the least precise location accepted in metres."
      },
      {
        "title": "Add sites (optional)",
        "detail": "Name, latitude, longitude and radius. Use my current location fills the coordinates when you stand at the site. Without sites, any location is accepted."
      },
      {
        "title": "Save",
        "detail": "Employees then see a Clock in / Clock out card on My Attendance."
      },
      {
        "title": "Review punches",
        "detail": "At the bottom, pick a day to see each portal punch with a map link."
      }
    ],
    "tips": [
      "The browser asks the employee to allow location; if refused, the punch is refused when the location is required.",
      "Lateness is worked out from the person’s schedule and grace period, like a door punch."
    ],
    "faq": [
      {
        "q": "Can an employee clock in from home?",
        "a": "Only if no sites are set, or home is within a site’s radius."
      },
      {
        "q": "What if the door already recorded the day?",
        "a": "The door stays the record; the portal punch is stored but does not replace it."
      }
    ],
    "related": [
      "attendance",
      "portal-attendance"
    ]
  },
  {
    "id": "payroll-runs",
    "route": "/payroll-runs",
    "group": "payroll",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "Banknote",
    "title": "Payroll runs",
    "overview": "One regular run per company and month, plus any off-cycle runs. A run starts as a draft built from salaries and allowance components, unpaid leave and absences, loans and one-time items, approved overtime and the GPSSA pension. It is checked, submitted, and approved by someone other than the submitter. An approved run produces the payslips, the WPS files, the bank SIF and the Zoho Books journal.",
    "whenToUse": "Once a month for salaries, and whenever an extra payment needs its own run.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Generate draft",
        "Review checks",
        "Submit",
        "Approve",
        "Bank file & journal",
        "Mark paid"
      ]
    },
    "images": [
      {
        "src": "payroll-runs.jpg",
        "caption": "Payroll runs: the month, Generate run, Off-cycle run, and the runs with their status."
      },
      {
        "src": "payroll-run-detail.jpg",
        "caption": "An open draft: warnings to review, the Salary Explanation and WPS buttons, Submit for approval, and each employee’s figures (blurred here)."
      }
    ],
    "steps": [
      {
        "title": "Prepare the month",
        "detail": "Finish leave approvals, run the attendance checks, approve overtime and add one-time items first."
      },
      {
        "title": "Generate the run",
        "detail": "Pick the month and click Generate run. While it is a draft you can regenerate it after fixing data."
      },
      {
        "title": "Review",
        "detail": "Open the run. Errors block submission (missing WPS identifiers, invalid IBAN); warnings ask for a look (big change from last month, deductions over half of gross). The Compared with tab shows the change per person."
      },
      {
        "title": "Explain deductions",
        "detail": "Salary Explanation downloads an Excel file with every day that reduced pay, why and the arithmetic. Read it before approval."
      },
      {
        "title": "Submit and approve",
        "detail": "Submit for approval. The approver reviews and approves, or sends it back with a reason. The submitter cannot approve their own run, unless an admin writes a reason."
      },
      {
        "title": "After approval",
        "detail": "Email payslips; download the WPS file, the Bank file (SIF) and the Zoho journal; then Mark paid once the transfer has gone out."
      }
    ],
    "tips": [
      "Payslips are itemised: each allowance, deduction, loan instalment, overtime and pension line is shown with how it was worked out.",
      "Only staff with an issued labour contract go into the WPS files; the rest are listed separately.",
      "Offboarding and exited staff are left out of the monthly run; they are paid through the final settlement."
    ],
    "faq": [
      {
        "q": "Why can I not submit?",
        "a": "A blocking check failed. Fix the data shown (usually WPS identifiers or the IBAN), regenerate and submit again; an admin can override with a reason."
      },
      {
        "q": "Can I change an approved run?",
        "a": "No. Reject it back to draft before approval, or correct it in an off-cycle run or next month."
      },
      {
        "q": "Where do employees see their payslip?",
        "a": "In the portal under My Salary, once the run is approved."
      }
    ],
    "related": [
      "payroll-off-cycle",
      "bank-file",
      "gpssa",
      "payroll-items",
      "overtime"
    ]
  },
  {
    "id": "payroll-off-cycle",
    "route": "/payroll-runs",
    "group": "payroll",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "Plus",
    "title": "Off-cycle payroll runs",
    "overview": "An extra run in a month, next to the regular one, for a bonus, commission or correction that should not wait for the monthly run. Only the lines entered are paid: no salary, leave, loans or pension. It then goes through submit, approval, the WPS files and payslips like any run.",
    "whenToUse": "For a bonus, a commission, or to correct a payment outside the monthly run.",
    "images": [
      {
        "src": "payroll-off-cycle.jpg",
        "caption": "A new off-cycle run: month, title, and one line per payment or deduction."
      }
    ],
    "steps": [
      {
        "title": "Choose the company",
        "detail": "Select it in Entity at the top of the menu."
      },
      {
        "title": "Click Off-cycle run",
        "detail": "On the Payroll Runs page."
      },
      {
        "title": "Set the month and title",
        "detail": "For example: Q3 bonus."
      },
      {
        "title": "Add the lines",
        "detail": "For each line: employee, Payment or Deduction, category (bonus, commission, correction, other), description and amount. The net total shows at the bottom."
      },
      {
        "title": "Create run",
        "detail": "It appears in the list tagged Off-cycle; open it, submit and approve as usual."
      }
    ],
    "tips": [
      "A person’s deductions in an off-cycle run cannot exceed what they are paid in it.",
      "Bonuses are not part of the GPSSA contribution salary, so no pension is deducted."
    ],
    "faq": [
      {
        "q": "How many off-cycle runs can a month have?",
        "a": "As many as needed; each is numbered after the regular run."
      },
      {
        "q": "Does it appear on the payslip?",
        "a": "Yes, as its own payslip for that month, titled with the run’s name."
      }
    ],
    "related": [
      "payroll-runs",
      "payroll-items"
    ]
  },
  {
    "id": "bank-file",
    "route": "/settings/payroll-exports",
    "group": "payroll",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "Landmark",
    "title": "Bank file (SIF) and Zoho Books journal",
    "overview": "An approved run downloads as the Salary Information File the paying bank (Wio) takes for WPS, and as a manual-journal CSV for Zoho Books. The SIF has one EDR line per employee (14-digit personal number, the employee bank’s 9-digit routing code, IBAN, period, days, fixed and variable pay, days on leave) and an SCR line with the employer ID, the paying bank and the total. The journal debits salary expense, credits loans and the GPSSA payable, and credits net pay to Salaries Payable, optionally by department.",
    "whenToUse": "Once to set up, then every month after the run is approved.",
    "images": [
      {
        "src": "settings-payroll-exports.jpg",
        "caption": "Settings → Bank file and accounting: employer IDs, routing codes, and the Zoho account names."
      }
    ],
    "steps": [
      {
        "title": "Employer details (once)",
        "detail": "For each company: the 13-digit employer ID (defaults to the MOL ID, zero-padded) and Wio’s 9-digit routing code."
      },
      {
        "title": "Employee banks (once)",
        "detail": "Add a routing code for each bank your staff use; the bank code is digits 5–7 of the IBAN (AE07 033… → 033)."
      },
      {
        "title": "Zoho accounts (once)",
        "detail": "Salary expense, salaries payable, loans and advances, GPSSA payable, employer pension expense, cost centre (department or none), reference prefix, and optionally an account per payslip line (HOUSING, OVERTIME_PAY, LOAN…)."
      },
      {
        "title": "Download the SIF",
        "detail": "Open the approved run → Bank file (SIF). If something is missing, the message names it instead of producing a file."
      },
      {
        "title": "Import the journal",
        "detail": "Zoho journal downloads a CSV; in Zoho Books open Accountant → Manual Journals → Import."
      }
    ],
    "tips": [
      "Test the first SIF with Wio before relying on it.",
      "Use the account names exactly as they appear in your Zoho chart of accounts.",
      "The journal is checked to balance before it is downloaded."
    ],
    "faq": [
      {
        "q": "Which employees are in the SIF?",
        "a": "Those with an issued labour contract, not offboarding; others are listed separately."
      },
      {
        "q": "Where do I find a routing code?",
        "a": "From the bank (Wio can supply the list of UAE bank WPS routing codes)."
      }
    ],
    "related": [
      "payroll-runs",
      "gpssa"
    ]
  },
  {
    "id": "gpssa",
    "route": null,
    "group": "payroll",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "Shield",
    "title": "GPSSA pension (UAE nationals)",
    "overview": "Payroll deducts the GPSSA pension for UAE nationals. New law (Federal Decree-Law 57/2023, insured from 31 Oct 2023): employee 11%, employer 15%, of which the government pays 2.5 points while the contribution salary is below AED 20,000; contribution salary AED 3,000–70,000. Old law (Federal Law 7/1999): employee 5%, employer 12.5%; AED 1,000–50,000. The employee share is a payslip line; the employer share is recorded and posted in the Zoho journal.",
    "whenToUse": "When a UAE national joins, and when the law values change.",
    "images": [
      {
        "src": "compliance-emiratisation.jpg",
        "caption": "The rates are statutory figures kept in the Compliance centre, editable by an admin."
      }
    ],
    "steps": [
      {
        "title": "Check each national’s scheme",
        "detail": "Employee profile → Profile details → Edit → GPSSA pension: Automatic, New law, Old law, or Not covered."
      },
      {
        "title": "Automatic",
        "detail": "UAE nationals by join date: from 31 Oct 2023 the new law, otherwise the old one."
      },
      {
        "title": "Set by hand when needed",
        "detail": "If the GPSSA registration date says otherwise; choose Not covered for GCC nationals and the Abu Dhabi Pension Fund, handled by hand."
      },
      {
        "title": "Generate payroll",
        "detail": "The GPSSA pension line appears on the payslip with the percentage and contribution salary."
      },
      {
        "title": "Update the rates",
        "detail": "Compliance centre → statutory figures (admin), after checking with GPSSA."
      }
    ],
    "tips": [
      "The contribution salary is the full monthly salary, bounded by the minimum and maximum.",
      "Off-cycle runs do not deduct pension."
    ],
    "faq": [
      {
        "q": "Are GCC nationals covered?",
        "a": "Not modelled; they contribute to their home scheme. Mark them Not covered."
      },
      {
        "q": "Where is the employer share?",
        "a": "On the payroll item and in the Zoho journal (employer pension expense against GPSSA payable)."
      }
    ],
    "related": [
      "payroll-runs",
      "bank-file",
      "compliance-centre"
    ]
  },
  {
    "id": "payroll-items",
    "route": "/payroll-items",
    "group": "payroll",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "HandCoins",
    "title": "Loans and one-time items",
    "overview": "Loans and salary advances whose instalments come off pay each month until repaid, and one-time items (bonus, commission, allowance, reimbursement, deduction) that go into one month’s run and the WPS file. Each shows on the payslip as its own line.",
    "whenToUse": "When you lend money to an employee, or a one-off amount belongs in a month’s pay.",
    "images": [
      {
        "src": "payroll-items.jpg",
        "caption": "Loans & one-time items: loans with their balance, and items by month."
      }
    ],
    "steps": [
      {
        "title": "Add a loan or advance",
        "detail": "Employee, amount, monthly instalment and start month. The instalment is deducted each month until nothing is outstanding."
      },
      {
        "title": "Add a one-time item",
        "detail": "Employee, type, amount, the month it is paid in and a note."
      },
      {
        "title": "Generate payroll",
        "detail": "Each instalment and item becomes a payslip line; regenerating a draft recalculates them."
      },
      {
        "title": "Close a loan early",
        "detail": "Close it when it is settled another way."
      }
    ],
    "tips": [
      "A salary advance approved from a portal request creates the advance here automatically.",
      "An approved expense claim is paid as a one-time item."
    ],
    "faq": [
      {
        "q": "What if pay is too low for the instalment?",
        "a": "The run shows it; adjust the instalment or the start month."
      },
      {
        "q": "Can I delete an item?",
        "a": "Admins can, while it is not in an approved run."
      }
    ],
    "related": [
      "payroll-runs",
      "employee-requests"
    ]
  },
  {
    "id": "salary-reviews",
    "route": "/salary-reviews",
    "group": "payroll",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "TrendingUp",
    "title": "Salary Reviews",
    "overview": "The annual salary re-evaluation workflow. HR prepares one review cycle per company per year, listing every active employee with their current salary; propose a new salary and effective date per person, work through a UAE labor-law compliance checklist (contract addendum, MOHRE update, WPS update) and attach proof documents, then submit it for the company’s designated approver to sign off through the system. Once approved, the raise is applied to payroll automatically on its effective date.",
    "whenToUse": "At year-end (or whenever compensation is re-evaluated) to run a documented, auditable salary-increase process instead of ad-hoc paperwork.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Draft",
        "Fill new salaries",
        "Submit",
        "Approver decides",
        "Applied on effective date"
      ]
    },
    "steps": [
      {
        "title": "Start a review",
        "detail": "Click New Review and pick the year; every Active employee in the selected company is added automatically with their current salary."
      },
      {
        "title": "Propose new salaries",
        "detail": "Enter each employee’s new basic/full salary and an effective date; a badge flags a proposal that falls outside the job title’s salary band. Skip anyone who isn’t getting a change."
      },
      {
        "title": "Work the compliance checklist",
        "detail": "Each employee gets 3 default UAE actions — sign the contract addendum, update the MOHRE labor contract, update the WPS registration — tick them off (or add custom ones) and upload proof documents as you complete them."
      },
      {
        "title": "Submit for approval",
        "detail": "Submitting is blocked until every employee has a salary and effective date. The company’s designated approver is notified in-app and by email."
      },
      {
        "title": "Approver decides",
        "detail": "The approver (never the person who prepared it) opens the review and Approves or Rejects — a rejection requires a note and sends the review back to Draft for revision."
      },
      {
        "title": "Generate the letter & apply",
        "detail": "Generate an AI-drafted, letterhead-composed Salary Revision Letter to print/email, then upload the final signed copy. Approved raises apply to the employee record automatically on their effective date — no manual step."
      }
    ],
    "tips": [
      "Set the company’s Salary Review Approver first in Settings → Companies (admin) — otherwise any admin can approve, and no one is stuck waiting.",
      "The person who prepares a review can never approve their own review, even if they are an admin — this is enforced by the system.",
      "Raises only take effect on their chosen effective date; the record updates and the employee is notified automatically that day."
    ],
    "faq": [
      {
        "q": "Who approves a salary review?",
        "a": "The company’s designated Salary Review Approver (set by an admin in Settings → Companies). If none is set, any admin may approve — except the person who prepared the review."
      },
      {
        "q": "When does the new salary actually apply?",
        "a": "Automatically on the effective date you set per employee — the system checks periodically and updates the employee record with no manual step."
      },
      {
        "q": "What are the 3 default actions for?",
        "a": "They track the UAE labor-law paperwork a salary change usually requires: a signed contract addendum, updating the MOHRE labor contract, and updating the WPS salary registration. You can add more per employee."
      },
      {
        "q": "Can I still edit salaries after submitting?",
        "a": "No — once submitted, edit is locked. If the approver rejects it, use Reopen to bring it back to Draft and revise."
      },
      {
        "q": "Does this replace Payroll Runs?",
        "a": "No — Salary Reviews updates the employee’s stored salary; Payroll Runs then computes each month’s pay from that updated salary."
      }
    ],
    "related": [
      "payroll-runs",
      "employees",
      "companies",
      "payroll",
      "send-documents"
    ],
    "images": [
      {
        "src": "salary-reviews.jpg",
        "caption": "Salary Reviews: the page as it looks now."
      }
    ]
  },
  {
    "id": "performance",
    "route": "/performance",
    "group": "talent",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "TrendingUp",
    "title": "Performance",
    "overview": "Create quarterly performance targets per employee (target amount + KPI/objective notes), capture sign-off, and email the target to the employee.",
    "whenToUse": "To set and track quarterly goals and KPIs for staff.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Create target",
        "Share / email",
        "Employee signs",
        "Track quarter"
      ]
    },
    "images": [
      {
        "src": "performance.jpg",
        "caption": "Performance: quarterly targets per employee, filterable by quarter."
      },
      {
        "src": "performance-add-target.jpg",
        "caption": "Add target: select the employee and quarter, set the target amount and KPI/objective notes."
      }
    ],
    "steps": [
      {
        "title": "Create a target",
        "detail": "Select employee and quarter, set the target amount and KPI/objective notes."
      },
      {
        "title": "Sign & send",
        "detail": "Capture sign-off and email the target to the employee."
      },
      {
        "title": "Filter by quarter",
        "detail": "Review targets per quarter and remove outdated ones."
      }
    ],
    "tips": [
      "Write specific, measurable KPI notes so reviews are objective."
    ],
    "faq": [
      {
        "q": "Can I email the target?",
        "a": "Yes — use the email action on the target."
      },
      {
        "q": "How are quarters chosen?",
        "a": "Filter and create targets by the quarter selector."
      }
    ],
    "related": [
      "kpi",
      "employees"
    ]
  },
  {
    "id": "reviews",
    "route": "/reviews",
    "group": "talent",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "ClipboardCheck",
    "title": "Appraisals",
    "overview": "Appraisal cycles launched by HR. Each person completes a self review against goals with weights; their manager then reviews and recommends; HR confirms the final rating. The latest rating appears in salary reviews.",
    "whenToUse": "At each appraisal period (yearly or half-yearly).",
    "images": [
      {
        "src": "reviews.jpg",
        "caption": "Appraisals (HR): cycles and each review’s stage."
      },
      {
        "src": "portal-reviews.jpg",
        "caption": "My Reviews (portal): the employee’s own appraisals, and their team’s for managers."
      }
    ],
    "steps": [
      {
        "title": "Launch a cycle",
        "detail": "Name, period and the people included."
      },
      {
        "title": "Self review",
        "detail": "Each employee opens My Reviews in the portal, sets goals and weights, and rates themselves."
      },
      {
        "title": "Manager review",
        "detail": "The direct manager rates each goal and writes a recommendation."
      },
      {
        "title": "HR review",
        "detail": "HR sets the final rating and closes the review."
      }
    ],
    "tips": [
      "Set a direct manager for everyone first; the manager stage depends on it.",
      "Salary reviews show the latest final rating next to the proposal."
    ],
    "faq": [
      {
        "q": "Can HR see a review before the manager finishes?",
        "a": "Yes, with its current stage."
      },
      {
        "q": "Do employees see the final rating?",
        "a": "Yes, in My Reviews once HR closes it."
      }
    ],
    "related": [
      "salary-reviews",
      "performance",
      "portal-reviews"
    ]
  },
  {
    "id": "training",
    "route": "/training",
    "group": "talent",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "GraduationCap",
    "title": "Training, certificates and skills",
    "overview": "A course list with validity and mandatory courses; training and certificates recorded on each profile with an alert before they expire; and skills rated 1 to 5. Every morning at 08:00 a reminder goes to whoever owns an overdue onboarding step.",
    "whenToUse": "To track who is trained and certified, and renew certificates on time.",
    "images": [
      {
        "src": "training.jpg",
        "caption": "Training: courses, expiring certificates and missing mandatory courses."
      }
    ],
    "steps": [
      {
        "title": "Add courses",
        "detail": "Name, provider, how long it stays valid, and whether it is mandatory."
      },
      {
        "title": "Record training",
        "detail": "On the profile → Training & skills: course, dates, result and the certificate file."
      },
      {
        "title": "Rate skills",
        "detail": "On the same tab, skills from the library with a level 1–5."
      },
      {
        "title": "Watch expiries",
        "detail": "The Training page lists expired and expiring certificates and who lacks a mandatory course."
      }
    ],
    "tips": [
      "Expiring certificates also feed the compliance deadlines."
    ],
    "faq": [
      {
        "q": "Who is alerted before a certificate expires?",
        "a": "HR, by notification, ahead of the expiry date."
      }
    ],
    "related": [
      "employees",
      "skills",
      "onboarding"
    ]
  },
  {
    "id": "approval-chains",
    "route": "/settings/approvals",
    "group": "services",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "GitBranch",
    "title": "Approval chains and My Approvals",
    "overview": "Approval steps before HR decides, per request type: leave, overtime, expense, salary advance and hiring request. A step can be the direct manager, the manager’s manager, a role, or a named person. Anyone with a decision waiting finds it in My Approvals in the portal.",
    "whenToUse": "When managers should approve before HR.",
    "images": [
      {
        "src": "settings-approvals.jpg",
        "caption": "Settings → Approval chains: steps per request type."
      },
      {
        "src": "portal-approvals.jpg",
        "caption": "Portal → My Approvals: what is waiting for your decision."
      }
    ],
    "steps": [
      {
        "title": "Pick the request type",
        "detail": "Leave, overtime, expense, advance or hiring request."
      },
      {
        "title": "Add the steps in order",
        "detail": "Direct manager, manager’s manager, a role, or a person."
      },
      {
        "title": "Save",
        "detail": "New requests follow the chain, then reach HR. Without a chain they go straight to HR."
      },
      {
        "title": "Decide in My Approvals",
        "detail": "Approvers open My Approvals, read the request and approve or reject with a comment."
      }
    ],
    "tips": [
      "The direct-manager step needs a manager on each employee’s profile.",
      "Requests already in progress keep the chain they started with, even if you edit it.",
      "The requester never approves their own request, and a rejection at any step rejects it."
    ],
    "faq": [
      {
        "q": "What if a step has nobody (no manager)?",
        "a": "That step is skipped, the request records why, and it moves on."
      },
      {
        "q": "Can HR approve before the chain finishes?",
        "a": "No. HR gives the final decision once the chain is done."
      }
    ],
    "related": [
      "leave",
      "employee-requests",
      "requisitions",
      "portal-approvals"
    ]
  },
  {
    "id": "employee-requests",
    "route": "/requests",
    "group": "services",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist",
      "accountant"
    ],
    "icon": "Inbox",
    "title": "Employee requests",
    "overview": "Letters, expense claims, salary advances and HR cases raised from the portal, with a conversation and attachments on each. Counters show what is open, ready for HR, and still in an approval chain.",
    "whenToUse": "Daily, to answer what employees have asked for.",
    "images": [
      {
        "src": "employee-requests.jpg",
        "caption": "Employee Requests (HR): filter by type and status."
      },
      {
        "src": "portal-requests.jpg",
        "caption": "My Requests (portal): the employee’s side."
      }
    ],
    "steps": [
      {
        "title": "Filter",
        "detail": "All, Letter, Expense, Salary advance or HR case, and the status."
      },
      {
        "title": "Open a request",
        "detail": "Read the details and attachments, reply in the conversation."
      },
      {
        "title": "Letters",
        "detail": "Upload the finished letter (salary certificate, NOC, employment confirmation, experience); the employee downloads it from their account."
      },
      {
        "title": "Expenses and advances",
        "detail": "An approved expense is paid with the next salary; an approved advance is deducted in instalments."
      },
      {
        "title": "Close",
        "detail": "Mark it done or rejected with a reason."
      }
    ],
    "tips": [
      "Letters can be generated from Legal Letters and then attached here."
    ],
    "faq": [
      {
        "q": "Why is a request not Ready for HR?",
        "a": "It is still in its approval chain; see the chain step on the request."
      }
    ],
    "related": [
      "portal-requests",
      "approval-chains",
      "legal-letters",
      "payroll-items"
    ]
  },
  {
    "id": "communications",
    "route": "/communications",
    "group": "services",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "Megaphone",
    "title": "Announcements and policies",
    "overview": "Announcements to employees with read tracking, and policies employees read and acknowledge from the portal. Editing a published policy changes it in place; publishing a new version asks everyone to acknowledge it again.",
    "whenToUse": "To share news and to keep a record of who accepted each policy.",
    "images": [
      {
        "src": "communications.jpg",
        "caption": "Announcements & policies (HR)."
      },
      {
        "src": "portal-policies.jpg",
        "caption": "Policies in the portal: read and acknowledge."
      }
    ],
    "steps": [
      {
        "title": "New announcement",
        "detail": "Title, text, audience; employees see it under Announcements."
      },
      {
        "title": "New policy",
        "detail": "Title, text, audience; turn on Employees must acknowledge it and set an optional acknowledge-by date."
      },
      {
        "title": "Track",
        "detail": "Read counts for announcements; acknowledged counts per policy version."
      },
      {
        "title": "Remind",
        "detail": "Remind those who have not acknowledged sends a notification."
      },
      {
        "title": "Publish new version",
        "detail": "When a policy changes in substance, so everyone acknowledges again."
      }
    ],
    "tips": [
      "Acknowledgements are kept per version as evidence."
    ],
    "faq": [
      {
        "q": "Do employees get notified?",
        "a": "Yes, when a policy is published and when you send a reminder."
      }
    ],
    "related": [
      "portal-policies",
      "portal-announcements"
    ]
  },
  {
    "id": "disciplinary",
    "route": "/disciplinary",
    "group": "services",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "Gavel",
    "title": "Disciplinary file",
    "overview": "A case per incident: what happened, the action taken (counselling, verbal warning, written warning, final warning, suspension, termination), the employee’s response, and the warning letter issued, linked to the case.",
    "whenToUse": "Whenever a conduct or performance issue is formally addressed.",
    "images": [
      {
        "src": "disciplinary.jpg",
        "caption": "Disciplinary: cases with their action and status."
      }
    ],
    "steps": [
      {
        "title": "Record a case",
        "detail": "Employee, date and a description of the incident."
      },
      {
        "title": "Choose the action",
        "detail": "From counselling to termination."
      },
      {
        "title": "Issue the letter",
        "detail": "Generate it in Legal Letters and link it to the case."
      },
      {
        "title": "Add the response",
        "detail": "Record the employee’s response when received."
      }
    ],
    "tips": [
      "Keep the description factual and dated; the file may be read in a dispute."
    ],
    "faq": [
      {
        "q": "Who can see cases?",
        "a": "HR and admins; employees do not see them in the portal."
      }
    ],
    "related": [
      "legal-letters",
      "employees"
    ]
  },
  {
    "id": "benefits",
    "route": "/benefits",
    "group": "services",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist"
    ],
    "icon": "HeartHandshake",
    "title": "Benefits: medical insurance and air tickets",
    "overview": "Group insurance policies per company, each employee’s enrolment with dependents, and the air ticket entitlement. The Benefits page lists cover ending and tickets due within 60 days. A ticket paid in cash is added as an allowance to that month’s draft run.",
    "whenToUse": "When enrolling a new joiner, renewing cover, or when a ticket falls due.",
    "images": [
      {
        "src": "benefits.jpg",
        "caption": "Benefits: policies, cover ending and tickets due."
      },
      {
        "src": "employee-benefits.jpg",
        "caption": "Employee profile → Benefits: enrolment and ticket entitlement."
      },
      {
        "src": "portal-benefits.jpg",
        "caption": "My Benefits in the portal (premium hidden)."
      }
    ],
    "steps": [
      {
        "title": "Add a policy",
        "detail": "Insurer, policy number, plan and period, for the company."
      },
      {
        "title": "Enrol the employee",
        "detail": "Profile → Benefits: policy, category, card number, cover dates, yearly premium, and dependents (name, relation, date of birth)."
      },
      {
        "title": "Set the ticket entitlement",
        "detail": "Every 12 or 24 months, class, and destination."
      },
      {
        "title": "Record a ticket used",
        "detail": "Booked by the company or paid in cash; cash goes into the draft run of the month."
      }
    ],
    "tips": [
      "Employees see their cover, dependents and next ticket in My Benefits, without the premium."
    ],
    "faq": [
      {
        "q": "What if the month’s run is already approved?",
        "a": "A cash ticket can only be added to a draft run; record it after the next run is generated."
      }
    ],
    "related": [
      "portal-benefits",
      "payroll-runs",
      "employees"
    ]
  },
  {
    "id": "change-log",
    "route": null,
    "group": "services",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "ScrollText",
    "title": "Employee change log",
    "overview": "On each employee profile, the Change log tab shows who changed which field and when, with the value before and after: personal details, salary and its components, and bank details (account and IBAN masked except the last 4 digits).",
    "whenToUse": "To answer “who changed this, and when?”.",
    "images": [
      {
        "src": "employee-change-log.jpg",
        "caption": "Employee profile → Change log."
      }
    ],
    "steps": [
      {
        "title": "Open the profile",
        "detail": "From the Employees Hub."
      },
      {
        "title": "Choose Change log",
        "detail": "In the Records group of tabs."
      },
      {
        "title": "Read the entries",
        "detail": "Newest first; each names the person, the date, the field, and before → after."
      }
    ],
    "tips": [
      "Changes are recorded from v2.5 onwards; earlier edits are in the Audit Log as text."
    ],
    "faq": [
      {
        "q": "Who can see it?",
        "a": "Admins and HR managers."
      }
    ],
    "related": [
      "employees",
      "audit"
    ]
  },
  {
    "id": "assets",
    "route": "/assets",
    "group": "assets",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "Laptop",
    "title": "Assets & Equipment",
    "overview": "Assign company assets to employees — Hardware (linked to Inventory), Software, and Accounts (with encrypted passwords). Print or email a handover receipt, reveal account passwords with permission, and process returns.",
    "whenToUse": "When handing equipment or accounts to staff and tracking custody.",
    "images": [
      {
        "src": "assets.jpg",
        "caption": "Assets & Equipment: assignments with a status filter; print/email a handover receipt or process a return."
      },
      {
        "src": "assets-assign-asset.jpg",
        "caption": "Assign Asset: pick the employee and company, choose the type (Hardware / Account / Software), optionally pick an Inventory item, then set name, identifier, workspace, access level and issue date."
      },
      {
        "src": "assets-assign-asset-1.jpg",
        "caption": "For Hardware you can select an available Inventory item — its details auto-fill and the item flips to “Assigned”."
      },
      {
        "src": "assets-assign-asset-2.jpg",
        "caption": "For Accounts, store the username, URL and password — the password is encrypted and only revealed briefly with permission."
      }
    ],
    "steps": [
      {
        "title": "Assign an asset",
        "detail": "Pick the employee, company and type; for hardware, select an Inventory item to auto-fill its details."
      },
      {
        "title": "Store account credentials",
        "detail": "For accounts, enter username/password/URL — the password is stored encrypted and revealed only with permission."
      },
      {
        "title": "Receipt & return",
        "detail": "Print or email a handover receipt; on return, click Return and set the condition."
      }
    ],
    "tips": [
      "Hardware assets pull from Inventory and flip that item to “Assigned”; returning frees it again."
    ],
    "faq": [
      {
        "q": "How are passwords protected?",
        "a": "They are encrypted (AES-256) and only shown briefly when an authorized user reveals them."
      },
      {
        "q": "How do I send the receipt on letterhead?",
        "a": "Use the send/print button; it composes the receipt onto the company letterhead if one is set."
      },
      {
        "q": "What happens on return?",
        "a": "The asset is marked Returned and any linked Inventory item becomes Available again."
      }
    ],
    "related": [
      "inventory",
      "asset-catalog",
      "my-assets",
      "send-documents"
    ]
  },
  {
    "id": "inventory",
    "route": "/inventory",
    "group": "assets",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "Package",
    "title": "Inventory",
    "overview": "The registry of all physical equipment: asset code, serial, brand/model, purchase date & cost, warranty, condition and status. Each item has a printable QR/barcode label and a full movement history.",
    "whenToUse": "To record every device the company owns and track its lifecycle and assignment.",
    "images": [
      {
        "src": "inventory.jpg",
        "caption": "Inventory: filterable equipment list with condition and status; open an item for its QR/barcode and movement history."
      },
      {
        "src": "asset-inventory-add-item.jpg",
        "caption": "Add item: platform/type, asset code, serial, brand/model, purchase date & cost, warranty and condition."
      }
    ],
    "steps": [
      {
        "title": "Add equipment",
        "detail": "Enter platform/type, asset code, serial, brand/model, purchase date & cost, warranty and condition."
      },
      {
        "title": "Track status",
        "detail": "Available → Assigned (via Assets) → In Repair / Retired / Lost as needed."
      },
      {
        "title": "Labels & history",
        "detail": "Print the QR/barcode label; open an item to see its full movement history."
      }
    ],
    "tips": [
      "Enter real purchase dates and costs for accurate depreciation in reports."
    ],
    "faq": [
      {
        "q": "How does an item become “Assigned”?",
        "a": "When you assign it to an employee from the Assets page."
      },
      {
        "q": "Can I print labels?",
        "a": "Yes — each item has a printable QR code and barcode."
      }
    ],
    "related": [
      "assets",
      "asset-catalog"
    ]
  },
  {
    "id": "asset-catalog",
    "route": "/settings/catalog",
    "group": "assets",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Box",
    "title": "Asset Catalog",
    "overview": "Define the TYPES of assets before adding actual items: categories and platforms classified as Hardware, Account or Software. The catalog drives Inventory and Assets.",
    "whenToUse": "First-time setup of asset/equipment types, before entering inventory.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Create categories",
        "Add platforms/types",
        "Used in Inventory & Assets"
      ]
    },
    "images": [
      {
        "src": "settings-catalog.jpg",
        "caption": "Settings → Asset Catalog: categories and the platforms/types within them, classified as Hardware, Account or Software."
      },
      {
        "src": "settings-create-category.jpg",
        "caption": "Create a category (e.g. Laptops, Phones, Software Accounts) with an icon and color."
      },
      {
        "src": "settings-create-platform.jpg",
        "caption": "Add a platform/type under a category, classified as Hardware / Account / Software, with allowed companies."
      }
    ],
    "steps": [
      {
        "title": "Create categories",
        "detail": "Add categories (e.g. Laptops, Phones, Software Accounts) with an icon and color."
      },
      {
        "title": "Add platforms/types",
        "detail": "Under each category add platforms classified as Hardware / Account / Software, with allowed companies."
      }
    ],
    "tips": [
      "Set up the catalog first — Inventory items and assigned Assets reference these types."
    ],
    "faq": [
      {
        "q": "Difference between catalog and inventory?",
        "a": "Catalog = the “types”; Inventory = the actual physical items of those types."
      },
      {
        "q": "Who can delete catalog entries?",
        "a": "Admins; HR can add/edit."
      }
    ],
    "related": [
      "inventory",
      "assets"
    ]
  },
  {
    "id": "digital-access",
    "route": "/digital-access",
    "group": "assets",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "KeyRound",
    "title": "Digital & portal access",
    "overview": "Who holds which access to which platform, business manager or ad account, per owner company (IST Real Estate, IST Markets, or IST Groups shared), with an access review report.",
    "whenToUse": "When someone joins, changes role or leaves, and for periodic access reviews.",
    "images": [
      {
        "src": "digital-access.jpg",
        "caption": "Digital & Portal Access: owner filters, Access review and Grant access. Credentials are blurred."
      }
    ],
    "steps": [
      {
        "title": "Filter by owner",
        "detail": "All owners, IST Real Estate, IST Markets, or IST Groups (shared). Admin & above narrows to high-privilege access."
      },
      {
        "title": "Grant access",
        "detail": "Choose the platform or account, the person and the access level."
      },
      {
        "title": "Access review",
        "detail": "A report of who holds what, to confirm each access is still needed."
      },
      {
        "title": "Revoke",
        "detail": "Remove access that is no longer needed."
      }
    ],
    "tips": [
      "Offboarding checklists remind you to revoke access; this page is where you confirm it."
    ],
    "faq": [
      {
        "q": "Is this the same as Assets?",
        "a": "No. Assets are devices and items; this page is access to online platforms and accounts."
      }
    ],
    "related": [
      "assets",
      "social-governance",
      "offboarding"
    ]
  },
  {
    "id": "social-governance",
    "route": "/social-governance",
    "group": "assets",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "Share2",
    "title": "Social media governance",
    "overview": "Which entity owns each social media account, and who holds access on each of the three asset layers (the account, the business manager, the ad account). Governance checks flag problems such as an account with no owner or a single admin.",
    "whenToUse": "To keep company social accounts owned by the company, not by individuals.",
    "images": [
      {
        "src": "social-governance.jpg",
        "caption": "Social Media Governance: governance checks, accounts and team access."
      }
    ],
    "steps": [
      {
        "title": "Read the governance checks",
        "detail": "Each check explains the risk and the account it concerns."
      },
      {
        "title": "Accounts tab",
        "detail": "Each account with its platform and owning entity. Add account registers a new one."
      },
      {
        "title": "Team access tab",
        "detail": "Who holds access on each layer."
      },
      {
        "title": "Filter by owner",
        "detail": "IST Real Estate or IST Markets."
      }
    ],
    "tips": [
      "Keep at least two company-controlled admins on every account."
    ],
    "faq": [
      {
        "q": "What are the three layers?",
        "a": "The social account itself, the business manager it belongs to, and the ad account that pays for promotion."
      }
    ],
    "related": [
      "digital-access",
      "domains"
    ]
  },
  {
    "id": "domains",
    "route": "/domains",
    "group": "assets",
    "roles": [
      "admin",
      "hr_manager",
      "accountant"
    ],
    "icon": "Globe",
    "title": "Domains, hosting and infrastructure",
    "overview": "Who owns each domain and hosting account, who controls DNS, and when it renews. Shared across both companies: the Entity selector does not filter this page; use the owner buttons instead.",
    "whenToUse": "To avoid a domain or hosting lapsing, and to know who to call when the website is down.",
    "images": [
      {
        "src": "domains.jpg",
        "caption": "Domains & hosting: registrar, accountability, renewal date, auto-renew and status."
      }
    ],
    "steps": [
      {
        "title": "Add record",
        "detail": "Domain or account, registrar or provider, who is accountable, renewal date and whether it auto-renews."
      },
      {
        "title": "Run renewal check",
        "detail": "Flags what renews soon or is overdue; alerts also run automatically every 6 hours."
      },
      {
        "title": "Mark renewed",
        "detail": "After renewing, record the new date."
      }
    ],
    "tips": [
      "Turn on auto-renew at the registrar for the main domains, and still keep the date here."
    ],
    "faq": [
      {
        "q": "Why does the Entity selector not filter it?",
        "a": "Domains and hosting are shared by the group."
      }
    ],
    "related": [
      "digital-access",
      "company-docs"
    ]
  },
  {
    "id": "compliance-centre",
    "route": "/compliance",
    "group": "compliance",
    "roles": [
      "admin",
      "hr_manager",
      "hr_specialist",
      "accountant"
    ],
    "icon": "ShieldCheck",
    "title": "Compliance centre",
    "overview": "Three tabs. Needs attention: everything late or at risk, most urgent first. Deadlines: every dated deadline of a month (WPS, document expiries, settlements due, last working days, holidays, Emiratisation checkpoints). Emiratisation: per company, headcount, nationals, the required number and the expected fine, from statutory figures an admin keeps current.",
    "whenToUse": "Weekly, and before each month end.",
    "images": [
      {
        "src": "compliance.jpg",
        "caption": "Needs attention."
      },
      {
        "src": "compliance-deadlines.jpg",
        "caption": "Deadlines for the month (names blurred)."
      },
      {
        "src": "compliance-emiratisation.jpg",
        "caption": "Emiratisation per company with the statutory figures."
      }
    ],
    "steps": [
      {
        "title": "Needs attention",
        "detail": "Click the arrow on a line to go and fix it."
      },
      {
        "title": "Deadlines",
        "detail": "Move between months with the arrows; WPS salaries count as late if unpaid 15 days after the month; settlements are due 14 days after the last working day."
      },
      {
        "title": "Emiratisation",
        "detail": "Choose the year to see required nationals, the gap and the fine."
      },
      {
        "title": "Statutory figures (admin)",
        "detail": "Emiratisation targets, fines, and GPSSA pension rates, by year, each with a note of its source."
      }
    ],
    "tips": [
      "Loaded figures were checked against official sources: +2 points a year to 10% by end-2026, and AED 10,000 a month per missing national from July 2026.",
      "Companies under 50 skilled employees are outside the rule; the 20–49 tier is not modelled."
    ],
    "faq": [
      {
        "q": "Who counts as a national?",
        "a": "Employees whose nationality is UAE / Emirati."
      },
      {
        "q": "Can I change a fine or rate?",
        "a": "An admin can, in the statutory figures table, with a note."
      }
    ],
    "related": [
      "dashboard",
      "gpssa",
      "document-radar"
    ]
  },
  {
    "id": "legal-letters",
    "route": "/legal-letters",
    "group": "compliance",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Scale",
    "title": "Legal Letters",
    "overview": "Generate official letters (Salary Certificate, Experience, NOC, Warning, Termination, Show Cause, etc.) with AI-assisted content for an employee, then preview, print or email them as a PDF — composed onto the issuing company’s letterhead when one is set.",
    "whenToUse": "Whenever an employee needs a formal letter from the company.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Pick template",
        "Choose company + employee",
        "AI drafts content",
        "Preview",
        "Print / Email (PDF)"
      ]
    },
    "images": [
      {
        "src": "legal-letters.jpg",
        "caption": "Legal Letters: generated letters with preview, print and email actions; add your own templates too."
      },
      {
        "src": "legal-letters-generate-letter.jpg",
        "caption": "Generate a letter: pick the letter type, the issuing company and the employee."
      },
      {
        "src": "legal-letters-generate-letter-1.jpg",
        "caption": "Provide any template-specific fields; AI drafts the letter using the employee and company data."
      }
    ],
    "steps": [
      {
        "title": "Choose a template",
        "detail": "Click a letter type (or Generate) and select the issuing company and the employee."
      },
      {
        "title": "Fill fields & generate",
        "detail": "Provide any template-specific fields; AI drafts the letter using employee + company data."
      },
      {
        "title": "Print or email",
        "detail": "Open the letter and Print or “Send by Email (PDF)” — it is composed onto the selected company’s letterhead."
      }
    ],
    "tips": [
      "The letter is issued under the company you pick on the form — not necessarily the employee’s own company.",
      "Generate a fresh letter after uploading a letterhead so it composes correctly."
    ],
    "faq": [
      {
        "q": "It shows the wrong company name.",
        "a": "Pick the correct company in the generate form — the letter (and letterhead) follow your selection."
      },
      {
        "q": "The letterhead overlaps the text.",
        "a": "Increase the top margin for that company in Settings → Companies → Letterhead."
      },
      {
        "q": "Can I add my own letter type?",
        "a": "Yes — “Add Template” lets admins/HR create new letter templates (see System Config → Letter Templates)."
      }
    ],
    "related": [
      "send-documents",
      "companies",
      "company-docs",
      "system-config"
    ]
  },
  {
    "id": "company-docs",
    "route": "/company-docs",
    "group": "compliance",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "FileArchive",
    "title": "Company Documents",
    "overview": "A repository for official company documents organized by category (policies, safety, compliance, training…). Upload, search, filter and download files per company.",
    "whenToUse": "To store and share the company’s official documents and policies.",
    "images": [
      {
        "src": "company-docs.jpg",
        "caption": "Company Documents: a category filter and search over the documents stored for the selected company."
      },
      {
        "src": "company-docs-upload-document.jpg",
        "caption": "Upload a document and assign it to a category for the current company."
      }
    ],
    "steps": [
      {
        "title": "Create categories",
        "detail": "Organize documents into categories (e.g. Policy, Safety, Compliance)."
      },
      {
        "title": "Upload",
        "detail": "Upload a file and assign it to a category for the current company."
      },
      {
        "title": "Find & download",
        "detail": "Search or filter by category, then download what you need."
      }
    ],
    "tips": [
      "Documents are scoped to the selected company (Entity)."
    ],
    "faq": [
      {
        "q": "Who can delete documents?",
        "a": "Deleting is admin-only; HR can upload and download."
      },
      {
        "q": "Are files kept safely?",
        "a": "Yes — stored on persistent storage that survives redeploys."
      }
    ],
    "related": [
      "legal-letters",
      "companies"
    ]
  },
  {
    "id": "payroll",
    "route": "/payroll",
    "group": "compliance",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Calculator",
    "title": "Payroll & Labor Law",
    "overview": "UAE labor-law calculators and reference tables across five tabs: Exit Settlement Calculator (EOSB per Federal Decree-Law No. 33 of 2021), Work Permit & Visa Law, Absence & Lateness, Attendance Report, and the Exit Decision Matrix. This is distinct from the monthly Payroll Runs.",
    "whenToUse": "For settlements at exit and to understand UAE deduction and visa rules — separate from monthly salary processing.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Pick a tab",
        "Enter employee data",
        "Calculate",
        "Review result"
      ]
    },
    "images": [
      {
        "src": "payroll-law.jpg",
        "caption": "Exit Settlement Calculator (UAE Federal Decree-Law No. 33 of 2021): wages, start/last-working dates, exit type, visa type, unused leave, unpaid days, notice and deductions → Calculate Final Settlement."
      },
      {
        "src": "payroll-labour-law-work-permit-only-vs-full-employer-sponsored-visa.jpg",
        "caption": "Work Permit & Visa Law: a reference comparing a work-permit-only arrangement vs. a full employer-sponsored visa."
      },
      {
        "src": "payroll-labour-law-work-permit-only-vs-absence-lateness.jpg",
        "caption": "Absence & Lateness: the rules used to derive deductions from absence and lateness."
      },
      {
        "src": "payroll-labour-law-attendance-report.jpg",
        "caption": "Attendance Report: an attendance-based summary that supports payroll and labor-law decisions."
      },
      {
        "src": "payroll-labour-law-exit-decision-matrix.jpg",
        "caption": "Exit Decision Matrix: a reference matrix for exit scenarios and their entitlements."
      }
    ],
    "steps": [
      {
        "title": "Open the right tab",
        "detail": "Choose Exit Settlement, Work Permit & Visa, Absence & Lateness, Attendance Report or Exit Decision Matrix."
      },
      {
        "title": "Enter inputs",
        "detail": "For EOSB: basic/full wage, start & last working day, exit & visa type, unused leave, unpaid days, notice and deductions."
      },
      {
        "title": "Calculate & use",
        "detail": "Compute the final settlement and apply the figures in offboarding or the final settlement."
      }
    ],
    "tips": [
      "This is a calculator/reference; the actual monthly salary processing happens in Payroll Runs."
    ],
    "faq": [
      {
        "q": "Difference from Payroll Runs?",
        "a": "Payroll Runs computes monthly salaries; this page is for EOSB and UAE labor-law calculations and references."
      },
      {
        "q": "Which law does EOSB follow?",
        "a": "UAE Federal Decree-Law No. 33 of 2021, by tenure, contract/exit type and visa type."
      }
    ],
    "related": [
      "payroll-runs",
      "offboarding"
    ]
  },
  {
    "id": "reports",
    "route": "/reports",
    "group": "analytics",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "BarChart3",
    "title": "Reports",
    "overview": "Built-in reports — recruitment pipeline, candidate journey, employees overview and onboarding progress. Print or download each as a PDF (composed onto the company letterhead) or email it with a cover message.",
    "whenToUse": "For periodic insight into recruitment and workforce, and to share snapshots.",
    "images": [
      {
        "src": "reports.jpg",
        "caption": "Reports: switch between the available reports, then Print / Download (PDF on letterhead) or Send by Email."
      }
    ],
    "steps": [
      {
        "title": "Pick a report",
        "detail": "Switch tabs between the available reports."
      },
      {
        "title": "Export",
        "detail": "Print/Download as PDF (composed onto the company letterhead) or email it."
      }
    ],
    "tips": [
      "Reports follow the selected Entity — switch company to compare."
    ],
    "faq": [
      {
        "q": "Can I email a report?",
        "a": "Yes — “Send by Email (PDF)” attaches it with a cover message."
      },
      {
        "q": "Why is a report empty?",
        "a": "No data exists for the selected company/period yet."
      }
    ],
    "related": [
      "dashboard",
      "kpi",
      "org-chart"
    ]
  },
  {
    "id": "kpi",
    "route": "/kpi",
    "group": "analytics",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Trophy",
    "title": "KPI Tracker",
    "overview": "Log hiring events against reward tiers, confirm hires, and view summary stats (total hires, fulfilled tiers, rewards). Tiers (amount, icon, label) are configurable in System Config.",
    "whenToUse": "To track recruitment KPIs and tier-based rewards for hires.",
    "diagram": {
      "type": "flow",
      "steps": [
        "Create tiers",
        "Log a hire",
        "Assign tier",
        "Confirm",
        "Summary stats"
      ]
    },
    "images": [
      {
        "src": "kpi.jpg",
        "caption": "KPI Tracker: logged hires against reward tiers, with summary stats for hires, fulfilled tiers and rewards."
      },
      {
        "src": "kpi-tracker-log-hire.jpg",
        "caption": "Log a hire: record the hire event and assign the reward tier(s)."
      }
    ],
    "steps": [
      {
        "title": "Create tiers",
        "detail": "Define reward tiers with an amount, icon and label (System Config → KPI Tiers)."
      },
      {
        "title": "Log & confirm hires",
        "detail": "Record a hire event, assign tier(s), and confirm it."
      },
      {
        "title": "Read the summary",
        "detail": "See totals: hires, fulfilled tiers and rewards."
      }
    ],
    "tips": [
      "Configure tiers first in System Config so hires can be assigned to them."
    ],
    "faq": [
      {
        "q": "How do I add a tier?",
        "a": "Create a KPI tier with its amount/label in System Config → KPI Tiers; then assign it when logging a hire."
      },
      {
        "q": "Can I delete a hire entry?",
        "a": "Yes — remove an entry from the list (admin)."
      }
    ],
    "related": [
      "performance",
      "reports",
      "system-config"
    ]
  },
  {
    "id": "audit",
    "route": "/audit",
    "group": "analytics",
    "roles": [
      "admin"
    ],
    "icon": "ClipboardList",
    "title": "Audit Log",
    "overview": "A complete trail of system actions — who did what, in which module, when, with details. Search and filter by module, and export as JSON. Admin only.",
    "whenToUse": "For security, compliance and troubleshooting — to see exactly what changed and by whom.",
    "images": [
      {
        "src": "audit.jpg",
        "caption": "Audit Log: searchable, module-filterable rows of every action (user, action, module, time, detail), with JSON export."
      }
    ],
    "steps": [
      {
        "title": "Search & filter",
        "detail": "Find entries by user, action or detail, and narrow by module."
      },
      {
        "title": "Export",
        "detail": "Export the filtered log as JSON for records or analysis."
      }
    ],
    "tips": [
      "Entries are recorded automatically for create/update/delete and key actions."
    ],
    "faq": [
      {
        "q": "Who can see the audit log?",
        "a": "Admins only."
      },
      {
        "q": "Is it scoped per company?",
        "a": "It records actions across the data the admin can access; a selected Entity narrows it."
      }
    ],
    "related": [
      "users",
      "email-log"
    ]
  },
  {
    "id": "email-log",
    "route": "/email-log",
    "group": "analytics",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Mail",
    "title": "Email Log",
    "overview": "A record of every outgoing email with its delivery status (Sent / Failed / Queued), recipient, subject, related module and timestamp. Open any entry for the full content that was sent.",
    "whenToUse": "To confirm an email was sent and to troubleshoot delivery problems.",
    "images": [
      {
        "src": "email-log.jpg",
        "caption": "Email Log: outgoing emails with status, recipient, subject and module; filter by status and module or search."
      },
      {
        "src": "email-log-1.jpg",
        "caption": "Open an entry to read the full email content and metadata."
      }
    ],
    "steps": [
      {
        "title": "Search & filter",
        "detail": "Filter by status (Sent/Failed/Queued) and related module, or search by recipient/subject."
      },
      {
        "title": "Open a detail",
        "detail": "View the full email content and metadata."
      }
    ],
    "tips": [
      "If many emails show Failed, check the SMTP configuration in Settings → Email."
    ],
    "faq": [
      {
        "q": "An email failed — what now?",
        "a": "Open it to see the error; verify SMTP settings and resend from the source action."
      },
      {
        "q": "Does it store the email body?",
        "a": "Yes — the detail view shows the full content that was sent."
      }
    ],
    "related": [
      "email-settings",
      "send-documents"
    ]
  },
  {
    "id": "report-schedules",
    "route": "/settings/report-schedules",
    "group": "analytics",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "CalendarClock",
    "title": "Scheduled reports",
    "overview": "A report emailed as an Excel file on a schedule (every day, a weekday, or a day of the month, at an hour in the app’s time zone) to the people you list. Reports: headcount, documents expiring within 60 days, leave in the next 14 days, and yesterday’s absences and late arrivals.",
    "whenToUse": "When managers want a regular summary without opening the system.",
    "images": [
      {
        "src": "settings-report-schedules.jpg",
        "caption": "Settings → Scheduled reports: a new schedule being filled in."
      }
    ],
    "steps": [
      {
        "title": "New schedule",
        "detail": "Name it and choose the report."
      },
      {
        "title": "When",
        "detail": "Every day, every week on a weekday, or every month on a day; and the hour."
      },
      {
        "title": "Recipients",
        "detail": "Email addresses separated by commas (up to 20)."
      },
      {
        "title": "Company",
        "detail": "The current entity, or All companies."
      },
      {
        "title": "Send now",
        "detail": "Sends it immediately to check what recipients receive; the schedule is not moved."
      }
    ],
    "tips": [
      "A day-31 monthly report goes out on the last day of shorter months.",
      "Each send is recorded in the Email Log."
    ],
    "faq": [
      {
        "q": "A report did not arrive.",
        "a": "Check the Email Log for the error, and that email sending is configured in Settings → Email."
      }
    ],
    "related": [
      "reports",
      "email-log",
      "email-settings"
    ]
  },
  {
    "id": "users",
    "route": "/users",
    "group": "operations",
    "roles": [
      "admin"
    ],
    "icon": "UserCog",
    "title": "Users",
    "overview": "The accounts that can sign in, each with a role, a company and an active switch. Admins create users, reset passwords, deactivate accounts and can log in as a user to see what they see.",
    "whenToUse": "When someone needs access, changes job, or leaves.",
    "images": [
      {
        "src": "users.jpg",
        "caption": "User Management: users with role, company and status (names blurred)."
      },
      {
        "src": "user-management-add-user.jpg",
        "caption": "Add user: username, name, email, password and role; assign a company/department where relevant."
      }
    ],
    "steps": [
      {
        "title": "Add User",
        "detail": "Name, username, email, role, company (and department), and a password."
      },
      {
        "title": "Pick the role",
        "detail": "admin, hr_manager, hr_specialist, accountant, recruiter or employee; the hint under the role says what it opens."
      },
      {
        "title": "Portal logins for employees",
        "detail": "Are best created from the employee record (Add Employee wizard → System Access), so the login belongs to that employee."
      },
      {
        "title": "Reset or deactivate",
        "detail": "Reset password, or switch the user off when they leave."
      },
      {
        "title": "Log in as",
        "detail": "See the system exactly as that user does; a banner shows whose account you are in, and you return with one click."
      }
    ],
    "tips": [
      "Admin accounts cannot be impersonated.",
      "What each role opens can be changed in Settings → Roles and permissions."
    ],
    "faq": [
      {
        "q": "An employee sees an empty portal.",
        "a": "Their login is not tied to an employee record; create it from the employee record instead."
      },
      {
        "q": "Can HR create users?",
        "a": "No, user management is for admins."
      }
    ],
    "related": [
      "roles",
      "employees"
    ]
  },
  {
    "id": "companies",
    "route": "/settings/companies",
    "group": "operations",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Building2",
    "title": "Companies",
    "overview": "Manage the companies (entities) in the organization: name, short code, currency, brand colors, logo, and the A4 letterhead used on generated PDFs. Admins add/edit/delete; HR views only.",
    "whenToUse": "To set up each company and its branding/letterhead before issuing documents.",
    "images": [
      {
        "src": "settings-companies.jpg",
        "caption": "Settings → Companies: company cards with code, currency and logo. Admins manage them; HR sees them read-only."
      },
      {
        "src": "settings-companies-add-company.jpg",
        "caption": "Add company (admin): name, short code, currency, industry, contact, logo and brand colors."
      },
      {
        "src": "settings-companies-edit-company.jpg",
        "caption": "Edit company: details, brand colors, and upload the A4 letterhead with content margins (mm) used on generated PDFs."
      }
    ],
    "steps": [
      {
        "title": "Create a company",
        "detail": "Admin: add name, short code, currency, industry, contact, logo and brand colors."
      },
      {
        "title": "Upload a letterhead",
        "detail": "In the company edit form, upload an A4 letterhead (PDF/PNG/JPG) and set content margins (mm)."
      },
      {
        "title": "Tune margins",
        "detail": "Adjust top/bottom/left/right so document text sits clear of the header/footer."
      }
    ],
    "tips": [
      "Letterhead and company create/edit/delete are admin-only; HR sees companies read-only.",
      "After uploading a letterhead, generate a document to preview and fine-tune the margins."
    ],
    "faq": [
      {
        "q": "Why can’t HR add a company?",
        "a": "By design — company create/edit/delete is admin-only; HR has view access."
      },
      {
        "q": "Where is the letterhead used?",
        "a": "On generated legal letters, offers, receipts and reports when you send/print them as PDF."
      },
      {
        "q": "The letterhead overlaps text.",
        "a": "Increase the top margin for that company and re-preview."
      }
    ],
    "related": [
      "send-documents",
      "legal-letters",
      "roles"
    ]
  },
  {
    "id": "departments",
    "route": "/settings/departments",
    "group": "operations",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Network",
    "title": "Departments & Titles",
    "overview": "Manage each company’s departments and the job titles within them — including seniorities with salary bands and required skills.",
    "whenToUse": "To define the org structure used across employees, vacancies and the org chart.",
    "images": [
      {
        "src": "settings-departments.jpg",
        "caption": "Settings → Departments & Titles: departments per company; expand one to manage its job titles."
      },
      {
        "src": "settings-departments-create-department.jpg",
        "caption": "Create a department for the selected company."
      },
      {
        "src": "settings-departments-create-job-title.jpg",
        "caption": "Create a job title under a department, with seniorities, salary bands and required skills."
      },
      {
        "src": "settings-departments-edit-job-title.jpg",
        "caption": "Edit a job title’s seniorities, salary bands and skills."
      }
    ],
    "steps": [
      {
        "title": "Pick the company",
        "detail": "Departments are per company."
      },
      {
        "title": "Add departments",
        "detail": "Create departments, then expand to manage their job titles."
      },
      {
        "title": "Define titles",
        "detail": "Add job titles with seniorities, salary bands and required skills."
      }
    ],
    "tips": [
      "This structure feeds the Org Chart and employee/vacancy assignment."
    ],
    "faq": [
      {
        "q": "Who can delete a department?",
        "a": "Admins; HR can add/edit."
      },
      {
        "q": "Where do job titles appear?",
        "a": "When assigning roles to employees and on the org chart."
      }
    ],
    "related": [
      "org-chart",
      "skills",
      "employees"
    ]
  },
  {
    "id": "skills",
    "route": "/settings/skills",
    "group": "operations",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "Wrench",
    "title": "Skills Library",
    "overview": "Maintain skill categories and individual skills used for evaluating candidates and employees, and for CV scoring and job-title definitions.",
    "whenToUse": "To curate the skills referenced in CV scoring, job titles and evaluations.",
    "images": [
      {
        "src": "settings-skills.jpg",
        "caption": "Settings → Skills Library: expandable skill categories, each holding individual skills used across the system."
      }
    ],
    "steps": [
      {
        "title": "Create categories",
        "detail": "Group skills under categories."
      },
      {
        "title": "Add skills",
        "detail": "Add individual skills under each category."
      }
    ],
    "tips": [
      "Well-organized skills improve CV scoring and job-title definitions."
    ],
    "faq": [
      {
        "q": "Where are skills used?",
        "a": "In CV Scorer profiles, job titles and candidate evaluations."
      },
      {
        "q": "Who can delete skills?",
        "a": "Admins; HR can add/edit."
      }
    ],
    "related": [
      "cv-scorer",
      "departments"
    ]
  },
  {
    "id": "work-schedules",
    "route": "/settings/work-schedules",
    "group": "operations",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "CalendarClock",
    "title": "Work schedules and holidays",
    "overview": "The weekly working pattern used to judge attendance: which days are working days, start and end times, break and grace period. Each company has a default schedule; employees can be given another one from a date. The Coverage tab shows who has which schedule, and Holidays lists public holidays that are never absences.",
    "whenToUse": "When setting up a company, changing hours (e.g. Ramadan), or adding the year’s public holidays.",
    "images": [
      {
        "src": "settings-work-schedules.jpg",
        "caption": "Settings → Work Schedules: schedules per company, coverage and holidays."
      }
    ],
    "steps": [
      {
        "title": "Add Schedule",
        "detail": "Name it and set each weekday: working or rest, start, end, break and grace minutes."
      },
      {
        "title": "Set the default",
        "detail": "One default per company; anyone without their own schedule uses it."
      },
      {
        "title": "Assign people",
        "detail": "On the employee’s Work schedule tab, from a date."
      },
      {
        "title": "Coverage",
        "detail": "Check nobody is left without a schedule."
      },
      {
        "title": "Holidays",
        "detail": "Add public holidays; they are never counted as absence."
      }
    ],
    "tips": [
      "For one-off changes on a date (a swapped day off, a night shift), use the Roster instead."
    ],
    "faq": [
      {
        "q": "Why is someone late at 9:05?",
        "a": "Their schedule starts at 9:00 with less than 5 minutes’ grace."
      }
    ],
    "related": [
      "attendance-roster",
      "attendance",
      "attendance-board"
    ]
  },
  {
    "id": "backups",
    "route": "/settings/backups",
    "group": "operations",
    "roles": [
      "admin"
    ],
    "icon": "DatabaseBackup",
    "title": "Nightly backup",
    "overview": "Every night at 02:30 the whole database (structure and rows) is saved, compressed, to the server’s persistent volume, keeping the newest 14. The platform admin can run one now and download any copy.",
    "whenToUse": "Before a big change (an import, a bulk delete), and to keep a copy off the server.",
    "images": [
      {
        "src": "settings-backups.jpg",
        "caption": "Settings → Backups: the schedule, Back up now, and the copies."
      }
    ],
    "steps": [
      {
        "title": "Back up now",
        "detail": "Writes a copy immediately."
      },
      {
        "title": "Download",
        "detail": "Save a copy somewhere safe off the server when needed."
      }
    ],
    "tips": [
      "These copies sit on the same server. Protection against losing the server needs an off-site copy (for example the database backup to S3 in Coolify).",
      "Copies hold every company’s data, password hashes included, so only the platform admin sees them."
    ],
    "faq": [
      {
        "q": "How do I restore?",
        "a": "Restoring a full copy is done by the system administrator on the server; ask before overwriting live data."
      }
    ],
    "related": [
      "system-config"
    ]
  },
  {
    "id": "system-config",
    "route": "/settings/system",
    "group": "operations",
    "roles": [
      "admin"
    ],
    "icon": "Settings",
    "title": "System Config",
    "overview": "Admin configuration across five tabs: ATS Stages (the recruitment pipeline order), Onboarding Templates, Offboarding Templates, Letter Templates, and KPI Tiers. Changes here shape the ATS board, the onboarding/offboarding flows, the letters you can generate, and KPI rewards. Admin only.",
    "whenToUse": "To tailor the system’s workflows and templates to your processes.",
    "images": [
      {
        "src": "settings-system.jpg",
        "caption": "ATS Stages: define, color and reorder the recruitment pipeline stages (drag to reorder; mark Default / Success / Fail)."
      },
      {
        "src": "settings-system-config-ats-stages-add-stage.jpg",
        "caption": "Add an ATS stage with its name, color and outcome type."
      },
      {
        "src": "settings-system-config-onboarding-templates.jpg",
        "caption": "Onboarding Templates: the stages/steps used by the stage-based onboarding workflow."
      },
      {
        "src": "settings-system-config-offboarding-templates.jpg",
        "caption": "Offboarding Templates: the checklist steps used by the exit workflow."
      },
      {
        "src": "settings-system-config-letter-templates.jpg",
        "caption": "Letter Templates: the letter types available in Legal Letters; add or edit your own."
      },
      {
        "src": "settings-system-config-kpi-tiers.jpg",
        "caption": "KPI Tiers: the reward tiers (amount, icon, label) used by the KPI Tracker."
      }
    ],
    "steps": [
      {
        "title": "Configure ATS stages",
        "detail": "Reorder/define the recruitment pipeline stages used on the ATS board."
      },
      {
        "title": "Set workflow templates",
        "detail": "Configure onboarding/offboarding stages & templates and letter templates."
      },
      {
        "title": "Manage KPI tiers",
        "detail": "Define the reward tiers used by the KPI Tracker."
      }
    ],
    "tips": [
      "Changes here affect the ATS board, onboarding/offboarding flows, letters and KPI tracking across the app."
    ],
    "faq": [
      {
        "q": "Why admin-only?",
        "a": "It changes core workflow structure, so it is restricted to admins."
      },
      {
        "q": "Will reordering ATS stages affect existing candidates?",
        "a": "Candidates keep their stage; the board simply reflects the new order."
      }
    ],
    "related": [
      "ats",
      "kpi",
      "templates"
    ]
  },
  {
    "id": "email-settings",
    "route": "/settings/email",
    "group": "operations",
    "roles": [
      "admin"
    ],
    "icon": "Mail",
    "title": "Email Settings (SMTP)",
    "overview": "Configure the outgoing email server (SMTP host, port, credentials, sender identity), test the connection, and enable/disable sending. Admin only.",
    "whenToUse": "Once during setup so the system can send offers, letters, notifications and documents.",
    "images": [
      {
        "src": "settings-email.jpg",
        "caption": "Settings → Email: SMTP host & port, username & password, sender identity, a Test Connection button, and the enable-sending switch."
      }
    ],
    "steps": [
      {
        "title": "Enter SMTP details",
        "detail": "Host, port, username, password and the From/Reply-To identity."
      },
      {
        "title": "Test the connection",
        "detail": "Re-enter the password and click Test Connection to verify before saving."
      },
      {
        "title": "Save & enable",
        "detail": "Save the configuration and keep “Enable Email Sending” on."
      }
    ],
    "tips": [
      "Port 465 = implicit TLS; port 587 = STARTTLS — the system selects the right mode by port automatically.",
      "Re-type the SMTP password to test/verify; it is stored encrypted."
    ],
    "faq": [
      {
        "q": "“Missing credentials” error?",
        "a": "Re-enter the SMTP password in the field and save; it must be supplied to authenticate."
      },
      {
        "q": "“Wrong version number” error?",
        "a": "A port/TLS mismatch — the system derives TLS from the port; use 465 (TLS) or 587 (STARTTLS)."
      },
      {
        "q": "Why is the Email tab hidden for me?",
        "a": "Email & System Config are admin-only."
      }
    ],
    "related": [
      "email-log",
      "send-documents",
      "templates"
    ]
  },
  {
    "id": "templates",
    "route": "/settings/templates",
    "group": "operations",
    "roles": [
      "admin",
      "hr_manager"
    ],
    "icon": "FileText",
    "title": "Email Templates",
    "overview": "Preview and manage the email templates the system uses (candidate received, leave approved, onboarding stage, offer letter, document delivery, etc.) and the variables each supports.",
    "whenToUse": "To review or adjust the wording of automated and manual emails.",
    "images": [
      {
        "src": "settings-templates.jpg",
        "caption": "Settings → Templates: the email templates used across recruitment, onboarding, leave and assets — preview each one."
      },
      {
        "src": "settings-email-template-manager-template-key.jpg",
        "caption": "Each template has a key and a set of variables it supports; preview how it renders with sample data."
      }
    ],
    "steps": [
      {
        "title": "Browse templates",
        "detail": "See all templates used across recruitment, onboarding, leave, assets, etc."
      },
      {
        "title": "Preview",
        "detail": "Preview how a template renders with sample data and its variables."
      }
    ],
    "tips": [
      "Use the 📧 buttons across the app to send messages built from these templates."
    ],
    "faq": [
      {
        "q": "Where are these templates sent from?",
        "a": "Various modules trigger them automatically, and you can send some manually via the email buttons."
      },
      {
        "q": "Can I change variables?",
        "a": "You can manage template content and the variables it supports."
      }
    ],
    "related": [
      "email-settings",
      "email-log",
      "system-config"
    ]
  },
  {
    "id": "my-assets",
    "route": "/portal/my-assets",
    "group": "portal",
    "roles": [
      "employee",
      "admin",
      "hr_manager"
    ],
    "icon": "Shield",
    "title": "My Assets & Accounts",
    "overview": "Your personal self-service view: the hardware assigned to you and the software/account credentials issued to you. Reveal a password briefly (it auto-hides) and copy your credentials.",
    "whenToUse": "To check what equipment and accounts you have, and to retrieve your login details.",
    "images": [
      {
        "src": "portal-my-assets.jpg",
        "caption": "My Assets & Accounts: the devices assigned to you and your account credentials — reveal a password briefly or copy username/password."
      }
    ],
    "steps": [
      {
        "title": "View your devices",
        "detail": "See the hardware assigned to you with its serial/code."
      },
      {
        "title": "Get account credentials",
        "detail": "For accounts, reveal the password (it hides automatically) or copy username/password."
      }
    ],
    "tips": [
      "Passwords are revealed only briefly for security; copy them rather than leaving them on screen."
    ],
    "faq": [
      {
        "q": "I see “No assets assigned”.",
        "a": "Nothing has been assigned to you yet — contact HR."
      },
      {
        "q": "Why does the password hide itself?",
        "a": "For security, revealed passwords auto-hide after a few seconds."
      },
      {
        "q": "Can I edit my assets here?",
        "a": "No — this is a read-only personal view; HR manages assignments."
      }
    ],
    "related": [
      "assets"
    ]
  },
  {
    "id": "portal-attendance",
    "route": "/portal/attendance",
    "group": "portal",
    "roles": null,
    "icon": "Clock",
    "title": "My Attendance",
    "overview": "Your daily record month by month: check in and out, hours, status and notes, with a summary of present, late and absent days. When an admin has switched portal clock-in on for you, a Clock in card appears at the top.",
    "whenToUse": "To check your own attendance, or clock in when you work away from the office.",
    "images": [
      {
        "src": "portal-attendance.jpg",
        "caption": "My Attendance: the month, the summary and the daily record."
      }
    ],
    "steps": [
      {
        "title": "Pick the month",
        "detail": "Use the month selector."
      },
      {
        "title": "Read the summary",
        "detail": "Present, late, absent and total hours."
      },
      {
        "title": "Clock in (if enabled)",
        "detail": "Click Clock in, allow your location, and Clock out at the end of the day."
      },
      {
        "title": "Download PDF",
        "detail": "A bilingual attendance statement."
      }
    ],
    "tips": [
      "If a day looks wrong, raise an HR case from My Requests."
    ],
    "faq": [
      {
        "q": "Why is there no Clock in button?",
        "a": "Portal clock-in is off for you; the office door records your attendance."
      }
    ],
    "related": [
      "clock-in",
      "portal-requests"
    ]
  },
  {
    "id": "portal-salary",
    "route": "/portal/salary",
    "group": "portal",
    "roles": null,
    "icon": "Banknote",
    "title": "My Salary",
    "overview": "Every payment you have received, from approved payroll runs: basic, allowances, gross, deductions and net per period, with each payslip itemised line by line.",
    "whenToUse": "To check a payslip or download a salary statement.",
    "images": [
      {
        "src": "portal-salary.jpg",
        "caption": "My Salary: payments by period."
      }
    ],
    "steps": [
      {
        "title": "Open a period",
        "detail": "See each line of the payslip and how it was worked out."
      },
      {
        "title": "Download PDF",
        "detail": "A bilingual salary statement."
      }
    ],
    "tips": [
      "A salary certificate for a bank or embassy is requested from My Requests."
    ],
    "faq": [
      {
        "q": "This month is missing.",
        "a": "Payslips appear once the run is approved."
      }
    ],
    "related": [
      "payroll-runs",
      "portal-requests"
    ]
  },
  {
    "id": "portal-leave",
    "route": "/portal/leave",
    "group": "portal",
    "roles": null,
    "icon": "CalendarDays",
    "title": "My Leave",
    "overview": "Your balance per leave type (entitled, used, remaining), your leave history, and a new request. The request shows the days that will count before you send it; part of a day can be taken by the hour.",
    "whenToUse": "To ask for leave or check how many days you have left.",
    "images": [
      {
        "src": "portal-leave.jpg",
        "caption": "My Leave: entitlement, history and Request leave."
      }
    ],
    "steps": [
      {
        "title": "Request leave",
        "detail": "Choose the type and dates (or hours), add a reason and attachments if needed."
      },
      {
        "title": "Check the preview",
        "detail": "The days that count against your balance, excluding rest days for working-day types."
      },
      {
        "title": "Send",
        "detail": "It goes to your manager if an approval chain is set, then HR."
      },
      {
        "title": "Follow it",
        "detail": "The status and who approved it appear in the history."
      }
    ],
    "tips": [
      "Sick leave may need a medical certificate attached."
    ],
    "faq": [
      {
        "q": "Can I cancel a request?",
        "a": "While it is pending, yes."
      }
    ],
    "related": [
      "leave",
      "approval-chains"
    ]
  },
  {
    "id": "portal-requests",
    "route": "/portal/requests",
    "group": "portal",
    "roles": null,
    "icon": "Inbox",
    "title": "My Requests",
    "overview": "Ask HR for a letter (salary certificate, NOC, employment confirmation, experience certificate), claim an expense, ask for a salary advance, or open an HR case. Each request has a conversation and attachments.",
    "whenToUse": "Whenever you need something from HR.",
    "images": [
      {
        "src": "portal-requests.jpg",
        "caption": "My Requests: your requests and New request."
      }
    ],
    "steps": [
      {
        "title": "New request",
        "detail": "Choose the type and write the details."
      },
      {
        "title": "Attach files",
        "detail": "Receipts for an expense, any supporting document."
      },
      {
        "title": "Follow the conversation",
        "detail": "HR replies on the request; you are notified."
      },
      {
        "title": "Download the letter",
        "detail": "When HR uploads it, download it from the request."
      }
    ],
    "tips": [
      "An approved expense is paid with your next salary; an advance is deducted in instalments."
    ],
    "faq": [
      {
        "q": "Who sees my request?",
        "a": "Your approvers (if a chain applies) and HR."
      }
    ],
    "related": [
      "employee-requests",
      "approval-chains"
    ]
  },
  {
    "id": "portal-approvals",
    "route": "/portal/approvals",
    "group": "portal",
    "roles": null,
    "icon": "CheckSquare",
    "title": "My Approvals",
    "overview": "Requests waiting for your decision because you are a step in their approval chain: leave, overtime, expenses, advances and hiring requests.",
    "whenToUse": "Whenever you are notified that something waits for you.",
    "images": [
      {
        "src": "portal-approvals.jpg",
        "caption": "My Approvals: what is waiting for you."
      }
    ],
    "steps": [
      {
        "title": "Open a request",
        "detail": "Read it, with the context shown (for leave: who else is off, visa expiry)."
      },
      {
        "title": "Approve or reject",
        "detail": "Add a comment; a rejection ends the request."
      }
    ],
    "tips": [
      "After the last step, HR makes the final decision."
    ],
    "faq": [
      {
        "q": "Why is the menu item missing?",
        "a": "It appears when you manage people or have a decision waiting."
      }
    ],
    "related": [
      "approval-chains",
      "portal-team"
    ]
  },
  {
    "id": "portal-team",
    "route": "/portal/team",
    "group": "portal",
    "roles": null,
    "icon": "Users",
    "title": "My Team",
    "overview": "For managers: the people who report to you, today’s attendance and their upcoming leave. Salaries are not shown.",
    "whenToUse": "To plan the team’s day and week.",
    "images": [
      {
        "src": "portal-team.jpg",
        "caption": "My Team (names blurred)."
      }
    ],
    "steps": [
      {
        "title": "See today",
        "detail": "Who is in, late or off."
      },
      {
        "title": "Upcoming leave",
        "detail": "Who is away in the coming days."
      }
    ],
    "tips": [
      "Your team comes from the direct manager set on each profile; ask HR if someone is missing."
    ],
    "faq": [
      {
        "q": "I manage people but the page is empty.",
        "a": "No employee has you as their direct manager yet."
      }
    ],
    "related": [
      "org-chart",
      "portal-approvals"
    ]
  },
  {
    "id": "portal-reviews",
    "route": "/portal/reviews",
    "group": "portal",
    "roles": null,
    "icon": "ClipboardCheck",
    "title": "My Reviews",
    "overview": "Your appraisals, and your team’s when you manage people: complete your self review, then managers rate and recommend.",
    "whenToUse": "During an appraisal cycle.",
    "images": [
      {
        "src": "portal-reviews.jpg",
        "caption": "My Reviews."
      }
    ],
    "steps": [
      {
        "title": "Open your review",
        "detail": "Set goals and their weights, then rate yourself and submit."
      },
      {
        "title": "As a manager",
        "detail": "Open each team member’s review, rate each goal and write your recommendation."
      }
    ],
    "tips": [
      "Weights should add up to 100%."
    ],
    "faq": [
      {
        "q": "Can I change my self review after submitting?",
        "a": "No; ask HR to send it back if needed."
      }
    ],
    "related": [
      "reviews"
    ]
  },
  {
    "id": "portal-announcements",
    "route": "/portal/announcements",
    "group": "portal",
    "roles": null,
    "icon": "Megaphone",
    "title": "Announcements",
    "overview": "News and notices from HR. Opening one marks it as read.",
    "whenToUse": "When you are notified of a new announcement.",
    "images": [
      {
        "src": "portal-announcements.jpg",
        "caption": "Announcements."
      }
    ],
    "steps": [
      {
        "title": "Open the announcement",
        "detail": "Read it; HR sees that you have."
      }
    ],
    "tips": [],
    "faq": [],
    "related": [
      "communications"
    ]
  },
  {
    "id": "portal-policies",
    "route": "/portal/policies",
    "group": "portal",
    "roles": null,
    "icon": "FileText",
    "title": "Policies",
    "overview": "Company policies to read, and acknowledge where required. A new version asks you to acknowledge again.",
    "whenToUse": "When a policy is published or updated.",
    "images": [
      {
        "src": "portal-policies.jpg",
        "caption": "Policies: read and acknowledge."
      }
    ],
    "steps": [
      {
        "title": "Open the policy",
        "detail": "Read it in full."
      },
      {
        "title": "Acknowledge",
        "detail": "Click acknowledge to confirm you have read and accept it."
      }
    ],
    "tips": [
      "Your acknowledgement is kept with the policy version."
    ],
    "faq": [],
    "related": [
      "communications"
    ]
  },
  {
    "id": "portal-benefits",
    "route": "/portal/benefits",
    "group": "portal",
    "roles": null,
    "icon": "HeartHandshake",
    "title": "My Benefits",
    "overview": "Your medical cover (insurer, plan, card number, dates), your covered dependents, and your air ticket entitlement with when the next one is due.",
    "whenToUse": "Before a doctor’s visit or planning travel.",
    "images": [
      {
        "src": "portal-benefits.jpg",
        "caption": "My Benefits."
      }
    ],
    "steps": [
      {
        "title": "Check your cover",
        "detail": "Insurer, category, card number and validity."
      },
      {
        "title": "Check your ticket",
        "detail": "Entitlement and the next due date."
      }
    ],
    "tips": [
      "Report a missing dependent to HR through My Requests."
    ],
    "faq": [],
    "related": [
      "benefits"
    ]
  }
];

export default articles;
