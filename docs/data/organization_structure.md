# Organization Structure (IST_ORG)

## Overview

The `IST_ORG` constant defines the complete hierarchical structure of both IST entities. It maps each entity to its departments, and each department to available job titles with seniority levels.

---

## Structure Format

```javascript
IST_ORG = {
  RE: {
    departments: {
      "Sales": {
        titles: [
          { name: "Sales Agent", seniority: ["Junior", "Mid", "Senior"] },
          { name: "Team Leader", seniority: ["Senior", "Lead"] },
          // ...
        ]
      },
      // ...
    }
  },
  MKT: { ... }
}
```

---

## IST Real Estate (RE)

### Departments and Key Roles

| Department        | Job Titles                                                |
|-------------------|------------------------------------------------------------|
| **Sales**         | Sales Agent, Senior Sales Agent, Team Leader, Sales Manager |
| **Operations**    | Sales Coordinator, Admin Assistant, Office Manager          |
| **Marketing**     | Social Media Manager, Content Creator, Marketing Manager    |
| **IT**            | IT Support Technician, System Administrator, IT Manager     |
| **Finance**       | Accountant, Finance Manager, Finance Director               |
| **HR**            | HR Officer, Recruiter, HR Manager                           |
| **Legal**         | Legal Advisor, Compliance Officer                           |
| **Management**    | General Manager, CEO, COO                                   |

### Key Characteristics
- **Primary CRM**: Bitrix
- **Currency**: AED (UAE Dirham)
- **Focus**: Property sales, leasing, off-plan projects
- **Platforms**: DNCR portal, Listings Users, WATI Tags

---

## IST Markets (MKT)

### Departments and Key Roles

| Department            | Job Titles                                                |
|-----------------------|------------------------------------------------------------|
| **Sales**             | Account Manager, Senior Account Manager, Sales Director   |
| **Business Development** | BDM, Senior BDM, BD Director                          |
| **Compliance**        | Compliance Officer, AML Analyst, Compliance Manager       |
| **IT**                | Developer, IT Support, IT Manager                          |
| **Marketing**         | Digital Marketing Manager, Content Manager                 |
| **Finance**           | Accountant, Finance Controller, Finance Director           |
| **Operations**        | Operations Manager, Dealing Room Manager                  |
| **HR**                | HR Manager, Recruiter, HR Officer                          |
| **Retention**         | Retention Manager, Client Relations Officer                |
| **Management**        | CEO, COO, Managing Director                                |

### Key Characteristics
- **Primary CRM**: Bitrix + Skale
- **Currency**: USD (US Dollar)
- **Focus**: Forex/CFD brokerage, IB partnerships
- **Platforms**: VOISO, Skale CRM, MetaTrader

---

## Usage in the Application

The `IST_ORG` structure is used by:

1. **Vacancies Module** — Populates department/title dropdowns based on entity
2. **Hiring Blueprint** — Displays the complete role map
3. **Onboarding** — Entity-specific IT setup checklists
4. **Offboarding** — Entity-specific access revocation lists
5. **Salary Benchmarks** — Maps roles to salary ranges
6. **Org Chart** — Renders the organizational hierarchy
