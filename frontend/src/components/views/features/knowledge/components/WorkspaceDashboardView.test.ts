// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { WorkspaceDashboardView } from './WorkspaceDashboardView';

vi.mock('../../../../../lib/i18n', () => ({
  useTranslation: () => ({
    t: (key: string) => ({
      wsPinnedWorkspaces: 'Pinned workspaces',
      wsPinnedEmpty: 'No pinned workspaces',
      wsRecentWork: 'Recent work',
      wsRecentWorkEmpty: 'No recent work',
      wsResumeWorkspace: 'Resume workspace',
      wsResumeEmpty: 'No workspace to resume',
      wsRecentNotes: 'Recent notes',
      wsEdited: 'Edited {time}',
      wsQuickActions: 'Quick actions',
      wsNewNote: 'New note',
      wsNewDatabaseView: 'New database view',
      wsOpenSearch: 'Open search',
      wsOpenCosmos: 'Open Cosmos',
      k113CrossDomainActivity: 'Cross-domain activity',
    }[key] ?? key),
  }),
}));
vi.mock('../../../../../hooks/useViewportLayout', () => ({
  useViewportLayout: () => ({ isMobile: false, isTablet: false, isNarrow: false }),
}));

const colors = {
  wrap: '#fff', sidebar: '#fff', sideBdr: '#ddd', notelist: '#fff', editor: '#fff', toolbar: '#fff',
  toolBdr: '#ddd', card: '#fff', cardHov: '#eee', cardAct: '#eee', cardActBdr: '#00f', text: '#111',
  textMuted: '#555', textFaint: '#777', accent: '#00f', accentBg: '#eef', input: '#fff', inputBdr: '#ddd',
} as NoteChromeColors;

describe('WorkspaceDashboardView Notes-native dashboard', () => {
  let root: Root;
  let host: HTMLDivElement;

  afterEach(() => {
    if (root) act(() => root.unmount());
    host?.remove();
  });

  it('omits cross-domain activity while retaining recent Notes and explicit note navigation', () => {
    const onSelectNote = vi.fn();
    const recentNote: NoteBase = {
      id: 'note-1', title: 'Native learning note', body: '', updatedAt: 1_800_000_000_000,
      folderId: null, deletedAt: null,
    };
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);

    act(() => root.render(createElement(WorkspaceDashboardView, {
      colors,
      dashboard: { id: 'default', name: 'Notes dashboard', widgets: [] },
      pinned: [],
      recent: [],
      resumeWorkspace: null,
      recentNotes: [recentNote],
      onActivateWorkspace: vi.fn(),
      onResumeWorkspace: vi.fn(),
      onSelectNote,
      quickActions: {
        onNewNote: vi.fn(), onNewDatabaseView: vi.fn(), onOpenSearch: vi.fn(), onOpenCosmos: vi.fn(),
      },
      signalPanel: createElement('div', { 'data-testid': 'notes-native-signal' }, 'Notes overview'),
    })));

    expect(host.textContent).toContain('Notes dashboard');
    expect(host.textContent).toContain('Recent notes');
    expect(host.textContent).toContain('Native learning note');
    expect(host.textContent).not.toContain('Cross-domain activity');
    expect(host.querySelector('[data-testid="notes-native-signal"]')).not.toBeNull();

    const noteButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Native learning note'));
    expect(noteButton).toBeDefined();
    act(() => noteButton?.click());
    expect(onSelectNote).toHaveBeenCalledTimes(1);
    expect(onSelectNote).toHaveBeenCalledWith('note-1');
  });
});
