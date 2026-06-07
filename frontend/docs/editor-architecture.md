# Editor Architecture (Sprint F-3A / F-3B / F-4)

## Design principle

`BlockEditor.tsx` is **orchestration only** — menus, paste, indent, DnD wiring, and `SingleBlock` shell dispatch. Block-type rendering lives in dedicated modules registered via `blockRegistry.tsx`.

## Module ownership

| Module | Responsibility | Public API | Depends on |
|--------|----------------|------------|------------|
| `BlockEditor.tsx` | Mount chrome, wire `BlockEditorInner`, preview wrapper | `<BlockEditor />`, `BlockEditorPreview` | Inner, chrome, registry |
| `BlockEditorInner` | Menu/slash/wiki state, paste, indent, DnD wiring | internal | `SingleBlock`, menus |
| `SingleBlock` | Block shell, drop indicators, registry dispatch | internal | `EditorChrome`, `blockRegistry` |
| `blockRegistry.tsx` | Declarative block-type render dispatch | `renderBlockContent`, `registerBlockRenderer` | block components, `EditableBlock` |
| `TableBlock.tsx` | Table cell edit, row/col ops, keyboard nav | `<TableBlock />` | `tableEditing`, `tableNavigation` |
| `tableEditing.ts` | Pure row/col/cell mutations | `addTableRow`, `updateTableCell`, … | — |
| `tableNavigation.ts` | Pure Tab/Enter navigation targets | `navigateTableCellTab`, … | — |
| `MathBlock.tsx` | LaTeX edit/view toggle | `<MathBlock />` | `mathRendering` |
| `mathRendering.ts` | KaTeX HTML render | `renderKatexHtml` | `window.katex` |
| `CodeBlock.tsx` | Language label + code textarea | `<CodeBlock />` | `codeBlockUtils` |
| `codeBlockUtils.ts` | Tab insert, draft sync guard | `insertTabAt`, `shouldSyncCodeDraft` | — |
| `ImageBlock.tsx` | Image render, URL, caption, resize | `<ImageBlock />` | `imageBlockUtils` |
| `imageBlockUtils.ts` | URL btn style, resize clamp | `clampImageWidth`, `imgBtnStyle` | `blockUtils` |
| `ToggleBlock.tsx` | Toggle shell (header + children) | `<ToggleBlock />` | `toggleRender` |
| `toggleRender.tsx` | Toggle header/children helpers | `renderToggleHeader`, `renderToggleChildren` | `EditableBlock` |
| `EditableBlock.tsx` | contentEditable input, shortcuts, slash/wiki triggers | `<EditableBlock />` | `editableLive`, `wikiNavigation`, `toolbarFormat` |
| `useBlockEditor.ts` | body ↔ blocks, undo/redo, image insert | `useBlockEditor`, `BlockEditorHandle` | `blockUtils` |
| `editableRender.ts` | Pure inline HTML (readOnly + live) | `renderInlineMarkdown`, `liveInlineHtml` | `noteUtils` |
| `editableLive.ts` | DOM paint + caret restore | `paintEditableLive` | `editableRender`, `selectionOffsets` |
| `editableDom.ts` | Plain text read, delete helpers | `readBlockText`, `deleteBeforeCaret` | `selectionOffsets` (re-export shim) |
| `selectionOffsets.ts` | Caret/selection offset math | `get/setCaretOffset`, `get/setSelectionOffsets` | DOM |
| `selectionState.ts` | Focus command registry, range save/restore | `registerFocusHandler`, `dispatchFocusCommand` | — |
| `editorTypes.ts` | Shared editor types incl. `BlockRenderContext` | types | `blockUtils`, `selectionState` |
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

## Toggle nested rendering

`ToggleBlock` receives `renderNested: (toggleBlock) => ReactNode` from `BlockEditorInner`. It **must not** import `BlockEditor` or `BlockEditorInner` — avoids circular dependencies for F-3C.

## Re-export shims

- `editableDom.ts` re-exports `selectionOffsets` for backward-compatible imports.
- `BlockEditor.tsx` re-exports `useBlockEditor` and `BlockEditorHandle` from `useBlockEditor.ts`.

## Line-count target

| Metric | F-3A | F-3B | F-4 |
|--------|------|------|-----|
| `BlockEditor.tsx` | ~2300 | ~1126 | ~1180 |
| Tests | 272 | 311 | 332 |
