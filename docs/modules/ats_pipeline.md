# ATS Pipeline Module

## Overview

The **Applicant Tracking System (ATS) Pipeline** is a **Kanban-style drag-and-drop board** for managing candidate progression through the hiring process. It is the primary recruitment interface.

**Render Function**: `render_ats()` (Line ~2946)

---

## Pipeline Stages

The ATS uses a predefined set of stages defined in the `ATS_STAGES` constant:

| # | Stage Name               | Color    | Text   | Description                           |
|---|--------------------------|----------|--------|---------------------------------------|
| 1 | New Applicants           | `#EDE9FE`| `#5B21B6` | Freshly received applications       |
| 2 | Potentials/Shortlisted   | `#DBEAFE`| `#1E40AF` | Screened and shortlisted            |
| 3 | Contacted/Follow-up      | `#FEF3C7`| `#92400E` | Reached out, awaiting response       |
| 4 | No Answer                | `#F3F4F6`| `#6B7280` | Unreachable candidates               |
| 5 | Scheduled Interview      | `#CFFAFE`| `#155E75` | Interview date confirmed             |
| 6 | 1st Interview            | `#D1FAE5`| `#065F46` | First interview completed            |
| 7 | 2nd Interview            | `#C7D2FE`| `#3730A3` | Second interview completed           |
| 8 | Offer                    | `#FEE2E2`| `#991B1B` | Offer extended                       |
| 9 | Joining                  | `#FCE7F3`| `#9D174D` | Accepted, pending start date         |
| 10| Success                  | `#D1FAE5`| `#065F46` | Joined successfully → onboarding     |
| 11| Not Interested           | `#F3F4F6`| `#6B7280` | Candidate declined                   |
| 12| Blacklisted              | `#1F2937`| `#F9FAFB` | Permanently blocked                  |
| 13| Failed                   | `#FEE2E2`| `#991B1B` | Failed interview/assessment          |

---

## Kanban Board

### Visual Structure

```
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  New     │ │ Shortlist│ │ Contact  │ │ No Ans.  │  ...
│ (3)      │ │ (2)      │ │ (1)      │ │ (1)      │
├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤
│ Card 1   │ │ Card A   │ │ Card X   │ │ Card Z   │
│ Card 2   │ │ Card B   │ │          │ │          │
│ Card 3   │ │          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Kanban Card Content

Each `.k-card` displays:
- **Candidate name** (bold)
- **Job title / role**
- **Entity badge** (RE/MKT)
- **Score stars** (1-5)
- **Date** (when moved to current stage)
- **Action buttons**: View Profile, Move to Stage dropdown

### Drag & Drop

The Kanban board supports native HTML5 drag-and-drop:

| Event         | Handler                    | Action                                |
|---------------|---------------------------|---------------------------------------|
| `dragstart`   | On `.k-card`              | Sets dragging state, stores candidate ID |
| `dragover`    | On `.k-col-body`          | Highlights drop target, shows placeholder |
| `dragleave`   | On `.k-col-body`          | Removes highlight                     |
| `drop`        | On `.k-col-body`          | Moves candidate to new stage          |
| `dragend`     | On `.k-card`              | Cleans up dragging state              |

### Stage Transition Logic

When a candidate is moved to a new stage:

```javascript
function moveCandidate(candidateId, newStage) {
  // 1. Update candidate's currentStage
  // 2. Add entry to stageHistory array
  // 3. If newStage === 'Success': 
  //    a. Create employee record
  //    b. Trigger onboarding workflow
  //    c. Set candidate status to 'Hired'
  // 4. If newStage === 'Blacklisted' or 'Failed':
  //    a. Set candidate status to 'Failed'
  // 5. Add audit log entry
  // 6. Re-render the board
}
```

---

## Pipeline Filters

Above the Kanban board, filter pills allow quick filtering:
- **Stage pills** — Click to highlight a specific stage
- **Entity filter** — RE / MKT / ALL
- **Vacancy filter** — Filter by specific vacancy

---

## WATI Tags Integration

When viewing a candidate, the system generates **WATI CRM tags** for WhatsApp integration:

```javascript
function buildWatiTags(candidate) {
  // Generates tags like:
  // IST_RE_Sales_SeniorAgent_Apr2026
  // Based on: entity, department, jobTitle, date
}
```

Tags are displayed in a copy-to-clipboard interface for pasting into the WATI CRM system.

---

## Key Functions

| Function                    | Purpose                                    |
|-----------------------------|--------------------------------------------|
| `render_ats()`              | Renders the full Kanban board              |
| `renderKanban()`            | Builds individual Kanban columns           |
| `moveCandidate(id, stage)`  | Handles stage transitions                  |
| `openCandidateProfile(id)`  | Opens detailed candidate modal             |
| `buildWatiTags(candidate)`  | Generates WATI integration tags            |
