// @vitest-environment happy-dom
import { act, createElement, memo, useCallback, useMemo, useState, type ComponentType } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { DateTime } from 'luxon';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppSettings, Schedule, Theme } from '../../../../../types';
import type { NoteBase } from '../../../../noteUtils';
import { applyEventToNote } from '../../../knowledge/trace/eventNotes';
import { buildPlannerProjection } from '../../calendar/buildPlannerProjection';
import {
  buildPlannerCalendarProjection,
  formatPlannerCalendarPresentation,
  type PlannerLocale,
} from '../../calendar';
import type { PlannerCalendarProjectionInput } from '../../calendar';
import type { MonthCalendarCellProps } from './MonthCalendarCell';
import { MonthCalendarView } from './MonthCalendarView';

const measurements = vi.hoisted(() => ({ displayModelsBuilt: 0, cellRenders: 0 }));

vi.mock('./monthCalendarPresentation', async importOriginal => {
  const original = await importOriginal<typeof import('./monthCalendarPresentation')>();
  return {
    ...original,
    buildMonthCellDisplayModels: (...args: Parameters<typeof original.buildMonthCellDisplayModels>) => {
      const models = original.buildMonthCellDisplayModels(...args);
      const previousModels = args[3];
      measurements.displayModelsBuilt += previousModels
        ? models.reduce((count, model, index) => count + Number(model !== previousModels[index]), 0)
        : models.length;
      return models;
    },
  };
});

vi.mock('./MonthCalendarCell', async importOriginal => {
  const original = await importOriginal<typeof import('./MonthCalendarCell')>();
  const exported = original.MonthCalendarCell as unknown;
  const isMemoized = typeof exported === 'object'
    && exported !== null
    && '$$typeof' in exported
    && (exported as { $$typeof?: unknown }).$$typeof === Symbol.for('react.memo');
  const renderComponent = (isMemoized
    ? (exported as { type: ComponentType<MonthCalendarCellProps> }).type
    : exported) as ComponentType<MonthCalendarCellProps>;
  const MeasuredMonthCalendarCell = (props: MonthCalendarCellProps) => {
    measurements.cellRenders += 1;
    return createElement(renderComponent, props);
  };

  return {
    ...original,
    MonthCalendarCell: isMemoized ? memo(MeasuredMonthCalendarCell) : MeasuredMonthCalendarCell,
  };
});

vi.mock('@/hooks/useElementVisible', () => ({
  useElementVisible: () => ({ ref: { current: null }, visible: true }),
}));

const NOW = DateTime.fromISO('2027-02-03T12:00:00', { zone: 'Asia/Seoul' });
const TODAY_KEY = '2027-02-03';
const EMPTY_NOTES: readonly NoteBase[] = [];
const EMPTY_BLOCKS: PlannerCalendarProjectionInput['scheduleBlocks'] = [];
const EMPTY_DDAYS: readonly (Schedule & { date: string })[] = [];
const NOOP = () => {};

const theme: Theme = {
  card: 'bg-surface',
  input: 'bg-surface-alt',
  border: 'border-border',
  textMuted: 'text-muted',
  hoverBg: 'hover:bg-surface-alt',
};

const appSettings = (language: PlannerLocale): AppSettings => ({
  darkMode: false,
  defaultCategory: 'Personal',
  defaultColor: 'blue',
  language,
});

interface MeasuredWorkspaceProps {
  notes?: readonly NoteBase[];
  scheduleBlocks?: PlannerCalendarProjectionInput['scheduleBlocks'];
  ddaySchedules?: readonly (Schedule & { date: string })[];
  theme?: Theme;
  language?: PlannerLocale;
  onEventNoteClick?: (noteId: string) => void;
  onScheduleBlockClick?: (scheduleId: string) => void;
}

