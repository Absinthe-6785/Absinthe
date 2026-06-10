# Knowledge-19.75 — Editor Stability & Compatibility Audit

## Pre-implementation architecture report

### Data flow (Edit → Save → Read → Edit)

```
note.body (markdown string)
  → loadValidatedBlocks(body, markdownToBlocks)   [documentRecovery.ts]
  → Block[] in useBlockEditor / BlockEditor
  → blocksToMarkdown(blocks) on change            [blockUtils.ts]
  → note.body persisted
```

Reading mode uses the same `BlockEditor` with `readOnly={true}` (`NoteView.tsx`, `editorReading.ts`). There is no separate HTML serializer — markdown round-trip is the integrity contract.

### Component map

| Area | Module | Role |
|------|--------|------|
| Markdown parse/serialize | `blockUtils.ts` | `markdownToBlocks`, `blocksToMarkdown`, `parseInline` |
| Block shell | `SingleBlock.tsx`, `ToggleBlock.tsx` | Context menu, focus, toggle nesting |
| Text input | `EditableBlock.tsx` | Backspace merge, slash/wiki triggers, IME |
| Merge/delete | `useEditorBlockEditing.ts` | `handleMergeWithPrev`, split, navigate |
| Toggle nesting | `toggleNesting.ts`, `useEditorToggle.ts` | Header Enter, child escape, merge into header |
| Context menu | `BlockEditor.tsx` → `BlockContextMenu.tsx` | Turn-into, move, delete |
| Numbered lists | `listBlocks.ts` | `renumberNumberedLists`, marker display |
| Slash commands | `EditableBlock.tsx`, `useEditorMenus.ts` | `/` detection, type conversion |
| Outline | `headingIndex.ts`, `extractTOC` in `noteUtils.ts` | Top-level headings only |
| Read rendering | `editableRender.ts` | Inline HTML for read-only blocks |

### Issue root causes (audit findings)

#### P0 #1 — Read mode content corruption (`> !`, malformed markdown)

- **Path**: `blocksToMarkdown` (toggle) → save → `markdownToBlocks` (tryToggle) → read.
- **Cause**: Toggle parser requires non-empty title (`^>! (.+)$`, `^> (.+)$`). Empty-title toggles serialize as `> ` or `>`, fail toggle match, and fall through to paragraph/quote corruption.
- **Secondary**: Callouts serialize as `> 💡 text` but have no callout parser — reload as `quote`.
- **Fix**: Allow empty toggle titles; serialize empty toggles with unambiguous `>!` / `>` markers; add callout line parser before toggle/quote.

#### P0 #2 — Toggle title deletion removes children

- **Path**: `EditableBlock` Backspace@0 → `handleMergeWithPrev` → `deleteBlockById`.
- **Cause**: Toggle header merge deletes the entire toggle subtree when title is cleared and user backspaces again.
- **Fix**: Guard merge-delete when block is `toggle` with `children.length > 0`.

#### P0 #3 — Toggle context menu wrong target

- **Path**: Nested toggle child → `onOpenTurnInto({ blockId })` → `renderBlockMenu`.
- **Cause**: Menu resolves block type via `findBlockById(blocksRef.current, id)` (local nested scope) instead of the document root tree.
- **Fix**: Resolve block metadata from `getRootBlocks()` for menu targeting.

#### P1 #4 — Numbered list 1,1,1 across bullets

- **Path**: `renumberNumberedLists` only renumbers consecutive numbered runs.
- **Cause**: Bullet/todo siblings reset numbering groups; Notion-style continuity expected.
- **Fix**: Maintain per-indent counters across bullet/todo interruptions; reset on non-list blocks.

#### P1 #5 — Slash input reliability

- **Path**: `EditableBlock.handleInput`, `NoteView` global `Ctrl+/`.
- **Cause**: Slash menu detection runs during IME composition; global shortcut may intercept editor-adjacent `/` usage.
- **Fix**: Skip slash/wiki detection while composing; ignore `Ctrl+/` when focus is inside contentEditable.

#### P1 #6 — Unicode symbol round-trip

- **Path**: Plain text in `block.content` through markdown serialize/parse.
- **Finding**: No markdown transforms affect symbols like `→ ⇒ ≤ ≥ √ ∑ ∞`; add regression tests to lock behavior.

### P2 evaluation

| Item | Assessment | Action |
|------|------------|--------|
| #7 Toggle drag extraction | `moveBlockOutOfToggle` exists in context menu; multi-block drag into/out of toggles implemented | **Defer** full drag-all-children UX — medium risk |
| #8 Toggle headings | Requires new block types + outline integration | **Defer** — feature scope |
| #9 File icon theming | Collapsed sidebar uses 📁 emoji while rest uses Lucide | **Low-risk**: align folder icon to Lucide `Folder` |

### Testing strategy

New file: `EditorStabilityAudit.test.ts` covering:

- Toggle/callout/unicode markdown round-trip
- Toggle merge guard (children persist)
- Notion-style numbered list continuity
- Slash trigger helper behavior
- Outline heading index unchanged

Validation gate: `npm run typecheck`, `npm test`, `npm run build`.
