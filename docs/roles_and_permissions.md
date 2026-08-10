# Roles and permissions

How access is decided in the IST HR System, and what each role can reach.

Two independent questions are answered by two different mechanisms, and mixing
them up is the usual source of confusion:

| Question | Decided by |
|---|---|
| **Which company's data do I see?** | the selected Entity → `tenantScope` / `companyClause` |
| **What may I do at all?** | the role → `authorize()` and `requireModule()` |

A role never widens company scope, and an entity never widens permissions.

---

## The three layers

1. **`tenantScope`** (`server/middleware/tenant.js`) pins every query to a company.
   `CROSS_COMPANY_ROLES` — `admin`, `hr_manager`, `recruiter`, `accountant` — may
   switch entity and, with no `company_id`, read across all of them. `employee`
   is pinned to their own company from the token.

2. **`authorize(...roles)`** (`server/middleware/rbac.js`) guards individual
   write routes. This is the long-standing layer and it covers **writes only** —
   most read routes carry no `authorize()` call.

3. **`requireModule(module)`** (`server/config/permissions.js`) guards a whole
   router, reads included. It exists because a role can be defined by what it
   must *not* see, and hiding a sidebar entry is not a permission.

`ROLE_MODULES` maps a role to the modules it may reach. `'*'` means unrestricted
and is now carried only by `admin` and `hr_manager`; `recruiter`, `accountant`
and `employee` all have real module lists.

Several modules may be passed — `requireModule(OPERATIONS, ASSETS)` — and any
one of them grants access. A few routers serve more than one audience:
`/settings` carries both the ATS stage editor and the asset catalogue.

### Self-service routers are deliberately not gated

`attendance.js` and `leave.js` carry no module gate. Every read in them already
narrows to the caller's own record unless they are HR (`if (!isHR(req))`), and
every write is `authorize()`-gated. Putting a module gate in front would stop
employees checking in and requesting leave — the opposite of the intent. The
same is true of `portal.js`, `notifications.js` and `GET /payroll/payslips/my`,
all of which resolve the employee from the token, so no `company_id` in the
query can widen them.

`salaryReviews.js` is gated **per read route** rather than at the router, because
`PUT /:id/decision` is authorized by identity — the company's designated
approver, whoever they are — and a module gate in front of it would lock out an
approver whose account happens to carry a self-service role.

---

## The matrix

✅ full · 👁 read only · ❌ denied (including reads)

| Module | admin | hr_manager | recruiter | **accountant** | **employee** |
|---|---|---|---|---|---|
| Recruitment (candidates, vacancies, applicants, CV scorer) | ✅ | ✅ | ✅ | **❌** | **❌** |
| Employees, onboarding, offboarding | ✅ | ✅ | **❌** | 👁 | ❌ |
| Leave, attendance | ✅ | ✅ | own only | own only | own only |
| Payroll runs, WPS export + send, mark paid | ✅ | ✅ (no mark paid) | ❌ | **✅** | ❌ |
| Payslips | ✅ | ✅ | ❌ | ✅ | own only |
| Salary reviews | ✅ | ✅ | **❌** | 👁 | ❌ |
| Assets, inventory, digital access, social, domains | ✅ | ✅ | **❌** | ✅ | own only |
| Company documents, legal letters | ✅ | ✅ | **❌** | ✅ | ❌ |
| Reports, KPI, audit log, email log | ✅ | ✅ | **❌** | ❌ | ❌ |
| Departments, ATS stages | ✅ | ✅ | **✅** | departments only | ❌ |
| Settings, skills | ✅ | ✅ | **❌** | catalogue only | ❌ |
| Users | ✅ | ❌ | ❌ | ❌ | ❌ |
| Dashboard, help centre | ✅ | ✅ | ✅ | ✅ | **❌** |
| Own portal, notifications, company list | ✅ | ✅ | ✅ | ✅ | ✅ |
| Deletes (anywhere) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Reveal a stored password | ✅ | ❌ | ❌ | **❌** | own only |
| Mark a payroll run Paid | ✅ | ❌ | ❌ | **✅** | ❌ |

"own only" means the route resolves the employee from the token, so the caller
sees their own record and nobody else's.

Every role now carries a real module list except `admin` and `hr_manager`.

---

## The accountant

Added 2026-08-08 for the organization's accountant.

**Can:**
- Run payroll end to end — generate a run, approve it, check WPS readiness and
  export the MOL file, and read any employee's payslips.
- Own the assets and access module: inventory, assignments, digital access
  seats, social accounts, and the domain register. Create and edit throughout.
- Manage company documents and legal letters, including expiry dates, and
  receives the expiry and domain-renewal warnings alongside admins and HR.
- Read employee records, because payroll is calculated from them.
- Switch between companies — payroll, assets and paperwork are handled for the
  group, not one company at a time.

**Cannot:**
- Reach recruitment **at all**. Candidates, vacancies, applicants and the CV
  scorer return 403 on reads as well as writes, the dashboard's candidate and
  vacancy figures are blanked server-side, and the pipeline returns empty.
- Reach reports, KPI, the audit log or the email log. The reporting suite
  aggregates the hiring pipeline, so it follows the recruitment denial.
- Change employee records, run onboarding/offboarding, or decide leave.
- Delete anything, reveal a stored password, or manage users.

The Payroll Runs page is theirs end to end: generate a run, approve it, check
WPS readiness, export the file, **email it to the bank or the PRO**, and mark
the run Paid once the transfer has gone out. Sending rebuilds the workbook
server-side and attaches it, so the file never makes a round trip through the
browser — what arrives is exactly what the download produces. An incomplete file
needs the same explicit force flag to send as it does to download.

Two limits remain on that page:

