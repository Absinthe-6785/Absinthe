/** K-106 — Undo/redo stack audit. */
export const K106_UNDO_REDO = {
  historyLimit: 200,
  coalesceMs: 500,
  structuralImmediate: true,
  shortcuts: ['Ctrl+Z', 'Ctrl+Shift+Z', 'Ctrl+Y'],
} as const;

export function auditUndoRedo(): typeof K106_UNDO_REDO {
  return K106_UNDO_REDO;
}

export function formatK106UndoRedoReport(cfg: typeof K106_UNDO_REDO): string {
  return [
    'K-106 undo/redo audit',
    '',
    `  limit: ${cfg.historyLimit}`,
    `  coalesceMs: ${cfg.coalesceMs}`,
    `  structuralImmediate: ${cfg.structuralImmediate}`,
    `  shortcuts: ${cfg.shortcuts.join(', ')}`,
  ].join('\n');
}
