import { describe, expect, it } from 'vitest';
import { auditScheduleDensityRecovery, auditScheduleDensityRecoveryRc } from './k124cScheduleDensityAudit';

describe('K-124c Schedule density', () => {
  it('restores a compact Today, Upcoming, Calendar, Routine, Timetable rhythm', () => {
    expect(auditScheduleDensityRecovery()).toEqual({
      emptyUpcomingRemoved: true,
      tighterSectionRhythm: true,
      upcomingHeightReduced: true,
      upcomingGapsReduced: true,
      routineNoDuplicateMargin: true,
      compactEmptyTimetable: true,
      compactEmbeddedTimetable: true,
    });
    expect(auditScheduleDensityRecoveryRc()).toBe(true);
  });
});
