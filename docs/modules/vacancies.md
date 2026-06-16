# Vacancies Module

## Overview

The **Vacancies Module** manages job openings and includes the **Hiring Blueprint** — a comprehensive role-definition framework that maps entities to departments, job titles, seniority levels, and salary benchmarks.

**Render Function**: `render_vacancies()` (Line ~1461)

---

## Vacancy Data Model

```javascript
{
  id: "v001",
  title: "Senior Sales Agent",
  entity: "RE",
  department: "Sales",
  headCount: 2,
  status: "Open",                   // "Draft", "Open", "Closed", "On Hold"
  description: "Senior sales agent for off-plan properties",
  createdDate: "2026-04-01",
  createdBy: "HR"
}
```

---

## Vacancy Statuses

| Status    | Description                          | Badge Color |
|-----------|--------------------------------------|-------------|
| Draft     | Being prepared, not yet published    | Gray        |
| Open      | Actively recruiting                  | Green       |
| On Hold   | Temporarily paused                   | Orange      |
| Closed    | Position filled or cancelled         | Red         |

---

## Vacancy Table Columns

| Column      | Content                              |
|-------------|--------------------------------------|
| Title       | Job title                            |
| Entity      | RE/MKT badge                         |
| Department  | Department name                      |
| Head Count  | Number of positions                  |
| Status      | Status badge                         |
| Created     | Creation date                        |
| Actions     | Edit, Close, View Candidates         |

---

## Hiring Blueprint

The Hiring Blueprint is defined in the `IST_ORG` constant and provides a hierarchical structure:

```
Entity → Department → Job Titles (with seniority levels)
```

### IST Real Estate Departments

| Department       | Key Roles                                          |
|------------------|----------------------------------------------------|
| Sales            | Sales Agent, Senior Agent, Team Leader             |
| Operations       | Sales Coordinator, Admin Assistant                 |
| Marketing        | Social Media Manager, Content Creator              |
| IT               | IT Support, System Administrator                   |
| Finance          | Accountant, Finance Manager                        |
| HR               | HR Officer, Recruiter                              |

### IST Markets Departments

| Department          | Key Roles                                       |
|---------------------|-------------------------------------------------|
| Sales               | Account Manager, Senior Account Manager         |
| Business Development| BDM, Senior BDM, BD Director                    |
| Compliance          | Compliance Officer, AML Analyst                 |
| IT                  | Developer, IT Manager                            |
| Marketing           | Digital Marketing Manager, Content Manager       |
| Finance             | Accountant, Finance Controller                   |
| Operations          | Operations Manager, Dealing Room Manager        |
| HR                  | HR Manager, Recruiter                            |

### Seniority Levels

Each job title has defined seniority levels that affect salary benchmarks:
- Junior
- Mid-level
- Senior
- Team Lead
- Manager
- Director

---

## Add Vacancy Modal

| Field ID    | Label              | Type     | Required |
|-------------|---------------------|----------|----------|
| `vt`        | Title               | text     | Yes      |
| `ve`        | Entity              | select   | Yes      |
| `vd`        | Department          | select   | Yes      |
| `vh`        | Head Count          | number   | Yes      |
| `vs`        | Status              | select   | Yes      |
| `vdesc`     | Description         | textarea | No       |

**Smart Behavior**: Department dropdown dynamically populates based on selected entity, drawing from the `IST_ORG` structure.

---

## Key Functions

| Function                 | Purpose                                    |
|--------------------------|--------------------------------------------|
| `render_vacancies()`     | Renders vacancies list and hiring blueprint |
| `openAddVacancy()`       | Opens add vacancy modal                    |
| `saveVacancy()`          | Creates/updates a vacancy record           |
| `closeVacancy(id)`       | Sets vacancy status to "Closed"            |
| `editVacancy(id)`        | Opens pre-filled edit modal                |
