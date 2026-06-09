// Copy pipeline
export {
  applySemanticCopy,
  blocksToCopyHtml,
  collectBlocksForCopy,
  handleEditorCopyEvent,
  trySemanticCopyFromBlock,
} from './copy/blockCopy';
export { blockShape, type TreeShape } from './copy/blockCopy.investigationHelpers';
export {
  classifyClipboardHtml,
  installCopyDiagnostics,
  type CopyTraceReport,
} from './copy/copyDiagnostics';
export { installEditorCopyListener, type EditorCopyListenerOptions } from './copy/copyListener';
export { resolveCopySelection } from './copy/copySelection';
export {
  classifyClipboardPayloadVariant,
  getLastCopyClipboardVerification,
  scheduleAsyncClipboardVerification,
  verifyCopyClipboardSync,
  type ClipboardPayloadVariant,
  type CopyClipboardVerification,
} from './copy/copyClipboardVerification';
export { scheduleBrowserClipboardCapture } from './copy/browserClipboardCapture';
export { getLastCopyTraceReport, setLastCopyTraceReport } from './copy/copyTraceStore';

// Paste pipeline
export {
  adaptPastedBlocks,
  applyPasteAtBlock,
  applyPasteBlocksAt,
  extractClipboardText,
  htmlToPlainText,
  isBareUrl,
  isDocumentLevelPaste,
  normalizePasteText,
  pasteMarkdownIntoContent,
  smartInlineMerge,
  clipboardToBlocks,
  type PasteContext,
  type PasteResult,
} from './paste/blockPaste';
export { htmlDocumentToBlocks, htmlHasBlockStructure } from './paste/htmlDocumentToBlocks';
export {
  htmlTableToMarkdown,
  looksLikeTsv,
  parseStructuredPaste,
  prepareStructuredPasteText,
  tsvToMarkdownTable,
} from './paste/pasteStructure';

// Editor hooks
export { useEditorCopyEffects, type UseEditorCopyEffectsOptions } from './hooks/useEditorCopyEffects';
export {
  useEditorPaste,
  type UseEditorPasteOptions,
  type UseEditorPasteResult,
} from './hooks/useEditorPaste';
