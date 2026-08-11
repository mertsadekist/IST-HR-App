# Plan — daily attendance sync from Google Drive

The company's time-attendance software now writes one CSV per day to a Google
Drive folder, covering the previous day. This plan reads that folder every
morning, imports only what is new, and emails a report of what happened.

Status: **plan only — nothing built yet.** Section 9 lists the decisions needed
before implementation starts.

---

## 1. The file

`attendance_2026-08-10.csv` — 24 data rows, one per employee per day.

| Column | Example | Use |
|---|---|---|
| `employee_id` | `2006` | **the fingerprint device ID** → `employees.attendance_id` |
| `employee_name` | `Mert Sadek` | display only, for the unmatched report |
| `department` | `IST Group>IST Markets` | company path — see §5, it disagrees with our records |
| `attendance_date` | `2026-08-10` | → `attendance.work_date` |
| `check_in` / `check_out` | `10:01:05` / `16:51:24` | local wall-clock, **may be empty** |
| `scheduled_in` / `scheduled_out` | `10:00:00` / `19:00:00` | the shift the day was judged against |
| `worked_seconds` / `worked_time` | `24619` / `06:50:19` | authoritative hours worked |
| `late_seconds` / `late_time` | `0` / `00:00:00` | lateness |
| `early_leave_seconds` / `early_leave_time` | `7716` / `02:08:36` | early departure |
| `attendance_status_code` | `3` | the source system's verdict |

### The status code, decoded

Not documented anywhere, so it was derived and then checked against all 24 rows —
it fits every one exactly:

| Code | Meaning | Signature in the row | Our `attendance.status` |
|---|---|---|---|
| `1` | On time, full day | late 0, early 0 | `Present` |
| `2` | Late arrival only | late > 0, early 0 | `Late` |
| `3` | Left early only | late 0, early > 0 | `Present` + early-leave recorded |
| `4` | No punches at all | check_in and check_out empty | `Absent` |
| `5` | Late **and** left early | late > 0, early > 0 | `Late` + early-leave recorded |

Two shapes need care:

- **Code 4 (absent)** — 6 of 24 rows. Writing these as `Absent` is what lets
  payroll deduct unauthorised absence, so they matter. But an absence on a day
  the person had **approved leave** must be written as `On Leave`, or payroll
  deducts for a day that was already granted. §4 handles this.
- **Missing punch** — `4039 Shinaritah` checked in at 10:19 and never checked
  out; `worked_seconds` is 0 even though she was present. Import the check-in,
  leave check-out null, and list it in the report as a missing punch rather than
  silently recording a zero-hour day.

---

## 2. What already exists, and what changes

`POST /api/attendance/import` handles the **old** export shape: `ID`, `Date`,
`Check-In Record` (semicolon-separated swipes). It infers check-out from a fixed
19:00 parameter because that format had no real check-out.

The new file is a better source in every way — it has a real check-out, the
worked total, lateness and early departure already computed. So the Drive sync
gets **its own parser**, and the manual upload stays as it is: a fallback for
when the feed breaks and the route for correcting a day by hand.

Already true and reusable:

- `attendance` has `uq_attendance_emp_date (employee_id, work_date)`, so
  re-importing the same day updates rather than duplicates. Idempotency is free.
- Employees are matched by `attendance_id`, exactly the CSV's `employee_id`.
- `company_id` on the row comes from the employee record, not the file.

### Mapping coverage, checked against the live data today

**22 of the 24 device IDs already resolve to an employee.** Only one active
employee lacks an `attendance_id`, and 22 employees are Active/Onboarding — so
the mapping is essentially complete.

The two that do not resolve are not in the HR system at all:

| Device ID | Name in the file | Status in the file |
|---|---|---|
| `4001` | Majd Barshiny | absent (code 4) |
| `4033` | Mohammed Saif | absent (code 4) |

Decision needed (§9.4): add them as employees, map them to an existing record, or
ignore them permanently so they stop appearing in the report.

---

## 3. Connecting to Google Drive

### Recommended: a service account with read-only access to the folder

1. In Google Cloud, create a project and enable the **Drive API**.
2. Create a **service account**. No user, no consent screen, no browser.
3. Download its JSON key; take `client_email` and `private_key`.
4. In Drive, share **only the attendance folder** with that `client_email` as
   **Viewer**.
5. Store as runtime-only secrets in Coolify, never in the repo:
   `GOOGLE_DRIVE_SA_EMAIL`, `GOOGLE_DRIVE_SA_PRIVATE_KEY`,
   `ATTENDANCE_DRIVE_FOLDER_ID`.
6. Scope: `https://www.googleapis.com/auth/drive.readonly` — the integration can
   never modify or delete anything in Drive.

Why this rather than signing in as a person:

- A user OAuth refresh token belongs to whoever authorised it. When that person
  leaves or changes their password, the sync silently stops. A service account
  is not tied to a human.
