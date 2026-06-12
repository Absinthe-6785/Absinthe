import { describe, it, expect } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import { setProperty } from '../properties/noteProperties';
import { buildDailyTraceProjection } from './buildDailyTraceProjection';
import { TRACE_PROPERTY_KEYS } from './dailyTraceModels';

const DAY = '2026-06-11';

function ts(year: number, month: number, day: number, hour = 12, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute).getTime();
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

describe('buildDailyTraceProjection', () => {
  it('returns empty sections for a day with no marks', () => {
    const projection = buildDailyTraceProjection(DAY, []);
    expect(projection).toEqual({
      date: DAY,
      milestones: [],
      events: [],
      activities: [],
    });
  });

  it('throws on invalid date keys', () => {
    expect(() => buildDailyTraceProjection('2026-13-40', [])).toThrow(/Invalid trace date key/);
  });

  it('includes event notes where type=event and eventDate matches', () => {
    const eventNote = setProperty(
      note('e1', { title: 'TOEFL Exam' }),
      TRACE_PROPERTY_KEYS.TYPE,
      'event',
    );
    const withDate = setProperty(eventNote, TRACE_PROPERTY_KEYS.EVENT_DATE, DAY);
    const withTime = setProperty(withDate, TRACE_PROPERTY_KEYS.EVENT_TIME, '14:30');

    const projection = buildDailyTraceProjection(DAY, [withTime]);

    expect(projection.events).toEqual([{
      noteId: 'e1',
      title: 'TOEFL Exam',
      time: '14:30',
    }]);
  });

  it('excludes events when eventDate does not match', () => {
    const eventNote = setProperty(
      note('e1', { title: 'JLPT Exam' }),
      TRACE_PROPERTY_KEYS.TYPE,
      'event',
    );
    const withDate = setProperty(eventNote, TRACE_PROPERTY_KEYS.EVENT_DATE, '2026-06-12');

    const projection = buildDailyTraceProjection(DAY, [withDate]);
    expect(projection.events).toEqual([]);
  });

  it('includes milestones when milestoneDate matches', () => {
    const milestoneNote = setProperty(
      setProperty(
        setProperty(note('m1', { title: 'Novel Draft' }), TRACE_PROPERTY_KEYS.MILESTONE_DATE, DAY),
        TRACE_PROPERTY_KEYS.MILESTONE_KIND,
        'complete',
      ),
      TRACE_PROPERTY_KEYS.MILESTONE_LABEL,
      'Draft v1 shipped',
    );

    const projection = buildDailyTraceProjection(DAY, [milestoneNote]);

    expect(projection.milestones).toEqual([{
      noteId: 'm1',
      label: 'Draft v1 shipped',
      kind: 'complete',
      date: DAY,
    }]);
  });

  it('uses note title when milestoneLabel is absent', () => {
    const milestoneNote = setProperty(
      note('m1', { title: 'Started N1 prep' }),
      TRACE_PROPERTY_KEYS.MILESTONE_DATE,
      DAY,
    );

    const projection = buildDailyTraceProjection(DAY, [milestoneNote]);
    expect(projection.milestones[0]?.label).toBe('Started N1 prep');
  });

  it('records created activity from createdAt on the target day', () => {
    const created = note('a1', {
      title: 'Quick capture',
      createdAt: ts(2026, 6, 11, 9, 15),
      updatedAt: ts(2026, 6, 11, 9, 15),
    });

    const projection = buildDailyTraceProjection(DAY, [created]);

    expect(projection.activities).toEqual([{
      noteId: 'a1',
      title: 'Quick capture',
      kind: 'created',
      at: '09:15',
    }]);
  });

  it('records edited activity when updatedAt matches and created on another day', () => {
    const edited = note('a1', {
      title: 'Japanese Grammar',
      createdAt: ts(2026, 6, 1),
      updatedAt: ts(2026, 6, 11, 16, 40),
    });

    const projection = buildDailyTraceProjection(DAY, [edited]);

    expect(projection.activities).toEqual([{
      noteId: 'a1',
      title: 'Japanese Grammar',
      kind: 'edited',
      at: '16:40',
    }]);
  });

  it('uses traceDate override instead of timestamps for activity day assignment', () => {
    const backdated = setProperty(
      note('a1', {
        title: 'Imported journal',
        updatedAt: ts(2026, 6, 20),
      }),
      TRACE_PROPERTY_KEYS.TRACE_DATE,
      DAY,
    );

    const onUpdateDay = buildDailyTraceProjection('2026-06-20', [backdated]);
    expect(onUpdateDay.activities).toEqual([]);

    const onTraceDay = buildDailyTraceProjection(DAY, [backdated]);
    expect(onTraceDay.activities).toEqual([{
      noteId: 'a1',
      title: 'Imported journal',
      kind: 'edited',
      at: '12:00',
    }]);
  });

  it('excludes deleted notes from all sections', () => {
    const deletedEvent = setProperty(
      setProperty(
        note('e1', { title: 'Trip', deletedAt: Date.now() }),
        TRACE_PROPERTY_KEYS.TYPE,
        'event',
      ),
      TRACE_PROPERTY_KEYS.EVENT_DATE,
      DAY,
    );

    const projection = buildDailyTraceProjection(DAY, [deletedEvent]);
    expect(projection.events).toEqual([]);
    expect(projection.milestones).toEqual([]);
    expect(projection.activities).toEqual([]);
  });

  it('can represent events, milestones, and activities on the same day', () => {
    const eventNote = setProperty(
      setProperty(
        setProperty(
          note('e1', { title: 'Interview', updatedAt: ts(2026, 6, 1) }),
          TRACE_PROPERTY_KEYS.TYPE,
          'event',
        ),
        TRACE_PROPERTY_KEYS.EVENT_DATE,
        DAY,
      ),
      TRACE_PROPERTY_KEYS.EVENT_TIME,
      '10:00',
    );

    const milestoneNote = setProperty(
      setProperty(
        note('m1', { title: 'Absinthe', updatedAt: ts(2026, 6, 1) }),
        TRACE_PROPERTY_KEYS.MILESTONE_DATE,
        DAY,
      ),
      TRACE_PROPERTY_KEYS.MILESTONE_KIND,
      'start',
    );

    const activityNote = note('a1', {
      title: 'Study log',
      createdAt: ts(2026, 6, 11, 20, 0),
      updatedAt: ts(2026, 6, 11, 20, 0),
    });

    const projection = buildDailyTraceProjection(DAY, [eventNote, milestoneNote, activityNote]);

    expect(projection.events).toHaveLength(1);
    expect(projection.milestones).toHaveLength(1);
    expect(projection.activities).toHaveLength(1);
    expect(projection).not.toHaveProperty('sessionSummary');
    expect(projection).not.toHaveProperty('score');
  });
});
