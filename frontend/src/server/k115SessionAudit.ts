/**
 * K-115 — Long-session stability audit (1h / 2h simulation policy).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export const K115_SESSION_DURATIONS_MIN = [60, 120] as const;

export const K115_SESSION_SCENARIOS = [
  'tab-switches-alt-1-5',
  'repeated-edits-body-debounce',
  'repeated-search-ctrl-shift-f',
  'planner-schedule-detail-open',
  'cross-tab-storage-merge',
] as const;

export interface K115SessionPolicy {
  bodySyncDebounceMs: number;
  accountBootstrap: boolean;
  completeSnapshotBootstrap: boolean;
  memoryWatchdog: boolean;
  maxPendingBodySync: string;
}

export function readK115SessionPolicy(): K115SessionPolicy {
  const store = readFileSync(join(ROOT, 'store/useNotesStore.ts'), 'utf8');
  const client = readFileSync(join(ROOT, 'lib/notesSyncClient.ts'), 'utf8');
  const backend = readFileSync(join(ROOT, '../../backend/request_memory_watchdog.py'), 'utf8');
  const debounceMatch = store.match(/BODY_SYNC_MS\s*=\s*(\d+)/);
  return {
    bodySyncDebounceMs: debounceMatch ? Number(debounceMatch[1]) : 0,
    accountBootstrap: store.includes('bootstrapFromSupabase'),
    completeSnapshotBootstrap: client.includes('fetchCompleteNotesFoldersSnapshot')
      && client.includes('updated_after=0&bootstrap=true'),
    memoryWatchdog: backend.includes('RequestMemoryWatchdog'),
    maxPendingBodySync: store.includes('pendingBodySync') ? 'Map per note id' : 'none',
  };
}

export function auditSessionStability(): readonly string[] {
  const policy = readK115SessionPolicy();
  return [
    ...K115_SESSION_DURATIONS_MIN.map(m => `${m}min-session`),
    ...K115_SESSION_SCENARIOS,
    `debounce-${policy.bodySyncDebounceMs}ms`,
    policy.accountBootstrap ? 'account-bootstrap' : 'account-bootstrap-missing',
    policy.completeSnapshotBootstrap ? 'complete-snapshot' : 'complete-snapshot-missing',
    policy.memoryWatchdog ? 'watchdog-on' : 'watchdog-off',
  ];
}

/** Simulated request budget per 2h session with bounded bootstrap (batched POSTs). */
export function estimateSessionRequestCount(editsPerHour: number, hours = 2): number {
  const bootstrap = 2;
  const deltaPerHour = 4;
  const batchedPostsPerHour = Math.ceil(editsPerHour / 10);
  return bootstrap + deltaPerHour * hours + batchedPostsPerHour * hours;
}
