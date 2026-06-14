import type { ProteinIntakeLog } from '../../../../../types';

export function sumProteinIntake(logs: readonly ProteinIntakeLog[]): number {
  return Math.round(logs.reduce((s, l) => s + l.protein_g, 0) * 100) / 100;
}

export function computeProteinProgress(total: number, dailyTarget: number): number {
  if (dailyTarget <= 0) return 0;
  return Math.min(100, Math.round((total / dailyTarget) * 1000) / 10);
}

export function computeWeeklyProteinAverage(dailyTotals: readonly number[]): number {
  if (dailyTotals.length === 0) return 0;
  return Math.round(dailyTotals.reduce((a, b) => a + b, 0) / dailyTotals.length);
}

/** Consecutive days (ending at anchorDate) meeting or exceeding protein target. */
export function computeProteinStreak(
  dailyTotalsByDate: ReadonlyMap<string, number>,
  dailyTarget: number,
  anchorDate: string,
  formatDate: (d: Date) => string,
): number {
  if (dailyTarget <= 0) return 0;
  let streak = 0;
  const cursor = new Date(anchorDate + 'T12:00:00');
  for (let i = 0; i < 365; i++) {
    const key = formatDate(cursor);
    const total = dailyTotalsByDate.get(key) ?? 0;
    if (total >= dailyTarget) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}
