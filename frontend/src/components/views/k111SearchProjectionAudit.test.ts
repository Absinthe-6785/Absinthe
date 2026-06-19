import { describe, expect, it, beforeEach } from 'vitest';
import {
  auditSearchProjection,
  auditSearchProjectionSinglePass,
} from './k111SearchProjectionAudit';
import { auditSearchGrouping } from './k111SearchGroupingAudit';
import { auditSearchCard } from './k111SearchCardAudit';
import { auditRecentSearch } from './k111RecentSearchAudit';
import { auditSearchPerformance } from './k111SearchPerformanceAudit';
import { auditSearchKeyboard, auditSearchKeyboardGlobalShortcut } from './k111KeyboardAudit';
import { auditSearchEmptyStates } from './k111SearchEmptyStateAudit';
import { auditSearchMobile, auditSearchMobileTouchTargets } from './k111SearchMobileAudit';
import { auditSearchLayout } from './k111SearchLayoutAudit';
import {
  buildSearchProjection,
} from './features/search/buildSearchProjection';
import { buildHighlightsForResults } from './features/search/searchHighlight';
import { clearSearchRecentForTest } from './features/search/searchRecentStorage';
import { buildPlannerSearchResults } from './features/search/buildSearchDomainResults';

describe('k111SearchProjectionAudit', () => {
  it('projection slices', () => {
    expect(auditSearchProjection()).toEqual([
      'query',
      'results',
      'groupedResults',
      'counts',
      'highlights',
      'recentSearches',
    ]);
    expect(auditSearchProjectionSinglePass()).toBe(true);
  });
});

describe('k111 audits', () => {
  it('cross-domain grouping', () => {
    expect(auditSearchGrouping()).toContain('notes');
    expect(auditSearchGrouping()).toContain('archive');
    expect(auditSearchGrouping()).toContain('absinthe-search-sections');
  });

  it('result card hooks', () => {
    expect(auditSearchCard()).toContain('data-k111-search-card');
    expect(auditSearchCard()).toContain('relative-dates');
  });

  it('recent search buckets', () => {
    expect(auditRecentSearch()).toContain('today');
    expect(auditRecentSearch()).toContain('data-k111-clear-recent');
  });

  it('performance memo and virtual list', () => {
    expect(auditSearchPerformance()).toContain('highlights');
    expect(auditSearchPerformance()).toContain('50');
  });

  it('keyboard shortcuts', () => {
    expect(auditSearchKeyboardGlobalShortcut()).toBe(true);
    expect(auditSearchKeyboard()).toContain('Ctrl+Shift+F:open-search-focus-input');
  });

  it('empty states', () => {
    expect(auditSearchEmptyStates()).toContain('k111EmptyNoRecent');
  });

  it('mobile widths', () => {
    expect(auditSearchMobile()).toEqual([320, 375, 768]);
    expect(auditSearchMobileTouchTargets()).toBe(true);
  });

  it('layout hooks', () => {
    expect(auditSearchLayout()).toContain('data-k111-search-workspace');
  });
});

describe('buildSearchProjection', () => {
  beforeEach(() => {
    clearSearchRecentForTest();
  });

  it('groups results by domain', () => {
    const p = buildSearchProjection({
      query: 'run',
      notes: [],
      folders: [],
      schedules: [{ id: '1', text: 'Morning run', start_time: '07:00', end_time: '08:00', is_dday: false, color: 'blue', category: 'Personal' }],
      todos: [],
      routines: [],
      workouts: [],
      healthBlocks: [],
      weeklySchedules: [],
      recipes: [],
      recentSearches: [],
      now: new Date(),
    });
    expect(p.groupedResults.some(g => g.domain === 'planner')).toBe(true);
    expect(p.counts.planner).toBe(1);
  });

  it('builds highlights map', () => {
    const highlights = buildHighlightsForResults([{ id: 'a', title: 'Alpha test' }], 'test');
    expect(highlights.get('a')?.titleRanges.length).toBeGreaterThan(0);
  });

  it('planner search matches schedule text', () => {
    const results = buildPlannerSearchResults(
      'yoga',
      [{ id: 's', text: 'Yoga class', start_time: '09:00', end_time: '10:00', is_dday: false, color: 'green', category: 'Health' }],
      [],
      [],
      [],
      new Date(),
    );
    expect(results[0]?.title).toBe('Yoga class');
  });
});
