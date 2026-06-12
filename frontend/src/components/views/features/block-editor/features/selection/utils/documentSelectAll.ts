/**
 * documentSelectAll.ts — Ctrl+A scope: block vs full document
 */

/** True when keyboard focus is inside an editable text field (block, title, code, etc.). */
export function isFocusInEditableText(): boolean {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return false;
  if (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement) return true;
  if (active.isContentEditable) return true;
  return !!active.closest('.be-editable[contenteditable="true"], [contenteditable="true"]');
}

/** Select all visible text content inside the editor document root. */
export function selectAllDocumentContent(documentRoot: HTMLElement): boolean {
  const sel = window.getSelection();
  if (!sel) return false;
  try {
    const range = document.createRange();
    range.selectNodeContents(documentRoot);
    sel.removeAllRanges();
    sel.addRange(range);
    return true;
  } catch {
    return false;
  }
}

/** Handle Ctrl+A — block scope when inside editable, document scope otherwise. */
export function handleSelectAllKeydown(
  e: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey' | 'preventDefault'>,
  documentRoot: HTMLElement | null,
): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod || e.key.toLowerCase() !== 'a') return false;
  if (isFocusInEditableText()) return false;
  if (!documentRoot) return false;
  e.preventDefault();
  return selectAllDocumentContent(documentRoot);
}
