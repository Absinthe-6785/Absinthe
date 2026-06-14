const STORAGE_KEY = 'absinthe:habit-completions';

export const HABIT_COMPLETION_CHANGED = 'absinthe:habit-completion-changed';

type CompletionMap = Record<string, boolean>;

function readMap(): CompletionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as CompletionMap : {};
  } catch {
    return {};
  }
}

function writeMap(map: CompletionMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
}

function completionKey(habitId: string, dateStr: string): string {
  return `${dateStr}:${habitId}`;
}

export function isHabitCompleted(habitId: string, dateStr: string): boolean {
  return Boolean(readMap()[completionKey(habitId, dateStr)]);
}

export function setHabitCompleted(habitId: string, dateStr: string, done: boolean): void {
  const map = readMap();
  const key = completionKey(habitId, dateStr);
  if (done) map[key] = true;
  else delete map[key];
  writeMap(map);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HABIT_COMPLETION_CHANGED));
  }
}

/** Split-day rotation: Day 1..N based on days since epoch mod splitCount. */
export function resolveTodaySplitDay(selectedDate: Date, splitCount: number): string {
  const count = Math.min(7, Math.max(1, splitCount));
  const epoch = new Date('2020-01-01T12:00:00');
  const days = Math.floor((selectedDate.getTime() - epoch.getTime()) / 86_400_000);
  return `Day ${(days % count) + 1}`;
}

export function readSplitCount(): number {
  const raw = localStorage.getItem('healthSplitCount');
  const n = parseInt(raw ?? '3', 10);
  return Math.min(7, Math.max(1, Number.isNaN(n) ? 3 : n));
}

export interface HabitMetrics {
  streak: number;
  completionRate: number;
  completedToday: boolean;
}

export function computeHabitMetrics(
  habitId: string,
  dateStr: string,
  formatDate: (d: Date) => string,
  lookbackDays = 30,
): HabitMetrics {
  const map = readMap();
  const completedToday = Boolean(map[completionKey(habitId, dateStr)]);

  let streak = 0;
  const streakCursor = new Date(dateStr + 'T12:00:00');
  for (let i = 0; i < 365; i++) {
    if (Boolean(map[completionKey(habitId, formatDate(streakCursor))])) {
      streak++;
      streakCursor.setDate(streakCursor.getDate() - 1);
    } else {
      break;
    }
  }

  let completed = 0;
  const rateCursor = new Date(dateStr + 'T12:00:00');
  for (let i = 0; i < lookbackDays; i++) {
    if (Boolean(map[completionKey(habitId, formatDate(rateCursor))])) completed++;
    rateCursor.setDate(rateCursor.getDate() - 1);
  }

  return {
    streak,
    completionRate: lookbackDays > 0 ? Math.round((completed / lookbackDays) * 100) : 0,
    completedToday,
  };
}
