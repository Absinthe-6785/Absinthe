// @vitest-environment happy-dom
import { act, createElement, memo, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { ExerciseBlock } from '../../../../types';
import { HealthBlockLibrary, type CatalogExerciseBlock, type HealthBlockLibraryProps } from './HealthBlockLibrary';

const measurement = vi.hoisted(() => ({ renderedIds: [] as string[], baselineRenderedIds: [] as string[] }));

vi.mock('./WorkoutBlockCard', async () => {
  const React = await vi.importActual<typeof import('react')>('react');
  const MeasuredCard = React.memo(({ block }: { block: { id: string } }) => {
    measurement.renderedIds.push(block.id);
    return React.createElement('article', { 'data-perf-card': block.id });
  });
  return { WorkoutBlockCard: MeasuredCard };
});

vi.mock('../../../../lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));

const theme = { card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' };
const queries = ['e', 'ex', 'exercise', 'exercise 2', 'needle', ''];
const measuredSequences: Record<number, { visible: number[]; optimizedRenders: number[] }> = {
  50: {
    visible: [90, 90, 85, 85, 20, 5, 90, 40, 23, 90, 90],
    optimizedRenders: [90, 0, 0, 0, 0, 5, 85, 40, 23, 90, 90],
  },
  250: {
    visible: [450, 450, 423, 423, 104, 27, 450, 200, 114, 450, 450],
    optimizedRenders: [450, 0, 0, 0, 0, 27, 423, 200, 114, 450, 450],
  },
  500: {
    visible: [900, 900, 846, 846, 189, 54, 900, 400, 229, 900, 900],
    optimizedRenders: [900, 0, 0, 0, 0, 54, 846, 400, 229, 900, 900],
  },
};

function makeBlocks(count: number, version = 0): CatalogExerciseBlock[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `block-${String(index).padStart(4, '0')}`,
    name: `${index % 17 === 0 ? 'Needle' : 'Exercise'} ${index}${version ? ` v${version}` : ''}`,
    type: 'strength' as const,
    tags: index % 5 === 0 ? [] : index % 7 === 0 ? ['strength', 'shared', 'shared'] : ['strength', index % 2 ? 'upper' : 'shared'],
  }));
}

interface BaselineCardProps {
  block: ExerciseBlock;
  onAdd: () => void;
  onEdit: (event: React.MouseEvent) => void;
  onDelete: (event: React.MouseEvent) => void;
}

const BaselineMeasuredCard = memo(function BaselineMeasuredCard({ block }: BaselineCardProps) {
  measurement.baselineRenderedIds.push(block.id);
  return createElement('article', { 'data-baseline-perf-card': block.id });
});

function sortBaseline(blocks: readonly ExerciseBlock[]): ExerciseBlock[] {
  return [...blocks].sort((left, right) => {
    const byName = left.name.localeCompare(right.name);
    return byName !== 0 ? byName : left.id.localeCompare(right.id);
  });
}

function buildBaselineGroups(blocks: readonly ExerciseBlock[], activeTagFilter: string | null) {
  const allTags = Array.from(new Set(blocks.flatMap(block => block.tags ?? [])));
  const rows: Array<{ tag?: string; blocks: ExerciseBlock[]; key: string }> = [];
  for (const tag of allTags) {
    if (activeTagFilter && tag !== activeTagFilter) continue;
    const groupBlocks = blocks.filter(block => (block.tags ?? []).includes(tag));
    if (groupBlocks.length > 0) rows.push({ tag, blocks: groupBlocks, key: `h-${tag}` });
  }
  if (!activeTagFilter) {
    const untagged = blocks.filter(block => (block.tags ?? []).length === 0);
    if (untagged.length > 0) rows.push({ tag: allTags.length > 0 ? 'Other' : undefined, blocks: untagged, key: 'h-other' });
  }
  return { allTags, rows };
}

/** Test-only rendering of the pre-optimization list, including its per-card inline action callbacks. */
function BaselineLibrary({
  blocks,
  activeTagFilter,
  setActiveTagFilter,
  onAddToToday,
  onEditBlock,
  onDeleteBlock,
}: Pick<HealthBlockLibraryProps, 'blocks' | 'activeTagFilter' | 'setActiveTagFilter' | 'onAddToToday' | 'onEditBlock' | 'onDeleteBlock'>) {
  const [query, setQuery] = useState('');
  const { allTags } = useMemo(() => buildBaselineGroups(blocks, null), [blocks]);
  const normalizedQuery = query.trim().toLowerCase();
  const rankedBlocks = sortBaseline(blocks.filter(block => {
    if (!normalizedQuery) return true;
    return [block.name, ...(block.tags ?? [])].join(' ').toLowerCase().includes(normalizedQuery);
  }));
  const { rows } = buildBaselineGroups(rankedBlocks, activeTagFilter);

  return createElement('div', null,
    createElement('input', {
      type: 'search',
      value: query,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setQuery(event.target.value),
    }),
    createElement('button', { type: 'button', onClick: () => setActiveTagFilter(null) }, 'filterAll'),
    ...allTags.map(tag => createElement('button', {
      key: tag,
      type: 'button',
      onClick: () => setActiveTagFilter(activeTagFilter === tag ? null : tag),
    }, `#${tag}`)),
    ...rows.map(row => createElement('section', { key: row.key }, ...row.blocks.map(block => createElement(BaselineMeasuredCard, {
      key: block.id,
      block,
      onAdd: () => { void onAddToToday(block); },
      onEdit: event => { event.stopPropagation(); onEditBlock(block); },
      onDelete: event => onDeleteBlock(block.id, event),
    })))),
  );
}

