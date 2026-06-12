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
import { MonthCalendarView } from './MonthCalendarView';
import {
  buildMonthCellDisplayModel,
  chunkMonthCells,
  formatMonthOverflowLabel,
  groupLegacyDdayCountdownsByDate,
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
    legacyDdays: [],
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

    const model = buildMonthCellDisplayModel(startCell!, []);
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

    expect(buildMonthCellDisplayModel(middleCell!, []).eventRows[0]?.showTitle).toBe(false);
    expect(buildMonthCellDisplayModel(endCell!, []).eventRows[0]?.showTitle).toBe(false);
  });

  it('formats overflow labels from projection overflow counts', () => {
    expect(formatMonthOverflowLabel(0)).toBeNull();
    expect(formatMonthOverflowLabel(1)).toBe('+1 more');
    expect(formatMonthOverflowLabel(3)).toBe('+3 more');
    expect(MONTH_CELL_MAX_VISIBLE_EVENTS).toBe(2);
  });

  it('groups legacy D-Day countdowns by target date from projection core', () => {
    const { projection } = buildMonthFixture({
      legacyDdays: [{ id: 'd1', text: 'JLPT', date: '2027-02-20' }],
    });

    const grouped = groupLegacyDdayCountdownsByDate(projection.core.countdowns);
    expect(grouped.get('2027-02-20')?.[0]?.source).toBe('legacy-dday');
    expect(grouped.get('2027-02-20')?.[0]?.id).toBe('legacy-dday:d1');
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

    const { projection, presentation } = buildMonthFixture({ notes: [travel] });
    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-calendar-month');
    expect(html).toContain('data-planner-month-grid');
    expect(html.match(/data-planner-month-cell=/g)?.length).toBe(42);
    expect(html).toContain('data-planner-calendar-period-label');
    expect(html).toContain(presentation.labels.monthTitle);
  });

  it('renders event chips and multi-day span markers', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });

    const { projection, presentation } = buildMonthFixture({ notes: [travel] });
    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { projection, presentation, theme }),
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
    ];

    const { projection, presentation, month } = buildMonthFixture({ notes });
    const busyCell = month.cells.find(cell => cell.dateKey === '2027-02-10');
    expect(busyCell?.bundle.hints.overflowEventCount).toBeGreaterThan(0);

    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-month-overflow');
    expect(html).toContain(`+${busyCell!.bundle.hints.overflowEventCount} more`);
  });

  it('keeps the month grid visible when no events exist', () => {
    const { projection, presentation } = buildMonthFixture();
    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-calendar-month-empty-hint="true"');
    expect(html.match(/data-planner-month-cell=/g)?.length).toBe(42);
  });

  it('renders milestone dots and legacy D-Day badges from projection data', () => {
    const milestone = applyMilestoneToNote(note('m1', { title: 'Passed' }), {
      milestoneDate: '2027-02-03',
      milestoneLabel: 'Passed',
    });

    const { projection, presentation } = buildMonthFixture({
      notes: [milestone],
      legacyDdays: [{ id: 'd1', text: 'JLPT', date: '2027-02-20' }],
    });

    const legacyCountdown = projection.core.countdowns.find(
      countdown => countdown.source === 'legacy-dday',
    );
    expect(legacyCountdown?.targetDate).toBe('2027-02-20');

    const html = renderToStaticMarkup(
      createElement(MonthCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-month-milestone-dot');
    expect(html).toContain(`data-planner-month-legacy-dday="${legacyCountdown!.id}"`);
    expect(html).toContain(
      presentation.labels.countdownLabels.get(legacyCountdown!.id) ?? '',
    );
  });

  it('uses presentation labels for weekday headers without localizing in components', () => {
    const { projection } = buildMonthFixture();
    const en = formatPlannerCalendarPresentation(projection, 'en');
    const ko = formatPlannerCalendarPresentation(projection, 'ko');

    const enHtml = renderToStaticMarkup(
      createElement(MonthCalendarView, { projection, presentation: en, theme }),
    );
    const koHtml = renderToStaticMarkup(
      createElement(MonthCalendarView, { projection, presentation: ko, theme }),
    );

    expect(enHtml).toContain(en.labels.monthTitle);
    expect(koHtml).toContain(ko.labels.monthTitle);
    expect(en.labels.weekdayShortLabels.length).toBe(7);
    expect(ko.labels.weekdayShortLabels.some(label => label.length > 0)).toBe(true);
    expect(enHtml).toContain(en.labels.weekdayShortLabels[0]!);
  });

  it('does not render todos, routines, or schedule blocks in month cells', () => {
    const { projection, presentation } = buildMonthFixture({
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
      createElement(MonthCalendarView, { projection, presentation, theme }),
    );

    expect(html).not.toContain('Deep Work');
    expect(html).not.toContain('Pack bag');
    expect(html).not.toContain('Stretch');
  });
});
