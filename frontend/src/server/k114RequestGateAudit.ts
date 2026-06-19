/** K-114 — Request gate audit. */
export const K114_SYNC_GATE_RULES = [
  'one sync at a time',
  'collapse concurrent hydrate',
  'serialize notes-hydrate kind',
] as const;

export const K114_SYNC_GATE_HOOKS = [
  'syncRequestGate.ts',
  'acquireSyncGate',
  'runCoalescedHydrate',
  'peekSyncGateActive',
] as const;

export function auditRequestGate(): readonly string[] {
  return [...K114_SYNC_GATE_RULES, ...K114_SYNC_GATE_HOOKS];
}
