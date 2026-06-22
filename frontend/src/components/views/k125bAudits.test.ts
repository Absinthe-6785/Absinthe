import { describe, expect, it } from 'vitest';
import { auditK125bScheduleIaRc, K125B_SCHEDULE_SECTION_ORDER } from './k125bScheduleAudit';
import { auditScheduleRc } from './k117ScheduleAudit';
import { auditScheduleLayoutRc } from './k121ScheduleLayoutAudit';
import { auditScheduleDensityRecoveryRc } from './k124cScheduleDensityAudit';
import { SCHEDULE_SECTIONS } from './features/planner/ScheduleSectionNav';

describe('k125b schedule IA audits', () => {
  it('K-125B — routine-first section order and vertical stack', () => {
    expect(auditK125bScheduleIaRc()).toBe(true);
    expect(SCHEDULE_SECTIONS.map(s => s.id)).toEqual([...K125B_SCHEDULE_SECTION_ORDER]);
  });

  it('K-117 — unified workspace (regression)', () => {
    expect(auditScheduleRc()).toBe(true);
  });

  it('K-121 — schedule layout proportions (regression)', () => {
    expect(auditScheduleLayoutRc()).toBe(true);
  });

  it('K-124c — schedule density (regression)', () => {
    expect(auditScheduleDensityRecoveryRc()).toBe(true);
  });
});
