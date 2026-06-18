/**
 * editorReading.ts — Reading / Focus Mode layout (document-first, zero chrome)
 */

import { K103_READING_MAX_WIDTH_PX } from './k103LayoutConstants';

export const READING_LINE_HEIGHT = 1.8;
export const READING_MAX_WIDTH_PX = K103_READING_MAX_WIDTH_PX;

/** Root class when rendering in reading mode. */
export function readingRootClass(readingMode: boolean): string {
  return readingMode ? 'be-reading be-document' : 'be-document';
}

/** Block chrome (handles, menus, active bar) only in edit mode. */
export function shouldShowBlockChrome(readingMode: boolean): boolean {
  return !readingMode;
}

/** CSS injected once by BlockEditor — Focus Mode typography & chrome removal. */
export const EDITOR_READING_STYLES = `
  .be-editor-root.be-reading {
    max-width: ${READING_MAX_WIDTH_PX}px;
    margin: 0 auto;
    line-height: ${READING_LINE_HEIGHT};
    padding-left: 0 !important;
  }
  @media (max-width: 767px) {
    .be-editor-root.be-reading,
    .be-editor-root.be-document {
      max-width: 100%;
      padding-left: 12px !important;
      padding-right: 12px !important;
    }
    .be-editor-root.be-reading .be-block,
    .be-editor-root.be-document .be-block {
      margin-bottom: 2px;
    }
    .be-editor-root.be-reading p,
    .be-editor-root.be-reading .be-editable,
    .be-editor-root.be-reading .be-block-text,
    .be-editor-root.be-document.be-reading p,
    .be-editor-root.be-document.be-reading .be-editable,
    .be-editor-root.be-document.be-reading .be-block-text {
      font-size: 16px;
      line-height: 1.85;
    }
    .be-editor-root.be-document-edit {
      padding-left: 12px !important;
      padding-right: 8px !important;
    }
    .be-editor-root.be-document-edit .be-gutter {
      flex-basis: 32px;
      width: 32px;
      margin-left: -32px;
    }
  }
  .be-editor-root.be-reading .be-handles,
  .be-editor-root.be-reading .be-block-handle-menu,
  .be-editor-root.be-reading .be-slash-menu,
  .be-editor-root.be-reading .be-selection-toolbar {
    display: none !important;
  }
  .be-editor-root.be-reading .be-block-active::before,
  .be-editor-root.be-reading .be-block-active {
    background: transparent !important;
  }
  .be-editor-root.be-reading .be-block-active::before {
    display: none;
  }
  .be-editor-root.be-reading .be-editable[contenteditable]:empty::before {
    content: none !important;
  }
  .be-editor-root.be-reading h1,
  .be-editor-root.be-reading h2,
  .be-editor-root.be-reading h3,
  .be-editor-root.be-reading .be-heading-1,
  .be-editor-root.be-reading .be-heading-2,
  .be-editor-root.be-reading .be-heading-3 {
    margin-top: 1.35em;
    margin-bottom: 0.45em;
  }
  .be-editor-root.be-reading h1:first-child,
  .be-editor-root.be-reading h2:first-child,
  .be-editor-root.be-reading h3:first-child {
    margin-top: 0.25em;
  }
  .be-editor-root.be-reading p,
  .be-editor-root.be-reading .be-editable,
  .be-editor-root.be-reading .be-block-text {
    line-height: ${READING_LINE_HEIGHT};
    margin-bottom: 0.65em;
  }
  .be-editor-root.be-reading .be-callout,
  .be-editor-root.be-reading [data-block-type="callout"] {
    padding: 12px 14px;
    margin: 0.75em 0;
    border-radius: 10px;
  }
  .be-editor-root.be-reading pre,
  .be-editor-root.be-reading .be-code-block,
  .be-editor-root.be-reading [data-block-type="code"] {
    margin: 0.85em 0;
    border-radius: 8px;
    overflow-x: auto;
    max-width: 100%;
  }
  .be-editor-root.be-reading table {
    display: block;
    overflow-x: auto;
    max-width: 100%;
    margin: 0.85em 0;
  }
  .be-editor-root.be-reading .be-toggle-header-block button[aria-label] {
    pointer-events: auto;
    cursor: pointer;
  }
  .be-editor-root.be-reading .be-toggle-empty,
  .be-editor-root.be-reading .be-toggle-add-child,
  .be-editor-root.be-reading .be-document-bottom-strip,
  .be-editor-root.be-reading .be-empty-document-hint {
    display: none !important;
  }
  .be-editor-root .be-block.be-heading-flash {
    animation: be-heading-flash 1.2s ease-out;
  }
  @keyframes be-heading-flash {
    0% { background: rgba(124, 58, 237, 0.14); }
    100% { background: transparent; }
  }
`;
