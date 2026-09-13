// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import type { Theme } from '../../../../../types';
import { UI_INTERACTION } from '../../../../../lib/uiInteractionTokens';
import { DARK_TOKENS, LIGHT_TOKENS } from '../../../../../theme/tokens';
import { RecipeCard } from './RecipeCard';
import { RecipeCompositionLayout } from './RecipeCompositionLayout';
import { RecipeStudioView, type RecipeStudioViewProps } from './RecipeStudioView';
import type { RecipeProjection } from '../recipeProjectionModels';

const theme: Theme = {
  card: 'bg-surface',
  input: 'bg-input',
  border: 'border-border',
  text: 'text-foreground',
  textMuted: 'text-muted-foreground',
  hoverBg: 'hover:bg-surface-alt',
};

const emptyProjection: RecipeProjection = {
  recentRecipes: { today: [], thisWeek: [], earlier: [] },
  favoriteRecipes: [],
  recentlyCooked: { today: [], yesterday: [], earlier: [] },
  ingredientGroups: [],
  historyItems: [],
  collectionGroups: [],
  suggestions: [],
  allRecipes: [],
  empty: {
    noRecipes: true,
    noFavorites: true,
    noHistory: true,
    noIngredients: true,
    noCollections: true,
    isEmpty: true,
  },
  generatedAt: '2026-09-13T00:00:00.000Z',
};

type Rgb = readonly [number, number, number];

function hexToRgb(hex: string): Rgb {
  const value = hex.replace('#', '');
  return [0, 2, 4].map(offset => Number.parseInt(value.slice(offset, offset + 2), 16)) as unknown as Rgb;
}

function mixSrgb(foreground: string, background: string, foregroundWeight: number): Rgb {
  const fg = hexToRgb(foreground);
  const bg = hexToRgb(background);
  return fg.map((channel, index) => (
    channel * foregroundWeight + bg[index]! * (1 - foregroundWeight)
  )) as unknown as Rgb;
}

