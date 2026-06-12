import { describe, it, expect } from 'vitest';
import { DateTime } from 'luxon';
import type { NoteBase } from '../../../noteUtils';
import { applyEventToNote } from '../../knowledge/trace/eventNotes';
import { applyMilestoneToNote } from '../../knowledge/trace/milestoneNotes';
import {
  buildPlannerCalendarProjection,
  buildPlannerEventCatalog,
  enumerateClippedDateKeys,
  expandEventOccurrences,
  formatPlannerCalendarPresentation,
  formatPlannerMonthTitle,
  isoWeekBounds,
  monthGridBounds,
  resolvePlannerCalendarRange,
  resolvePlannerIndexRange,
} from './index';

function note(id: string, overrides: Partial<NoteBase> = {}): NoteBase {
  return {
    id,
    title: 'Note',
    body: '',
    updatedAt: Date.now(),
    folderId: null,
    deletedAt: null,
    ...overrides,
  };
}

const NOW = DateTime.fromISO('2027-02-03T12:00:00', { zone: 'Asia/Seoul' });

function baseInput(overrides: Partial<Parameters<typeof buildPlannerCalendarProjection>[0]> = {}) {
  return {
    notes: [],
    scheduleBlocks: [],
    weeklySchedules: [],
    todos: [],
    routines: [],
    legacyDdays: [],
    anchorDate: '2027-02-03',
    viewMode: 'month' as const,
    now: NOW,
    ...overrides,
  };
}

describe('plannerCalendarDateUtils', () => {
  it('resolves month, week, day, and agenda ranges', () => {
    expect(resolvePlannerCalendarRange('day', '2027-02-03')).toEqual({
      startDate: '2027-02-03',
      endDate: '2027-02-03',
    });

    const week = resolvePlannerCalendarRange('week', '2027-02-03');
    expect(week).toEqual({ startDate: '2027-02-01', endDate: '2027-02-07' });
    expect(isoWeekBounds('2027-02-03')).toEqual(week);

    const agenda = resolvePlannerCalendarRange('agenda', '2027-02-03');
    expect(agenda).toEqual({ startDate: '2027-02-03', endDate: '2027-02-16' });

    const month = resolvePlannerCalendarRange('month', '2027-02-03');
    expect(month?.month).toEqual({ year: 2027, month: 2 });
    expect(month?.startDate).toMatch(/^2027-/);
    expect(month?.endDate).toMatch(/^2027-/);
  });

  it('expands clipped multi-day keys for travel spans', () => {
    const keys = enumerateClippedDateKeys(
      '2027-02-01',
      '2027-02-05',
      '2027-02-01',
      '2027-02-05',
    );
    expect(keys).toEqual([
      '2027-02-01',
      '2027-02-02',
      '2027-02-03',
      '2027-02-04',
      '2027-02-05',
    ]);
  });

  it('builds index range as union of all calendar horizons', () => {
    const indexRange = resolvePlannerIndexRange('2027-02-03');
    const month = monthGridBounds('2027-02-03');
    const agenda = resolvePlannerCalendarRange('agenda', '2027-02-03');

    expect(indexRange).not.toBeNull();
    expect(indexRange!.startDate <= month!.startDate).toBe(true);
    expect(indexRange!.endDate >= agenda!.endDate).toBe(true);
  });
});

describe('buildPlannerEventCatalog', () => {
  it('normalizes event notes into definitions', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const catalog = buildPlannerEventCatalog([travel]);
    expect(catalog.definitions).toHaveLength(1);
    expect(catalog.definitions[0]).toMatchObject({
      noteId: 'travel',
      title: 'Travel',
      startDate: '2027-02-01',
      endDate: '2027-02-05',
      isAllDay: true,
    });
  });

  it('expands multi-day events into daily occurrences', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });
    const catalog = buildPlannerEventCatalog([travel]);
    const occurrences = expandEventOccurrences(catalog, {
      startDate: '2027-02-01',
      endDate: '2027-02-05',
    });

    expect(occurrences.map(o => o.dateKey)).toEqual([
      '2027-02-01',
      '2027-02-02',
      '2027-02-03',
      '2027-02-04',
      '2027-02-05',
    ]);
    expect(occurrences[0]?.spanPosition).toBe('start');
    expect(occurrences[2]?.spanPosition).toBe('middle');
    expect(occurrences[4]?.spanPosition).toBe('end');
  });
});