- No consent screen, no token-refresh dance, no re-authorisation after 6 months.
- Access is scoped to one shared folder and is read-only, so the blast radius is
  a folder of CSVs.

Dependency: `googleapis` (official, maintained) on the server.

### Fallback if a service account cannot be created

A **Google Apps Script** in the Drive account, on a daily trigger, POSTs the new
file's contents to a token-protected endpoint on our side
(`POST /api/attendance/drive-sync/push`). This inverts the direction: no Google
credentials live in our app at all. The trade-off is that part of the logic sits
in a script outside this repo, and the shared token becomes a secret to manage.
Viable, but the service account is cleaner.

---

## 4. Reading the right file, and only the new ones

### The filename is the key

`attendance_YYYY-MM-DD.csv` names the day the data is **for**, which is the fact
that matters. Not the upload time, which can drift, and not "the newest file",
which breaks the moment yesterday's file arrives late or a correction is
re-uploaded.

The date inside `attendance_date` is verified against the filename on import; a
mismatch fails the file loudly rather than importing it under the wrong day.

### A ledger, so 30 files or 3000 makes no difference

New table `attendance_sync_files`:

| Column | Purpose |
|---|---|
| `drive_file_id` UNIQUE | Drive's own id — the identity that survives a rename |
| `file_name`, `business_date` | what it is and which day it covers |
| `md5_checksum`, `size_bytes` | detects a **corrected re-upload** of the same day |
| `status` | `Pending` / `Imported` / `Failed` / `Skipped` |
| `rows_total`, `rows_matched`, `rows_unmatched`, `inserted`, `updated` | the outcome |
| `error`, `attempts`, `imported_at` | for retries and the report |

A file is **new** when its `drive_file_id` is absent from the ledger, or present
but with a different `md5_checksum` — that second case is what makes a corrected
re-upload import again instead of being skipped as "already done".

Drive is queried with `'<folderId>' in parents and trashed = false`, requesting
`id, name, md5Checksum, modifiedTime, size`, and the results are filtered against
the ledger in one pass. The folder growing to a year of files costs one extra
page of listing, not 365 downloads.

### Not importing the whole history on the first run

Without a floor, the first 5 AM run would import every file in the folder. An
`attendance_sync_start_date` app setting (default: the day the feature goes live)
bounds it. Files older than that are recorded as `Skipped` so they are never
looked at again, and the report says how many were skipped and why.

---

## 5. Company assignment — three sources disagree

The CSV's `department` column carries a company path. For the `4xxx` series it
agrees with our records everywhere. For the `2xxx` series it does not:

The file says `IST Group>IST Markets` for Mayas, Mert, Nawar, Zakaria, Ahmed and
Subrat — **the same six people whose user accounts were just realigned to IST
Real Estate** to match their employee records.

So there are three claims about where these six sit: the fingerprint system says
IST Markets, their employee records say IST Real Estate, and their user accounts
now follow the employee records.

**The plan takes the employee record as the authority** and never moves anyone
based on the file. It drives payroll, WPS and the org chart, and a fingerprint
device's org tree is exactly the kind of thing that goes stale. But the sync
**reports** every disagreement in the daily email, so a genuine mismatch surfaces
instead of hiding.

This also needs a human answer (§9.1): if the fingerprint system is right, six
employee records are in the wrong company and that affects which company's
payroll includes them.

---

## 6. Running at 05:00

The app has no cron. Salary reviews, domain renewals and document expiry all run
on a plain `setInterval` every 6 hours, which is fine for "some time today" but
not for "05:00".

A small time-of-day scheduler: compute the milliseconds until the next 05:00 in
the configured timezone (`APP_TZ`, default `Asia/Dubai`), `setTimeout`, run, then
re-arm for the next day. No new dependency.

Two things it must handle:

- **Restarts.** Coolify redeploying at 05:30 must not re-run a job that already
  ran at 05:00, and must not skip a day. A `attendance_sync_runs` row keyed
  uniquely on the run date makes the run claim atomic — whoever inserts the row
  runs it, anyone else stands down.
- **A missing file is a signal.** If no file for yesterday exists at 05:00, the
  source system did not produce one. Silence would hide a broken feed for weeks,
  so this warns rather than doing nothing. A retry a few hours later covers a
  merely-late upload before the warning escalates.

Plus a **Sync now** button for admins, and **Retry** on a failed file — the same
code path, triggered by hand.

---

## 7. What gets written

Per matched row, upserted on `(employee_id, work_date)`:

- `check_in` / `check_out` — real timestamps from the file, stored as local
  wall-clock exactly as the manual importer does, so nothing shifts by a
  timezone.
- `work_hours` — `worked_seconds / 3600`, from the file rather than recomputed.
- `status` — per the table in §1, with the leave cross-check from §4.
- `notes` — the source signals in readable form.

New columns on `attendance`, so the facts behind the status are not thrown away:

