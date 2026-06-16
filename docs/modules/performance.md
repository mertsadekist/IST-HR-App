# Performance Module

## Overview

The **Performance Module** manages quarterly performance targets for employees. Targets are entity-specific with different KPI structures for Real Estate and Markets.

**Render Function**: `render_performance()` (Line ~5997)

---

## Performance Target Data Model

```javascript
{
  id: "p001",
  employeeId: "e001",
  entity: "RE",
  quarter: "Q2-2026",
  achievementTarget: 70500,
  currency: "AED",
  kpiNotes: "Tier-based with upgrade/downgrade...",
  status: "Active",
  signedDate: null,                  // null = pending, date = signed
  createdDate: "2026-04-15"
}
```

---

## Entity-Specific KPI Structures

### IST Real Estate (AED)
- **Default Target**: AED 70,500/quarter
- **KPIs**: Daily Attendance, Calling Volume, Listings, Closed Deals
- **Structure**: Tier-based with upgrade/downgrade, Turbo Bonuses, Loyalty Programs

### IST Markets (USD)
- **Default Target**: USD 90,000/quarter
- **KPIs**: Daily Attendance, Calling, Active Traders, Active IBs
- **Conversion Funnels**: Lead→Demo/Live/IB, Demo→Live/IB, Live→Funded/IB, IB→Live

---

## Performance Table Columns

| Column     | Content                              |
|------------|--------------------------------------|
| Employee   | Employee name (from employee record) |
| Entity     | RE/MKT badge                         |
| Quarter    | e.g., "Q2-2026"                      |
| Target     | Achievement target amount            |
| Currency   | AED or USD badge                     |
| Status     | Active/Inactive badge                |
| Signed     | Signed/Pending badge                 |
| Actions    | View KPIs, Sign button               |

---

## Add Performance Target Modal

| Field ID | Label                    | Type     | Notes                        |
|----------|--------------------------|----------|------------------------------|
| `pe`     | Employee                 | select   | Active employees only        |
| `pq`     | Quarter                  | select   | Q1-Q4 2026, Q1-Q2 2027      |
| `pat`    | Achievement Target       | number   | Auto-fills based on entity   |
| `pcur`   | Currency                 | select   | AED (RE) or USD (MKT)       |
| `pkpi`   | KPI Notes                | textarea | Free-text KPI details        |

**Smart Behavior**: When an employee is selected, the form auto-fills:
- Entity hint text with specific KPI description
- Currency based on entity
- Default target amount (70,500 AED for RE, 90,000 USD for MKT)

---

## Key Functions

| Function                 | Purpose                                    |
|--------------------------|--------------------------------------------|
| `render_performance()`   | Renders the performance targets table      |
| `openAddPerformance()`   | Opens the add target modal                 |
| `updatePerfForm()`       | Auto-fills form based on selected employee |
| `savePerformance()`      | Creates a new performance target           |
| `viewPerf(id)`           | Opens performance detail modal             |
| `signPerf(id)`           | Marks a performance agreement as signed    |
