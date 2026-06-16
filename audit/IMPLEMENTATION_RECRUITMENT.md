# Recruitment Landing Page & ATS — Implementation

**Date:** 2026-06-13 · Design: `docs/modules/recruitment_landing_redesign.md`

A complete public job-application + applicant-tracking module, connected to the existing recruitment (`vacancies`, `candidates`, `ats_stages`), email, notifications, and **Onboarding v2** modules.

## Backend
- **Schema** (live + `schema.sql` + `migrations/recruitment_module.sql` + `apply_recruitment.mjs`): extended `vacancies` (public_slug, workplace/employment type, work_location, rich content, salary, deadline, recruitment_owner, additional_questions, published_at; status widened to Draft/Published/Paused/Closed/Archived); new tables `job_applications`, `application_consents`, `application_files`, `interviews`, `candidate_evaluations`, `application_events`.
- **Public routes** (`routes/public.js`, mounted `/api/public`, **no auth**, dedicated per-IP rate limit, honeypot):
  - `GET /jobs/:slug` — branded job view (company logo/name/colors + whitelisted job fields only).
  - `POST /jobs/:slug/apply` — consent-gated, validates fields, dedupes candidate by company+email, blocks duplicate application, stores + parses CV, records source + UTM + consent (ts/IP/version), creates application (stage "New Application"), notifies the recruitment owner (in-app + email), sends candidate confirmation email.
- **Internal routes** (`routes/applications.js`, mounted `/api/applications`, auth + tenantScope + RBAC + validate + audit): list (filters: vacancy/stage/source/date/search/assignee), detail (candidate+CV+timeline+interviews+evaluations), stage move (offer-stage email), rate, assign, shortlist, reject (+email), secure CV download, schedule interview (+invite email), update interview, evaluation scorecard, **convert → Onboarding v2** (creates linked onboarding record at HR_APPROVED, seeds verified profile from candidate + parsed CV, links CV file; idempotent), source analytics.
- **Vacancy lifecycle** (`routes/vacancies.js`): publish (generates slug, enforces required fields), pause/close/archive.
- **Emails** (`emailTemplates.js`): `application_confirmation`, `hr_new_application`, `offer_stage` (+ reuse `candidate_interview`, `candidate_rejected`).
- **Tests** (`tests/recruitment.test.js`, 10/10): publish → public view → consent-gate (422) → apply (UTM) → duplicate block (409) → list/source → isolation (404) → stage/interview/evaluation → convert-to-onboarding (+re-convert 409).

## Frontend
- **Public** `pages/public/CareersJob.jsx` at `/careers/:slug` (outside the app shell/auth): branded hero, full job sections, 4-step flow (review → privacy consent → form + CV dropzone → success), UTM captured from the URL, honeypot, mobile-first.
- **Internal** `pages/recruitment/Applicants.jsx` at `/applicants`: filterable/searchable applicant list, detail modal with CV download, star rating, stage move, reject, schedule-interview & evaluation forms, activity timeline, and **"To onboarding"** one-click handoff.
- **Vacancies** page extended: public job-page fields in the form, plus **Publish / Copy public link / Open public page** row actions.
- Sidebar: "Applicants" under Recruitment.

## Verification
- Full server suite: **126/126 passing** (13 suites). Client production build: green (CareersJob, Applicants, Vacancies chunks emitted). Backend restarted — `/api/public/*` (no-auth) and `/api/applications/*` (auth-gated) live.

## How to use
1. Vacancies → create a vacancy, fill the "Public job page details", Save.
2. Click the **Publish** (globe) action → public link is generated and copied. Use **Copy link** to share on LinkedIn/ads/email; **Open** to preview.
3. Candidates open `/careers/:slug`, review, accept consent, fill the form + upload CV, submit.
4. HR opens **Applicants** → review, rate, move stages, schedule interviews, evaluate, then **To onboarding** when hired → continues in Onboarding v2 (offer → signed offer → documents → visa → bank → completed → Employees section).

## Follow-ups (designed, not yet built)
Recruitment settings page (privacy text/fields/file rules/stages), career-site index page, source-ROI analytics dashboard, Kanban board view, interview self-scheduling, scorecard templates, LinkedIn/job-board feeds.
