// @vitest-environment happy-dom
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { ExerciseBlock } from '../../../../types';
import { sortExerciseBlocksForCatalog, type CatalogExerciseBlock } from './HealthBlockLibrary';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const catalog: CatalogExerciseBlock[] = [
  { id: 'block-z', name: 'Press', type: 'strength', tags: [], recentRank: 1 },
  { id: 'block-a', name: 'Squat', type: 'strength', tags: [] },
  { id: 'block-b', name: 'Press', type: 'strength', tags: [], recentRank: 0 },
  { id: 'block-c', name: 'Abs', type: 'strength', tags: [] },
];

describe('Health exercise catalog ordering', () => {
  it('is stable across date/month navigation and does not mutate static source data', () => {
    const sourceBefore = structuredClone(catalog);

    const currentMonth = sortExerciseBlocksForCatalog(catalog);
    const historicalMonth = sortExerciseBlocksForCatalog(catalog);

    expect(currentMonth.map(block => block.id)).toEqual(['block-b', 'block-z', 'block-c', 'block-a']);
    expect(historicalMonth.map(block => block.id)).toEqual(currentMonth.map(block => block.id));
    expect(catalog).toEqual(sourceBefore);
  });

  it('falls back to deterministic name then ID ordering when recency is absent', () => {
    const equalNames: ExerciseBlock[] = [
      { id: 'block-z', name: 'Press', type: 'strength', tags: [] },
      { id: 'block-a', name: 'Press', type: 'strength', tags: [] },
    ];

    expect(sortExerciseBlocksForCatalog(equalNames).map(block => block.id)).toEqual(['block-a', 'block-z']);
  });

  it('keeps a populated catalog naturally sized below wide and bounded by its wide owner', async () => {
    const { HealthBlockLibrary } = await import('./HealthBlockLibrary');
    const populated = Array.from({ length: 12 }, (_, index): ExerciseBlock => ({
      id: `block-${index}`,
      name: `Exercise ${index + 1}`,
      type: 'strength',
      tags: [index % 2 === 0 ? 'UPPER' : 'LOWER'],
    }));
    const html = renderToStaticMarkup(createElement(HealthBlockLibrary, {
      blocks: populated,
      activeTagFilter: null,
      setActiveTagFilter: vi.fn(),
      theme: { card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' },
      darkMode: false,
      onAddToToday: vi.fn(),
      onEditBlock: vi.fn(),
      onDeleteBlock: vi.fn(),
      onNewBlock: vi.fn(),
      mobileVisible: true,
    }));
    const host = document.createElement('div');
    host.innerHTML = html;

    const library = host.querySelector('[data-health-composition-role="setup-library"]');
    const owner = library?.querySelector('[data-health-scroll-owner="wide-library"]');
    expect(library?.className).toContain('xl:overflow-hidden');
    expect(owner?.className).toContain('overflow-visible');
    expect(owner?.className).toContain('xl:overflow-y-auto');
    expect(owner?.querySelectorAll('[data-k126-workout-block-card]')).toHaveLength(12);
  });
});
