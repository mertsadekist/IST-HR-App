# Phase 8: Polish & Testing — Detailed Steps

> **Status**: 🔲 Not Started
> **Estimated Duration**: Week 10-11
> **Depends On**: All previous phases
> **Includes**: SQL optimization, API tests, data migration from legacy localStorage

---

## 7.1 — Responsive Design

### Breakpoints
| Breakpoint | Width    | Changes                                     |
|-----------|----------|----------------------------------------------|
| Desktop   | ≥1024px  | Full sidebar, multi-column layouts           |
| Tablet    | 768-1023 | Collapsed sidebar (icons only), 2-col grids  |
| Mobile    | <768px   | Hidden sidebar (hamburger), single column    |

### Component-Specific Responsive Fixes

| Component      | Mobile Behavior                              |
|---------------|----------------------------------------------|
| Sidebar       | Overlay with hamburger toggle                 |
| Tables        | Horizontal scroll wrapper                     |
| Kanban Board  | Horizontal scroll, larger cards               |
| Modals        | Full-screen on mobile                         |
| Stat Cards    | 2-column grid → single column                |
| Charts        | Responsive container, simplified labels       |
| Org Chart     | Touch pan/zoom, larger nodes                  |
| Letter Preview| Stacked layout (form above, preview below)    |

### Tasks
- [ ] Add responsive breakpoints to all page layouts
- [ ] Sidebar: Hamburger menu on mobile
- [ ] Tables: Wrap in `overflow-x-auto`
- [ ] Kanban: Horizontal scroll with snap
- [ ] Modals: `max-w-full h-full` on mobile
- [ ] Test on 375px, 768px, 1024px, 1440px widths

---

## 7.2 — Performance Optimization

### Route-Based Code Splitting
```jsx
// App.jsx
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const ATSPipeline = lazy(() => import('./pages/recruitment/ATSPipeline'));
// ... all pages

<Suspense fallback={<Loading />}>
  <Routes>...</Routes>
</Suspense>
```

### Component Optimization
- [ ] `React.memo` for list item components (KanbanCard, CandidateCard, etc.)
- [ ] `useMemo` for filtered/sorted data computations
- [ ] `useCallback` for event handlers passed to child components
- [ ] Debounced search inputs (300ms delay)

### Data Loading
- [ ] Virtual scrolling for tables with 100+ rows (react-virtual)
- [ ] Pagination for audit log (50 entries per page)
- [ ] Lazy load charts (only render when tab is active)

### Build Optimization
- [ ] Tree shaking verification
- [ ] Bundle analyzer check
- [ ] Image optimization (logos as WebP)

**Tasks**:
- [ ] Implement lazy loading for all routes
- [ ] Add React.memo to all list items
- [ ] Add debounce to all search inputs
- [ ] Verify bundle size < 500KB gzipped

---

## 7.3 — UX Polish

### Loading States
- [ ] Skeleton loaders for page transitions (DashSpace `Skeleton.jsx`)
- [ ] Button loading spinners during save operations
- [ ] Progress bar during file uploads

### Animations (Framer Motion)
- [ ] Page transition fade-in (0.2s)
- [ ] Modal slide-up animation
- [ ] Sidebar item hover scale
- [ ] Stat card entrance stagger animation
- [ ] Toast slide-in from top-right
- [ ] Kanban card drag preview with slight rotation

```jsx
// Example: Page transition
<motion.div
  initial={{ opacity: 0, y: 10 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.2 }}
>
  {children}
</motion.div>
```

### Confirmation Dialogs
Replace all `confirm()` calls with SweetAlert2:
- [ ] Delete confirmations (red, with icon)
- [ ] Status change confirmations
- [ ] Offboarding initiation confirmation
- [ ] Data reset warnings

### Empty States
Design empty state illustrations for:
- [ ] No candidates yet
- [ ] No vacancies yet
- [ ] No employees yet
- [ ] No onboarding records
- [ ] No companies configured
- [ ] Search with no results

### Keyboard Shortcuts
| Shortcut    | Action                    |
|------------|---------------------------|
| `Ctrl+K`   | Global search             |
| `Ctrl+N`   | New item (context-aware)  |
| `Escape`   | Close modal               |
| `Ctrl+S`   | Save form                 |

**Tasks**:
- [ ] Implement skeleton loaders
- [ ] Add Framer Motion animations
- [ ] Replace confirm() with SweetAlert2
- [ ] Design and implement empty states
- [ ] Add keyboard shortcuts

---

## 7.4 — Data Migration

### Import from Old System
For users migrating from the original monolithic HTML file:

```js
// utils/dataMigration.js
export function importLegacyData() {
  // 1. Read old localStorage keys (ist_vacancies, ist_candidates, etc.)
  // 2. Transform data to new format (add companyId references, etc.)
  // 3. Write to new localStorage keys
  // 4. Generate migration audit log
}
```

### Backup & Restore
```
Settings → System → Data Management
├── [Export All Data] → Downloads complete JSON backup
├── [Import Data] → Uploads and validates JSON backup
├── [Reset All Data] → Clears everything (with double confirmation)
└── [Migration Tool] → Imports from legacy system
```

### Export Format
```json
{
  "version": "2.0",
  "exportDate": "2026-05-15T14:00:00.000Z",
  "data": {
    "companies": [...],
    "departments": [...],
    "jobTitles": [...],
    "vacancies": [...],
    "candidates": [...],
    "employees": [...],
    "onboarding": [...],
    "assets": [...],
    "performance": [...],
    "offboarding": [...],
    "audit": [...],
    "users": [...],
    "kpi": [...],
    "skills": [...],
    "assetCatalog": [...],
    "settings": {...}
  }
}
```

**Tasks**:
- [ ] Implement export all data as JSON
- [ ] Implement import with validation
- [ ] Implement reset with double confirmation
- [ ] Build legacy migration tool
- [ ] Test round-trip (export → reset → import)

---

## 7.5 — Testing

### Component Tests (Vitest + React Testing Library)
- [ ] All UI components render without errors
- [ ] Button variants display correctly
- [ ] Form validation shows errors
- [ ] Modal open/close lifecycle
- [ ] Entity badge renders correct colors

### Store/Slice Tests
- [ ] Each Redux slice handles CRUD operations
- [ ] Entity filter applies correctly
- [ ] Audit entries are created by actions

### Integration Tests
- [ ] Login → Dashboard flow
- [ ] Add Vacancy → Add Candidate → Move through ATS → Success → Auto-Onboarding
- [ ] Onboarding → Asset Assignment → Performance → Offboarding
- [ ] Letter generation → Preview → Print
- [ ] Company creation → Department → Job Titles → Vacancy creation

### Accessibility Tests
- [ ] All interactive elements have ARIA labels
- [ ] Tab navigation works through forms
- [ ] Color contrast ratios meet WCAG AA
- [ ] Screen reader compatibility

**Tasks**:
- [ ] Set up Vitest + React Testing Library
- [ ] Write component tests for all UI components
- [ ] Write integration tests for critical flows
- [ ] Run accessibility audit
