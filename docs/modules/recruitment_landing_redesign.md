# Recruitment Landing Page & Applicant Tracking Module — Design & Implementation Plan

**Author:** Recruitment module design · **Date:** 2026-06-13
**Connects to:** existing `vacancies`, `candidates`, `ats_stages`, `candidate_stage_history`, Onboarding v2 (`onboarding_*`), Email service, Notifications.

---

## 0. Research summary (LinkedIn Jobs, Indeed, Workable, Greenhouse, Lever, BambooHR)

Patterns adopted from modern ATS platforms:

- **Public, branded, shareable job page** with a unique permanent URL (slug), mobile-first, SEO/OG tags, "Apply" CTA — like LinkedIn/Workable hosted job pages.
- **Two-step apply**: review job → consent → form + CV. Greenhouse/Lever capture consent (GDPR) explicitly and version it.
- **Source & UTM attribution** on every application (Lever/Greenhouse "source" + utm), powering channel ROI reporting.
- **Candidate ≠ application**: a person can apply to many roles; dedupe by email per company (Workable/Greenhouse). Re-applying to the same open role is blocked.
- **Pipeline (Kanban) stages** with per-stage owner, notes, score, timestamps, and a full activity timeline (Lever/Greenhouse).
- **Structured interviews & scorecards** (Greenhouse "scorecards", Lever "feedback forms") for consistent, bias-reduced evaluation.
- **One-click convert to hire/onboarding** carrying CV + parsed data + history forward (BambooHR ATS→HRIS handoff) — no re-entry.
- **CV parsing** to pre-fill candidate data (Workable/Sovren-style).
- **Configurable per company**: form fields, privacy text, stages, file rules, email templates.

The build reuses what already exists (`candidates`, `ats_stages`, Onboarding v2, email/notification services) and adds the public surface + application/interview/evaluation layer.

---

## 1. Public job application page workflow

```
Ad / LinkedIn / email link  →  /careers/:slug?utm_source=...&utm_campaign=...
        │
        ▼
 GET /api/public/jobs/:slug  →  branded job view (company logo/name/colors + job details)
        │  [Start Application]
        ▼
 Step 2: Privacy & data-protection consent (must tick)  ──► consent captured (ts, IP, version)
        │
        ▼
 Step 3: Application form + CV upload (validated)
        │  [Submit]
        ▼
 POST /api/public/jobs/:slug/apply (multipart)
        ├─ dedupe candidate by (company,email) → create or reuse candidate
        ├─ block duplicate application to the same open vacancy
        ├─ store CV file + parse → candidate profile + application
        ├─ persist consent + source + UTM
        ├─ create job_application (stage = "New Application")
        ├─ notify recruitment owner (in-app + email)
        └─ send candidate confirmation email
        ▼
 Success screen
```
Public endpoints require **no login**, are **rate-limited**, and only expose published, non-expired vacancies and minimal public company branding.

## 2. Internal job vacancy creation workflow

HR opens the Vacancies page → "New Vacancy" → fills the rich form (§4 below) → saves as **Draft**. Publishing requires all required fields and generates a permanent **public slug**. Status lifecycle: `Draft → Published → Paused → Closed → Archived`. Publishing/closing/archiving are audit-logged. Optional auto-close after `application_deadline`.

## 3. Multi-company branding logic

Every vacancy belongs to one `company_id`. The public page derives branding from that company: `logo`, `name`, `description`/`industry`, `color_primary`/`color_secondary`, and (optional) `address`/`website`/`email`. The public job endpoint returns only these whitelisted public branding fields (never internal data). Internal lists are tenant-scoped via the existing `tenantScope` middleware; HR sees only authorized companies.

## 4. Candidate application form fields

**Vacancy fields (internal):** hiring company*, job title*, department, work location*, employment type* (Full-time/Part-time/Contract/Temporary/Internship), workplace type* (Onsite/Hybrid/Remote), open positions, reporting manager, job description*, key responsibilities, required qualifications, required experience, required skills, preferred skills, languages, salary min/max + show-salary flag, benefits, working hours, application deadline, expected joining date, internal notes, recruitment owner (HR user), status.

