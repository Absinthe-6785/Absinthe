// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StrengthSet, Theme } from '../../../../types';
import { HealthAssistedRepsInput, type HealthAssistedRepsInputProps } from './HealthAssistedRepsInput';

const theme: Theme = { card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' };
const ordinary: StrengthSet = { type: 'strength', set: 1, kg: 20, reps: 8, done: false };

describe('Health assisted reps input', () => {
  let host: HTMLDivElement;
  let root: Root;

  const render = async (set: StrengthSet, overrides: Partial<HealthAssistedRepsInputProps> = {}) => {
    const props: HealthAssistedRepsInputProps = {
      set,
      inputId: 'assisted-1',
      locked: false,
      theme,
      label: 'Assisted reps',
      compactTemplate: '{unassisted} + {assisted}A',
      invalidMessage: 'Invalid assisted reps',
      onChange: vi.fn(),
      onBlur: vi.fn(),
      ...overrides,
    };
    await act(async () => root.render(createElement(HealthAssistedRepsInput, props)));
    return props;
  };

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  it('keeps the ordinary row compact until the set activates assistance', async () => {
    await render(ordinary);
    expect(host.querySelector('[data-health-assisted-reps]')).toBeNull();

    await render({ ...ordinary, assisted_reps: '' });
    const input = host.querySelector<HTMLInputElement>('input')!;
    expect(input).not.toBeNull();
    expect(input.getAttribute('aria-label')).toBeNull();
    expect(document.querySelector(`label[for="${input.id}"]`)?.textContent).toBe('Assisted reps');
  });

  it('shows the derived split, emits edits, and removes cleared input through blur', async () => {
    const props = await render({ ...ordinary, reps: 12, assisted_reps: 4 });
    expect(host.querySelector('[data-health-assisted-breakdown]')?.textContent).toBe('8 + 4A');
    const input = host.querySelector<HTMLInputElement>('input')!;
    const setInputValue = (value: string) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
      setter?.call(input, value);
    };

    await act(async () => {
      setInputValue('3');
      input.dispatchEvent(new Event('input', { bubbles: true }));
    });
    expect(props.onChange).toHaveBeenCalledWith('3');

    await act(async () => {
      setInputValue('');
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
    expect(props.onBlur).toHaveBeenCalledWith('');
  });

  it('keeps saved assistance visible but non-editable when locked', async () => {
    await render({ ...ordinary, assisted_reps: 2 }, { locked: true });
    expect(host.querySelector<HTMLInputElement>('input')?.disabled).toBe(true);
    expect(host.querySelector('[data-health-assisted-breakdown]')?.textContent).toBe('6 + 2A');
  });

  it('surfaces invalid active values without silently deriving or clamping', async () => {
    await render({ ...ordinary, assisted_reps: 9 });
    expect(host.querySelector<HTMLInputElement>('input')?.getAttribute('aria-invalid')).toBe('true');
    expect(host.querySelector('[role="alert"]')?.textContent).toBe('Invalid assisted reps');
    expect(host.querySelector('[data-health-assisted-breakdown]')).toBeNull();
  });
});
