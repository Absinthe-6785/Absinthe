// @vitest-environment happy-dom
import { createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NotesPixelCosmosEmptyState } from './NotesPixelCosmosEmptyState';

const colors = {
  accent: '#7c3aed',
  card: '#ffffff',
  editor: '#fafafa',
  inputBdr: '#d4d4d8',
  sideBdr: '#e4e4e7',
  text: '#18181b',
  textMuted: '#52525b',
  textFaint: '#71717a',
};

function renderEmptyState(overrides: Partial<{
  onCreateNote: () => void;
  onOpenTodaysNote: () => void;
  onImportVault: () => void;
}> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const onCreateNote = overrides.onCreateNote ?? vi.fn();
  const onOpenTodaysNote = overrides.onOpenTodaysNote ?? vi.fn();
  const onImportVault = overrides.onImportVault ?? vi.fn();

  act(() => {
    root.render(createElement(NotesPixelCosmosEmptyState, {
      colors,
      onCreateNote,
      onOpenTodaysNote,
      onImportVault,
    }));
  });

  return { root, host, onCreateNote, onOpenTodaysNote, onImportVault };
}

function cleanup(root: Root, host: HTMLElement) {
  act(() => root.unmount());
  host.remove();
}

function buttonByText(host: HTMLElement, text: string): HTMLButtonElement {
  const button = Array.from(host.querySelectorAll('button'))
    .find(item => item.textContent?.trim() === text);
  if (!(button instanceof HTMLButtonElement)) throw new Error(`Button not found: ${text}`);
  return button;
}

describe('NotesPixelCosmosEmptyState', () => {
  it('renders readable Notes/Cosmos empty-state text and a literal create-note CTA', () => {
    const { root, host } = renderEmptyState();

    expect(host.querySelector('[data-notes-pixel-cosmos-empty]')).toBeTruthy();
    expect(host.querySelector('[data-product-empty="vault-empty"]')).toBeTruthy();
    expect(host.textContent).toContain('Notes / Living Cosmos');
    expect(host.textContent).toContain('No signals detected yet');
    expect(host.textContent).toContain('Create your first note to start mapping your personal cosmos.');
    expect(host.textContent).toContain('signals, nodes, and traces');
    expect(host.textContent).toContain('Create note');
    expect(host.textContent).not.toContain('Upload all');
    expect(host.textContent).not.toContain('Run queue');
    expect(host.textContent).not.toContain('Recover all');

    cleanup(root, host);
  });

  it('keeps actions native, labeled, focus-ringed, and wired to existing callbacks', () => {
    const { root, host, onCreateNote, onOpenTodaysNote, onImportVault } = renderEmptyState();

    const createButton = buttonByText(host, 'Create note');
    const todayButton = buttonByText(host, "Open today's note");
    const importButton = buttonByText(host, 'Import backup');

    expect(createButton.type).toBe('button');
    expect(todayButton.type).toBe('button');
    expect(importButton.type).toBe('button');
    expect(createButton.className).toContain('abs-focus-ring');
    expect(todayButton.className).toContain('abs-focus-ring');
    expect(importButton.className).toContain('abs-focus-ring');

    act(() => createButton.click());
    act(() => todayButton.click());
    act(() => importButton.click());

    expect(onCreateNote).toHaveBeenCalledTimes(1);
    expect(onOpenTodaysNote).toHaveBeenCalledTimes(1);
    expect(onImportVault).toHaveBeenCalledTimes(1);
    cleanup(root, host);
  });

  it('uses CSS-only motif elements without replacing required text', () => {
    const html = renderToStaticMarkup(createElement(NotesPixelCosmosEmptyState, {
      colors,
      onCreateNote: () => {},
    }));

    expect(html).toContain('data-k212-cosmos-motif');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('No signals detected yet');
    expect(html).toContain('Create note');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<svg');
    expect(html).not.toContain('@font-face');
  });
});
