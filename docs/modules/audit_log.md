# Audit Log Module

## Overview

The **Audit Log** is an append-only, immutable record of all significant actions taken in the system. No entries can be edited or deleted through the UI.

**Render Function**: `render_audit()` (Line ~8101)

---

## Audit Entry Data Model

```javascript
{
  id: "audit_001",
  ts: "2026-04-15T10:30:00.000Z",   // ISO timestamp
  user: "HR Admin",                   // User who performed the action
  module: "ATS",                      // Module where action occurred
  action: "Stage Changed",            // Action type
  detail: "Maya Fernandez: Joining → Success"  // Human-readable description
}
```

---

## Audit Grid Columns

| Column    | Width  | Content                              |
|-----------|--------|--------------------------------------|
| Timestamp | 160px  | Formatted date/time (dd MMM, HH:mm) |
| User      | 120px  | User badge                           |
| Action    | 120px  | Action type (bold, brand color)      |
| Detail    | Flex   | Full description text                |

---

## Tracked Actions

| Module       | Action                | Trigger                                    |
|--------------|-----------------------|--------------------------------------------|
| ATS          | Stage Changed         | Candidate moved to new pipeline stage      |
| ATS          | Candidate Added       | New candidate created                      |
| Onboarding   | Started               | Onboarding process initiated               |
| Onboarding   | Step Completed        | Onboarding step marked complete            |
| Offboarding  | Initiated             | Offboarding process started                |
| Offboarding  | Step Completed        | Offboarding step marked complete           |
| Assets       | Assigned              | Asset assigned to employee                 |
| Assets       | Returned              | Asset returned by employee                 |
| Assets       | Deactivated           | Asset revoked/deactivated                  |
| Performance  | Target Set            | New performance target created             |
| Performance  | Signed                | Performance agreement signed               |
| Vacancies    | Created               | New vacancy created                        |
| Users        | Created               | New user account created                   |
| Users        | Updated               | User account modified                      |
| Users        | Disabled/Enabled      | User account toggled                       |
| Users        | Password Reset        | User password changed                      |
| System       | Initialized           | System first-time setup                    |

---

## Audit Helper Function

```javascript
function addAudit(module, action, detail, user) {
  const logs = load('audit');
  logs.unshift({                    // Prepend (newest first)
    id: uid(),
    ts: new Date().toISOString(),
    user: user || currentUser?.name || 'System',
    module: module,
    action: action,
    detail: detail
  });
  save('audit', logs);
}
```

---

## Export

The `exportAudit()` function exports the full audit log as a JSON file:
- Filename: `IST_HR_AuditLog_YYYY-MM-DD.json`
- Content: Pretty-printed JSON array of all entries

---

## Key Functions

| Function         | Purpose                                    |
|------------------|--------------------------------------------|
| `render_audit()` | Renders the audit log grid                 |
| `addAudit()`     | Adds a new entry to the audit log          |
| `exportAudit()`  | Downloads the log as a JSON file           |
