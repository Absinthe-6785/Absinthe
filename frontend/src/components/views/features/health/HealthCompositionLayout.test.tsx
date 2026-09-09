// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  HealthExecutionColumn,
  HealthSetupColumn,
  HealthSupportRegion,
  HealthWorkoutComposition,
  resolveHealthCompositionLayout,
} from './HealthCompositionLayout';

function renderPopulatedComposition() {
  const items = (kind: string, count: number) => Array.from(
    { length: count },
    (_, index) => createElement('button', { key: `${kind}-${index}`, type: 'button' }, `${kind} ${index + 1}`),
  );

  return renderToStaticMarkup(
    createElement(
      HealthWorkoutComposition,
      null,
      createElement(
        HealthSetupColumn,
        null,
        createElement('section', { 'data-health-test-region': 'library' },
          createElement('div', { 'data-health-scroll-owner': 'wide-library' }, items('Block', 12))),
        createElement('section', { 'data-health-test-region': 'routine' },
          createElement('div', { 'data-health-scroll-owner': 'wide-routine' }, items('Routine', 7))),
      ),
      createElement(
        HealthExecutionColumn,
        { showOnCompact: true },
        createElement(
          'article',
          { 'data-health-composition-role': 'active-workout', 'data-health-hierarchy-level': 'primary' },
          createElement('header', { 'data-health-test-region': 'session-header' }, 'Today'),
          createElement('div', { 'data-health-scroll-owner': 'wide-active-workout' }, items('Workout set', 16)),
          createElement('footer', { 'data-health-test-region': 'workout-actions' },
            createElement('button', { type: 'button' }, 'Save workout')),
        ),
        createElement(
          HealthSupportRegion,
          null,
          createElement('section', { 'data-health-test-region': 'calendar' }, 'Calendar'),
          createElement('section', { 'data-health-test-region': 'inbody' }, 'InBody'),
          createElement('section', { 'data-health-test-region': 'protein' }, 'Protein'),
        ),
      ),
    ),
  );
}

describe('UI-06 Health composition contract', () => {
  it.each([
    [1024, 'desktop', 'natural-flow', 'health-workspace'],
    [1279, 'desktop', 'natural-flow', 'health-workspace'],
    [1280, 'wide', 'wide-workout-first', 'bounded-regions'],
    [1281, 'wide', 'wide-workout-first', 'bounded-regions'],
  ] as const)('uses the shared responsive authority at %ipx', (width, category, composition, rootScroll) => {
    expect(resolveHealthCompositionLayout(width)).toEqual({ category, composition, rootScroll });
  });

  it('renders workout-first hierarchy with bounded wide owners and a flexible primary column', () => {
    const host = document.createElement('div');
    host.innerHTML = renderPopulatedComposition();

    const composition = host.querySelector('[data-health-composition="workout-first"]');
    const setup = host.querySelector('[data-health-composition-role="setup"]');
    const execution = host.querySelector('[data-health-composition-role="execution"]');
    const active = execution?.querySelector('[data-health-composition-role="active-workout"]');
    const support = execution?.querySelector('[data-health-composition-role="support"]');

    expect(composition?.className).toContain('xl:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]');
    expect(execution?.className).toContain('xl:grid-rows-[minmax(360px,0.68fr)_minmax(200px,0.32fr)]');
    expect(setup?.getAttribute('data-health-hierarchy-level')).toBe('secondary');
    expect(active?.getAttribute('data-health-hierarchy-level')).toBe('primary');
    expect(support?.getAttribute('data-health-hierarchy-level')).toBe('tertiary');
    expect(support?.className).toContain('xl:overflow-y-auto');
    expect(support?.className.split(/\s+/)).not.toContain('overflow-y-auto');
  });

  it('keeps every populated subtask inside its intentional wide owner', () => {
    const host = document.createElement('div');
    host.innerHTML = renderPopulatedComposition();

    const setup = host.querySelector('[data-health-composition-role="setup"]');
    const execution = host.querySelector('[data-health-composition-role="execution"]');
    const library = setup?.querySelector('[data-health-scroll-owner="wide-library"]');
    const routine = setup?.querySelector('[data-health-scroll-owner="wide-routine"]');
    const workout = execution?.querySelector('[data-health-scroll-owner="wide-active-workout"]');
    const support = execution?.querySelector('[data-health-scroll-owner="wide-support"]');

    expect(library?.querySelectorAll('button')).toHaveLength(12);
    expect(routine?.querySelectorAll('button')).toHaveLength(7);
    expect(workout?.querySelectorAll('button')).toHaveLength(16);
    expect(execution?.querySelector('[data-health-test-region="workout-actions"] button')).not.toBeNull();
    expect(support?.querySelector('[data-health-test-region="calendar"]')).not.toBeNull();
    expect(support?.querySelector('[data-health-test-region="inbody"]')).not.toBeNull();
    expect(support?.querySelector('[data-health-test-region="protein"]')).not.toBeNull();
    expect(host.querySelectorAll('[data-health-scroll-owner]')).toHaveLength(4);
  });
});
