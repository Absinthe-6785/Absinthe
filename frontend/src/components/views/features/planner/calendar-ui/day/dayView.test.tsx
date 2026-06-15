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
import { DayCalendarView } from './DayCalendarView';
import {
  buildDayDisplayModel,
  dayHasContent,
  formatDayRoutineSummary,
  formatDayTodoSummary,
} from './dayCalendarPresentation';

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

function buildDayFixture(
  overrides: Partial<Parameters<typeof buildPlannerCalendarProjection>[0]> = {},
) {
  const projection = buildPlannerCalendarProjection({
    notes: [],
    scheduleBlocks: [],
    weeklySchedules: [],
    todos: [],
    routines: [],
    anchorDate: '2027-02-03',
    viewMode: 'day',
    now: NOW,
    ...overrides,
  });

  return {
    projection,
    day: projection.views.day,
    presentation: formatPlannerCalendarPresentation(projection, 'en'),
  };
}

describe('dayCalendarPresentation', () => {
  it('builds display models from projection.views.day only', () => {
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-03',
      eventTime: '09:00',
    });

    const { day } = buildDayFixture({ notes: [exam] });
    const model = buildDayDisplayModel(day);

    expect(model.timedEvents).toHaveLength(1);
    expect(model.timedEvents[0]?.title).toBe('TOEFL');
    expect(model.isToday).toBe(true);
    expect(dayHasContent(day)).toBe(true);
  });

  it('formats routine and todo summaries from bundle lists', () => {
    expect(formatDayRoutineSummary([])).toBeNull();
    expect(formatDayRoutineSummary([
      { id: 'r1', text: 'Stretch', done: true, is_active: true },
      { id: 'r2', text: 'Read', done: false, is_active: true },
    ])).toBe('1/2 routines complete');

    expect(formatDayTodoSummary([
      { id: 't1', text: 'Pack', done: true },
    ])).toBe('1/1 todos done');
  });
});

describe('DayCalendarView', () => {
  it('renders Today dashboard header from presentation labels', () => {
    const { projection, presentation } = buildDayFixture();
    const html = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-calendar-day');
    expect(html).toContain('data-planner-today-dashboard');
    expect(html).toContain('Today');
    expect(html).toContain(presentation.labels.dayHeading);
    expect(html).toContain('data-planner-today-badge');
  });

  it('shows empty hint when the day has no planned items', () => {
    const { projection, presentation } = buildDayFixture();
    const html = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-agenda-empty');
    expect(html).not.toContain('data-planner-day-events');
    expect(html).not.toContain('data-planner-day-schedule-timeline');
  });

  it('renders all-day and timed events in unified agenda', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-03',
      eventEndDate: '2027-02-05',
    });
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-03',
      eventTime: '09:00',
    });

    const { projection, presentation } = buildDayFixture({ notes: [travel, exam] });
    const html = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-unified-agenda');
    expect(html).toContain('data-planner-agenda-event="travel"');
    expect(html).toContain('data-planner-agenda-event="exam"');
    expect(html).toContain('09:00');
    expect(html).toContain('TOEFL');
    expect(html).toContain('Travel');
  });

  it('renders schedule blocks and carry-over blocks in unified agenda', () => {
    const { projection, presentation } = buildDayFixture({
      viewMode: 'day',
      anchorDate: '2027-02-04',
      scheduleBlocks: [
        {
          id: 'today',
          date: '2027-02-04',
          text: 'Deep Work',
          start_time: '10:00',
          end_time: '12:00',
          is_dday: false,
          color: 'purple',
          category: 'Work',
        },
        {
          id: 'carry',
          date: '2027-02-03',
          text: 'Night work',
          start_time: '23:00',
          end_time: '01:00',
          end_next_day: true,
          is_dday: false,
          color: 'blue',
          category: 'Work',
        },
      ],
    });

    const html = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-agenda-block="today"');
    expect(html).toContain('10:00');
    expect(html).toContain('Deep Work');
    expect(html).toContain('data-planner-agenda-block="carry"');
    expect(html).toContain('data-planner-agenda-block-carryover="true"');
    expect(html).toContain('Night work');
  });

  it('does not render legacy template hints in today dashboard (K-79)', () => {
    const { projection, presentation } = buildDayFixture({
      weeklySchedules: [{
        id: 'w1',
        day: 2,
        title: 'Morning Run',
        start_time: '07:00',
        end_time: '08:00',
        color: 'bg-green-500',
      }],
    });

    const html = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation, theme }),
    );

    expect(html).not.toContain('data-planner-day-template-hints');
  });

  it('renders unified agenda without routines or tasks (K-74)', () => {
    const { projection, presentation } = buildDayFixture({
      routines: [
        { id: 'r1', date: '2027-02-03', text: 'Stretch', done: true, is_active: true },
      ],
      todos: [
        { id: 't1', date: '2027-02-03', text: 'Pack bag', done: false },
      ],
    });

    const html = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-unified-agenda');
    expect(html).not.toContain('data-planner-day-routines');
    expect(html).not.toContain('data-planner-day-todos');
  });

  it('includes milestone content via agenda when note is event on day', () => {
    const milestone = applyMilestoneToNote(note('m1', { title: 'Passed' }), {
      milestoneDate: '2027-02-03',
      milestoneLabel: 'Passed',
    });

    const { projection, presentation } = buildDayFixture({ notes: [milestone] });
    const html = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation, theme }),
    );

    expect(html).not.toContain('data-planner-day-milestone-dot');
  });

  it('uses presentation day headings without localizing inside components', () => {
    const { projection } = buildDayFixture();
    const en = formatPlannerCalendarPresentation(projection, 'en');
    const ko = formatPlannerCalendarPresentation(projection, 'ko');

    const enHtml = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation: en, theme }),
    );
    const koHtml = renderToStaticMarkup(
      createElement(DayCalendarView, { projection, presentation: ko, theme }),
    );

    expect(enHtml).toContain(en.labels.dayHeading);
    expect(koHtml).toContain(ko.labels.dayHeading);
    expect(en.labels.dayHeading).not.toBe(ko.labels.dayHeading);
  });
});