describe('buildPlannerCalendarProjection', () => {
  it('returns stable empty projection for invalid anchor dates', () => {
    const first = buildPlannerCalendarProjection(baseInput({ anchorDate: 'invalid' }));
    const second = buildPlannerCalendarProjection(baseInput({ anchorDate: 'invalid' }));

    expect(first.byDate.size).toBe(0);
    expect(first.core.eventOccurrences).toEqual([]);
    expect(first.meta.range).toEqual({ startDate: 'invalid', endDate: 'invalid' });
    expect(JSON.stringify(first.views)).toBe(JSON.stringify(second.views));
  });

  it('indexes events, blocks, todos, routines, and milestones by date', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });
    const milestone = applyMilestoneToNote(note('m1', { title: 'Passed' }), {
      milestoneDate: '2027-02-03',
      milestoneLabel: 'Passed',
    });

    const projection = buildPlannerCalendarProjection(baseInput({
      viewMode: 'day',
      anchorDate: '2027-02-03',
      notes: [travel, milestone],
      scheduleBlocks: [{
        id: 'b1',
        date: '2027-02-03',
        text: 'English Study',
        start_time: '18:00',
        end_time: '20:00',
        is_dday: false,
        color: 'blue',
        category: 'Study',
      }],
      todos: [{ id: 't1', date: '2027-02-03', text: 'Buy tickets', done: false }],
      routines: [{ id: 'r1', date: '2027-02-03', text: 'Stretch', done: true, is_active: true }],
    }));

    const bundle = projection.byDate.get('2027-02-03');
    expect(bundle?.events.some(event => event.noteId === 'travel')).toBe(true);
    expect(bundle?.milestones).toHaveLength(1);
    expect(bundle?.blocks).toHaveLength(1);
    expect(bundle?.todos).toHaveLength(1);
    expect(bundle?.routines).toHaveLength(1);
    expect(bundle?.hints.blockCount).toBe(1);
    expect(bundle?.hints.eventCount).toBeGreaterThan(0);
  });

  it('materializes month grid cells for month view', () => {
    const projection = buildPlannerCalendarProjection(baseInput({ viewMode: 'month' }));
    expect(projection.views.month.cells.length).toBe(42);
    expect(projection.views.month.year).toBe(2027);
    expect(projection.views.month.month).toBe(2);
    expect(projection.meta.range.startDate).toBe(projection.views.month.gridStartDate);
  });

  it('materializes week columns for week view', () => {
    const projection = buildPlannerCalendarProjection(baseInput({
      viewMode: 'week',
      anchorDate: '2027-02-03',
    }));

    expect(projection.views.week.columns).toHaveLength(7);
    expect(projection.views.week.startDate).toBe('2027-02-01');
    expect(projection.views.week.endDate).toBe('2027-02-07');
  });

  it('builds agenda groups and countdown section', () => {
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-10',
      eventTime: '09:00',
    });

    const projection = buildPlannerCalendarProjection(baseInput({
      viewMode: 'agenda',
      anchorDate: '2027-02-03',
      notes: [exam],
      legacyDdays: [{ id: 'd1', text: 'JLPT', date: '2027-02-20' }],
      scheduleBlocks: [{
        id: 'b1',
        date: '2027-02-04',
        text: 'Deep Work',
        start_time: '10:00',
        end_time: '12:00',
        is_dday: false,
        color: 'purple',
        category: 'Work',
      }],
      todos: [{ id: 't1', date: '2027-02-05', text: 'Pack bag', done: false }],
    }));

    expect(projection.views.agenda.horizon).toEqual({
      startDate: '2027-02-03',
      endDate: '2027-02-16',
    });
    expect(projection.views.agenda.countdownSection.length).toBeGreaterThan(0);
    expect(projection.views.agenda.dayGroups.some(group => group.items.length > 0)).toBe(true);
    expect(
      projection.views.agenda.dayGroups
        .flatMap(group => group.items)
        .some(item => item.kind === 'schedule-block'),
    ).toBe(true);
  });

  it('dedupes legacy D-Day countdowns when an event shares the same date and title', () => {
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-10',
    });

    const projection = buildPlannerCalendarProjection(baseInput({
      viewMode: 'agenda',
      notes: [exam],
      legacyDdays: [{ id: 'd1', text: 'TOEFL', date: '2027-02-10' }],
    }));

    const toeflCountdowns = projection.core.countdowns.filter(row => row.title === 'TOEFL');
    expect(toeflCountdowns).toHaveLength(1);
    expect(toeflCountdowns[0]?.source).toBe('note-event');
  });

  it('includes carry-over blocks on day view from previous day schedules', () => {
    const projection = buildPlannerCalendarProjection(baseInput({
      viewMode: 'day',
      anchorDate: '2027-02-04',
      scheduleBlocks: [{
        id: 'carry',
        date: '2027-02-03',
        text: 'Night work',
        start_time: '23:00',
        end_time: '01:00',
        end_next_day: true,
        is_dday: false,
        color: 'blue',
        category: 'Work',
      }],
    }));

    expect(projection.views.day.timeline.carryOverBlocks).toHaveLength(1);
    expect(projection.views.day.timeline.carryOverBlocks[0]?.id).toBe('carry');
  });

  it('remains locale-free in core projection output', () => {
    const projection = buildPlannerCalendarProjection(baseInput({ viewMode: 'month' }));
    const serialized = JSON.stringify(projection);

    expect(serialized).not.toMatch(/February|2027년|2027年/);
    expect(projection.meta.generatedAt).toMatch(/2027-02-03/);
  });

  it('is deterministic for identical input', () => {
    const input = baseInput({
      notes: [
        applyEventToNote(note('e1', { title: 'Meeting' }), {
          title: 'Meeting',
          eventDate: '2027-02-03',
          eventTime: '14:00',
        }),
      ],
    });

    const first = buildPlannerCalendarProjection(input);
    const second = buildPlannerCalendarProjection(input);

    expect(JSON.stringify(first.core)).toBe(JSON.stringify(second.core));
    expect([...first.byDate.keys()]).toEqual([...second.byDate.keys()]);
  });

  it('reuses provided eventCatalog without rebuilding definitions', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });
    const catalog = buildPlannerEventCatalog([travel]);

    const projection = buildPlannerCalendarProjection(baseInput({
      notes: [travel],
      eventCatalog: catalog,
    }));

    expect(projection.core.eventsByNoteId).toBe(catalog.byNoteId);
  });
});

