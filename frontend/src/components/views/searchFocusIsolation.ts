/**
 * Focus ownership for search fields, metadata inputs, and the block editor.
 * Form controls must never receive editor keyboard shortcuts (Backspace merge, undo, etc.).
 */

export const EDITOR_DOCUMENT_SEARCH_ATTR = 'data-editor-document-search';
export const SIDEBAR_NOTE_SEARCH_ATTR = 'data-sidebar-note-search';

/** True when the element is a text-editing surface (input, textarea, select, contenteditable). */
export function isFormControlElement(el: Element | null | undefined): boolean {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return !!el.closest('.be-editable[contenteditable="true"], [contenteditable="true"]');
}

/** True when document focus is inside any form control. */
export function isFocusInFormControl(): boolean {
  if (typeof document === 'undefined') return false;
  return isFormControlElement(document.activeElement);
}

function activeElementMatchesAttr(attr: string): boolean {
  if (typeof document === 'undefined') return false;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  return active.matches(`[${attr}]`) || !!active.closest(`[${attr}]`);
}

/** Find-in-note toolbar search input has focus. */
export function isEditorDocumentSearchFocused(): boolean {
  return activeElementMatchesAttr(EDITOR_DOCUMENT_SEARCH_ATTR);
}

/** Sidebar note-list filter input has focus. */
export function isSidebarNoteSearchFocused(): boolean {
  return activeElementMatchesAttr(SIDEBAR_NOTE_SEARCH_ATTR);
}

/** Editor undo/redo and block shortcuts must not run while a form control is focused. */
export function shouldSuppressEditorKeyboardShortcuts(): boolean {
  return isFocusInFormControl();
}
