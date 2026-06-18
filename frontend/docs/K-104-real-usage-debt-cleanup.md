# K-104 Real Usage Debt Cleanup

Post–K-103 UX debt paydown: locale-aware dates, popover collision fixes, mobile toolbars, image clipboard, planner CRUD/layout, and sidebar density — **UI / interaction / clipboard only** (no schema, storage, IndexedDB, or engine changes).

## Before / After

| Area | Before | After |
|------|--------|-------|
| Dates | Mixed `toLocaleDateString` and hardcoded “Today” paths | Shared `formatRelativeDate`, `formatLongDate`, `formatAbsoluteDateKey` via `k102DateFormat.ts` |
| Sort menu | Clipped against right panel edge | Portal + flip/shift; 220px min width; mobile bottom sheet (`NoteListSortMenu`) |
| Knowledge context | Horizontal tab overflow strip | Primary: Overview · Outline · Links · Insights + **More ▼** (Timeline, Actions, Cosmos, Properties) |
| Health mobile | Sticky Complete Workout overlapped calendar | Non-sticky on mobile; calendar grid desktop-only |
| Note editor mobile | Crowded icon row | **More** only; view modes, search, star, copy, panel, settings in menu |
| Image copy | Markdown text only | `ClipboardItem` with `text/plain`, `text/html`, `image/png` |
| Planner desktop | Sparse right column | Calendar left; day schedule + upcoming + timetable summary stacked right (max ~340px) |
| Sidebar | Dashboard-heavy | Daily · Favorites · Folders · Trash always visible; activity/timeline/areas/workspace collapsed by default |

_Screenshots: capture at 375px, 768px, and 1280px after merge for regression folder._

## Responsive Matrix (320–1440)

| Width | Note list | Editor header | Knowledge panel | Planner | Health |
|-------|-----------|---------------|-----------------|---------|--------|
| 320–479 | Search · New · More sheet | More menu only | Compact drawer tabs + More | Single column; timetable via summary link | Workout tab; no calendar under hero |
| 480–767 | Same + sort bottom sheet | Same | Same | Same | Same |
| 768–1023 | Wider list (236px) | Desktop icons | Resizable panel | Calendar + right stack | lg grid for calendar/inbody |
| 1024–1440 | K-103 density preserved | Full toolbar | Full tabs | 62% / 38% split | Full three-column support row |

## Bug Checklist

- [ ] Sort menu never clips viewport right edge (desktop)
- [ ] Sort menu opens as bottom sheet on mobile (`useIsMobile`)
- [ ] Knowledge context: no horizontal scroll on tab row
- [ ] Health: Complete Workout does not cover calendar on mobile
- [ ] Ctrl+C on single image block → paste in KakaoTalk / Discord / Notion as image
- [ ] Planner: date → schedule list → event → edit → save (title, category, notes, times)
- [ ] Planner duplicate preserves category
- [ ] Sidebar trash visible after folders (`data-k104-trash-section`)
- [ ] Recent activity / timeline lens collapsed by default (K-103 order preserved)
- [ ] Settings reachable from mobile More (list + editor)

## Manual QA Flows

### A — Dates

1. Switch app language (EN / KO / JA).
2. Note row dates show Today / Yesterday / relative labels consistently.
3. Properties panel created date uses long locale format.
4. Planner form and event detail use `formatLongDate`.

### B — Popovers

1. Open sort menu with narrow right panel — menu flips/shifts, min 220px.
2. On phone width, sort opens bottom sheet.
3. Open knowledge **More** — Timeline, Actions, Cosmos, Properties listed.

### C — Mobile health

1. Health → Workout tab on 375px width.
2. Edit workout — Complete button at bottom of scroll, not sticky over calendar.
3. Calendar/inbody row hidden until `lg` breakpoint.

### D — Clipboard

1. Insert image block with URL; focus block; Ctrl+C.
2. Paste into external chat app — image preserved (not `![alt](url)` only).

### E — Planner CRUD

1. Click calendar date → day schedule list.
2. Open event → Edit → change title, category, notes, times → Save.
3. Duplicate and delete from detail panel.

### F — Planner layout (desktop)

1. Left: month calendar. Right: selected day schedule, upcoming agenda, timetable summary.
2. Right column width capped (~340px K-103).

### G — Sidebar density

1. Fresh session: Recent activity, Timeline lens, Areas collapsed.
2. Daily note, Favorites, Folders, Trash always reachable without scrolling past dashboard blocks.

### H — Mobile topbar

1. Note list: Search, New, More only.
2. Editor: More contains settings, appearance, shortcuts, export actions.

## Verification

```powershell
cd frontend
npm run typecheck
npm test
npm run build
npm test -- k104
```

## Audit modules

| File | Scope |
|------|--------|
| `k104DateAudit.ts` | Date formatter usage |
| `k104PopoverAudit.ts` | Sort menu portal / collision |
| `k104KnowledgeContextAudit.ts` | Primary vs More tab IA |
| `k104HealthMobileAudit.ts` | Health mobile data hooks |
| `k104MobileToolbarAudit.ts` | List toolbar |
| `k104TopbarAudit.ts` | Mobile topbar overflow |
| `k104ClipboardAudit.ts` | Image/png clipboard |
| `k104ScheduleAudit.ts` | Day schedule CRUD |
| `k104PlannerLayoutAudit.ts` | Right column sections |
| `k104SidebarDensityAudit.ts` | Always-visible vs collapsed sections |
