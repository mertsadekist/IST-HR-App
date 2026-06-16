# Phase 6 Implementation — missing HR modules

**Started:** 2026-06-11 · Builds on Phases 1–2. New modules inherit the security patterns established in Phase 1 (tenantScope, validate, RBAC, audit) by construction.

## Leave Management (F-02) — DONE

A complete, tenant-scoped leave module with an embedded approval flow and balance accounting.

### Schema (live + `schema.sql` + `migrations/leave_module.sql`)
- `leave_types` — per-company or global (`company_id` NULL); seeded global defaults: Annual (30, paid), Sick (15, paid), Unpaid (0).
- `leave_balances` — `UNIQUE(employee_id, leave_type_id, year)`, tracks entitled/used; remaining computed.
- `leave_requests` — Pending/Approved/Rejected/Cancelled, decided_by/at, decision_note, days (inclusive), indexed by `(company_id, status)` and employee.

### API — `routes/leave.js` (mounted at `/api/leave`)
- `GET /types` (company + global), `POST /types` (HR).
- `GET /balances` (HR see all in company; employees see only their own), `POST /balances` (HR set entitlement, upsert).
- `GET /requests` (scoped; employees see only their own), `POST /requests` (employee self-service or HR-for-employee; days computed inclusively; date validation).
- `PUT /requests/:id/approve` (HR; transactional balance debit; paid types blocked when over balance; unpaid never blocked; auto-seeds a balance row from the type default).
- `PUT /requests/:id/reject` (HR), `PUT /requests/:id/cancel` (owner or HR; credits balance back if previously approved).
- All endpoints: `tenantScope` (cross-company → 404), `validate()`, role checks, and audit-logged.

### Tests — `tests/leave.test.js` (8/8 passing)
Lifecycle (entitlement → request → approve → debit), insufficient-balance block, cancel→credit-back, employee self-service scoping, employee-cannot-approve (403), cross-company approve (404), date validation (422).

### Employee self-service (partial F-06)
Employees can now view balances and create/cancel their own leave requests directly via `/api/leave/*` (scoped to their own `employee_id`).

## Verification (cumulative)
- Full server test suite: **66/66 passing** (api 20 + e2e 9 + isolation 16 + eosb 8 + validation 5 + leave 8).
- `node --check` clean on all new/changed files. Live migration applied (`node apply_leave.mjs`).

## Attendance (F-01) — DONE

### Schema (live + `schema.sql` + `migrations/attendance_module.sql`)
- `attendance` — `UNIQUE(employee_id, work_date)`, fields: check_in/check_out (DATETIME), work_hours (computed), status (Present/Absent/Late/Half Day/On Leave/Holiday/Remote), notes; indexed by `(company_id, work_date)` and status.

