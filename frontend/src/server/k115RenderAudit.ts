/**
 * K-115 — Render production validation audit (RSS, delta sync, no GET loops).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditSyncPaths } from './k114SyncPathAudit';
import { auditSyncLoop } from './k114SyncLoopAudit';
import { auditMemoryProfile } from './k114MemoryProfileAudit';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K115_RENDER_EXPECTED_SEQUENCE = [
  'GET /api/notes (bootstrap full — once)',
  'GET /api/note_folders (bootstrap — once)',
  'GET /api/notes?updated_after=... (delta)',
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
  coalesceGate: boolean;
} {
  const paths = auditSyncPaths();
  const loop = auditSyncLoop();
  const memory = auditMemoryProfile();
  const client = readFileSync(join(ROOT, 'lib/notesSyncClient.ts'), 'utf8');
  return {
    bootstrapOnce: paths.appContentOnceGuard,
    deltaAfterBootstrap: client.includes('updated_after') && paths.usesNotesSyncClient,
    watchdogWired: memory.includes('middleware-wired'),
    noDuplicateFetchRisks: paths.duplicateFetchRisks.length === 0,
    coalesceGate: loop.includes('hydrate-coalesce'),
  };
}

export function auditRenderRc(): readonly string[] {
  const r = auditRenderProduction();
  return [
    ...K115_RENDER_EXPECTED_SEQUENCE,
    ...K115_RENDER_FORBIDDEN.map(f => `forbidden:${f}`),
    r.bootstrapOnce ? 'bootstrap-once' : 'bootstrap-risk',
    r.deltaAfterBootstrap ? 'delta-adopted' : 'delta-missing',
    r.watchdogWired ? 'watchdog-logs' : 'watchdog-missing',
    r.noDuplicateFetchRisks ? 'no-get-loop' : 'get-loop-risk',
    r.coalesceGate ? 'hydrate-coalesced' : 'hydrate-uncoalesced',
  ];
}

export function auditRenderReady(): boolean {
  const r = auditRenderProduction();
  return r.bootstrapOnce && r.deltaAfterBootstrap && r.noDuplicateFetchRisks && r.coalesceGate;
}
