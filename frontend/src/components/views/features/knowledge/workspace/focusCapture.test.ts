// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { WorkspaceDashboardView } from '../components/WorkspaceDashboardView';
import { DEFAULT_WORKSPACE_DASHBOARD } from './workspaceDashboardModels';
import {
  createFocusPreset,
  deleteFocusPreset,
  findFocusPreset,
} from './focusPresets';
import {
  clearFocusPresets,
  FOCUS_PRESETS_KEY,
  loadFocusPresets,
  saveFocusPresets,
} from './focusPresetsStorage';
import {
  focusUiFromPreset,
  INACTIVE_FOCUS_SESSION,
  normalizeFocusPreset,
  normalizeFocusPresets,
} from './focusModeModels';
import { createInboxNote, INBOX_TAG } from './quickCapture';
import { TASK_TEMPLATES } from './taskTemplateRegistry';
import { getCaptureTypeTag, DEFAULT_QUICK_CAPTURE_MODEL } from './quickCaptureModels';
import { hasTag, listTags } from '../tags/noteTags';
import { restoreWorkspaceActivation } from './resolveWorkspaceRef';
import { INACTIVE_WORKSPACE } from './workspaceModels';

function note(id = 'n-1', title = 'Test'): NoteBase {
  return { id, title, body: '', updatedAt: 0, folderId: null, deletedAt: null };
}

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

const workspaceTarget = {
  kind: 'saved-view' as const,
  id: 'sv-1',
  name: 'Study',
};

describe('focus presets', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates and finds presets', () => {
    const presets = createFocusPreset([], {
      name: 'JLPT Focus',
      workspace: { kind: 'saved-view', id: 'sv-1' },
    });
    expect(presets).toHaveLength(1);
    expect(findFocusPreset(presets, presets[0].id)?.name).toBe('JLPT Focus');
  });

  it('deletes presets', () => {
    const created = createFocusPreset([], {
      name: 'Study',
      workspace: { kind: 'rule-collection', id: 'rc-1' },
    });
    const id = created[0].id;
    expect(deleteFocusPreset(created, id)).toEqual([]);
  });

  it('persists presets to localStorage', () => {
    const presets = createFocusPreset([], {
      name: 'Deep Work',
      workspace: { kind: 'database-view', id: 'db-1' },
      hideSidebar: true,
      hideSecondaryPanels: false,
      hideGraph: true,
    });
    saveFocusPresets(presets);
    expect(localStorage.getItem(FOCUS_PRESETS_KEY)).toContain('Deep Work');
    expect(loadFocusPresets()[0].hideGraph).toBe(true);
  });

  it('normalizes invalid preset payloads', () => {
    expect(normalizeFocusPresets([{ bad: true }])).toEqual([]);
    const preset = normalizeFocusPreset({
      id: 'focus-1',
      name: 'Focus',
      workspace: { kind: 'smart-collection', id: 'recent' },
      hideSidebar: true,
      hideSecondaryPanels: true,
      hideGraph: false,
    });
    expect(preset?.workspace.id).toBe('recent');
  });

  it('derives UI preferences from preset', () => {
    const preset = normalizeFocusPreset({
      id: 'focus-1',
      name: 'Focus',
      workspace: { kind: 'saved-view', id: 'sv-1' },
      hideSidebar: true,
      hideSecondaryPanels: false,
      hideGraph: true,
    })!;
    expect(focusUiFromPreset(preset)).toEqual({
      hideSidebar: true,
      hideSecondaryPanels: false,
      hideGraph: true,
    });
  });

  it('clears stored presets', () => {
    saveFocusPresets(createFocusPreset([], {
      name: 'Temp',
      workspace: { kind: 'saved-view', id: 'sv-1' },
    }));
    clearFocusPresets();
    expect(loadFocusPresets()).toEqual([]);
  });
});

