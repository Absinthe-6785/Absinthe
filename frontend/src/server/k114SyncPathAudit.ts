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

export interface K114AppContentStartupContract {
  coordinatorWired: boolean;
  notesBootstrapOrdered: boolean;
  cancellationBoundaryWired: boolean;
  accountScoped: boolean;
  legacyBootstrapMarkerAbsent: boolean;
  healthSingleFlightWired: boolean;
  appContentOnceGuard: boolean;
}

/**
 * The old audit looked for the retired notesBootstrapStarted ref.  POST_RTU_08
 * deliberately replaced that local guard with the independent startup
 * coordinator, so the audit now verifies the current ordering and lifecycle
 * contract instead of a historical implementation detail.
 */
export function auditAppContentStartupContract(appSrc: string): K114AppContentStartupContract {
  const notesStart = appSrc.indexOf('startNotes: async () => {');
  const initNotes = appSrc.indexOf('await initNotesStorage(authUser.id);', notesStart);
  const bootstrapNotes = appSrc.indexOf('await bootstrapFromSupabase();', initNotes);
  const coordinatorWired = appSrc.includes('startIndependentStartup(')
    && notesStart >= 0;
  const notesBootstrapOrdered = coordinatorWired
    && initNotes > notesStart
    && bootstrapNotes > initNotes;
  const cancellationBoundaryWired = appSrc.includes('let cancelled = false;')
    && appSrc.includes('if (cancelled) return;')
    && appSrc.includes('run.cancel();')
    && appSrc.includes('detachNotesStorage();');
  const accountScoped = appSrc.includes('authUser.id');
  const legacyBootstrapMarkerAbsent = !appSrc.includes('notesBootstrapStarted');
  const healthSingleFlightWired = appSrc.includes('runHealthBootstrapSingleFlight(')
    && appSrc.includes('runHealthBootstrapSingleFlight(authUser.id');

  return {
    coordinatorWired,
    notesBootstrapOrdered,
    cancellationBoundaryWired,
    accountScoped,
    legacyBootstrapMarkerAbsent,
    healthSingleFlightWired,
    appContentOnceGuard: coordinatorWired
      && notesBootstrapOrdered
      && cancellationBoundaryWired
      && accountScoped
      && legacyBootstrapMarkerAbsent,
  };
}

export function auditSyncPaths(): {
  fullSyncCallers: readonly string[];
  deltaSyncCallers: readonly string[];
  duplicateFetchRisks: readonly string[];
  usesNotesSyncClient: boolean;
  appContentOnceGuard: boolean;
  healthSingleFlightWired: boolean;
  dormantHydrateEntryPointsRemoved: boolean;
} {
  const storeSrc = read('store/useNotesStore.ts');
  const appSrc = read('components/AppContent.tsx');
  const clientSrc = read('lib/notesSyncClient.ts');
  const appContract = auditAppContentStartupContract(appSrc);

  const unconditionalNotesGet = (storeSrc.match(/authFetch\(`\$\{API_URL\}\/api\/notes`\)/g) ?? []).length;
  const usesClient = storeSrc.includes('fetchCompleteNotesFoldersSnapshot')
    && storeSrc.includes('bootstrapFromSupabase');

  return {
    fullSyncCallers: [...K114_FULL_SYNC_ALLOWED],
    deltaSyncCallers: [...K114_DELTA_SYNC_CALLERS],
    duplicateFetchRisks: unconditionalNotesGet > 0
      ? ['useNotesStore still has unconditional GET /api/notes'] : [],
    usesNotesSyncClient: usesClient && clientSrc.includes('updated_after=0&bootstrap=true'),
    appContentOnceGuard: appContract.appContentOnceGuard,
    healthSingleFlightWired: appContract.healthSingleFlightWired,
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
    'startIndependentStartup',
    'initNotesStorage(authUser.id)',
    'bootstrapFromSupabase()',
    'run.cancel()',
  ];
}