**Application form (public):** first_name*, last_name*, email*, phone*, current_location, nationality, current_job_title, years_experience, expected_salary (req/optional per company setting), notice_period, available_date, linkedin_url, portfolio_url, cover_letter, dynamic `additional_questions` (configured per vacancy, stored as JSON answers), **CV file***, **privacy consent***.

Validation: required-field, email/phone format, numeric salary/experience, URL format, file type/size; server-side authoritative (the `validate` middleware + explicit checks).

## 5. CV upload & parsing logic

- Accept `.pdf/.doc/.docx`, max size from settings (default 10 MB), magic-type respected by the upload filter.
- File saved to disk/object storage (`uploads/cv_applications/`), metadata in DB (never a blob).
- Text extracted (`cvParserService`) → `deepseekService.parseEmployeeDocument` → structured fields (name, email, phone, education, skills, languages, work_experience, certifications). Failures degrade gracefully (form still submits; HR completes manually).
- Parsed JSON stored on the candidate (`ai_analysis`/`cv_text`) and referenced by the application; original CV always downloadable by authorized HR.

## 6. Privacy consent logic

A consent **must** be actively checked before submit. On apply, a row is written to `application_consents`: `accepted=1`, `consented_at`, `ip_address`, `vacancy_id`, `company_id`, `policy_version`. Submission is rejected (422) without consent. Privacy text + version are configurable per company (settings).

## 7. Recruitment source & UTM tracking

The public link carries `utm_source/medium/campaign/content/term` (+ a free `source`). These are captured from the query string and stored on the `job_applications` row, enabling channel ROI analytics ("which source yields the best candidates / most hires").

## 8. HR applicant management workflow

Authenticated, tenant-scoped: list applicants per vacancy (or all), search (name/email/phone), filter (source, date, stage, rating, assignee), open candidate/application detail (profile + parsed CV + CV download + timeline + interviews + evaluations), add notes, rate, move stage, (re)assign owner, shortlist/reject (with reason + email), schedule interviews, evaluate, and **convert to onboarding** when hired.

## 9. Recruitment pipeline stages

`job_applications.stage` ∈ { New Application, CV Screening, Shortlisted, HR Review, Phone Screening, First Interview, Technical Interview, Final Interview, Offer Preparation, Offer Sent, Offer Accepted, Offer Rejected, Hired, Rejected, Archived }. Each move records an `application_events` row (actor, from→to, note, timestamp). Per-application: `rating`, `assigned_to`, `next_action`, `follow_up_at`, `rejection_reason`.

## 10. Interview & evaluation process

- **Interviews** (`interviews`): type (Phone/Online/In-person/Technical/Final), interviewers, scheduled_at, location/meeting_link, notes, score, recommendation (Proceed/Hold/Reject), attachment, status (Scheduled/Completed/Cancelled). Visible in the candidate timeline; scheduling sends the candidate an invitation email.
- **Evaluations** (`candidate_evaluations`): structured scorecard — overall, skills_match, experience_match, communication, cultural_fit, salary_fit, availability, feedback, recommendation. Multiple evaluators supported; averages shown on the profile.

## 11. Connection with offer & onboarding modules

When an application reaches **Hired** (or **Offer Accepted**), HR clicks **"Create onboarding"**. The system creates an Onboarding v2 record (`onboarding_records`) linked to the same `company_id`, `candidate_id`, and `vacancy_id`, and seeds the onboarding **profile** from the candidate (name/email/phone/nationality/parsed CV). The CV file is linked as an onboarding file. Offer history then continues in the Onboarding v2 offer engine. No duplicate data entry; the application stores `onboarding_id` for cross-navigation.

## 12. Database tables & relationships

