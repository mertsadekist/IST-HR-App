# IST HR Management System — Technical Documentation

## Overview

The **IST Group HR Management System** is a monolithic, single-page application (SPA) built as a single HTML file (~10,500 lines, ~900 KB). It serves as a comprehensive Human Resources management platform for two business entities:

- **IST Real Estate (RE)** — Real estate brokerage based in the UAE
- **IST Markets (MKT)** — Financial markets / forex brokerage

The system covers the full employee lifecycle: recruitment → onboarding → active employment → performance management → offboarding, along with legal compliance, asset management, payroll calculations, and organizational charting.

---

## Technology Stack

| Layer           | Technology                          |
|-----------------|-------------------------------------|
| **Frontend**    | Vanilla HTML / CSS / JavaScript     |
| **Data Storage**| `localStorage` + `IndexedDB`        |
| **PDF Parsing** | PDF.js (v3.11.174, CDN-hosted)      |
| **DOCX Parsing**| Mammoth.js (CDN-hosted)             |
| **Architecture**| Single-file SPA (monolithic)        |
| **Deployment**  | Static file — no server required    |

---

## Documentation Structure

This documentation is organized into the following modules:

### Architecture
- [Architecture Overview](./architecture/overview.md) — App stack, state management, and data flow
- [Data Layer](./architecture/data_layer.md) — localStorage keys, IndexedDB schemas, and persistence
- [Navigation & Routing](./architecture/navigation.md) — Sidebar, entity switching, and SPA routing
- [Authentication & Users](./architecture/authentication.md) — Login system and role-based access control

### Core Modules
- [Dashboard](./modules/dashboard.md) — Overview statistics and summary cards
- [ATS Pipeline](./modules/ats_pipeline.md) — Kanban-based candidate tracking
- [Candidates](./modules/candidates.md) — Full candidate profile management
- [Vacancies](./modules/vacancies.md) — Job vacancy management and hiring blueprint
- [CV Scorer](./modules/cv_scorer.md) — AI-style CV scoring and shortlisting engine

### Employee Lifecycle
- [Onboarding](./modules/onboarding.md) — Multi-step onboarding workflow with SLAs
- [Assets](./modules/assets.md) — IT asset assignment, inventory, and catalog
- [Performance](./modules/performance.md) — KPI targets and quarterly tracking
- [Offboarding](./modules/offboarding.md) — 6-step exit process with gratuity calculator

### Legal & Compliance
- [Legal Letter Generator](./modules/legal_letters.md) — Warning, termination, NOC, and offer letter templates
- [Payroll & Labour Law](./modules/payroll.md) — Exit settlement, absence deductions, and compliance tools
- [Company Documents](./modules/company_documents.md) — Secure document storage via IndexedDB

### Analytics & Admin
- [Reports](./modules/reports.md) — Pipeline, journey, and employee analytics
- [Audit Log](./modules/audit_log.md) — Append-only action trail
- [HR KPI & Commission Tracker](./modules/kpi_tracker.md) — Recruiter commission tracking
- [Org Chart](./modules/org_chart.md) — Interactive SVG-based organizational chart
- [User Management](./modules/user_management.md) — User CRUD and role assignment

### Data Definitions
- [Organization Structure (IST_ORG)](./data/organization_structure.md) — Entity → Department → Job Title hierarchy
- [Salary Benchmarks](./data/salary_benchmarks.md) — Salary ranges by role and seniority
- [Skills Library](./data/skills_library.md) — Categorized skills for candidate profiling
- [Asset Catalog](./data/asset_catalog.md) — Platform and hardware catalog definitions

---

## Key Architectural Decisions

1. **Monolithic SPA**: Entire application in one HTML file — easy deployment, hard to maintain
2. **Client-side only**: All data stored in the browser — no backend, no database server
3. **Entity-driven**: Almost every module filters and branches based on `RE` vs `MKT`
4. **Dual storage**: `localStorage` for structured JSON data, `IndexedDB` for binary documents
5. **Role-based UI**: Login system with 4 roles (Admin, HR Manager, Recruiter, Employee) controlling visibility

---

## Quick Reference: Module Map

```
Line Range    | Module
--------------|-----------------------
1-482         | CSS Styles
483-607       | PDF.js Setup + IndexedDB for Docs
608-856       | Company Documents
857-1407      | Legal Letter Generator
1408-1460     | Dashboard
1461-2945     | Vacancies (incl. Hiring Blueprint)
2946-3924     | ATS Pipeline (Kanban)
3925-4844     | Onboarding
4845-5563     | Candidates
5564-5996     | Assets
5997-6227     | Performance
6228-6664     | Offboarding
6665-7374     | Payroll & Labour Law
7375-7988     | CV Scorer
7989-8100     | Reports
8101-8164     | Audit Log + Seed Data
8165-9037     | CV Upload & Auto-Parse
9038-9218     | User Management
9219-10429    | HR KPI & Commission Tracker
10430-10488   | Org Chart
```
