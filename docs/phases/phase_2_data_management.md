# Phase 3: Data Management & Company Settings — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 3-4
> **Depends On**: Phase 1 (Backend API), Phase 2 (Frontend Infra)
> **Data Source**: MySQL via REST API (no localStorage)

---

## 2.1 — Company/Entity Management Page

### Page: `/settings/companies`

### UI Layout
```
┌─────────────────────────────────────────────────────┐
│ ⚙️ Company Management            [+ Add Company]    │
│ Manage your business entities and their settings     │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │
│ │ 🏢           │  │ 🏢           │  │   + Add     │  │
│ │ Company A    │  │ Company B    │  │   New       │  │
│ │ Code: RE     │  │ Code: MKT    │  │   Company   │  │
│ │ AED · Active │  │ USD · Active │  │             │  │
│ │ [Edit][Del]  │  │ [Edit][Del]  │  │             │  │
│ └─────────────┘  └─────────────┘  └─────────────┘  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Company Data Model
```js
{
  id: "comp_001",
  name: "",                // e.g., "My Real Estate Company"
  shortCode: "",           // e.g., "RE" — used as entity filter
  logo: null,              // Base64 or file reference
  address: "",
  phone: "",
  email: "",
  website: "",
  currency: "AED",         // AED, USD, EUR, GBP, etc.
  industry: "",            // "Real Estate", "Finance", etc.
  crmPlatform: "",         // "Bitrix", "Skale", etc.
  colorPrimary: "#6D28D9", // Brand color for UI
  colorSecondary: "#1D1245",
  status: "Active",        // "Active", "Inactive"
  createdAt: "2026-05-15T10:00:00.000Z"
}
```

### Add/Edit Company Modal Fields

| Field           | Label              | Type       | Required | Notes                         |
|-----------------|---------------------|------------|----------|-------------------------------|
| `name`          | Company Name        | text       | Yes      |                               |
| `shortCode`     | Short Code          | text       | Yes      | 2-5 uppercase chars, unique   |
| `logo`          | Logo                | file/image | No       | Image upload, preview         |
| `address`       | Address             | textarea   | No       |                               |
| `phone`         | Phone               | text       | No       |                               |
| `email`         | Email               | text       | No       |                               |
| `website`       | Website             | text       | No       |                               |
| `currency`      | Currency            | select     | Yes      | AED, USD, EUR, GBP, etc.     |
| `industry`      | Industry            | select     | No       | Predefined list               |
| `crmPlatform`   | CRM Platform        | text       | No       |                               |
| `colorPrimary`  | Brand Color         | color      | Yes      | Color picker                  |
| `status`        | Status              | toggle     | Yes      | Active/Inactive               |

### Redux Slice: `companiesSlice` (async thunks → API)
- `fetchCompanies()` — GET /api/companies
- `createCompany(data)` — POST /api/companies (server validates unique short_code)
- `updateCompany({ id, data })` — PUT /api/companies/:id
- `deleteCompany(id)` — DELETE /api/companies/:id (server checks FK cascade)
- `setActiveEntity(companyId)` — Updates entitySlice.currentCompanyId in Redux

> All CRUD operations hit the Express API. Server writes to MySQL and creates audit_logs entries automatically.

**Acceptance Criteria**:
- [ ] Empty state shown when no companies exist
- [ ] CRUD operations work correctly
- [ ] Short codes are unique
- [ ] Entity switcher in sidebar populates from companies
- [ ] Logo upload and preview works

---

## 2.2 — Department & Role Management Page

### Page: `/settings/departments`

### UI Layout — Two-Panel Design
```
┌────────────────────┬────────────────────────────────┐
│ Company: [Dropdown] │                                │
├────────────────────┤                                │
│ 📁 Sales       (5) │  Department: Sales             │
│ 📁 Operations  (3) │  ─────────────────────         │
│ 📁 Marketing   (2) │  Job Titles:                   │
│ 📁 IT          (4) │  ┌────────────────────────────┐ │
│ 📁 Finance     (2) │  │ Sales Agent                │ │
│ 📁 HR          (3) │  │ Seniority: Jr, Mid, Sr     │ │
│                     │  │ Salary: 3K-15K AED         │ │
│ [+ Add Department]  │  │ [Edit] [Delete]            │ │
│                     │  ├────────────────────────────┤ │
│                     │  │ Team Leader                │ │
│                     │  │ Seniority: Sr, Lead        │ │
│                     │  │ Salary: 12K-20K AED        │ │
│                     │  │ [Edit] [Delete]            │ │
│                     │  └────────────────────────────┘ │
│                     │  [+ Add Job Title]             │
└────────────────────┴────────────────────────────────┘
```

### Department — MySQL Table: `departments`
```sql
-- API: GET /api/departments?company_id=1
-- Returns: [{id, company_id, name, description, head_count_limit, parent_dept_id, icon, status}]
```

### Job Title — MySQL Tables: `job_titles` + `job_title_seniorities`
```sql
-- API: GET /api/job-titles?department_id=1
-- Returns: [{id, department_id, company_id, title, description, status, seniorities: [...]}]
-- Seniorities returned as nested array via JOIN
```

### Seniority Levels — Stored in `job_title_seniorities` table
```sql
-- Separate table linked by job_title_id
-- Each row: { id, job_title_id, level, salary_min, salary_max }
-- API handles nested create/update in a transaction
```

### Required Skills — Junction table: `job_title_skills`
```sql
-- Links job_titles to skills via skill_id
-- Managed through API: PUT /api/job-titles/:id { requiredSkills: [1, 5, 12] }
```
```

