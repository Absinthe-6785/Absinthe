// @vitest-environment happy-dom
import { act, createElement, Profiler, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProteinSource, Theme } from '@/types';
import { authFetch } from '@/lib/supabase';
import { useProteinData } from '../hooks/useProteinData';
import { ProteinTracker } from './ProteinTracker';
import { normalizeProteinCategory, PROTEIN_CATEGORY_KEYS } from './proteinConstants';

const work = vi.hoisted(() => ({ normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0 }));

vi.mock('./proteinConstants', async importOriginal => {
  const original = await importOriginal<typeof import('./proteinConstants')>();
  return {
    ...original,
    normalizeProteinCategory: (raw: string) => {
      work.normalizations += 1;
      return original.normalizeProteinCategory(raw);
    },
  };
});

vi.mock('@/lib/i18n', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('@/lib/supabase', () => ({ authFetch: vi.fn() }));
vi.mock('../hooks/useProteinData', () => ({ useProteinData: vi.fn() }));

const mockedUseProteinData = vi.mocked(useProteinData);
const mockedAuthFetch = vi.mocked(authFetch);
const theme = { input: 'theme-input', text: 'theme-text', textMuted: 'theme-muted' } as Theme;
const selectedDate = new Date('2026-07-01T12:00:00.000Z');
const formatDate = (date: Date) => date.toISOString().slice(0, 10);
let host: HTMLDivElement;
let root: Root | null = null;
let profilerCommits = 0;

function makeSources(count: number, prefix = 'Food'): ProteinSource[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index < 2 ? 'shared-id' : `source-${prefix}-${index}`,
    name: `${prefix} ${String(index).padStart(3, '0')}`,
    category: index % 17 === 0
      ? 'Unlisted'
      : index % 19 === 0
        ? ''
        : index % 23 === 0
          ? '🐟 Fish'
          : PROTEIN_CATEGORY_KEYS[index % PROTEIN_CATEGORY_KEYS.length],
    source_type: index % 2 === 0 ? 'fixed' : 'per100g',
    protein_per_serving: index % 2 === 0 ? index + 1 : null,
    protein_per_100g: index % 2 === 0 ? null : index + 1,
  }));
}

function observeSources(sources: ProteinSource[]): ProteinSource[] {
  return new Proxy(sources, {
    get(target, property, receiver) {
      if (property === 'filter') {
        return (predicate: (source: ProteinSource, index: number, array: ProteinSource[]) => unknown) => {
          work.sourceFilterCalls += 1;
          return target.filter((source, index) => {
            work.sourceFilterVisits += 1;
            return predicate(source, index, receiver as ProteinSource[]);
          });
        };
      }
      return Reflect.get(target, property, receiver);
    },
  });
}

function dataFor(sources: ProteinSource[]) {
  return {
    profile: null,
    sources,
    intakeLogs: [],
    totalIntake: 24,
    dailyTarget: 120,
    proteinPct: 20,
    weeklyProteinAvg: 24,
    proteinStreak: 0,
    goalConsistency: 0,
    isLoading: false,
    mutateProfile: vi.fn(),
    mutateSources: vi.fn(),
    mutateIntake: vi.fn(),
    mutateAll: vi.fn(),
  };
}

function props(overrides: Partial<ComponentProps<typeof ProteinTracker>> = {}) {
  return {
    accountId: 'account-a',
    theme,
    darkMode: false,
    selectedDate,
    formatDate,
    showToast: vi.fn(),
    ...overrides,
  };
}

function renderTracker(componentProps: ComponentProps<typeof ProteinTracker>) {
  act(() => root!.render(createElement(Profiler, {
    id: 'ProteinTracker',
    onRender: () => { profilerCommits += 1; },
  }, createElement(ProteinTracker, componentProps))));
  return host;
}

