# Editor Architecture (Sprint F-3A)

## Design principle

`BlockEditor.tsx` is **orchestration + block-type render dispatch only**. Business logic lives in dedicated modules.

## Module ownership

| Module | Responsibility | Public API | Depends on |
|--------|----------------|------------|------------|
| `BlockEditor.tsx` | Mount chrome, wire `BlockEditorInner`, preview wrapper | `<BlockEditor />`, `BlockEditorPreview` | Inner, chrome, reading |
| `BlockEditorInner` | Menu/slash/wiki state, paste, indent, DnD wiring | internal | `SingleBlock`, menus |
| `SingleBlock` | Block shell, drop indicators, `renderInner` dispatch | internal | `EditorChrome`, `EditableBlock` |
| `EditableBlock.tsx` | contentEditable input, shortcuts, slash/wiki triggers | `<EditableBlock />` | `editableLive`, `wikiNavigation`, `toolbarFormat` |
| `useBlockEditor.ts` | body ↔ blocks, undo/redo, image insert | `useBlockEditor`, `BlockEditorHandle` | `blockUtils` |
| `editableRender.ts` | Pure inline HTML (readOnly + live) | `renderInlineMarkdown`, `liveInlineHtml` | `noteUtils` |
| `editableLive.ts` | DOM paint + caret restore | `paintEditableLive` | `editableRender`, `selectionOffsets` |
| `editableDom.ts` | Plain text read, delete helpers | `readBlockText`, `deleteBeforeCaret` | `selectionOffsets` (re-export shim) |
| `selectionOffsets.ts` | Caret/selection offset math | `get/setCaretOffset`, `get/setSelectionOffsets` | DOM |
| `selectionState.ts` | Focus command registry, range save/restore | `registerFocusHandler`, `dispatchFocusCommand` | — |
| `WikiMenu.tsx` | Wiki autocomplete UI (Korean) | `<WikiMenu />` | `wikiSearch` |
| `wikiSearch.ts` | Target filtering | `filterWikiTargets` | — |
| `wikiNavigation.ts` | `[[` detect, insert, Ctrl+click resolve | `detectWikiQuery`, `insertWikiAtCaret` | `editableLive` |
| `EditorChrome.tsx` | Block handles, shell class names | `BlockHandles`, `EditorChromeStyles` | `editorChromeStyles`, `editorReading` |
| `editorChromeStyles.ts` | Editor CSS string | `EDITOR_CHROME_STYLES` | `editorReading` |
| `editorReading.ts` | Reading mode layout | `readingRootClass`, `shouldShowBlockChrome` | — |
| `SelectionToolbar.tsx` | Selection format bar | `<SelectionToolbar />` | `toolbarFormat`, `editableLive` |
| `BlockContextMenu.tsx` | Grip context menu | `<BlockContextMenu />` | `editorMenuModel` |
| `SlashMenu.tsx` + `slashPalette.ts` + `slashRecent.ts` | Slash UI + ranking + recency | `SlashMenu`, `buildSlashPalette` | `blockUtils` |
| `editorDragDrop.tsx` | Pointer DnD | `useDragDrop`, `BlockGripIcon` | `dragHierarchy`, `blockTree` |
| `blockPaste.ts` + `pasteStructure.ts` | Paste intelligence | `applyPasteAtBlock` | **frozen** |
| `listIndent.ts` + `blockTree.ts` + `dragHierarchy.ts` | Outliner hierarchy | **frozen** | — |

## Re-export shims

- `editableDom.ts` re-exports `selectionOffsets` for backward-compatible imports.
- `BlockEditor.tsx` re-exports `useBlockEditor` and `BlockEditorHandle` from `useBlockEditor.ts`.

## Line-count target (F-3A)

| Metric | Before F-3A | After F-3A |
|--------|-------------|------------|
| `BlockEditor.tsx` | ~3150 | ~2300 (orchestration + block-type components) |
| Tests | 250 | 260+ |

Table/Math/Code/Image blocks remain in `BlockEditor.tsx` until a future F-3B sprint.
