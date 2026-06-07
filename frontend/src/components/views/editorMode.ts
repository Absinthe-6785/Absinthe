/**
 * editorMode.ts — Note editor view modes (unified naming)
 */

export type EditorMode = 'edit' | 'reading' | 'graph';

export function isReadingMode(mode: EditorMode): boolean {
  return mode === 'reading';
}

export function isEditMode(mode: EditorMode): boolean {
  return mode === 'edit';
}

export function isGraphMode(mode: EditorMode): boolean {
  return mode === 'graph';
}

/** Ctrl+E: cycle between edit and reading (skip graph). */
export function toggleEditReading(mode: EditorMode): EditorMode {
  if (mode === 'graph') return 'edit';
  return mode === 'reading' ? 'edit' : 'reading';
}
