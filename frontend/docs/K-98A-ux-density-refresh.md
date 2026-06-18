# K-98A — UX Density & Information Architecture Refresh

Branch: `k98a-ux-density-refresh` (not committed until review)

## Summary

Post K-92~K-97 stabilization pass focused on information density, navigation, and desktop layout. No schema migrations, graph, or engine changes.

## Workstreams

### A — Read mode search

- `Ctrl+F` focuses in-note search in reading mode (search input mounted via `DocumentSearchToolbar`)
- Header search button in read mode (`NoteEditorHeaderActions`)
- Match count, prev/next navigation, scope controls mirror edit mode
- Audit: `frontend/src/components/views/k98aReadModeSearchAudit.ts`

### B — Sorting

- Sort by updated / created / title with ascending or descending direction
- Default preserved: updated, descending
- Applies to notes list and folder views; search results included when sort is not skipped by smart collections

### C — Settings IA

- Removed **Default Color**
- Sections: **Storage** → **Recovery** → **Export** → **Danger zone**
- Audit: `frontend/src/components/views/k98aSettingsAudit.ts`

### D — Schedule event details

- Clicking a day schedule block opens `ScheduleEventDetailPanel` (title, date, time, category, notes, Edit/Delete)
- Month/week/mobile sheet layout

### E — Timetable multi-day

- New activities support weekday checkboxes (Mon/Tue/Thu/Fri …)
- Single form creates one record per selected day
- Existing single-day records remain editable via day select
- Audit: `frontend/src/components/views/k98aTimetableAudit.ts`

### F — Density refresh

- Sidebar trace quick nav: Today, Yesterday, This Week, This Month with counts
- Collapsible trace section
- List density modes: Comfortable / Compact / Ultra Compact (`localStorage`)

### G — Desktop layout

- Note list width 216px desktop (was 200px)
- Workspace panel 42% desktop (was 45%)
- Outline panel default 220px
- Reading body padding/max-width tuned

## Screenshots (capture before merge)

| View | Before | After |
|------|--------|-------|
| Desktop — notes | _TODO_ | _TODO_ |
| Desktop — density compact | _TODO_ | _TODO_ |
| Tablet — planner detail | _TODO_ | _TODO_ |
| Mobile — read mode search | _TODO_ | _TODO_ |

## Verification

```powershell
cd frontend
npm run typecheck
npm test
npm run build
npm test -- k98a
```

## Review package

- Read mode search: `k98aReadModeSearchAudit.test.ts` console report
- Settings IA: `k98aSettingsAudit.test.ts`
- Timetable: `k98aTimetableAudit.test.ts`
- Density: compare Comfortable vs Ultra in sidebar note list
- Mobile: read mode search toolbar + schedule detail sheet
