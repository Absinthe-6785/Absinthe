import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { getProperty, setProperty } from '../properties/noteProperties';
import { EVENT_TYPE_VALUE, TRACE_PROPERTY_KEYS } from './dailyTraceModels';
import {
  applyEventToNote,
  clearEventFromNote,
  eventFormValuesFromNote,
  isEventNote,
  readEventFromNote,
  validateEventForm,
} from './eventNotes';
import { buildDailyTraceProjection } from './buildDailyTraceProjection';

function note(id = 'n1', title = 'TOEFL Exam', overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title,
    body: '',
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

describe('eventNotes', () => {
  it('applyEventToNote sets event properties on a note', () => {
    const result = applyEventToNote(note(), {
      title: 'Nagoya Interview',
      eventDate: '2027-02-15',
      eventTime: '14:30',
    });

    expect(result.title).toBe('Nagoya Interview');
    expect(getProperty(result, TRACE_PROPERTY_KEYS.TYPE)).toBe(EVENT_TYPE_VALUE);
    expect(getProperty(result, TRACE_PROPERTY_KEYS.EVENT_DATE)).toBe('2027-02-15');
    expect(getProperty(result, TRACE_PROPERTY_KEYS.EVENT_TIME)).toBe('14:30');
    expect(isEventNote(result)).toBe(true);
  });

  it('readEventFromNote round-trips applied values', () => {
    const applied = applyEventToNote(note(), {
      title: 'Japan Trip',
      eventDate: '2026-08-01',
      eventEndDate: '2026-08-10',
    });

    expect(readEventFromNote(applied)).toEqual({
      title: 'Japan Trip',
      eventDate: '2026-08-01',
      eventEndDate: '2026-08-10',
    });
  });

  it('clearEventFromNote removes event properties but keeps the note', () => {
    const applied = applyEventToNote(note('n1', 'Draft'), {
      title: 'Published Draft',
      eventDate: '2026-06-11',
    });
    const cleared = clearEventFromNote(applied);

    expect(cleared.title).toBe('Published Draft');
    expect(isEventNote(cleared)).toBe(false);
    expect(getProperty(cleared, TRACE_PROPERTY_KEYS.EVENT_DATE)).toBeUndefined();
  });

  it('validateEventForm rejects missing title and date', () => {
    expect(validateEventForm({ title: '', eventDate: '2026-06-11' })).toMatch(/Title/);
    expect(validateEventForm({ title: 'Exam', eventDate: '' })).toMatch(/Date/);
  });

  it('eventFormValuesFromNote uses defaults for non-event notes', () => {
    const values = eventFormValuesFromNote(note('n1', 'Prep'), '2026-06-11');
    expect(values).toEqual({ title: 'Prep', eventDate: '2026-06-11' });
  });

  it('applied events appear in daily trace projection', () => {
    const eventNote = applyEventToNote(note('e1', 'Nagoya Interview'), {
      title: 'Nagoya Interview',
      eventDate: '2027-02-15',
    });

    const projection = buildDailyTraceProjection('2027-02-15', [eventNote]);
    expect(projection.events).toEqual([{
      noteId: 'e1',
      title: 'Nagoya Interview',
    }]);
  });

  it('cleared events disappear from daily trace projection', () => {
    const cleared = clearEventFromNote(
      applyEventToNote(note('e1', 'Nagoya Interview'), {
        title: 'Nagoya Interview',
        eventDate: '2027-02-15',
      }),
    );

    const projection = buildDailyTraceProjection('2027-02-15', [cleared]);
    expect(projection.events).toEqual([]);
  });

  it('marking an existing note as event preserves body content', () => {
    const existing = note('n1', 'Nagoya Interview Preparation', { body: 'Notes here' });
    const marked = applyEventToNote(existing, {
      title: 'Nagoya Interview Preparation',
      eventDate: '2027-02-15',
    });

    expect(marked.body).toBe('Notes here');
    expect(isEventNote(marked)).toBe(true);
  });

  it('supports converting via setProperty then apply pattern', () => {
    let draft = note('n1', 'Prep note');
    draft = setProperty(draft, 'status', 'active');
    const eventified = applyEventToNote(draft, {
      title: 'Prep note',
      eventDate: '2026-06-11',
    });
    expect(getProperty(eventified, 'status')).toBe('active');
  });
});
