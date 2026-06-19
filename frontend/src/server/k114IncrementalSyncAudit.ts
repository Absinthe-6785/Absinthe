/** K-114 — Incremental sync adoption audit. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K114_INCREMENTAL_SYNC_RULES = [
  'bootstrap: full sync once when lastSyncAt absent',
  'steady-state: GET /api/notes?updated_after=<ts>',
  'recovery: hydrateFromDBFull forces full vault',
  'folders: fetch once then skip on delta',
] as const;

export function auditIncrementalSync(): readonly string[] {
  const client = readFileSync(join(ROOT, 'lib/notesSyncClient.ts'), 'utf8');
  const store = readFileSync(join(ROOT, 'store/useNotesStore.ts'), 'utf8');
  const backend = readFileSync(join(ROOT, '../../backend/main.py'), 'utf8');
  return [
    client.includes('updated_after') ? 'client-updated-after' : 'client-missing-updated-after',
    client.includes('resolveNotesSyncMode') ? 'client-mode-resolver' : 'client-no-mode',
    store.includes('mergeDeltaNoteRows') ? 'store-delta-merge' : 'store-no-delta-merge',
    store.includes('hydrateFromDBFull') ? 'store-recovery-full' : 'store-no-recovery',
    backend.includes('updated_after') ? 'backend-filter' : 'backend-no-filter',
    ...K114_INCREMENTAL_SYNC_RULES,
  ];
}
