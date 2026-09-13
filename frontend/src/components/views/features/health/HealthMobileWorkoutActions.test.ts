// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { HealthMobileWorkoutActions } from './HealthMobileWorkoutActions';

describe('HealthMobileWorkoutActions', () => {
  it('keeps Previous available and hides Add Exercise for a locked mobile Workout', () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    let previousOpened = false;

    act(() => root.render(createElement(HealthMobileWorkoutActions, {
      isMobile: true,
      isDesktopPrevious: false,
      isWorkoutLocked: true,
      previousLabel: 'Previous Workout',
      addExerciseLabel: 'Add Exercise',
      theme: { border: 'border', textMuted: 'muted' },
      onPrevious: () => { previousOpened = true; },
      onAddExercise: () => undefined,
    })));

    const previous = host.querySelector('[data-health-previous-trigger]') as HTMLButtonElement | null;
    expect(previous).not.toBeNull();
    expect(host.querySelector('[data-health-quick-add-exercise]')).toBeNull();

    act(() => previous?.click());
    expect(previousOpened).toBe(true);

    act(() => root.unmount());
    host.remove();
  });
});
