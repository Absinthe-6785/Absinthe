// @vitest-environment happy-dom
import { act, createElement, type ComponentProps, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type VirtualizerOptions = {
  count: number;
  enabled?: boolean;
  estimateSize: (index: number) => number;
};

type HarnessVirtualItem = {
  index: number;
  start: number;
  size: number;
};

const virtualizerHarness = vi.hoisted(() => {
  const measuredSizes = new Map<number, number>();
  const controlledHeights = new Map<number, number>();
  const options: VirtualizerOptions[] = [];
  let lastItems: HarnessVirtualItem[] = [];

  const measureElement = vi.fn((node: Element | null) => {
    if (!node) return;
    const rawIndex = node.getAttribute('data-index');
    if (rawIndex === null) return;
    const index = Number(rawIndex);
    const measured = controlledHeights.get(index);
    if (measured !== undefined) measuredSizes.set(index, measured);
  });

  return {
    controlledHeights,
    measuredSizes,
    measureElement,
    options,
    get lastItems() {
      return lastItems;
    },
    set lastItems(items: HarnessVirtualItem[]) {
      lastItems = items;
    },
  };
});

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: VirtualizerOptions) => {
    virtualizerHarness.options.push(options);

    const getVirtualItems = () => {
      if (!options.enabled) return [];
      let start = 0;
      const items = Array.from(
        { length: Math.min(options.count, 3) },
        (_, index): HarnessVirtualItem => {
          const size = virtualizerHarness.measuredSizes.get(index) ?? options.estimateSize(index);
          const item = { index, start, size };
          start += size;
          return item;
        },
      );
      virtualizerHarness.lastItems = items;
      return items;
    };

    return {
      getTotalSize: () => Array.from(
        { length: options.count },
        (_, index) => virtualizerHarness.measuredSizes.get(index) ?? options.estimateSize(index),
      ).reduce((total, size) => total + size, 0),
      getVirtualItems,
      measureElement: virtualizerHarness.measureElement,
    };
  },
}));

import type { NoteBase } from '../noteUtils';
import type { NoteChromeColors } from '../noteEditorTheme';
import { NoteSidebarVirtualList } from './NoteSidebarVirtualList';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type MountedView = {
  container: HTMLDivElement;
  rerender: (element: ReactElement) => void;
  unmount: () => void;
};

const mountedViews = new Set<MountedView>();

function render(element: ReactElement): MountedView {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root: Root = createRoot(container);
  act(() => root.render(element));

  const view: MountedView = {
    container,
    rerender(next) {
      act(() => root.render(next));
    },
    unmount() {
      act(() => root.unmount());
      container.remove();
      mountedViews.delete(view);
    },
  };
  mountedViews.add(view);
  return view;
}

const colors: NoteChromeColors = {
  wrap: '#fff',
  sidebar: '#fff',
  sideBdr: '#ddd',
  notelist: '#fff',
  editor: '#fff',
  toolbar: '#fff',
  toolBdr: '#ddd',
  card: '#fff',
  cardHov: '#f5f5f5',
  cardAct: '#eee',
  cardActBdr: '#7c3aed',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#7c3aed',
  accentBg: '#f3e8ff',
  input: '#fff',
  inputBdr: '#ddd',
  badge: '#eee',
  badgeTxt: '#555',
  tag: '#eee',
  tagTxt: '#555',
  danger: '#c00',
  green: '#080',
};

function note(index: number, tags: readonly string[] = []): NoteBase {
  return {
    id: `note-${index}`,
    title: `Note ${index}`,
    body: `Preview ${index}`,
    updatedAt: index,
    folderId: null,
    deletedAt: null,
    properties: tags.length > 0 ? { tags: JSON.stringify(tags) } : undefined,
  };
}

function notes(count: number): NoteBase[] {
  return Array.from({ length: count }, (_, index) => {
    if (index === 1) return note(index, ['tagged']);
    if (index === 2) return note(index, ['long-tag-that-wraps', 'second-tag-that-wraps']);
    return note(index);
  });
}

function props(
  count: number,
  density: ComponentProps<typeof NoteSidebarVirtualList>['listDensity'] = 'comfortable',
): ComponentProps<typeof NoteSidebarVirtualList> {
  return {
    colors,
    notes: notes(count),
    folders: [],
    activeNoteId: 'note-1',
    isTrash: false,
    isMobile: false,
    dragNoteId: null,
    t: key => key,
    openNoteById: () => {},
    setMobileShowEditor: () => {},
    setDragNoteId: () => {},
    duplicateNote: () => {},
    createNote: () => {},
    listDensity: density,
  };
}

