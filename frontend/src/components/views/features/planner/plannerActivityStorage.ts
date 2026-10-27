/** UI-only planner activity — not part of API schema (K-113). */

export const PLANNER_ACTIVITY_KEY = 'absinthe-planner-activity-v1';
export const PLANNER_ACTIVITY_ACCOUNT_SEPARATOR = ':account:';
const MAX_ENTRIES = 32;

export interface PlannerActivityEntry {
  kind: string;
  itemId: string;
  title: string;
  at: number;
  eventDate?: string;
}

/** A verified local calendar date, never an activity timestamp or inferred title. */
export function validPlannerEventDate(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1) return undefined;
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value : undefined;
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
  return key ? readEntries(key).map(({ eventDate, ...entry }) => {
    const date = validPlannerEventDate(eventDate);
    return date ? { ...entry, eventDate: date } : entry;
  }) : [];
}

export function recordPlannerActivity(
  accountId: string | null | undefined,
  kind: string,
  itemId: string,
  title: string,
  at = Date.now(),
  eventDate?: string,
): void {
  const storageKey = accountScopedKey(accountId);
  if (!storageKey) return;
  const key = `${kind}:${itemId}`;
  const date = validPlannerEventDate(eventDate);
  const next = [
    { kind, itemId, title, at, ...(date ? { eventDate: date } : {}) },
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
