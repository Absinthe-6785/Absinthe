import { describe, expect, it } from 'vitest';
import {
  formatK98TimetableAuditReport,
  runK98TimetableAuditMatrix,
} from './k98aTimetableAudit';
import { expandWeeklyScheduleDays } from './k98aTimetableMultiDay';

describe('k98aTimetableAudit', () => {
  it('fans out multi-day create into separate records', () => {
    const rows = expandWeeklyScheduleDays(
      { title: 'Gym', start_time: '07:00', end_time: '08:00', color: 'bg-blue-500' },
      [0, 1, 3, 4],
    );
    expect(rows).toHaveLength(4);
    expect(rows.map(r => r.day)).toEqual([0, 1, 3, 4]);
  });

  it('prints timetable compatibility matrix', () => {
    const report = formatK98TimetableAuditReport(runK98TimetableAuditMatrix());
    console.log('\n' + report);
    expect(report).toContain('create-multi-day');
    expect(report).toContain('edit-single-record');
  });
});
