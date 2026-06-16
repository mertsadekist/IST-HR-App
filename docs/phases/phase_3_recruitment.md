# Phase 4: Recruitment Modules — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 4-6
> **Depends On**: Phase 2 (Frontend), Phase 3 (Settings in DB)
> **Data Source**: MySQL via REST API + DeepSeek AI for scoring/generation

---

## 3.1 — Dashboard Page

### Page: `/dashboard`
### File: `pages/dashboard/Dashboard.jsx`

### UI Layout
```
┌────────┬────────┬────────┬────────┬────────┐
│Candidates│Active │ Hired  │Open Vac│Employees│  ← Stat cards
│  125    │  42   │  31    │  8     │  72     │
└────────┴────────┴────────┴────────┴────────┘

┌────────────────────────┬──────────────────────┐
│ Pipeline Funnel        │ Hires by Month       │
│ [ApexChart - Funnel]   │ [ApexChart - Bar]    │
│                        │                      │
└────────────────────────┴──────────────────────┘

┌────────────────────────┬──────────────────────┐
│ Entity Distribution    │ Recent Activity      │
│ [ApexChart - Donut]    │ • Maya moved to Offer│
│    RE: 60%   MKT: 40% │ • New vacancy created│
│                        │ • John onboarded     │
└────────────────────────┴──────────────────────┘
```

### Charts Configuration
- **Pipeline Funnel**: ApexCharts, data from `GET /api/reports/pipeline` (SQL aggregation)
- **Hires by Month**: Bar chart, from `GET /api/reports/hires-by-month`
- **Entity Distribution**: Donut chart, from `GET /api/reports/entity-distribution`
- **Recent Activity**: from `GET /api/audit?limit=10`

### Quick Actions Panel
- "Add Candidate" → opens add candidate modal
- "Create Vacancy" → navigates to vacancies
- "View Reports" → navigates to reports

**Acceptance Criteria**:
- [ ] All stat cards show correct filtered counts
- [ ] Charts render with real data
- [ ] Entity filter changes update all cards and charts
- [ ] Recent activity shows last 10 audit entries
- [ ] Responsive grid layout

---

## 3.2 — Vacancies Page

### Page: `/vacancies`
### Files:
- `pages/recruitment/Vacancies.jsx` — Main page
- `pages/recruitment/components/VacancyTable.jsx` — Table component
- `pages/recruitment/components/VacancyForm.jsx` — Add/Edit form
- `pages/recruitment/components/HiringBlueprint.jsx` — Blueprint view

### Sub-tabs: Vacancies List | Hiring Blueprint

### Vacancy Table (React Table)
| Column       | Sortable | Filterable | Notes                  |
|-------------|----------|------------|------------------------|
| Title       | Yes      | Search     |                        |
| Company     | Yes      | Dropdown   | From company registry  |
| Department  | Yes      | Dropdown   | From dept settings     |
| Head Count  | Yes      | —          |                        |
| Status      | Yes      | Dropdown   | Draft/Open/Hold/Closed |
| Created     | Yes      | Date range |                        |
| Candidates  | Yes      | —          | Linked count           |
| Actions     | —        | —          | Edit, Close, View      |

### Vacancy Form (React Hook Form + Yup)
```js
const vacancySchema = yup.object({
  title: yup.string().required('Title is required'),
  companyId: yup.string().required('Company is required'),
  departmentId: yup.string().required('Department is required'),
  headCount: yup.number().min(1).required(),
  status: yup.string().oneOf(['Draft', 'Open', 'On Hold', 'Closed']).required(),
  description: yup.string(),
});
```

### Hiring Blueprint
- Tree view: Company → Department → Job Titles
- Each role shows seniority levels and salary ranges
- Data sourced entirely from Settings (Phase 2)

**Acceptance Criteria**:
- [ ] Table with sorting, filtering, pagination
- [ ] Add/Edit modal with dynamic dropdowns (company → dept)
- [ ] Status transitions with audit logging
- [ ] Hiring Blueprint reflects settings data

---

## 3.3 — ATS Pipeline Page (Kanban)

### Page: `/ats`
### Files:
- `pages/recruitment/ATSPipeline.jsx` — Main Kanban page
- `pages/recruitment/components/KanbanBoard.jsx` — DnD board
- `pages/recruitment/components/KanbanColumn.jsx` — Stage column
- `pages/recruitment/components/KanbanCard.jsx` — Candidate card
- `pages/recruitment/components/StageTransition.jsx` — Move logic

### Kanban Board Layout
```
[Filter: Entity ▼] [Filter: Vacancy ▼] [🔍 Search]

┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│ New (12)  │ │Short (5) │ │Contact(3)│ │Sched.(2) │ ...
├──────────┤ ├──────────┤ ├──────────┤ ├──────────┤
│┌────────┐│ │┌────────┐│ │┌────────┐│ │          │
││ Card 1 ││ ││ Card A ││ ││ Card X ││ │          │
│├────────┤│ │├────────┤│ │└────────┘│ │          │
││ Card 2 ││ ││ Card B ││ │          │ │          │
│├────────┤│ │└────────┘│ │          │ │          │
││ Card 3 ││ │          │ │          │ │          │
│└────────┘│ │          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘
```

