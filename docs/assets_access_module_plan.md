# Company Assets & Access Management — implementation plan

Derived from `IST_Groups_Assets_Access_PRD_Social_Media_Full_Profile_Access_Repaired.xlsx`
(14 sheets, read in full on 2026-08-04) mapped against the HR system as it stands at commit `f6a5197`.

---

## 1. What the workbook actually contains

| Sheet | Content | Rows |
|---|---|---|
| Overview | PRD summary, owners, the availability formula | 22 |
| Asset_Categories | 10 standard top-level categories | 10 |
| Master_Platform_List | Normalized platform catalogue — original alias, standard name, category, company owner, app URL, development type | **107** |
| Inventory_Requirements | 16 required fields for the stock table | 16 |
| Employee_Assignments | 13 required fields for person-level issue | 13 |
| Digital_Access | **40** required fields incl. the whole social identity block | 40 |
| Domain_Infrastructure | 12 required fields for domains/hosting | 12 |
| Workflows | 8 lifecycles: onboarding (5 steps), role change (3), offboarding (6), social setup (3), social grant (2), social review (1), social offboarding (1) | 21 |
| Statuses_Access | 8 physical + 7 digital + 8 offboarding + 5 social statuses, a **ranked 10-level access ladder** (0–9), 3 owner codes | 46 |
| Permissions | 10 roles with explicit can / cannot | 10 |
| Business_Rules | 11 business rules + 16 acceptance criteria + **15 social governance rules** | 42 |
| Reports_Dashboard | 9 reports + 4 search filters + 13 widgets + 11 social reports/widgets | 38 |
| Social_Media_Accounts | 13 platforms × 2 entities, **34 columns** | **26** |
| Social_Team_Access | 13 platforms × 3 asset layers × 2 entities, **28 columns** | **78** |

### The catalogue breakdown (107 platforms)

| Category | Count |
|---|---|
| Social / Content / Ads | 32 |
| AI / Productivity / Creative | 17 |
| Payments / Verification / Integrations | 11 |
| Domains / Hosting / Infrastructure | 9 |
| Real Estate Portals / CRM / Listing | 9 |
| Vendor / Procurement / Services | 9 |
| Identity / Access / Security | 7 |
| **Internally Developed Applications** | 7 |
| Telephony / Communication | 5 |
| Physical Assets | 1 |

Owner split: IST Groups 79 · IST Markets 17 · IST Real Estate 11.

The 7 internally developed apps carry deployment URLs: PropIntels, IST Real Estate WATI App,
IST Real Estate HR App (this system), IST Markets Publisher, IST Links, IST Markets WATI App,
IST Markets Bridge.

### The three-layer social model — the part with no equivalent today

Every social platform is tracked at **three separate layers**, because permissions differ per layer:

1. **Page / Profile / Channel** — the public asset
2. **Business / Portfolio Manager** — the ownership container (Meta Business Portfolio, TikTok Business Center, LinkedIn Business Manager…)
3. **Ads Manager / Advertising Account** — the spending layer

For each layer the PRD demands the **creator's full profile name, direct personal profile URL, and
corporate email** (governance rules 2, 12, 14), plus per-person access rows with 7 boolean rights
(publish / reply / analytics / create ads / edit campaigns / manage billing / manage users).

### Data-quality findings in the workbook itself

- **All 26 social account rows and all 78 team-access rows are empty templates** — status `To Be Completed` / `Pending Entry`. There is no social data to migrate; the system would be capturing it from scratch.
- **One genuine duplicate**: `Amazone` (row 29) and `Amazon` (row 67) both normalize to *Amazon* — one catalogue entry, not two.
- **`Istlinks` is filed twice under different categories**: row 60 as *Real Estate Portals / CRM / Listing* and row 85 as *Internally Developed Applications* (as "IST Links"). The second is correct.
- **`PropIntels` appears twice**: row 69 (`Propintels`) and row 68 — both Internally Developed, IST Real Estate.
- The Overview "Quick Counts" labels have **no values** — the count cells were never filled.
- Every platform row has a company owner and a standardized name — no blanks. Good.

---

## 2. What the system already has

