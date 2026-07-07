// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useNotesStore } from '../../store/useNotesStore';
import { NotesOverviewSignalPanelContainer, selectNotesOverviewSignalPanelInput } from './NotesOverviewSignalPanelContainer';

function note(
  id: string,
  title: string,
  updatedAt: number,
  overrides: Partial<{
    body: string;
    createdAt: number;
    deletedAt: number | null;
    starred: boolean;
  }> = {},
) {
  return {
    id,
    title,
    body: overrides.body ?? '',
    updatedAt,
    createdAt: overrides.createdAt,
    deletedAt: overrides.deletedAt ?? null,
    folderId: null,
    starred: overrides.starred,
  };
}

function resetStore() {
  useNotesStore.setState({
    notes: [],
    folders: [],
    activeNoteId: null,
    activeFolderId: null,
    isSyncing: false,
    syncError: null,
    savedAt: null,
  });
}

async function renderContainer(): Promise<{ host: HTMLDivElement; root: Root }> {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(createElement(NotesOverviewSignalPanelContainer));
  });

  return { host, root };
}

describe('NotesOverviewSignalPanelContainer', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    document.body.innerHTML = '';
    resetStore();
  });

  it('renders the Signal Panel with empty local notes', async () => {
    const { host, root } = await renderContainer();

    expect(host.querySelector('[data-testid="notes-overview-signal-panel-container"]')).not.toBeNull();
    expect(host.querySelector('[data-notes-overview-signal-panel]')).not.toBeNull();
    expect(host.textContent).toContain('Empty vault');
    expect(host.textContent).toContain('Read-only local signal from 0 local notes.');

    await act(async () => root.unmount());
  });

  it('renders recent local notes through adapter props', async () => {
    useNotesStore.setState({
      notes: [
        note('older', 'Older local note', 1000, { body: 'body should stay private' }),
        note('newer', 'Newer local note', 3000),
        note('deleted', 'Deleted local note', 4000, { deletedAt: 5000 }),
      ],
      activeNoteId: 'newer',
    });

    const { host, root } = await renderContainer();

    expect(host.textContent).toContain('Newer local note');
    expect(host.textContent).toContain('Older local note');
    expect(host.textContent).not.toContain('Deleted local note');
    expect(host.textContent).not.toContain('body should stay private');
    expect(host.querySelector('[data-active-writing-state="active"]')).not.toBeNull();

    await act(async () => root.unmount());
  });

  it('handles missing optional fields without throwing', async () => {
    useNotesStore.setState({
      notes: [
        note('untitled', '', Number.NaN, { body: 'unrendered body' }),
      ],
      activeNoteId: 'missing',
    });

    const { host, root } = await renderContainer();

    expect(host.textContent).toContain('Untitled note');
    expect(host.querySelector('[data-active-writing-state="idle"]')).not.toBeNull();
    expect(host.textContent).not.toContain('unrendered body');

    await act(async () => root.unmount());
  });

  it('does not write to the Notes store while rendering', async () => {
    useNotesStore.setState({
      notes: [note('stable', 'Stable note', 2000)],
      activeNoteId: 'stable',
    });
    const before = useNotesStore.getState();

    const { host, root } = await renderContainer();

    expect(host.querySelectorAll('button')).toHaveLength(0);
    expect(useNotesStore.getState().notes).toBe(before.notes);
    expect(useNotesStore.getState().activeNoteId).toBe(before.activeNoteId);

    await act(async () => root.unmount());
  });

  it('selects only adapter-safe local metadata from the store shape', () => {
    const input = selectNotesOverviewSignalPanelInput({
      notes: [
        {
          ...note('metadata-only', 'Metadata only', 1000, { body: 'secret body' }),
          properties: { tag: 'private' },
          relations: { link: ['other'] },
        },
      ],
      activeNoteId: 'metadata-only',
    });

    expect(input).toEqual({
      notes: [
        {
          id: 'metadata-only',
          title: 'Metadata only',
          updatedAt: 1000,
          createdAt: undefined,
          deletedAt: null,
          starred: undefined,
        },
      ],
      activeNoteId: 'metadata-only',
    });
    expect(JSON.stringify(input)).not.toContain('secret body');
    expect(JSON.stringify(input)).not.toContain('private');
    expect(JSON.stringify(input)).not.toContain('relations');
  });
});
