# K-101 — Workflow Completion & Daily Experience

Branch: `k101-workflow-completion` (not committed until review)

## Summary

Post K-100 cohesion pass focused on completing daily workflows: daily notes, sidebar activity, navigation shortcuts, planner upcoming actions, empty vault, search polish, and standardized micro-interactions. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

## Workstreams

### A — Daily note workflow

**A1 Daily note**
- Sidebar daily note section with natural date label and exists/new badge
- Yesterday / tomorrow quick jump
- `openOrCreateDailyNote` — open if present, create if absent, no duplicate create
- Ctrl+Alt+T uses same helper
- Audit: `k101DailyNoteAudit.ts`

**A2 Recent activity**
- Collapsible section: Today, Yesterday, This Week, Last Opened, Recent Edited
- Density-aware rows; expansion persisted via `activityCollapsed` in section prefs
- Component: `K101RecentActivitySection.tsx`

### B — Sidebar & navigation

**B1 Workspace sections** — Collapse + persist for Pinned, Recent, Today (daily note), This Week, Favorites (`noteListSectionPrefs.ts`)

**B2 Keyboard navigation**

| Shortcut | Action |
|----------|--------|
| Alt+1 | Notes |
| Alt+2 | Health |
| Alt+3 | Schedule (Planner) |
| Alt+4 | Archive (Analytics) |
| Alt+5 | Recipe |
| Ctrl+Shift+F | Global workspace search (any tab) |

- Audit: `k101NavigationAudit.ts`

### C — Planner completion

**C1 Event cards** — Category border, hover, selection hooks on month cells (`k101-planner-chip`)

**C2 Upcoming panel** — Click opens detail; Shift+click menu with edit/duplicate/delete/jump-to-day (no modal chains)

**C3 Timetable** — Weekday header grouping, dashed ring for multi-day duplicates, improved mobile spacing

- Audit: `k101PlannerAudit.ts`

### D — Empty vault

`ProductEmptyState` when vault has zero notes: Create note · Open today's note · Import backup; knowledge panel hidden.

- Audit: `k101EmptyVaultAudit.ts`

### E — Search

- Empty results copy + hint
- Loading pulse while querying
- Up/Down/Enter/Esc (existing + modal a11y)
- Query/filter persisted in `sessionStorage` while switching tabs

- Audit: `k101SearchAudit.ts`

### F — Micro interactions

`k101-interactive` / `k101-planner-chip` / `k101-selected` tokens extend K-99 interaction CSS.

- Audit: `k101InteractionAudit.ts`

### G — Visual polish matrix

| Width | Profile | Notes | Planner | Health | Settings |
|-------|---------|-------|---------|--------|----------|
| 320px | Mobile | _TODO screenshot_ | _TODO_ | _TODO_ | _TODO_ |
| 375px | Mobile | _TODO_ | _TODO_ | _TODO_ | _TODO_ |
| 768px | Tablet | _TODO_ | _TODO_ | _TODO_ | _TODO_ |
| 1024px | Desktop | _TODO_ | _TODO_ | _TODO_ | _TODO_ |
| 1440px | Wide | _TODO_ | _TODO_ | _TODO_ | _TODO_ |

## Before / after

| Area | Before | After |
|------|--------|-------|
| Daily note | Ctrl+Alt+T only; no sidebar badge | Sidebar section + prev/next day jumps |
| Activity | Dashboard-only | Lightweight collapsible sidebar section |
| Tab switch | Click sidebar only | Alt+1–5 from anywhere |
| Global search | Ctrl+K in Notes tab | + Ctrl+Shift+F from any tab |
| Empty vault | Generic “select a note” | Dedicated vault onboarding CTAs |
| Upcoming | Menu-only click | Click opens; menu for shift/advanced |
| Section prefs | Pinned/recent only | + today, week, favorites, activity |

## Manual checklist

- [ ] Empty vault shows three CTAs; right panel hidden
- [ ] Daily note badge shows Open vs New; yesterday/tomorrow jump works
- [ ] Activity section collapses and persists across reload
- [ ] Alt+1–5 switches tabs from non-input focus
- [ ] Ctrl+Shift+F opens workspace search from Planner/Health
- [ ] Workspace search query survives tab switch and palette close/reopen
- [ ] Upcoming item click opens event; Shift+click shows actions including jump to day
- [ ] Timetable duplicate multi-day blocks show dashed ring
- [ ] `npm run typecheck` PASS
- [ ] `npm test -- k101` PASS

## Verification

```bash
npm run typecheck
npm test
npm run build
npm test -- k101
```

## Screenshots

_Add before/after screenshots at 320 / 375 / 768 / 1024 / 1440 during manual QA._