| PRD concept | System today | Verdict |
|---|---|---|
| Asset categories | `asset_categories` — **5 ad-hoc rows** (Laptop, Mobile, Gmail Account, Email Address, SIM Cards) | Needs reseeding to the 10 standard categories |
| Platform master list | `platform_catalog` — **2 rows** (Microsoft Email Accounts, Lenovo) | Needs the 107-row catalogue |
| Company ownership | `platform_companies` (M:N platform↔company) + `company_id` on records | **No "IST Groups / shared" concept** — the key structural gap |
| Per-unit inventory | `asset_inventory` — asset_code, barcode/QR, serial, brand/model, purchase, warranty, depreciation, location, status, condition, image | **Stronger than the PRD asks** (per-unit beats quantity buckets) |
| Employee assignment | `asset_assignments` — employee, platform, name, type, workspace, access_level, identifier, dates, status, encrypted password | Covers ~9 of the 13 PRD fields |
| Assignment history | `asset_assignment_history` | Present |
| Handover receipt | `HandoverSheet.jsx` + upload-receipt | Present |
| Employee view | Assets & Accounts tab on the profile | Present |
| Digital access registry | Nothing distinct — `asset_assignments` with `asset_type='Account'` | Missing ~30 of the 40 PRD fields |
| Social accounts / team access | **Nothing** | Entirely new |
| Domains / hosting | **Nothing** | Entirely new |
| Secrets | AES-256-GCM encrypted password + reveal endpoint | **Conflicts with the PRD** (see §3) |

Live data: 5 categories, 2 platforms, 2 assignments. Effectively an empty module.

---

## 3. Three decisions needed before building

### D1 — How to model "IST Groups" (shared ownership)

The whole system scopes data by `company_id`, and the selected Entity drives every page. The PRD
requires a third owner value meaning *shared by both companies*.

- **Option A (recommended)** — add `owner_scope ENUM('RE','MKT','GRP')` to asset records alongside the
  existing `company_id`. `GRP` rows are visible from every entity; `RE`/`MKT` rows stay scoped.
  Non-invasive: no other module changes.
- **Option B** — create a third company row "IST Groups". Rejected: it would leak into employees,
  payroll, leave and the WPS file, where a fake company is wrong and dangerous.

### D2 — Passwords: keep the vault or keep encryption?

Business rule 10 and social governance rule 8 say passwords must **never** be stored — only a
`vault_secret_reference`. The system currently encrypts passwords and exposes
`GET /assets/:id/reveal-password` to admin/hr_manager.

- **Option A (recommended)** — add `vault_secret_reference` and make it the documented practice for
  all new digital/social records; leave the existing encrypted field for the handful of legacy
  hardware/account rows, and stop offering it on new social records.
- **Option B** — remove password storage entirely. Cleaner against the PRD, but destroys data
  already captured.

### D3 — Build order

Four sub-modules of very different size. My recommended order is in §4; confirm or reorder.

---

## 4. Phased plan

Each phase is independently shippable, follows the repo conventions (idempotent
`server/apply_*.mjs` + `COLUMN_GUARDS`/`TABLE_GUARDS`, `tenantScope` + `companyClause` on every
route, full EN/AR i18n parity, `npm run build` + `npm run i18n:check` green), and ends with live
verification against the dev DB.

### Phase 1 — Foundation: categories, catalogue, ownership *(smallest, unblocks everything)*

- Migration: `owner_scope ENUM('RE','MKT','GRP')` on `platform_catalog`, `asset_inventory`,
  `asset_assignments`; `platform_catalog` gains `standard_name`, `alias_of`, `application_url`,
  `development_type`, `notes`.
- Seed the **10 standard categories**, preserving the existing 5 by mapping them
  (Laptop/Mobile/SIM Cards → *Physical Assets*, Gmail Account/Email Address → *Identity / Access / Security*)
  so the 2 live platforms and 2 assignments keep working.
- Seed the **107-platform catalogue** from the workbook, deduplicated (Amazon once, IST Links under
  Internally Developed Applications only), each with its owner code and app URL.
- Settings page to manage the catalogue; owner filter on Assets and Inventory.

### Phase 2 — Inventory completeness and the availability formula

- Add the two missing lifecycle states the PRD requires and the system lacks:
  `Returned Pending Inspection` and `Reserved` (inventory status enum + assignment status enum).
- Enforce **business rule 1**: a returned item cannot go back to `Available` without passing
  inspection — an explicit inspect step (`Inspection Passed` / `Inspection Failed`).