### Kanban Card Design
```
┌─────────────────────────────┐
│ [RE] Ahmed Al Rashidi       │
│ Senior Sales Agent          │
│ ★★★★☆  ·  2 Apr 2026       │
│ [👤 View]  [→ Move ▼]       │
└─────────────────────────────┘
```

### Stage Transition Rules
```js
function handleDrop(candidateId, newStage) {
  // 1. Update candidate.currentStage
  // 2. Push to candidate.stageHistory
  // 3. Special rules:
  if (isSuccessStage(newStage)) {
    createEmployee(candidate);
    createOnboarding(employee);
    candidate.status = 'Hired';
  }
  if (isFailStage(newStage)) {
    candidate.status = 'Failed';
  }
  // 4. addAudit('ATS', 'Stage Changed', detail)
  // 5. Re-render board
}
```

### WATI Tags Panel
When viewing a candidate, generate CRM tags:
```
{COMPANY}_{DEPT}_{ROLE}_{MONTH}{YEAR}
```

**Acceptance Criteria**:
- [ ] Drag-and-drop works between all columns
- [ ] "Success" stage creates employee + onboarding
- [ ] "Failed/Blacklisted" updates candidate status
- [ ] Filter by entity, vacancy, and search
- [ ] WATI tags generate correctly
- [ ] Stage counts update in real-time
- [ ] Horizontal scroll for many stages

---

## 3.4 — Candidates Page

### Page: `/candidates`
### Files:
- `pages/recruitment/Candidates.jsx` — List page
- `pages/recruitment/components/CandidateCard.jsx` — Card component
- `pages/recruitment/components/CandidateProfile.jsx` — Full profile
- `pages/recruitment/components/CandidateForm.jsx` — Add/Edit form

### Candidate Profile Tabs
1. **Overview** — Avatar, contact info, entity, score
2. **Timeline** — Stage transitions + notes (chronological)
3. **Skills** — Selected from Skills Library
4. **Education** — Degree, institution, dates
5. **Work History** — Previous roles, companies, responsibilities
6. **Documents** — Uploaded files (CV, ID docs)

**Acceptance Criteria**:
- [ ] Card list with search/filter/sort
- [ ] Full profile modal with all 6 tabs
- [ ] Add/Edit candidate form with validation
- [ ] Score rating interactive (click stars)
- [ ] Timeline shows all activity

---

## 3.5 — CV Upload & Auto-Parse

### Component: `pages/recruitment/components/CVUploadModal.jsx`

### Flow
```
1. Open modal → Drag-and-drop zone
2. File selected → Detect type (PDF/DOCX/TXT)
3. Parse text → Extract structured data
4. Show pre-filled form → User reviews/edits
5. Save → Creates new candidate
```

### Extraction Patterns
| Field       | Pattern                                  |
|-------------|------------------------------------------|
| Email       | `/[\w.-]+@[\w.-]+\.\w+/`                 |
| Phone       | `/\+?\d[\d\s()-]{7,}/`                   |
| Name        | From filename or first lines of content  |
| Education   | Degree keyword matching                  |
| Experience  | Year number extraction near "experience" |
| Skills      | Match against Skills Library             |

**Acceptance Criteria**:
- [ ] PDF, DOCX, TXT all parse correctly
- [ ] Auto-extracted fields are editable before save
- [ ] Skills auto-match from library
- [ ] File stored as attachment on candidate

---

## 3.6 — CV Scorer Page

### Page: `/cv-scorer`
### Files:
- `pages/recruitment/CVScorer.jsx` — Main tabbed page
- `pages/recruitment/components/VacancyProfileSetup.jsx`
- `pages/recruitment/components/CVScoringEngine.jsx`
- `pages/recruitment/components/ShortlistView.jsx`

### Sub-tabs: Profile Setup | CVs | Results | Shortlist

### Scoring Algorithm
```
Score = Σ (CategoryScore × Weight)

Categories:
- Quality (10%): CV structure and presentation
- Experience (30%): Years + role match
- Requirements (30%): Keyword overlap percentage
- Languages (10%): Required languages found
- Education (10%): Level meets requirement
- AI Awareness (10%): AI-related terms detected
```

### Results Table
| Column      | Content                          |
|-------------|----------------------------------|
| Rank        | Score-based rank                 |
| Candidate   | Name                             |
| Score       | Color-coded progress bar         |
| Breakdown   | Mini bars per category           |
| Fit Level   | Strong / Good / Partial / Weak   |
| Shortlist   | Toggle button                    |

**Acceptance Criteria**:
- [ ] Profile setup with tag inputs and weights
- [ ] CV upload and parsing for scoring
- [ ] Scoring algorithm produces consistent results
- [ ] Shortlist export as downloadable report
