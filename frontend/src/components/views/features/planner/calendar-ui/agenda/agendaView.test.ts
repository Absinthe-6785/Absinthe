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
import {
  agendaHasContent,
  buildAgendaEventSections,
  buildAgendaScheduleSections,
  buildAgendaTodoSections,
  resolveAgendaNoteId,
} from './agendaCalendarPresentation';
import { AgendaCalendarView } from './AgendaCalendarView';

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

function buildAgendaFixture(
  overrides: Partial<Parameters<typeof buildPlannerCalendarProjection>[0]> = {},
) {
  const projection = buildPlannerCalendarProjection({
    notes: [],
    scheduleBlocks: [],
    weeklySchedules: [],
    todos: [],
    routines: [],
    anchorDate: '2027-02-03',
    viewMode: 'agenda',
    now: NOW,
    ...overrides,
  });

  return {
    projection,
    agenda: projection.views.agenda,
    presentation: formatPlannerCalendarPresentation(projection, 'en'),
  };
}

describe('agendaCalendarPresentation', () => {
  it('derives sections from projection.views.agenda only', () => {
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-04',
      eventTime: '09:00',
    });

    const { agenda } = buildAgendaFixture({
      notes: [exam],
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
    });

    expect(buildAgendaEventSections(agenda.dayGroups)).toHaveLength(1);
    expect(buildAgendaScheduleSections(agenda.dayGroups)).toHaveLength(1);
    expect(buildAgendaTodoSections(agenda.dayGroups)).toHaveLength(1);
    expect(agendaHasContent(agenda)).toBe(true);
  });

  it('resolves note ids for note-backed agenda items', () => {
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-10',
    });

    const { agenda } = buildAgendaFixture({ notes: [exam] });
    const eventItem = agenda.dayGroups
      .flatMap(group => group.items)
      .find(item => item.kind === 'timed-event' || item.kind === 'all-day-event');

    expect(eventItem).toBeDefined();
    expect(resolveAgendaNoteId(eventItem!)).toBe('exam');
  });
});

describe('AgendaCalendarView', () => {
  it('renders empty agenda hint when horizon has no items', () => {
    const { projection, presentation } = buildAgendaFixture();
    const html = renderToStaticMarkup(
      createElement(AgendaCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-calendar-agenda');
    expect(html).toContain('data-planner-calendar-agenda-empty-hint="true"');
    expect(html).not.toContain('data-planner-agenda-countdowns');
    expect(html).not.toContain('data-planner-agenda-stream');
  });

  it('renders countdown section from note-backed events', () => {
    const exam = applyEventToNote(note('exam', { title: 'JLPT' }), {
      title: 'JLPT',
      eventDate: '2027-02-20',
    });
    const { projection, presentation } = buildAgendaFixture({ notes: [exam] });

    const html = renderToStaticMarkup(
      createElement(AgendaCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-agenda-countdowns');
    expect(html).toContain('data-planner-agenda-countdown="event:exam"');
    expect(html).toContain('JLPT');
    expect(html).toContain('data-planner-agenda-countdown-label');
  });

  it('renders countdowns and chronological stream including schedules (K-68)', () => {
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-04',
      eventTime: '09:00',
    });
    const milestone = applyMilestoneToNote(note('ms', { title: 'Launch' }), {
      milestoneDate: '2027-02-05',
      milestoneLabel: 'Launch',
    });

    const { projection, presentation } = buildAgendaFixture({
      notes: [exam, milestone],
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
      todos: [{ id: 't1', date: '2027-02-05', text: 'Pack bag', done: true }],
    });

    const html = renderToStaticMarkup(
      createElement(AgendaCalendarView, { projection, presentation, theme }),
    );

    expect(html).toContain('data-planner-agenda-stream');
    expect(html).toContain('data-planner-agenda-stream-kind="timed-event"');
    expect(html).toContain('data-planner-agenda-stream-kind="schedule-block"');
    expect(html).toContain('Deep Work');
    expect(html).toContain('TOEFL');
    expect(html).toContain('data-planner-agenda-countdowns');
    expect(html).not.toContain('data-planner-agenda-events');
  });

  it('wires onEventNoteClick on note-backed event rows', () => {
    const exam = applyEventToNote(note('exam', { title: 'TOEFL' }), {
      title: 'TOEFL',
      eventDate: '2027-02-04',
      eventTime: '09:00',
    });

    const { projection, presentation } = buildAgendaFixture({ notes: [exam] });

    const html = renderToStaticMarkup(
      createElement(AgendaCalendarView, {
        projection,
        presentation,
        theme,
        onEventNoteClick: () => {},
      }),
    );

    expect(html).toContain('data-planner-agenda-stream-item');
    expect(html).toContain('role="button"');
  });

  it('does not mount placeholder markup', () => {
    const exam = applyEventToNote(note('exam', { title: 'JLPT' }), {
      title: 'JLPT',
      eventDate: '2027-02-20',
    });
    const { projection, presentation } = buildAgendaFixture({ notes: [exam] });

    const html = renderToStaticMarkup(
      createElement(AgendaCalendarView, { projection, presentation, theme }),
    );

    expect(html).not.toContain('data-planner-calendar-placeholder');
  });
});
