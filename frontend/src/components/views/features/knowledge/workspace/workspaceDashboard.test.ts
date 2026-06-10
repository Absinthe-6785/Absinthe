// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { WorkspaceDashboardView } from '../components/WorkspaceDashboardView';
import { activateDashboardWorkspace } from './workspaceActivation';
import {
  getWorkspaceActiveId,
  getWorkspaceFilterSource,
  isDashboardActive,
  applyWorkspaceListFilter,
} from './resolveWorkspaceFilter';
import {
  INACTIVE_WORKSPACE,
  isSameWorkspaceActivation,
  isWorkspaceActivation,
  isActiveWorkspaceActivation,
  normalizeWorkspaceActivation,
  normalizeWorkspaceSession,
} from './workspaceModels';
import {
  DEFAULT_WORKSPACE_DASHBOARD,
  workspaceKindLabel,
  formatRecentTimestamp,
} from './workspaceDashboardModels';
import {
  loadWorkspaceSession,
  saveWorkspaceSession,
  workspaceSessionFromActivation,
  WORKSPACE_SESSION_KEY,
} from './workspaceSessionStorage';
import { restoreWorkspaceActivation, workspaceRefFromActivation } from './resolveWorkspaceRef';
import { isWorkspaceKindActive } from './workspaceActivation';

const colors: NoteChromeColors = {
  wrap: '#fff',
  sidebar: '#fff',
  sideBdr: '#ddd',
  notelist: '#fff',
  editor: '#fff',
  text: '#111',
  textMuted: '#666',
  textFaint: '#999',
  accent: '#8B5CF6',
  accentBg: '#eee',
  card: '#fff',
  cardHov: '#f5f5f5',
  cardAct: '#eee',
  cardActBdr: '#8B5CF6',
  input: '#fff',
  inputBdr: '#ddd',
  toolbar: '#fff',
  toolBdr: '#ddd',
  badge: '#eee',
  badgeTxt: '#333',
  tag: '#eee',
  tagTxt: '#333',
  green: '#0a0',
  danger: '#c00',
};

const emptyContext = { savedViews: [], ruleCollections: [], databaseViews: [] };

function note(id: string, title: string, updatedAt: number): NoteBase {
  return { id, title, body: '', updatedAt, folderId: null, deletedAt: null };
}

describe('dashboard activation', () => {
  it('activates dashboard with cleared search query', () => {
    expect(activateDashboardWorkspace()).toEqual({
      activation: { kind: 'dashboard' },
      searchQuery: '',
    });
  });

  it('is recognized as an active workspace kind', () => {
    expect(isWorkspaceKindActive({ kind: 'dashboard' }, 'dashboard')).toBe(true);
    expect(isDashboardActive({ kind: 'dashboard' })).toBe(true);
    expect(isActiveWorkspaceActivation({ kind: 'dashboard' })).toBe(true);
  });

  it('uses none filter source and no active id', () => {
    const activation = { kind: 'dashboard' as const };
    expect(getWorkspaceFilterSource(activation)).toBe('none');
    expect(getWorkspaceActiveId(activation)).toBeNull();
  });

  it('does not filter note lists', () => {
    const notes = [note('a', 'Alpha', 1)];
    const filtered = applyWorkspaceListFilter(notes, { kind: 'dashboard' }, {
      service: {} as never,
      vaultNotes: notes,
      ruleCollections: [],
    });
    expect(filtered).toEqual(notes);
  });
});

describe('dashboard normalization and compatibility', () => {
  it('validates and normalizes dashboard activation', () => {
    expect(isWorkspaceActivation({ kind: 'dashboard' })).toBe(true);
    expect(normalizeWorkspaceActivation({ kind: 'dashboard' })).toEqual({ kind: 'dashboard' });
  });

  it('compares dashboard activations', () => {
    expect(isSameWorkspaceActivation({ kind: 'dashboard' }, { kind: 'dashboard' })).toBe(true);
    expect(isSameWorkspaceActivation({ kind: 'dashboard' }, INACTIVE_WORKSPACE)).toBe(false);
  });

  it('restores dashboard activation from session', () => {
    expect(restoreWorkspaceActivation({ kind: 'dashboard' }, emptyContext)).toEqual({
      activation: { kind: 'dashboard' },
      searchQuery: '',
    });
  });

  it('does not resolve dashboard to a workspace ref', () => {
    expect(workspaceRefFromActivation({ kind: 'dashboard' }, emptyContext)).toBeNull();
  });
});

