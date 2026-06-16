# Assets Module

## Overview

The **Assets Module** manages the assignment, tracking, and lifecycle of company IT assets and platforms. It is tightly integrated with the Onboarding and Offboarding modules.

**Render Function**: `render_assets()` (Line ~5564)

---

## Sub-Tabs

| Tab            | Title                  | Purpose                                    |
|----------------|------------------------|--------------------------------------------|
| `assignments`  | 👤 Employee Assignments | Assets assigned to specific employees      |
| `inventory`    | 📦 Inventory           | Stock levels and availability tracking     |
| `catalog`      | 🗂 Platform Catalog     | Full catalog of available platforms        |

---

## Employee Assignments Tab

### Statistics Cards

| Metric              | Description                            |
|---------------------|----------------------------------------|
| Total Assigned      | All assigned asset records             |
| Active / Issued     | Currently active assets                |
| Returned            | Assets returned by employees           |
| Deactivated/Missing | Revoked or lost assets                 |

### Assignment Table Columns

| Column            | Content                              |
|-------------------|--------------------------------------|
| Employee          | Employee name (from employee record) |
| Entity            | RE/MKT badge                         |
| Platform / Asset  | Platform icon + name + workspace     |
| Category          | Asset category label                 |
| Type              | Hardware / Account / Software badge  |
| Access / Condition| Access level or condition             |
| Identifier        | Serial number, account ID, etc.      |
| Issued            | Issue date                           |
| Exp. Return       | Expected return date (if set)        |
| Status            | Active / Returned / Deactivated      |
| Actions           | Edit, Return, Revoke buttons         |

### Asset Data Model

```javascript
{
  id: "a001",
  employeeId: "e001",
  entity: "RE",
  name: "Microsoft Office 365",
  category: "productivity",
  assetType: "Account",           // "Hardware", "Account", "Software"
  workspace: "maya.f@istrealstate.com",
  accessLevel: "Standard",
  identifier: "maya.fernandez",
  credentialPlaceholder: "Saved in IT vault",
  issuedDate: "2026-04-13",
  expectedReturn: null,
  status: "Active",               // "Active", "Returned", "Deactivated", "Missing"
  condition: "Good",
  notes: ""
}
```

---

## Platform Catalog Tab

### Asset Categories (`ASSET_CATEGORIES`)

| ID            | Label               | Icon  | Color     |
|---------------|---------------------|-------|-----------|
| `email`       | Email & Calendar    | 📧    | `#0369A1` |
| `crm`         | CRM & Sales         | 🎯    | `#7C3AED` |
| `communication`| Communication      | 📞    | `#059669` |
| `productivity`| Productivity        | 📊    | `#D97706` |
| `security`    | Security            | 🛡️    | `#DC2626` |
| `marketing`   | Marketing           | 📣    | `#EA580C` |
| `hardware`    | Hardware            | 💻    | `#374151` |
| `access`      | Physical Access     | 🔑    | `#1D3557` |

### Platform Catalog (`PLATFORM_CATALOG`)

Each platform entry includes:
- **name**: Platform name (e.g., "Microsoft Outlook")
- **cat**: Category ID
- **entity**: `"RE"`, `"MKT"`, or `"BOTH"`
- **notes**: Brief description

Catalog cards display:
- Platform icon and name
- Entity badge
- Description
- Available stock count
- Active user count
- Total quantity

### Catalog Filters

| Filter       | Purpose                                |
|--------------|----------------------------------------|
| Search       | Text search across platform names      |
| Entity       | Filter by RE / MKT / All              |
| Category     | Filter by asset category               |
| Clear        | Reset all filters                      |

---

## Inventory Tab

### Inventory Management

The inventory tracks stock quantities per platform:

| Function               | Purpose                                    |
|------------------------|--------------------------------------------|
| `loadInvTotals()`      | Load inventory quantities from localStorage |
| `saveInvTotals(totals)`| Save inventory quantities                  |
| `getInvRow(name)`      | Get available/total counts for a platform  |
| `renderInventoryPane()`| Render the full inventory grid             |

Inventory is **automatically updated** when assets are assigned (onboarding) or returned (offboarding).

---

## Key Functions

| Function                  | Purpose                                    |
|---------------------------|--------------------------------------------|
| `render_assets()`         | Renders the full assets module             |
| `assetTabSwitch(tab)`     | Switches between sub-tabs                  |
| `openAssignAsset()`       | Opens asset assignment modal               |
| `editAsset(id)`           | Opens asset edit modal                     |
| `returnAsset(id)`         | Marks an asset as returned                 |
| `deactivateAsset(id)`     | Marks an asset as deactivated/revoked      |
| `renderInventoryPane()`   | Renders the inventory management view      |
