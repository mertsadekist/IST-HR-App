# IST HR System — User Guide for Established Companies

> This guide is written for a company that has been **operating for more than a year** and already has existing employees, equipment, and accounts, and now wants to migrate its historical data into the system and then run it fully.
>
> Recommended order: **Set up the company → Assets & Equipment → existing employees → full operation.**

---

## 0. Login & Core Concepts

1. Open the system URL in your browser.
2. Sign in with the default admin account: **username `admin` / password `admin123`**.
   - ⚠️ **Mandatory first action:** change the admin password from **Users** (explained below) before doing anything else.
3. **Language:** switch between Arabic and English from the top bar (Topbar).

### The "Entity" concept (very important)
At the top of the sidebar is the **Entity switcher** — a dropdown to choose the company you are working on.
- **A company must always be selected** (there is no "All" option).
- Everything you add (employees, assets, inventory, leave…) is saved under the **currently selected company**.
- When managing more than one company, switch the Entity at the top before entering that company's data.

### Roles
| Role | Permissions |
|---|---|
| **admin** | Everything: settings, users, all companies |
| **hr_manager** | Manage employees, assets, leave, payroll, documents |
| **recruiter** | Recruitment only (candidates, vacancies, ATS) |
| **employee** | Personal portal only (their own assets & accounts) |

---

## 1. Set Up the Company (Settings → Companies)

> This is the first mandatory step, because all data is tied to a company.

1. Sidebar: **OPERATIONS → Settings → Companies tab**.
2. Click **+ Add Company** and fill in:

| Field | Notes |
|---|---|
| **Company Name** | Official company name (required) |
| **Short Code** | Short code e.g. `RE` or `IST` (required — shown on badges) |
| **Currency** | Currency (required) — AED, USD, EUR… |
| **Industry** | Sector (Real Estate, Finance, Technology…) |
| **Email / Phone / Website** | Official contact details |
| **CRM Platform** | Your CRM platform if any |
| **Company Logo** | Company logo (≤ 2MB) — appears in the UI and documents |
| **Address** | Address |
| **Brand Color / Secondary** | Brand colors (used across UI, emails, documents) |
| **Status** | Active / Inactive |

3. Click **Add**. Repeat for every company you have.
4. **After creation:** go to the top of the sidebar and pick the company from the **Entity switcher**.

---

## 2. Define the Base Structure (before importing data)

In **Settings**, complete the following tabs for each company:

### 2.1 Departments
- **Settings → Departments**: add the company's departments (Sales, Finance, Marketing, Operations…). Employees are linked to these.

### 2.2 Skills
- **Settings → Skills**: define the skills you use to evaluate employees and candidates (optional but useful).

### 2.3 Email setup — recommended early
- **Settings → Email**: enter your SMTP details so the system can send offers, HR letters, and candidate notifications. Click **Verify** to confirm the connection works.

---

## 3. Add Assets & Equipment

The system has three connected layers — follow them in order:

### 3.1 Asset Catalog (Settings → Asset Catalog) — the definitions
Here you define the **types** of assets and accounts before entering the actual items.

1. **Create Categories:** add a category (e.g. "Laptops", "Phones", "Software Accounts") with an icon and color.
2. **Add Platforms/Types inside each category:** for each type set:
   - **Name** (e.g. "Dell Laptop", "Microsoft 365 Account", "Photoshop Subscription").
   - **Asset Type:** `Hardware` / `Account` / `Software`.
   - **Description**, **Status**, and the allowed companies (**company_ids**).

### 3.2 Inventory — the actual physical equipment
> Here you enter all the physical equipment that already exists in the company (purchased over the past year).

1. Sidebar: **HR MANAGEMENT → Inventory**.
2. Make sure the **Entity** is the correct company.
3. Click **+ Add** and fill in:

| Field | Notes |
|---|---|
| **Platform** | Pick the type from the catalog (3.1) |
| **Asset Code** | Internal code for the item |
| **Serial Number** | Serial number |
| **Brand / Model** | Brand and model |
| **Specifications** | Specs |
| **Purchase Date / Purchase Cost** | Purchase date and cost (enter the real historical values) |
| **Warranty Expiry** | Warranty end date |
| **Depreciation Rate** | Depreciation rate (for financial reports) |
| **Location** | Physical location |
| **Condition** | New / Good / Fair / Poor / Damaged |
| **Status** | Available / Assigned / In Repair / Retired / Lost |

4. Each item gets a printable **QR / Barcode** and keeps a **movement History**.
5. For items currently held by employees: enter them as **Available** now, and link them to the employee in Step 5 (after employees are added).

> **Summary:** Catalog = asset "types" · Inventory = the actual "items" · Assets = "handing over" an item/account to an employee (Step 5).

---

## 4. Add Existing (Current) Employees

> Goal: enter every employee currently working for you with their historical data (original start date, salary, documents).

