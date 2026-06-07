/**
 * selectionState.ts — Focus command registry + selection range persistence
 */

export type FocusCmd = { blockId: string; offset: 'start' | 'end' | number };

type FocusHandler = (cmd: FocusCmd) => void;

const focusRegistry = new Map<string, FocusHandler>();

export function registerFocusHandler(blockId: string, handler: FocusHandler): () => void {
  focusRegistry.set(blockId, handler);
  return () => { focusRegistry.delete(blockId); };
}

export function dispatchFocusCommand(cmd: FocusCmd): void {
  focusRegistry.get(cmd.blockId)?.(cmd);
}

export function getFocusHandler(blockId: string): FocusHandler | undefined {
  return focusRegistry.get(blockId);
}

export function saveSelectionRange(): Range | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  return sel.getRangeAt(0).cloneRange();
}

export function restoreSelectionRange(range: Range | null): boolean {
  if (!range) return false;
  const sel = window.getSelection();
  if (!sel) return false;
  try {
    sel.removeAllRanges();
    sel.addRange(range.cloneRange());
    return true;
  } catch {
    return false;
  }
}
