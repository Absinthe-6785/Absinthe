# Editor Interaction Audit

Stabilization sprint — Part B findings for edit-mode text selection and nested toggle authoring. Part A fixes (Delete/Backspace, direct note navigation) are implemented separately in the same sprint.

---

## 1. Delete / Backspace for Selected Blocks (Part A — fixed)

### Root cause

Three issues compounded:

1. **`shouldDeleteSelectedBlocks` rejected Delete on non-empty blocks.** When a block was gutter-selected and focus remained in `contentEditable`, Delete returned `false` if the block had any text. `EditableBlock` does not handle Delete for character deletion, so the key appeared to do nothing.

2. **Backspace was always deferred to `EditableBlock` when focus was in CE.** Gutter-selected blocks still had CE focus, so Backspace edited text instead of removing the block.

3. **Stale `selectedBlockIds` during text editing.** Focus (`onActiveBlockChange`) did not clear gutter selection, so block-delete semantics could leak into normal typing unless selection was cleared explicitly.

### Fix applied

| Change | File |
|--------|------|
| Delete/Backspace delete selected block when `selectedIds` is non-empty and no text range is highlighted | `blockKeyboard.ts` |
| Window keyboard handler uses capture phase so block delete runs before `EditableBlock` | `useEditorKeyboard.ts` |
| Clicking into CE clears gutter selection (plain click, no modifiers) | `EditableBlock.tsx` → `onClearBlockSelection` |

### Constraints preserved

- Text range selection inside a block still deletes characters, not the block.
- Multi-block selection Delete unchanged.
- Shell-only blocks (divider, image, …) unchanged.

### Risks

- Capture-phase handler must stay scoped to `depth === 0` and `readOnly === false` (already enforced).
- If a future feature keeps gutter selection while editing intentionally, it will need a distinct “block selected” flag separate from `selectedBlockIds`.

---

## 2. Direct Note Navigation (Part A — fixed)

### Surfaces audited

| Surface | Before | After |
|---------|--------|-------|
| Default note list, backlinks, related notes, graph, database views, trace day lists, planner memo sidebar | Primary click opens note | Unchanged ✓ |
| **Areas sidebar** (`NoteView`) | Click opened area trace lens | Primary click opens area note; Ctrl/Meta/Alt+click opens trace |
| **Search while dashboard active** | Middle panel stayed on dashboard | Search query shows filtered note list |
| **Planner calendar events** (month/week/day) | `data-planner-*-event` only | Click opens linked event note via `setActiveNoteId` |
| **Archive Home** milestones & area pills | Handlers optional, no-ops | Wired to `useNotesStore.setActiveNoteId` |

### Remaining gaps (documented, not fixed)

| Surface | Why deferred |
|---------|--------------|
| Archive → note | Sets `activeNoteId` globally but does not switch to Notes tab (no cross-tab API without App-level callback). User must switch tabs manually. |
| Archive browse links | Placeholder wayfinding only — no note IDs yet. |
| Planner calendar legacy D-Day rows | Countdown labels, not note-backed in month grid |

### Risks

- Planner event click uses shared `setActiveNoteId`; memo sidebar in Planner already did this — behavior is consistent.
- Archive note open without tab switch may confuse users once; acceptable incremental fix per sprint constraints.

---

## 3. Edit-Mode Text Selection (Part B — audit)

### Architecture

The editor uses a **single active `contentEditable` per block tree level**. Inactive blocks render as `.be-editable-static` (selectable, non-editable DOM). Cross-block drag selection works only across static surfaces; activating a block swaps static → CE and destroys cross-block ranges.

```
View mode     → all blocks static → full drag selection
Edit mode     → one CE + N static → selection breaks on activation
```

### Root causes of restricted selection

1. **`handleContentMouseDown` (`SingleBlock.tsx`)** calls `preventDefault()` on non-text hits (toggle chrome, empty padding, block shell). This blocks native drag-start for selection in those regions.

2. **`onActivateBlock` on mouseup** (static blocks) promotes a block to active CE, which collapses a fragile cross-block selection before the user finishes copying.

3. **`SelectionToolbar`** listens to `selectionchange` inside the active CE only — formatting across blocks is unsupported in edit mode.

