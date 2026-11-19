// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import type { Theme } from '../../../../../types';
import type { NoteBase } from '../../../../noteUtils';
import { applyEventToNote } from '../../../knowledge/trace/eventNotes';
import { applyMilestoneToNote } from '../../../knowledge/trace/milestoneNotes';
import {
  buildPlannerCalendarProjection,
  formatPlannerCalendarPresentation,
} from '../../calendar';
import { buildPlannerProjection } from '../../calendar/buildPlannerProjection';
import { resolveUpcomingRelativeLabel } from '../agenda/buildUpcomingTierGroups';
import { MonthCalendarView } from './MonthCalendarView';
import {
  buildMonthCellDisplayModel,
  buildMonthCellDisplayModels,
  chunkMonthCells,
  formatMonthOverflowLabel,
  monthGridHasAnchors,
  MONTH_CELL_MAX_VISIBLE_EVENTS,
} from './monthCalendarPresentation';

const theme: Theme = {
  card: 'bg-surface',
  input: 'bg-surface-alt',
  border: 'border-border',
  textMuted: 'text-muted',
  hoverBg: 'hover:bg-surface-alt',
};

const NOW = DateTime.fromISO('2027-02-03T12:00:00', { zone: 'Asia/Seoul' });

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

function buildMonthFixture(
  overrides: Partial<Parameters<typeof buildPlannerCalendarProjection>[0]> = {},
) {
  const projection = buildPlannerCalendarProjection({
    notes: [],
    scheduleBlocks: [],
    weeklySchedules: [],
    todos: [],
    routines: [],
    anchorDate: '2027-02-03',
    viewMode: 'month',
    now: NOW,
    ...overrides,
  });

  return {
    projection,
    month: projection.views.month,
    presentation: formatPlannerCalendarPresentation(projection, 'en'),
  };
}

const MONTH_VIEW_PROPS = {
  todayKey: '2027-02-03',
} as const;

function mockT(key: string): string {
  const labels: Record<string, string> = {
    nvToday: 'Today',
    k101Tomorrow: 'Tomorrow',
    k108InDays: 'In {count} days',
    k108Later: 'Later',
  };
  return labels[key] ?? key;
}

function buildPlannerProjectionFixture(
  overrides: Partial<Parameters<typeof buildPlannerCalendarProjection>[0]> = {},
) {
  const { projection, presentation } = buildMonthFixture(overrides);
  const plannerProjection = buildPlannerProjection({
    calendarProjection: projection,
    presentation,
    todayKey: MONTH_VIEW_PROPS.todayKey,
    isReviewed: () => false,
    relativeLabel: dateKey => resolveUpcomingRelativeLabel(dateKey, MONTH_VIEW_PROPS.todayKey, mockT),
  });
  return { projection, presentation, plannerProjection };
}