describe('focus session compatibility', () => {
  it('starts inactive by default', () => {
    expect(INACTIVE_FOCUS_SESSION).toEqual({});
  });

  it('restores prior workspace activation on exit path', () => {
    const context = {
      savedViews: [{ id: 'sv-1', name: 'Study', query: 'tag:study' }],
      ruleCollections: [],
      databaseViews: [],
    };
    const prior = { kind: 'saved-view' as const, id: 'sv-1' };
    const restored = restoreWorkspaceActivation(prior, context);
    expect(restored?.activation).toEqual(prior);
    expect(restored?.searchQuery).toBe('tag:study');
    expect(restoreWorkspaceActivation(INACTIVE_WORKSPACE, context)).toBeNull();
  });
});

describe('quick capture', () => {
  it('tags inbox notes with optional capture type', () => {
    const inboxOnly = createInboxNote(note());
    expect(hasTag(inboxOnly, INBOX_TAG)).toBe(true);
    expect(listTags(inboxOnly)).toEqual(['inbox']);

    const idea = createInboxNote(note(), { captureType: 'idea' });
    expect(hasTag(idea, 'inbox')).toBe(true);
    expect(hasTag(idea, 'idea')).toBe(true);

    const vocabulary = createInboxNote(note(), { captureType: 'vocabulary' });
    expect(hasTag(vocabulary, 'vocabulary')).toBe(true);

    const task = createInboxNote(note(), { captureType: 'task' });
    expect(hasTag(task, 'task')).toBe(true);

    const research = createInboxNote(note(), { captureType: 'research' });
    expect(hasTag(research, 'research')).toBe(true);
  });

  it('exposes capture model defaults', () => {
    expect(DEFAULT_QUICK_CAPTURE_MODEL.inboxTag).toBe('inbox');
    expect(DEFAULT_QUICK_CAPTURE_MODEL.types.map(t => t.id)).toEqual([
      'note', 'idea', 'vocabulary', 'task', 'research', 'event',
    ]);
    expect(getCaptureTypeTag('note')).toBeUndefined();
    expect(getCaptureTypeTag('task')).toBe('task');
  });
});

describe('WorkspaceDashboardView focus and capture widgets', () => {
  it('renders focus presets and quick capture controls', () => {
    const onActivatePreset = vi.fn();
    const onCapture = vi.fn();
    const preset = createFocusPreset([], {
      name: 'Study Focus',
      workspace: { kind: 'saved-view', id: 'sv-1' },
    })[0];

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    act(() => {
      root.render(createElement(WorkspaceDashboardView, {
        colors,
        dashboard: DEFAULT_WORKSPACE_DASHBOARD,
        pinned: [],
        recent: [],
        resumeWorkspace: null,
        recentNotes: [],
        onActivateWorkspace: vi.fn(),
        onResumeWorkspace: vi.fn(),
        onSelectNote: vi.fn(),
        quickActions: {
          onNewNote: vi.fn(),
          onNewDatabaseView: vi.fn(),
          onOpenSearch: vi.fn(),
          onOpenGraph: vi.fn(),
        },
        focus: {
          presets: [preset],
          presetTargets: { [preset.id]: workspaceTarget },
          workspaceOptions: [workspaceTarget],
          onCreatePreset: vi.fn(),
          onDeletePreset: vi.fn(),
          onActivatePreset,
          onExitPreset: vi.fn(),
        },
        quickCapture: {
          taskTemplates: TASK_TEMPLATES,
          onCapture,
        },
      }));
    });

    expect(container.textContent).toContain('집중 프리셋');
    expect(container.textContent).toContain('Study Focus');
    expect(container.textContent).toContain('빠른 캡처');

    const startButton = [...container.querySelectorAll('button')].find(
      b => b.textContent === '시작',
    );
    startButton?.click();
    expect(onActivatePreset).toHaveBeenCalledWith(preset.id);

    expect(container.querySelector('input[placeholder="제목"]')).toBeTruthy();
    expect(container.querySelector('select')).toBeTruthy();
    const captureButton = [...container.querySelectorAll('button')].find(
      b => b.textContent === '캡처',
    );
    expect(captureButton).toBeTruthy();
  });
});
