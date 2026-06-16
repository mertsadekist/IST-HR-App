# Phase 5: Employee Lifecycle — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 6-8
> **Depends On**: Phase 3 (Settings), Phase 4 (Recruitment)
> **Data Source**: MySQL via REST API + DeepSeek AI for email templates

---

## 4.1 — Onboarding Page

### Page: `/onboarding`
### Files:
- `pages/employees/Onboarding.jsx` — Main list page
- `pages/employees/components/OnboardingCard.jsx` — Record card
- `pages/employees/components/OnboardingDetail.jsx` — Step management modal
- `pages/employees/components/StepAccordion.jsx` — Expandable step item
- `pages/employees/components/ChecklistItem.jsx` — Individual checkbox item

### Onboarding Record Card
```
┌─────────────────────────────────────────────┐
│ 👤 Employee Name              [CompanyBadge] │
│    Sales Agent · Sales Department            │
│                                             │
│ ████████░░░░░░░░░ 37%   3/8 steps           │
│                                             │
│ Current: IT Setup & System Access            │
│ SLA: ⚠️ 2 days overdue                       │
│                                             │
│             [Manage Steps →]                 │
└─────────────────────────────────────────────┘
```

### Step Detail View (Full Modal)
```
┌─────────────────────────────────────────────┐
│ ✅ Onboarding: Employee Name     [X Close]   │
├─────────────────────────────────────────────┤
│                                             │
│ ▼ Step 1: Employee Info ✅ Complete          │
│   ☑ Full legal name confirmed               │
│   ☑ Passport copy uploaded                  │
│   ☑ Emirates ID copy uploaded               │
│   ☑ Bank account details                    │
│   Notes: [textarea]                         │
│                                             │
│ ▼ Step 2: Contract Signing ✅ Complete       │
│   ☑ Offer letter signed                     │
│   ☑ Employment contract signed              │
│                                             │
│ ▼ Step 3: Visa Processing 🔄 In Progress    │
│   ☑ Visa application submitted              │
│   ☐ Visa stamped                            │
│   ☐ Emirates ID application                 │
│   Notes: [textarea]                         │
│   [Complete Step]                            │
│                                             │
│ ▶ Step 4: IT Setup 🔒 Locked                │
│ ▶ Step 5: Branding 🔒 Locked                │
│ ...                                         │
└─────────────────────────────────────────────┘
```

### Step Status Logic
```
Locked (🔒) → Cannot interact, grayed out
  ↓ (previous step completed)
Open (🔄) → Checkboxes enabled, can add notes
  ↓ (all items checked + "Complete Step" clicked)
Complete (✅) → Read-only, timestamp recorded
```

### SLA Tracking
```js
function getSLAStatus(step) {
  const elapsed = dayjs().diff(dayjs(step.openedAt), 'hours');
  const slaHours = parseSLA(step.sla); // "Within 48 hours" → 48
  if (elapsed > slaHours) return { status: 'overdue', message: `${elapsed - slaHours}h overdue` };
  if (elapsed > slaHours * 0.8) return { status: 'warning', message: `${slaHours - elapsed}h remaining` };
  return { status: 'ok', message: `${slaHours - elapsed}h remaining` };
}
```

### Steps Template Source
Steps are NOT hardcoded — they are loaded from **Settings → System Configuration → Onboarding Steps** (Phase 2.5), per company.

**Acceptance Criteria**:
- [ ] Records list with progress bars
- [ ] Step accordion with expand/collapse
- [ ] Checkbox toggle updates progress
- [ ] Sequential step unlock (Locked → Open)
- [ ] SLA tracking with color-coded badges
- [ ] Notes saved per step
- [ ] Steps sourced from settings
- [ ] Audit entries on step completion

---

## 4.2 — Assets Page

### Page: `/assets`
### Files:
- `pages/employees/Assets.jsx` — Main tabbed page
- `pages/employees/components/AssignmentTable.jsx`
- `pages/employees/components/AssetAssignForm.jsx`
- `pages/employees/components/CatalogGrid.jsx`
- `pages/employees/components/InventoryView.jsx`

### Sub-tabs: Assignments | Catalog | Inventory

### Assignment Statistics Cards
```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ Total    │ │ Active   │ │ Returned │ │ Missing  │
│ 45       │ │ 38       │ │ 5        │ │ 2        │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Assign Asset Modal
| Field           | Label              | Type       | Source                |
|-----------------|---------------------|------------|-----------------------|
| `employeeId`    | Employee            | searchable | Active employees      |
| `platformId`    | Platform/Asset      | searchable | Asset Catalog (settings)|
| `assetType`     | Type                | select     | Hardware/Account/Software |
| `workspace`     | Workspace/Account   | text       | e.g., email address   |
| `accessLevel`   | Access Level        | text       |                       |
| `identifier`    | Serial/ID           | text       |                       |
| `issuedDate`    | Issued Date         | date       |                       |
| `expectedReturn`| Expected Return     | date       | Optional              |
| `notes`         | Notes               | textarea   |                       |

### Asset Return Flow
```
Active → Return → Record condition (Good/Damaged/Missing) → Save → Inventory update
```

### Inventory Auto-Update
```js
// When asset assigned:
inventory[platformName].available -= 1;

