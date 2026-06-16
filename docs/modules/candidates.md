# Candidates Module

## Overview

The **Candidates Module** provides a full-featured candidate profile management interface with search, filtering, and detailed profile views.

**Render Function**: `render_candidates()` (Line ~4845)

---

## Candidate List View

### Candidate Cards

Each candidate is displayed as a card (`.cand-card`) showing:
- **Name** (bold, clickable)
- **Entity badge** (RE/MKT)
- **Job title**
- **Current pipeline stage** (color-coded badge)
- **Score** (star rating 1-5)
- **Applied date**
- **Status** (Active/Hired/Failed)

### Search & Filters

| Filter          | Purpose                                    |
|-----------------|---------------------------------------------|
| Text search     | Search by name, email, or phone             |
| Entity filter   | RE / MKT / ALL                              |
| Stage filter    | Filter by current pipeline stage            |
| Status filter   | Active / Hired / Failed                     |
| Vacancy filter  | Filter by assigned vacancy                  |

---

## Candidate Profile Modal

The full candidate profile opens in a tabbed modal:

### Tab: Overview
- Avatar with initials
- Full name, email, phone, nationality
- Entity and job title
- Score and current stage
- Applied date
- WATI tags display

### Tab: Timeline / Activity
Activity feed showing all stage transitions and notes:
- Stage changes with dates and who moved them
- Notes added at each stage
- CV upload events
- Add new note/activity form

### Tab: Work History
- Company, job title, date range
- Description of responsibilities
- Visual timeline with dots

### Tab: Education
- Degree, institution
- Date range
- Cards with academic details

### Tab: Documents
- Uploaded CV/resume
- ID documents
- Contract/offer letter uploads

---

## Add Candidate Modal

| Field ID    | Label              | Type     | Required |
|-------------|---------------------|----------|----------|
| `cf`        | First Name          | text     | Yes      |
| `cl`        | Last Name           | text     | Yes      |
| `ce`        | Email               | text     | Yes      |
| `cp`        | Phone               | text     | No       |
| `cn`        | Nationality         | text     | No       |
| `cv`        | Vacancy             | select   | No       |
| `cs`        | Score (1-5)         | select   | Yes      |
| `cen`       | Entity              | select   | Yes      |
| `cno`       | Notes               | textarea | No       |

---

## CV Upload & Auto-Parse

The CV Upload feature (`openCVUpload()`) supports:
- **Drag-and-drop** file upload
- **PDF parsing** via PDF.js
- **DOCX parsing** via Mammoth.js
- **TXT** direct reading

### Auto-Parsed Fields
- Name (from filename or content)
- Email (regex extraction)
- Phone (regex extraction)
- Skills (matched against Skills Library)
- Education level (degree pattern matching)
- Years of experience (number extraction)

### Post-Parse Flow
```
File uploaded → Text extracted → Fields auto-filled → User reviews/edits → Save candidate
```

---

## Key Functions

| Function                        | Purpose                                    |
|---------------------------------|--------------------------------------------|
| `render_candidates()`           | Renders the candidate list view            |
| `openCandidateProfile(id)`      | Opens full candidate profile modal         |
| `openAddCandidate()`            | Opens the add candidate form               |
| `saveNewCandidate()`            | Creates a new candidate record             |
| `openCVUpload()`                | Opens CV upload modal                      |
| `handleCVFile(file)`            | Parses CV file and extracts data           |
| `addCandidateActivity(id, type)`| Adds a note/activity to candidate timeline |
