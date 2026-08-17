/** K-114 — Sync loop detection audit. */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K114_SYNC_LOOP_GUARD = [
  'AppContent notesBootstrapStarted ref',
  'storage merge applyingStorageMerge flag',
] as const;

export const K114_LOOP_RISK_PATTERNS = [
  'useEffect([..., t]) re-hydrate on every render',
  'hydrateFromDB without gate',
  'folder fetch on every notes merge',
] as const;

export function auditSyncLoop(): readonly string[] {
  const app = readFileSync(join(ROOT, 'components/AppContent.tsx'), 'utf8');
  const store = readFileSync(join(ROOT, 'store/useNotesStore.ts'), 'utf8');
  const guards: string[] = [...K114_SYNC_LOOP_GUARD];
  if (!app.includes('notesBootstrapStarted')) guards.push('MISSING: bootstrap ref');
  const bootstrapGuardWired =
    app.includes('const notesBootstrapStarted = useRef(false);') &&
    app.includes('if (notesBootstrapStarted.current) return;') &&
    app.includes('notesBootstrapStarted.current = true;') &&
    app.includes('initNotesStorage(authUser.id)') &&
    app.includes('bootstrapFromSupabase()');
  if (bootstrapGuardWired) guards.push('bootstrap-once-wired');
  if (
    app.includes('notesBootstrapStarted.current = false;') &&
    app.includes('detachNotesStorage();')
  ) {
    guards.push('account-lifecycle-reset-wired');
  }
  if (!app.includes('hydrateFromDB()') && !app.includes('syncNoteToDB(')) {
    guards.push('legacy-notes-hydrate-push-not-reactivated');
  }
  if (store.includes('applyingStorageMerge')) guards.push('storage-merge-guard');
  if (!store.includes('hydrateFromDB') && !store.includes('hydrateFromDBFull')) {
    guards.push('legacy-hydrate-entry-points-retired');
  }
  return guards;
}