function resetHarness(): void {
  virtualizerHarness.controlledHeights.clear();
  virtualizerHarness.measuredSizes.clear();
  virtualizerHarness.measureElement.mockClear();
  virtualizerHarness.options.length = 0;
  virtualizerHarness.lastItems = [];
}

describe('REL-04F NoteSidebarVirtualList dynamic row measurement', () => {
  beforeEach(resetHarness);
  afterEach(() => {
    for (const view of [...mountedViews]) view.unmount();
  });

  it('keeps 39 notes in normal flow and enables virtualization at 40 notes', () => {
    const below = render(createElement(NoteSidebarVirtualList, props(39)));

    expect(virtualizerHarness.options.at(-1)?.enabled).toBe(false);
    expect(below.container.querySelectorAll('.bni')).toHaveLength(39);
    expect(below.container.querySelector('[data-index]')).toBeNull();
    expect(virtualizerHarness.measureElement).not.toHaveBeenCalled();

    below.unmount();
    resetHarness();

    const atThreshold = render(createElement(NoteSidebarVirtualList, props(40)));

    expect(virtualizerHarness.options.at(-1)?.enabled).toBe(true);
    expect(atThreshold.container.querySelectorAll('[data-index]')).toHaveLength(3);
    expect(virtualizerHarness.measureElement).toHaveBeenCalledTimes(3);
  });

  it('measures the complete wrapper for untagged, selected tagged, and wrapped-tag rows', () => {
    virtualizerHarness.controlledHeights.set(0, 68);
    virtualizerHarness.controlledHeights.set(1, 79);
    virtualizerHarness.controlledHeights.set(2, 106);

    const view = render(createElement(NoteSidebarVirtualList, props(40)));

    const measuredNodes = virtualizerHarness.measureElement.mock.calls
      .map(([node]) => node)
      .filter((node): node is Element => node !== null);
    expect(measuredNodes).toHaveLength(3);
    expect(measuredNodes.map(node => node.getAttribute('data-index'))).toEqual(['0', '1', '2']);
    expect(measuredNodes.every(node => node.firstElementChild?.classList.contains('bni'))).toBe(true);
    expect(measuredNodes[1]?.querySelector('.bni.active .be-tag-chip-ui')).not.toBeNull();
    expect(measuredNodes[2]?.querySelectorAll('.be-tag-chip-ui')).toHaveLength(2);

    view.rerender(createElement(NoteSidebarVirtualList, props(40)));

    expect(virtualizerHarness.lastItems).toEqual([
      { index: 0, start: 0, size: 68 },
      { index: 1, start: 68, size: 79 },
      { index: 2, start: 147, size: 106 },
    ]);
    expect(
      [...view.container.querySelectorAll<HTMLElement>('[data-index]')]
        .map(node => node.style.transform),
    ).toEqual(['translateY(0px)', 'translateY(68px)', 'translateY(147px)']);
    for (let index = 1; index < virtualizerHarness.lastItems.length; index += 1) {
      const previous = virtualizerHarness.lastItems[index - 1]!;
      const current = virtualizerHarness.lastItems[index]!;
      expect(current.start).toBeGreaterThanOrEqual(previous.start + previous.size);
    }
  });

  it.each([
    ['comfortable', 72],
    ['compact', 64],
    ['ultra', 60],
  ] as const)('preserves the %s estimate while measured height overrides it', (density, estimate) => {
    virtualizerHarness.controlledHeights.set(0, 91);
    virtualizerHarness.controlledHeights.set(1, 97);
    virtualizerHarness.controlledHeights.set(2, 124);

    const view = render(createElement(NoteSidebarVirtualList, props(40, density)));
    view.rerender(createElement(NoteSidebarVirtualList, props(40, density)));

    expect(virtualizerHarness.options.at(-1)?.estimateSize(0)).toBe(estimate);
    expect(virtualizerHarness.lastItems.map(item => item.size)).toEqual([91, 97, 124]);
    expect(view.container.querySelector('[data-index="1"] > .bni.active')).not.toBeNull();
  });
});
