// @vitest-environment happy-dom
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { StrictMode, createElement } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FolderDeleteButton } from './FolderDeleteButton';
import {
  folderDeleteConfirmationMessage,
  folderDeletionImpactFromState,
} from './folderDeletionPresentation';

vi.mock('../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'nvDeleteFolderAction' ? 'Delete folder {name}' : key,
  }),
}));

describe('Folder delete presentation', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
  });

  it('exposes a folder-specific accessible name and a focusable 24px target', () => {
    const onRequestDelete = vi.fn();
    act(() => root.render(createElement(
      StrictMode,
      null,
      createElement(FolderDeleteButton, { folderName: 'Research', color: '#666', onRequestDelete }),
    )));

    const button = host.querySelector<HTMLButtonElement>('[data-folder-delete-action]')!;
    expect(button.getAttribute('aria-label')).toBe('Delete folder Research');
    expect(button.getAttribute('title')).toBe('Delete folder Research');
    expect(button.classList.contains('abs-focus-ring')).toBe(true);
    expect(button.style.minWidth).toBe('24px');
    expect(button.style.minHeight).toBe('24px');
    button.focus();
    expect(document.activeElement).toBe(button);

    act(() => button.click());
    expect(onRequestDelete).toHaveBeenCalledTimes(1);
  });

  it('keeps the opacity-hidden control visible for keyboard focus and uses 44px mobile targets', () => {
    const styles = readFileSync(join(process.cwd(), 'src', 'components', 'views', 'noteview', 'useNoteViewStyles.ts'), 'utf8');
    expect(styles).toContain('.folder-del:focus-visible{opacity:1}');
    expect(styles).toContain('.mobile-sidebar-drawer .folder-del{width:44px;height:44px;min-width:44px;min-height:44px;opacity:1}');
  });

  it.each([0, 1, 3])('communicates the current affected-note count (%i)', count => {
    const message = folderDeleteConfirmationMessage(
      key => key === 'nvDeleteFolderConfirm'
        ? 'Delete folder “{name}”? The folder will be deleted. Affected notes: {count}. Note contents will remain, but those notes will become unassigned.'
        : key,
      'Research',
      count,
    );

    expect(message).toContain('Delete folder “Research”?');
    expect(message).toContain(`Affected notes: ${count}.`);
    expect(message).toContain('Note contents will remain');
    expect(message).toContain('become unassigned');
  });

  it('recomputes impact from current local Notes state instead of stale UI text', () => {
    const state = {
      folders: [{ id: 'research', name: 'Research renamed' }],
      notes: [
        { folderId: 'research' },
        { folderId: null },
        { folderId: 'research' },
      ],
    };

    expect(folderDeletionImpactFromState(state, 'research')).toEqual({
      folderName: 'Research renamed',
      affectedNoteCount: 2,
    });
  });
});