function relativeLuminance(rgb: Rgb): number {
  const channels = rgb.map(channel => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrastRatio(foreground: Rgb, background: Rgb): number {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}

describe('VIS-08 Recipe visual migration', () => {
  it('keeps list-first structure and scroll ownership while binding scoped visual roles', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(RecipeCompositionLayout, {
      header: createElement('span', null, 'Header'),
      primary: createElement('span', null, 'Recipes'),
      supporting: createElement('span', null, 'Support'),
    }));

    const composition = host.querySelector('[data-recipe-composition="list-first"]')!;
    const content = host.querySelector('[data-recipe-composition-content]')!;
    const primary = host.querySelector('[data-recipe-composition-role="primary-list"]')!;
    const support = host.querySelector('[data-recipe-composition-role="support"]')!;

    expect(composition.getAttribute('data-workspace-scroll-mode')).toBe('pane');
    expect(content.className).toContain('overflow-y-auto');
    expect(content.className).toContain('xl:overflow-hidden');
    expect(primary.className).toContain('xl:flex-1');
    expect(primary.className).toContain('abs-cosmos-recipe-primary');
    expect(support.className).toContain('xl:w-[320px]');
    expect(support.className).toContain('2xl:w-[360px]');
    expect(support.className).toContain('abs-cosmos-recipe-support-rail');
    expect(support.querySelector('[data-recipe-scroll-owner-wide="support"]')).not.toBeNull();
  });

  it('renders favorite, destructive, expanded, and focus states through separate production authorities', () => {
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(RecipeCard, {
      recipe: {
        id: 'recipe-1', title: 'Field soup', category: 'Other', ingredients: 'water', steps: 'simmer',
        memo: '', starred: true, created_at: '2026-09-12T00:00:00Z', deleted_at: null,
      },
      theme,
      dark: false,
      expanded: true,
      t: key => key,
      onToggleExpand: () => undefined,
      onToggleStar: () => undefined,
      onEdit: () => undefined,
      onDelete: () => undefined,
    }));

    const card = host.querySelector('[data-k110-recipe-card]')!;
    const favorite = host.querySelector('[data-starred="true"]')!;
    const danger = host.querySelector('.abs-recipe-danger-action')!;
    const expanded = host.querySelector('.abs-cosmos-recipe-expanded')!;

    expect(card.classList.contains('abs-cosmos-recipe-card')).toBe(true);
    expect(card.getAttribute('data-expanded')).toBe('true');
    expect(favorite.classList.contains('abs-recipe-favorite-action')).toBe(true);
    expect(favorite.querySelector('svg')?.getAttribute('fill')).toBe('currentColor');
    expect(danger).not.toBeNull();
    expect(expanded).not.toBeNull();
    for (const focusClass of UI_INTERACTION.focusRingClass.split(/\s+/)) {
      expect(favorite.classList.contains(focusClass)).toBe(true);
      expect(danger.classList.contains(focusClass)).toBe(true);
    }
  });

  it('keeps Cosmos decorative, sparse, pointer-transparent, and out of Recipe state semantics', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const vis08Css = css.match(/\/\* VIS-08[^]*?(?=\/\* VIS-\d|$)/)?.[0] ?? '';
    const ground = vis08Css.match(/\.abs-cosmos-recipe\s*\{([^}]*)\}/s)?.[1] ?? '';
    const semanticStateCss = vis08Css.slice(vis08Css.indexOf('.abs-recipe-search-control'));
    const studioSource = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'features', 'recipe', 'components', 'RecipeStudioView.tsx'), 'utf8');
    const cardSource = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'features', 'recipe', 'components', 'RecipeCard.tsx'), 'utf8');

    expect(ground).toContain('background-color: var(--color-background)');
    expect(ground).not.toContain('--cosmos-');
    expect(vis08Css).toContain('background-color: var(--color-surface-elevated)');
    expect(vis08Css).toContain('var(--color-surface-muted)');
    expect(vis08Css.match(/var\(--cosmos-pale-blue-dot\)/g)).toHaveLength(1);
    expect(vis08Css.match(/pointer-events: none/g)?.length).toBeGreaterThanOrEqual(2);
    expect(semanticStateCss).not.toContain('--cosmos-');
    expect(vis08Css).not.toMatch(/animation|@keyframes|z-index/);
    expect(studioSource).not.toContain('bg-yellow-400');
    expect(cardSource).not.toContain('#8B5CF6');
  });

  it('keeps Recipe decoration scoped away from other workspace selectors', () => {
    const css = readFileSync(join(process.cwd(), 'src', 'index.css'), 'utf8');
    const vis08Css = css.match(/\/\* VIS-08[^]*?(?=\/\* VIS-\d|$)/)?.[0] ?? '';
    expect(vis08Css).not.toMatch(/abs-cosmos-(?:settings|planner|health)|data-workspace=['"](?:settings|planner|health|notes)/);
  });

  it('keeps every changed small-text composition at or above 4.5 in light and dark', () => {
    for (const [mode, tokens] of [['light', LIGHT_TOKENS], ['dark', DARK_TOKENS]] as const) {
      const selectedAnchor = mode === 'light' ? tokens.colors.text : tokens.colors.background;
      const selected = mixSrgb(tokens.colors.selected, selectedAnchor, 0.88);
      const favorite = mixSrgb(tokens.colors.warning, tokens.colors.surfaceElevated, 0.16);
      const warning = mixSrgb(tokens.colors.warning, tokens.colors.surfaceElevated, 0.10);
      const danger = mixSrgb(tokens.colors.danger, tokens.colors.surfaceElevated, 0.08);
      const restore = mixSrgb(tokens.colors.success, tokens.colors.surfaceElevated, 0.10);
      const step = mixSrgb(tokens.colors.selected, tokens.colors.surfaceMuted, 0.16);

      expect(contrastRatio(hexToRgb(tokens.colors.primaryForeground), selected), `${mode}:selected`).toBeGreaterThanOrEqual(4.5);
      for (const [name, background] of [
        ['favorite', favorite], ['warning', warning], ['danger', danger], ['restore', restore], ['step', step],
      ] as const) {
        expect(contrastRatio(hexToRgb(tokens.colors.text), background), `${mode}:${name}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('gives compact Recipe sort actions localized names, selected state, 24px targets, and focus authority', () => {
    const props: RecipeStudioViewProps = {
      projection: emptyProjection,
      recipes: [],
      theme,
      appSettings: {
        darkMode: false,
        defaultCategory: 'Other',
        defaultColor: 'blue',
        language: 'en',
        notesFontFamily: 'system',
        notesFontSize: 16,
        notesTextColor: '',
        notesAccentColor: '',
      },
      activeAvailability: 'READY_EMPTY',
      activeValidating: false,
      onRetryActive: () => undefined,
      expandedId: null,
      onToggleExpand: () => undefined,
      onToggleStar: () => undefined,
      onEdit: () => undefined,
      onDelete: () => undefined,
      deletedRecipes: [],
      trashAvailability: 'READY_EMPTY',
      trashValidating: false,
      onRetryTrash: () => undefined,
      onRestore: () => undefined,
      onMarkCooked: () => undefined,
      onNewRecipe: () => undefined,
      onScrollToRecipe: () => undefined,
    };
    const host = document.createElement('div');
    host.innerHTML = renderToStaticMarkup(createElement(RecipeStudioView, props));
    const controls = [...host.querySelectorAll<HTMLButtonElement>('.abs-recipe-sort-option')];

    expect(controls.map(control => control.getAttribute('aria-label'))).toEqual([
      'Recently created: Descending',
      'Recently created: Ascending',
      'Title A–Z',
    ]);
    expect(controls.map(control => control.getAttribute('aria-pressed'))).toEqual(['true', 'false', 'false']);
    expect(controls[0]?.classList.contains('abs-recipe-selected-control')).toBe(true);
    for (const control of controls) {
      expect(control.classList.contains('min-h-[24px]')).toBe(true);
      expect(control.classList.contains('min-w-[24px]')).toBe(true);
      expect(control.classList.contains('focus-visible:outline-focus')).toBe(true);
    }
    expect(controls[1]?.classList.contains('text-muted-foreground')).toBe(true);
    expect(controls[2]?.classList.contains('text-muted-foreground')).toBe(true);
  });

  it('keeps inactive Recipe sort foreground contrast above 4.5 in both themes', () => {
    for (const [mode, tokens] of [['light', LIGHT_TOKENS], ['dark', DARK_TOKENS]] as const) {
      expect(
        contrastRatio(hexToRgb(tokens.colors.mutedForeground), hexToRgb(tokens.colors.surfaceElevated)),
        mode,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
});