1. Sidebar: **HR MANAGEMENT → Employees**.
2. Confirm the correct **Entity**.
3. Click **+ Add Employee** to open the **Add Wizard**:

   **a) Document upload + AI (optional, helpful):** upload the CV or passport and the AI will automatically extract and pre-fill name/email/phone/nationality.

   **b) Personal data:** first and last name, email, phone, nationality.

   **c) Job data:**
   - **Company** and **Department**.
   - **Job Title**.
   - **Basic Salary / Full Salary**.
   - **Start Date:** ⚠️ enter the **real original start date** (not today's date) — this is essential for accurate end-of-service (EOSB) and seniority calculations.
   - **Status:** set to **Active** for current employees.

   **d) Assets (optional):** you may select catalog assets to hand over immediately.

   **e) Create login account (Create User):** enable this if the employee should access their personal portal (My Portal).

4. Click finish. Repeat for each employee.
5. **Upload historical documents:** open the employee profile → **Documents** tab → upload old contracts, ID, visa, certificates… categorized by type. They are stored securely on persistent storage.

> **Bulk-entry tip:** start with active employees, department by department, and double-check the start date and salary of each before moving to full operation.

---

## 5. Link Assets & Accounts to Employees (Handover)

After entering employees and inventory, link each item/account to its holder:

1. Sidebar: **HR MANAGEMENT → Assets**.
2. Click **+ Add** and choose:
   - **Employee** (the recipient) and **Company**.
   - **Asset Type:** Hardware / Account / Software.
   - For hardware: pick the item from **Inventory** (its status auto-changes to Assigned).
   - For accounts: enter **Username / Password / URL** — the **password is stored encrypted** (AES-256) and revealed only with permission.
   - **Issued Date**.
3. **Handover Receipt:** you can print it or upload a signed copy for each handover.
4. On return later: use the **Return** button and set the condition of the returned item.

---

## 6. Start Full Operation

Once the historical import is complete, run the day-to-day modules:

### 6.1 Leave
- **HR MANAGEMENT → Leave:** record leave requests, approve/reject, track balances.

### 6.2 Attendance
- **HR MANAGEMENT → Attendance:** record check-in/out and track absence.

### 6.3 Payroll Runs
- **HR MANAGEMENT → Payroll Runs:** create a monthly payroll run, compute salaries, allowances and deductions, and approve it.
- **COMPLIANCE → Payroll & Law:** legal reference and end-of-service (EOSB) calculation.

### 6.4 Performance & KPIs
- **HR MANAGEMENT → Performance:** performance review cycles.
- **ANALYTICS → KPI Tracker:** track performance indicators.

### 6.5 Documents & Legal Letters
- **COMPLIANCE → Legal Letters:** issue letters (salary certificate, employment letter…) from ready templates.
- **COMPLIANCE → Company Docs:** archive official company documents.
- **Settings → Templates:** edit letter and email templates.

### 6.6 Recruitment
- **Vacancies:** create open positions. Each has a **public Careers application page** you can publish in external campaigns.
- **Applicants / ATS Pipeline:** receive applicants and move them through hiring stages (interviews, evaluations).
- **Candidates / CV Scorer:** read and score CVs with AI.
- **Convert to hire:** when a candidate is accepted, they convert into an employee and enter the Onboarding flow.

### 6.7 Onboarding (new hires)
- **HR MANAGEMENT → Onboarding:** a multi-stage flow for new hires (CV → review → offer → signed offer → documents → visa → bank → completed); on completion the employee is automatically added to the Employees section.

### 6.8 Offboarding
- **HR MANAGEMENT → Offboarding:** employee exit flow, asset recovery, and final dues.

### 6.9 Reports & Audit
- **ANALYTICS → Reports:** comprehensive reports. **Org Chart:** the organizational structure.
- **ANALYTICS → Audit Log / Email Log:** a log of every action and email (admin only).

---

## 7. System Administration (Admin)

| Module | Path | Purpose |
|---|---|---|
| **Users** | OPERATIONS → Users | Create employee/HR accounts, set roles, change passwords |
| **System Config** | Settings → System Config | General settings |
| **Email** | Settings → Email | Configure and verify SMTP |
| **Templates** | Settings → Templates | Email and letter templates |

### Security & data protection
- Change the `admin` password immediately.
- Grant each user the **least privilege required**.
- Uploaded documents are stored on **persistent storage (`/data/uploads`)** that is not lost on redeploy.
- Enable periodic **backups** of the database and the file storage.

---

## 8. Quick Go-Live Checklist ✅

- [ ] Change the admin password.
- [ ] Create the company/companies + logo and colors.
- [ ] Add departments and skills.
- [ ] Configure and verify email (SMTP).
- [ ] Build the asset catalog (categories + types).
- [ ] Enter all equipment into Inventory.
- [ ] Enter all current employees with correct start dates and salaries.
- [ ] Upload historical documents for each employee.
- [ ] Link assets and accounts to employees.
- [ ] Create login accounts where needed and set roles.
- [ ] Begin Leave/Attendance/Payroll and daily operation.

> **Golden rule:** before any data entry, always confirm the **Entity** at the top is the correct company.
