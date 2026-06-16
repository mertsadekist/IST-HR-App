# Org Chart Module

## Overview

The **Org Chart Module** renders an interactive, SVG-based organizational chart with zoom, pan, and expand/collapse capabilities. It supports both IST Real Estate and IST Markets entity views.

**Render Function**: `render_orgchart()` (Line ~10430)
**Post-Render**: `post_orgchart()` — Sets up SVG rendering and event listeners

---

## Entity Views

| Entity | Logo        | Departments              |
|--------|-------------|--------------------------|
| MKT    | IST Markets logo (base64 PNG) | Multiple views per entity |
| RE     | IST Real Estate logo (base64 PNG) | Multiple views per entity |

### Entity Switching

```javascript
function ocSwitchEntity(entity) {
  ocEntity = entity;      // 'mkt' or 're'
  ocRenderTabs();          // Update department tabs
  ocRender();              // Re-render SVG chart
  ocCenterView();          // Center view on the tree
}
```

---

## Interaction Controls

| Control       | Action                              |
|---------------|-------------------------------------|
| Scroll        | Zoom in/out                         |
| Drag          | Pan the chart                       |
| Click nodes   | Open info panel with role details   |
| Click +/−     | Expand/collapse tree branches       |
| Expand button | Expand all nodes                    |
| Collapse button| Collapse all nodes                 |
| Reset button  | Reset zoom and pan to default       |

---

## SVG Rendering

The org chart is rendered as an SVG element (`#oc-svg`) with:
- **Nodes**: Rectangle containers with role/department labels
- **Connections**: Lines connecting parent-child nodes
- **Colors**: Entity-specific color schemes

### Tree Data Structure (`OC_DATA`)

```javascript
OC_DATA = {
  mkt: {
    lean: {
      label: "CEO",
      collapsed: false,
      children: [
        {
          label: "Sales Director",
          children: [
            { label: "Account Manager", roles: [...] },
            { label: "Senior Account Manager", roles: [...] }
          ]
        }
      ]
    }
  },
  re: { ... }
}
```

---

## Info Panel

When a node is clicked, a side panel (`#oc-info`) slides in showing:
- **Department/Role name** (`.oi-head`)
- **Subtitle** (`.oi-sub`)
- **Role list** (`.oi-roles`) — Specific positions under this node
- **Notes** (`.oi-note`) — Additional information
- **Badges** (`.oi-badge`) — Entity/department tags

---

## Touch Support

The chart supports touch events for mobile devices:
- Single-touch drag for panning
- Pinch-to-zoom with distance calculation
- Touch end to stop drag

---

## State Variables

| Variable    | Type    | Purpose                        |
|-------------|---------|--------------------------------|
| `ocEntity`  | string  | Current entity ('mkt' or 're') |
| `ocView`    | string  | Current view/department         |
| `ocSc`      | number  | Current zoom scale             |
| `ocTx`      | number  | Current X translation (pan)    |
| `ocTy`      | number  | Current Y translation (pan)    |
| `ocDrag`    | boolean | Whether user is dragging       |
| `ocEventsOk`| boolean | Whether events are initialized |

---

## Key Functions

| Function           | Purpose                                    |
|--------------------|--------------------------------------------|
| `render_orgchart()`| Renders the chart container HTML           |
| `post_orgchart()`  | Initializes SVG rendering and events       |
| `ocSwitchEntity()` | Switches between MKT and RE charts        |
| `ocRender()`       | Renders the SVG tree                       |
| `ocRenderTabs()`   | Updates department/view tabs               |
| `ocCenterView()`   | Centers the tree in the viewport           |
| `ocExpandAll()`    | Expands all collapsed nodes                |
| `ocCollapseAll()`  | Collapses all expanded nodes               |
| `ocReset()`        | Resets zoom, pan, and collapse state       |
| `ocSetupEvents()`  | Attaches mouse/touch event handlers        |
| `ocCloseInfo()`    | Closes the info side panel                 |
