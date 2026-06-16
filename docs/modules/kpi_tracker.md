# HR KPI & Commission Tracker Module

## Overview

The **HR KPI & Commission Tracker** allows HR to track recruiter commissions based on hire retention and performance milestones. Commissions are payable on hires retained post-probation.

**Render Function**: `render_kpi()` (Line ~9219)

---

## Commission Tiers (`KPI_TIERS`)

| Tier ID        | Label                     | Amount   | Icon | Criteria                                  |
|----------------|---------------------------|----------|------|-------------------------------------------|
| `retained_6m`  | Retained 6+ Months        | AED 500  | 🏅   | Hire still active after 6 months          |
| `sales_4deals` | Sales: 4+ Deals/Quarter   | AED 750  | 🎯   | Sales hire closed 4+ deals (CRM confirmed)|
| `top3pct`      | Top 3% Performer          | AED 1,000| 🏆   | Hire ranked in Top 3% (Sales Mgr confirms)|

Commission is cumulative — a hire can achieve multiple tiers.

---

## KPI Targets (`KPI_TARGETS`)

| Target ID         | Label                    | Target | Unit          |
|-------------------|--------------------------|--------|---------------|
| `monthly_hires`   | Monthly Hire Target      | 5      | hires/month   |
| `retention_6m`    | 6-Month Retention Rate   | 85     | %             |
| `kpi_achievement`  | Hires Meeting Dept KPIs | 80     | %             |
| `ttf`             | Avg Time-to-Fill         | 21     | days (max)    |

---

## Dashboard Statistics

| Card                  | Content                              |
|-----------------------|--------------------------------------|
| Total Hires Logged    | Count of all logged hires            |
| Total Commission      | Sum of all commissions (AED)         |
| This Quarter          | Commission earned in current quarter |
| Confirmed             | Number of confirmed (post-probation) |

---

## Hire Commission Log Table

| Column           | Content                              |
|------------------|--------------------------------------|
| Employee         | Hire name + role                     |
| Entity           | RE/MKT badge                         |
| Join Date        | When the hire started                |
| Commission Tiers | Badges for achieved tiers            |
| Commission       | Total AED amount                     |
| Status           | Confirmed / Pending badge            |
| Actions          | Edit, Delete buttons                 |

### Filter

Dropdown filter options: All Hires, Pending Only, Confirmed Only

---

## Add/Edit KPI Hire Modal

| Field ID      | Label                    | Type     | Required |
|---------------|--------------------------|----------|----------|
| `km-name`     | Employee Name            | text     | Yes      |
| `km-role`     | Role / Job Title         | text     | No       |
| `km-entity`   | Entity                   | select   | Yes      |
| `km-join`     | Join Date                | date     | Yes      |
| Tier checkboxes | Commission Tiers       | checkbox | No       |
| `km-status`   | Commission Status        | select   | No       |
| `km-notes`    | Notes                    | textarea | No       |

### Commission Calculation

```javascript
commission = KPI_TIERS
  .filter(tier => selectedTiers.includes(tier.id))
  .reduce((sum, tier) => sum + tier.amount, 0);
```

---

## Key Functions

| Function                 | Purpose                                    |
|--------------------------|--------------------------------------------|
| `render_kpi()`           | Renders the full KPI tracker module        |
| `loadKPI()`              | Loads KPI data from localStorage           |
| `saveKPI(data)`          | Saves KPI data to localStorage             |
| `openLogHire()`          | Opens the add hire modal                   |
| `openEditKPIHire(id)`    | Opens pre-filled edit modal                |
| `saveKPIHire()`          | Creates/updates a KPI hire record          |
| `deleteKPIHire(id)`      | Removes a hire from the log                |
| `filterKPITable()`       | Filters table by status                    |
| `getQuarter(date)`       | Returns quarter string (e.g., "2026-Q2")   |
