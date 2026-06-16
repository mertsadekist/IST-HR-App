# Phase 7: Analytics & Admin — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 9-10
> **Depends On**: Phase 4 (Recruitment data), Phase 5 (Lifecycle data)
> **Data Source**: MySQL aggregate queries via REST API

---

## 6.1 — Reports Page

### Page: `/reports`
### Files:
- `pages/admin/Reports.jsx`
- `pages/admin/components/PipelineReport.jsx`
- `pages/admin/components/JourneyReport.jsx`
- `pages/admin/components/EmployeeReport.jsx`
- `pages/admin/components/OnboardingReport.jsx`

### Sub-tabs: Pipeline | Journey | Employees | Onboarding

### Pipeline Report
```
┌─────────────────────────────────────────────┐
│ Pipeline Breakdown                           │
├─────────────────────────────────────────────┤
│ New Applicants     ████████████████ 23       │
│ Shortlisted        ████████████ 15           │
│ Contacted          ████████ 10               │
│ Scheduled          ██████ 8                  │
│ 1st Interview      █████ 6                   │
│ 2nd Interview      ███ 4                     │
│ Offer              ██ 3                      │
│ Joining            ██ 2                      │
│ Success            █ 1                       │
├─────────────────────────────────────────────┤
│ Total: 72  │ Active: 42  │ Hired: 18  │ Failed: 12 │
└─────────────────────────────────────────────┘
```

### Journey Report (Time-to-Hire)
| Column      | Content                  | Notes              |
|-------------|--------------------------|---------------------|
| Candidate   | Name + entity badge      |                     |
| Shortlisted | Date                     |                     |
| Offer Date  | Date                     |                     |
| Joined      | Date                     |                     |
| Total Days  | Color-coded number       | ≤30=🟢 ≤45=🟡 >45=🔴 |

### Employee Report
- Status donut chart (Onboarding/Active/Offboarding/Exited)
- Company distribution bar chart
- Department breakdown table

### Onboarding Report
- Progress table per employee
- Visual progress bars
- Average completion time metric

**Acceptance Criteria**:
- [ ] All 4 tabs render with real data
- [ ] Charts update on entity filter change
- [ ] Time-to-hire color coding works
- [ ] Export reports as CSV/PDF

---

## 6.2 — Audit Log Page

### Page: `/audit`
### Files:
- `pages/admin/AuditLog.jsx`
- `pages/admin/components/AuditTable.jsx`

### Audit Table
```
┌──────────────────┬──────────┬──────────────┬─────────────────────────────┐
│ Timestamp        │ User     │ Action       │ Detail                      │
├──────────────────┼──────────┼──────────────┼─────────────────────────────┤
│ 15 May, 14:30    │ HR Admin │ Stage Changed│ Ahmed: Shortlisted → Offer  │
│ 15 May, 14:15    │ HR Admin │ Target Set   │ Performance target for Maya │
│ 15 May, 13:45    │ System   │ Initialized  │ System first-time setup     │
└──────────────────┴──────────┴──────────────┴─────────────────────────────┘
```

### Features
- Alternating row colors for readability
- Search by detail text
- Filter by:
  - User (dropdown)
  - Module (dropdown)
  - Date range (picker)
- Export as JSON
- No edit/delete (append-only, read-only)

**Acceptance Criteria**:
- [ ] All audit entries display correctly
- [ ] Search and filter work
- [ ] Export downloads valid JSON
- [ ] Cannot modify or delete entries

---

## 6.3 — KPI & Commission Tracker Page

### Page: `/kpi`
### Files:
- `pages/admin/KPITracker.jsx`
- `pages/admin/components/KPIDashboard.jsx`
- `pages/admin/components/KPIHireTable.jsx`
- `pages/admin/components/KPIHireForm.jsx`

