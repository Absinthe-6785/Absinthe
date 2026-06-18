/**
 * K-98A — Weekly timetable multi-day compatibility audit.
 */
import type { WeeklySchedule } from '@/types';
import {
  expandWeeklyScheduleDays,
  shouldFanOutWeeklyCreate,
  weeklyScheduleSiblingIds,
} from './k98aTimetableMultiDay';

export interface K98TimetableAuditRow {
  scenario: string;
  recordCount: number;
  backwardCompatible: boolean;
}

export function auditTimetableMultiDayCreate(
  base: Partial<WeeklySchedule>,
  selectedDays: readonly number[],
): K98TimetableAuditRow {
  const fanOut = shouldFanOutWeeklyCreate(null, selectedDays);
  const records = fanOut
    ? expandWeeklyScheduleDays(base, selectedDays)
    : [{ ...base, day: selectedDays[0] ?? 0 }];
  return {
    scenario: 'create-multi-day',
    recordCount: records.length,
    backwardCompatible: !fanOut || records.every(r => typeof r.day === 'number'),
  };
}

export function auditTimetableSingleEdit(
  existing: WeeklySchedule,
  all: readonly WeeklySchedule[],
): K98TimetableAuditRow {
  const siblings = weeklyScheduleSiblingIds(existing, all);
  return {
    scenario: 'edit-single-record',
    recordCount: 1 + siblings.length,
    backwardCompatible: siblings.length === 0 || siblings.every(id => all.some(s => s.id === id)),
  };
}

export function runK98TimetableAuditMatrix(): K98TimetableAuditRow[] {
  const base: Partial<WeeklySchedule> = {
    title: 'Study',
    start_time: '09:00',
    end_time: '10:00',
    color: 'bg-blue-500',
  };
  const legacy: WeeklySchedule = {
    id: 'ws-1',
    day: 2,
    title: 'Legacy',
    start_time: '08:00',
    end_time: '09:00',
    color: 'bg-green-500',
  };
  return [
    auditTimetableMultiDayCreate(base, [0, 1, 3, 4]),
    auditTimetableMultiDayCreate(base, [2]),
    auditTimetableSingleEdit(legacy, [legacy]),
  ];
}

export function formatK98TimetableAuditReport(rows: readonly K98TimetableAuditRow[]): string {
  const lines = ['K-98A timetable multi-day audit', ''];
  for (const row of rows) {
    lines.push(`${row.scenario}: records=${row.recordCount} compatible=${row.backwardCompatible}`);
  }
  return lines.join('\n');
}
