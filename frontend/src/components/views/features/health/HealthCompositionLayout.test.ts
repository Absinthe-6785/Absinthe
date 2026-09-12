// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  HealthExecutionColumn,
  HealthSetupColumn,
  HealthSupportRegion,
  HealthWorkoutComposition,
} from './HealthCompositionLayout';

describe('UI-06 Health composition primitives', () => {
  it('binds VIS-07 decoration to Health surfaces without taking domain-state authority', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const healthCss = css.match(/\/\* VIS-07[^]*?(?=\/\* VIS-08|$)/)?.[0] ?? '';
    const healthView = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'HealthView.tsx'), 'utf8');
    const library = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'features', 'health', 'HealthBlockLibrary.tsx'), 'utf8');
    const support = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'features', 'health', 'HealthSupportingPanels.tsx'), 'utf8');
    const workoutBlock = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'features', 'health', 'WorkoutBlockCard.tsx'), 'utf8');
    const prBadge = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'features', 'health', 'WorkoutPrBadge.tsx'), 'utf8');
    const protein = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'features', 'health', 'nutrition', 'ProteinTracker.tsx'), 'utf8');

    expect(healthView).toContain('abs-cosmos-health');
    expect(healthView).toContain('abs-cosmos-health-header');
    expect(healthView).toContain('abs-cosmos-health-today');
    expect(healthView).toContain('abs-cosmos-health-setup-surface');
    expect(library).toContain('abs-cosmos-health-setup-surface');
    expect(support).toContain('abs-cosmos-health-support-grid');

    expect(healthCss).toContain('background-color: var(--color-background)');
    expect(healthCss).toContain('background-color: var(--color-surface-elevated)');
    expect(healthCss).toContain('var(--color-selected) 32%');
    expect(healthCss.match(/var\(--cosmos-pale-blue-dot\)/g)).toHaveLength(1);
    expect(healthCss.match(/pointer-events: none/g)?.length).toBeGreaterThanOrEqual(2);
    expect(healthCss).not.toMatch(/animation|requestAnimationFrame|setInterval|setTimeout/);

    expect(workoutBlock).not.toContain('abs-cosmos-health');
    expect(prBadge).not.toContain('abs-cosmos-health');
    expect(protein).not.toContain('abs-cosmos-health');
  });

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
