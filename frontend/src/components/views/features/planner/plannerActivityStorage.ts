/** UI-only planner activity — not part of API schema (K-113). */

export const PLANNER_ACTIVITY_KEY = 'absinthe-planner-activity-v1';
export const PLANNER_ACTIVITY_ACCOUNT_SEPARATOR = ':account:';
const MAX_ENTRIES = 32;

export interface PlannerActivityEntry {
  kind: string;
  itemId: string;
  title: string;
  at: number;
}

// The old global key is unattributed history: never read, migrate, or remove it.
function accountScopedKey(accountId: string | null | undefined): string | null {
  return typeof accountId === 'string' && accountId.length > 0 && accountId === accountId.trim()
    ? `${PLANNER_ACTIVITY_KEY}${PLANNER_ACTIVITY_ACCOUNT_SEPARATOR}${encodeURIComponent(accountId)}`
    : null;
}

function readEntries(key: string): PlannerActivityEntry[] {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PlannerActivityEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      e => typeof e.itemId === 'string'
        && typeof e.title === 'string'
        && typeof e.at === 'number',
    );
  } catch {
    return [];
  }
}

function writeEntries(key: string, entries: PlannerActivityEntry[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch { /* ignore */ }
}

export function readPlannerActivityRecents(accountId: string | null | undefined): PlannerActivityEntry[] {
  const key = accountScopedKey(accountId);
  return key ? readEntries(key) : [];
}

export function recordPlannerActivity(
  accountId: string | null | undefined,
  kind: string,
  itemId: string,
  title: string,
  at = Date.now(),
): void {
  const storageKey = accountScopedKey(accountId);
  if (!storageKey) return;
  const key = `${kind}:${itemId}`;
  const next = [
    { kind, itemId, title, at },
    ...readEntries(storageKey).filter(e => `${e.kind}:${e.itemId}` !== key),
  ];
  writeEntries(storageKey, next);
}

export function clearPlannerActivityForTest(accountId: string | null | undefined): void {
  const key = accountScopedKey(accountId);
  if (!key) return;
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}
