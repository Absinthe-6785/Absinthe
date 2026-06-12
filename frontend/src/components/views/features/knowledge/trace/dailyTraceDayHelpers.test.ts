import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import {
  findDailyAnchorNote,
  formatTraceDayHeading,
  hasDailyTraceMarks,
  shiftDateKey,
} from './dailyTraceDayHelpers';
import type { DailyTraceProjection } from './dailyTraceModels';

function note(id: string, title: string, overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title,
    body: '',
    updatedAt: 0,
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('dailyTraceDayHelpers', () => {
  it('shiftDateKey moves by calendar days', () => {
    expect(shiftDateKey('2026-06-11', -1)).toBe('2026-06-10');
    expect(shiftDateKey('2026-06-11', 1)).toBe('2026-06-12');
  });

  it('formatTraceDayHeading renders a readable label', () => {
    expect(formatTraceDayHeading('2026-06-11')).toMatch(/2026/);
    expect(formatTraceDayHeading('2026-06-11')).toMatch(/11/);
  });

  it('findDailyAnchorNote matches exact YYYY-MM-DD titles', () => {
    const anchor = note('a1', '2026-06-11');
    const other = note('a2', 'Daily 2026-06-11');
    expect(findDailyAnchorNote([anchor, other], '2026-06-11')?.id).toBe('a1');
  });

  it('findDailyAnchorNote ignores deleted notes', () => {
    const deleted = note('a1', '2026-06-11', { deletedAt: Date.now() });
    expect(findDailyAnchorNote([deleted], '2026-06-11')).toBeUndefined();
  });

  it('hasDailyTraceMarks is true when any section or anchor exists', () => {
    const empty: DailyTraceProjection = {
      date: '2026-06-11',
      milestones: [],
      events: [],
      activities: [],
    };
    expect(hasDailyTraceMarks(empty)).toBe(false);
    expect(hasDailyTraceMarks(empty, note('a1', '2026-06-11'))).toBe(true);
    expect(hasDailyTraceMarks({
      ...empty,
      activities: [{ noteId: 'a1', title: 'T', kind: 'created' }],
    })).toBe(true);
  });
});
