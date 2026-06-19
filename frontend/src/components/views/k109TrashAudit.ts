/** K-109 — Deleted notes (trash) browsing audit. */
export const K109_TRASH_HOOKS = [
  'data-k109-deleted-panel',
  'data-k109-deleted-search',
  'data-k109-deleted-sort',
  'data-k109-deleted-list',
  'data-k109-deleted-row',
  'data-k109-deleted-restore',
  'data-k109-open-trash',
] as const;

export const K109_TRASH_SORTS = ['newest', 'oldest', 'title'] as const;

export function auditArchiveTrash(): readonly string[] {
  return [...K109_TRASH_HOOKS, ...K109_TRASH_SORTS];
}