/** In the real view, tag changes rerender HealthView and recreate its action props. */
function BaselineParent({ blocks }: { blocks: CatalogExerciseBlock[] }) {
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  return createElement(BaselineLibrary, {
    blocks,
    activeTagFilter,
    setActiveTagFilter,
    onAddToToday: block => { void block; },
    onEditBlock: block => { void block; },
    onDeleteBlock: (id, event) => { void id; void event; },
  });
}

function Harness({ blocks }: { blocks: CatalogExerciseBlock[] }) {
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const props: HealthBlockLibraryProps = {
    blocks,
    activeTagFilter,
    setActiveTagFilter,
    theme,
    darkMode: false,
    // Match the parent Health view, whose callbacks are recreated when its tag state changes.
    onAddToToday: block => { void block; },
    onEditBlock: block => { void block; },
    onDeleteBlock: (id, event) => { void id; void event; },
    onNewBlock: () => {},
    mobileVisible: true,
  };
  return createElement(HealthBlockLibrary, props);
}

function setSearch(host: HTMLElement, query: string) {
  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(search, query);
  search.dispatchEvent(new Event('input', { bubbles: true }));
  return search;
}

function clickButton(host: HTMLElement, text: string) {
  const button = [...host.querySelectorAll<HTMLButtonElement>('button')].find(candidate => candidate.textContent === text)!;
  button.click();
}

function measureSequence(host: HTMLElement, root: ReturnType<typeof createRoot>, Component: typeof Harness | typeof BaselineParent, size: number) {
  const initialBlocks = makeBlocks(size);
  const records: Array<{ action: string; visibleCards: number; cardRenders: number }> = [];
  const isBaseline = Component === BaselineParent;
  const cardSelector = isBaseline ? '[data-baseline-perf-card]' : '[data-perf-card]';
  const renderCounter = isBaseline ? measurement.baselineRenderedIds : measurement.renderedIds;
  const readRecord = (action: string) => {
    records.push({ action, visibleCards: host.querySelectorAll(cardSelector).length, cardRenders: renderCounter.length });
    renderCounter.length = 0;
  };

  act(() => root.render(createElement(Component, { blocks: initialBlocks })));
  readRecord('initial');
  const search = host.querySelector<HTMLInputElement>('input[type="search"]')!;
  search.focus();
  for (const query of queries) {
    act(() => { setSearch(host, query); });
    if (!isBaseline) expect(document.activeElement).toBe(search);
    readRecord(query ? `search:${query}` : 'clear');
  }
  for (const [action, label] of [['tag:strength', '#strength'], ['tag:shared', '#shared'], ['tag:all', 'filterAll']] as const) {
    act(() => clickButton(host, label));
    readRecord(action);
  }
  act(() => root.render(createElement(Component, { blocks: makeBlocks(size, 1) })));
  readRecord('source-replacement');
  return records;
}

const reactActEnvironment = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
let previousActEnvironment: boolean | undefined;

beforeAll(() => {
  previousActEnvironment = reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = true;
});
afterAll(() => {
  if (previousActEnvironment === undefined) delete reactActEnvironment.IS_REACT_ACT_ENVIRONMENT;
  else reactActEnvironment.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});
afterEach(() => {
  measurement.renderedIds.length = 0;
  measurement.baselineRenderedIds.length = 0;
});

describe('Health mobile block library mounted render measurement', () => {
  it.each([50, 250, 500])('measures baseline and optimized card renders across search, clear, tags, and source replacement for %i blocks', size => {
    const baselineHost = document.createElement('div');
    const optimizedHost = document.createElement('div');
    document.body.append(baselineHost, optimizedHost);
    const baselineRoot = createRoot(baselineHost);
    const optimizedRoot = createRoot(optimizedHost);
    try {
      const baseline = measureSequence(baselineHost, baselineRoot, BaselineParent, size);
      const optimized = measureSequence(optimizedHost, optimizedRoot, Harness, size);
      expect(optimized.map(record => record.action)).toEqual(baseline.map(record => record.action));
      expect(optimized.map(record => record.visibleCards)).toEqual(baseline.map(record => record.visibleCards));
      expect(baseline.map(record => record.cardRenders)).toEqual(measuredSequences[size]!.visible);
      expect(optimized.map(record => record.cardRenders)).toEqual(measuredSequences[size]!.optimizedRenders);
    } finally {
      act(() => baselineRoot.unmount());
      act(() => optimizedRoot.unmount());
      baselineHost.remove();
      optimizedHost.remove();
    }
  });
});
