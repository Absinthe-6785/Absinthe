// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DateTime } from 'luxon';
import { describe, expect, it, vi } from 'vitest';

import { WORKSPACE_SCROLL_MODE } from '../common/workspaceLayout';
import { classifyViewportWidth } from '../../lib/responsiveLayout';
import type { AppSettings, HealthProps, PlannerProps, Theme } from '../../types';
import { NoteView } from './NoteView';
import { PlannerView } from './PlannerView';
import { HealthView } from './HealthView';
import { SettingsView } from './SettingsView';
import { HEALTH_WORKSPACE_SECTIONS } from './features/health/HealthWorkspaceNav';
import { resolvePlannerHierarchyLayout } from './features/planner/calendar-ui/plannerHierarchyLayout';
import {
  RecipeStudioView,
  type RecipeStudioViewProps,
} from './features/recipe/components/RecipeStudioView';
import type { RecipeProjection } from './features/recipe/recipeProjectionModels';

vi.mock('../../hooks/useElementVisible', () => ({
  useElementVisible: () => ({ ref: { current: null }, visible: true }),
}));

type WorkspaceContract = {
  workspace: 'notes' | 'planner' | 'health' | 'recipe' | 'settings';
  sources: readonly string[];
  scrollMode: 'page' | 'pane';
  fullRegionOwnerCount: number;
  majorRegionMarkers: readonly string[];
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
  },
] as const;

const date = new Date('2026-01-10T00:00:00.000Z');
const now = DateTime.fromJSDate(date);
const appSettings: AppSettings = {
  darkMode: false,
  defaultCategory: 'Personal',
  defaultColor: 'blue',
  language: 'en',
};
const theme: Theme = {
  card: 'bg-surface',
  input: 'bg-surface-alt',
  border: 'border-border',
  text: 'text-foreground',
  textMuted: 'text-muted',
  hoverBg: 'hover:bg-surface-alt',
};
const themeColors = [{
  id: 'blue',
  bg: 'bg-blue-500',
  text: 'text-white',
  border: 'border-blue-500',
}];
const formatDate = (value: Date | DateTime): string => (
  (value instanceof Date ? value : value.toJSDate()).toISOString().slice(0, 10)
);

const plannerProps: PlannerProps = {
  now,
  currentDate: date,
  setCurrentDate: vi.fn(),
  selectedDate: date,
  setSelectedDate: vi.fn(),
  formatDate,
  isToday: () => true,
  schedules: [],
  todos: [],
  routines: [],
  markedDates: [],
  weeklySchedules: [],
  showToast: vi.fn(),
  appSettings,
  updateSetting: vi.fn(),
  theme,
  THEME_COLORS: themeColors,
  mutateDaily: vi.fn(),
  mutateStatic: vi.fn(),
  mutateTodos: vi.fn(),
  mutateRoutines: vi.fn(),
  user: { id: 'ui09-planner', name: 'UI-09 Planner' },
};

const healthProps: HealthProps = {
  now,
  currentDate: date,
  setCurrentDate: vi.fn(),
  selectedDate: date,
  setSelectedDate: vi.fn(),
  formatDate,
  isToday: () => true,
  showToast: vi.fn(),
  appSettings,
  updateSetting: vi.fn(),
  theme,
  THEME_COLORS: themeColors,
  mutateDaily: vi.fn(),
  mutateStatic: vi.fn(),
  user: { id: 'ui09-health', name: 'UI-09 Health' },
  schedules: [],
  weeklySchedules: [],
  workouts: [],
  healthBlocks: [],
  healthRoutines: [],
  inbody: {},
  isDailyLoading: false,
} as HealthProps;

const recipeProjection: RecipeProjection = {
  recentRecipes: { today: [], thisWeek: [], earlier: [] },
  favoriteRecipes: [],
  recentlyCooked: { today: [], yesterday: [], earlier: [] },
  ingredientGroups: [],
  historyItems: [],
  collectionGroups: [],
  suggestions: [],
  allRecipes: [],
  empty: {
    noRecipes: false,
    noFavorites: true,
    noHistory: true,
    noIngredients: true,
    noCollections: true,
    isEmpty: false,
  },
  generatedAt: '2026-09-11T00:00:00.000Z',
};

const recipe = {
  id: 'ui09-recipe',
  title: 'UI-09 Recipe',
  category: 'Other',
  ingredients: 'rice',
  steps: 'Cook it',
  memo: '',
  starred: false,
  created_at: '2026-09-11T00:00:00.000Z',
  deleted_at: null,
} as RecipeStudioViewProps['recipes'][number];

const recipeProps: RecipeStudioViewProps = {
  projection: recipeProjection,
  recipes: [recipe],
  theme,
  appSettings,
  activeAvailability: 'READY_WITH_DATA',
  activeValidating: false,
  onRetryActive: vi.fn(),
  expandedId: null,
  onToggleExpand: vi.fn(),
  onToggleStar: vi.fn(),
  onEdit: vi.fn(),
  onDelete: vi.fn(),
  deletedRecipes: [],
  trashAvailability: 'READY_EMPTY',
  trashValidating: false,
  onRetryTrash: vi.fn(),
  onRestore: vi.fn(),
  onMarkCooked: vi.fn(),
  onNewRecipe: vi.fn(),
  onScrollToRecipe: vi.fn(),
};

