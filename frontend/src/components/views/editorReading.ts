/**
 * editorReading.ts — Reading / Focus Mode layout (document-first, zero chrome)
 */

export const READING_LINE_HEIGHT = 1.8;
export const READING_MAX_WIDTH_PX = 720;

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
  .be-editor-root.be-reading p,
  .be-editor-root.be-reading .be-editable {
    line-height: ${READING_LINE_HEIGHT};
  }
  .be-editor-root.be-reading .be-toggle-header-block button[aria-label] {
    pointer-events: auto;
    cursor: pointer;
  }
`;
