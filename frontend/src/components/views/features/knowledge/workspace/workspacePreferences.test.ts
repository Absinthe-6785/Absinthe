// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  addPinnedWorkspace,
  clearRecentWork,
  DEFAULT_MAX_RECENT,
  DEFAULT_WORKSPACE_PREFERENCES,
  isWorkspacePinned,
  normalizeWorkspacePreferences,
  pruneWorkspacePreferences,
  recordRecentWorkspace,
  removePinnedWorkspace,
  reorderPinnedWorkspaces,
  togglePinnedWorkspace,
} from './workspacePreferences';
import {
  loadWorkspacePreferences,
  saveWorkspacePreferences,
  WORKSPACE_PREFS_KEY,
} from './workspacePreferencesStorage';
import {
  restoreWorkspaceActivation,
  resolveWorkspaceRef,
} from './resolveWorkspaceRef';
import { loadWorkspaceSession, saveWorkspaceSession, WORKSPACE_SESSION_KEY } from './workspaceSessionStorage';
import { workspaceSessionFromActivation } from './workspaceSessionStorage';

const savedViewRef = {
  kind: 'saved-view' as const,
  id: 'sv-1',
  name: 'Study',
  subtitle: 'tag:study',
};

const ruleRef = {
  kind: 'rule-collection' as const,
  id: 'rc-1',
  name: 'Active Work',
  subtitle: 'tag:work',
};

describe('normalizeWorkspacePreferences', () => {
  it('returns defaults for invalid payloads', () => {
    expect(normalizeWorkspacePreferences(null)).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
    expect(normalizeWorkspacePreferences({})).toEqual(DEFAULT_WORKSPACE_PREFERENCES);
  });

  it('normalizes pinned and recent entries with dedupe', () => {
    const prefs = normalizeWorkspacePreferences({
      pinned: [
        savedViewRef,
        savedViewRef,
        { kind: 'bad', id: 'x', name: 'Bad' },
      ],
      recent: [
        { workspace: ruleRef, lastOpenedAt: 100 },
        { workspace: ruleRef, lastOpenedAt: 200 },
      ],
    });
    expect(prefs.pinned).toHaveLength(1);
    expect(prefs.recent).toHaveLength(1);
    expect(prefs.recent[0]?.lastOpenedAt).toBe(100);
  });
});

describe('pinned workspace operations', () => {
  it('adds, dedupes, and removes pins', () => {
    let prefs = addPinnedWorkspace(DEFAULT_WORKSPACE_PREFERENCES, savedViewRef);
    prefs = addPinnedWorkspace(prefs, ruleRef);
    expect(prefs.pinned).toHaveLength(2);
    prefs = addPinnedWorkspace(prefs, { ...savedViewRef, name: 'Study Updated' });
    expect(prefs.pinned).toHaveLength(2);
    expect(prefs.pinned[1]?.name).toBe('Study Updated');
    expect(isWorkspacePinned(prefs, 'saved-view', 'sv-1')).toBe(true);
    prefs = removePinnedWorkspace(prefs, 'saved-view', 'sv-1');
    expect(isWorkspacePinned(prefs, 'saved-view', 'sv-1')).toBe(false);
  });

  it('reorders pinned workspaces', () => {
    let prefs = addPinnedWorkspace(DEFAULT_WORKSPACE_PREFERENCES, savedViewRef);
    prefs = addPinnedWorkspace(prefs, ruleRef);
    prefs = reorderPinnedWorkspaces(prefs, 1, 0);
    expect(prefs.pinned.map(ref => ref.id)).toEqual(['rc-1', 'sv-1']);
  });

  it('toggles pin state', () => {
    const pinned = togglePinnedWorkspace(DEFAULT_WORKSPACE_PREFERENCES, savedViewRef);
    expect(isWorkspacePinned(pinned, 'saved-view', 'sv-1')).toBe(true);
    const unpinned = togglePinnedWorkspace(pinned, savedViewRef);
    expect(isWorkspacePinned(unpinned, 'saved-view', 'sv-1')).toBe(false);
  });
});