const settingsProps = {
  appSettings,
  updateSetting: vi.fn(),
  showToast: vi.fn(),
  theme,
  THEME_COLORS: themeColors,
  mutateDaily: vi.fn(),
  mutateStatic: vi.fn(),
  mutateTodos: vi.fn(),
  mutateRoutines: vi.fn(),
  onSignOut: vi.fn(),
  user: { id: 'ui09-settings', name: 'UI-09 Settings' },
};

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

function renderProductionWorkspace(workspace: WorkspaceContract['workspace']): HTMLElement {
  switch (workspace) {
    case 'notes':
      return render(createElement(NoteView, { accountId: 'ui09-notes' }));
    case 'planner':
      return render(createElement(PlannerView, plannerProps));
    case 'health':
      return render(createElement(HealthView, healthProps));
    case 'recipe':
      return render(createElement(RecipeStudioView, recipeProps));
    case 'settings':
      return render(createElement(SettingsView, settingsProps as never));
  }
}

describe('UI-09 rendered composition contract matrix', () => {
  it('links every major workspace to its declared production root and hierarchy markers', () => {
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
      for (const marker of contract.majorRegionMarkers) {
        expect(source, `${contract.workspace}: ${marker}`).toContain(marker);
      }
    }
  });

  it('counts full-region owners across each complete production-rendered workspace subtree', () => {
    for (const contract of WORKSPACE_CONTRACT_MATRIX) {
      const rendered = renderProductionWorkspace(contract.workspace);
      const workspace = rendered.querySelector(`[data-workspace="${contract.workspace}"]`)!;
      const owners = workspace.querySelectorAll('[data-workspace-scroll-owner="page"]');

      expect(workspace, `${contract.workspace}: production root`).not.toBeNull();
      expect(workspace.getAttribute('data-workspace-scroll-mode'), contract.workspace)
        .toBe(WORKSPACE_SCROLL_MODE[contract.scrollMode]);
      expect(owners, `${contract.workspace}: page-level owners in complete subtree`)
        .toHaveLength(contract.fullRegionOwnerCount);
    }
  });

  it('uses production HealthView order and keeps bounded internal owners out of the page-owner count', () => {
    const health = renderProductionWorkspace('health');
    const healthRoot = health.querySelector('[data-workspace="health"]')!;
    const healthComposition = healthRoot.querySelector('[data-health-composition="workout-first"]')!;
    const execution = healthComposition.querySelector('[data-health-composition-role="execution"]')!;
    const support = healthComposition.querySelector('[data-health-composition-role="support"]')!;
    const boundedHealthOwners = healthComposition.querySelectorAll('[data-health-scroll-owner]');

    expect(execution.parentElement).toBe(healthComposition);
    expect(support.parentElement).toBe(healthComposition);
    expect(execution.compareDocumentPosition(support) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(boundedHealthOwners.length).toBeGreaterThan(0);
    expect(healthRoot.querySelectorAll('[data-workspace-scroll-owner="page"]')).toHaveLength(0);

    const recipe = renderProductionWorkspace('recipe');
    const recipeRoot = recipe.querySelector('[data-workspace="recipe"]')!;
    const recipePrimary = recipeRoot.querySelector('[data-recipe-composition-role="primary-list"]')!;
    const recipeSupport = recipeRoot.querySelector('[data-recipe-composition-role="support"]')!;
    const boundedRecipeOwners = recipeRoot.querySelectorAll('[data-recipe-scroll-owner-wide]');

    expect(recipePrimary.compareDocumentPosition(recipeSupport) & Node.DOCUMENT_POSITION_FOLLOWING)
      .toBeTruthy();
    expect(boundedRecipeOwners).toHaveLength(2);
    expect(recipeRoot.querySelectorAll('[data-workspace-scroll-owner="page"]')).toHaveLength(0);
  });

  it('names the Health workout memo textarea from its visible localized label', () => {
    const health = renderProductionWorkspace('health');
    const memo = health.querySelector<HTMLTextAreaElement>('[data-health-workout-memo]')!;
    const label = health.querySelector<HTMLLabelElement>(`label[for="${memo.id}"]`)!;

    expect(memo).not.toBeNull();
    expect(label).not.toBeNull();
    expect(label.textContent?.trim()).toBeTruthy();
    expect(label.htmlFor).toBe(memo.id);
    expect(memo.getAttribute('placeholder')).not.toBe(label.textContent?.trim());
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

    const health = renderProductionWorkspace('health')
      .querySelector('[data-health-composition]')!;
    expect(health.className).toContain('xl:grid');
    expect(health.className).toContain('xl:overflow-hidden');

    const recipe = renderProductionWorkspace('recipe')
      .querySelector('[data-recipe-composition-content]')!;
    expect(recipe.className).toContain('overflow-y-auto');
    expect(recipe.className).toContain('xl:flex-row');
    expect(recipe.className).toContain('xl:overflow-hidden');

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
