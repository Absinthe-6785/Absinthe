/** K-114 — Autosave burst audit. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K114_AUTOSAVE_GUARDS = [
  'BODY_SYNC_MS debounce',
  'pendingBodySync Map coalescing per note id',
  'flushPendingSync on pagehide',
  'scheduleBodySync replaces pending entry',
] as const;

export function auditAutosave(): readonly string[] {
  const store = readFileSync(join(ROOT, 'store/useNotesStore.ts'), 'utf8');
  return [
    store.includes('BODY_SYNC_MS') ? 'debounce-ms' : 'missing-debounce',
    store.includes('pendingBodySync') ? 'pending-map' : 'missing-pending-map',
    store.includes('flushPendingSync') ? 'flush-on-unload' : 'missing-flush',
    store.includes('clearAllBodySyncTimers') ? 'timer-cleanup' : 'missing-timer-cleanup',
    ...K114_AUTOSAVE_GUARDS,
  ];
}
