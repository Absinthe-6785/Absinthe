# K-87D Editor Interaction Audit & Selection Model Cleanup

**Branch:** `k87d-editor-interaction-audit`  
**Status:** Audit complete; targeted interaction fixes applied  
**Scope:** Selection state, Delete key, editing ↔ block-select transitions, hit targets, overlays

---

## Executive Summary

| Area | Verdict |
|------|---------|
| Delete on block selection | **Fixed** — focus/selection mismatch resolved |
| Editing ↔ block-select transitions | **Improved** — shell/gutter select, Escape, Enter |
| Hit targets | **Widened** — left zone 56→64px, gutter strip padding |
| Selection overlays | **OK** — decorative layers use `pointer-events: none` |
| Multi-block selection | **OK** — existing K-82 paths reliable; no code changes |
| Visible = actual state | **Partially improved** — Delete/Enter/Escape aligned; char-delete while editing unchanged (by design) |

---

## 1. Selection State Model

The editor does not use a single enum. Parallel state drives behavior:

| Mode | State | Visual | Keyboard |
|------|-------|--------|----------|
| **Editing** | `activeBlockId` + focus in `.be-editable[contenteditable="true"]` | `be-block-active` | Char keys, Enter split, Tab indent |
| **Block selected** | `selectedBlockIds` (size ≥ 1) | `be-block-selected` | Delete (block), Shift+arrows extend, Enter→edit |
| **Multi selected** | `selectedBlockIds.size > 1` | Multiple `be-block-selected` | Delete, duplicate (menu) |
| **Gutter drag selecting** | `isGutterDragging` | `be-gutter-dragging` | — |
| **Collapsed text range** | `window.getSelection()` | `SelectionToolbar` | Inline format shortcuts |
| **Chrome pinned** | `pinnedControlsId` | `be-controls-visible` | Grip menu |

**Key files:** `useEditorSelection.ts`, `BlockEditor.tsx`, `SingleBlock.tsx`, `EditableBlock.tsx`, `useEditorKeyboard.ts`, `blockKeyboard.ts`

### State mismatches found (pre-fix)

1. **Gutter/shell select + stale focus** — Block showed `be-block-selected` but focus remained in another block's contenteditable → `shouldDeleteSelectedBlocks` returned false.
2. **Shell click entered editing** — Padding click called `applyFocusCommand`, moving caret into editable while user intended block-select mode.
3. **Escape cleared selection** — Global Escape called `clearSelection()` instead of transitioning editing → block-selected.
4. **Active ≠ selected confusion** — `be-block-active` persists after `onClearBlockSelection` on text click; users mistook active highlight for block selection.

---

## 2. Delete Key Behavior

### Root cause

`shouldDeleteSelectedBlocks` (single-select path) inspected **`e.target` (focused element)** rather than whether focus belonged to the **selected** block. Gutter selection cleared text ranges but not contenteditable focus.

### Fix

1. **`blockKeyboard.ts`** — If sole selected block ≠ focus block id → allow block delete.
2. **`SingleBlock.tsx`** — Shell padding click selects block without `applyFocusCommand`; blurs editor focus.
3. **`useEditorGutterDrag.ts`** — Blur contenteditable on gutter pointer down and pointer up.

### Preserved behavior (intentional)

- Delete while **editing non-empty text** in the selected block → character delete (EditableBlock).
- Single empty block + Backspace → merge with previous (EditableBlock).
- Multi-select Delete → always block delete (unchanged).

---

## 3. Editing ↔ Block Selection Transitions

| Action | Before | After |
|--------|--------|-------|
| Text click | Clear selection, enter edit | Unchanged |
| Shell padding click | Select + focus caret in editable | Select + blur (block-ops mode) |
| Gutter click/drag | Select range; focus often stale | Select + blur |
| **Enter** (block selected, not editing) | No-op | Focus first selected block at start |
| **Escape** (editing) | Clear selection / close menus only | Blur → select current block |
| **Escape** (block selected, not editing) | Clear selection | Clear selection (unchanged) |

**Files:** `useEditorKeyboard.ts`, `BlockEditor.tsx`, `documentFocus.ts` (`blurActiveEditorFocus`)

---

## 4. Block Hit Target Audit

