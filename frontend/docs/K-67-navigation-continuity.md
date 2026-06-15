# K-67 Navigation Continuity

## Audit: `openNote()` callers

All cross-tab note opens now go through `openNote()` in `lib/noteNavigation.ts`.

| Caller | returnTab | Breadcrumb |
|--------|-----------|------------|
| `ArchiveHomeView` milestone | `analytics` | Archive → Recent transitions |
| `ArchiveHomeView` area pill | `analytics` | Archive → Areas |
| `ArchiveBranchView` milestone | `analytics` | Archive → Recent transitions |
| `ArchiveBranchView` area pill | `analytics` | Archive → Areas |
| `PlannerView.openPlannerNote` | `planner` | Schedule → Countdowns (+ optional label) |
| `openHealthDayNote` | `health` | Health section → Open day log |

In-tab navigation uses `navigateToNote()` / `openNoteById()` with stack sources:

| Source | Where | Breadcrumb |
|--------|-------|------------|
| `discovery` | `NoteContextPanelBody` discover panel | Today's discoveries |
| `timeline` | `NoteContextPanelBody` timeline panel | Timeline |
| `cosmos` | `NoteViewEditorArea` graph select | Cosmos |
| `archive` | `openNote` from analytics tab | (see above) |

## Return path matrix

| Origin workspace | returnTab key | Return label (i18n) |
|------------------|---------------|---------------------|
| Schedule / Planner | `planner` | `nvReturnToSchedule` |
| Health | `health` | `nvReturnToHealth` |
| Archive / Analytics | `analytics` | `nvReturnToArchive` |

`returnFromNote()` clears `absinthe.noteNav.returnTab` and calls `switchToTab`.

## Mobile back precedence (`NoteViewEditorArea`)

1. Note stack back (`goBackNote`)
2. Cross-workspace return (`goReturn` when `returnTab` set)
3. Close mobile editor

## `sourceForReturnTab` mapping

```typescript
planner   → schedule
health    → health
analytics → archive
(default) → external
```

## Tests

- `noteNavigation.test.ts` — analytics return, breadcrumb persistence, `openHealthDayNote`
- `archiveCrossTabNavigation.test.ts` — milestone/area still invoke `openNote`