4. **Virtualization** (`VirtualBlockList`) unmounts off-screen blocks; long cross-block selections spanning unmounted rows are impossible.

### Constraints

- Do not redesign NoteView or the block data model (sprint constraint).
- Reading mode already provides unrestricted selection — switching modes is a product decision, not a bug fix.
- Toggle headers share a row with chevron + title CE; header chrome steals pointer events.

### Recommended implementation path

**Phase 1 — Gesture lock (low risk)**  
Defer `onActivateBlock` until mouseup confirms no drag selection (`selection.toString().length > 0`). Reduces accidental activation during cross-block drags.

**Phase 2 — Selection-aware chrome**  
In `handleContentMouseDown`, skip `preventDefault` when the mousedown target is inside `.be-editable` text or when shift-drag is detected.

**Phase 3 — Optional “selecting” mode flag**  
While the user holds mouse down with movement > threshold, suppress block activation and virtualization focus jumps.

**Phase 4 — Reading mode affordance**  
If edit-mode selection remains insufficient, expose “Select text” / use existing view mode toggle rather than duplicating CE per block.

### Risks

- Deferring activation can regress “click empty area to focus block” if threshold tuning is wrong.
- Capture-phase selection locks may conflict with gutter drag selection — test gutter + text selection together.

---

## 4. Nested Toggle Authoring UX (Part B — audit)

### Current model

- Toggle blocks store `children[]`; nested content uses recursive `BlockEditorInner` (`useEditorToggle.ts`).
- Empty toggle title shows CSS placeholder `토글 제목` (persistent placeholder when header CE is active).
- **Tab** on a nestable block calls `indentBlock` → `ensureParentToggle` (`blockTree.ts`), which converts the previous sibling to `toggle` if needed.
- **`handleToggleAddChild`** replaces `children` with a single new paragraph (safe only when `children` is empty).

### Authoring pain points

| Issue | Cause |
|-------|--------|
| Ambiguous nested `▶ Toggle` rows | Empty titles + identical placeholders at every depth |
| Surprise structure changes | Tab auto-converts previous block to toggle without explicit user intent |
| Lost nested content | `handleToggleAddChild` overwrites `children` array instead of appending |
| Weak hierarchy scan | Indent is visual (margin) only; no breadcrumb or depth label in chrome |

### Recommended implementation path (explore before redesign)

1. **Append-safe child creation** — `handleToggleAddChild` should append when children already exist; focus the new child.
2. **Default child titles** — On nested toggle creation (Tab nest or explicit command), seed `content` with a disambiguating placeholder or auto-title (`Toggle 1`, inherited parent hint).
3. **Explicit nested toggle command** — Slash/Turn-into “Toggle inside” instead of relying on Tab side effects; keep Tab but add undo-friendly toast or inline hint first time.
4. **Hierarchy chrome (minimal)** — Optional depth dot or parent title in gutter tooltip; no full redesign.
5. **Document Tab behavior** — Short in-editor hint or docs link until UX is redesigned.

### Risks

- Changing Tab semantics breaks muscle memory for outliner users — ship append/fix paths before changing indent rules.
- Auto-titles may pollute note content if written to `content` instead of placeholder — prefer placeholder/CSS or ephemeral UI labels first.

---

## 5. Test coverage notes

- `blockKeyboard.test.ts` — unit tests for delete gating (updated this sprint).
- Integration tests exist for gutter drag selection (`gutterDrag.integration.test.ts`) but not for Delete-after-gutter-select — consider adding one later.
- Calendar event click — no automated test yet; manual verify month/week/day event row → memo panel updates.

---

## 6. Success criteria mapping

| Criterion | Status |
|-----------|--------|
| Select block + Delete removes block | ✓ Fixed |
| Select block + Backspace removes block (gutter selection) | ✓ Fixed |
| Click note title / row opens note directly | ✓ Fixed on audited surfaces |
| User understands remaining edit limitations | ✓ This document |
| No Planner Calendar architecture change | ✓ Prop-only `onEventNoteClick` |
| No Archive architecture change | ✓ Handlers in `ArchiveHomeView` only |
| No NoteView / data model redesign | ✓ Incremental conditionals only |
