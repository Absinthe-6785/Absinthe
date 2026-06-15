# K-78 Editor Interaction & Block UX Fixes

Polish-only release for editor interaction correctness. No architecture redesign, no new features.

## 0. Toolbar Layout & Overlap Fixes

**Root cause:** Note header used a single flex row with many text buttons (Mark Event, Milestone, Area, Copy, etc.) that did not shrink or wrap safely at 1280–1600px widths.

**Fix:** `NoteEditorHeaderActions` component:
- Primary actions always visible: view mode, star, panel toggle, trash/restore
- On mobile/compact chrome: metadata actions collapse into overflow menu (`⋯`)
- Classification/weak-topic/folder hidden on compact to preserve title space
- `marginLeft: auto` action cluster with `flexShrink: 0`

## 1. Toggle Editing Position Bug

**Root cause:** `SelectionToolbar` used `range.getBoundingClientRect()` which returns zero-size rects for some painted inline selections inside toggles, placing the toolbar at viewport `(0, 8)`.

**Fix:** Fallback to host element rect; flip below block when above viewport; clamp horizontal position to viewport margins.

## 2. Caret Placement Bug

**Root cause:** Inactive blocks activated with `onActivate('end')` always; shell clicks forced `offset: 'end'`.

**Fix:**
- `getCaretOffsetFromPoint()` maps click coordinates to plain-text offset
- Static block mouseup/dblclick uses click position
- Shell clicks skip forced end-focus on shift/meta selection

## 3. Multi-Block Drag Selection

**Root causes:**
- Gutter drag disabled at `depth > 0` (nested toggles)
- Hit test not scoped to editor root
- Left-margin drag zone only on gutter strip

**Fix:**
- Gutter drag enabled at all depths; updates root selection via `SelectionCtx.applyGutterRange`
- `hitTestBlockIdFromPoint` requires block inside editor root
- Block shell left 56px zone starts range drag (same as gutter)
- Shift+pointerdown extends from existing anchor

## 4. Shift + Click / Shift + Arrow

**Fix:**
- Shift+click on static blocks routes to `onBlockSelect` with real modifiers
- `extendSelectionByArrow` for shift+arrow up/down (capture phase, depth 0)
- Existing `applyPointerSelection` shift range unchanged

## 5. Multi-Block Operations

Validated existing paths unchanged:
- `deleteSelectedBlocks`, `duplicateSelectedBlocks`, drag with `minimalDragIds`
- Menu shows multi-select header when `selectionCount > 1`

## 6. Nested Toggle Stability

- Nested editors share root `SelectionCtx` for selection display and gutter range
- Toggle header passes `onModifierPointerDown` for shift selection
- No schema/tree changes

## Files Modified

| File | Change |
|------|--------|
| `NoteEditorHeaderActions.tsx` | New responsive header actions |
| `NoteViewEditorArea.tsx` | Wire header actions, compact metadata |
| `selectionOffsets.ts` | `getCaretOffsetFromPoint` |
| `EditableBlock.tsx` | Click-position caret, shift block select |
| `SingleBlock.tsx` | Shell drag zone, shift click, pointer handler |
| `blockSelection.ts` | `extendSelectionByArrow` |
| `SelectionContext.tsx` | `applyGutterRange`, `anchorBlockId` |
| `useEditorSelection.ts` | Gutter range callback |
| `useEditorGutterDrag.ts` | Nested support, shift anchor, left zone |
| `blockGutterSelection.ts` | Scoped hit test |
| `useEditorKeyboard.ts` | Shift+arrow extension |
| `BlockEditor.tsx` | Nested gutter, ref at all depths |
| `SelectionToolbar.tsx` | Anchor positioning fix |
| `toggleRender.tsx`, `editorTypes.ts` | Modifier pointer props |
| `i18n.ts` | `nvMoreActions` |
| Tests | `blockSelection.test.ts` |

## Verification

```bash
cd frontend && npm run typecheck && npm run build && npm run test
```

**Results (2026-06-14):**
- `typecheck` — pass (editor, undefined, app)
- `build` — pass
- `test` — 277 files, 1962 tests pass

## Remaining Editor UX Debt

1. Cross-block text selection still limited (single active CE architecture).
2. Shift+click cannot span toggle parent boundaries (same-parent rule by design).
3. Virtualized off-screen blocks need scroll-to-focus for gutter drag end.
4. Note header folder selector hidden on compact — accessible via overflow only on mobile.
5. No DOM integration test for SelectionToolbar toggle positioning yet.
