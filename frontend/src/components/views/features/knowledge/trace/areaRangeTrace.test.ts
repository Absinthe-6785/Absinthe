import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { applyAreaToNote } from './areaNotes';
import { applyEventToNote } from './eventNotes';
import { applyMilestoneToNote } from './milestoneNotes';
import {
  areaRangeTraceMarkCount,
  buildAreaRangeTraceProjection,
  hasAreaRangeTraceMarks,
} from './buildAreaRangeTraceProjection';

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

describe('buildAreaRangeTraceProjection', () => {
  it('scopes milestones, events, and activity to area members within the range', () => {
    const area = applyAreaToNote(note('area', { title: 'Japanese' }));
    const inRange = note('grammar', {
      title: 'Grammar',
      body: 'See [[Japanese]]',
      createdAt: ts(2026, 2, 10),
      updatedAt: ts(2026, 2, 10),
    });
    const outOfRange = note('reading', {
      title: 'Reading',
      body: 'See [[Japanese]]',
      createdAt: ts(2026, 5, 1),
      updatedAt: ts(2026, 5, 1),
    });
    const milestone = applyMilestoneToNote(
      note('m1', { title: 'JLPT N1', body: '[[Japanese]]' }),
      { milestoneDate: '2026-02-15', milestoneLabel: 'JLPT N1' },
    );
    const event = applyEventToNote(
      note('e1', { title: 'JLPT Exam', body: '[[Japanese]]' }),
      { title: 'JLPT Exam', eventDate: '2026-03-01' },
    );

    const projection = buildAreaRangeTraceProjection(
      'area',
      '2026-01-01',
      '2026-03-31',
      [area, inRange, outOfRange, milestone, event],
    );

    expect(projection.areaTitle).toBe('Japanese');
    expect(projection.startDate).toBe('2026-01-01');
    expect(projection.endDate).toBe('2026-03-31');
    expect(projection.milestones).toHaveLength(1);
    expect(projection.milestones[0]?.label).toBe('JLPT N1');
    expect(projection.events).toHaveLength(1);
    expect(projection.events[0]?.title).toBe('JLPT Exam');
    expect(projection.notesTouched).toBe(1);
    expect(projection.notesCreated).toBe(1);
    expect(projection.linkedNotes.map(item => item.noteId)).toEqual(['e1', 'm1', 'grammar']);
    expect(hasAreaRangeTraceMarks(projection)).toBe(true);
    expect(areaRangeTraceMarkCount(projection)).toBe(5);
  });

  it('excludes non-member notes even when they have marks in the range', () => {
    const area = applyAreaToNote(note('area', { title: 'Japanese' }));
    const outsider = applyEventToNote(note('other', { title: 'Other Exam' }), {
      title: 'Other Exam',
      eventDate: '2026-02-01',
    });

    const projection = buildAreaRangeTraceProjection(
      'area',
      '2026-01-01',
      '2026-03-31',
      [area, outsider],
    );

    expect(projection.events).toEqual([]);
    expect(projection.linkedNotes).toEqual([]);
    expect(projection.notesTouched).toBe(0);
  });

  it('returns empty sections when no member marks occur in the range', () => {
    const area = applyAreaToNote(note('area', { title: 'Absinthe', updatedAt: ts(2026, 1, 1) }));
    const linked = note('doc', { title: 'Doc', body: '[[Absinthe]]', updatedAt: ts(2026, 1, 1) });

    const projection = buildAreaRangeTraceProjection(
      'area',
      '2026-06-01',
      '2026-06-30',
      [area, linked],
    );

    expect(projection.milestones).toEqual([]);
    expect(projection.events).toEqual([]);
    expect(projection.linkedNotes).toEqual([]);
    expect(hasAreaRangeTraceMarks(projection)).toBe(false);
  });
});