describe('formatPlannerCalendarPresentation', () => {
  it('localizes labels without mutating projection data', () => {
    const projection = buildPlannerCalendarProjection(baseInput({ viewMode: 'month' }));

    const en = formatPlannerCalendarPresentation(projection, 'en');
    const ko = formatPlannerCalendarPresentation(projection, 'ko');
    const ja = formatPlannerCalendarPresentation(projection, 'ja');

    expect(en.labels.monthTitle).toContain('2027');
    expect(ko.labels.monthTitle).toMatch(/2027/);
    expect(ja.labels.monthTitle).toMatch(/2027/);
    expect(formatPlannerMonthTitle(2027, 2, 'en')).not.toBe(formatPlannerMonthTitle(2027, 2, 'ko'));
  });

  it('formats countdown labels in presentation layer only', () => {
    const projection = buildPlannerCalendarProjection(baseInput({
      viewMode: 'agenda',
      legacyDdays: [{ id: 'd1', text: 'Exam', date: '2027-02-10' }],
    }));

    const presentation = formatPlannerCalendarPresentation(projection, 'en');
    const countdown = projection.core.countdowns[0];
    expect(countdown?.daysUntil).toBe(7);
    expect(presentation.labels.countdownLabels.get(countdown!.id)).toBe('D-7');
  });
});