| Column | Why |
|---|---|
| `late_minutes`, `early_leave_minutes` | "Present" for someone who left 2h08m early is misleading, and payroll may later want early-leave handling |
| `scheduled_in`, `scheduled_out` | the shift the day was judged against, which can change |
| `source` (`Manual` / `CSV Import` / `Drive Sync`) | tells a hand-corrected day from a synced one, so the sync does not overwrite a correction |
| `source_status_code` | the raw code, so a future code 6 is visible instead of silently mapped |
| `sync_file_id` | which file produced this row |

`source` earns its place: once HR fixes a day by hand, the next sync should
respect that. The upsert will skip rows whose existing `source = 'Manual'` unless
the run is explicitly told to overwrite.

---

## 8. The daily email, and the page

**Email** to admins and HR managers after every run:

- Which file, which business date, and the run's outcome.
- Counts: rows read, matched, inserted, updated, and how many were Present /
  Late / Absent / early-departure.
- **Unmatched device IDs** with the names from the file — the list that needs
  action.
- **Missing punches** — checked in, never out.
- **Company disagreements** between the file's `department` and the employee
  record (§5).
- On a bad run: the error, and that a retry is scheduled.
- On no file at all: that yesterday has no data yet.

**A page** under Attendance → *Drive Sync* (admin / hr_manager): the last runs,
per-file status and counts, the unmatched list, a **Sync now** button and
**Retry** on failures. The email answers "what happened this morning"; the page
answers "what happened over the last month, and why is this person missing".

---

## 9. Decisions — answered 2026-08-11

| # | Question | Decision |
|---|---|---|
| 1 | Company authority | **The employee record.** Nobody is moved based on the file; every disagreement is reported in the daily email. |
| 2 | Left early (codes 3 / 5) | **Keep the status, record the minutes.** 3 → `Present`, 5 → `Late`, both with `early_leave_minutes` stored and shown. No `Half Day` threshold. |
| 3 | Absent on an approved-leave day | **Write `On Leave`, and name it in the email.** Every reclassified day is listed with the employee and the date, so nothing changes silently. |
| 4 | Start date | **The go-live day only.** Everything earlier is recorded `Skipped` and never read. |
| 5 | Drive access | **Service account, read-only, one shared folder.** |
| 6 | Manual corrections | **Protected.** A day whose row has `source = 'Manual'` is skipped and reported as "skipped: manual correction". An explicit *Overwrite manual corrections* action exists for when that is genuinely wanted. |
| 7 | Unmatched device IDs | **Report, never invent.** `4001 Majd Barshiny` and `4033 Mohammed Saif` stay on the unmatched list until they are added or ignored by hand. |
| 8 | Report recipients | **Admins and HR managers**, resolved from roles so the list cannot go stale. |

---

## 9a. What the operator needs to do (once)

This is the only part that cannot be done from inside the repo. It can happen in
parallel with steps 1–2 of the build.

1. Go to **console.cloud.google.com** and create a project (or reuse one).
2. **APIs & Services → Library → Google Drive API → Enable.**
3. **APIs & Services → Credentials → Create credentials → Service account.**
   Give it a name like `ist-hr-attendance-reader`. No roles are needed — access
   comes from sharing the folder, not from IAM.
4. Open the service account → **Keys → Add key → Create new key → JSON.** A file
   downloads. It contains `client_email` and `private_key`.
5. In **Google Drive**, open the folder the attendance software writes to.
   **Share** it with the `client_email` from that file, as **Viewer**. Nothing
   else in the Drive is reachable.
6. Copy the folder id from its URL:
   `drive.google.com/drive/folders/`**`<this part>`**
7. In **Coolify**, add three runtime environment variables — never in the repo,
   per the project's security rules:

   - `GOOGLE_DRIVE_SA_EMAIL` — the `client_email`
   - `GOOGLE_DRIVE_SA_PRIVATE_KEY` — the `private_key`, newlines included
   - `ATTENDANCE_DRIVE_FOLDER_ID` — the folder id from step 6

The JSON key file itself should not be committed, emailed, or pasted into chat —
only the two values, straight into Coolify.

---

## 10. Build order

Each step is separately verifiable, and nothing touches live attendance data
until step 4.

1. **Schema** — `attendance_sync_files`, `attendance_sync_runs`, the new
   `attendance` columns. Idempotent migration + `ensureSchema` guards, per the
   project's conventions.
2. **Parser, in isolation** — the CSV in, normalised rows out, with the real file
   as a fixture. Covers the status codes, empty punches, the missing-punch case,
   a filename/date mismatch, and unknown device IDs. No database, no network.
3. **Drive client** — list, filter against the ledger, download. Verified against
   the real folder read-only, printing what it *would* import without writing.
4. **Importer** — ledger + upsert + leave cross-check + the `source` guard. First
   run manually triggered, against one known day, output compared against the
   file by hand.
5. **Scheduler + email + notifications** — 05:00, run-claim, the report, and the
   no-file warning.
6. **The page** — history, counts, Sync now, Retry.

Steps 1–4 are the substance; 5 and 6 are the operational shell around them.
