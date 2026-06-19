/** K-109 — Snapshot visibility audit. */
export const K109_SNAPSHOT_SLOTS = ['last', 'daily', 'weekly', 'monthly'] as const;

export const K109_SNAPSHOT_HOOKS = [
  'data-k109-snapshots-grid',
  'data-k109-snapshot-card',
  'data-k109-snapshot-slot',
  'data-k109-snapshot-restore',
] as const;

export function auditArchiveSnapshots(): readonly string[] {
  return [...K109_SNAPSHOT_SLOTS, ...K109_SNAPSHOT_HOOKS];
}
