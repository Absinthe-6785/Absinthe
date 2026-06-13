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
  name: '대시보드',
  widgets: [
    { id: 'pinned-workspaces', title: '고정된 작업공간' },
    { id: 'recent-work', title: '최근 작업' },
    { id: 'resume-last-workspace', title: '마지막 작업공간 이어하기' },
    { id: 'recent-notes', title: '최근 노트' },
    { id: 'focus-presets', title: '집중 프리셋' },
    { id: 'quick-capture', title: '빠른 캡처' },
    { id: 'quick-actions', title: '빠른 작업' },
  ],
};

export const DEFAULT_RECENT_NOTES_LIMIT = 5;

const WORKSPACE_KIND_LABELS: Record<WorkspaceItemKind, string> = {
  'database-view': '데이터베이스',
  'saved-view': '저장된 보기',
  'rule-collection': '컬렉션',
  'smart-collection': '스마트 컬렉션',
};

export function workspaceKindLabel(kind: WorkspaceItemKind): string {
  return WORKSPACE_KIND_LABELS[kind];
}

export function formatRecentTimestamp(epochMs: number): string {
  const delta = Date.now() - epochMs;
  if (delta < 60_000) return '방금';
  if (delta < 3_600_000) return `${Math.floor(delta / 60_000)}분 전`;
  if (delta < 86_400_000) return `${Math.floor(delta / 3_600_000)}시간 전`;
  return new Date(epochMs).toLocaleDateString('ko-KR');
}

export function isDashboardActivation(
  activation: { kind: string },
): activation is { kind: 'dashboard' } {
  return activation.kind === 'dashboard';
}
