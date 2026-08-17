/** K-114 — Frontend Notes bootstrap path audit. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), 'utf8');
}

export const K114_FULL_SYNC_ALLOWED = [
  'notesSyncClient.ts — complete account snapshot',
  'useNotesStore.ts — bootstrapFromSupabase durable apply',
  'useNotesStore.ts — POST upsert (push)',
] as const;

export const K114_DELTA_SYNC_CALLERS = [] as const;

export const K114_FORBIDDEN_UNCONDITIONAL = [
  'retired hydrateFromDB/hydrateFromDBFull entry points',
] as const;

export function auditSyncPaths(): {
  fullSyncCallers: readonly string[];
  deltaSyncCallers: readonly string[];
  duplicateFetchRisks: readonly string[];
  usesNotesSyncClient: boolean;
  appContentOnceGuard: boolean;
  dormantHydrateEntryPointsRemoved: boolean;
} {
  const storeSrc = read('store/useNotesStore.ts');
  const appSrc = read('components/AppContent.tsx');
  const clientSrc = read('lib/notesSyncClient.ts');

  const unconditionalNotesGet = (storeSrc.match(/authFetch\(`\$\{API_URL\}\/api\/notes`\)/g) ?? []).length;
  const usesClient = storeSrc.includes('fetchCompleteNotesFoldersSnapshot')
    && storeSrc.includes('bootstrapFromSupabase');

  return {
    fullSyncCallers: [...K114_FULL_SYNC_ALLOWED],
    deltaSyncCallers: [...K114_DELTA_SYNC_CALLERS],
    duplicateFetchRisks: unconditionalNotesGet > 0
      ? ['useNotesStore still has unconditional GET /api/notes'] : [],
    usesNotesSyncClient: usesClient && clientSrc.includes('updated_after=0&bootstrap=true'),
    appContentOnceGuard: appSrc.includes('notesBootstrapStarted')
      && appSrc.includes('initNotesStorage(authUser.id)')
      && appSrc.includes('bootstrapFromSupabase()'),
    dormantHydrateEntryPointsRemoved: !storeSrc.includes('hydrateFromDB')
      && !storeSrc.includes('hydrateFromDBFull')
      && !appSrc.includes('hydrateFromDB')
      && !clientSrc.includes('fetchNotesFromCloud')
      && !clientSrc.includes('fetchFoldersFromCloud'),
  };
}

export function auditSyncPathHooks(): readonly string[] {
  return [
    'notesSyncClient.ts',
    'fetchCompleteNotesFoldersSnapshot',
    'notesBootstrapStarted',
  ];
}