describe('dashboard session resume tracking', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('preserves resume activation when entering dashboard', () => {
    const previous = workspaceSessionFromActivation({ kind: 'database-view', id: 'db-1' });
    const session = workspaceSessionFromActivation({ kind: 'dashboard' }, previous);
    expect(session.activation).toEqual({ kind: 'dashboard' });
    expect(session.resumeActivation).toEqual({ kind: 'database-view', id: 'db-1' });
  });

  it('updates resume activation when leaving dashboard for another workspace', () => {
    const fromDashboard = workspaceSessionFromActivation(
      { kind: 'dashboard' },
      workspaceSessionFromActivation({ kind: 'rule-collection', id: 'rc-1' }),
    );
    const next = workspaceSessionFromActivation({ kind: 'saved-view', id: 'sv-1' }, fromDashboard);
    expect(next.resumeActivation).toEqual({ kind: 'saved-view', id: 'sv-1' });
  });

  it('loads sessions without resumeActivation for backward compatibility', () => {
    const legacy = normalizeWorkspaceSession({
      activation: { kind: 'smart-collection', id: 'recent' },
      updatedAt: 100,
    });
    expect(legacy?.resumeActivation).toBeUndefined();
    saveWorkspaceSession(legacy!);
    expect(loadWorkspaceSession()).toEqual(legacy);
  });

  it('persists dashboard activation in session storage', () => {
    saveWorkspaceSession(workspaceSessionFromActivation({ kind: 'dashboard' }));
    expect(localStorage.getItem(WORKSPACE_SESSION_KEY)).toContain('"kind":"dashboard"');
    expect(loadWorkspaceSession()?.activation).toEqual({ kind: 'dashboard' });
  });
});

describe('dashboard model helpers', () => {
  it('exposes the fixed phase-1 dashboard layout', () => {
    expect(DEFAULT_WORKSPACE_DASHBOARD.id).toBe('default');
    expect(DEFAULT_WORKSPACE_DASHBOARD.widgets.map(w => w.id)).toEqual([
      'pinned-workspaces',
      'recent-work',
      'resume-last-workspace',
      'recent-notes',
      'quick-actions',
    ]);
  });

  it('labels workspace kinds for widget display', () => {
    expect(workspaceKindLabel('database-view')).toBe('Database');
    expect(workspaceKindLabel('saved-view')).toBe('Saved View');
  });

  it('formats recent timestamps', () => {
    expect(formatRecentTimestamp(Date.now() - 30_000)).toBe('Just now');
  });
});

describe('WorkspaceDashboardView', () => {
  it('renders widgets and wires interactions', () => {
    const onActivateWorkspace = vi.fn();
    const onResumeWorkspace = vi.fn();
    const onSelectNote = vi.fn();
    const quickActions = {
      onNewNote: vi.fn(),
      onNewDatabaseView: vi.fn(),
      onOpenSearch: vi.fn(),
      onOpenGraph: vi.fn(),
    };

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(WorkspaceDashboardView, {
        colors,
        dashboard: DEFAULT_WORKSPACE_DASHBOARD,
        pinned: [{
          kind: 'database-view',
          id: 'db-1',
          name: 'Tasks',
        }],
        recent: [{
          workspace: { kind: 'saved-view', id: 'sv-1', name: 'Study' },
          lastOpenedAt: Date.now() - 120_000,
        }],
        resumeWorkspace: { kind: 'rule-collection', id: 'rc-1', name: 'Active' },
        recentNotes: [note('n-1', 'Meeting Notes', Date.now())],
        onActivateWorkspace,
        onResumeWorkspace,
        onSelectNote,
        quickActions,
      }));
    });

    expect(container.textContent).toContain('Dashboard');
    expect(container.textContent).toContain('Pinned Workspaces');
    expect(container.textContent).toContain('Tasks');
    expect(container.textContent).toContain('Recent Work');
    expect(container.textContent).toContain('Study');
    expect(container.textContent).toContain('Resume Last Workspace');
    expect(container.textContent).toContain('Meeting Notes');
    expect(container.textContent).toContain('New Note');

    const buttons = [...container.querySelectorAll('button')];
    buttons.find(b => b.textContent?.includes('Tasks'))?.click();
    expect(onActivateWorkspace).toHaveBeenCalledWith(expect.objectContaining({ id: 'db-1' }));

    buttons.find(b => b.textContent?.includes('Continue where you left off'))?.click();
    expect(onResumeWorkspace).toHaveBeenCalled();

    buttons.find(b => b.textContent?.includes('Meeting Notes'))?.click();
    expect(onSelectNote).toHaveBeenCalledWith('n-1');

    buttons.find(b => b.textContent === 'Open Graph')?.click();
    expect(quickActions.onOpenGraph).toHaveBeenCalled();
  });
});
