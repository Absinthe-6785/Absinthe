import type { WorkspaceRef } from './workspaceModels';
import type { FocusPreset } from './focusModeModels';
import { normalizeFocusPreset } from './focusModeModels';

export function findFocusPreset(
  presets: readonly FocusPreset[],
  id: string,
): FocusPreset | undefined {
  const key = id.trim();
  return presets.find(preset => preset.id === key);
}

export function createFocusPreset(
  presets: readonly FocusPreset[],
  input: {
    name: string;
    workspace: Pick<WorkspaceRef, 'kind' | 'id'>;
    hideSidebar?: boolean;
    hideSecondaryPanels?: boolean;
    hideGraph?: boolean;
  },
): FocusPreset[] {
  const trimmedName = input.name.trim();
  if (!trimmedName) return [...presets];
  const id = `focus-${Date.now()}`;
  const preset = normalizeFocusPreset({
    id,
    name: trimmedName,
    workspace: input.workspace,
    hideSidebar: input.hideSidebar ?? true,
    hideSecondaryPanels: input.hideSecondaryPanels ?? true,
    hideGraph: input.hideGraph ?? true,
  });
  if (!preset) return [...presets];
  return [...presets, preset];
}

export function deleteFocusPreset(
  presets: readonly FocusPreset[],
  id: string,
): FocusPreset[] {
  const key = id.trim();
  return presets.filter(preset => preset.id !== key);
}

export function pruneFocusPresets(
  presets: readonly FocusPreset[],
  isValid: (kind: WorkspaceRef['kind'], id: string) => boolean,
): FocusPreset[] {
  return presets.filter(preset => isValid(preset.workspace.kind, preset.workspace.id));
}
