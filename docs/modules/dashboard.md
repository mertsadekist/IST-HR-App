# Dashboard Module

## Overview

The **Dashboard** is the landing page after login. It provides summary statistics and quick-access metrics across all HR operations.

**Render Function**: `render_dashboard()` (Line ~1408)

---

## Statistics Cards

The dashboard displays a grid of stat cards summarizing:

| Metric              | Source                    | Description                            |
|---------------------|---------------------------|----------------------------------------|
| Total Candidates    | `candidates` collection   | All candidates in pipeline             |
| Active in Pipeline  | `candidates` (Active)     | Candidates with status "Active"        |
| Hired               | `candidates` (Hired)      | Successfully hired candidates          |
| Open Vacancies      | `vacancies` (Open)        | Currently active job openings          |
| Employees           | `employees` collection    | Total employee count                   |
| Onboarding          | `onboarding` collection   | Active onboarding processes            |
| Offboarding         | `offboarding` collection  | Active offboarding processes           |

All metrics respect the current **entity filter** (`currentEntity`).

---

## Key Functions

| Function             | Purpose                                    |
|----------------------|--------------------------------------------|
| `render_dashboard()` | Renders the dashboard statistics           |