describe('monthCalendarPresentation', () => {
  it('chunks month cells into six weeks of seven columns', () => {
    const { month } = buildMonthFixture();
    const weeks = chunkMonthCells(month.cells, 7);

    expect(month.cells).toHaveLength(42);
    expect(weeks).toHaveLength(6);
    expect(weeks.every(week => week.length === 7)).toBe(true);
  });

  it('builds cell display models from projection bundle hints only', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const { month, projection } = buildMonthFixture({ notes: [travel] });
    const startCell = month.cells.find(cell => cell.dateKey === '2027-02-01');
    expect(startCell).toBeDefined();

    const model = buildMonthCellDisplayModel(startCell!);
    const startOccurrence = startCell!.bundle.events.find(event => event.noteId === 'travel');

    expect(model.eventRows).toHaveLength(1);
    expect(model.eventRows[0]?.showTitle).toBe(true);
    expect(model.eventRows[0]?.occurrence.spanPosition).toBe('start');
    expect(startOccurrence?.spanPosition).toBe('start');
    expect(model.overflowCount).toBe(startCell!.bundle.hints.overflowEventCount);
    expect(projection.views.month.cells.length).toBe(42);
  });

  it('hides titles on middle and end span positions', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const { month } = buildMonthFixture({ notes: [travel] });
    const middleCell = month.cells.find(cell => cell.dateKey === '2027-02-03');
    const endCell = month.cells.find(cell => cell.dateKey === '2027-02-05');

    expect(buildMonthCellDisplayModel(middleCell!).eventRows[0]?.showTitle).toBe(false);
    expect(buildMonthCellDisplayModel(endCell!).eventRows[0]?.showTitle).toBe(false);
  });

  it('formats overflow labels from projection overflow counts', () => {
    expect(formatMonthOverflowLabel(0)).toBeNull();
    expect(formatMonthOverflowLabel(1)).toBe('+1 more');
    expect(formatMonthOverflowLabel(3)).toBe('+3 more');
    expect(MONTH_CELL_MAX_VISIBLE_EVENTS).toBe(3);
  });

  it('builds countdowns from note-backed events in projection core', () => {
    const exam = applyEventToNote(note('exam', { title: 'JLPT' }), {
      title: 'JLPT',
      eventDate: '2027-02-20',
    });
    const { projection } = buildMonthFixture({ notes: [exam] });

    const countdown = projection.core.countdowns.find(c => c.title === 'JLPT');
    expect(countdown?.source).toBe('note-event');
    expect(countdown?.targetDate).toBe('2027-02-20');
  });

  it('keeps the first eligible same-date countdown after event-backed exclusions', () => {
    const exam = applyEventToNote(note('exam', { title: 'JLPT' }), {
      title: 'JLPT',
      eventDate: '2027-02-20',
    });
    const { month } = buildMonthFixture({ notes: [exam] });
    const cell = month.cells.find(candidate => candidate.dateKey === '2027-02-20')!;
    const countdowns = [
      { id: 'event-countdown', title: 'JLPT', targetDate: cell.dateKey, daysUntil: 17, source: 'note-event' as const, sourceRefId: 'exam' },
      { id: 'first', title: 'First', targetDate: cell.dateKey, daysUntil: 18, source: 'schedule-dday' as const, sourceRefId: 'block-1' },
      { id: 'duplicate-source', title: 'Duplicate source', targetDate: cell.dateKey, daysUntil: 19, source: 'schedule-dday' as const, sourceRefId: 'block-1' },
    ];

    const single = buildMonthCellDisplayModel(cell, countdowns, days => `D-${days}`);
    const batched = buildMonthCellDisplayModels(month.cells, countdowns, days => `D-${days}`)
      .find(model => model.dateKey === cell.dateKey);

    expect(batched).toEqual(single);
    expect(batched?.countdownRows.map(row => row.countdown.id)).toEqual(['first']);
    expect(batched?.countdownRows[0]?.label).toBe('D-18');
  });

  it('rebuilds date candidates for a navigated month and replacement source', () => {
    const february = buildMonthFixture();
    const march = buildMonthFixture({ anchorDate: '2027-03-03' });
    const countdowns = [
      { id: 'february', title: 'February item', targetDate: '2027-02-03', daysUntil: 0, source: 'schedule-dday' as const, sourceRefId: 'block-feb' },
      { id: 'march', title: 'March item', targetDate: '2027-03-03', daysUntil: 28, source: 'schedule-dday' as const, sourceRefId: 'block-mar' },
    ];

    const februaryModels = buildMonthCellDisplayModels(february.month.cells, countdowns);
    const marchModels = buildMonthCellDisplayModels(march.month.cells, countdowns);
    const februaryAnchor = februaryModels.find(model => model.dateKey === '2027-02-03');
    const marchAnchor = marchModels.find(model => model.dateKey === '2027-03-03');

    expect(februaryModels.map(model => model.dateKey)).toEqual(february.month.cells.map(cell => cell.dateKey));
    expect(marchModels.map(model => model.dateKey)).toEqual(march.month.cells.map(cell => cell.dateKey));
    expect(februaryAnchor?.countdownRows[0]?.countdown.id).toBe('february');
    expect(marchAnchor?.countdownRows[0]?.countdown.id).toBe('march');
    expect(februaryAnchor).toMatchObject({ isToday: true, isAnchorSelected: true });
    expect(marchAnchor).toMatchObject({ isToday: false, isAnchorSelected: true });
  });

  it.each([12, 240])('matches the single-cell output while reducing countdown scans for %i rows', rowCount => {
    const { month } = buildMonthFixture();
    const cellDateKeys = month.cells.map(cell => cell.dateKey);
    const fixture = Array.from({ length: rowCount }, (_, index) => ({
      id: `countdown-${index}`,
      title: `Countdown ${index}`,
      targetDate: index % 4 === 0 ? '2027-03-15' : cellDateKeys[index % cellDateKeys.length]!,
      daysUntil: index,
      source: index % 2 === 0 ? 'note-event' as const : 'schedule-dday' as const,
      sourceRefId: `source-${index}`,
    }));

    const measureReads = () => {
      let targetDateReads = 0;
      let sourceRefIdReads = 0;
      const rows = fixture.map(row => {
        const instrumented = { ...row };
        Object.defineProperties(instrumented, {
          targetDate: {
            enumerable: true,
            get: () => {
              targetDateReads += 1;
              return row.targetDate;
            },
          },
          sourceRefId: {
            enumerable: true,
            get: () => {
              sourceRefIdReads += 1;
              return row.sourceRefId;
            },
          },
        });
        return instrumented;
      });
      return {
        rows,
        targetDateReads: () => targetDateReads,
        sourceRefIdReads: () => sourceRefIdReads,
      };
    };

    const baselineRows = measureReads();
    const baseline = month.cells.map(cell => buildMonthCellDisplayModel(cell, baselineRows.rows));
    const baselineOperations = {
      targetDateReads: baselineRows.targetDateReads(),
      sourceRefIdReads: baselineRows.sourceRefIdReads(),
    };
    const optimizedRows = measureReads();
    const optimized = buildMonthCellDisplayModels(month.cells, optimizedRows.rows);
    const optimizedOperations = {
      targetDateReads: optimizedRows.targetDateReads(),
      sourceRefIdReads: optimizedRows.sourceRefIdReads(),
    };
    const matchingRowCount = fixture.filter(row => cellDateKeys.includes(row.targetDate)).length;

    expect(month.cells).toHaveLength(42);
    expect(optimized).toEqual(baseline);
    expect(baselineOperations.targetDateReads).toBe(42 * rowCount);
    expect(optimizedOperations.targetDateReads).toBe(rowCount);
    expect(baselineOperations.sourceRefIdReads).toBe(matchingRowCount);
    expect(optimizedOperations.sourceRefIdReads).toBe(matchingRowCount);
  });

  it('detects empty months without collapsing grid eligibility', () => {
    const empty = buildMonthFixture();
    expect(monthGridHasAnchors(empty.month.cells)).toBe(false);

    const milestone = applyMilestoneToNote(note('m1', { title: 'Passed' }), {
      milestoneDate: '2027-02-03',
      milestoneLabel: 'Passed',
    });
    const withMilestone = buildMonthFixture({ notes: [milestone] });
    expect(monthGridHasAnchors(withMilestone.month.cells)).toBe(true);
  });
});

