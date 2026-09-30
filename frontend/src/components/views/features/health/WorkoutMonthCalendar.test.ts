// @vitest-environment happy-dom
import { createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CompositeWorkoutCalendarActivity } from './workoutCalendarActivity';
import { buildMonthCellDecorations, WorkoutMonthCalendar } from './WorkoutMonthCalendar';

let root: Root | null;
let host: HTMLDivElement;

beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root?.unmount()); root = null; host.remove(); });

describe('Workout month calendar activity', () => {
  it('preserves the legacy Set path and adds present/absent/unknown composite semantics', () => {
    const legacy = buildMonthCellDecorations(2026, 8, [1, 2], [1, 2], new Set(['2026-09-01']));
    expect(legacy.desktop.get(1)).toMatchObject({ hasWorkout: true, activityState: 'present' });
    expect(legacy.desktop.get(2)).toMatchObject({ hasWorkout: false, activityState: 'absent' });
    const composite = { stateForDate: (date: string) => date.endsWith('-01') ? 'present' : 'unknown' } as CompositeWorkoutCalendarActivity;
    const decorated = buildMonthCellDecorations(2026, 8, [1, 2], [1, 2], undefined, composite);
    expect(decorated.desktop.get(1)?.activityState).toBe('present');
    expect(decorated.desktop.get(2)?.activityState).toBe('unknown');
  });

  it('shows a compact incomplete warning, shared retry, and non-color unknown labels', async () => {
    const retry = vi.fn();
    const activity: CompositeWorkoutCalendarActivity = {
      mode: 'composite', phase: 'settled', status: 'partial_data', legacyStatus: 'success', canonicalStatus: 'error',
      monthStart: '2026-09-01', monthEnd: '2026-09-30', knownPresentDates: new Set(['2026-09-01']),
      stateForDate: date => date === '2026-09-01' ? 'present' : 'unknown', onRetry: retry,
    };
    await act(async () => root!.render(createElement(WorkoutMonthCalendar, {
      selectedDate: new Date(2026, 8, 1), currentDate: new Date(2026, 8, 1),
      setCurrentDate: vi.fn(), setSelectedDate: vi.fn(), formatDate: vi.fn(), isToday: () => false,
      theme: { hoverBg: 'hover', input: 'input', textMuted: 'muted', border: 'border' } as never,
      lang: 'en', compositeActivity: activity,
    })));
    expect(host.querySelector('[data-health-calendar-incomplete]')).not.toBeNull();
    const unknownLabels = host.querySelectorAll('span[aria-label]');
    expect(unknownLabels.length).toBeGreaterThan(0);
    expect(unknownLabels[0]?.textContent).toBe('?');
    host.querySelector<HTMLButtonElement>('[data-health-calendar-incomplete] button')!.click();
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
