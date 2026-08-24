// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { isRoutinePresetMenuOutsideTarget } from './routinePresetMenu';

describe('routine preset menu dismissal boundary', () => {
  it('keeps pointer interactions inside the trigger/menu container', () => {
    const container = document.createElement('div');
    const button = document.createElement('button');
    container.append(button);
    document.body.append(container);
    expect(isRoutinePresetMenuOutsideTarget(container, button)).toBe(false);
    expect(isRoutinePresetMenuOutsideTarget(container, document.body)).toBe(true);
    container.remove();
  });

  it('treats an unavailable target as outside without throwing', () => {
    expect(isRoutinePresetMenuOutsideTarget(null, null)).toBe(true);
  });
});
