// @vitest-environment happy-dom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { WikiMenu } from './features/block-editor/features/menus/components/WikiMenu';
import type { WikiNoteTarget, WikiTarget } from './wikiLinks';
import type { BlockEditorColors } from './editorTypes';

const colors = { card: '#fff', border: '#ddd', text: '#222', textFaint: '#888', accentBg: '#eee' } as BlockEditorColors;
const noteTarget = (id: string, title: string, updatedAt?: number, current = true): WikiNoteTarget => ({
  id, title, updatedAt, isCurrent: () => current,
});
let container: HTMLDivElement;
let root: Root;
let selected: ReturnType<typeof vi.fn>;
let previousLanguage: ReturnType<typeof useAppStore.getState>['appSettings']['language'];
const scrollIntoView = HTMLElement.prototype.scrollIntoView;

async function render(targets: WikiTarget[], query = '', onQueryChange?: (query: string) => void) {
  await act(async () => root.render(React.createElement(WikiMenu, {
    query, targets, anchorX: 0, anchorY: 0, colors, onSelect: selected, onClose: vi.fn(), onQueryChange,
  })));
}

function buttons() { return [...container.querySelectorAll<HTMLButtonElement>('.be-wiki-menu button')]; }

beforeEach(() => {
  (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  previousLanguage = useAppStore.getState().appSettings.language;
  useAppStore.getState().updateSetting('language', 'en');
  selected = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
  HTMLElement.prototype.scrollIntoView = scrollIntoView;
  useAppStore.getState().updateSetting('language', previousLanguage);
});

describe('Wiki picker duplicate-title disambiguation', () => {
  it('adds localized modification metadata and unique ID labels only for duplicate titles', async () => {
    await render([
      noteTarget('alpha-123456', 'Same title', Date.UTC(2026, 3, 2, 9)),
      noteTarget('beta-654321', 'Same title', Date.UTC(2026, 3, 3, 9)),
      noteTarget('unique-777777', 'Unique title', Date.UTC(2026, 3, 4, 9)),
    ]);
    const rows = buttons();
    expect(rows).toHaveLength(3);
    expect(rows[0].querySelector('[data-wiki-target-meta]')?.textContent).toContain('Updated');
    expect(rows[1].querySelector('[data-wiki-target-meta]')?.textContent).toContain('Updated');
    expect(rows[0].querySelector('[data-wiki-target-meta]')?.textContent).toContain('alpha-');
    expect(rows[1].querySelector('[data-wiki-target-meta]')?.textContent).toContain('beta-');
    expect(rows[0].getAttribute('aria-label')).toContain('Same title');
    expect(rows[0].getAttribute('aria-label')).toContain('ID');
    expect(rows[2].querySelector('[data-wiki-target-meta]')).toBeNull();
    expect(rows[2].getAttribute('aria-label')).toBe('Unique title');
  });

  it('uses a deterministic, collision-free ID fallback when modification times are identical or absent', async () => {
    await render([
      noteTarget('same-time-a', 'Timed duplicate', 1234),
      noteTarget('same-time-b', 'Timed duplicate', 1234),
      noteTarget('missing-a-abcdef', 'Undated duplicate'),
      noteTarget('missing-b-abcdef', 'Undated duplicate'),
    ]);
    const rows = buttons();
    const timed = rows.slice(0, 2).map(row => row.querySelector('[data-wiki-target-meta]')!.textContent!);
    const undated = rows.slice(2).map(row => row.querySelector('[data-wiki-target-meta]')!.textContent!);
    expect(timed[0]).toContain('ID same-time-a');
    expect(timed[1]).toContain('ID same-time-b');
    expect(new Set(timed).size).toBe(2);
    expect(undated[0]).toContain('ID …missing-a');
    expect(undated[1]).toContain('ID …missing-b');
    expect(undated.every(value => !value.includes('Updated'))).toBe(true);
    expect(new Set(undated).size).toBe(2);
  });

  it.each([
    { lang: 'ko' as const, title: '같은 제목', updated: '수정' },
    { lang: 'ja' as const, title: '同じ題名 東京🪻', updated: '更新' },
  ])('keeps Unicode titles and metadata accessible in $lang', async ({ lang, title, updated }) => {
    useAppStore.getState().updateSetting('language', lang);
    await render([noteTarget('one-123456', title, 1000), noteTarget('two-654321', title, 2000)]);
    expect(buttons().map(button => button.querySelector('span span')?.textContent)).toEqual([title, title]);
    for (const button of buttons()) {
      expect(button.querySelector('[data-wiki-target-meta]')?.textContent).toContain(updated);
      expect(button.getAttribute('aria-label')).toContain(title);
      expect(button.getAttribute('aria-label')).toContain('ID');
    }
  });

  it('keeps mouse selection attached to the exact authorized noteId', async () => {
    const first = noteTarget('target-a', 'Duplicate', 1);
    const second = noteTarget('target-b', 'Duplicate', 1);
    await render([first, second]);
    await act(async () => buttons()[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith(second);
    expect(selected.mock.calls[0][0].id).not.toBe(first.id);
  });

  it('keeps keyboard selection attached to the exact focused noteId', async () => {
    const first = noteTarget('target-a', 'Duplicate', 1);
    const second = noteTarget('target-b', 'Duplicate', 1);
    await render([first, second]);
    await act(async () => buttons()[1].focus());
    await act(async () => buttons()[1].dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    })));
    expect(selected).toHaveBeenCalledTimes(1);
    expect(selected).toHaveBeenCalledWith(second);
  });

  it('announces the active duplicate option from the focused combobox and Enter selects its exact ID', async () => {
    const first = noteTarget('accessible-a', 'Duplicate', 1);
    const second = noteTarget('accessible-b', 'Duplicate', 1);
    await render([first, second], '', vi.fn());
    const input = container.querySelector<HTMLInputElement>('[role="combobox"]')!;
    expect(document.activeElement).toBe(input);
    expect(input.getAttribute('aria-autocomplete')).toBe('list');
    expect(input.getAttribute('aria-controls')).toBe(container.querySelector('[role="listbox"]')?.id);
    const initialActive = document.getElementById(input.getAttribute('aria-activedescendant')!)!;
    expect(initialActive.getAttribute('aria-selected')).toBe('true');
    expect(initialActive.getAttribute('aria-label')).toContain('ID accessible-a');

    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowDown', bubbles: true, cancelable: true,
    })));
    const nextActive = document.getElementById(input.getAttribute('aria-activedescendant')!)!;
    expect(nextActive.getAttribute('aria-selected')).toBe('true');
    expect(nextActive.getAttribute('aria-label')).toContain('ID accessible-b');
    await act(async () => input.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'Enter', bubbles: true, cancelable: true,
    })));
    expect(selected).toHaveBeenCalledWith(second);
  });

  it('filters Unicode queries and excludes stale/deleted publication candidates', async () => {
    const available = noteTarget('available', '東京 ノート', 5);
    await render([
      available,
      noteTarget('deleted', '東京 ノート', 99, false),
      noteTarget('other', '한국어 노트', 7),
    ], '東京');
    expect(buttons()).toHaveLength(1);
    expect(buttons()[0].textContent).toContain('東京 ノート');
    await act(async () => buttons()[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true })));
    expect(selected).toHaveBeenCalledWith(available);
    expect(selected.mock.calls[0][0].id).toBe('available');
  });
});
