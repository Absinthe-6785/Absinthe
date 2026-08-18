/** K-114 — Sync loop detection audit. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditAppContentStartupContract } from './k114SyncPathAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K114_SYNC_LOOP_GUARD = [
  'AppContent independent startup coordinator',
  'account-scoped startup cancellation boundary',
  'storage merge applyingStorageMerge flag',
] as const;

export const K114_LOOP_RISK_PATTERNS = [
  'useEffect([..., t]) re-hydrate on every render',
  'hydrateFromDB without gate',
  'folder fetch on every notes merge',
] as const;

export function auditSyncLoopSources(app: string, store: string): readonly string[] {
  const appContract = auditAppContentStartupContract(app);
  const guards: string[] = [];
  if (appContract.coordinatorWired) guards.push(K114_SYNC_LOOP_GUARD[0]);
  if (appContract.cancellationBoundaryWired && appContract.accountScoped) {
    guards.push(K114_SYNC_LOOP_GUARD[1], 'account-lifecycle-reset-wired');
  }
  if (appContract.appContentOnceGuard) guards.push('bootstrap-once-wired');
  if (!app.includes('hydrateFromDB()') && !app.includes('syncNoteToDB(')) {
    guards.push('legacy-notes-hydrate-push-not-reactivated');
  }
  if (store.includes('applyingStorageMerge')) {
    guards.push(K114_SYNC_LOOP_GUARD[2], 'storage-merge-guard');
  }
  if (!store.includes('hydrateFromDB') && !store.includes('hydrateFromDBFull')) {
    guards.push('legacy-hydrate-entry-points-retired');
  }
  return guards;
}

export function auditSyncLoop(): readonly string[] {
  const app = readFileSync(join(ROOT, 'components/AppContent.tsx'), 'utf8');
  const store = readFileSync(join(ROOT, 'store/useNotesStore.ts'), 'utf8');
  return auditSyncLoopSources(app, store);
}