### Dashboard Cards
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│Total Hire│ │Total Comm│ │This Qtr  │ │Confirmed │
│  24      │ │ 18,500   │ │  5,250   │ │  18      │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Commission Tier Cards (from Settings)
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ 🏅 Retained 6M+ │ │ 🎯 4+ Deals/Qtr │ │ 🏆 Top 3%       │
│ AED 500         │ │ AED 750         │ │ AED 1,000       │
│ Hire active 6mo+│ │ CRM confirmed   │ │ Sales Mgr confirm│
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

### Hire Table
| Column       | Content                     |
|-------------|------------------------------|
| Employee    | Name + role                  |
| Company     | Badge                        |
| Join Date   | Date                         |
| Tiers       | Tier badges                  |
| Commission  | Total amount                 |
| Status      | Confirmed/Pending            |
| Actions     | Edit, Delete                 |

### Log Hire Modal
| Field          | Type     | Required |
|---------------|----------|----------|
| Employee Name | text     | Yes      |
| Role          | text     | No       |
| Company       | select   | Yes      |
| Join Date     | date     | Yes      |
| Tier checkboxes| checkbox | No      |
| Status        | select   | No       |
| Notes         | textarea | No       |

**Acceptance Criteria**:
- [ ] Dashboard with correct calculations
- [ ] Tier definitions from settings
- [ ] Commission auto-calculated from selected tiers
- [ ] Filter by status (All/Pending/Confirmed)
- [ ] Quarterly grouping

---

## 6.4 — Org Chart Page

### Page: `/org-chart`
### Files:
- `pages/admin/OrgChart.jsx`
- `pages/admin/components/OrgChartSVG.jsx`
- `pages/admin/components/OrgChartInfoPanel.jsx`

### Features
- Company tabs at top
- SVG-rendered tree hierarchy
- Data sourced from Settings → Departments → Job Titles
- Controls: Zoom, Pan, Expand All, Collapse All, Reset
- Node click → Side info panel
- Touch support for mobile

### Tree Generation (from Settings data)
```js
function buildOrgTree(companyId) {
  const company = companies.find(c => c.id === companyId);
  const depts = departments.filter(d => d.companyId === companyId);
  return {
    label: company.name,
    children: depts.map(dept => ({
      label: dept.name,
      children: jobTitles
        .filter(jt => jt.departmentId === dept.id)
        .map(jt => ({ label: jt.title }))
    }))
  };
}
```

**Acceptance Criteria**:
- [ ] Org chart renders from settings data
- [ ] Zoom/pan/collapse controls work
- [ ] Company tabs switch charts
- [ ] Node info panel shows details
- [ ] Responsive and touch-friendly

---

## 6.5 — User Management Page

### Page: `/users`
### Files:
- `pages/admin/UserManagement.jsx`
- `pages/admin/components/UserTable.jsx`
- `pages/admin/components/UserForm.jsx`

### User Table
```
┌─────────────────┬──────────┬───────────┬────────┬────────┬──────────────────┐
│ Name            │ Username │ Role      │ Entity │ Status │ Actions          │
├─────────────────┼──────────┼───────────┼────────┼────────┼──────────────────┤
│ 👤 HR Admin     │ admin    │ 🟣 Admin  │ ALL    │ 🟢 Act │ [✏️][🔒][🔑]    │
│   admin@co.com  │          │           │        │        │                  │
└─────────────────┴──────────┴───────────┴────────┴────────┴──────────────────┘
```

### User Form
| Field      | Type     | Required | Notes                |
|-----------|----------|----------|----------------------|
| Full Name | text     | Yes      |                      |
| Username  | text     | Yes      | Unique, lowercase    |
| Email     | text     | No       |                      |
| Password  | password | Yes*     | *On create, min 6    |
| Role      | select   | Yes      | 4 roles              |
| Company   | select   | Yes      | ALL or specific      |

### Security Features
- Cannot disable own admin account
- Password reset via new password prompt
- Base64 storage (with clear security warning)

**Acceptance Criteria**:
- [ ] User CRUD with all fields
- [ ] Role-based badge colors
- [ ] Enable/disable toggle
- [ ] Password reset
- [ ] Self-protection for admin
- [ ] Audit log for all user changes
