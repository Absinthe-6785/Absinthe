/** Tab-insert and draft sync helpers for CodeBlock */

export const CODE_TAB_INSERT = '  ';

export function insertTabAt(
  text: string,
  selectionStart: number,
  selectionEnd: number,
): { next: string; caret: number } {
  const next = text.slice(0, selectionStart) + CODE_TAB_INSERT + text.slice(selectionEnd);
  return { next, caret: selectionStart + CODE_TAB_INSERT.length };
}

/** Sync external code into local draft only when the textarea is not focused */
export function shouldSyncCodeDraft(
  code: string,
  activeElement: Element | null,
  textarea: HTMLTextAreaElement | null,
): boolean {
  return activeElement !== textarea;
}
