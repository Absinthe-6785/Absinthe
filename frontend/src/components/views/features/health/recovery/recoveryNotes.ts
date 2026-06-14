const STORAGE_KEY = 'absinthe:recovery-log';

export const RECOVERY_LOG_CHANGED = 'absinthe:recovery-log-changed';

export type SleepQuality = 1 | 2 | 3 | 4 | 5;

export interface RecoveryLogEntry {
  sleepHours?: number;
  sleepQuality?: SleepQuality;
  note?: string;
  restDayNote?: string;
}

type RecoveryMap = Record<string, RecoveryLogEntry>;

function dispatchChange(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(RECOVERY_LOG_CHANGED));
  }
}

function readMap(): RecoveryMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as RecoveryMap : {};
  } catch {
    return {};
  }
}

function writeMap(map: RecoveryMap): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  dispatchChange();
}

export function getRecoveryEntry(dateStr: string): RecoveryLogEntry | null {
  const entry = readMap()[dateStr];
  return entry ?? null;
}

export function setRecoveryEntry(dateStr: string, patch: RecoveryLogEntry): void {
  const map = readMap();
  const prev = map[dateStr] ?? {};
  const next: RecoveryLogEntry = { ...prev, ...patch };

  const hasData =
    (next.sleepHours != null && next.sleepHours > 0) ||
    (next.sleepQuality != null && next.sleepQuality >= 1) ||
    Boolean(next.note?.trim()) ||
    Boolean(next.restDayNote?.trim());

  if (hasData) map[dateStr] = next;
  else delete map[dateStr];

  writeMap(map);
}

export function getRecoveryHistory(
  anchorDate: Date,
  formatDate: (d: Date) => string,
  days = 14,
): Array<{ date: string; entry: RecoveryLogEntry | null }> {
  const map = readMap();
  const rows: Array<{ date: string; entry: RecoveryLogEntry | null }> = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    const key = formatDate(d);
    rows.push({ date: key, entry: map[key] ?? null });
  }
  return rows;
}

function collectSleepHours(
  anchorDate: Date,
  formatDate: (d: Date) => string,
  days: number,
  offsetDays = 0,
): number[] {
  const map = readMap();
  const sleeps: number[] = [];
  for (let i = offsetDays; i < offsetDays + days; i++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    const entry = map[formatDate(d)];
    if (entry?.sleepHours && entry.sleepHours > 0) sleeps.push(entry.sleepHours);
  }
  return sleeps;
}

function avgOf(values: number[]): number | null {
  if (values.length === 0) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

export type RecoveryTrend = 'up' | 'down' | 'steady';

export function getRecoveryWeekSummary(
  anchorDate: Date,
  formatDate: (d: Date) => string,
  days = 7,
): {
  avgSleep: number | null;
  latestSleep: number | null;
  loggedDays: number;
  latestNote: string | null;
  latestRestDayNote: string | null;
  trend: RecoveryTrend | null;
} {
  const map = readMap();
  const sleeps: number[] = [];
  let latestNote: string | null = null;
  let latestRestDayNote: string | null = null;
  let latestSleep: number | null = null;
  let loggedDays = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    const key = formatDate(d);
    const entry = map[key];
    if (!entry) continue;
    loggedDays++;
    if (entry.sleepHours && entry.sleepHours > 0) sleeps.push(entry.sleepHours);
    if (i === 0) {
      if (entry.sleepHours && entry.sleepHours > 0) latestSleep = entry.sleepHours;
      if (entry.note?.trim()) latestNote = entry.note.trim();
      if (entry.restDayNote?.trim()) latestRestDayNote = entry.restDayNote.trim();
    }
  }

  const avgSleep = avgOf(sleeps);
  const thisWeek = collectSleepHours(anchorDate, formatDate, 7, 0);
  const prevWeek = collectSleepHours(anchorDate, formatDate, 7, 7);
  const thisAvg = avgOf(thisWeek);
  const prevAvg = avgOf(prevWeek);

  let trend: RecoveryTrend | null = null;
  if (thisAvg != null && prevAvg != null) {
    if (thisAvg > prevAvg + 0.2) trend = 'up';
    else if (thisAvg < prevAvg - 0.2) trend = 'down';
    else trend = 'steady';
  }

  return { avgSleep, latestSleep, loggedDays, latestNote, latestRestDayNote, trend };
}
