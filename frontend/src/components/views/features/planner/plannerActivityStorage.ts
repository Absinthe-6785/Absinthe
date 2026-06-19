/** UI-only planner activity — not part of API schema (K-113). */

export const PLANNER_ACTIVITY_KEY = 'absinthe-planner-activity-v1';
const MAX_ENTRIES = 32;

export interface PlannerActivityEntry {
  kind: string;
  itemId: string;
  title: string;
  at: number;
}

function readEntries(): PlannerActivityEntry[] {
  try {
    const raw = localStorage.getItem(PLANNER_ACTIVITY_KEY);
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

function writeEntries(entries: PlannerActivityEntry[]): void {
  try {
    localStorage.setItem(PLANNER_ACTIVITY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
  } catch { /* ignore */ }
}

export function readPlannerActivityRecents(): PlannerActivityEntry[] {
  return readEntries();
}

export function recordPlannerActivity(
  kind: string,
  itemId: string,
  title: string,
  at = Date.now(),
): void {
  const key = `${kind}:${itemId}`;
  const next = [
    { kind, itemId, title, at },
    ...readEntries().filter(e => `${e.kind}:${e.itemId}` !== key),
  ];
  writeEntries(next);
}

export function clearPlannerActivityForTest(): void {
  try {
    localStorage.removeItem(PLANNER_ACTIVITY_KEY);
  } catch { /* ignore */ }
}
