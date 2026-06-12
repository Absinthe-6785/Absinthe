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
import { WeekCalendarView } from './WeekCalendarView';
import {
  buildWeekDayDisplayModel,
  buildWeekDayDisplayModels,
  formatWeekRoutineSummary,
  weekHasContent,
} from './weekCalendarPresentation';

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

function buildWeekFixture(
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
    viewMode: 'week',
    now: NOW,
    ...overrides,
  });

  return {
    projection,
    week: projection.views.week,
    presentation: formatPlannerCalendarPresentation(projection, 'en'),
  };
}

describe('weekCalendarPresentation', () => {
  it('builds day display models from projection week columns only', () => {
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-03',
      eventTime: '09:00',
    });

    const { week, projection, presentation } = buildWeekFixture({ notes: [exam] });
    const wednesday = week.columns.find(column => column.dateKey === '2027-02-03');
    expect(wednesday).toBeDefined();

    const model = buildWeekDayDisplayModel(
      wednesday!,
      presentation.labels.weekdayShortLabels[wednesday!.bundle.weekday]!,
      projection.meta.generatedAt.slice(0, 10),
      projection.meta.anchorDate,
    );

    expect(model.timedEvents).toHaveLength(1);
    expect(model.timedEvents[0]?.title).toBe('TOEFL');
    expect(model.isToday).toBe(true);
    expect(model.isAnchorDate).toBe(true);
  });

  it('formats routine summaries from column payload', () => {
    expect(formatWeekRoutineSummary(null)).toBeNull();
    expect(formatWeekRoutineSummary({ done: 2, total: 5 })).toBe('2/5 routines');
  });

  it('detects week content without scanning notes', () => {
    const empty = buildWeekFixture();
    expect(weekHasContent(empty.week.columns)).toBe(false);

    const withBlock = buildWeekFixture({
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
    });
    expect(weekHasContent(withBlock.week.columns)).toBe(true);
  });
});

describe('WeekCalendarView', () => {
  it('renders seven day columns from projection.views.week', () => {
    const { projection, presentation } = buildWeekFixture();
    const html = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-calendar-week');
    expect(html).toContain('data-planner-week-columns');
    expect(html.match(/data-planner-week-day=/g)?.length).toBe(7);
    expect(html).toContain('data-planner-calendar-period-label');
    expect(html).toContain(presentation.labels.weekRangeLabel);
  });

  it('renders all-day and timed events from week columns', () => {
    const travel = applyEventToNote(note('travel', { title: 'Travel' }), {
      title: 'Travel',
      eventDate: '2027-02-01',
      eventEndDate: '2027-02-05',
    });
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-03',
      eventTime: '09:00',
    });

    const { projection, presentation } = buildWeekFixture({ notes: [travel, exam] });
    const html = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-week-event="travel"');
    expect(html).toContain('data-planner-week-event-kind="all-day"');
    expect(html).toContain('data-planner-week-event="exam"');
    expect(html).toContain('data-planner-week-event-kind="timed"');
    expect(html).toContain('09:00 TOEFL');
    expect(html).toContain('Travel');
  });

  it('renders schedule blocks from week columns', () => {
    const { projection, presentation } = buildWeekFixture({
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
    });

    const html = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-week-block="b1"');
    expect(html).toContain('18:00–20:00 English Study');
  });

  it('renders weekly template hints from week columns', () => {
    const { projection, presentation } = buildWeekFixture({
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
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-week-template="w1"');
    expect(html).toContain('07:00–08:00 Morning Run');
  });

  it('renders routine summaries from week columns', () => {
    const { projection, presentation } = buildWeekFixture({
      routines: [
        { id: 'r1', date: '2027-02-03', text: 'Stretch', done: true, is_active: true },
        { id: 'r2', date: '2027-02-03', text: 'Read', done: false, is_active: true },
      ],
    });

    const html = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-week-routines');
    expect(html).toContain('1/2 routines');
  });

  it('keeps the week grid visible when empty', () => {
    const { projection, presentation } = buildWeekFixture();
    const html = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-calendar-week-empty-hint="true"');
    expect(html.match(/data-planner-week-day=/g)?.length).toBe(7);
  });

  it('uses stacked-mobile and grid-desktop layout markers', () => {
    const { projection, presentation } = buildWeekFixture();
    const html = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-week-columns-layout="stacked-mobile-grid-desktop"');
    expect(html).toContain('grid-cols-1 lg:grid-cols-7');
  });

  it('uses presentation labels without localizing inside components', () => {
    const { projection } = buildWeekFixture();
    const en = formatPlannerCalendarPresentation(projection, 'en');
    const ko = formatPlannerCalendarPresentation(projection, 'ko');

    const enHtml = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation: en, theme }),
    );
    const koHtml = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation: ko, theme }),
    );

    expect(enHtml).toContain(en.labels.weekRangeLabel);
    expect(koHtml).toContain(ko.labels.weekRangeLabel);
    expect(en.labels.weekRangeLabel).not.toBe(ko.labels.weekRangeLabel);

    const models = buildWeekDayDisplayModels(
      projection.views.week,
      en.labels.weekdayShortLabels,
      projection.meta.generatedAt.slice(0, 10),
      projection.meta.anchorDate,
    );
    expect(enHtml).toContain(models[0]?.weekdayLabel ?? '');
  });

  it('shows milestone dots without dominating the column', () => {
    const milestone = applyMilestoneToNote(note('m1', { title: 'Passed' }), {
      milestoneDate: '2027-02-03',
      milestoneLabel: 'Passed',
    });

    const { projection, presentation } = buildWeekFixture({ notes: [milestone] });
    const html = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-week-milestone-dot');
    expect(html).not.toContain('Passed');
  });

  it('does not render todos in week columns', () => {
    const { projection, presentation } = buildWeekFixture({
      todos: [{ id: 't1', date: '2027-02-03', text: 'Pack bag', done: false }],
    });

    const html = renderToStaticMarkup(
      createElement(WeekCalendarView, { projection, presentation, theme }),
    );

    expect(html).not.toContain('Pack bag');
  });
});
