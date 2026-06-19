import { describe, expect, it } from 'vitest';
import { auditCrossReferences } from './k113CrossReferenceAudit';
import { auditRecentActivity } from './k113RecentActivityAudit';
import { auditRelativeDates } from './k113RelativeDateAudit';
import { auditNavigation } from './k113NavigationAudit';
import { auditEmptyStates } from './k113EmptyStateAudit';
import { auditSurfaces } from './k113SurfaceAudit';
import { auditMobile } from './k113MobileAudit';
import { auditProjections, auditNoGlobalProjection } from './k113ProjectionAudit';
import { buildRecentActivityProjection } from './buildRecentActivityProjection';

describe('k113 audits', () => {
  it('cross-reference hooks', () => {
    expect(auditCrossReferences().length).toBeGreaterThanOrEqual(4);
  });

  it('recent activity buckets and domains', () => {
    expect(auditRecentActivity()).toContain('today');
    expect(auditRecentActivity()).toContain('planner');
    expect(auditRecentActivity()).toContain('data-k113-recent-activity');
  });

  it('unified relative date buckets', () => {
    expect(auditRelativeDates()).toContain('thisWeek');
    expect(auditRelativeDates()).toContain('classifyCohesionBucket');
  });

  it('navigation matrix', () => {
    expect(auditNavigation().some(n => n.includes('planner'))).toBe(true);
    expect(auditNavigation().some(n => n.includes('k113OpenInNotes'))).toBe(true);
  });

  it('empty-state language', () => {
    expect(auditEmptyStates()).toContain('k113NoRecentActivity');
    expect(auditEmptyStates()).toContain('No data.');
  });

  it('surface consistency hooks', () => {
    expect(auditSurfaces()).toContain('data-k111-search-card');
  });

  it('mobile widths and touch targets', () => {
    expect(auditMobile()).toContain('320');
    expect(auditMobile()).toContain('data-k113-open-cooking-note');
  });

  it('five domain projections plus activity composer', () => {
    expect(auditProjections()).toHaveLength(6);
    expect(auditNoGlobalProjection()).toBe(true);
  });

  it('buildRecentActivityProjection groups notes by bucket', () => {
    const now = new Date('2026-06-18T12:00:00');
    const todayStart = now.getTime() - 60_000;
    const projection = buildRecentActivityProjection({
      notes: [{
        id: 'n-1',
        title: 'Study notes',
        updatedAt: todayStart,
        lastOpenedAt: todayStart,
        folderId: null,
        tags: [],
        starred: false,
        deletedAt: null,
        content: '',
        createdAt: todayStart,
      }],
      plannerRecents: [],
      recipeRecents: [],
      archiveRestoreRecents: [],
      labels: { today: 'Today', yesterday: 'Yesterday', daysAgo: n => `${n}d` },
      now,
    });
    expect(projection.isEmpty).toBe(false);
    expect(projection.groups[0]?.items.some(i => i.domain === 'notes')).toBe(true);
  });
});
