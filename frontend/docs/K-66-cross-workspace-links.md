# K-66 Cross-Workspace Links

## Navigation paths audit

| From | To | Mechanism | Return path |
|------|-----|-----------|-------------|
| Schedule countdown | Note | `openPlannerNote` → `openNote(id, { returnTab: 'planner' })` | Header `← Schedule` |
| Schedule calendar event | Note | `CalendarShell.onEventNoteClick` | Same |
| Schedule D-Day note | Note | `ScheduleCountdownPanel.onNoteClick` | Same |
| Health workout day log | Note | `openHealthDayNote` → dated note | Header `← Health` |
| Archive home/branch | Note | `openNote(id)` | None (K-67) |
| Notes wiki / panel | Note | `navigateToNoteWithHistory` | Stack back |
| Notes Cosmos | Note | `openNoteById(..., 'cosmos')` | Stack back |
| Notes workspace search | Note | `navigateToNoteWithHistory(..., 'search')` | Stack back |
| Discovery card | Note | `openNoteById(..., 'panel')` | Stack back |
| Timeline area drill | Note | `onNavigateToNote` | Stack back |
| Cosmos HUD → Discover | Context tab | In-tab switch | N/A |
| Cosmos HUD → Timeline | Context tab | In-tab switch | N/A |

## Implementation

### `noteNavigation.ts`

```typescript
openNote(noteId, { returnTab?: TabId })
returnFromNote() → switchToTab + clear returnTab
registerAppTabSwitcher(setActiveTab)
```

Return tab stored in `sessionStorage` key `absinthe.noteNav.returnTab`.

### UI

`NoteViewEditorArea` shows `← Schedule` or `← Health` when return tab is set.
Mobile back: history back → else return tab → else close editor.

### Health day log

`openHealthDayNote(dateLabel, createNote, updateNote)`:
- Finds note titled `YYYY-MM-DD` (via `formatDate`)
- Creates if missing
- Opens with `returnTab: 'health'`

Button: **Open day log in Notes** below workout memo.

### Sources

New navigation sources: `schedule`, `health` — recorded in persisted stack.

## Consistency gaps (documented)

- Archive/Analytics note links do not set return tab
- Recovery/nutrition panels have no note shortcut yet (workout covers primary journal path)
