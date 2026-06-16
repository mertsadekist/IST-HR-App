# Legal Letter Generator Module

## Overview

The **Legal Letter Generator** provides templated HR/Legal document generation for various letter types. Each letter type has entity-specific content and field requirements.

**Render Function**: `render_legal()` (Line ~857)

---

## Letter Types

The system supports the following letter types, selected via a card-based UI:

| # | Letter Type              | Icon | Description                              |
|---|--------------------------|------|------------------------------------------|
| 1 | Warning Letter           | ⚠️   | Formal warning for employee misconduct   |
| 2 | Termination Letter       | 🔴   | Employment termination notice            |
| 3 | Salary Certificate       | 💰   | Proof of employment and salary           |
| 4 | NOC (No Objection)       | 📋   | No-objection certificate                 |
| 5 | Experience Letter        | 📜   | Employment experience certificate        |
| 6 | Offer Letter             | 🎉   | Job offer with compensation details      |
| 7 | Salary Increment Letter  | 📈   | Salary revision notification             |
| 8 | Promotion Letter         | ⭐   | Promotion announcement                   |

---

## Form Fields per Letter Type

### Warning Letter

| Field ID      | Label                     | Type     | Required |
|---------------|---------------------------|----------|----------|
| `ll-name`     | Employee Name             | text     | Yes      |
| `ll-title`    | Job Title                 | text     | Yes      |
| `ll-dept`     | Department                | text     | Yes      |
| `ll-date`     | Date                      | date     | Yes      |
| `ll-reason`   | Reason for Warning        | textarea | Yes      |
| `ll-level`    | Warning Level             | select   | Yes      |
| `ll-prev`     | Previous Warnings         | number   | No       |

**Warning Levels**: Verbal Warning, First Written Warning, Final Written Warning

### Termination Letter

| Field ID      | Label                     | Type     | Required |
|---------------|---------------------------|----------|----------|
| `ll-name`     | Employee Name             | text     | Yes      |
| `ll-title`    | Job Title                 | text     | Yes      |
| `ll-dept`     | Department                | text     | Yes      |
| `ll-date`     | Effective Date            | date     | Yes      |
| `ll-reason`   | Reason for Termination    | textarea | Yes      |
| `ll-notice`   | Notice Period (days)      | number   | Yes      |
| `ll-type`     | Termination Type          | select   | Yes      |

**Termination Types**: Performance-based, Misconduct (Art. 44), Redundancy, Probation

### Offer Letter

| Field ID      | Label                     | Type     | Required |
|---------------|---------------------------|----------|----------|
| `ll-name`     | Candidate Name            | text     | Yes      |
| `ll-title`    | Job Title                 | text     | Yes      |
| `ll-dept`     | Department                | text     | Yes      |
| `ll-start`    | Start Date                | date     | Yes      |
| `ll-salary`   | Monthly Salary            | number   | Yes      |
| `ll-housing`  | Housing Allowance         | number   | No       |
| `ll-transport`| Transport Allowance       | number   | No       |
| `ll-probation`| Probation Period (months) | number   | Yes      |

---

## Letter Generation Flow

```
1. User selects letter type (card click)
2. Form fields dynamically update based on type
3. User selects entity (RE/MKT) — affects letterhead
4. User fills in fields
5. Click "Preview Letter" → buildLetterBody() generates HTML
6. Letter appears in preview panel with entity-specific branding
7. Click "Print / Export" → opens print dialog in new window
```

### Entity-Specific Branding

| Element          | IST Real Estate                 | IST Markets                     |
|------------------|---------------------------------|---------------------------------|
| Company Name     | IST Real Estate                 | IST Markets                     |
| Letterhead Color | Navy Blue (`#1D3557`)           | Purple (`#4B2E83`)              |
| Address          | UAE office address              | UAE office address              |
| Signatory        | HR Manager / Director           | HR Manager / Director           |

---

## Letter Preview

The preview panel (`.letter-preview-wrap`) renders a styled HTML document with:
- **Company letterhead** (entity-specific)
- **Date and reference number**
- **Recipient details**
- **Letter body** (dynamically generated based on type and fields)
- **Closing and signature block**
- **Legal disclaimers** (where applicable, referencing UAE Labour Law articles)

---

## Print / Export

The `printLetter()` function:
1. Captures the preview HTML
2. Opens a new browser window
3. Writes the HTML with print-specific CSS
4. Calls `window.print()` automatically
5. Closes the print window after completion

---

## Key Functions

| Function                    | Purpose                                    |
|-----------------------------|--------------------------------------------|
| `render_legal()`            | Renders the letter type selection and form  |
| `selectLetterType(type)`    | Updates form fields for selected type       |
| `buildLetterBody()`         | Generates the complete letter HTML          |
| `printLetter()`             | Opens print dialog for the letter           |
| `previewLetter()`           | Renders letter preview in the preview panel |
