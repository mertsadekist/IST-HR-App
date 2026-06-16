# User Management Module

## Overview

The **User Management Module** handles user account CRUD operations. Only Admin-role users can create, edit, disable, or reset passwords for other users.

**Render Function**: `render_users()` (Line ~9038)

---

## User Roles

| Role         | Label        | Color    | Permissions                              |
|--------------|--------------|----------|------------------------------------------|
| `admin`      | Admin        | `#4C1D95`| Full system access + user management     |
| `hr_manager` | HR Manager   | `#1E40AF`| All HR operations                        |
| `recruiter`  | Recruiter    | `#065F46`| Recruitment modules only                 |
| `employee`   | Employee     | `#374151`| Self-service only                        |

---

## User Table Columns

| Column   | Content                                    |
|----------|--------------------------------------------|
| Name     | Avatar (initial) + full name + email       |
| Username | Monospace code-style display               |
| Role     | Color-coded role badge                     |
| Entity   | Entity-specific badge (RE/MKT/All)         |
| Status   | Active (green) / Inactive (red) badge      |
| Actions  | Edit, Disable/Enable, Reset Password       |

---

## User CRUD Modal Fields

| Field ID      | Label       | Type     | Required | Notes                    |
|---------------|-------------|----------|----------|--------------------------|
| `um-name`     | Full Name   | text     | Yes      |                          |
| `um-username` | Username    | text     | Yes      | Lowercase, must be unique|
| `um-email`    | Email       | text     | No       |                          |
| `um-password` | Password    | password | Yes*     | Min 6 chars, *on create  |
| `um-role`     | Role        | select   | Yes      | 4 role options           |
| `um-entity`   | Entity      | select   | Yes      | ALL, RE, MKT             |

---

## Key Functions

| Function                     | Purpose                                    |
|------------------------------|--------------------------------------------|
| `render_users()`             | Renders user management table              |
| `openAddUser()`              | Opens empty user creation modal            |
| `openEditUser(id)`           | Opens pre-filled edit modal                |
| `saveUser()`                 | Creates or updates user record             |
| `toggleUserActive(id, curr)` | Enables/disables user account              |
| `resetUserPassword(id)`      | Prompts for and sets new password          |
| `closeUserModal()`           | Closes the user management modal           |
| `loadUsers()`                | Loads users from localStorage              |
| `saveUsers(users)`           | Saves users to localStorage                |

---

## Security Notes

> ⚠️ Passwords are stored as `btoa(password)` — Base64 encoding, NOT encryption.

> ⚠️ Admin cannot disable their own account (self-protection check).

> ⚠️ Password reset uses `prompt()` — browser native dialog, no confirmation.