| Target | Before | After (K-87D) |
|--------|--------|---------------|
| Left drag zone | 56px | **64px** (`BLOCK_LEFT_SELECT_ZONE_PX`) |
| Gutter strip inset | `inset: 0` | `inset: -2px -4px` (taller/wider hit area) |
| Handles | `pointer-events: none` until hover | Unchanged (gutter strip remains primary target) |

**Recommendation (future):** Consider always-on grip hit area on touch devices (K-87D3).

---

## 5. Multi-Block Selection

Existing paths verified (no changes):

- Shift+click range — `applyPointerSelection`
- Ctrl/Cmd toggle — `applyPointerSelection`
- Gutter drag — `updateGutterSelection` (cross-toggle K-82)
- Shift+↑/↓ — `extendSelectionByArrow`

No new failure modes identified beyond focus-sync (fixed).

---

## 6. Selection Overlay Audit

| Layer | pointer-events | Issue |
|-------|----------------|-------|
| `be-block-selected::after` | `none` | None |
| Active gutter bar `::before` | `none` | None |
| `DragOverlay` | `none` | None |
| `.be-handles` | `none` → `auto` on hover | Grip requires hover; gutter strip compensates |

**Conclusion:** Overlays do not steal clicks or keyboard focus. Friction was state logic, not CSS interception.

---

## 7. Visible State = Actual State

| Operation | Block selected (post-fix) | While editing same block |
|-----------|---------------------------|--------------------------|
| Delete | ✅ Block removed (if focus blurred / elsewhere) | Char delete (non-empty) |
| Duplicate | ✅ Context menu / shortcuts | N/A |
| Move | ✅ Grip menu | N/A |
| Indent/Outdent | ✅ Grip menu | Tab (editable) |
| Copy/Cut | ✅ Multi-block copy effects | Text clipboard |

---

## 8. Related Interaction Checks

| Area | Finding |
|------|---------|
| Collapsed toggles | Gutter zone constant applied in `ToggleBlock.tsx` |
| Nested blocks | `useEditorKeyboard` depth === 0 only; nested editors inherit parent selection context |
| Cross-toggle selection | Unchanged; K-82 `getDocumentOrderedIds` path |
| Drag after selection | Unchanged |
| Focus after delete | `resolveFocusAfterBlockDelete` (existing) |

---

## Fixes Implemented

| File | Change |
|------|--------|
| `blockKeyboard.ts` | Focus block vs selected block check; `blockIdFromElement` |
| `blockKeyboard.test.ts` | Cross-block focus delete test |
| `documentFocus.ts` | `blurActiveEditorFocus` |
| `blockGutterSelection.ts` | `BLOCK_LEFT_SELECT_ZONE_PX = 64` |
| `useEditorGutterDrag.ts` | Blur on gutter select; shared zone constant |
| `SingleBlock.tsx` | Shell select without caret focus; wider left zone |
| `ToggleBlock.tsx` | Shared left zone constant |
| `useEditorKeyboard.ts` | Escape → block-select; Enter → edit selected |
| `BlockEditor.tsx` | Wire `onSelectBlock`, `onEnterEditBlock` |
| `editorChromeStyles.ts` | Wider gutter strip hit area |

---

## Follow-Up Recommendations

| Task | Scope |
|------|-------|
| **K-87D1 Selection Model Hardening** | Optional `selectionMode: 'edit' \| 'block'` flag; dedupe active vs selected visuals |
| **K-87D2 Multi-Block Operations** | Keyboard shortcuts for duplicate/move on selection without context menu |
| **K-87D3 Collapsed Toggle Selection** | Touch-friendly always-visible grips; toggle-header shell click parity |

---

## Classification

| Item | Action |
|------|--------|
| Delete on gutter/shell selection | **Fix now** ✅ |
| Escape → block selected | **Fix now** ✅ |
| Enter → edit from selection | **Fix now** ✅ |
| Hit target widening | **Fix now** ✅ |
| Delete non-empty block while editing | **Accept as-is** (char delete) |
| Active vs selected visual overlap | **Fix later** (K-87D1) |
| Touch grip discoverability | **Fix later** (K-87D3) |

---

## Verification

```bash
cd frontend
npm run typecheck
npm run build
npm run test
```
