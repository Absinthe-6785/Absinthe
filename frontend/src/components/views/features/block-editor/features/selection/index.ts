// Context
export { SelectionCtx, type SelectionCtxValue } from './context/SelectionContext';

// Hooks
export {
  useEditorSelection,
  type UseEditorSelectionOptions,
  type UseEditorSelectionResult,
} from './hooks/useEditorSelection';

// Components
export { SelectionToolbar, type SelectionToolbarProps } from './components/SelectionToolbar';

// Block selection helpers
export {
  applyPointerSelection,
  clearSelection,
  extendSelectionByArrow,
  getSiblingOrderedIds,
  haveSameParent,
  selectRange,
  selectSingle,
  toggleInSelection,
} from './utils/blockSelection';

// Focus command registry + range persistence
export {
  dispatchFocusCommand,
  getFocusHandler,
  registerFocusHandler,
  restoreSelectionRange,
  saveSelectionRange,
  type FocusCmd,
} from './utils/selectionState';

export {
  handleSelectAllKeydown,
  isFocusInEditableText,
  selectAllDocumentContent,
} from './utils/documentSelectAll';

// Caret/selection offset math
export {
  getCaretOffset,
  getCaretOffsetFromPoint,
  getSelectionOffsets,
  nodePlainLength,
  setCaretOffset,
  setSelectionOffsets,
} from './utils/selectionOffsets';

// Toolbar formatting
export {
  applyWrapToBlockSelection,
  deriveToolbarFormats,
  EMPTY_FORMATS,
  type ToolbarFormatState,
} from './utils/toolbarFormat';
