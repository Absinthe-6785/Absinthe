// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { WORKSPACE_SCROLL_MODE } from '../common/workspaceLayout';
import { classifyViewportWidth } from '../../lib/responsiveLayout';
import {
  HealthExecutionColumn,
  HealthSetupColumn,
  HealthSupportRegion,
  HealthWorkoutComposition,
} from './features/health/HealthCompositionLayout';
import { HEALTH_WORKSPACE_SECTIONS } from './features/health/HealthWorkspaceNav';
import { resolvePlannerHierarchyLayout } from './features/planner/calendar-ui/plannerHierarchyLayout';
import { RecipeCompositionLayout } from './features/recipe/components/RecipeCompositionLayout';

type WorkspaceContract = {
  workspace: 'notes' | 'planner' | 'health' | 'recipe' | 'settings';
  sources: readonly string[];
  scrollMode: 'page' | 'pane';
  fullRegionOwnerCount: number;
  majorRegionMarkers: readonly string[];
  breakpointContract: 'shared-768' | 'shared-1024' | 'shared-1280';
};

const WORKSPACE_CONTRACT_MATRIX: readonly WorkspaceContract[] = [
  {
    workspace: 'notes',
    sources: [
      'components/views/NoteView.tsx',
      'components/views/noteview/NoteViewSidebar.tsx',
      'components/views/noteview/NoteViewEditorArea.tsx',
    ],
    scrollMode: 'pane',
    fullRegionOwnerCount: 0,
    majorRegionMarkers: [
      'data-notes-hierarchy="document-first"',
      'data-notes-hierarchy-level="note-navigation"',
      'data-notes-hierarchy-level="document"',
    ],
    breakpointContract: 'shared-768',
  },
  {
    workspace: 'planner',
    sources: [
      'components/views/PlannerView.tsx',
      'components/views/features/planner/calendar-ui/CalendarShell.tsx',
      'components/views/features/planner/calendar-ui/month/MonthCalendarView.tsx',
    ],
    scrollMode: 'pane',
    fullRegionOwnerCount: 0,
    majorRegionMarkers: [
      'data-planner-primary-scroll-owner="calendar-shell"',
      'data-planner-primary-surface="calendar"',
      'data-planner-support-role="today"',
      'data-planner-primary-surface="timetable"',
      'data-planner-support-role="dday"',
    ],
    breakpointContract: 'shared-1024',
  },
  {
    workspace: 'health',
    sources: [
      'components/views/HealthView.tsx',
      'components/views/features/health/HealthCompositionLayout.tsx',
      'components/views/features/health/HealthBlockLibrary.tsx',
    ],
    scrollMode: 'pane',
    fullRegionOwnerCount: 0,
    majorRegionMarkers: [
      'data-health-composition="workout-first"',
      'data-health-composition-role="execution"',
      'data-health-composition-role="setup"',
      'data-health-composition-role="support"',
      'data-k136b-health-library-scroll',
    ],
    breakpointContract: 'shared-1280',
  },
  {
    workspace: 'recipe',
    sources: [
      'components/views/features/recipe/components/RecipeCompositionLayout.tsx',
      'components/views/features/recipe/components/RecipeListParts.tsx',
    ],
    scrollMode: 'pane',
    fullRegionOwnerCount: 0,
    majorRegionMarkers: [
      'data-recipe-composition="list-first"',
      'data-recipe-composition-role="primary-list"',
      'data-recipe-composition-role="support"',
      'data-recipe-list-tail-reachable',
    ],
    breakpointContract: 'shared-1280',
  },
  {
    workspace: 'settings',
    sources: ['components/views/SettingsView.tsx'],
    scrollMode: 'page',
    fullRegionOwnerCount: 1,
    majorRegionMarkers: [
      'data-settings-section="general"',
      'data-settings-section="data-safety"',
      'data-settings-section="danger"',
      'data-settings-reset-action',
      'data-settings-sign-out-action',
    ],
    breakpointContract: 'shared-768',
  },
] as const;

function readProductionSources(contract: WorkspaceContract): string {
  return contract.sources
    .map(source => readFileSync(join(process.cwd(), 'src', source), 'utf8'))
    .join('\n');
}

function count(source: string, value: string): number {
  return source.split(value).length - 1;
}

function render(element: ReactElement): HTMLElement {
  const host = document.createElement('div');
  host.innerHTML = renderToStaticMarkup(element);
  return host;
}