- A computed availability line per platform implementing the PRD formula
  `Available = Total − Assigned − Reserved − Returned Pending Inspection − Under Maintenance − Damaged − Lost − Disposed`,
  derived from real `asset_inventory` rows rather than the manual `platform_catalog.inventory_total`
  (which today does not reconcile with anything).
- Dashboard widgets: total / available / assigned / pending inspection / damaged-lost, split by owner.

### Phase 3 — Digital access registry ✅ *done (`apply_digital_access.mjs`, `routes/digitalAccess.js`)*

- New table `digital_access`, one row per grant, carrying **34 of the sheet's 40 fields**: platform,
  category, owner, workspace, `access_level` on the ranked 0–9 ladder plus a stored `access_rank`,
  separate `page_access_level` / `ads_access_level`, `has_admin_access`, `has_owner_access`,
  `can_manage_users`, username, login email, registered phone, seat type,
  `seat_consumes_inventory`, business / ad-account / page / portfolio IDs, status,
  granted / revoked dates, `two_factor_enabled`, `last_access_review`, `vault_secret_reference`.
- **The six excluded fields are the creator-provenance ones** (page creator full name / profile URL /
  email, and the same three for the ads-manager creator). They describe the *account*, not a
  person's access to it, so one value serves every grant on that account — storing them per grant
  would let two rows disagree about who created the same page. They belong to `social_accounts` in
  Phase 4.
- Admin and owner flags are validated against the ladder rather than set independently, and the
  check runs against the merged row so a partial update cannot dodge it.
- Seat accounting: when `seat_consumes_inventory` is set, activating a grant reduces the platform's
  available seats and revoking returns one — **once**, tracked by `seat_reclaimed`, so a double
  revoke cannot inflate the count (**acceptance criteria 2, 3, 7**). Deleting a live grant releases
  the seat first. `Suspended` deliberately does *not* release: the seat is still being paid for.
- `GET /digital-access/reports` covers the views the PRD names: admin-and-above, owner-level, 2FA
  exceptions, overdue reviews (90 days by default), pending revocation, reclaimable seats, and
  cross-entity holders.
- **Loose end:** `GET /digital-access/by-employee/:id` exists and is verified but is not yet wired
  into the employee profile's Assets & Accounts tab. That belongs with the Phase 6 cross-module
  wiring.

### Phase 4 — Social media accounts and team access ✅ *done (`apply_social_governance.mjs`, `routes/social.js`)*

- `social_accounts` — one row per platform per entity, with the business-manager and ads-manager
  blocks, **both creator identity blocks** (the six fields Phase 3 deliberately excluded), billing
  and payment-method owners, pixel/catalogue IDs, recovery email/phone, 2FA, last ownership review
  and vault reference. `owner_scope` here is **RE or MKT only** — rule 14 gives every social account
  exactly one entity, so "shared" is not offered, unlike the platform catalogue. A unique key on
  (company, entity, platform) stops the same platform being recorded twice for one entity.
- `social_access` — one row per person **per asset layer**, with the seven rights as separate
  booleans, granted-by identity, 2FA, review and removal dates. The grant's company always comes
  from its account, never from the caller.
- **26 account shells seeded** (13 platforms × 2 entities) pre-filled with account type, business
  manager and ads platform, at status `To Be Completed`.
- **The workbook's 78 empty access rows are deliberately NOT seeded.** In a spreadsheet an empty row
  is a visual template; in a database it is a grant belonging to nobody, and it would pollute every
  count and report the PRD asks for. The three-layer structure comes from the layer vocabulary
  instead, and a row is created when a real person is actually granted access.
- Guardrails that turn the rules into behaviour: an account cannot be marked **Active** until its
  ownership is recorded (the 422 names exactly which fields are missing); a holder name must be a
  complete profile name, so a single word or a team label is refused (rules 12, 13).
- Governance checks: missing backup administrator, account 2FA gaps, **personal-email ownership
  risk** (creator or recovery on a free provider), missing creator provenance, overdue ownership
  review, privileged access without 2FA, billing-access holders listed apart, incomplete holder
  identity, and cross-entity holders.
- Offboarding gets `POST /social/access/remove-person`, which closes **every layer** of an account
  for one person in a single call — doing it row by row is how a layer gets missed.

### Phase 5 — Domains / hosting / infrastructure ✅ *done (`apply_domain_assets.mjs`, `routes/domains.js`)*

