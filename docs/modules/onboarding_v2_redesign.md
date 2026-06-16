# Employee Onboarding Module — Professional Rebuild (v2)

**Author:** HR systems redesign · **Date:** 2026-06-13
**Supersedes:** `docs/modules/onboarding.md` (generic Locked→Open→Complete checklist)
**Status:** Design + phased implementation. Backend schema + stage engine implemented in this iteration (see §15).

---

## 0. Why a rebuild

The current module (`onboarding_records` + `onboarding_steps` + `onboarding_checklist_items`) is a single, generic, sequential **checklist**. It cannot express the real hiring lifecycle the business needs:

- No CV upload / automatic data extraction as a first-class step.
- No candidate **profile** with verified-vs-extracted provenance.
- No **HR Manager approval gate** with reject reason.
- No **employment offer** object — no offer fields, no offer email, no offer tracking, no multi-offer rules.
- No **signed-offer** upload + verification gate.
- No structured **document collection** with required/optional/expired states.
- No **visa / residency** process tracking.
- No **bank details** capture with validation.
- Weak audit granularity and no per-stage approval/assignment.

The rebuild turns onboarding into a **gated state machine**: each stage has required fields, required documents, an owner, validation rules, and an approval/verification gate. The workflow cannot advance until the current stage is *complete and valid*. Everything is tenant-scoped, validated, RBAC-controlled, and audit-logged (consistent with the platform's Phase 1–2 security work).

---

## 1. Improved onboarding workflow (explanation)

```
                    ┌─────────────────────────────────────────────────────────────┐
                    │            ONBOARDING STATE MACHINE (per candidate)          │
                    └─────────────────────────────────────────────────────────────┘

 [Add New Employee]
        │
        ▼
   ① DRAFT ──upload CV──▶ ② CV_UPLOADED ──verify profile──▶ ③ UNDER_HR_REVIEW
                                                                  │
                                          reject(reason) ◀────────┤────────▶ approve
                                                │                          │
                                                ▼                          ▼
                                          ✗ REJECTED                 ④ HR_APPROVED
                                                                          │  create offer
                                                                          ▼
                                                                   ⑤ OFFER_SENT ──┐
                                                          accept │        │ reject(reason)
                                                                 ▼        ▼
                                                       ⑥ OFFER_ACCEPTED   OFFER_REJECTED ──(new offer, documented)──┐
                                                                 │                                                   │
                                                                 │◀──────────────────────────────────────────────────┘
                                                                 ▼ upload + verify signed offer
                                                       ⑦ SIGNED_OFFER_UPLOADED
                                                                 ▼ all required docs verified
                                                       ⑧ DOCUMENTS_COLLECTION
                                                                 ▼ visa steps complete (or N/A)
                                                       ⑨ VISA_RESIDENCY
                                                                 ▼ bank details valid
                                                       ⑩ BANK_DETAILS
                                                                 ▼ final review
                                                       ⑪ READY_FOR_EMPLOYMENT
                                                                 ▼ activate employee
                                                       ⑫ COMPLETED
```

**Principles**
- **Forward-only, gated:** `advance` is rejected with a 422 listing the missing requirements unless the current stage passes its validators.
- **Single source of truth:** one `onboarding_records.stage` column drives the UI; supporting tables hold the data each stage produces.
- **Provenance:** the candidate profile records which fields came from CV extraction vs HR edits.
- **Auditable & accountable:** every action writes an `onboarding_events` row (who/what/when) in addition to the global `audit_logs`.
- **No data loss:** offers, documents, visa steps, and signed files are never overwritten — they are versioned/appended and remain visible.

---

## 2. Required stages (canonical list)

| # | Stage key | Display | Owner (default) | Gate to advance |
|---|---|---|---|---|
| 1 | `DRAFT` | Draft | HR | record created |
| 2 | `CV_UPLOADED` | CV Uploaded | HR | CV file present + extraction run |
| 3 | `UNDER_HR_REVIEW` | Under HR Review | HR | required profile fields complete & `profile_verified=1` |
| 4 | `HR_APPROVED` | Approved by HR Manager | HR Manager | HR Manager decision = Approved |
| 5 | `OFFER_SENT` | Offer Sent | HR | an offer exists with status `Sent` |
| 6 | `OFFER_ACCEPTED` | Offer Accepted | HR | latest offer status = `Accepted` |
| 7 | `SIGNED_OFFER_UPLOADED` | Signed Offer Uploaded | HR | signed offer uploaded **and** verified |
| 8 | `DOCUMENTS_COLLECTION` | Documents Collection | HR | all **required** documents `Verified` |
| 9 | `VISA_RESIDENCY` | Visa / Residency Processing | PRO/Admin | all required visa steps `Completed` (or stage marked N/A) |
| 10 | `BANK_DETAILS` | Bank Details Completed | HR/Finance | bank record valid & `verified=1` |
| 11 | `READY_FOR_EMPLOYMENT` | Ready for Employment | HR Manager | final compliance checklist passed |
| 12 | `COMPLETED` | Completed | HR | employee activated |

Terminal off-ramp: `REJECTED` (set from stage 3 or via offer-exhaustion) with mandatory reason; `CANCELLED` (admin) with reason. A sub-flag `offer_state` (`none/sent/accepted/rejected`) tracks offer status while the main stage stays at 5/6.

Each stage row also carries: `status` (Pending/In Progress/Complete/Blocked/Skipped), `assigned_to` (user), `completed_at`, `notes`.

---

## 3. Required fields per stage

### Stage 1 — Draft
- `company_id` (required, server-derived from tenant), `created_by`. Optionally link `candidate_id` (if originating from ATS) or `vacancy_id`.

### Stage 2 — CV Upload & extraction → **candidate profile**
Editable profile fields (extracted values stored separately from verified values):
- Identity: `first_name*`, `last_name*`, `full_name`, `email*`, `phone*`, `address`, `nationality`, `date_of_birth`, `gender`, `marital_status`.
- Professional: `current_job_title`, `total_experience_years`, `education` (JSON list: degree/school/year), `skills` (JSON list), `languages` (JSON list), `work_experience` (JSON list: company/title/duration/responsibilities/projects), `certifications` (JSON list).
- Meta: `cv_file_id`, `extracted_data` (JSON — raw AI output), `extracted_fields` (JSON map field→true), `profile_verified` (bool), `profile_completeness` (0–100, computed).

`*` = required before leaving stage 3.

### Stage 3 — HR Review
- `hr_review_notes`, `hr_reviewer_id`, internal comments (see `onboarding_comments`).

### Stage 4 — HR Manager approval
- `decision` (Approved/Rejected/More Info), `decided_by`, `decided_at`, `decision_note`, `rejection_reason` (required if rejected).

### Stage 5/6 — Employment Offer (one row per offer; see §8)
Required offer fields before send:
- `candidate_name*`, `job_title*`, `department`, `reporting_manager`, `work_location*`, `employment_type*` (Full-time/Part-time/Contract/Temporary), `joining_date*`, `basic_salary*`, `allowances` (JSON breakdown), `commission_structure`, `probation_period`, `working_hours`, `leave_policy`, `benefits`, `visa_responsibility`, `medical_insurance`, `notice_period`, `offer_expiry_date*`, `additional_terms`, `internal_notes`.
- System: `offer_number` (auto: `OFR-{company}-{seq}`), `version`, `status`, `created_by`, `sent_at`, `sent_by`, `response`, `responded_at`, `rejection_reason`.

### Stage 7 — Signed offer
- `file_id*`, `uploaded_by`, `uploaded_at`, `signatories` (company rep / HR manager / employee — booleans + names), `verification_status` (Pending/Verified/Rejected), `verified_by`, `verified_at`, `notes`.

### Stage 8 — Document collection (per requirement row)
- `doc_key`, `label`, `required` (bool), `file_id`, `status` (Missing/Uploaded/Pending/Verified/Rejected/Expired), `expiry_date`, `verified_by`, `verified_at`, `notes`.

### Stage 9 — Visa / Residency (per step row)
- `step_key`, `label`, `status` (Not Started/In Progress/Submitted/Approved/Completed/Rejected), `reference_number`, `responsible_user`, `due_date`, `file_id`, `notes`, `completed_at`.

### Stage 10 — Bank details
- `bank_name*`, `account_holder_name*`, `account_number*`, `iban*`, `swift_code`, `branch_name`, `transfer_method` (Bank Transfer/WPS/Cheque/Cash), `confirmation_file_id`, `verified` (bool), `verified_by`.

### Stage 11/12 — Ready / Completed
- `compliance_checklist` (JSON of UAE checks), `final_notes`, employee activation (`employees.status='Active'`, salary fields synced from accepted offer).

---

## 4. Required documents per stage

| Stage | Document | Required? | Notes |
|---|---|---|---|
| 2 | CV file (PDF/DOC/DOCX) | Required | drives extraction |
| 7 | Signed offer (PDF) | Required | multi-party signatures, verified |
| 8 | Personal photo | Required | image |
| 8 | Passport copy | Required | expiry tracked |
| 8 | Emirates ID | Optional* | required for UAE residents |
| 8 | National ID | Optional | non-UAE |
| 8 | Visa copy | Optional* | required once issued |
| 8 | Educational certificates | Required | |
| 8 | Experience certificates | Optional | |
| 8 | Signed employment forms | Required | |
| 8 | Emergency contact form | Required | data form, not file |
| 8 | Personal information form | Required | data form |
| 9 | Medical test report | Conditional | UAE visa |
| 9 | Emirates ID application receipt | Conditional | |
| 9 | Residency stamp page | Conditional | |
| 9 | Labour contract (MoHRE) | Conditional | |
| 10 | Bank/salary account confirmation | Required | IBAN letter |

`*` Conditional requiredness is configurable per company via a **document requirement template**.

---

## 5. Validation rules (gate per stage)

The `advance(onboardingId)` endpoint runs the validator for the **current** stage; on failure returns `422 { error, missing: [...] }`.

- **2 → 3:** CV file uploaded AND extraction attempted.
- **3 → 4:** `first_name, last_name, email (valid), phone, nationality` present AND `profile_verified = 1`.
- **4 → 5:** HR Manager `decision = Approved`. (Reject sets stage `REJECTED` + mandatory `rejection_reason`.)
- **5 → 6:** at least one offer with status `Sent`; transition happens automatically when candidate response = Accepted.
- **6 → 7:** latest offer `Accepted`.
- **7 → 8:** signed offer file present AND `verification_status = Verified`.
- **8 → 9:** every requirement with `required=1` is `Verified`; none `Expired`.
- **9 → 10:** every visa step with `required=1` is `Completed`, OR stage flagged `not_applicable` by admin with note.
- **10 → 11:** bank record present, IBAN passes checksum-ish format check, `verified = 1`.
- **11 → 12:** compliance checklist all-true; activates employee.

Cross-cutting validators: email format, phone format, date sanity (joining_date ≥ today on offer create; offer_expiry_date > sent date), salary ≥ 0, IBAN format (`^[A-Z]{2}\d{2}[A-Z0-9]{11,30}$`), file type/size on every upload.

---

## 6. Approval rules

| Action | Allowed roles | Rule |
|---|---|---|
| Create onboarding / upload CV / edit profile | `admin`, `hr_manager`, `hr_specialist`, `recruiter` | tenant-scoped |
| Verify profile | `hr_manager`, `hr_specialist`, `admin` | |
| HR Manager approve/reject candidate (stage 4) | `hr_manager`, `admin` | reject → reason mandatory |
| Create / send offer | `hr_manager`, `admin` | offer needs all required fields; **new offer blocked unless prior offer has a rejection_reason/HR note** |
| Record offer response | `hr_manager`, `hr_specialist`, `admin` | |
| Verify signed offer | `hr_manager`, `admin` | |
| Verify documents | `hr_manager`, `hr_specialist`, `admin` | |
| Update visa steps | `admin`, `hr_manager`, PRO (`hr_specialist`) | |
| Verify bank details | `hr_manager`, `admin`, finance | |
| Mark Ready / Complete | `hr_manager`, `admin` | |
| Cancel onboarding | `admin` | reason mandatory |

All gates are enforced **server-side** via `authorize(...)` + `tenantScope` (client role-hiding is cosmetic only).

---

## 7. Email automation requirements

Triggered through the existing `emailService` (now hardened: header-injection guard, SMTP verify, TLS) and a new set of `emailTemplates` keys. Each email is logged in `email_log` (tenant-scoped) and an `onboarding_events` row.

| Event | Template key | To | CC |
|---|---|---|---|
| Candidate added | `onboarding_created` | (internal) HR owner | — |
| Pending HR Manager approval | `onboarding_review_pending` | HR Manager | HR owner |
| Candidate approved | `onboarding_approved` | HR owner | — |
| **Offer sent** | `employment_offer` | candidate | HR owner (handling user) |
| Offer accepted/rejected | `offer_response_ack` | candidate | HR owner |
| Signed offer pending | `signed_offer_pending` | HR owner | — |
| Required documents missing | `documents_missing` | candidate / HR owner | — |
| Visa step pending | `visa_step_pending` | PRO/owner | HR Manager |
| Bank details pending | `bank_details_pending` | candidate | HR owner |
| Onboarding completed | `onboarding_completed` | employee | HR owner, manager |

**Offer email** (the key one) must include: professional subject (`Job Offer — {job_title} at {company}`), full structured summary (all offer fields), optional attached PDF, clear accept/reject instructions + link/tokens, validity deadline, and company contact block. A **copy is always CC'd to the handling HR user**.

---

## 8. Offer tracking logic

One `onboarding_offers` row per offer attempt. Rules enforced server-side:

1. **Auto-numbered**: `offer_number = OFR-{company_short}-{zero-padded seq}`; `version` increments per candidate.
2. **Lifecycle**: `Draft → Sent → (Accepted | Rejected | Expired | Withdrawn)`.
3. **Send** requires all required fields (§3 stage 5) and sets `sent_at`, `sent_by`, emails candidate + CC HR.
4. **Response** (`Accepted`/`Rejected`) sets `response`, `responded_at`; Accepted auto-advances onboarding to `OFFER_ACCEPTED`; Rejected requires `rejection_reason`.
5. **Multiple-offer guard**: a new offer can be created **only if** the most recent offer is in a closed state (`Rejected`/`Withdrawn`/`Expired`) **and** carries a non-empty `rejection_reason` or `internal_notes`. Attempting otherwise → `409` with the blocking offer id.
6. **Full history**: all offers remain visible and read-only once sent; the record shows `total_offers` and a timeline. Nothing is deleted (a Draft may be edited; Sent+ are immutable except status/response).
7. **Auditable**: every create/send/respond/withdraw writes an `onboarding_events` row.

---

## 9. Signed-offer upload logic

- Enabled only at stage `OFFER_ACCEPTED`.
- Upload stores the file (see §12 storage), records `uploaded_by/at`, and a `signatories` JSON capturing company-rep / HR-manager / employee signature confirmation (name + boolean each).
- Upload alone does **not** advance the stage — a `hr_manager/admin` must set `verification_status = Verified` (with verifier identity + date). Only then can the workflow advance to `DOCUMENTS_COLLECTION`.
- Re-upload allowed while `Pending`/`Rejected`; each upload is versioned (old file retained, `is_current` flag).

---

## 10. Employee document & visa processing logic

**Documents** — on entering stage 8, the system seeds requirement rows from the company's **document requirement template** (falling back to a sensible global default). Each row tracks status (Missing→Uploaded→Pending→Verified, or Rejected/Expired). HR uploads a file against a requirement (sets `Uploaded/Pending`), then verifies it (`Verified` + verifier). Required + unverified or expired rows block advancement. Expiry dates feed the **document-expiry alert** job.

**Visa/Residency** — stage 9 seeds visa step rows from a template (Required Visa Docs → Application Submission → Medical Test → Emirates ID → Residency Stamping → Labour Contract → Government Approval). Each step is independently tracked with `status`, `reference_number`, `responsible_user`, `due_date`, attachment, notes. Admin may flag the whole stage `not_applicable` (e.g., citizen) with a note. All required steps `Completed` → advance.

Both stages reuse a single **onboarding files** mechanism so documents are never lost and are always linked to the onboarding record + stage.

---

## 11. Bank details collection logic

- One `onboarding_bank_details` row per onboarding record (1:1).
- Required: bank_name, account_holder_name, account_number, IBAN; optional: swift, branch, transfer_method, confirmation file.
- IBAN format-validated; account_holder_name should match candidate name (soft warning, not block).
- A `hr_manager/admin/finance` sets `verified = 1` (+ verifier). Stage advances only when valid + verified.
- On `COMPLETED`, verified bank details + accepted-offer salary are synced into the employee/payroll inputs.

---

## 12. Database schema (concrete)

Extends `onboarding_records` and adds stage tables. Full DDL ships as `server/migrations/onboarding_v2.sql` and is mirrored in `schema.sql`. Storage of files: a generic `onboarding_files` table holding metadata + a path/key (files on disk/object storage, **not** large blobs — consistent with audit DB-009). Money as `DECIMAL`, dates as `DATE`, JSON for list-shaped data.

```sql
-- Extend the spine
ALTER TABLE onboarding_records
  ADD COLUMN stage ENUM('DRAFT','CV_UPLOADED','UNDER_HR_REVIEW','HR_APPROVED','OFFER_SENT',
      'OFFER_ACCEPTED','SIGNED_OFFER_UPLOADED','DOCUMENTS_COLLECTION','VISA_RESIDENCY',
      'BANK_DETAILS','READY_FOR_EMPLOYMENT','COMPLETED','REJECTED','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN candidate_id INT NULL,
  ADD COLUMN vacancy_id INT NULL,
  ADD COLUMN offer_state ENUM('none','sent','accepted','rejected') NOT NULL DEFAULT 'none',
  ADD COLUMN rejection_reason TEXT NULL,
  ADD COLUMN assigned_to INT NULL,
  ADD COLUMN created_by INT NULL;
-- employee_id becomes NULLABLE (an onboarding starts before an employee exists):
--   ALTER TABLE onboarding_records MODIFY employee_id INT NULL;

-- Candidate profile (1:1), with provenance
CREATE TABLE onboarding_profiles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL UNIQUE,
  company_id INT NOT NULL,
  first_name VARCHAR(100), last_name VARCHAR(100), full_name VARCHAR(200),
  email VARCHAR(255), phone VARCHAR(50), address VARCHAR(500),
  nationality VARCHAR(100), date_of_birth DATE NULL, gender VARCHAR(20), marital_status VARCHAR(20),
  current_job_title VARCHAR(200), total_experience_years DECIMAL(4,1) NULL,
  education JSON NULL, skills JSON NULL, languages JSON NULL,
  work_experience JSON NULL, certifications JSON NULL,
  extracted_data JSON NULL, extracted_fields JSON NULL,
  profile_verified BOOLEAN DEFAULT FALSE, profile_completeness INT DEFAULT 0,
  cv_file_id INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- HR Manager approval (1:1)
CREATE TABLE onboarding_approvals (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  decision ENUM('Pending','Approved','Rejected','More Info') DEFAULT 'Pending',
  decided_by INT NULL, decided_at TIMESTAMP NULL,
  decision_note TEXT NULL, rejection_reason TEXT NULL,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Offers (1:many)
CREATE TABLE onboarding_offers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  offer_number VARCHAR(40), version INT DEFAULT 1,
  candidate_name VARCHAR(200), job_title VARCHAR(200), department VARCHAR(150),
  reporting_manager VARCHAR(150), work_location VARCHAR(200),
  employment_type ENUM('Full-time','Part-time','Contract','Temporary') DEFAULT 'Full-time',
  joining_date DATE NULL, basic_salary DECIMAL(12,2) NULL, allowances JSON NULL,
  commission_structure TEXT NULL, probation_period VARCHAR(100), working_hours VARCHAR(100),
  leave_policy VARCHAR(255), benefits TEXT NULL, visa_responsibility VARCHAR(255),
  medical_insurance VARCHAR(255), notice_period VARCHAR(100),
  offer_expiry_date DATE NULL, additional_terms TEXT NULL, internal_notes TEXT NULL,
  status ENUM('Draft','Sent','Accepted','Rejected','Expired','Withdrawn') DEFAULT 'Draft',
  response ENUM('Pending','Accepted','Rejected') DEFAULT 'Pending',
  rejection_reason TEXT NULL,
  created_by INT NULL, sent_by INT NULL, sent_at TIMESTAMP NULL, responded_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_offer_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Generic onboarding files (CV, signed offer, doc uploads, visa attachments, bank confirmation)
CREATE TABLE onboarding_files (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  kind VARCHAR(40) NOT NULL,        -- 'cv' | 'signed_offer' | 'document' | 'visa' | 'bank'
  ref_id INT NULL,                  -- doc/visa/offer row this file belongs to
  file_name VARCHAR(255), file_type VARCHAR(100), file_size INT,
  storage_key VARCHAR(500),         -- path/object key (not a blob)
  is_current BOOLEAN DEFAULT TRUE,
  uploaded_by INT NULL, uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Signed offer verification (1:1, references current file)
CREATE TABLE onboarding_signed_offer (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL UNIQUE, company_id INT NOT NULL,
  file_id INT NULL, signatories JSON NULL,
  verification_status ENUM('Pending','Verified','Rejected') DEFAULT 'Pending',
  verified_by INT NULL, verified_at TIMESTAMP NULL, notes TEXT NULL,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Document requirement rows (1:many)
CREATE TABLE onboarding_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  doc_key VARCHAR(60), label VARCHAR(200), required BOOLEAN DEFAULT TRUE,
  file_id INT NULL, status ENUM('Missing','Uploaded','Pending','Verified','Rejected','Expired') DEFAULT 'Missing',
  expiry_date DATE NULL, verified_by INT NULL, verified_at TIMESTAMP NULL, notes VARCHAR(500),
  INDEX idx_doc_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Visa / residency steps (1:many)
CREATE TABLE onboarding_visa_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  step_key VARCHAR(60), label VARCHAR(200), required BOOLEAN DEFAULT TRUE, sort_order INT DEFAULT 0,
  status ENUM('Not Started','In Progress','Submitted','Approved','Completed','Rejected') DEFAULT 'Not Started',
  reference_number VARCHAR(120), responsible_user INT NULL, due_date DATE NULL,
  file_id INT NULL, notes VARCHAR(500), completed_at TIMESTAMP NULL,
  INDEX idx_visa_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Bank details (1:1)
CREATE TABLE onboarding_bank_details (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL UNIQUE, company_id INT NOT NULL,
  bank_name VARCHAR(150), account_holder_name VARCHAR(200), account_number VARCHAR(60),
  iban VARCHAR(60), swift_code VARCHAR(30), branch_name VARCHAR(150),
  transfer_method ENUM('Bank Transfer','WPS','Cheque','Cash') DEFAULT 'Bank Transfer',
  confirmation_file_id INT NULL, verified BOOLEAN DEFAULT FALSE, verified_by INT NULL, verified_at TIMESTAMP NULL,
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

-- Internal comments between HR team (1:many)
CREATE TABLE onboarding_comments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  user_id INT NULL, body TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_comment_onb (onboarding_id),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE
);

-- Per-onboarding event/audit trail (1:many)
CREATE TABLE onboarding_events (
  id INT AUTO_INCREMENT PRIMARY KEY,
  onboarding_id INT NOT NULL, company_id INT NOT NULL,
  user_id INT NULL, user_name VARCHAR(200),
  event_type VARCHAR(80), from_stage VARCHAR(40), to_stage VARCHAR(40),
  detail TEXT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_event_onb (onboarding_id, created_at),
  FOREIGN KEY (onboarding_id) REFERENCES onboarding_records(id) ON DELETE CASCADE
);
```

The legacy `onboarding_steps` / `onboarding_checklist_items` tables remain for backward compatibility (the old ATS auto-create path still works) but are superseded by the stage machine for new records.

---

## 13. UI / UX improvements

- **Onboarding main page**: prominent **“Add New Employee”** button; searchable/filterable list (by name, stage, department, joining date); each row shows a **12-step progress bar** with the current stage highlighted and a "missing requirements" chip.
- **Stage rail / wizard**: a left vertical stepper showing all 12 stages with state colours (done/current/locked/blocked). Clicking a completed stage shows read-only data; the current stage is editable.
- **Provenance badges**: fields auto-filled from CV show an "AI" badge; HR-edited fields show "edited".
- **Completeness score** ring on the profile.
- **Offer panel**: offer history timeline, "Total offers: N", new-offer button disabled with tooltip until the prior offer is documented; live PDF/email preview before send.
- **Document checklist**: required/optional grouping, colour-coded statuses, expiry warnings, drag-drop upload.
- **Visa board**: per-step cards with status, reference #, due date, responsible person, attachment.
- **Bank form**: inline IBAN validation + masked account number.
- **Timeline view** of `onboarding_events`; **internal comments** thread.
- **HR Manager approval dashboard**: queue of items at `UNDER_HR_REVIEW`.
- **Export** onboarding report to PDF/Excel; **document-expiry alerts** surfaced in the notifications bell.
- Confirmation dialogs on irreversible actions; empty/loading/error states throughout; full i18n + RTL.

---

## 14. Permissions & user roles

| Role | Capabilities |
|---|---|
| `admin` | everything, incl. cancel, visa N/A, template config, hard actions |
| `hr_manager` | approve/reject candidate, create/send offers, verify signed offer & docs & bank, mark ready/complete |
| `hr_specialist` | create onboarding, upload CV, edit profile, upload docs, record offer responses, update visa steps |
| `recruiter` | create onboarding, upload CV, edit profile (cannot approve/offer) |
| `employee` | no access to others' onboarding; (future) self-service document upload for own onboarding |
| Finance (future role) | verify bank details |

Enforced server-side; the Sidebar entry remains under `['admin','hr_manager']` with `hr_specialist`/`recruiter` added as the role model expands (audit DB-003).

---

## 15. Implementation recommendations & status

**Architecture decision:** keep `onboarding_records` as the spine (add `stage` + columns), make `employee_id` nullable (onboarding precedes employee), and create the supporting tables above. Add a new **stage-engine service** (`services/onboardingStageService.js`) holding the ordered stages + per-stage validators, and **new REST endpoints** on the onboarding router. The legacy step/checklist endpoints stay for the old ATS path; new records use the stage workflow. Files use the generic `onboarding_files` table with disk/object storage (no DB blobs).

**Endpoint surface (new):**
```
POST   /api/onboarding/v2                      create draft (optionally from candidate_id)
POST   /api/onboarding/v2/:id/cv               upload CV + auto-extract → profile
GET    /api/onboarding/v2/:id                  full aggregate (record+profile+offers+docs+visa+bank+events)
PUT    /api/onboarding/v2/:id/profile          edit profile fields (tracks provenance)
POST   /api/onboarding/v2/:id/verify-profile   mark profile verified
POST   /api/onboarding/v2/:id/review           HR Manager approve/reject(reason)/more-info
POST   /api/onboarding/v2/:id/offers           create offer (multi-offer guard)
PUT    /api/onboarding/v2/offers/:offerId      edit Draft offer
POST   /api/onboarding/v2/offers/:offerId/send send offer email (+CC handler)
POST   /api/onboarding/v2/offers/:offerId/respond  record Accepted/Rejected(reason)
POST   /api/onboarding/v2/:id/signed-offer     upload signed offer
POST   /api/onboarding/v2/:id/signed-offer/verify  verify/reject signed offer
POST   /api/onboarding/v2/:id/documents/seed   seed requirement rows from template
POST   /api/onboarding/v2/documents/:docId/upload  upload a document file
POST   /api/onboarding/v2/documents/:docId/verify  verify/reject/expire a document
POST   /api/onboarding/v2/:id/visa/seed        seed visa steps
PUT    /api/onboarding/v2/visa/:stepId         update a visa step
PUT    /api/onboarding/v2/:id/bank             upsert bank details
POST   /api/onboarding/v2/:id/bank/verify      verify bank details
POST   /api/onboarding/v2/:id/comments         add internal comment
POST   /api/onboarding/v2/:id/advance          validate current stage → move to next (or 422 missing[])
POST   /api/onboarding/v2/:id/cancel           cancel(reason) (admin)
GET    /api/onboarding/v2                       list with filters (status/stage/department/search)
```
All: `auth + tenantScope + validate + authorize + audit + onboarding_events`.

**Delivered in this iteration (backend foundation):**
- `server/migrations/onboarding_v2.sql` + `apply_onboarding_v2.mjs` (applied to live DB), mirrored in `schema.sql`.
- `services/onboardingStageService.js` — stage order + validators + transition map.
- Core routes: create, CV upload+extract, aggregate GET, profile edit/verify, HR review, **full offer lifecycle with multi-offer guard**, signed-offer upload+verify, document seed/upload/verify, visa seed/update, bank upsert/verify, comments, **advance** (gated), cancel, list.
- Offer email via `emailTemplates.employment_offer` (CC to handler) and event/audit logging.
- Tests: stage-validator unit tests + an end-to-end isolation/lifecycle integration test.

**Recommended next:** frontend stage-rail wizard & offer panel; PDF offer generation; document-expiry + notification jobs; migrate the ATS "Success" path to create a v2 onboarding instead of the legacy checklist.
