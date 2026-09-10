// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import {
  HealthExecutionColumn,
  HealthSetupColumn,
  HealthSupportRegion,
  HealthWorkoutComposition,
} from './HealthCompositionLayout';

describe('UI-06 Health composition primitives', () => {
  it('assigns the accepted wide cells without adding compact nested scrolling', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      createElement(
        HealthWorkoutComposition,
        null,
        createElement(HealthExecutionColumn, { showOnCompact: true }, 'Today'),
        createElement(HealthSetupColumn, null, 'Setup'),
        createElement(HealthSupportRegion, { showOnCompact: true }, 'Support'),
      ),
    );

    const composition = host.querySelector('[data-health-composition="workout-first"]');
    const execution = host.querySelector('[data-health-composition-role="execution"]');
    const setup = host.querySelector('[data-health-composition-role="setup"]');
    const support = host.querySelector('[data-health-composition-role="support"]');

    expect(composition?.className).toContain('xl:grid-cols-[minmax(300px,0.34fr)_minmax(0,1fr)]');
    expect(composition?.className).toContain('xl:grid-rows-[minmax(360px,68fr)_minmax(200px,32fr)]');
    expect(execution?.className).toContain('xl:col-start-2');
    expect(execution?.className).toContain('xl:row-start-1');
    expect(setup?.className).toContain('xl:col-start-1');
    expect(setup?.className).toContain('xl:row-span-2');
    expect(support?.className).toContain('xl:row-start-2');
    expect(support?.className).toContain('xl:overflow-y-auto');
    expect(support?.className.split(/\s+/)).not.toContain('overflow-y-auto');
  });

  it('keeps primary and support hidden together while compact setup is selected', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(
      createElement(
        HealthWorkoutComposition,
        null,
        createElement(HealthExecutionColumn, { showOnCompact: false }, 'Today'),
        createElement(HealthSetupColumn, null, 'Setup'),
        createElement(HealthSupportRegion, { showOnCompact: false }, 'Support'),
      ),
    );

    expect(host.querySelector('[data-health-composition-role="execution"]')?.className).toContain('hidden lg:flex');
    expect(host.querySelector('[data-health-composition-role="support"]')?.className).toContain('hidden lg:flex');
  });
});
