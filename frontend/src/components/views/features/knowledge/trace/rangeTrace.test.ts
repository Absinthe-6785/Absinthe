import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { applyEventToNote } from './eventNotes';
import { applyMilestoneToNote } from './milestoneNotes';
import {
  buildMonthTraceProjection,
  buildQuarterTraceProjection,
  buildRangeTraceProjection,
  buildYearTraceProjection,
  enumerateDateKeys,
  getQuarterBounds,
  getYearBounds,
  hasRangeTraceMarks,
  resolveRangeLensBounds,
} from './buildRangeTraceProjection';

function ts(year: number, month: number, day: number): number {
  return new Date(year, month - 1, day, 12).getTime();
}

function note(
  id: string,
  overrides: Partial<NoteBase> & { createdAt?: number } = {},
): NoteBase {
  const { createdAt, ...rest } = overrides;
  const base: NoteBase = {
    id,
    title: 'Note',
    body: '',
    updatedAt: ts(2026, 6, 11),
    folderId: null,
    deletedAt: null,
    ...rest,
  };
  if (createdAt != null) {
    return { ...base, createdAt } as NoteBase & { createdAt: number };
  }
  return base;
}

describe('buildRangeTraceProjection', () => {
  it('aggregates milestones and events across the range', () => {
    const milestone = applyMilestoneToNote(note('m1', { title: 'K-28 Complete' }), {
      milestoneDate: '2026-06-11',
      milestoneLabel: 'K-28 Complete',
    });
    const event = applyEventToNote(note('e1', { title: 'TOEFL Exam' }), {
      title: 'TOEFL Exam',
      eventDate: '2026-06-15',
    });

    const projection = buildRangeTraceProjection('2026-06-01', '2026-06-30', [milestone, event]);

    expect(projection.startDate).toBe('2026-06-01');
    expect(projection.endDate).toBe('2026-06-30');
    expect(projection.milestones).toHaveLength(1);
    expect(projection.milestones[0]?.label).toBe('K-28 Complete');
    expect(projection.events).toHaveLength(1);
    expect(projection.events[0]?.title).toBe('TOEFL Exam');
    expect(projection.events[0]?.date).toBe('2026-06-15');
  });

  it('counts unique notes touched and created in activity overview', () => {
    const createdA = note('a1', {
      title: 'A',
      createdAt: ts(2026, 6, 3),
      updatedAt: ts(2026, 6, 3),
    });
    const createdB = note('a2', {
      title: 'B',
      createdAt: ts(2026, 6, 10),
      updatedAt: ts(2026, 6, 10),
    });
    const edited = note('a3', {
      title: 'C',
      createdAt: ts(2026, 5, 1),
      updatedAt: ts(2026, 6, 20),
    });
    const outside = note('a4', {
      title: 'D',
      createdAt: ts(2026, 7, 1),
      updatedAt: ts(2026, 7, 1),
    });

    const projection = buildRangeTraceProjection('2026-06-01', '2026-06-30', [createdA, createdB, edited, outside]);

    expect(projection.notesTouched).toBe(3);
    expect(projection.notesCreated).toBe(2);
  });

  it('returns empty sections for a range with no marks', () => {
    const projection = buildRangeTraceProjection('2026-06-01', '2026-06-30', []);

    expect(projection.milestones).toEqual([]);
    expect(projection.events).toEqual([]);
    expect(projection.notesTouched).toBe(0);
    expect(projection.notesCreated).toBe(0);
    expect(hasRangeTraceMarks(projection)).toBe(false);
  });

  it('excludes deleted notes', () => {
    const deleted = applyMilestoneToNote(
      note('m1', { title: 'Hidden', deletedAt: Date.now() }),
      { milestoneDate: '2026-06-11' },
    );

    const projection = buildRangeTraceProjection('2026-06-01', '2026-06-30', [deleted]);
    expect(projection.milestones).toEqual([]);
  });

  it('throws when start date is after end date', () => {
    expect(() => buildRangeTraceProjection('2026-06-30', '2026-06-01', [])).toThrow(/after end date/);
  });

  it('throws when range exceeds maximum days', () => {
    expect(() => enumerateDateKeys('2025-01-01', '2026-06-01')).toThrow(/maximum/);
  });
});

describe('buildMonthTraceProjection', () => {
  it('delegates to range projection for calendar month bounds', () => {
    const bounds = resolveRangeLensBounds({ kind: 'month', year: 2026, month: 6 });
    expect(bounds).toEqual({ startDate: '2026-06-01', endDate: '2026-06-30' });

    const milestone = applyMilestoneToNote(note('m1'), { milestoneDate: '2026-06-11' });
    const projection = buildMonthTraceProjection(2026, 6, [milestone]);
    expect(projection.milestones).toHaveLength(1);
  });

  it('throws on invalid month numbers', () => {
    expect(() => buildMonthTraceProjection(2026, 13, [])).toThrow(/Invalid month/);
  });
});

describe('buildQuarterTraceProjection', () => {
  it('uses calendar quarter bounds', () => {
    expect(getQuarterBounds(2026, 2)).toEqual({
      startDate: '2026-04-01',
      endDate: '2026-06-30',
    });

    const event = applyEventToNote(note('e1', { title: 'Mid Q2' }), {
      title: 'Mid Q2',
      eventDate: '2026-05-10',
    });
    const projection = buildQuarterTraceProjection(2026, 2, [event]);
    expect(projection.events).toHaveLength(1);
    expect(projection.startDate).toBe('2026-04-01');
    expect(projection.endDate).toBe('2026-06-30');
  });
});

describe('buildYearTraceProjection', () => {
  it('uses calendar year bounds', () => {
    expect(getYearBounds(2026)).toEqual({
      startDate: '2026-01-01',
      endDate: '2026-12-31',
    });

    const milestone = applyMilestoneToNote(note('m1'), { milestoneDate: '2026-12-31' });
    const projection = buildYearTraceProjection(2026, [milestone]);
    expect(projection.milestones).toHaveLength(1);
    expect(projection.startDate).toBe('2026-01-01');
    expect(projection.endDate).toBe('2026-12-31');
  });
});
