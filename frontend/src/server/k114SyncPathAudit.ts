/**
 * K-114 — Frontend sync path audit (full vs delta vs duplicate).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

export const K114_FULL_SYNC_ALLOWED = [
  'notesSyncClient.ts — bootstrap',
  'notesSyncClient.ts — recovery',
  'useNotesStore.ts — POST upsert (push)',
] as const;

export const K114_DELTA_SYNC_CALLERS = [
  'notesSyncClient.ts — fetchNotesFromCloud delta',
  'useNotesStore.ts — hydrateFromDB incremental merge',
] as const;

export const K114_FORBIDDEN_UNCONDITIONAL = [
  'authFetch(`${API_URL}/api/notes`) without updated_after outside notesSyncClient',
] as const;

export function auditSyncPaths(): {
  fullSyncCallers: readonly string[];
  deltaSyncCallers: readonly string[];
  duplicateFetchRisks: readonly string[];
  usesNotesSyncClient: boolean;
  appContentOnceGuard: boolean;
} {
  const storeSrc = read('store/useNotesStore.ts');
  const appSrc = read('components/AppContent.tsx');
  const clientSrc = read('lib/notesSyncClient.ts');
  const gateSrc = read('lib/syncRequestGate.ts');

  const unconditionalNotesGet = (storeSrc.match(/authFetch\(`\$\{API_URL\}\/api\/notes`\)/g) ?? []).length;
  const usesClient = storeSrc.includes('fetchNotesFromCloud') && storeSrc.includes('runCoalescedHydrate');

  return {
    fullSyncCallers: [...K114_FULL_SYNC_ALLOWED],
    deltaSyncCallers: [...K114_DELTA_SYNC_CALLERS],
    duplicateFetchRisks: unconditionalNotesGet > 0
      ? ['useNotesStore still has unconditional GET /api/notes']
      : appSrc.includes('notesBootstrapStarted') ? [] : ['AppContent missing bootstrap guard'],
    usesNotesSyncClient: usesClient && clientSrc.includes('updated_after'),
    appContentOnceGuard: appSrc.includes('notesBootstrapStarted') && gateSrc.includes('runCoalescedHydrate'),
  };
}

export function auditSyncPathHooks(): readonly string[] {
  return [
    'notesSyncClient.ts',
    'syncRequestGate.ts',
    'NOTES_LAST_SYNC_KEY',
    'runCoalescedHydrate',
  ];
}
