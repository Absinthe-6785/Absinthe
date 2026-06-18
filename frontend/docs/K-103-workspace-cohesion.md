# K-103 — Workspace Cohesion & Real Usage Polish

Branch: `k103-workspace-cohesion` (not committed until review)

## Summary

Follow-up to K-102 focused on sidebar hierarchy, workspace panel cohesion, reading ergonomics, planner polish, settings cleanup, empty-state consistency, and desktop layout balance. UI / workflow / interaction polish only — no schema, IndexedDB, storage migrations, or engine changes.

## Workstreams

### A — Note list & workspace navigation

**A1** Sidebar hierarchy: Daily Note → Favorites → Recent Activity → Timeline Lens → Folders. Daily Note and Favorites always visible; activity and timeline lens default collapsed; section state persisted in `absinthe-note-list-sections` (including `workspaceCollapsed`).

- Audit: `k103SidebarAudit.ts`

**A2** Workspace panel: compact pinned/recent rows, `ProductEmptyState` when expanded but empty, independent collapse persisted.

- Audit: `k103WorkspaceAudit.ts`

### B — Read mode improvements

**B1** Reading max-width **700px** on desktop; improved heading, paragraph, callout, code, and table spacing in `editorReading.ts`.

**B2** Search: Esc clears query then closes toolbar; match badge pulse; no-result label; stronger `.be-search-hl` styling.

- Audit: `k103ReadingAudit.ts`

### C — Planner workflow polish

**C1** Month calendar: chip spacing, selected-day contrast, empty-day hover.

**C2** Schedule detail: compact action buttons, delete confirmation step, keyboard shortcuts retained.

**C3** Timetable: Mon–Fri / Weekend / Every day presets (`data-k103-timetable-presets`), stronger duplicate ring, tighter mobile list rows.

- Audit: `k103PlannerAudit.ts`

### D — Settings cleanup

Five sections (General, Storage, Recovery, Export, Danger). Removed redundant export/storage descriptions; tighter card spacing retained.

- Audit: `k103SettingsAudit.ts`

### E — Empty states

`ProductEmptyState` for planner upcoming agenda, pinned workspaces, and recent workspaces. Existing vault/notes/trash/timetable empty states preserved.

- Audit: `k103EmptyStateAudit.ts`

### F — Desktop layout balance

| Surface | Value |
|---------|-------|
| Note list width | 236px (min 220px) |
| Reading max-width | 700px |
| Planner right panel | 340px cap |
| Settings | max-w-3xl |

- Audit: `k103LayoutAudit.ts`

### G — Keyboard & interaction

Verified shortcuts: Ctrl+F, Ctrl+Alt+T, Ctrl+Shift+F, Ctrl+N, Ctrl+Shift+N, Alt+1–5. Improved `focus-visible` on sidebar interactive rows.

- Audit: `k103KeyboardAudit.ts`

## Before / after

| Area | Before (K-102) | After (K-103) |
|------|----------------|---------------|
| Sidebar order | Activity before favorites | Daily → Favorites → Activity → Lens → Folders |
| Favorites | Collapsible | Always visible |
| Workspace empty | Hidden when empty | Empty state when section open |
| Reading width | 680px | 700px with richer spacing |
| Planner delete | Immediate | Confirm step |
| Settings copy | Extra descriptions on export/storage | Title-only rows |

## Responsive matrix

| Width | Notes | Planner | Settings |
|-------|-------|---------|----------|
| 320px | _TODO screenshot_ | _TODO_ | _TODO_ |
| 375px | _TODO_ | _TODO_ | _TODO_ |
| 768px | _TODO_ | _TODO_ | _TODO_ |
| 1024px | _TODO_ | _TODO_ | _TODO_ |
| 1440px | _TODO_ | _TODO_ | _TODO_ |

## Manual QA checklist

- [ ] Sidebar order and sticky section headers
- [ ] Daily note + favorites always visible after reload
- [ ] Activity / timeline lens collapse persists
- [ ] Workspace pinned/recent empty states
- [ ] Reading spacing on long document
- [ ] Search Esc (clear → close), no-results label
- [ ] Planner delete confirmation
- [ ] Timetable day presets
- [ ] Settings sections at mobile widths
- [ ] Ctrl+F / Ctrl+Alt+T / Alt+1–5

## Verification

```powershell
npm run typecheck   # PASS
npm test            # PASS (2480+; k95 growth curve may be slow — re-run if timeout)
npm run build       # PASS
npm test -- k103    # PASS (16 tests)
```