// When asset returned:
inventory[platformName].available += 1;
```

**Acceptance Criteria**:
- [ ] Three sub-tabs work correctly
- [ ] Assign modal with searchable dropdowns
- [ ] Return flow with condition recording
- [ ] Inventory counts update automatically
- [ ] Catalog filters by company and category
- [ ] Integration with onboarding/offboarding

---

## 4.3 — Performance Page

### Page: `/performance`
### Files:
- `pages/employees/Performance.jsx`
- `pages/employees/components/PerformanceTable.jsx`
- `pages/employees/components/PerformanceForm.jsx`
- `pages/employees/components/KPIDetailModal.jsx`

### Performance Table
| Column     | Content                              |
|------------|--------------------------------------|
| Employee   | Name + role                          |
| Company    | Badge                                |
| Quarter    | Q2-2026                              |
| Target     | Amount                               |
| Currency   | Company currency                     |
| Status     | Active/Inactive                      |
| Signed     | Signed/Pending                       |
| Actions    | View KPIs, Sign                      |

### Smart Auto-Fill
```js
// When employee selected in form:
const employee = employees.find(e => e.id === selectedId);
const company = companies.find(c => c.shortCode === employee.entity);
const defaultTarget = company.currency === 'AED' ? 70500 : 90000;
// Auto-fill target amount and currency
```

### KPI Detail Modal
Shows company-specific KPI descriptions and targets loaded from Settings.

**Acceptance Criteria**:
- [ ] Table with sorting and filtering
- [ ] Auto-fill target based on employee's company
- [ ] Sign functionality with timestamp
- [ ] KPI descriptions from settings
- [ ] Audit log on create/sign

---

## 4.4 — Offboarding Page

### Page: `/offboarding`
### Files:
- `pages/employees/Offboarding.jsx`
- `pages/employees/components/OffboardingCard.jsx`
- `pages/employees/components/OffboardingDetail.jsx`
- `pages/employees/components/GratuityCalculator.jsx`
- `pages/employees/components/AssetReturnStep.jsx`
- `pages/employees/components/EmailTemplateGenerator.jsx`

### Offboarding Card
```
┌─────────────────────────────────────────────┐
│ 👤 Employee Name              [CompanyBadge] │
│    Account Manager · Sales                   │
│                                             │
│ Type: Resignation    LWD: 15 Jun 2026       │
│ Countdown: 31 days remaining                 │
│                                             │
│ ████████░░░░░░░░░ 33%   2/6 steps           │
│                                             │
│ Settlement: AED 45,200 (calculated)          │
│ Visa Deadline: 15 Jul 2026 (30 days post-LWD)│
│                                             │
│             [Manage Steps →]                 │
└─────────────────────────────────────────────┘
```

### Step 2: Asset Return Integration
```
┌─────────────────────────────────────────────┐
│ Step 2: Handover of Company Assets           │
│                                             │
│ Assigned Assets (from Asset Module):         │
│ ┌─────────────────────────────────────────┐  │
│ │ 💻 Company Laptop    SN: IST-L-042     │  │
│ │    Condition: [Good ▼]                  │  │
│ ├─────────────────────────────────────────┤  │
│ │ 📱 Company Phone     SN: IST-P-018     │  │
│ │    Condition: [Good ▼]                  │  │
│ ├─────────────────────────────────────────┤  │
│ │ 🔑 Access Card       #AC-234           │  │
│ │    Condition: [Returned ▼]              │  │
│ └─────────────────────────────────────────┘  │
│                                             │
│ ☐ Asset Return Receipt signed                │
│ ☐ Asset registry updated                    │
│                                             │
│ [Complete Step]                              │
└─────────────────────────────────────────────┘
```

### Step 5: Gratuity Calculator
```
┌─────────────────────────────────────────────┐
│ Settlement Calculator                        │
│                                             │
│ Basic Salary:    AED [    5,000  ]           │
│ Full Salary:     AED [    8,500  ]           │
│ Start Date:      [  01 Jan 2023  ]           │
│ End Date (LWD):  [  15 Jun 2026  ]           │
│ Service Years:   3.45 years (auto)           │
│                                             │
│ ─────────────── CALCULATION ─────────────── │
│                                             │
│ EOSB (21 days × 3.45 yrs):   AED  12,075   │
│ Leave Encashment (14 days):   AED   3,967   │
│ Notice Compensation:          AED       0   │
│ ─────────────────────────────────────────   │
│ Subtotal:                     AED  16,042   │
│ Deductions:                  -AED   1,200   │
│ ═════════════════════════════════════════   │
│ TOTAL SETTLEMENT:             AED  14,842   │
│                                             │
│ [Download Statement]  [Print]               │
└─────────────────────────────────────────────┘
```

### EOSB Formula
```js
function calculateEOSB(basicSalary, startDate, endDate) {
  const years = dayjs(endDate).diff(dayjs(startDate), 'year', true);
  const dailyBasic = basicSalary / 30;

  if (years <= 5) {
    return dailyBasic * 21 * years;
  } else {
    return (dailyBasic * 21 * 5) + (dailyBasic * 30 * (years - 5));
  }
}
```

**Acceptance Criteria**:
- [ ] Initiate offboarding modal with all fields
- [ ] 6-step workflow with sequential unlock
- [ ] Email template generation (Step 1)
- [ ] Asset return from assigned assets list (Step 2)
- [ ] Gratuity calculator with correct formula (Step 5)
- [ ] LWD countdown and visa deadline tracking
- [ ] Employee status update through lifecycle
- [ ] Audit entries for all actions
