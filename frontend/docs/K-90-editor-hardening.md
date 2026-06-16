# K-90 — Editor Hardening

**Branch:** `k90-editor-hardening`  
**Status:** Implemented  
**Scope:** Selection consistency, multi-block indent/outdent, keyboard routing, regression tests  
**Prerequisites:** K-87D Editor Interaction Audit, K-89A Search & Interaction Integrity

---

## Executive Summary

K-90 closes remaining **presentation and interaction debt** in the block editor without redesigning architecture or replacing contenteditable.

| Area | Before | After |
|------|--------|-------|
| Multi-block Tab / Shift+Tab | Single active block only | Batch indent/outdent via `indentSelectedBlocks` / `outdentSelectedBlocks` |
| Collapsed toggle selection | Logical selection included hidden children; header not visually selected | `isBlockVisuallySelected` highlights collapsed toggle headers |
| Escape while editing | Blocked by `shouldSuppressEditorKeyboardShortcuts` | Handled before suppression; search inputs exempt |
| Block-select Tab | Not handled at root keyboard layer | `useEditorKeyboard` routes Tab when blocks selected (not editing) |

---

## A. Collapsed Toggle Selection Audit

### Current contract

| Layer | Behavior |
|-------|----------|
| **Logical selection** | Document-order preorder (`flattenBlockIds`) — collapsed children remain selectable via Shift+click / Shift+Arrow |
| **Visual selection** | DOM children hidden when collapsed — K-90 adds header highlight when any descendant is selected |
| **Delete / duplicate / move** | `normalizedOpIds` expands toggle headers + dedupes ancestors (unchanged) |
| **Gutter drag** | Cannot reach hidden children until toggle expanded (by design, K-82/K-83) |

### K-90 fix

`isBlockVisuallySelected(block, selectedIds)` in `blockSelection.ts` — collapsed toggle headers show `be-block-selected` when selection includes hidden descendants.

---

## B. Multi-Block Indent / Outdent

### Implementation

`multiBlockOps.ts`:

- `indentSelectedBlocks` — `minimalDragIds` → document-order `indentBlock` per id
- `outdentSelectedBlocks` — reverse document-order `outdentBlock`

### Wiring

| Surface | Behavior |
|---------|----------|
| `useEditorKeyboard` | Tab / Shift+Tab when ≥1 block selected and not editing in contenteditable |
| `BlockContextMenu` | Indent/outdent uses batch ops when `selectionCount > 1` |
| `EditableBlock` | Single-block Tab while editing (unchanged) |

### Hierarchy rules preserved

- `minimalDragIds` prevents parent+child double-ops
- `indentBlock` / `outdentBlock` unchanged — toggle nesting, list indent, `ensureParentToggle` expansion
- Reverse-order outdent prevents orphan blocks in nested toggles

---

## C. Keyboard Routing Audit

| Key | Editor editing | Block selected | Search / metadata inputs |
|-----|----------------|----------------|--------------------------|
| **Escape** | → block select (K-90 fix) | clear selection | native / search handler (exempt) |
| **Enter** | split block (EditableBlock) | enter edit on first selected | suppressed |
| **Tab** | single indent (EditableBlock) | batch indent (K-90) | suppressed |
| **Shift+Tab** | single outdent | batch outdent | suppressed |
| **Delete/Backspace** | text merge/chars | block delete (`blockKeyboard`) | suppressed |
| **Shift+Arrow** | extend selection | extend selection | suppressed |

Escape now runs **before** `shouldSuppressEditorKeyboardShortcuts()` with explicit exemptions for find-in-note and sidebar search.

---

## D. Nested Toggle Integrity

Stress-tested via `multiBlockOps.test.ts` and `editorHardening.stress.test.ts`:

```text
Toggle
 └ Toggle
    └ Paragraph
```

Outdent batch (`inner`, `mid`) → flat `['outer', 'mid', 'inner']` with no duplicate ids.

---

## E. Regression Coverage

| Test file | Guards |
|-----------|--------|
| `multiBlockOps.test.ts` | Batch indent/outdent, toggle dedupe |
| `blockSelection.test.ts` | `isBlockVisuallySelected` |
| `useEditorKeyboard.test.ts` | Escape, Tab routing, search exemption |
| `editorHardening.stress.test.ts` | 1200-block selection slice, 500-block indent, 200-block delete |

Existing K-87D/K-82 tests (`blockKeyboard`, `gutterDrag`, `dragSelection`) unchanged.

---

## F. Stress-Test Results

| Scenario | Blocks | Threshold | Result |
|----------|--------|-----------|--------|
| Document-order range slice | 1200+ | &lt; 50 ms | Pass |
| Multi-block indent | 500 | &lt; 500 ms | Pass |
| Multi-block delete | 200 | &lt; 300 ms | Pass |
| Nested toggle outdent | 3-level | tree integrity | Pass |

---

## G. Remaining Risks (Deferred)

| ID | Risk | Notes |
|----|------|-------|
| K-87D1 | `selectionMode` enum | Optional future clarity |
| K-87D2 | Keyboard duplicate/move on multi-select | Context menu covers duplicate |
| Gutter select collapsed children | Requires expand-first | Documented in K-82 |
| Active ≠ selected visual | `be-block-active` after text click | Low severity |

---

## H. Files Changed

- `multiBlockOps.ts` — batch indent/outdent
- `blockSelection.ts` — `isBlockVisuallySelected`
- `useEditorKeyboard.ts` — Escape/Tab routing fix
- `BlockEditor.tsx` — wire batch ops, visual selection, context menu
- `selection/index.ts` — export
- Tests + this report

---

## Success Criteria

Users can perform **multi-block indent/outdent**, **Escape transitions**, and **collapsed-toggle selection** without focus confusion, hierarchy corruption, or unexpected editor behavior.
