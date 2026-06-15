# K-65 Search Unification

## Search surfaces audit

| Surface | Location | Ranking | Empty state |
|---------|----------|---------|-------------|
| Sidebar search | `NoteViewSidebar` | `noteSearchScore` via `visibleNotes` sort in `NoteView` | K-65: `nvSearchNoResults` + clear query CTA |
| Workspace search | `WorkspaceSearchPalette` / `buildWorkspaceSearch` | `noteSearchScore` | Palette built-in no-results |
| Cosmos graph search | `NoteGraphView` search input | `noteMatchesSearch` (highlight/dim, no rank list) | Dim non-matching nodes |
| In-note editor search | `NoteViewEditorArea` | Body substring (scope-aware) | Match counter in header |

## Shared ranking (`lib/math/noteSearch.ts`)

Lower score = higher rank:

1. **0** — Exact title
2. **1** — Title prefix
3. **2** — Title contains
4. **3** — Body match at word boundary
5. **4** — Body substring
6. **5** — Exact tag
7. **6** — Tag partial

Used by:

- Sidebar note list (`NoteView.tsx` `visibleNotes` sort)
- Workspace search (`buildWorkspaceSearch.ts`)

## K-65 improvements

### Sidebar

- Distinguish **no notes** (`nvNoNotes` + create CTA) vs **search miss** (`nvSearchNoResults` + `nvClearQuery`)
- Note list clicks use `openNoteById` (navigation stack integration)

### Workspace search

- Already shares `noteSearchScore`; opens notes via `navigateToNoteWithHistory(..., 'search')`

### Cosmos

- Graph search filters/highlights nodes only (visual, not ranked list) — intentional for spatial context

## Remaining differences (acceptable)

- Editor in-note search is positional (match index), not ranked — different use case
- Cosmos has no result list UI — graph highlight model

## i18n keys

- `nvSearchNoResults`
- `nvClearQuery` (existing)
