import { describe, it, expect } from 'vitest';
import {
  INACTIVE_WORKSPACE,
  isSameWorkspaceActivation,
  WORKSPACE_FILTER_SOURCE,
} from './workspaceModels';

describe('workspaceModels', () => {
  it('defines filter sources per workspace kind', () => {
    expect(WORKSPACE_FILTER_SOURCE['saved-view']).toBe('search-query');
    expect(WORKSPACE_FILTER_SOURCE['smart-collection']).toBe('index-evaluator');
    expect(WORKSPACE_FILTER_SOURCE['rule-collection']).toBe('query-rule');
    expect(WORKSPACE_FILTER_SOURCE['database-view']).toBe('query-rule');
  });

  it('compares workspace activations by kind and id', () => {
    const a = { kind: 'rule-collection' as const, id: 'c1' };
    const b = { kind: 'rule-collection' as const, id: 'c1' };
    const c = { kind: 'smart-collection' as const, id: 'orphan' };

    expect(isSameWorkspaceActivation(a, b)).toBe(true);
    expect(isSameWorkspaceActivation(a, c)).toBe(false);
    expect(isSameWorkspaceActivation(INACTIVE_WORKSPACE, INACTIVE_WORKSPACE)).toBe(true);
    expect(isSameWorkspaceActivation(a, INACTIVE_WORKSPACE)).toBe(false);
  });
});
