# K-60: Cosmos UX Refinement

Architecture summary, UX audit, changed files, verification, and K-61 roadmap.

## Architecture Summary

K-60 refines Cosmos graph interaction, calendar event display, note search, and relations panel UX without data model changes.

### Cosmos graph (P1)

- **Preview vs navigation split**: `NoteGraphView` keeps `previewNodeId` (single-click) separate from `activeNoteId` (double-click / Open note). Selection rings and edge highlights use `previewNodeId ?? activeNoteId`.
- **`CosmosGraphPreviewPanel`**: Right-side ~280px panel showing title, note kind, tags, created date, body summary snippet, link/backlink counts, importance tier, and Open note action. Does not navigate on single-click.
- **Search**: Graph search uses `noteMatchesSearch` (title + body + tags) via the `notes` array, not graph node titles alone.
- **HUD slimming**: Timeline evolution duplicate and per-node HUD block removed; node detail lives in the preview panel.

### Schedule (P2)

- **`formatEventTimeLabel`**: Shared helper in `dayCalendarPresentation.ts` — `"09:00–10:30"` when both times exist, start only otherwise.
- **Day / week views**: Timed events show time on its own line (Apple Calendar style).

### Search (P3)

- **`noteMatchesSearch`**: Centralized body-first matching in `noteSearch.ts`, used by `NoteView` visible-notes filter and `NoteGraphView` graph search.
- **i18n**: Hardcoded Search/검색 toolbar label replaced with `nvSearchButton`.

### Relations (P5)

- **`NoteRelationsPanel`**: Relation type `<select>` with empty placeholder, preset keys (course, prerequisite, reference, related, project), custom key option, Add disabled until type + target are valid.

### Notion paste / LaTeX (P4)

- **`specialBlockClipboard.ts`**: `isMathHtmlElement`, `extractLatexFromMathElement`, `isBlockMathElement` for KaTeX/Notion equation HTML.
- **`inlineClipboard.ts` / `htmlDocumentToBlocks.ts`**: Notion/KaTeX spans convert to `$...$` / `$$...$$` on paste; `$\rightarrow$` regression tests added.

### Block selection (P6)

- **`useEditorGutterDrag.ts`**: Removed `depth !== 0` guard — gutter drag works inside toggle children (same-parent constraint preserved via `updateGutterSelection`).

### Toggle reparent (P7)

- Verified existing `applyHierarchyDragDrop` / `applyMultiBlockDragDrop` support extracting toggle children to root; added regression tests in `multiBlockDrag.test.ts`.

## UX Audit

| Area | Before | After |
|------|--------|-------|
| Graph node click | Opens note immediately | Single-click previews; double-click opens |
| Node detail | HUD + bottom-left hover panel | Right preview panel; hover = SVG title only |
| Graph search | Title only | Title + body + tags |
| Search empty state | Hardcoded Korean | `graphSearchNoResults` i18n |
| Timed events | `09:00 Title` inline | Time on separate line |
| Note list search | Raw `includes` | `noteMatchesSearch` (body-first) |
| Add relation | Default `course`, free text | Select type first; Add gated |
| Notion math paste | Often lost `$` delimiters | KaTeX/Notion HTML → `$...$` |
| Toggle gutter drag | Root depth only | Nested toggle children supported |

## Files Changed

### Created

- `src/components/views/features/knowledge/cosmos/CosmosGraphPreviewPanel.tsx`
- `frontend/docs/K-60-cosmos-ux-refinement.md`

### Modified

- `src/components/views/NoteGraphView.tsx`
- `src/lib/math/noteSearch.ts`
- `src/lib/math/noteSearch.test.ts`
- `src/components/views/NoteView.tsx`
- `src/components/views/noteview/NoteViewEditorArea.tsx`
- `src/components/views/features/planner/calendar-ui/day/dayCalendarPresentation.ts`
- `src/components/views/features/planner/calendar-ui/day/DayEventsSection.tsx`
- `src/components/views/features/planner/calendar-ui/week/WeekEventRows.tsx`
- `src/components/views/features/knowledge/components/NoteRelationsPanel.tsx`
- `src/lib/i18n.ts`
- `src/components/views/features/block-editor/features/clipboard/inline/inlineClipboard.ts`
- `src/components/views/features/block-editor/features/clipboard/paste/htmlDocumentToBlocks.ts`
- `src/components/views/features/block-editor/features/clipboard/special/specialBlockClipboard.ts`
- `src/components/views/features/block-editor/features/clipboard/paste/blockPaste.test.ts`
- `src/components/views/features/block-editor/features/clipboard/special/specialBlockClipboard.test.ts`
- `src/components/views/features/block-editor/hooks/useEditorGutterDrag.ts`
- `src/components/views/multiBlockDrag.test.ts`

## Verification

```bash
cd frontend
npm run typecheck && npm run build && npm run test
```

Manual checks:

1. Cosmos: single-click node → preview panel; double-click → note opens; search matches body text.
2. Calendar day/week: timed events show time range on separate line.
3. NoteView search: query in body (not title) finds note.
4. Relations: Add disabled until type + target set; preset types in select.

## K-61 Roadmap (product phase — not architecture)

| Priority | Area | Goal |
|----------|------|------|
| P1 | **Performance** | Profile large-vault graph sim + virtual scroll; lazy-load graph view |
| P2 | **Mobile UX** | Cosmos preview panel as bottom sheet; calendar touch targets |
| P3 | **Export & backup** | Markdown export polish, vault backup workflow |
| P4 | **Cosmos polish** | Preview close button, keyboard nav, focus-universe depth i18n |
| P5 | **Search ranking** | Sort sidebar results by body vs title match strength |
| P6 | **Workflow** | Relations preset labels/icons; calendar "All day" i18n |

No further NoteView decomposition unless a hotspot emerges.