- `domain_assets` covers all **12** fields of the Domain_Infrastructure sheet (the plan's earlier
  "15" was a miscount): registrar/provider, business account owner, technical owner, billing owner,
  DNS control owner, hosting control owner, domain, **renewal date**, status, and the named employee
  when it is one person rather than a function. `owner_scope` allows **GRP** here — unlike social
  accounts, a shared registrar account genuinely serves both companies.
- Added beyond the sheet because the alerting needs it: `auto_renew`, `renewal_alert_sent`, and a
  vault reference. `asset_kind` separates Domain / Hosting / DNS / CDN / Infrastructure.
- **Renewal alerts** at 30, 14, 7 and 1 days, plus a distinct already-expired case, delivered through
  the existing notification service to admins and HR managers. Scheduled in-process every six hours
  alongside the salary-review scheduler.
- **Once per threshold, not once per run.** `renewal_alert_sent` records the tightest threshold
  already alerted, so a domain 20 days out gets the 30-day notice and later the 14-day notice —
  rather than the same notice every six hours until everyone learns to ignore it. Changing the
  renewal date clears the history, because a new cycle must be able to alert again.
- `PUT /domains/:id/renew` records that a renewal was paid: rolls the date forward, reactivates the
  record and clears the alert history. It refuses a date in the past.
- `GET /domains/expiring` is the watch-list, and it counts the accountability gaps too: how many
  renewals have **no billing owner named** and how many have auto-renew off.

### Phase 6 — Workflow wiring and reporting ✅ *done (`services/holdingsService.js`)*

- **`GET /employees/:id/holdings`** — the PRD's "By employee" view: issued equipment, digital access,
  social access per layer, and any domain naming the person as responsible. Until this existed,
  "what does this person still have?" meant opening four screens and trusting nobody forgot one.
  Self-service users can read their own and nobody else's.
- **`GET /offboarding/:id/clearance`** — the return-and-revoke checklist the PRD's offboarding
  workflow asks for, built from the same query set so the two cannot drift apart. Each line carries
  the action it needs, and a returned unit stays outstanding as *Awaiting inspection* until it
  passes — the Phase 2 gate reaching into offboarding. A domain asks to be **reassigned**, not
  returned, since leaving without handing it over is how a renewal ends up unwatched.
- **Nothing is auto-actioned.** Collecting a laptop and revoking a Meta admin seat are physical acts
  somebody performs and confirms; a checklist that ticks itself claims recoveries that never
  happened. Each line is closed from its own module, and the panel re-reads the real state.
- **`GET /assets/reports/allocation`** — by department (equipment and headcount), digital grants by
  department with privileged and paid-seat counts, totals by owner scope across assignments,
  inventory and access, and the people holding elevated rights anywhere. Where a grant is linked to
  an employee the employee's own name wins over the free-text holder field.

**Not done, and deliberately so:** onboarding does not auto-create pending assignment bundles. What
a new hire should receive depends on role and department, and the system has no such policy to draw
on — generating a speculative bundle would produce work items nobody asked for. The onboarding
checklist templates already prompt for the same steps; wiring them to real assignments needs a
role-to-kit mapping first, which is its own decision.

---

## 5. Deliberate deviations from the PRD

- **Per-unit over quantity buckets.** The PRD's `total/available/assigned/...` columns are a
  spreadsheet compromise. The system already tracks each unit individually with a barcode, which is
  strictly better; the quantity view is produced by aggregating those rows. Same numbers, better
  provenance.
- **No `Physical Assets` category on the catalogue's single "Headsets" row.** It is inventory, not a
  platform — it belongs in `asset_inventory` under the Physical Assets category.
- **Passwords** — see D2. The PRD is stricter than what is built today; this needs an explicit call.

---

## 6. Effort

| Phase | Scope | Relative size |
|---|---|---|
| 1 | 2 migrations, 1 seed script, catalogue UI, owner filters | Small |
| 2 | Status enums, inspection gate, availability view, widgets | Medium |
| 3 | New table + routes + page + seat accounting | Medium–large |
| 4 | Two new tables, 3-layer UI, seeding, 6 governance reports | **Large** |
| 5 | One table + routes + page + renewal alerts | Small–medium |
| 6 | Cross-module wiring | Medium |

Phase 1 is the right thing to build first regardless of how the other decisions land.
