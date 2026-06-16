# CV Scorer Module

## Overview

The **CV Scorer** is a multi-step tool for defining a vacancy profile, uploading candidate CVs, and scoring them against the profile criteria. It uses **keyword matching, experience analysis, and weighted scoring**.

**Render Function**: `render_cvscorer()` (Line ~7375)

---

## Sub-Tabs

| Tab         | Title                | Purpose                                    |
|-------------|----------------------|--------------------------------------------|
| `setup`     | 📋 Vacancy Profile   | Define job requirements and scoring weights |
| `cvs`       | 📄 Candidate CVs     | Upload and manage candidate CVs            |
| `results`   | 📊 Score & Results   | View scoring breakdown and rankings        |
| `shortlist` | ⭐ Shortlist          | Final shortlist with interview questions   |

---

## Step 1: Vacancy Profile Setup

### Basic Fields

| Field ID           | Label                        | Type     |
|--------------------|------------------------------|----------|
| `cvs-p-title`      | Job Title                    | text     |
| `cvs-p-dept`       | Department                   | text     |
| `cvs-p-loc`        | Location                     | text     |
| `cvs-p-type`       | Employment Type              | text     |
| `cvs-p-seniority`  | Seniority                    | text     |
| `cvs-p-reports`    | Reporting To                 | text     |
| `cvs-p-salary`     | Salary Range (optional)      | text     |
| `cvs-p-entity`     | Entity / Brand               | text     |
| `cvs-p-minyrs`     | Min. Years Experience        | text     |

### Tag-Based Fields (Interactive)

Tag inputs allow typing and pressing Enter to add items:

| Field        | Label                    | Color    | Purpose                        |
|--------------|--------------------------|----------|--------------------------------|
| `mustHave`   | Must-Have Skills ★       | Red      | Required skills (critical)     |
| `niceHave`   | Nice-to-Have Skills      | Gold     | Preferred but not required     |
| `tools`      | Required Tools/Tech      | Blue     | Specific tools and platforms   |
| `languages`  | Required Languages       | Green    | Language requirements          |
| `industries` | Required Industries      | Default  | Industry experience            |
| `keywords`   | ATS Keyword Bank         | Default  | 20-40 scoring keywords         |

### Education Requirement

Dropdown with levels: Any, High School, Diploma, Bachelor's Degree, Master's Degree, PhD

### Scoring Weights (Must total 100%)

| Weight ID   | Category                 | Default | Description                     |
|-------------|--------------------------|---------|----------------------------------|
| `cvs-w-q`   | CV Quality / Writing     | 10%     | Structure, quantification, clarity |
| `cvs-w-e`   | Relevant Experience      | 30%     | Years + role match + industry    |
| `cvs-w-r`   | Requirement Match        | 30%     | Keyword + skills overlap         |
| `cvs-w-l`   | Languages                | 10%     | Language proficiency confirmed   |
| `cvs-w-d`   | Academic Qualifications  | 10%     | Degree level and field match     |
| `cvs-w-a`   | AI Awareness             | 10%     | AI tools, automation, LLM usage  |

---

## Step 2: Candidate CVs

### CV Upload

Supports three file formats:
- **PDF** — Parsed using `PDF.js`
- **DOCX** — Parsed using `Mammoth.js`
- **TXT** — Direct text reading

### CV Auto-Parse

The `handleCVFile()` function:
1. Detects file type
2. Extracts raw text content
3. Runs regex-based extraction for:
   - Name (from filename or content patterns)
   - Email
   - Phone number
   - Skills (matched against Skills Library)
   - Education level (degree detection patterns)
   - Experience years (number extraction)

### Education Detection Patterns

```javascript
CVS_EDU_LEVELS = [
  { re: /ph\.?d|doctor/i, label: "PhD", idx: 5 },
  { re: /master[s']?|m\.?s\.?|mba|m\.?a\./i, label: "Master's", idx: 4 },
  { re: /bachelor[s']?|b\.?s\.?|bsc|b\.?a\./i, label: "Bachelor's", idx: 3 },
  { re: /diploma|hnd|hnc/i, label: "Diploma", idx: 2 },
  { re: /high school|secondary|a.level|gcse/i, label: "High School", idx: 1 }
];
```

---

## Step 3: Scoring & Results

### Scoring Algorithm

Each candidate is scored against the vacancy profile:

```
Final Score = Σ (Category Score × Category Weight)

Where each Category Score (0-100) is:
- Quality: Manual/heuristic based on CV structure
- Experience: Years match + role relevance
- Requirements: (matched keywords ÷ total keywords) × 100
- Languages: % of required languages found
- Education: Level meets/exceeds requirement
- AI Awareness: AI-related terms found in CV
```

### Result Display

Results are shown in a ranked table with:
- Rank number
- Candidate name
- Overall score (with color-coded bar)
- Score breakdown by category
- Status badge (Strong Fit / Good Fit / Partial Fit / Weak Fit)
- Shortlist toggle button

---

## Step 4: Shortlist

### Features
- Filtered view of shortlisted candidates only
- Auto-generated interview questions based on role
- Export shortlist report as text file

### Export Function

`cvsExportReport()` generates a downloadable text file containing:
- Vacancy summary
- Ranked shortlist with scores
- Interview questions per candidate

---

## Key Functions

| Function                 | Purpose                                    |
|--------------------------|--------------------------------------------|
| `render_cvscorer()`      | Renders the active tab                     |
| `cvsSetupHTML()`         | Builds the vacancy profile form            |
| `cvsCandidatesHTML()`    | Builds the CV upload/management view       |
| `cvsResultsHTML()`       | Builds the scoring results view            |
| `cvsShortlistHTML()`     | Builds the shortlist view                  |
| `cvsSaveProfile()`       | Saves vacancy profile to localStorage      |
| `cvsAutoKW()`            | Auto-generates keyword bank from inputs    |
| `cvsGenJD()`             | Generates a full job description            |
| `cvsScoreAll()`          | Runs scoring algorithm on all candidates   |
| `cvsExportReport()`      | Exports shortlist as text file             |
