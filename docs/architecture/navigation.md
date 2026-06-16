# Navigation & Routing

## Sidebar Structure

The sidebar (`#sb`) is the primary navigation element, organized into groups:

### Navigation Groups

| Group               | Menu Items                                       |
|---------------------|--------------------------------------------------|
| **Overview**        | Dashboard                                         |
| **Recruitment**     | ATS Pipeline, Candidates, Vacancies, CV Scorer    |
| **Employee Lifecycle** | Onboarding, Assets, Performance, Offboarding  |
| **Analytics**       | Reports, Audit Log                                |
| **Legal / Documents** | Legal Letters, Company Docs, Payroll & Labour Law |
| **Admin**           | Org Chart, User Management, KPI Tracker           |

### Navigation Function

```javascript
function nav(section) {
  currentPage = section;
  
  // 1. Update topbar title
  document.getElementById('topbar-title').textContent = SECTION_TITLES[section];
  
  // 2. Update topbar action buttons (e.g., "+ Add Candidate")
  document.getElementById('topbar-actions').innerHTML = getTopbarActions(section);
  
  // 3. Render content
  const renderer = 'render_' + section;
  document.getElementById('content').innerHTML = window[renderer]();
  
  // 4. Post-render hooks (if any)
  const postHook = 'post_' + section;
  if (typeof window[postHook] === 'function') window[postHook]();
  
  // 5. Update sidebar active state
  updateSidebarActive(section);
}
```

### Topbar Actions per Section

Each section can define its own action buttons in the topbar:

| Section        | Action Buttons                                     |
|----------------|----------------------------------------------------|
| `ats`          | + Add Candidate, 📄 Upload CV                      |
| `candidates`   | + Add Candidate, 📄 Upload CV                      |
| `vacancies`    | + New Vacancy                                       |
| `onboarding`   | (None — triggered from ATS pipeline)               |
| `assets`       | + Assign Asset                                      |
| `performance`  | + Set New Target                                    |
| `offboarding`  | + Initiate Offboarding                              |
| `legal`        | (Integrated into the letter generator form)         |
| `users`        | + Add User                                          |
| `kpi`          | + Log Hire for KPI                                  |

---

## Entity Switching

The sidebar includes an **entity switch** component with three options:

| Entity | Label            | Filter Behavior                              |
|--------|------------------|----------------------------------------------|
| `ALL`  | All Entities     | Shows data from both RE and MKT              |
| `RE`   | IST Real Estate  | Filters all data to entity === 'RE'          |
| `MKT`  | IST Markets      | Filters all data to entity === 'MKT'         |

When the entity is changed:
1. `currentEntity` global variable is updated
2. Entity candidate counts update in the sidebar badges
3. Current page is re-rendered with the new filter

### Entity Badge Rendering

```javascript
function entityBadge(entity) {
  // Returns styled badge HTML based on entity
  // RE → Purple badge
  // MKT → Red badge
}
```

---

## Modal System

The application uses a **global modal overlay** for forms, confirmations, and detail views:

```javascript
function openModal(title, bodyHTML, footerHTML) {
  // Sets modal title, body content, and footer buttons
  // Adds 'open' class to .overlay to show the modal
}

function closeModal() {
  // Removes 'open' class from .overlay
}
```

### Modal Usage Pattern

```javascript
openModal('Add New Candidate', `
  <div class="fg">
    <label>First Name *</label>
    <input id="cf" placeholder="First name"/>
  </div>
  <!-- more fields -->
`, `
  <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
  <button class="btn btn-primary" onclick="saveCandidate()">Save</button>
`);
```

---

## Notification System

Toast notifications appear in the top-right corner:

```javascript
function notify(message, type) {
  // type: 'success' (default), 'warn', 'danger', 'info'
  // Shows notification for ~3 seconds, then fades
}
```