### API — `routes/attendance.js` (mounted at `/api/attendance`)
- `GET /` (scoped; employees see only their own; filters: employee_id, from, to, status).
- `POST /` (HR upsert a day's record; computes work_hours; validates check-out ≥ check-in and status enum).
- `POST /check-in`, `POST /check-out` (employee self-service; double check-in → 409; late detection after 09:15 → status `Late`).
- `GET /summary?employee_id=&month=YYYY-MM` (counts by status + total hours; employees scoped to self).
- `PUT /:id`, `DELETE /:id` (HR; tenant-scoped, 404 cross-company).
- All endpoints: `tenantScope`, `validate()`, RBAC, audit-logged.

### Tests — `tests/attendance.test.js` (8/8 passing)
Check-in/double-block/check-out, check-out-without-check-in, HR record + summary hours, 422 (bad time order / invalid status), cross-company 404, employee-only list, employee-cannot-record (403).

## Verification (cumulative)
- Full server test suite: **74/74 passing** (api 20 + e2e 9 + isolation 16 + eosb 8 + validation 5 + leave 8 + attendance 8).
- Live migrations applied; backend restarted so `/api/leave` and `/api/attendance` are live (frontend on :5173, backend on :3001).

## Payroll (F-03) — DONE

### Calculation engine — `services/payrollService.js` (pure, 5/5 unit tests)
`computePayrollItem({basicSalary, fullSalary, unpaidLeaveDays, absenceDays, extraDeductions})` → breakdown: allowances (full−basic), daily rate (basic/30), leave+absence deduction, net (floored at 0). Full-below-basic corrected up.

### Schema (live + `schema.sql` + `migrations/payroll_module.sql`)
- `payroll_runs` — `UNIQUE(company_id, period)`, status Draft/Approved/Paid/Cancelled, totals, approver/paid stamps.
- `payroll_items` — per-employee line (basic, allowances, gross, unpaid_leave_days, absence_days, deductions, net), FK to run (cascade).

### API — `routes/payroll.js` (mounted at `/api/payroll`)
- `GET /runs`, `GET /runs/:id` (with items) — HR, scoped.
- `POST /runs/generate {period}` — HR; pulls **approved unpaid-leave days** (from `leave_requests` + `leave_types.is_paid=0`) and **absence days** (from `attendance`) for the period and computes every active employee's line in one transaction; one run per company+period (regenerate only while Draft).
- `PUT /runs/:id/approve` (HR), `PUT /runs/:id/mark-paid` (admin), `DELETE /runs/:id` (admin, Draft only) — with status guards (409).
- `GET /payslips/my?period=` (employee self-service; only Approved/Paid runs), `GET /payslips/:employeeId` (HR).
- All endpoints: `tenantScope` (cross-company → 404), `validate()`, RBAC, audit-logged.

### Tests — `tests/payroll.integration.test.js` (8/8) + `tests/payroll.test.js` (5/5)
Generate with real unpaid-leave + absence deductions (gross 10000 → deduct 600 → net 9400), run detail, payslip hidden pre-approval, approve→pay→payslip visible, lifecycle guards (double-pay/delete-paid → 409), employee-cannot-generate (403), cross-company 404, malformed period 422.

## Verification (cumulative)
- Full server test suite: **87/87 passing** across 9 suites (api 20 + e2e 9 + isolation 16 + eosb 8 + validation 5 + leave 8 + attendance 8 + payroll-unit 5 + payroll-integration 8).
- Live migrations applied; backend restarted — `/api/leave`, `/api/attendance`, `/api/payroll` all live (frontend :5173, backend :3001).

## In-app Notifications (F-08 / UI-003) — DONE
- **Schema:** `notifications` (user_id, company_id, type, title, body, link, is_read), indexed `(user_id, is_read, created_at)`. Live + `schema.sql` + `migrations/notifications_module.sql`.
- **Service:** `notificationService.js` — `notify`, `notifyUsers`, `notifyRole` (by company+role, excluding the actor), `userIdForEmployee`. Best-effort (never breaks the calling op, like auditService).
- **API:** `routes/notifications.js` (`/api/notifications`) — list (own, `?unread=1`), unread-count, mark `:id/read`, read-all, delete. Strictly personal (filtered by `req.user.id`; cross-user → 404).
- **Producers wired:** leave request created → notify HR managers; leave approved/rejected → notify the requesting employee; onboarding offer accepted/rejected → notify the assigned HR user; payroll approved → notify admins.
- **Frontend:** the previously-decorative Topbar bell is now a live `NotificationBell` — unread badge (polls every 60s), dropdown list, click-to-open (navigates to `link` + marks read), mark-all-read. Fixes audit UI-003.
- **Tests:** `tests/notifications.test.js` (4/4) — personal scoping (HR sees, employee doesn't), producer firing on leave create + approve, mark-read/read-all, cross-user 404.

## Verification (cumulative)
- Full server suite: **115/115 passing** across 12 suites. Client production build: green. Backend restarted — `/api/notifications` live (frontend :5173, backend :3001).

## Frontend pages: Leave / Attendance / Payroll — DONE
- **`pages/lifecycle/Leave.jsx`** + `api/leaveApi.js` — tabs for Requests (create / approve / reject / cancel, role-aware), Balances (HR set entitlement), Types (HR add); status filters + badges.
- **`pages/lifecycle/Attendance.jsx`** + `api/attendanceApi.js` — self check-in / check-out, monthly summary (by-status counts + total hours), filters (employee/date/status), HR record modal.
- **`pages/lifecycle/PayrollRuns.jsx`** + `api/payrollApi.js` — generate run by month, run list with totals, detail modal with per-employee items, approve / mark-paid / delete (status-gated), plus a personal "My Payslips" table.
- Routes registered in `App.jsx` (`/leave`, `/attendance`, `/payroll-runs`); sidebar entries added under HR Management with `CalendarDays` / `Clock` / `Banknote` icons.
- **Verified:** production build green; all three chunks emitted; backend routes live (401 auth-gated).

### Module UI status
| Module | Backend | Frontend |
|---|---|---|
| Leave (F-02) | ✅ | ✅ |
| Attendance (F-01) | ✅ | ✅ |
| Payroll (F-03) | ✅ | ✅ |
| Onboarding v2 | ✅ | ✅ |
| Notifications (F-08) | ✅ | ✅ (bell) |

## Next candidate work (not yet built)
- **Generic approval engine (F-04)** — to replace the per-module embedded approvals and cover hire/offboarding.
- **PDF offer generation** + document-expiry alert job (feeds notifications).
- Audit's remaining UI fixes: remove mock data in `Candidates.jsx`, wire/hide Topbar search, add `ProtectedRoute` role checks.