function MeasuredWorkspace({
  notes = EMPTY_NOTES,
  scheduleBlocks = EMPTY_BLOCKS,
  ddaySchedules = EMPTY_DDAYS,
  theme: activeTheme = theme,
  language = 'en',
  onEventNoteClick = NOOP,
  onScheduleBlockClick = NOOP,
}: MeasuredWorkspaceProps) {
  const [anchorDate, setAnchorDate] = useState(() => DateTime.fromISO(TODAY_KEY));
  const anchorDateKey = anchorDate.toFormat('yyyy-MM-dd');
  const handleDateSelect = useCallback((dateKey: string) => {
    setAnchorDate(DateTime.fromISO(dateKey));
  }, []);
  const calendarProjection = useMemo(() => buildPlannerCalendarProjection({
    notes,
    scheduleBlocks,
    weeklySchedules: [],
    todos: [],
    routines: [],
    anchorDate: anchorDateKey,
    viewMode: 'month',
    now: NOW,
  }), [notes, scheduleBlocks, anchorDate]);
  const presentation = useMemo(
    () => formatPlannerCalendarPresentation(calendarProjection, language),
    [calendarProjection, language],
  );
  const plannerProjection = useMemo(() => buildPlannerProjection({
    calendarProjection,
    presentation,
    todayKey: TODAY_KEY,
    isReviewed: () => false,
    relativeLabel: dateKey => dateKey,
  }), [calendarProjection, presentation]);

  return createElement('div', null,
    createElement('button', {
      type: 'button',
      'data-perf-next-month': true,
      onClick: () => setAnchorDate(current => current.plus({ months: 1 })),
    }, 'Next month'),
    createElement(MonthCalendarView, {
      plannerProjection,
      presentation,
      theme: activeTheme,
      todayKey: TODAY_KEY,
      onDateSelect: handleDateSelect,
      onEventNoteClick,
      scheduleActions: { onView: onScheduleBlockClick },
      ddaySchedules,
      deferMonthGrid: false,
    }),
  );
}

let host: HTMLDivElement;
let root: Root;

function resetMeasurements() {
  measurements.displayModelsBuilt = 0;
  measurements.cellRenders = 0;
}

function takeMeasurements() {
  const result = {
    displayModelsBuilt: measurements.displayModelsBuilt,
    cellRenders: measurements.cellRenders,
  };
  resetMeasurements();
  return result;
}

function visibleCellSignatures() {
  return new Map([...host.querySelectorAll<HTMLElement>('[data-planner-month-cell]')].map(cell => [
    cell.dataset.plannerMonthCell!,
    `${cell.className}|${cell.textContent}|${cell.dataset.plannerMonthCellEmpty}`,
  ]));
}

