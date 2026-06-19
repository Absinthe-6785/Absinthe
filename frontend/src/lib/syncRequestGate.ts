/**
 * K-114 — Serialize cloud sync; collapse overlapping hydrate requests.
 */

export type SyncGateKind = 'notes-hydrate' | 'notes-push' | 'folders-hydrate';

interface PendingSync {
  kind: SyncGateKind;
  resolve: () => void;
  reject: (err: unknown) => void;
}

let activeKind: SyncGateKind | null = null;
let activePromise: Promise<void> | null = null;
const queue: PendingSync[] = [];

function drainQueue(): void {
  if (activeKind !== null || queue.length === 0) return;
  const next = queue.shift();
  if (!next) return;
  activeKind = next.kind;
  activePromise = Promise.resolve()
    .then(() => { /* slot held until releaseSyncGate */ })
    .catch(next.reject);
}

/** Acquire sync gate — waits if same or any hydrate is in flight. */
export async function acquireSyncGate(kind: SyncGateKind): Promise<() => void> {
  if (activeKind === null) {
    activeKind = kind;
    activePromise = Promise.resolve();
    return () => releaseSyncGate(kind);
  }

  if (kind.startsWith('notes') && activeKind.startsWith('notes')) {
    await activePromise;
    activeKind = kind;
    activePromise = Promise.resolve();
    return () => releaseSyncGate(kind);
  }

  return new Promise((resolve, reject) => {
    queue.push({
      kind,
      resolve: () => resolve(() => releaseSyncGate(kind)),
      reject,
    });
  });
}

function releaseSyncGate(kind: SyncGateKind): void {
  if (activeKind !== kind) return;
  activeKind = null;
  activePromise = null;
  const next = queue.shift();
  if (next) {
    activeKind = next.kind;
    activePromise = Promise.resolve();
    next.resolve();
  }
}

/** Run fn behind gate — concurrent calls of same kind share one execution. */
let coalescedHydrate: Promise<void> | null = null;

export async function runCoalescedHydrate(fn: () => Promise<void>): Promise<void> {
  if (coalescedHydrate) return coalescedHydrate;
  coalescedHydrate = (async () => {
    const release = await acquireSyncGate('notes-hydrate');
    try {
      await fn();
    } finally {
      release();
      coalescedHydrate = null;
    }
  })();
  return coalescedHydrate;
}

export function peekSyncGateActive(): SyncGateKind | null {
  return activeKind;
}

export function resetSyncGateForTest(): void {
  activeKind = null;
  activePromise = null;
  queue.length = 0;
  coalescedHydrate = null;
}
