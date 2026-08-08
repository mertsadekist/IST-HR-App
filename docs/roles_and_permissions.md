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
and is what every role predating this layer carries — the module system is
additive, and tightening those roles is a separate change with its own blast
radius.

---

## The matrix

✅ full · 👁 read only · ❌ denied (including reads)

| Module | admin | hr_manager | recruiter | **accountant** | employee |
|---|---|---|---|---|---|
| Recruitment (candidates, vacancies, applicants, CV scorer) | ✅ | ✅ | ✅ | **❌** | 👁 ⚠️ |
| HR (employees, onboarding, leave, attendance, offboarding) | ✅ | ✅ | 👁 ⚠️ | **👁** | 👁 ⚠️ |
| Payroll runs, WPS export, payslips | ✅ | ✅ | ❌ | **✅** | own only |
| Salary reviews | ✅ | ✅ | ❌ | **👁** | ❌ |
| Assets, inventory, digital access, social, domains | ✅ | ✅ | 👁 ⚠️ | **✅** | own only |
| Company documents, legal letters | ✅ | ✅ | 👁 ⚠️ | **✅** | 👁 ⚠️ |
| Reports, KPI, audit log, email log | ✅ | ✅ | 👁 ⚠️ | **❌** | 👁 ⚠️ |
| Users, settings, companies | ✅ | settings only | ❌ | **❌** | ❌ |
| Own portal (my assets, my payslips) | ✅ | ✅ | ✅ | **✅** | ✅ |
| Deletes (anywhere) | ✅ | ❌ | ❌ | **❌** | ❌ |
| Reveal a stored password | ✅ | ❌ | ❌ | **❌** | own only |
| Mark a payroll run Paid | ✅ | ❌ | ❌ | **❌** | ❌ |

⚠️ marks the **known gap** described below, not an intended grant.

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
- Delete anything, reveal a stored password, mark a run Paid, or manage users.

Two deliberate separations worth knowing:

- **Mark-paid stays with the admin.** The accountant prepares and exports the
  payroll; someone else confirms the money left. That split is worth keeping.
- **Salary reviews are read-only.** Proposing and approving a raise is a
  management decision, not an accounting one.

Either can be opened up by adding `'accountant'` to the relevant `authorize()`
list — say so explicitly rather than assuming.

---

## Known gap: reads are not gated for the older roles

`authorize()` only ever guarded writes, so any authenticated user can **read**
any module their company scope allows. An `employee` account can call
`GET /api/candidates` directly and get data the sidebar never offers them.

This is why `requireModule` exists, and the accountant is gated with it. The
older roles are still mapped to `'*'` — closing the gap for `employee` and
`recruiter` is a worthwhile follow-up, but it changes behaviour for accounts
already in use and belongs in its own change with its own testing.

To close it later: replace `'*'` in `ROLE_MODULES` with real module lists and
mount `requireModule` on the remaining routers.

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
