import { describe, expect, it } from 'vitest';
import { auditScheduleDensityRecovery, auditScheduleDensityRecoveryRc } from './k124cScheduleDensityAudit';

describe('K-124c Schedule density', () => {
  it('keeps compact surfaces while making planning primary', () => {
    expect(auditScheduleDensityRecovery()).toEqual({
      planningFirstFlow: true,
      calendarPrimary: true,
      desktopSupportRail: true,
      upcomingNavRemoved: true,
      compactMonthCells: true,
      routineNoDuplicateMargin: true,
      compactEmptyTimetable: true,
      compactEmbeddedTimetable: true,
    });
    expect(auditScheduleDensityRecoveryRc()).toBe(true);
  });
});
