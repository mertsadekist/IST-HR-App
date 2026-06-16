# Phase 6: Legal & Compliance — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 8-9
> **Depends On**: Phase 3 (Settings/Templates)
> **Data Source**: MySQL via REST API + DeepSeek AI for letter content generation

---

## 5.1 — Legal Letter Generator Page

### Page: `/legal-letters`
### Files:
- `pages/legal/LegalLetters.jsx` — Main page
- `pages/legal/components/LetterTypeCards.jsx` — Type selection grid
- `pages/legal/components/LetterForm.jsx` — Dynamic form
- `pages/legal/components/LetterPreview.jsx` — Styled preview
- `pages/legal/components/LetterPrintView.jsx` — Print-ready layout

### UI Layout — Two-Panel Design
```
┌──────────────────────┬──────────────────────────────┐
│ Letter Type          │ Preview                      │
│ ┌────┐ ┌────┐ ┌────┐│                              │
│ │⚠️   │ │🔴  │ │💰  ││ ┌──────────────────────────┐ │
│ │Warn│ │Term│ │Cert ││ │ [COMPANY LOGO]           │ │
│ └────┘ └────┘ └────┘││ │ COMPANY NAME             │ │
│ ┌────┐ ┌────┐ ┌────┐││ │                          │ │
│ │📋  │ │📜  │ │🎉  ││ │ Date: 15 May 2026        │ │
│ │NOC │ │Exp │ │Offer││ │                          │ │
│ └────┘ └────┘ └────┘││ │ To: [Employee Name]      │ │
│ ┌────┐ ┌────┐       ││ │ Re: [Letter Subject]     │ │
│ │📈  │ │⭐  │       ││ │                          │ │
│ │Incr│ │Promo│      ││ │ Dear [Name],             │ │
│ └────┘ └────┘       ││ │                          │ │
│                      ││ │ [Letter body content     │ │
│ ──── Form ────      ││ │  generated dynamically   │ │
│ Company: [Select ▼]  ││ │  based on type and       │ │
│ Employee: [_____]    ││ │  form inputs...]         │ │
│ Date: [________]     ││ │                          │ │
│ [Type-specific       ││ │ Regards,                 │ │
│  fields here...]     ││ │ HR Department            │ │
│                      ││ │ COMPANY NAME             │ │
│ [Preview] [Print]    ││ └──────────────────────────┘ │
└──────────────────────┴──────────────────────────────┘
```

### Letter Types and Their Fields

#### 1. Warning Letter
| Field        | Type     | Required |
|-------------|----------|----------|
| Employee    | text     | Yes      |
| Job Title   | text     | Yes      |
| Department  | text     | Yes      |
| Date        | date     | Yes      |
| Reason      | textarea | Yes      |
| Warning Level| select  | Yes      |
| Prev. Warnings| number| No       |

Warning Levels: Verbal, First Written, Final Written

#### 2. Termination Letter
| Field         | Type     | Required |
|--------------|----------|----------|
| Employee     | text     | Yes      |
| Job Title    | text     | Yes      |
| Effective Date| date   | Yes      |
| Reason       | textarea | Yes      |
| Notice Period| number   | Yes      |
| Term. Type   | select   | Yes      |

Types: Performance, Misconduct (Art. 44), Redundancy, Probation

#### 3. Salary Certificate
| Field        | Type     | Required |
|-------------|----------|----------|
| Employee    | text     | Yes      |
| Job Title   | text     | Yes      |
| Date of Joining| date | Yes      |
| Monthly Salary| number| Yes      |
| Purpose     | text     | No       |

#### 4. NOC (No Objection Certificate)
| Field        | Type     | Required |
|-------------|----------|----------|
| Employee    | text     | Yes      |
| Purpose     | text     | Yes      |
| Valid Until  | date     | No       |

#### 5. Experience Letter
| Field        | Type     | Required |
|-------------|----------|----------|
| Employee    | text     | Yes      |
| Job Title   | text     | Yes      |
| Start Date  | date     | Yes      |
| End Date    | date     | Yes      |
| Department  | text     | Yes      |

#### 6. Offer Letter
| Field           | Type   | Required |
|----------------|--------|----------|
| Candidate Name | text   | Yes      |
| Job Title      | text   | Yes      |
| Department     | text   | Yes      |
| Start Date     | date   | Yes      |
| Salary         | number | Yes      |
| Housing Allow. | number | No       |
| Transport Allow.| number| No       |
| Probation (months)| number| Yes   |

#### 7. Salary Increment
| Field          | Type   | Required |
|---------------|--------|----------|
| Employee      | text   | Yes      |
| Current Salary| number | Yes      |
| New Salary    | number | Yes      |
| Effective Date| date   | Yes      |
| Reason        | text   | No       |

