// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest';
import {
  clearWorkspaceActivationForItem,
  reconcileSavedViewActivation,
} from './workspaceActivation';
import { getWorkspaceFilterSource } from './resolveWorkspaceFilter';
import {
  INACTIVE_WORKSPACE,
  isActiveWorkspaceActivation,
  isWorkspaceActivation,
  isWorkspaceItemKind,
  normalizeWorkspaceActivation,
  normalizeWorkspaceSession,
} from './workspaceModels';
import {
  clearWorkspaceSession,
  loadWorkspaceSession,
  saveWorkspaceSession,
  workspaceSessionFromActivation,
  WORKSPACE_SESSION_KEY,
} from './workspaceSessionStorage';
import { deleteSavedView } from '../views/savedViews';

describe('clearWorkspaceActivationForItem', () => {
  it('clears activation when deleting the active saved view', () => {
    const activation = { kind: 'saved-view' as const, id: 'sv-1' };
    expect(clearWorkspaceActivationForItem(activation, 'saved-view', 'sv-1')).toEqual(INACTIVE_WORKSPACE);
  });

  it('preserves activation when deleting a different item', () => {
    const activation = { kind: 'database-view' as const, id: 'db-1' };
    expect(clearWorkspaceActivationForItem(activation, 'saved-view', 'sv-1')).toEqual(activation);
  });
});

describe('reconcileSavedViewActivation', () => {
  const savedViews = [{ id: 'sv-1', name: 'Study', query: 'tag:study' }];

  it('deactivates when the saved view is deleted', () => {
    const activation = { kind: 'saved-view' as const, id: 'sv-1' };
    const nextViews = deleteSavedView(savedViews, 'sv-1');
    expect(reconcileSavedViewActivation(activation, nextViews, 'tag:study')).toEqual(INACTIVE_WORKSPACE);
  });

  it('deactivates when search query diverges from the active saved view', () => {
    const activation = { kind: 'saved-view' as const, id: 'sv-1' };
    expect(reconcileSavedViewActivation(activation, savedViews, 'tag:other')).toEqual(INACTIVE_WORKSPACE);
  });

  it('preserves activation when query still matches', () => {
    const activation = { kind: 'saved-view' as const, id: 'sv-1' };
    expect(reconcileSavedViewActivation(activation, savedViews, 'tag:study')).toEqual(activation);
  });

  it('ignores non-saved-view activations', () => {
    const activation = { kind: 'rule-collection' as const, id: 'rc-1' };
    expect(reconcileSavedViewActivation(activation, savedViews, '')).toEqual(activation);
  });
});

describe('getWorkspaceFilterSource', () => {
  it('maps each workspace kind to its resolution strategy', () => {
    expect(getWorkspaceFilterSource(INACTIVE_WORKSPACE)).toBe('none');
    expect(getWorkspaceFilterSource({ kind: 'saved-view', id: 'sv-1' })).toBe('search-query');
    expect(getWorkspaceFilterSource({ kind: 'smart-collection', id: 'recent' })).toBe('index-evaluator');
    expect(getWorkspaceFilterSource({ kind: 'rule-collection', id: 'rc-1' })).toBe('query-rule');
    expect(getWorkspaceFilterSource({ kind: 'database-view', id: 'db-1' })).toBe('query-rule');
  });
});

describe('workspace normalization helpers', () => {
  it('validates workspace item kinds', () => {
    expect(isWorkspaceItemKind('saved-view')).toBe(true);
    expect(isWorkspaceItemKind('dashboard')).toBe(false);
  });

  it('normalizes workspace activation payloads', () => {
    expect(normalizeWorkspaceActivation({ kind: 'none' })).toEqual(INACTIVE_WORKSPACE);
    expect(normalizeWorkspaceActivation({ kind: 'rule-collection', id: ' rc-1 ' })).toEqual({
      kind: 'rule-collection',
      id: 'rc-1',
    });
    expect(normalizeWorkspaceActivation({ kind: 'invalid', id: 'x' })).toEqual(INACTIVE_WORKSPACE);
  });

  it('detects active workspace activations', () => {
    expect(isActiveWorkspaceActivation(INACTIVE_WORKSPACE)).toBe(false);
    expect(isActiveWorkspaceActivation({ kind: 'database-view', id: 'db-1' })).toBe(true);
  });

  it('normalizes persisted session state', () => {
    const session = normalizeWorkspaceSession({
      activation: { kind: 'smart-collection', id: 'recent' },
      updatedAt: 123,
    });
    expect(session).toEqual({
      activation: { kind: 'smart-collection', id: 'recent' },
      updatedAt: 123,
    });
    expect(isWorkspaceActivation(session?.activation)).toBe(true);
  });
});

describe('workspace session storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('persists and loads the last active workspace', () => {
    const session = workspaceSessionFromActivation({ kind: 'database-view', id: 'db-1' }, 456);
    saveWorkspaceSession(session);
    expect(loadWorkspaceSession()).toEqual(session);
    expect(localStorage.getItem(WORKSPACE_SESSION_KEY)).not.toContain('template');
  });

  it('clears stored session state', () => {
    saveWorkspaceSession(workspaceSessionFromActivation({ kind: 'rule-collection', id: 'rc-1' }));
    clearWorkspaceSession();
    expect(loadWorkspaceSession()).toBeNull();
  });

  it('returns null for invalid stored payloads', () => {
    localStorage.setItem(WORKSPACE_SESSION_KEY, JSON.stringify({ activation: { kind: 'bad', id: '' } }));
    expect(loadWorkspaceSession()?.activation).toEqual(INACTIVE_WORKSPACE);
  });
});

describe('saved view deletion regression', () => {
  it('clears saved-view activation through the shared delete helper', () => {
    const views = [{ id: 'sv-1', name: 'Study', query: 'tag:study' }];
    const activation = { kind: 'saved-view' as const, id: 'sv-1' };
    const nextViews = deleteSavedView(views, 'sv-1');
    const nextActivation = clearWorkspaceActivationForItem(activation, 'saved-view', 'sv-1');
    expect(nextViews).toEqual([]);
    expect(nextActivation).toEqual(INACTIVE_WORKSPACE);
  });
});