```sql
-- Extend vacancies for public posting + rich content
ALTER TABLE vacancies
  ADD public_slug VARCHAR(120) NULL UNIQUE,
  ADD workplace_type ENUM('Onsite','Hybrid','Remote') NULL,
  ADD employment_type ENUM('Full-time','Part-time','Contract','Temporary','Internship') NULL,
  ADD work_location VARCHAR(200) NULL,
  ADD positions INT DEFAULT 1,
  ADD reporting_manager VARCHAR(150) NULL,
  ADD responsibilities TEXT NULL,
  ADD qualifications TEXT NULL,
  ADD experience_required VARCHAR(150) NULL,
  ADD required_skills TEXT NULL,
  ADD preferred_skills TEXT NULL,
  ADD languages VARCHAR(255) NULL,
  ADD salary_min DECIMAL(12,2) NULL, ADD salary_max DECIMAL(12,2) NULL, ADD show_salary BOOLEAN DEFAULT FALSE,
  ADD benefits TEXT NULL, ADD working_hours VARCHAR(100) NULL,
  ADD application_deadline DATE NULL, ADD expected_joining_date DATE NULL,
  ADD internal_notes TEXT NULL, ADD recruitment_owner INT NULL,
  ADD additional_questions JSON NULL, ADD published_at TIMESTAMP NULL;
-- status ENUM widened to: Draft, Published, Paused, Closed, Archived (legacy values mapped)

job_applications (id, company_id, vacancy_id, candidate_id, stage, status[Open/Hired/Rejected/Archived],
  rating TINYINT, assigned_to, source, utm_source, utm_medium, utm_campaign, utm_content, utm_term,
  current_location, current_job_title, years_experience, expected_salary, notice_period, available_date,
  linkedin_url, portfolio_url, cover_letter, answers JSON, cv_file_id, onboarding_id,
  next_action, follow_up_at, rejection_reason, created_at, FKs to company/vacancy/candidate)

application_consents (id, company_id, vacancy_id, application_id, candidate_email, accepted, policy_version,
  ip_address, consented_at)

application_files (id, company_id, application_id, candidate_id, kind['cv'], file_name, file_type, file_size,
  storage_key, uploaded_at)

interviews (id, company_id, application_id, type, interviewers, scheduled_at, location, meeting_link,
  status, notes, score, recommendation, attachment_file_id, created_by, created_at)

candidate_evaluations (id, company_id, application_id, evaluator_id, overall, skills_match, experience_match,
  communication, cultural_fit, salary_fit, availability, feedback, recommendation, created_at)

application_events (id, company_id, application_id, user_id, user_name, event_type, from_stage, to_stage,
  detail, created_at)  -- per-application audit timeline
```
Reuses `candidates` (the person, deduped by `UNIQUE(company_id,email)`) and `ats_stages` (display). All new tables carry `company_id` with FK `ON DELETE CASCADE` and tenant indexes.

## 13. API endpoints

**Public (no auth, rate-limited) — `/api/public`:**
```
GET  /public/jobs/:slug                 branded job view (published, non-expired only)
POST /public/jobs/:slug/apply           multipart: form + CV + consent + UTM → application
```
**Internal (auth + tenantScope + RBAC + validate + audit):**
```
# Vacancies (extend existing /api/vacancies)
POST /vacancies/:id/publish | /pause | /close | /archive
GET  /vacancies/:id/public-link
# Applications
GET    /applications?vacancy_id&stage&source&from&to&search&assignee
GET    /applications/:id                full detail (candidate, cv, timeline, interviews, evals)
PUT    /applications/:id/stage          move stage (+note)
PUT    /applications/:id/rate           rating
PUT    /applications/:id/assign         assign owner
POST   /applications/:id/reject         reject(reason) + email
POST   /applications/:id/shortlist
GET    /applications/:id/cv             secure CV download
POST   /applications/:id/convert        create/link Onboarding v2 record
# Interviews
POST   /applications/:id/interviews     schedule (+invite email)
PUT    /interviews/:id                  update / complete (score, recommendation)
# Evaluations
POST   /applications/:id/evaluations    submit scorecard
# Reporting
GET    /applications/stats/sources      applications & hires by source/UTM
```

## 14. UI components

