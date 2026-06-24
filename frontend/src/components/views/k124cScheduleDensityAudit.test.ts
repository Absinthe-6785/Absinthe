import { describe, expect, it } from 'vitest';
import { auditScheduleDensityRecovery, auditScheduleDensityRecoveryRc } from './k124cScheduleDensityAudit';

describe('K-124c Schedule density', () => {
  it('keeps a compact Today, Routine, Timetable, Calendar rhythm', () => {
    expect(auditScheduleDensityRecovery()).toEqual({
      todayFirstFlow: true,
      calendarSupporting: true,
      upcomingNavRemoved: true,
      compactMonthCells: true,
      routineNoDuplicateMargin: true,
      compactEmptyTimetable: true,
      compactEmbeddedTimetable: true,
    });
    expect(auditScheduleDensityRecoveryRc()).toBe(true);
  });
});
