import type { WorkspaceItemKind } from './workspaceModels';

/** Phase 1 static dashboard widget identifiers */
export type WorkspaceDashboardWidgetId =
  | 'pinned-workspaces'
  | 'recent-work'
  | 'resume-last-workspace'
  | 'recent-notes'
  | 'quick-actions'
  | 'focus-presets'
  | 'quick-capture';

export interface WorkspaceDashboardWidget {
  id: WorkspaceDashboardWidgetId;
  title: string;
}

/** Fixed Phase 1 dashboard — not persisted */
export interface WorkspaceDashboardModel {
  id: 'default';
  name: string;
  widgets: readonly WorkspaceDashboardWidget[];
}

export const DEFAULT_WORKSPACE_DASHBOARD: WorkspaceDashboardModel = {
  id: 'default',
  name: 'Dashboard',
  widgets: [
    { id: 'pinned-workspaces', title: 'Pinned Workspaces' },
    { id: 'recent-work', title: 'Recent Work' },
    { id: 'resume-last-workspace', title: 'Resume Last Workspace' },
    { id: 'recent-notes', title: 'Recent Notes' },
    { id: 'focus-presets', title: 'Focus Presets' },
    { id: 'quick-capture', title: 'Quick Capture' },
    { id: 'quick-actions', title: 'Quick Actions' },
  ],
};

export const DEFAULT_RECENT_NOTES_LIMIT = 5;

const WORKSPACE_KIND_LABELS: Record<WorkspaceItemKind, string> = {
  'database-view': 'Database',
  'saved-view': 'Saved View',
  'rule-collection': 'Collection',
  'smart-collection': 'Smart Collection',
};

export function workspaceKindLabel(kind: WorkspaceItemKind): string {
  return WORKSPACE_KIND_LABELS[kind];
}

export function formatRecentTimestamp(epochMs: number): string {
  const delta = Date.now() - epochMs;
  if (delta < 60_000) return 'Just now';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}m ago`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}h ago`;
  return new Date(epochMs).toLocaleDateString();
}

export function isDashboardActivation(
  activation: { kind: string },
): activation is { kind: 'dashboard' } {
  return activation.kind === 'dashboard';
}