describe('recent work operations', () => {
  it('records MRU entries with dedupe and max size', () => {
    let prefs = DEFAULT_WORKSPACE_PREFERENCES;
    prefs = recordRecentWorkspace(prefs, savedViewRef, 3, 100);
    prefs = recordRecentWorkspace(prefs, ruleRef, 3, 200);
    prefs = recordRecentWorkspace(prefs, {
      kind: 'database-view',
      id: 'db-1',
      name: 'Projects',
    }, 3, 300);
    prefs = recordRecentWorkspace(prefs, savedViewRef, 3, 400);
    expect(prefs.recent.map(entry => entry.workspace.id)).toEqual(['sv-1', 'db-1', 'rc-1']);
    expect(prefs.recent[0]?.lastOpenedAt).toBe(400);
  });

  it('respects default max recent size', () => {
    let prefs = DEFAULT_WORKSPACE_PREFERENCES;
    for (let i = 0; i < DEFAULT_MAX_RECENT + 5; i += 1) {
      prefs = recordRecentWorkspace(prefs, {
        kind: 'saved-view',
        id: `sv-${i}`,
        name: `View ${i}`,
      }, DEFAULT_MAX_RECENT, i);
    }
    expect(prefs.recent).toHaveLength(DEFAULT_MAX_RECENT);
  });

  it('clears recent history', () => {
    const prefs = clearRecentWork(recordRecentWorkspace(DEFAULT_WORKSPACE_PREFERENCES, savedViewRef));
    expect(prefs.recent).toEqual([]);
  });
});

describe('pruneWorkspacePreferences', () => {
  it('removes invalid pinned and recent refs', () => {
    const prefs = normalizeWorkspacePreferences({
      pinned: [savedViewRef, ruleRef],
      recent: [{ workspace: savedViewRef, lastOpenedAt: 1 }],
    });
    const pruned = pruneWorkspacePreferences(prefs, (kind, id) => kind === 'saved-view' && id === 'sv-1');
    expect(pruned.pinned.map(ref => ref.id)).toEqual(['sv-1']);
    expect(pruned.recent).toHaveLength(1);
  });
});

describe('workspace preferences persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists pinned and recent separately from workspace entities', () => {
    const prefs = addPinnedWorkspace(
      recordRecentWorkspace(DEFAULT_WORKSPACE_PREFERENCES, savedViewRef),
      ruleRef,
    );
    saveWorkspacePreferences(prefs);
    const raw = localStorage.getItem(WORKSPACE_PREFS_KEY);
    expect(raw).toBeTruthy();
    expect(raw).not.toContain('note-saved-views-v1');
    expect(loadWorkspacePreferences().pinned).toHaveLength(1);
    expect(loadWorkspacePreferences().recent).toHaveLength(1);
  });
});

describe('restoreWorkspaceActivation', () => {
  const context = {
    savedViews: [{ id: 'sv-1', name: 'Study', query: 'tag:study' }],
    ruleCollections: [{ id: 'rc-1', name: 'Work', query: 'tag:work' }],
    databaseViews: [{
      id: 'db-1',
      name: 'Board',
      query: 'tag:project',
      presentation: 'board' as const,
      presentationConfig: { type: 'board' as const, groupBy: 'status' },
    }],
  };

  it('restores saved views with search binding', () => {
    const restored = restoreWorkspaceActivation({ kind: 'saved-view', id: 'sv-1' }, context);
    expect(restored).toEqual({
      activation: { kind: 'saved-view', id: 'sv-1' },
      searchQuery: 'tag:study',
    });
  });

  it('restores smart collections', () => {
    const restored = restoreWorkspaceActivation({ kind: 'smart-collection', id: 'recent' }, context);
    expect(restored?.activation).toEqual({ kind: 'smart-collection', id: 'recent' });
    expect(restored?.searchQuery).toBe('');
  });

  it('returns null for deleted workspaces without throwing', () => {
    expect(restoreWorkspaceActivation({ kind: 'saved-view', id: 'missing' }, context)).toBeNull();
    expect(restoreWorkspaceActivation({ kind: 'database-view', id: 'gone' }, context)).toBeNull();
  });
});

describe('resolveWorkspaceRef', () => {
  it('resolves existing workspace refs and rejects missing ones', () => {
    const context = {
      savedViews: [{ id: 'sv-1', name: 'Study', query: 'tag:study' }],
      ruleCollections: [],
      databaseViews: [],
    };
    expect(resolveWorkspaceRef({ kind: 'saved-view', id: 'sv-1', name: '' }, context)?.name).toBe('Study');
    expect(resolveWorkspaceRef({ kind: 'saved-view', id: 'missing', name: '' }, context)).toBeNull();
  });
});

describe('activation restore integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('loads session activation that restore can apply', () => {
    saveWorkspaceSession(workspaceSessionFromActivation({ kind: 'rule-collection', id: 'rc-1' }));
    const session = loadWorkspaceSession();
    const restored = restoreWorkspaceActivation(session!.activation, {
      savedViews: [],
      ruleCollections: [{ id: 'rc-1', name: 'Work', query: 'tag:work' }],
      databaseViews: [],
    });
    expect(restored?.activation.kind).toBe('rule-collection');
    expect(localStorage.getItem(WORKSPACE_SESSION_KEY)).toContain('rc-1');
  });
});
