import type { WorkspaceItemKind, WorkspaceRef } from './workspaceModels';

export interface FocusPreset {
  id: string;
  name: string;
  workspace: Pick<WorkspaceRef, 'kind' | 'id'>;
  hideSidebar: boolean;
  hideSecondaryPanels: boolean;
  hideGraph: boolean;
}

export interface FocusSessionState {
  activePresetId?: string;
  startedAt?: number;
}

export interface FocusUiPreferences {
  hideSidebar: boolean;
  hideSecondaryPanels: boolean;
  hideGraph: boolean;
}

export const INACTIVE_FOCUS_SESSION: FocusSessionState = {};

const WORKSPACE_KINDS: readonly WorkspaceItemKind[] = [
  'saved-view',
  'smart-collection',
  'rule-collection',
  'database-view',
];

export function isFocusPreset(value: unknown): value is FocusPreset {
  if (!value || typeof value !== 'object') return false;
  const record = value as Partial<FocusPreset>;
  if (typeof record.id !== 'string' || !record.id.trim()) return false;
  if (typeof record.name !== 'string' || !record.name.trim()) return false;
  if (!record.workspace || typeof record.workspace !== 'object') return false;
  const ws = record.workspace as Partial<WorkspaceRef>;
  if (typeof ws.kind !== 'string' || typeof ws.id !== 'string') return false;
  if (!WORKSPACE_KINDS.includes(ws.kind as WorkspaceItemKind)) return false;
  if (!ws.id.trim()) return false;
  if (typeof record.hideSidebar !== 'boolean') return false;
  if (typeof record.hideSecondaryPanels !== 'boolean') return false;
  if (typeof record.hideGraph !== 'boolean') return false;
  return true;
}

export function normalizeFocusPreset(raw: unknown): FocusPreset | null {
  if (!isFocusPreset(raw)) return null;
  return {
    id: raw.id.trim(),
    name: raw.name.trim(),
    workspace: { kind: raw.workspace.kind, id: raw.workspace.id.trim() },
    hideSidebar: raw.hideSidebar,
    hideSecondaryPanels: raw.hideSecondaryPanels,
    hideGraph: raw.hideGraph,
  };
}

export function normalizeFocusPresets(raw: unknown): FocusPreset[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeFocusPreset)
    .filter((preset): preset is FocusPreset => preset !== null);
}

export function normalizeFocusSession(raw: unknown): FocusSessionState {
  if (!raw || typeof raw !== 'object') return INACTIVE_FOCUS_SESSION;
  const record = raw as Partial<FocusSessionState>;
  const activePresetId = typeof record.activePresetId === 'string' && record.activePresetId.trim()
    ? record.activePresetId.trim()
    : undefined;
  const startedAt = typeof record.startedAt === 'number' && Number.isFinite(record.startedAt)
    ? record.startedAt
    : undefined;
  if (!activePresetId) return INACTIVE_FOCUS_SESSION;
  return { activePresetId, startedAt };
}

export function focusUiFromPreset(preset: FocusPreset): FocusUiPreferences {
  return {
    hideSidebar: preset.hideSidebar,
    hideSecondaryPanels: preset.hideSecondaryPanels,
    hideGraph: preset.hideGraph,
  };
}