**Acceptance Criteria**:
- [ ] Two-panel layout works with department selection
- [ ] Company filter switches department list
- [ ] Job titles nest under departments
- [ ] Salary ranges per seniority level
- [ ] Linked skills from Skills Library (Phase 2.3)

---

## 2.3 — Skills Library Management Page

### Page: `/settings/skills`

### UI Layout
```
┌─────────────────────────────────────────────────────┐
│ 🎯 Skills Library              [+ Add Category]     │
│ [🔍 Search skills...]                                │
├─────────────────────────────────────────────────────┤
│                                                     │
│ ▼ Sales & Business Dev              [Edit] [+Skill] │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│   │Lead Gen  │ │Negotiation│ │Cold Call │           │
│   └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
│ ▼ Real Estate                       [Edit] [+Skill] │
│   ┌──────────┐ ┌──────────┐                         │
│   │RERA      │ │DLD Proc. │                         │
│   └──────────┘ └──────────┘                         │
│                                                     │
│ ▼ Languages                         [Edit] [+Skill] │
│   ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│   │English   │ │Arabic    │ │Hindi     │           │
│   └──────────┘ └──────────┘ └──────────┘           │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Skill Category Data Model
```js
{
  id: "scat_001",
  name: "Sales & Business Development",
  icon: "🎯",
  color: "#6D28D9",
  order: 1,
  status: "Active"
}
```

### Skill Data Model
```js
{
  id: "sk_001",
  categoryId: "scat_001",
  name: "Lead Generation",
  status: "Active"
}
```

### Features
- Collapsible category groups (Accordion)
- Skill tags within each category
- Inline add skill (type + Enter)
- Bulk import via JSON
- Export all skills as JSON

**Acceptance Criteria**:
- [ ] Category CRUD with icon and color
- [ ] Skills CRUD within categories
- [ ] Search across all skills
- [ ] Import/Export JSON functionality
- [ ] Skills available in candidate profiles and CV Scorer

---

## 2.4 — Asset Catalog Management Page

### Page: `/settings/catalog`

### Sub-tabs: Categories | Platforms | Inventory

### Asset Category Data Model
```js
{
  id: "acat_001",
  name: "Email & Calendar",
  icon: "📧",
  color: "#0369A1",
  order: 1
}
```

### Platform/Asset Item Data Model
```js
{
  id: "plat_001",
  categoryId: "acat_001",
  name: "Microsoft Outlook",
  assetType: "Account",         // Hardware, Account, Software
  companies: ["comp_001", "comp_002"],  // Which companies use it
  description: "Primary email client",
  inventoryTotal: 50,           // Total available quantity
  status: "Active"
}
```

**Acceptance Criteria**:
- [ ] Category CRUD with icons
- [ ] Platform CRUD with multi-company assignment
- [ ] Inventory quantity management
- [ ] Filter platforms by company and category

---

## 2.5 — System Configuration Page

### Page: `/settings/system`

### Sub-tabs: Pipeline | Onboarding | Offboarding | Letters | KPI

### 2.5.1 — ATS Pipeline Stages Configuration
```js
{
  stages: [
    { id: "s1", name: "New Applicants", color: "#EDE9FE", textColor: "#5B21B6", order: 1 },
    { id: "s2", name: "Shortlisted", color: "#DBEAFE", textColor: "#1E40AF", order: 2 },
    // ... configurable
  ],
  successStage: "s10",     // Which stage triggers employee creation
  failStages: ["s12", "s13"] // Which stages mark candidate as failed
}
```

### 2.5.2 — Onboarding Steps Template (per company)
```js
{
  companyId: "comp_001",
  steps: [
    {
      name: "Employee Information Form",
      owner: "HR",
      sla: "Within 24 hours",
      items: ["Full legal name confirmed", "Passport copy uploaded", ...]
    },
    // ... configurable per company
  ]
}
```

### 2.5.3 — Offboarding Steps Template (per company)
Similar to onboarding with departure-type variants.

### 2.5.4 — Letter Templates
Configurable letter types, required fields, and body templates.

### 2.5.5 — KPI Configuration
- Commission tiers (name, amount, criteria)
- Quarterly targets (metric, target, unit)

**Acceptance Criteria**:
- [ ] Each configuration section saves independently
- [ ] Changes reflect in the consuming modules
- [ ] Default templates can be created for new companies
