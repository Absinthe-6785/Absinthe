import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { applyEventToNote } from './eventNotes';
import { applyMilestoneToNote } from './milestoneNotes';
import { buildMonthTraceProjection, hasMonthTraceMarks } from './buildMonthTraceProjection';

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

describe('buildMonthTraceProjection', () => {
  it('aggregates milestones and events across the month', () => {
    const milestone = applyMilestoneToNote(note('m1', { title: 'K-28 Complete' }), {
      milestoneDate: '2026-06-11',
      milestoneLabel: 'K-28 Complete',
    });
    const event = applyEventToNote(note('e1', { title: 'TOEFL Exam' }), {
      title: 'TOEFL Exam',
      eventDate: '2026-06-15',
    });

    const projection = buildMonthTraceProjection(2026, 6, [milestone, event]);

    expect(projection.month).toBe('2026-06');
    expect(projection.milestones).toHaveLength(1);
    expect(projection.milestones[0]?.label).toBe('K-28 Complete');
    expect(projection.events).toHaveLength(1);
    expect(projection.events[0]?.title).toBe('TOEFL Exam');
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

    const projection = buildMonthTraceProjection(2026, 6, [createdA, createdB, edited, outside]);

    expect(projection.activityOverview.notesTouched).toBe(3);
    expect(projection.activityOverview.notesCreated).toBe(2);
  });

  it('returns empty sections for a month with no marks', () => {
    const projection = buildMonthTraceProjection(2026, 6, []);

    expect(projection.milestones).toEqual([]);
    expect(projection.events).toEqual([]);
    expect(projection.activityOverview).toEqual({ notesTouched: 0, notesCreated: 0 });
    expect(hasMonthTraceMarks(projection)).toBe(false);
  });

  it('excludes deleted notes', () => {
    const deleted = applyMilestoneToNote(
      note('m1', { title: 'Hidden', deletedAt: Date.now() }),
      { milestoneDate: '2026-06-11' },
    );

    const projection = buildMonthTraceProjection(2026, 6, [deleted]);
    expect(projection.milestones).toEqual([]);
  });

  it('throws on invalid month numbers', () => {
    expect(() => buildMonthTraceProjection(2026, 13, [])).toThrow(/Invalid month/);
  });
});
