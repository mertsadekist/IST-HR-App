# Onboarding Module

## Overview

The **Onboarding Module** manages the multi-step process of integrating a newly hired employee into the organization. It is triggered automatically when a candidate reaches the "Success" stage in the ATS pipeline.

**Render Function**: `render_onboarding()` (Line ~3925)

---

## Onboarding Workflow

### Steps (Entity-Dependent)

The onboarding process is built by `buildOnboardingSteps(entity)` and consists of 8-9 steps:

| Step | Name                                | Owner         | SLA              |
|------|-------------------------------------|---------------|------------------|
| 1    | Employee Information Form            | HR            | Within 24 hours  |
| 2    | Contract & Offer Letter Signing      | HR / Legal    | Within 48 hours  |
| 3    | Visa & Immigration Processing        | PRO / Admin   | 5-15 business days |
| 4    | IT Setup & System Access             | IT            | Within 48 hours  |
| 5    | Company Branding & Marketing Setup   | Marketing     | Within 72 hours  |
| 6    | Department-Specific Onboarding       | Dept. Manager | First week       |
| 7    | HR Policies & Compliance Training    | HR            | First week       |
| 8    | Probation Period Setup               | HR            | By Day 1         |
| 9*   | VOIP & Communication Setup           | IT            | Within 48 hours  |

> *Step 9 may vary by entity

---

## Step Structure

Each step contains:

```javascript
{
  stepNum: 1,
  name: "Employee Information Form",
  owner: "HR",
  sla: "Within 24 hours",
  type: "form",                    // Step type identifier
  items: [                         // Checklist items
    "Full legal name confirmed",
    "Passport copy uploaded",
    "Emirates ID copy uploaded",
    // ...
  ],
  status: "Open",                  // "Locked", "Open", "Complete"
  completedDate: null,
  checkedItems: [],                // Boolean array tracking checked items
  notes: ""
}
```

### Step Status Flow

```
Locked → Open → Complete
  │               │
  └── Sequential unlock: Step N opens when Step N-1 completes
```

- **Locked**: Cannot be interacted with (grayed out)
- **Open**: Currently actionable (highlighted)
- **Complete**: All checklist items checked, step marked done

---

## Checklist Items per Step

### Step 1: Employee Information Form
- Full legal name confirmed
- Date of birth recorded
- Nationality recorded
- Passport copy uploaded
- Emirates ID copy uploaded
- Contact number confirmed
- Personal email confirmed
- Emergency contact details
- Bank account details (IBAN) for salary
- Passport-size photograph uploaded

### Step 4: IT Setup (Varies by Entity)

**IST Real Estate**:
- Microsoft email account created (@istrealstate.com)
- Google account created (@istmarketsglobal.com)
- Bitrix CRM access provisioned
- MS Teams & Office 365 licence assigned
- DNCR portal access provisioned
- WATI Tags access provisioned
- Listings Users access provisioned
- OneDrive/Google Drive shared folder access
- VOIP extension assigned (Yeastar)
- Kaspersky/Cyber Protect installed
- Company WhatsApp configured
- Company laptop issued & configured
- Company phone issued (if applicable)

**IST Markets**:
- Outlook/MS email created (@IST Markets)
- Google account created (@istmarketsglobal.com)
- Bitrix CRM access provisioned
- Skale CRM access provisioned
- VOIP extension assigned (Yeastar)
- VOISO access provisioned
- Kaspersky/Cyber Protect installed
- Company WhatsApp configured
- Company laptop issued & configured
- Company phone issued (if applicable)

---

## UI Components

### Onboarding List View

Each onboarding record is displayed as a card showing:
- **Employee name** and entity badge
- **Progress bar** (% of steps completed)
- **Step status summary** (e.g., "3/8 steps · 37%")
- **Current step name**
- **SLA status** (green if within SLA, red/orange if overdue)
- **Manage Steps** button to open detailed view

### Step Detail Modal

When "Manage Steps" is clicked, a full modal opens showing:
- All steps in an expandable accordion
- Checklist items with checkboxes
- Step notes textarea
- Complete/Unlock buttons
- Progress indicators

---

## Key Functions

| Function                           | Purpose                                    |
|------------------------------------|--------------------------------------------|
| `render_onboarding()`              | Renders the onboarding list view           |
| `buildOnboardingSteps(entity)`     | Creates the step template for an entity    |
| `openOnboardDetail(onboardId)`     | Opens detailed step management modal       |
| `toggleOnbCheckItem(id, step, idx)`| Toggles a checklist item                   |
| `completeOnbStep(id, stepIdx)`     | Marks a step as complete, unlocks next     |
| `saveOnbNotes(id, stepIdx)`        | Saves notes for a step                     |

---

## Integration Points

- **ATS Pipeline → Onboarding**: When a candidate moves to "Success", `createEmployeeAndOnboarding()` is called
- **Onboarding → Assets**: IT setup step links to the Asset module for tracking assigned equipment
- **Onboarding → Audit Log**: All step completions are logged