function dispatchClick(element: Element) {
  act(() => element.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

function dispatchChange(element: HTMLInputElement | HTMLSelectElement, value: string) {
  act(() => {
    const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(element), 'value');
    descriptor?.set?.call(element, value);
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

async function dispatchClickAndFlush(element: Element) {
  await act(async () => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
}

function foodLibraryToggle(container: HTMLElement) {
  const button = Array.from(container.querySelectorAll('button'))
    .find(candidate => candidate.textContent?.includes('k73FoodLibrary'));
  if (!button) throw new Error('Food Library toggle not found');
  return button;
}

function exactButton(container: HTMLElement, label: string) {
  const button = Array.from(container.querySelectorAll('button'))
    .find(candidate => candidate.textContent?.trim() === label);
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function resetWork() {
  work.normalizations = 0;
  work.sourceFilterCalls = 0;
  work.sourceFilterVisits = 0;
  profilerCommits = 0;
}

function snapshotWork() {
  return {
    normalizations: work.normalizations,
    sourceFilterCalls: work.sourceFilterCalls,
    sourceFilterVisits: work.sourceFilterVisits,
  };
}

function expectedLibraryNames(sources: ProteinSource[]) {
  return PROTEIN_CATEGORY_KEYS.flatMap(category => sources
    .filter(source => normalizeProteinCategory(source.category || 'Other') === category)
    .map(source => source.name));
}

function renderedLibraryNames(container: HTMLElement) {
  const library = container.querySelector('[data-protein-food-library]');
  return Array.from(library?.querySelectorAll('p.text-sm.font-bold') ?? []).map(node => node.textContent ?? '');
}

function sourceCard(container: HTMLElement, name: string) {
  const library = container.querySelector<HTMLElement>('[data-protein-food-library]');
  const label = Array.from(library?.querySelectorAll('p.text-sm.font-bold') ?? [])
    .find(node => node.textContent === name);
  const card = label?.parentElement?.parentElement?.parentElement;
  if (!card) throw new Error(`Food source row not found: ${name}`);
  return card as HTMLElement;
}

beforeEach(() => {
  resetWork();
  vi.clearAllMocks();
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  mockedAuthFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  root = null;
  host.remove();
});

describe('ProteinTracker Food Library source grouping', () => {
  it.each([12, 210])('measures Food Library work with %s sources and preserves grouping/output', sourceCount => {
    const rawSources = makeSources(sourceCount);
    const sources = observeSources(rawSources);
    const expectedNames = expectedLibraryNames(rawSources);
    resetWork();
    mockedUseProteinData.mockReturnValue(dataFor(sources));

    const view = renderTracker(props());
    const initial = snapshotWork();
    const initialCommits = profilerCommits;
    expect(initial).toEqual({ normalizations: sourceCount, sourceFilterCalls: 0, sourceFilterVisits: 0 });
    expect(initialCommits).toBe(1);

    const toggle = foodLibraryToggle(view);
    resetWork();
    dispatchClick(toggle);
    const opening = snapshotWork();
    const openingCommits = profilerCommits;
    expect(renderedLibraryNames(view)).toEqual(expectedNames);
    expect(opening).toEqual({ normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0 });
    expect(openingCommits).toBe(1);

    resetWork();
    dispatchClick(toggle);
    const closing = snapshotWork();
    const closingCommits = profilerCommits;
    expect(view.querySelector('[data-protein-food-library]')).not.toBeNull();
    expect(renderedLibraryNames(view)).toEqual([]);
    expect(closing).toEqual({ normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0 });
    expect(closingCommits).toBe(1);

    resetWork();
    dispatchClick(toggle);
    const reopen = snapshotWork();
    const reopenCommits = profilerCommits;
    expect(reopen).toEqual({ normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0 });
    expect(reopenCommits).toBe(1);

    resetWork();
    const card = sourceCard(view, rawSources[0]!.name);
    dispatchClick(card.querySelector('button')!);
    const editOpen = snapshotWork();
    const editOpenCommits = profilerCommits;
    expect(editOpen).toEqual({ normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0 });
    expect(editOpenCommits).toBe(1);

    const nameInput = card.querySelector<HTMLInputElement>('input[type="text"]');
    const proteinInput = card.querySelector<HTMLInputElement>('input[type="number"]');
    const categorySelect = card.querySelector<HTMLSelectElement>('select');
    expect(nameInput).not.toBeNull();
    expect(proteinInput).not.toBeNull();
    expect(categorySelect).not.toBeNull();
    const library = view.querySelector<HTMLElement>('[data-protein-food-library]')!;
    library.scrollTop = 37;
    act(() => nameInput!.focus());
    resetWork();
    dispatchChange(nameInput!, 'Unsaved Food Name');
    expect(nameInput!.value).toBe('Unsaved Food Name');
    expect(document.activeElement).toBe(nameInput);
    expect(library.scrollTop).toBe(37);
    const nameEdit = snapshotWork();
    const nameEditCommits = profilerCommits;
    expect(nameEdit).toEqual({ normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0 });
    expect(nameEditCommits).toBe(1);

    resetWork();
    dispatchChange(proteinInput!, '51.5');
    expect(proteinInput!.value).toBe('51.5');
    const proteinEdit = snapshotWork();
    const proteinEditCommits = profilerCommits;
    expect(proteinEdit).toEqual({ normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0 });
    expect(proteinEditCommits).toBe(1);

    resetWork();
    dispatchChange(categorySelect!, 'Plant');
    expect(categorySelect!.value).toBe('Plant');
    const categoryEdit = snapshotWork();
    const categoryEditCommits = profilerCommits;
    expect(categoryEdit).toEqual({ normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0 });
    expect(categoryEditCommits).toBe(1);

    const replacementRaw = makeSources(9, 'Updated');
    const replacement = observeSources(replacementRaw);
    const replacementExpectedNames = expectedLibraryNames(replacementRaw);
    mockedUseProteinData.mockReturnValue(dataFor(replacement));
    const replacementDate = new Date('2026-07-03T12:00:00.000Z');
    resetWork();
    renderTracker(props({ accountId: 'account-b', selectedDate: replacementDate }));
    const replacementWork = snapshotWork();
    const replacementCommits = profilerCommits;
    expect(renderedLibraryNames(view)).toEqual(replacementExpectedNames);
    expect(replacementWork).toEqual({
      normalizations: replacementRaw.length,
      sourceFilterCalls: 0,
      sourceFilterVisits: 0,
    });
    expect(replacementCommits).toBe(1);
    expect(mockedAuthFetch).not.toHaveBeenCalled();
    expect(mockedUseProteinData).toHaveBeenLastCalledWith(
      formatDate(replacementDate), replacementDate, formatDate, 'account-b',
    );
    expect(view.textContent).toContain('Updated 008');
    expect(view.textContent).not.toContain('Food 000');

    // Captured from this same mounted fixture/harness before replacing the
    // Food Library's per-category sources.filter call with sourcesByCategory.
    // Keep the pre-change measurements beside current results for comparison.
    const repeatedLegacyScan = {
      normalizations: sourceCount * PROTEIN_CATEGORY_KEYS.length,
      sourceFilterCalls: PROTEIN_CATEGORY_KEYS.length,
      sourceFilterVisits: sourceCount * PROTEIN_CATEGORY_KEYS.length,
      commits: 1,
    };
    const baseline = {
      initial: { normalizations: sourceCount, sourceFilterCalls: 0, sourceFilterVisits: 0, commits: 1 },
      opening: repeatedLegacyScan,
      closing: { normalizations: 0, sourceFilterCalls: 0, sourceFilterVisits: 0, commits: 1 },
      reopening: repeatedLegacyScan,
      editOpen: repeatedLegacyScan,
      nameEdit: repeatedLegacyScan,
      proteinEdit: repeatedLegacyScan,
      categoryEdit: repeatedLegacyScan,
      sourceReplacement: {
        normalizations: replacementRaw.length * (PROTEIN_CATEGORY_KEYS.length + 1),
        sourceFilterCalls: PROTEIN_CATEGORY_KEYS.length,
        sourceFilterVisits: replacementRaw.length * PROTEIN_CATEGORY_KEYS.length,
        commits: 1,
      },
    };
    const optimized = {
      initial: { ...initial, commits: initialCommits },
      opening: { ...opening, commits: openingCommits },
      closing: { ...closing, commits: closingCommits },
      reopening: { ...reopen, commits: reopenCommits },
      editOpen: { ...editOpen, commits: editOpenCommits },
      nameEdit: { ...nameEdit, commits: nameEditCommits },
      proteinEdit: { ...proteinEdit, commits: proteinEditCommits },
      categoryEdit: { ...categoryEdit, commits: categoryEditCommits },
      sourceReplacement: { ...replacementWork, commits: replacementCommits },
    };
    console.info('[protein-food-library-before-after]', JSON.stringify({
      sourceCount,
      categoryCount: PROTEIN_CATEGORY_KEYS.length,
      baseline,
      optimized,
    }));
  });

  it.each([320, 430])('keeps compact Quick Add and full Food Library behavior at %s CSS px', width => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
    mockedUseProteinData.mockReturnValue(dataFor(observeSources(makeSources(2))));
    const view = renderTracker(props({ mode: 'compact', onOpenFull: vi.fn() }));
    expect(view.querySelector('[data-protein-quick-add]')).not.toBeNull();
    expect(view.querySelector('[data-protein-food-library]')).toBeNull();

    renderTracker(props({ mode: 'full' }));
    expect(view.querySelector('[data-protein-food-library]')).not.toBeNull();
  });

  it('preserves mocked Quick Add, source Edit/Save/Delete, and Add actions', async () => {
    const rawSources = makeSources(2);
    const data = dataFor(observeSources(rawSources));
    mockedUseProteinData.mockReturnValue(data);
    const view = renderTracker(props());

    const quickAdd = view.querySelector('[data-protein-quick-add]')!;
    await dispatchClickAndFlush(Array.from(quickAdd.querySelectorAll('button')).find(button => button.textContent?.includes(rawSources[0]!.name))!);
    expect(mockedAuthFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/protein_intake'), expect.objectContaining({ method: 'POST' }),
    );
    expect(data.mutateIntake).toHaveBeenCalledOnce();

    dispatchClick(foodLibraryToggle(view));
    const card = sourceCard(view, rawSources[0]!.name);
    dispatchClick(card.querySelector('button')!);
    dispatchChange(card.querySelector('input[type="text"]')!, 'Saved Food');
    await dispatchClickAndFlush(exactButton(card, 'save'));
    expect(mockedAuthFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/protein_sources/${rawSources[0]!.id}`), expect.objectContaining({ method: 'PUT' }),
    );
    expect(data.mutateSources).toHaveBeenCalledOnce();

    const updatedCard = sourceCard(view, rawSources[0]!.name);
    await dispatchClickAndFlush(updatedCard.querySelectorAll('button')[1]!);
    expect(mockedAuthFetch).toHaveBeenCalledWith(
      expect.stringContaining(`/api/protein_sources/${rawSources[0]!.id}`), expect.objectContaining({ method: 'DELETE' }),
    );

    const library = view.querySelector<HTMLElement>('[data-protein-food-library]')!;
    dispatchClick(exactButton(library, 'add'));
    dispatchChange(library.querySelector('input[placeholder="proteinSourceName"]')!, 'Added Food');
    dispatchChange(library.querySelectorAll('input[type="number"]')[0]!, '12');
    await dispatchClickAndFlush(exactButton(library, 'add'));
    expect(mockedAuthFetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/protein_sources'), expect.objectContaining({ method: 'POST' }),
    );
  });
});
