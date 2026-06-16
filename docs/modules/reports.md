# Reports Module

## Overview

The **Reports Module** provides analytical views across recruitment, candidate journey, employee status, and onboarding progress.

**Render Function**: `render_reports()` (Line ~7989)

---

## Report Tabs

| Tab           | Title              | Content                                    |
|---------------|--------------------|--------------------------------------------|
| `rPipeline`   | Pipeline           | ATS stage breakdown and pipeline totals    |
| `rJourney`    | Candidate Journey  | Time-to-hire analysis for hired candidates |
| `rEmployees`  | Employees          | Employee status and entity distribution    |
| `rOnboarding` | Onboarding         | Onboarding progress per employee           |

---

## Pipeline Report

### Stage Breakdown
Lists each ATS stage with candidate count, displayed with color-coded badges matching the Kanban colors.

### Pipeline Totals
- **Total Candidates**: All candidates in the system
- **In Pipeline**: Candidates with "Active" status
- **Hired**: Successfully hired
- **Failed/Rejected**: Candidates with "Failed" status

---

## Candidate Journey Report

Tracks the time from **Shortlisted → Joining** for hired candidates:

| Column        | Content                                    |
|---------------|--------------------------------------------|
| Candidate     | Full name                                  |
| Entity        | RE/MKT badge                               |
| Shortlisted   | Date first shortlisted                     |
| Offer Date    | Date offer was extended                    |
| Joining/Success| Date candidate joined                     |
| Total Days    | Days from shortlist to joining (color-coded)|

### Time-to-Hire Color Coding
- **Green** (≤30 days): Fast hire
- **Orange** (≤45 days): Average
- **Red** (>45 days): Slow hire

---

## Employee Report

### Status Breakdown
| Status      | Badge Color |
|-------------|-------------|
| Onboarding  | Orange      |
| Active      | Green       |
| Offboarding | Red         |
| Exited      | Gray        |

### Entity Distribution
Shows employee count split between IST Real Estate and IST Markets.

---

## Onboarding Report

Displays all onboarding records with:
- Employee name and entity badge
- Steps completed ratio (e.g., "3/8 · 37%")
- Visual progress bar

---

## Key Functions

| Function                        | Purpose                                    |
|---------------------------------|--------------------------------------------|
| `render_reports()`              | Renders all report tabs                    |
| `switchReportTab(el, targetId)` | Switches between report views              |
