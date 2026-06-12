import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { applyAreaToNote, clearAreaFromNote, isAreaNote, listAreaNotes } from './areaNotes';
import { applyEventToNote } from './eventNotes';
import { applyMilestoneToNote } from './milestoneNotes';
import {
  areaTraceMarkCount,
  buildAreaTraceProjection,
  hasAreaTraceMarks,
} from './buildAreaTraceProjection';

function note(
  id: string,
  overrides: Partial<NoteBase> = {},
): NoteBase {
  return {
    id,
    title: 'Note',
    body: '',
    updatedAt: 1000,
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('areaNotes', () => {
  it('marks and clears area convention on a note', () => {
    const base = note('a1', { title: 'Japanese' });
    const marked = applyAreaToNote(base);
    expect(isAreaNote(marked)).toBe(true);

    const cleared = clearAreaFromNote(marked);
    expect(isAreaNote(cleared)).toBe(false);
  });

  it('lists area notes alphabetically', () => {
    const notes = [
      applyAreaToNote(note('a2', { title: 'TOEFL' })),
      applyAreaToNote(note('a1', { title: 'Japanese' })),
      note('a3', { title: 'Other' }),
    ];

    expect(listAreaNotes(notes).map(n => n.title)).toEqual(['Japanese', 'TOEFL']);
  });
});

describe('buildAreaTraceProjection', () => {
  it('collects linked notes, milestones, and events via backlinks', () => {
    const area = applyAreaToNote(note('area', { title: 'Japanese', updatedAt: 10 }));
    const linked = note('linked', {
      title: 'Anki Deck',
      body: 'Studying [[Japanese]]',
      updatedAt: 2000,
    });
    const milestone = applyMilestoneToNote(
      note('m1', { title: 'N1 Passed', body: 'See [[Japanese]]' }),
      { milestoneDate: '2026-06-11', milestoneLabel: 'N1 Passed' },
    );
    const event = applyEventToNote(
      note('e1', { title: 'JLPT Exam', body: 'Prep [[Japanese]]' }),
      { title: 'JLPT Exam', eventDate: '2026-06-15' },
    );

    const projection = buildAreaTraceProjection('area', [area, linked, milestone, event]);

    expect(projection.areaTitle).toBe('Japanese');
    expect(projection.linkedNotes.map(item => item.noteId)).toEqual(['linked', 'e1', 'm1']);
    expect(projection.milestones).toHaveLength(1);
    expect(projection.milestones[0]?.label).toBe('N1 Passed');
    expect(projection.events).toHaveLength(1);
    expect(projection.events[0]?.title).toBe('JLPT Exam');
    expect(hasAreaTraceMarks(projection)).toBe(true);
    expect(areaTraceMarkCount(projection)).toBe(5);
  });

  it('includes milestones and events on the area note itself', () => {
    const area = applyAreaToNote(
      applyMilestoneToNote(note('area', { title: 'Exercise' }), {
        milestoneDate: '2026-01-01',
        milestoneLabel: 'Started routine',
      }),
    );

    const projection = buildAreaTraceProjection('area', [area]);
    expect(projection.linkedNotes).toEqual([]);
    expect(projection.milestones).toHaveLength(1);
  });

  it('returns empty sections when nothing links to the area', () => {
    const area = applyAreaToNote(note('area', { title: 'Absinthe' }));
    const projection = buildAreaTraceProjection('area', [area]);

    expect(projection.linkedNotes).toEqual([]);
    expect(projection.milestones).toEqual([]);
    expect(projection.events).toEqual([]);
    expect(hasAreaTraceMarks(projection)).toBe(false);
  });

  it('throws when note is not marked as an area', () => {
    expect(() => buildAreaTraceProjection('n1', [note('n1')])).toThrow(/not marked as an area/);
  });

  it('excludes deleted notes from membership', () => {
    const area = applyAreaToNote(note('area', { title: 'Japanese' }));
    const deleted = note('gone', {
      title: 'Hidden',
      body: '[[Japanese]]',
      deletedAt: Date.now(),
    });

    const projection = buildAreaTraceProjection('area', [area, deleted]);
    expect(projection.linkedNotes).toEqual([]);
  });
});