describe('MonthCalendarView', () => {
  it('renders a 42-cell month grid from projection.views.month', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const { plannerProjection, presentation } = buildPlannerProjectionFixture({ notes: [travel] });
    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { plannerProjection, presentation, theme, deferMonthGrid: false, ...MONTH_VIEW_PROPS }),
    );

    expect(html).toContain('data-planner-calendar-month');
    expect(html).toContain('data-planner-month-grid');
    expect(html).toContain('data-k133b-schedule-flow');
    expect(html).not.toContain('data-planner-upcoming-agenda');
    expect(html.match(/data-planner-month-cell=/g)?.length).toBe(42);
  });

  it('renders event chips and multi-day span markers', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const { plannerProjection, presentation } = buildPlannerProjectionFixture({ notes: [travel] });
    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { plannerProjection, presentation, theme, deferMonthGrid: false, ...MONTH_VIEW_PROPS }),
    );

    expect(html).toContain('data-planner-month-event="travel"');
    expect(html).toContain('data-planner-month-event-span="start"');
    expect(html).toContain('data-planner-month-event-span="middle"');
    expect(html).toContain('data-planner-month-event-span="end"');
    expect(html).toContain('Travel');
  });

  it('shows overflow indicator when projection hints report hidden events', () => {
    const notes = [
      applyEventToNote(note('e1', { title: 'Exam A' }), {
        title: 'Exam A',
        eventDate: '2027-02-10',
      }),
      applyEventToNote(note('e2', { title: 'Exam B' }), {
        title: 'Exam B',
        eventDate: '2027-02-10',
      }),
      applyEventToNote(note('e3', { title: 'Exam C' }), {
        title: 'Exam C',
        eventDate: '2027-02-10',
      }),
      applyEventToNote(note('e4', { title: 'Exam D' }), {
        title: 'Exam D',
        eventDate: '2027-02-10',
      }),
    ];

    const { projection, presentation, month } = buildMonthFixture({ notes });
    const { plannerProjection } = buildPlannerProjectionFixture({ notes });
    const busyCell = month.cells.find(cell => cell.dateKey === '2027-02-10');
    expect(busyCell?.bundle.hints.overflowEventCount).toBeGreaterThan(0);
    const cellModel = buildMonthCellDisplayModel(busyCell!, projection.core.countdowns);
    expect(cellModel.overflowCount).toBe(busyCell!.bundle.hints.overflowEventCount);

    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { plannerProjection, presentation, theme, deferMonthGrid: false, ...MONTH_VIEW_PROPS }),
    );

    expect(html).toContain('data-planner-month-overflow');
    expect(html).toContain(`+${busyCell!.bundle.hints.overflowEventCount} more`);
  });

  it('exposes date pick controls when onDateSelect is provided', () => {
    const { plannerProjection, presentation } = buildPlannerProjectionFixture();
    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, {
        plannerProjection,
        presentation,
        theme,
        todayKey: MONTH_VIEW_PROPS.todayKey,
        onDateSelect: () => {},
        deferMonthGrid: false,
      }),
    );

    expect(html).toContain('data-planner-month-cell-day');
    expect(html).toContain('role="button"');
  });

  it('keeps the month grid visible when no events exist', () => {
    const { plannerProjection, presentation } = buildPlannerProjectionFixture();
    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { plannerProjection, presentation, theme, deferMonthGrid: false, ...MONTH_VIEW_PROPS }),
    );

    expect(html).not.toContain('data-planner-upcoming-agenda');
    expect(html.match(/data-planner-month-cell=/g)?.length).toBe(42);
  });

  it('renders milestone dots and legacy D-Day badges from projection data', () => {
    const milestone = applyMilestoneToNote(note('m1', { title: 'Passed' }), {
      milestoneDate: '2027-02-03',
      milestoneLabel: 'Passed',
    });

    const { plannerProjection, presentation } = buildPlannerProjectionFixture({
      notes: [milestone],
    });

    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { plannerProjection, presentation, theme, deferMonthGrid: false, ...MONTH_VIEW_PROPS }),
    );

    expect(html).toContain('data-planner-month-milestone-dot');
  });

  it('uses presentation labels for weekday headers without localizing in components', () => {
    const { projection } = buildMonthFixture();
    const en = formatPlannerCalendarPresentation(projection, 'en');
    const ko = formatPlannerCalendarPresentation(projection, 'ko');
    const enPlanner = buildPlannerProjection({
      calendarProjection: projection,
      presentation: en,
      todayKey: MONTH_VIEW_PROPS.todayKey,
      isReviewed: () => false,
      relativeLabel: dateKey => resolveUpcomingRelativeLabel(dateKey, MONTH_VIEW_PROPS.todayKey, mockT),
    });
    const koPlanner = buildPlannerProjection({
      calendarProjection: projection,
      presentation: ko,
      todayKey: MONTH_VIEW_PROPS.todayKey,
      isReviewed: () => false,
      relativeLabel: dateKey => resolveUpcomingRelativeLabel(dateKey, MONTH_VIEW_PROPS.todayKey, mockT),
    });

    const enHtml = renderToStaticMarkup(
      createElement(MonthCalendarView, { plannerProjection: enPlanner, presentation: en, theme, deferMonthGrid: false, ...MONTH_VIEW_PROPS }),
    );
    const koHtml = renderToStaticMarkup(
      createElement(MonthCalendarView, { plannerProjection: koPlanner, presentation: ko, theme, deferMonthGrid: false, ...MONTH_VIEW_PROPS }),
    );

    expect(enHtml).toContain(en.labels.weekdayShortLabels[0]!);
    expect(koHtml).toContain(ko.labels.weekdayShortLabels[0]!);
    expect(en.labels.weekdayShortLabels.length).toBe(7);
    expect(ko.labels.weekdayShortLabels.some(label => label.length > 0)).toBe(true);
  });

  it('renders schedule blocks in month cells and Todos in the mounted today surface', () => {
    const { plannerProjection, presentation } = buildPlannerProjectionFixture({
      scheduleBlocks: [{
        id: 'b1',
        date: '2027-02-03',
        text: 'Deep Work',
        start_time: '10:00',
        end_time: '12:00',
        is_dday: false,
        color: 'purple',
        category: 'Work',
      }],
      todos: [{ id: 't1', date: '2027-02-03', text: 'Pack bag', done: false }],
      routines: [{ id: 'r1', date: '2027-02-03', text: 'Stretch', done: true, is_active: true }],
    });

    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { plannerProjection, presentation, theme, deferMonthGrid: false, ...MONTH_VIEW_PROPS }),
    );

    expect(html).toContain('Deep Work');
    expect(html).toContain('10:00');
    expect(html).toContain('Pack bag');
    expect(html).toContain('data-planner-day-todo="t1"');
    expect(html).not.toContain('data-planner-upcoming-agenda');
    const cellFeb3 = html.slice(
      html.indexOf('data-planner-month-cell="2027-02-03"'),
      html.indexOf('data-planner-month-cell="2027-02-04"'),
    );
    expect(cellFeb3).toContain('Deep Work');
    expect(cellFeb3).not.toContain('Pack bag');
  });
});