describe('UI-09 rendered composition contract matrix', () => {
  it('keeps every major workspace on one declared root scroll model', () => {
    expect(WORKSPACE_CONTRACT_MATRIX.map(contract => contract.workspace)).toEqual([
      'notes',
      'planner',
      'health',
      'recipe',
      'settings',
    ]);

    for (const contract of WORKSPACE_CONTRACT_MATRIX) {
      const source = readProductionSources(contract);
      expect(count(source, `data-workspace="${contract.workspace}"`), contract.workspace).toBe(1);
      expect(
        count(source, `data-workspace-scroll-mode={WORKSPACE_SCROLL_MODE.${contract.scrollMode}}`),
        contract.workspace,
      ).toBe(1);
      expect(count(source, 'data-workspace-scroll-owner="page"'), contract.workspace)
        .toBe(contract.fullRegionOwnerCount);

      for (const marker of contract.majorRegionMarkers) {
        expect(source, `${contract.workspace}: ${marker}`).toContain(marker);
      }
    }
  });

  it('distinguishes bounded Health and Recipe pane owners from a page-level owner', () => {
    const health = render(createElement(
      HealthWorkoutComposition,
      null,
      createElement(HealthExecutionColumn, { showOnCompact: true }, 'Today'),
      createElement(HealthSetupColumn, null, 'Library and routine'),
      createElement(HealthSupportRegion, { showOnCompact: true }, 'Calendar, InBody, and Protein'),
    ));
    const healthComposition = health.querySelector('[data-health-composition="workout-first"]')!;
    const healthRoles = Array.from(healthComposition.children, child => (
      child.getAttribute('data-health-composition-role')
    ));

    expect(healthRoles).toEqual(['execution', 'setup', 'support']);
    expect(health.querySelectorAll('[data-workspace-scroll-owner="page"]')).toHaveLength(0);
    expect(health.querySelector('[data-health-scroll-owner="wide-support"]')).not.toBeNull();
    expect(health.querySelector('[data-health-scroll-owner="wide-support"]')?.className)
      .toContain('xl:overflow-y-auto');

    const recipe = render(createElement(RecipeCompositionLayout, {
      header: createElement('h1', null, 'Recipes'),
      primary: createElement('div', null, 'Recipe list'),
      supporting: createElement('div', null, 'Recipe support'),
    }));
    const recipeRoot = recipe.querySelector('[data-workspace="recipe"]')!;
    const recipeContent = recipeRoot.querySelector('[data-recipe-composition-content]')!;
    const recipePrimary = recipeRoot.querySelector('[data-recipe-composition-role="primary-list"]')!;
    const recipeSupport = recipeRoot.querySelector('[data-recipe-composition-role="support"]')!;

    expect(recipeRoot.getAttribute('data-workspace-scroll-mode')).toBe(WORKSPACE_SCROLL_MODE.pane);
    expect(recipeRoot.querySelectorAll('[data-workspace-scroll-owner="page"]')).toHaveLength(0);
    expect(recipeContent.getAttribute('data-recipe-scroll-owner-pre-wide')).toBe('workspace');
    expect(recipePrimary.compareDocumentPosition(recipeSupport) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(recipeSupport.querySelector('[data-recipe-scroll-owner-wide="support"]')).not.toBeNull();
  });

  it('binds the 768 and 1279/1280 seams to shared authority without hierarchy drift', () => {
    expect([767, 768, 1279, 1280].map(classifyViewportWidth)).toEqual([
      'mobile',
      'tablet',
      'desktop',
      'wide',
    ]);

    const beforeWide = resolvePlannerHierarchyLayout(1279);
    const atWide = resolvePlannerHierarchyLayout(1280);
    expect(beforeWide.composition).toBe('planning-column-support-rail');
    expect(atWide.composition).toBe(beforeWide.composition);
    expect(atWide.rootScroll).toBe(beforeWide.rootScroll);
    expect(atWide.order).toEqual(beforeWide.order);

    const health = render(createElement(HealthWorkoutComposition, null, 'Health'))
      .querySelector('[data-health-composition]')!;
    expect(health.className).toContain('xl:grid');
    expect(health.className).toContain('xl:overflow-hidden');

    const recipe = render(createElement(RecipeCompositionLayout, {
      header: 'Header',
      primary: 'List',
      supporting: 'Support',
    })).querySelector('[data-recipe-composition-content]')!;
    expect(recipe.className).toContain('overflow-y-auto');
    expect(recipe.className).toContain('xl:flex-row');
    expect(recipe.className).toContain('xl:overflow-hidden');

    expect(WORKSPACE_CONTRACT_MATRIX.map(contract => contract.breakpointContract)).toEqual([
      'shared-768',
      'shared-1024',
      'shared-1280',
      'shared-1280',
      'shared-768',
    ]);
  });

  it('keeps the accepted Health Overview removals and current navigation authority', () => {
    const healthSource = readProductionSources(
      WORKSPACE_CONTRACT_MATRIX.find(contract => contract.workspace === 'health')!,
    );

    expect(HEALTH_WORKSPACE_SECTIONS.map(section => section.id)).toEqual(['workout', 'nutrition']);
    expect(healthSource).not.toContain('<HealthConnectionsPanel');
    expect(healthSource).not.toContain('<HealthAnalyticsPanel');
    expect(healthSource).not.toContain("healthSection === 'analysis'");
  });
});