- **Deleting a run stays admin-only**, in line with deletes everywhere else.
  That is destroying the record of a payment, not completing one.
- **Salary reviews are read-only.** Proposing and approving a raise is a
  management decision, not an accounting one.

Either can be opened by adding `'accountant'` to the relevant `authorize()`
list — say so explicitly rather than assuming.

---

## The employee gap, and what closing it changed

`authorize()` only ever guarded writes, so any authenticated user could **read**
any module their company scope allowed. The sharpest case: `GET /api/employees`
selects `e.*`, so an `employee` account — the lowest-privilege login in the
system, held by every member of staff — could read every colleague's salary,
IBAN and passport number straight from the API. The menu never offered it; the
API answered anyway.

Closed 2026-08-08. `employee` now maps to `[PORTAL]` and the operational routers
are module-gated, so those reads return 403.

What deliberately still works, because it was never the gap:

- **Their own portal** — assets, accounts, and revealing their own stored
  password (`portal.js`).
- **Their own payslips** — `GET /payroll/payslips/my`. Any other payslip is 403.
- **Attendance and leave self-service** — checking in and out, submitting a
  leave request, cancelling it, and seeing their own history. Every read there
  narrows to the caller, which is why those routers are not gated.
- **Notifications and the company list**, loaded by the layout on every boot.

Three tests in `tests/isolation.test.js` asserted the old behaviour — that an
employee reads the employee directory, filtered to their company. They now
assert 403, plus a new case proving the portal still serves that same employee
their own assets and cannot be widened by a `company_id` in the query.

### The employee opens straight into their own portal

The dashboard was the last page an employee could still open, and it is a
company overview: headcount, hiring trend, everyone's recent activity. None of
it is theirs to read, so `/api/dashboard/*` is gated on a `DASHBOARD` module the
role does not have, and the page, the sidebar entry, the help centre, the
topbar's cross-system search and the entity switcher are all gone with it. Their
menu is one item — My Assets & Accounts — and that is where login lands them.

The entity switcher is hidden rather than disabled: `tenantScope` pins an
employee to their own company from the token, so it was offering a choice that
changed nothing.

Redirects go through `landingPathFor(role)` rather than a fixed `/dashboard`.
A role that cannot open the dashboard would otherwise be redirected onto a page
that redirects it straight back.

### The recruiter, closed the same way

`recruiter` had the same shape of hole and was closed straight after, mapping to
`[RECRUITMENT, PORTAL]`. Hiring needs two things outside its own module — the
department a vacancy is filed under, and the ATS stage configuration — so
`departments` and `settings` accept `RECRUITMENT` as one of their modules.
Leave and attendance stay reachable because those routers are self-service: a
recruiter is a member of staff who books their own leave.

No role is `'*'` now except `admin` and `hr_manager`.

---

## "Login as" (impersonation)

An admin can operate another user's account from **User Management** — the amber
person icon on the row. It exists so a report of "I cannot see X" can be
answered by looking at what that person actually sees.

The feature is only safe because of what surrounds it:

| Guard | Why |
|---|---|
| `authorize('admin')` | nobody else can start a session |
| **Admins cannot be impersonated at all** | a company-bound admin borrowing a platform admin would escalate out of their own company; one admin borrowing another gains nothing and muddies the trail |
| Target must be in the caller's user-management scope | a company-bound admin cannot reach into another company |
| No chaining (`denyImpersonated`) | you cannot start a session from inside one, which would launder the original identity away |
| Disabled accounts refused | a disabled login should stay unusable |
| 30-minute token | for looking at something specific, not for working as someone else all day |
| Every action names both people | `addAudit` reads the token's `imp` claim and files the entry under the **admin's** user id as `Admin (as User)` |
| Other admins notified | same out-of-band rule as revealing a stored password — the operator cannot be the only one who knows |
| Non-dismissible banner | the worst outcome is an operator who forgot whose account they are in |

**What a borrowed identity may do:** everything that role can do. The session
carries the target's role, so the module gates apply normally — impersonating an
employee gives you an employee's access, not an admin's.

**What it may never do:** reveal a stored password (`portal.js` reveal and the
admin reveal both carry `denyImpersonated`). That is the one action no audit
entry can undo — the secret is out.

Writes are deliberately allowed rather than blocked, so the operator can
actually reproduce and fix a problem. The audit stamping is what makes that
acceptable: no action taken in a borrowed session can be mistaken for something
the account owner did.

**Getting back:** `POST /api/auth/stop-impersonation` reads the admin's identity
from the token's claim — never from the request — and re-checks it against the
database (present, active, still an admin) before minting a normal token. So it
can only ever return the exact account that started the session, which is what
stops it being a token-minting oracle. If the admin was demoted meanwhile, it
refuses and the session ends at the login screen.

---

## Adding a role

1. Add it to `ROLE_MODULES` in `server/config/permissions.js`. `ALLOWED_ROLES`
   in `server/routes/users.js` is derived from those keys, so the role becomes
   creatable automatically — and a role can never be offered without an access
   definition.
2. Add it to the `users.role` enum: a new `apply_*.mjs` migration plus an
   `ENUM_GUARDS` entry in `server/config/ensureSchema.js`, so a deploy that
   skips the migration script still self-heals.
3. Decide `CROSS_COMPANY_ROLES` in `server/middleware/tenant.js`.
4. Add it to the `authorize()` lists it needs. Deletes stay `admin`.
5. Mirror it in `client/src/config/permissions.js`, the sidebar audiences in
   `client/src/components/partials/Sidebar.jsx`, and the `roles` list and hint
   in `client/src/pages/users/UserManagement.jsx`.

The client mirror is for navigation only. It ships to the browser and can be
edited there — the API is the security boundary.
