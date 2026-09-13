// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseBlock } from '../../../../types';
import { sortExerciseBlocksForCatalog, type CatalogExerciseBlock } from './HealthBlockLibrary';

vi.mock('../../../../lib/i18n', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const mobileState = vi.hoisted(() => ({ value: false }));

vi.mock('../../../../hooks/useIsMobile', () => ({
  useIsMobile: () => mobileState.value,
}));

afterEach(() => {
  mobileState.value = false;
});

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

  it('names Health library controls, exposes keyboard focus, keeps 24px targets, and preserves callbacks', async () => {
    const { HealthBlockLibrary } = await import('./HealthBlockLibrary');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onNewBlock = vi.fn();
    const onEditBlock = vi.fn();
    const onDeleteBlock = vi.fn();
    const blocks: ExerciseBlock[] = [
      { id: 'squat', name: 'Back Squat', type: 'strength', tags: [] },
      { id: 'press', name: 'Bench Press', type: 'strength', tags: [] },
    ];

    act(() => root.render(createElement(HealthBlockLibrary, {
      blocks,
      activeTagFilter: null,
      setActiveTagFilter: vi.fn(),
      theme: { card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' },
      darkMode: false,
      onAddToToday: vi.fn(),
      onEditBlock,
      onDeleteBlock,
      onNewBlock,
      mobileVisible: true,
    })));

    const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
    const newBlock = host.querySelector<HTMLButtonElement>('[data-health-new-block]')!;
    const editButtons = [...host.querySelectorAll<HTMLButtonElement>('[data-health-block-edit]')];
    const deleteButtons = [...host.querySelectorAll<HTMLButtonElement>('[data-health-block-delete]')];

    expect(search.getAttribute('aria-label')).toBe('healthExerciseSearchPlaceholder');
    expect(newBlock.getAttribute('aria-label')).toBe('newBlockLabel');
    expect(editButtons.map(button => button.getAttribute('aria-label'))).toEqual([
      'editBtn: Back Squat',
      'editBtn: Bench Press',
    ]);
    expect(deleteButtons.map(button => button.getAttribute('aria-label'))).toEqual([
      'delete: Back Squat',
      'delete: Bench Press',
    ]);

    for (const button of [...editButtons, ...deleteButtons]) {
      expect(button.className).toContain('h-6');
      expect(button.className).toContain('w-6');
      expect(button.className).toContain('focus-visible:opacity-100');
      expect(button.className).toContain('focus-visible:outline-focus');
    }

    act(() => newBlock.click());
    act(() => editButtons[0]!.click());
    act(() => deleteButtons[1]!.click());
    expect(onNewBlock).toHaveBeenCalledTimes(1);
    expect(onEditBlock).toHaveBeenCalledWith(blocks[0]);
    expect(onDeleteBlock).toHaveBeenCalledWith('press', expect.anything());

    act(() => root.unmount());
    host.remove();
  });

  it('includes exercise identity in mobile overflow, edit, and delete names', async () => {
    mobileState.value = true;
    const { HealthBlockLibrary } = await import('./HealthBlockLibrary');
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onEditBlock = vi.fn();
    const onDeleteBlock = vi.fn();
    const blocks: ExerciseBlock[] = [
      { id: 'squat', name: 'Back Squat', type: 'strength', tags: [] },
      { id: 'press', name: 'Bench Press', type: 'strength', tags: [] },
    ];

    act(() => root.render(createElement(HealthBlockLibrary, {
      blocks,
      activeTagFilter: null,
      setActiveTagFilter: vi.fn(),
      theme: { card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' },
      darkMode: false,
      onAddToToday: vi.fn(),
      onEditBlock,
      onDeleteBlock,
      onNewBlock: vi.fn(),
      mobileVisible: true,
    })));

    const overflow = [...host.querySelectorAll<HTMLButtonElement>('[data-k126-block-overflow-trigger]')];
    expect(overflow.map(button => button.getAttribute('aria-label'))).toEqual([
      'k126BlockActions: Back Squat',
      'k126BlockActions: Bench Press',
    ]);

    act(() => overflow[0]!.click());
    const menu = host.querySelector('[data-k126-block-overflow-menu]')!;
    const actions = [...menu.querySelectorAll<HTMLButtonElement>('button')];
    expect(actions.map(button => button.getAttribute('aria-label'))).toEqual([
      'editBtn: Back Squat',
      'delete: Back Squat',
    ]);
    act(() => actions[1]!.click());
    expect(onDeleteBlock).toHaveBeenCalledWith('squat', expect.anything());

    act(() => root.unmount());
    host.remove();
  });
});
