const STORAGE_KEY = 'absinthe:recovery-log';

export interface RecoveryLogEntry {
  sleepHours?: number;
  note?: string;
}

type RecoveryMap = Record<string, RecoveryLogEntry>;

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

export function getRecoveryEntry(dateStr: string): RecoveryLogEntry | null {
  return readMap()[dateStr] ?? null;
}

export function getRecoveryWeekSummary(
  anchorDate: Date,
  formatDate: (d: Date) => string,
  days = 7,
): { avgSleep: number | null; loggedDays: number; latestNote: string | null } {
  const map = readMap();
  const sleeps: number[] = [];
  let latestNote: string | null = null;
  let loggedDays = 0;

  for (let i = 0; i < days; i++) {
    const d = new Date(anchorDate);
    d.setDate(d.getDate() - i);
    const key = formatDate(d);
    const entry = map[key];
    if (!entry) continue;
    loggedDays++;
    if (entry.sleepHours && entry.sleepHours > 0) sleeps.push(entry.sleepHours);
    if (i === 0 && entry.note?.trim()) latestNote = entry.note.trim();
  }

  const avgSleep = sleeps.length > 0
    ? Math.round((sleeps.reduce((a, b) => a + b, 0) / sleeps.length) * 10) / 10
    : null;

  return { avgSleep, loggedDays, latestNote };
}
