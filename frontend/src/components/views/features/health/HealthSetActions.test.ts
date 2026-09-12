// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Theme } from '../../../../types';
import { HealthSetActions, type HealthSetActionsProps } from './HealthSetActions';

const theme: Theme = { card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' };
const labels = {
  trigger: 'Set 1 actions', title: 'Set actions', addAssisted: 'Add assisted reps',
  removeAssisted: 'Remove assisted reps', deleteSet: 'Delete set',
};

describe('Health set actions', () => {
  let host: HTMLDivElement;
  let root: Root;

  const render = async (overrides: Partial<HealthSetActionsProps> = {}) => {
    const props: HealthSetActionsProps = {
      setNumber: 1, eligible: true, assistedActive: false, canDelete: true,
      locked: false, isMobile: false, theme, labels,
      onAddAssisted: vi.fn(), onRemoveAssisted: vi.fn(), onDelete: vi.fn(),
      ...overrides,
    };
    await act(async () => root.render(createElement(HealthSetActions, props)));
    return props;
  };

  beforeEach(() => {
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    document.body.innerHTML = '';
  });

  it('uses the set-number footprint and exposes assisted and delete actions', async () => {
    const props = await render();
    const trigger = document.querySelector<HTMLButtonElement>('[data-health-set-actions-trigger]')!;
    expect(trigger.getAttribute('aria-label')).toBe('Set 1 actions');
    await act(async () => trigger.click());
    expect(document.querySelector('[data-health-set-assisted-action="add"]')).not.toBeNull();
    expect(document.querySelector('[data-health-set-delete-action]')).not.toBeNull();
    await act(async () => document.querySelector<HTMLButtonElement>('[data-health-set-assisted-action="add"]')!.click());
    expect(props.onAddAssisted).toHaveBeenCalledTimes(1);
  });

  it('offers removal for an active eligible set and never assistance for cardio', async () => {
    const props = await render({ assistedActive: true, onRemoveAssisted: vi.fn() });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-health-set-actions-trigger]')!.click());
    await act(async () => document.querySelector<HTMLButtonElement>('[data-health-set-assisted-action="remove"]')!.click());
    expect(props.onRemoveAssisted).toHaveBeenCalledTimes(1);

    await render({ eligible: false });
    await act(async () => document.querySelector<HTMLButtonElement>('[data-health-set-actions-trigger]')!.click());
    expect(document.querySelector('[data-health-set-assisted-action]')).toBeNull();
    expect(document.querySelector('[data-health-set-delete-action]')).not.toBeNull();
  });

  it('blocks every mutation when locked', async () => {
    await render({ locked: true });
    const trigger = document.querySelector<HTMLButtonElement>('[data-health-set-actions-trigger]')!;
    expect(trigger.disabled).toBe(true);
    await act(async () => trigger.click());
    expect(document.querySelector('[data-health-set-actions-menu]')).toBeNull();
  });
});
