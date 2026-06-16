# Payroll & Labour Law Module

## Overview

The **Payroll & Labour Law Module** provides compliance tools and calculators based on **UAE Federal Decree-Law No. 33 of 2021**. It does not process actual payroll — it serves as a reference and calculation tool for HR operations.

**Render Function**: `render_payroll()` (Line ~6665)

---

## Sub-Tabs

The module is organized into 5 tabs controlled by `prCurrentTab`:

| Tab          | Title                     | Purpose                                   |
|--------------|---------------------------|-------------------------------------------|
| `exit`       | 🏳️ Exit Calculator        | Full employee exit settlement calculation |
| `visa`       | 📋 Work Permit vs Visa    | Entitlement comparison reference          |
| `absence`    | ⏱️ Absence & Lateness     | Deduction calculators                     |
| `attendance` | 📊 Attendance Report      | Monthly attendance tracking               |
| `matrix`     | 📑 Decision Matrix        | EOSB entitlement by exit scenario         |

---

## Exit Settlement Calculator

### Input Fields

| Field ID         | Label                                     | Type   |
|------------------|-------------------------------------------|--------|
| `ex-name`        | Employee Name                             | text   |
| `ex-basic`       | Monthly Basic Wage (AED)                  | number |
| `ex-full`        | Monthly Full Wage incl. Allowances (AED)  | number |
| `ex-start`       | Employment Start Date                     | date   |
| `ex-end`         | Last Working Day                          | date   |
| `ex-prob`        | Probation Period Ends                     | date   |
| `ex-type`        | Exit Type                                 | select |
| `ex-visa`        | Visa / Permit Type                        | select |
| `ex-leave`       | Accrued Annual Leave Days (unused)        | number |
| `ex-unpaid`      | Total Unpaid Leave Days                   | number |
| `ex-notice-served`| Notice Period Served (days)              | number |
| `ex-deduct`      | Salary Advances / Deductions (AED)        | number |

### Exit Types

| Value              | Label                                         |
|--------------------|-----------------------------------------------|
| `term_legit`       | Termination by Employer (Legitimate Reason)   |
| `term_misconduct`  | Dismissal for Gross Misconduct (Art. 44)      |
| `resign`           | Resignation by Employee                       |
| `expiry`           | Contract Expiry (Not Renewed)                 |
| `mutual`           | Mutual Agreement                              |

### EOSB Calculation Formula

```
Daily Basic = Monthly Basic ÷ 30

If years ≤ 5:
  EOSB = Daily Basic × 21 × years

If years > 5:
  EOSB = (Daily Basic × 21 × 5) + (Daily Basic × 30 × (years - 5))

Leave Encashment = Daily Full Wage × unused leave days

Notice Period Compensation = Daily Full Wage × (required notice - served notice)

Final Settlement = EOSB + Leave Encashment + Outstanding Salary - Deductions - Notice Shortfall
```

---

## Work Permit vs Visa Comparison

A reference table comparing entitlements for two categories:
- **Full Employer-Sponsored Residency Visa**
- **Work Permit Only (Own Residency Visa)**

Key point: All UAE Labour Law rights are **identical** for both categories. Differences are administrative only.

Comparison covers 14 entitlements including EOSB, annual leave, sick leave, overtime, maternity/paternity, health insurance, repatriation, visa cancellation, etc.

---

## Absence & Lateness Calculators

### Unauthorized Absence

| Field    | Label                          |
|----------|--------------------------------|
| `ab-wage`| Monthly Full Wage (AED)        |
| `ab-days`| Unauthorized Absent Days       |

Formula: `Deduction = (Wage ÷ 30) × Absent Days`

### Lateness Deduction

| Field     | Label                     |
|-----------|---------------------------|
| `lt-wage` | Monthly Full Wage (AED)   |
| `lt-hrs`  | Total Hours Late          |
| `lt-min`  | Total Minutes Late        |
| `lt-count`| Number of Incidents       |

### 50% Deduction Cap Check

Per **Article 25** — total monthly deductions cannot exceed 50% of wage.

| Field     | Label                           |
|-----------|----------------------------------|
| `dc-wage` | Monthly Wage (AED)              |
| `dc-absence` | Absence Deduction (AED)      |
| `dc-late` | Lateness Deduction (AED)        |
| `dc-adv`  | Advances / Loans (AED)          |
| `dc-other`| Other Approved Deductions (AED) |

---

## Disciplinary Escalation Framework

Based on **UAE Labour Law Art. 44** and MOHRE-approved internal policy:

| Level | Action                  | Trigger                                    | Consequence                               |
|-------|-------------------------|--------------------------------------------|--------------------------------------------|
| 1     | Verbal Warning          | 1st-2nd lateness or 1 absent day           | Proportional deduction only                |
| 2     | Written Warning         | 3rd lateness or 2nd unauthorized absence   | Deduction + formal warning letter          |
| 3     | Final Written Warning   | 4th-5th lateness or 3rd absence            | Deduction + no bonus eligibility           |
| 4     | Unpaid Suspension       | Persistent violations after warnings       | 1-3 day unpaid suspension                  |
| 5     | Termination for Cause   | 7+ consecutive or 20+ non-consecutive days | No notice, EOSB forfeited                  |

---

## Key Functions

| Function               | Purpose                                    |
|------------------------|--------------------------------------------|
| `render_payroll()`     | Renders all payroll sub-tabs               |
| `switchPrTab(tab)`     | Switches between sub-tabs                  |
| `calcExitSettlement()` | Calculates full exit settlement            |
| `calcAbsence()`        | Calculates absence deduction               |
| `calcLateness()`       | Calculates lateness deduction              |
| `calcDeductCap()`      | Checks 50% deduction cap compliance        |
