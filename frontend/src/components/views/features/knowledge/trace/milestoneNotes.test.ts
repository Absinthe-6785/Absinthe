import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { getProperty } from '../properties/noteProperties';
import { setProperty } from '../properties/noteProperties';
import { TRACE_PROPERTY_KEYS } from './dailyTraceModels';
import { buildDailyTraceProjection } from './buildDailyTraceProjection';
import {
  applyMilestoneToNote,
  clearMilestoneFromNote,
  isMilestoneNote,
  milestoneFormValuesFromNote,
  readMilestoneFromNote,
  validateMilestoneForm,
} from './milestoneNotes';

function note(id = 'n1', title = 'K-28 Complete', overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title,
    body: 'Implementation notes',
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('milestoneNotes', () => {
  it('applyMilestoneToNote sets milestone properties without changing note title', () => {
    const result = applyMilestoneToNote(note(), {
      milestoneDate: '2026-06-11',
      milestoneLabel: 'K-28 Complete',
    });

    expect(result.title).toBe('K-28 Complete');
    expect(getProperty(result, TRACE_PROPERTY_KEYS.MILESTONE_DATE)).toBe('2026-06-11');
    expect(getProperty(result, TRACE_PROPERTY_KEYS.MILESTONE_LABEL)).toBe('K-28 Complete');
    expect(isMilestoneNote(result)).toBe(true);
  });

  it('readMilestoneFromNote round-trips applied values', () => {
    const applied = applyMilestoneToNote(note(), {
      milestoneDate: '2026-06-11',
    });

    expect(readMilestoneFromNote(applied)).toEqual({
      milestoneDate: '2026-06-11',
    });
  });

  it('clearMilestoneFromNote removes milestone properties but keeps the note', () => {
    const applied = applyMilestoneToNote(note(), {
      milestoneDate: '2026-06-11',
      milestoneLabel: 'K-28 Complete',
    });
    const cleared = clearMilestoneFromNote(applied);

    expect(cleared.title).toBe('K-28 Complete');
    expect(cleared.body).toBe('Implementation notes');
    expect(isMilestoneNote(cleared)).toBe(false);
  });

  it('clearMilestoneFromNote also clears milestoneKind if present', () => {
    let marked = applyMilestoneToNote(note(), { milestoneDate: '2026-06-11' });
    marked = setProperty(marked, TRACE_PROPERTY_KEYS.MILESTONE_KIND, 'complete');
    const cleared = clearMilestoneFromNote(marked);
    expect(getProperty(cleared, TRACE_PROPERTY_KEYS.MILESTONE_KIND)).toBeUndefined();
  });

  it('validateMilestoneForm rejects missing date', () => {
    expect(validateMilestoneForm({ milestoneDate: '' })).toMatch(/Date/);
  });

  it('milestoneFormValuesFromNote uses defaults for non-milestone notes', () => {
    expect(milestoneFormValuesFromNote(note('n1', 'Draft'), '2026-06-11')).toEqual({
      milestoneDate: '2026-06-11',
      milestoneLabel: undefined,
    });
  });

  it('applied milestones appear in daily trace projection', () => {
    const milestoneNote = applyMilestoneToNote(note('m1', 'K-28 Implementation'), {
      milestoneDate: '2026-06-11',
      milestoneLabel: 'K-28 Complete',
    });

    const projection = buildDailyTraceProjection('2026-06-11', [milestoneNote]);
    expect(projection.milestones).toEqual([{
      noteId: 'm1',
      label: 'K-28 Complete',
      kind: '',
      date: '2026-06-11',
    }]);
  });

  it('cleared milestones disappear from daily trace projection', () => {
    const cleared = clearMilestoneFromNote(
      applyMilestoneToNote(note('m1', 'K-28 Complete'), {
        milestoneDate: '2026-06-11',
      }),
    );

    const projection = buildDailyTraceProjection('2026-06-11', [cleared]);
    expect(projection.milestones).toEqual([]);
  });

  it('milestone and event properties can coexist on one note', () => {
    let combined = applyMilestoneToNote(note('n1', 'Interview'), {
      milestoneDate: '2026-06-11',
      milestoneLabel: 'Interview Completed',
    });
    combined = setProperty(combined, 'type', 'event');
    combined = setProperty(combined, 'eventDate', '2026-06-11');

    expect(isMilestoneNote(combined)).toBe(true);
    expect(getProperty(combined, 'type')).toBe('event');
  });
});
