# K-31 — Backspace Navigation Audit

**Branch:** `k31-product-stabilization`  
**Scope:** P0 regression — empty block backspace focus jump

---

## Symptom

1. User clears all text in a block.
2. Presses Backspace — block is removed (correct).
3. Presses Backspace again — caret jumps to the **top of the document** instead of the previous block.

---

## Root Cause

Two interacting issues:

### 1. `handleDeleteSelected` dropped focus (primary)

When the window capture handler deleted an empty selected block via `useEditorKeyboard` → `handleDeleteSelected`, it called `onActiveBlockChange(null)` with **no `onFocusCmd`**. Focus was lost; the next keypress hit document chrome or the first block unpredictably.

### 2. Capture handler competed with merge path

`shouldDeleteSelectedBlocks` returned `true` for a single empty `Backspace` at caret 0, running block **delete** instead of `EditableBlock` → `onMergeWithPrev`, which already focused the previous block at caret end.

### 3. Block ID instability (related K-31 outline fix)

Repeated `markdownToBlocks()` calls generated new block IDs per parse; outline navigation shared this class of bug via `resolveHeadingScrollTarget` caching.

---

## Fix

| Change | File |
| ------ | ---- |
| `resolveFocusAfterBlockDelete` — previous block at content end, else next at start | `multiBlockOps.ts` |
| `handleDeleteSelected` restores focus via `onFocusCmd` | `useEditorBlockOps.ts` |
| Single empty `Backspace` delegates to EditableBlock merge | `blockKeyboard.ts` |

---

## Expected Behavior (post-fix)

| Step | Result |
| ---- | ------ |
| Empty block + Backspace | Block removed; focus on **previous** editable at **end** |
| Backspace again | Normal merge/delete chain; **never** document-top jump |
| Delete on empty block (non-merge) | Block removed; focus restored |
| Multi-select delete | Focus nearest preceding block |

---

## Regression Tests

- `multiBlockOps.test.ts` — `resolveFocusAfterBlockDelete`
- `blockKeyboard.test.ts` — merge delegation vs Delete key
- `backspaceNavigation.integration.test.ts` — BlockEditor mount, middle/first/heading blocks

---

## Remaining Edge Cases (P2)

| Case | Notes |
| ---- | ----- |
| Toggle heading shell focus | Non-`TEXT_BLOCK_TYPES` use shell focus path |
| Virtualized off-screen focus | Uses pending focus queue (existing) |
| First root block empty + Backspace | Merge no-op at pos 0 (by design) |

---

## Success Criteria

| Criterion | Status |
| --------- | ------ |
| Never jump to document start | Met |
| Previous block at caret end | Met |
| Viewport stable (no scroll-to-top) | Met |
| Regression tests | Met |
