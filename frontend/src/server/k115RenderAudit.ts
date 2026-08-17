/**
 * K-115 — Render production validation audit (RSS, delta sync, no GET loops).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSyncPaths } from './k114SyncPathAudit';
import { auditMemoryProfile } from './k114MemoryProfileAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K115_RENDER_EXPECTED_SEQUENCE = [
  'initNotesStorage (local authority — once)',
  'complete account Notes/Folders snapshot (read-only)',
  'durable local apply and readback',
] as const;

export const K115_RENDER_FORBIDDEN = [
  'Repeated GET /api/notes without updated_after',
  'Hydration loop on translation re-render',
  'Uncoalesced parallel hydrate calls',
] as const;

export function auditRenderProduction(): {
  bootstrapOnce: boolean;
  deltaAfterBootstrap: boolean;
  watchdogWired: boolean;
  noDuplicateFetchRisks: boolean;
  retiredHydratePaths: boolean;
} {
  const paths = auditSyncPaths();
  const memory = auditMemoryProfile();
  const client = readFileSync(join(ROOT, 'lib/notesSyncClient.ts'), 'utf8');
  return {
    bootstrapOnce: paths.appContentOnceGuard,
    deltaAfterBootstrap: client.includes('updated_after=0&bootstrap=true') && paths.usesNotesSyncClient,
    watchdogWired: memory.includes('middleware-wired'),
    noDuplicateFetchRisks: paths.duplicateFetchRisks.length === 0,
    retiredHydratePaths: paths.dormantHydrateEntryPointsRemoved,
  };
}

export function auditRenderRc(): readonly string[] {
  const r = auditRenderProduction();
  return [
    ...K115_RENDER_EXPECTED_SEQUENCE,
    ...K115_RENDER_FORBIDDEN.map(f => `forbidden:${f}`),
    r.bootstrapOnce ? 'bootstrap-once' : 'bootstrap-risk',
    r.deltaAfterBootstrap ? 'complete-snapshot-adopted' : 'complete-snapshot-missing',
    r.watchdogWired ? 'watchdog-logs' : 'watchdog-missing',
    r.noDuplicateFetchRisks ? 'no-get-loop' : 'get-loop-risk',
    r.retiredHydratePaths ? 'legacy-hydrate-retired' : 'legacy-hydrate-present',
  ];
}

export function auditRenderReady(): boolean {
  const r = auditRenderProduction();
  return r.bootstrapOnce && r.deltaAfterBootstrap && r.noDuplicateFetchRisks && r.retiredHydratePaths;
}