#### 8. Promotion Letter
| Field          | Type   | Required |
|---------------|--------|----------|
| Employee      | text   | Yes      |
| Current Title | text   | Yes      |
| New Title     | text   | Yes      |
| Effective Date| date   | Yes      |
| New Salary    | number | No       |

### Print/Export
```js
function printLetter(previewHTML) {
  const printWindow = window.open('', '_blank');
  printWindow.document.write(`
    <html><head>
      <style>/* Print-optimized CSS */</style>
    </head><body>
      ${previewHTML}
    </body></html>
  `);
  printWindow.print();
}
```

**Acceptance Criteria**:
- [ ] All 8 letter types with correct forms
- [ ] Company-specific letterhead (logo, colors)
- [ ] Live preview updates as form is filled
- [ ] Print opens clean formatted window
- [ ] Letter templates configurable from settings

---

## 5.2 — Company Documents Page

### Page: `/company-docs`
### Files:
- `pages/legal/CompanyDocs.jsx`
- `pages/legal/components/DocCategoryGrid.jsx`
- `pages/legal/components/DocUploader.jsx`
- `pages/legal/components/DocList.jsx`
- `pages/legal/components/LegalFormsTab.jsx`

### Sub-tabs: Documents | Legal Forms

### Document Category Grid
Categories defined in Settings (or default set):

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ 🤝       │ │ 📘       │ │ 📊       │ │ 🏛️       │
│Agreements│ │HR Manual │ │Sales Pol.│ │Trade Lic.│
│ 3 files  │ │ 1 file   │ │ 2 files  │ │ 4 files  │
│ [Upload] │ │ [Upload] │ │ [Upload] │ │ [Upload] │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### File List per Category
```
📄 Employment_Contract.pdf     245 KB    15 Apr 2026    [👁 View] [🗑 Delete]
📄 NDA_Template.docx          128 KB    10 Apr 2026    [👁 View] [🗑 Delete]
```

### IndexedDB Storage
Same pattern as original — binary file storage with metadata.

**Acceptance Criteria**:
- [ ] Upload files of any type
- [ ] View files in new browser tab
- [ ] Delete with confirmation
- [ ] Files persist in IndexedDB across sessions
- [ ] Company filter shows only relevant docs
- [ ] Legal forms sub-tab with company-specific forms

---

## 5.3 — Payroll & Labour Law Page

### Page: `/payroll`
### Files:
- `pages/legal/Payroll.jsx`
- `pages/legal/components/ExitCalculator.jsx`
- `pages/legal/components/VisaComparison.jsx`
- `pages/legal/components/AbsenceCalculator.jsx`
- `pages/legal/components/AttendanceReport.jsx`
- `pages/legal/components/DecisionMatrix.jsx`

### Sub-tabs: Exit Calculator | Visa Guide | Absence | Attendance | Matrix

### Exit Calculator — Full Settlement
```
┌──────────────────────────────────────────────┐
│ 🏳️ Exit Settlement Calculator                │
├─────────────────┬────────────────────────────┤
│                 │                            │
│ Employee Name:  │ [___________________]      │
│ Basic Wage:     │ [___________] AED/month    │
│ Full Wage:      │ [___________] AED/month    │
│ Start Date:     │ [__/__/____]               │
│ Last Day:       │ [__/__/____]               │
│ Service Years:  │ 3.45 (auto)                │
│ Exit Type:      │ [Resignation ▼]            │
│ Visa Type:      │ [Full Visa ▼]              │
│ Accrued Leave:  │ [____] days                │
│ Deductions:     │ [___________] AED          │
│                 │                            │
│ [Calculate Settlement]                       │
│                                              │
│ ═══════════ RESULTS ═══════════             │
│                                              │
│ EOSB:           AED 12,075.00               │
│ Leave:          AED  3,966.67               │
│ Notice:         AED      0.00               │
│ ─────────────────────────                   │
│ Subtotal:       AED 16,041.67               │
│ Deductions:    -AED  1,200.00               │
│ ═════════════════════════                   │
│ NET TOTAL:      AED 14,841.67               │
│                                              │
│ [Download PDF] [Print Statement]             │
└──────────────────────────────────────────────┘
```

### Absence & Lateness Calculators
Three mini-calculators:
1. **Unauthorized Absence**: (Wage ÷ 30) × Days
2. **Lateness**: Hourly deduction based on time and incidents
3. **50% Deduction Cap**: Validates total deductions < 50% of wage

### Decision Matrix
Reference table: EOSB entitlement by exit scenario (Article 51 & 53).

### Disciplinary Framework
Interactive table showing escalation:
Level 1 (Verbal) → Level 2 (Written) → Level 3 (Final) → Level 4 (Suspension) → Level 5 (Termination)

**Acceptance Criteria**:
- [ ] Exit calculator with correct EOSB formula
- [ ] All 5 sub-tabs functional
- [ ] Absence/lateness calculators with validation
- [ ] 50% cap checker
- [ ] Reference tables render correctly
- [ ] Print/download settlement statement