- **Public**: `CareersJob` page (branded hero, job sections, sticky Apply CTA) → consent step → form + dropzone → success screen. Mobile-first, fast, OG meta.
- **Internal**: Vacancies dashboard (with Publish + Copy-link + applicant counts); **Applicants** page = pipeline board (Kanban by stage) + list/table with filters/search/badges; **Application detail** drawer (profile, parsed CV, CV download, timeline, interviews, evaluations, notes, stage control, "Create onboarding"); interview scheduler modal; evaluation scorecard form; source-analytics widget.

## 15. Email templates & notifications

New/extended templates (editable in admin): `application_confirmation` (to candidate), `hr_new_application` (to recruitment owner), `interview_invitation` (reuse/extend `candidate_interview`), `application_rejection` (reuse `candidate_rejected`), `offer_stage`. In-app notifications to the recruitment owner on new application, and on stage changes to relevant users.

## 16. Security & validation rules

Public surface: strict rate limiting (per IP) on view & apply; required-field + email/phone/URL validation; CV type+size+magic-byte validation; duplicate-application check; consent mandatory + recorded; secure randomized file storage served only to authorized HR via signed/auth download; optional CAPTCHA hook; no internal data leaked in the public payload. Internal surface: `tenantScope` (cross-company → 404), RBAC, audit. Honeypot field + minimum-time check as lightweight bot defense.

## 17. Role-based permissions

| Action | Roles |
|---|---|
| Create/edit/publish vacancy | admin, hr_manager (recruiter: create/edit, not publish) |
| View applicants / move stage / rate / interview / evaluate | admin, hr_manager, recruiter |
| Assign owner, reject, shortlist | admin, hr_manager, recruiter |
| Convert to onboarding | admin, hr_manager |
| Recruitment settings | admin |
| Public apply | anyone (no auth) |

## 18. Audit trail

Every recruitment action writes both the global `audit_logs` (tenant-stamped) and a per-application `application_events` row: vacancy created/published/updated, public link generated, application submitted, CV uploaded/parsed, stage moved, rated, interview scheduled, rejected, hired, converted to onboarding — each with actor (user or `System` for public submits), timestamp, company, vacancy, candidate, and note.

## 19. Suggested improvements (modern ATS)

Career-site index page listing all open roles per company; job SEO/OG meta + sitemap; "refer a friend"; talent pool / silver-medalist re-engagement; bulk actions + email merge; interview self-scheduling links; scorecard templates per vacancy; EEO/diversity questions (optional, anonymized); application analytics dashboard (time-to-hire, source ROI, funnel conversion); automated stage SLAs + reminders; e-sign offer from the pipeline; webhook/Zapier + LinkedIn "Apply with LinkedIn" / job-board (Indeed) feed.

## 20. Step-by-step development tasks

1. Migration: extend `vacancies`; create `job_applications`, `application_consents`, `application_files`, `interviews`, `candidate_evaluations`, `application_events`; mirror in `schema.sql`. **(this iteration)**
2. Public router `/api/public`: job view + apply (consent, dedupe, CV parse, source/UTM, notify, confirm email), rate-limited. **(this iteration)**
3. Internal routes: applications list/detail/stage/rate/assign/reject/shortlist/cv/convert; interviews; evaluations; source stats. **(this iteration)**
4. Email templates: `application_confirmation`, `hr_new_application`, `offer_stage` (+ reuse interview/rejection). **(this iteration)**
5. Vacancy publish/slug + rich-field endpoints. **(this iteration)**
6. Tests: public apply (consent gate, dedupe, file), internal stage/interview/eval/convert, isolation. **(this iteration)**
7. Frontend public `CareersJob` apply page + public route. **(this iteration)**
8. Frontend internal Applicants pipeline + detail + interview/eval + convert. **(this iteration / follow-up)**
9. Recruitment settings page (privacy text, fields, file rules, stages). *(follow-up)*
10. Career-site index + analytics dashboard + integrations. *(follow-up)*

**Delivered now:** items 1–7 (backend foundation + public apply + internal application management + emails + tests + public page); internal pipeline UI and settings/analytics follow.
