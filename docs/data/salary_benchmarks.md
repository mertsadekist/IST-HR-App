# Salary Benchmarks (SALARY_BASE)

## Overview

The `SALARY_BASE` constant defines salary range benchmarks by role and seniority level. These are used in the Hiring Blueprint and CV Scorer modules to validate offers and set expectations.

---

## Structure Format

```javascript
SALARY_BASE = {
  "RE": {
    "Sales Agent": {
      "Junior":  { min: 3000, max: 5000, currency: "AED" },
      "Mid":     { min: 5000, max: 8000, currency: "AED" },
      "Senior":  { min: 8000, max: 15000, currency: "AED" }
    },
    // ...
  },
  "MKT": {
    "Account Manager": {
      "Junior":  { min: 2000, max: 3500, currency: "USD" },
      "Mid":     { min: 3500, max: 6000, currency: "USD" },
      "Senior":  { min: 6000, max: 10000, currency: "USD" }
    },
    // ...
  }
}
```

---

## IST Real Estate (AED)

| Role                  | Junior       | Mid-Level    | Senior       |
|-----------------------|--------------|--------------|--------------|
| Sales Agent           | 3,000-5,000  | 5,000-8,000  | 8,000-15,000 |
| Team Leader           | —            | —            | 12,000-20,000|
| Sales Coordinator     | 4,000-6,000  | 6,000-9,000  | 9,000-14,000 |
| Marketing Manager     | —            | 8,000-12,000 | 12,000-18,000|
| IT Support            | 4,000-6,000  | 6,000-10,000 | 10,000-15,000|

> Note: Values are approximations based on the code analysis. Actual ranges may vary.

---

## IST Markets (USD)

| Role                  | Junior       | Mid-Level    | Senior       |
|-----------------------|--------------|--------------|--------------|
| Account Manager       | 2,000-3,500  | 3,500-6,000  | 6,000-10,000 |
| BDM                   | 3,000-5,000  | 5,000-8,000  | 8,000-14,000 |
| Compliance Officer    | 3,000-5,000  | 5,000-8,000  | 8,000-12,000 |
| Retention Manager     | 2,500-4,000  | 4,000-7,000  | 7,000-11,000 |

> Note: Values are approximations based on the code analysis. Actual ranges may vary.

---

## Usage

Salary benchmarks are used in:

1. **Hiring Blueprint** — Shows expected salary ranges when selecting a role and seniority
2. **Offer Letter Generator** — Validates offer amounts against benchmarks
3. **CV Scorer** — Provides context for salary expectations in the vacancy profile
4. **Vacancy Creation** — Suggests salary range based on selected role

---

## Commission vs Base Salary

For sales roles in both entities, **base salary** is typically lower with heavy commission/bonus components:

### IST Real Estate
- Tier-based commission structure
- Turbo bonuses for exceeding targets
- Loyalty programs for long-term employees

### IST Markets
- Commission based on trader volumes
- IB (Introducing Broker) referral bonuses
- Quarterly performance bonuses