beforeEach(() => {
  resetMeasurements();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

describe('mounted Schedule month-cell work measurement', () => {
  it('measures the same 42-cell path across selection, support updates, navigation, and source replacement', async () => {
    const oldEventAction = vi.fn();
    const oldBlockAction = vi.fn();
    const baseProps: MeasuredWorkspaceProps = {
      notes: EMPTY_NOTES,
      scheduleBlocks: EMPTY_BLOCKS,
      onEventNoteClick: oldEventAction,
      onScheduleBlockClick: oldBlockAction,
    };

    await act(async () => root.render(createElement(MeasuredWorkspace, baseProps)));
    const initial = takeMeasurements();
    expect(host.querySelectorAll('[data-planner-month-cell]')).toHaveLength(42);

    const dday = {
      id: 'support-dday',
      date: '2027-03-20',
      text: 'Support update',
      start_time: '09:00',
      end_time: '10:00',
      is_dday: true,
      color: 'blue',
      category: 'Personal',
    };
    await act(async () => root.render(createElement(MeasuredWorkspace, { ...baseProps, ddaySchedules: [dday] })));
    const supportUpdate = takeMeasurements();

    const beforeSelection = visibleCellSignatures();
    await act(async () => {
      host.querySelector<HTMLElement>('[data-planner-month-cell="2027-02-04"]')!.click();
    });
    const sameMonthSelection = takeMeasurements();
    const afterSelection = visibleCellSignatures();
    const changedSelectionDates = [...afterSelection]
      .filter(([date, signature]) => beforeSelection.get(date) !== signature)
      .map(([date]) => date);
    expect(host.querySelector('[data-planner-month-cell="2027-02-04"]')?.className).toContain('bg-primary/12');
    expect(host.querySelector('[data-planner-month-cell="2027-02-03"]')?.className).not.toContain('bg-primary/12');

    await act(async () => {
      host.querySelector<HTMLElement>('[data-planner-month-cell="2027-02-04"]')!.click();
    });
    const repeatSelection = takeMeasurements();
    expect(repeatSelection).toEqual({ displayModelsBuilt: 0, cellRenders: 0 });

    await act(async () => host.querySelector<HTMLButtonElement>('[data-perf-next-month]')!.click());
    const monthNavigation = takeMeasurements();
    expect(host.querySelectorAll('[data-planner-month-cell]')).toHaveLength(42);
    expect(host.querySelector('[data-planner-month-cell="2027-03-04"]')).not.toBeNull();

    const beforeSourceReplacement = visibleCellSignatures();
    const eventNote: NoteBase = {
      id: 'event-1',
      title: 'March event',
      body: '',
      updatedAt: 1,
      folderId: null,
      deletedAt: null,
    };
    const noteWithEvent = applyEventToNote(eventNote, { title: 'March event', eventDate: '2027-03-12' });
    const block = {
      id: 'block-1',
      date: '2027-03-13',
      text: 'March block',
      start_time: '09:00',
      end_time: '10:00',
      is_dday: false,
      color: 'blue',
      category: 'Work',
    };
    await act(async () => root.render(createElement(MeasuredWorkspace, {
      ...baseProps,
      ddaySchedules: [dday],
      notes: [noteWithEvent],
      scheduleBlocks: [block],
    })));
    const sourceReplacement = takeMeasurements();
    const afterSourceReplacement = visibleCellSignatures();
    const changedVisibleDates = [...afterSourceReplacement].filter(([date, signature]) => beforeSourceReplacement.get(date) !== signature).map(([date]) => date);
    expect(host.querySelector('[data-planner-month-block="block-1"]')).not.toBeNull();

    const countdownBlock = {
      id: 'countdown-1',
      date: '2027-03-20',
      text: 'Countdown block',
      start_time: '09:00',
      end_time: '10:00',
      is_dday: true,
      color: 'blue',
      category: 'Work',
    };
    await act(async () => root.render(createElement(MeasuredWorkspace, {
      ...baseProps,
      ddaySchedules: [dday],
      notes: [noteWithEvent],
      scheduleBlocks: [block, countdownBlock],
    })));
    const countdownAddition = takeMeasurements();
    expect(host.querySelector('[data-planner-month-countdown="schedule-dday:countdown-1"]')).not.toBeNull();

    const changedNoteWithEvent = applyEventToNote({
      ...eventNote,
      title: 'March event changed',
    }, { title: 'March event changed', eventDate: '2027-03-12' });
    const changedBlock = {
      ...block,
      text: 'March block changed',
      start_time: '10:00',
      category: 'Personal',
      color: 'green',
    };
    await act(async () => root.render(createElement(MeasuredWorkspace, {
      ...baseProps,
      ddaySchedules: [dday],
      notes: [changedNoteWithEvent],
      scheduleBlocks: [changedBlock, countdownBlock],
    })));
    const visibleSourceChange = takeMeasurements();
    expect(host.querySelector('[data-planner-month-event="event-1"]')?.textContent).toContain('March event changed');
    expect(host.querySelector('[data-planner-month-block="block-1"]')?.textContent).toContain('March block changed');

    await act(async () => root.render(createElement(MeasuredWorkspace, {
      ...baseProps,
      ddaySchedules: [dday],
      notes: [changedNoteWithEvent],
      scheduleBlocks: [changedBlock],
    })));
    const countdownChange = takeMeasurements();
    expect(host.querySelector('[data-planner-month-countdown="schedule-dday:countdown-1"]')).toBeNull();

    await act(async () => root.render(createElement(MeasuredWorkspace, {
      ...baseProps,
      ddaySchedules: [dday],
    })));
    const sourceAReplacement = takeMeasurements();
    expect(host.querySelector('[data-planner-month-event="event-1"]')).toBeNull();
    expect(host.querySelector('[data-planner-month-block="block-1"]')).toBeNull();

    console.info('[SCHEDULE-MONTH-CELL-BASELINE]', JSON.stringify({
      initial,
      supportUpdate,
      sameMonthSelection,
      repeatSelection,
      monthNavigation,
      sourceReplacement,
      countdownAddition,
      visibleSourceChange,
      countdownChange,
      sourceAReplacement,
      changedSelectionDates,
      changedVisibleDates,
    }));

    expect(initial).toEqual({ displayModelsBuilt: 42, cellRenders: 42 });
    expect(supportUpdate).toEqual({ displayModelsBuilt: 0, cellRenders: 0 });
    expect(sameMonthSelection).toEqual({ displayModelsBuilt: 2, cellRenders: 2 });
    expect(repeatSelection).toEqual({ displayModelsBuilt: 0, cellRenders: 0 });
    expect(monthNavigation).toEqual({ displayModelsBuilt: 42, cellRenders: 42 });
    expect(sourceReplacement).toEqual({ displayModelsBuilt: 2, cellRenders: 2 });
    expect(countdownAddition).toEqual({ displayModelsBuilt: 1, cellRenders: 1 });
    expect(visibleSourceChange).toEqual({ displayModelsBuilt: 2, cellRenders: 2 });
    expect(countdownChange).toEqual({ displayModelsBuilt: 1, cellRenders: 1 });
    expect(sourceAReplacement).toEqual({ displayModelsBuilt: 2, cellRenders: 2 });
    expect(changedSelectionDates).toEqual(['2027-02-03', '2027-02-04']);
    expect(changedVisibleDates).toEqual(['2027-03-12', '2027-03-13']);
  });

  it('uses current event and block callbacks after their references change', async () => {
    const noteWithEvent = applyEventToNote({
      id: 'event-callback',
      title: 'Event callback',
      body: '',
      updatedAt: 1,
      folderId: null,
      deletedAt: null,
    }, { title: 'Event callback', eventDate: '2027-02-12' });
    const block = {
      id: 'block-callback',
      date: '2027-02-13',
      text: 'Block callback',
      start_time: '09:00',
      end_time: '10:00',
      is_dday: false,
      color: 'blue',
      category: 'Work',
    };
    const staleEventAction = vi.fn();
    const staleBlockAction = vi.fn();
    const currentEventAction = vi.fn();
    const currentBlockAction = vi.fn();
    const notes = [noteWithEvent];
    const scheduleBlocks = [block];

    await act(async () => root.render(createElement(MeasuredWorkspace, {
      notes,
      scheduleBlocks,
      onEventNoteClick: staleEventAction,
      onScheduleBlockClick: staleBlockAction,
    })));
    takeMeasurements();
    await act(async () => root.render(createElement(MeasuredWorkspace, {
      notes,
      scheduleBlocks,
      onEventNoteClick: currentEventAction,
      onScheduleBlockClick: currentBlockAction,
    })));
    const callbackReplacement = takeMeasurements();

    await act(async () => host.querySelector<HTMLElement>('[data-planner-month-event="event-callback"]')!.click());
    await act(async () => host.querySelector<HTMLElement>('[data-planner-month-block="block-callback"]')!.click());

    expect(staleEventAction).not.toHaveBeenCalled();
    expect(staleBlockAction).not.toHaveBeenCalled();
    expect(currentEventAction).toHaveBeenCalledTimes(1);
    expect(currentEventAction).toHaveBeenCalledWith('event-callback');
    expect(currentBlockAction).toHaveBeenCalledTimes(1);
    expect(currentBlockAction).toHaveBeenCalledWith('block-callback');
    expect(callbackReplacement).toEqual({ displayModelsBuilt: 0, cellRenders: 42 });

    const darkTheme = { ...theme, border: 'border-high-contrast' };
    await act(async () => root.render(createElement(MeasuredWorkspace, {
      notes,
      scheduleBlocks,
      theme: darkTheme,
      onEventNoteClick: currentEventAction,
      onScheduleBlockClick: currentBlockAction,
    })));
    const themeUpdate = takeMeasurements();
    expect(host.querySelector('[data-planner-month-cell="2027-02-12"]')?.className).toContain('border-high-contrast');
    expect(themeUpdate).toEqual({ displayModelsBuilt: 0, cellRenders: 42 });

    await act(async () => root.render(createElement(MeasuredWorkspace, {
      notes,
      scheduleBlocks,
      theme: darkTheme,
      language: 'ko',
      onEventNoteClick: currentEventAction,
      onScheduleBlockClick: currentBlockAction,
    })));
    const localeUpdate = takeMeasurements();
    expect(host.querySelector('[data-planner-month-weekday-header="0"]')?.textContent).not.toBe('Sun');
    expect(host.querySelector('[data-planner-month-block="block-callback"]')).not.toBeNull();
    expect(localeUpdate).toEqual({ displayModelsBuilt: 0, cellRenders: 0 });
  });
});
