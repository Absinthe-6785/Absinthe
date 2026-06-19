# K-121 — Layout Regression Recovery

UX/layout correction release recovering proportions, interaction, editability, information density, empty states, and PR unit fidelity after K117–K120.

**Scope:** display and layout only. No schema, storage, IndexedDB, knowledge-engine, or Cosmos changes.

## Regressions discovered (K117–K120)

| Area | Regression | K-121 fix |
|------|------------|-----------|
| Notes | Floating, misaligned Search / New Note row | Inline action row: `[ Search (flex) ] [ + New Note ]`, 44px mobile targets |
| Health analytics | Dense wall of metrics and lists | Summary grid (week / month / streak) always visible; PR, Recent Sessions, Exercise History collapsed by default |
| Skeletons | Layout jump on lazy load | Fixed `K121_SKELETON_HEIGHT` tokens for analytics + supporting panels |
| PR display | lbs recordings shown as awkward kg decimals | `formatPrDisplay()` preserves recording units; tooltip shows conversion |
| Archive | Narrow single-column stack wasted desktop width | 2-column grid, centered `max-w-[1320px]` |
| Schedule toolbar | Full-width purple primary bar, duplicate + buttons | Compact sticky row with single `+ New Event` |
| Month calendar | Schedule chips in cells not clickable | Click → detail panel → edit / duplicate / delete via `onView` |
| Schedule layout | Oversized empty timetable, weak agenda/calendar balance | 30% agenda / 70% calendar; collapsed empty timetable `min-h-[120px]` |
| Empty states | Oversized padding in timetable, archive, health | `data-k121-empty-state` hooks + tighter padding |

## Interaction fixes

- **Notes:** `data-k121-notes-header-action-row` — search and new-note share one toolbar row (no floating chip).
- **Schedule:** `data-k121-schedule-new-event` — single entry point for new events.
- **Calendar cells:** `data-k121-month-schedule-block` — month schedule blocks open the selected-day detail panel.
- **Health PRs:** `displayValue` + `displayUnit` with optional `conversionHint` tooltip.

## Density guidelines

1. **Desktop archive:** two equal columns within 1200–1400px centered shell.
2. **Schedule month view:** agenda + upcoming capped at ~30% height; calendar receives ~70%.
3. **Embedded timetable:** empty state `min-h-[120px]`; compact secondary add control when embedded.
4. **Analytics:** summary always on top; collapsible sections default closed except summary/charts toggle.
5. **Skeletons:** match final card heights (`min-h-[88px]` summary, `min-h-[96px]` PR, etc.).
6. **Empty states:** use `ProductEmptyState` with `UI_DENSITY` tokens; avoid `py-6` wrappers on collapsed surfaces.

## Before / after screenshots

> Capture manually after merge:
>
> - Notes header (desktop + mobile)
> - Health analytics collapsed vs expanded
> - Archive 2-column layout (desktop)
> - Schedule month view proportions
> - PR list showing lbs vs kg with tooltip

## Verification

```powershell
npm run typecheck
npm test -- k121
npm test
npm run build
```

## Audit modules

| Letter | Module |
|--------|--------|
| A | `k121NotesHeaderAudit.ts` |
| B | `k121HealthAnalyticsAudit.ts` |
| C | `k121SkeletonAudit.ts` |
| D | `k121PrUnitAudit.ts` |
| E | `k121ArchiveLayoutAudit.ts` |
| F | `k121ScheduleToolbarAudit.ts` |
| G | `k121ScheduleEditingAudit.ts` |
| H | `k121ScheduleLayoutAudit.ts` |
| I | `k121EmptyStateAudit.ts` |
