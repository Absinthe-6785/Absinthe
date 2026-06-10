import { normalizeFocusPresets, type FocusPreset } from './focusModeModels';

export const FOCUS_PRESETS_KEY = 'focus-presets-v1';

export function loadFocusPresets(): FocusPreset[] {
  try {
    const raw = localStorage.getItem(FOCUS_PRESETS_KEY);
    if (!raw) return [];
    return normalizeFocusPresets(JSON.parse(raw));
  } catch {
    return [];
  }
}

export function saveFocusPresets(presets: readonly FocusPreset[]): void {
  try {
    localStorage.setItem(FOCUS_PRESETS_KEY, JSON.stringify(presets));
  } catch {
    /** ignore quota errors */
  }
}

export function clearFocusPresets(): void {
  try {
    localStorage.removeItem(FOCUS_PRESETS_KEY);
  } catch {
    /** ignore storage errors */
  }
}
