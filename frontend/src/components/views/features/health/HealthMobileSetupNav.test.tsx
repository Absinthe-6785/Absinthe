// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it } from 'vitest';
import { HealthMobileSetupNav, type HealthMobileSurface, type HealthSetupSection } from './HealthMobileSetupNav';
import type { Theme } from '../../../../types';

const theme = {
  input: 'input',
  textMuted: 'muted',
  border: 'border',
} as Theme;

function mount(activeSurface: HealthMobileSurface = 'workout', activeSection: HealthSetupSection = 'routine') {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  let surface = activeSurface;
  let section = activeSection;
  const render = () => act(() => root.render(createElement(HealthMobileSetupNav, {
    activeSurface: surface,
    onSurfaceChange: next => { surface = next; render(); },
    activeSection: section,
    onSectionChange: next => { section = next; render(); },
    theme,
  })));
  render();
  return { host, root };
}

describe('HealthMobileSetupNav', () => {
  it('exposes exactly Workout and Setup as the permanent mobile task tabs', () => {
    const { host, root } = mount();
    expect([...host.querySelectorAll('[data-health-mobile-tab]')].map(node => node.textContent)).toEqual(['Workout', 'Setup']);
    expect(host.querySelector('[data-health-mobile-tab="previous"]')).toBeNull();
    expect(host.querySelector('[data-health-mobile-tab="routine"]')).toBeNull();
    expect(host.querySelector('[data-health-mobile-tab="blocks"]')).toBeNull();
    act(() => root.unmount());
    host.remove();
  });

  it('opens Routine by default and switches between Setup sections', () => {
    const { host, root } = mount('setup');
    expect(host.querySelector('[data-health-setup-section="routine"]')?.getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('[data-health-setup-section="blocks"]')?.getAttribute('aria-selected')).toBe('false');
    act(() => (host.querySelector('[data-health-setup-section="blocks"]') as HTMLButtonElement).click());
    expect(host.querySelector('[data-health-setup-section="blocks"]')?.getAttribute('aria-selected')).toBe('true');
    act(() => root.unmount());
    host.remove();
  });
});
