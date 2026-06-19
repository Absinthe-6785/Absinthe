/** K-112 — Settings simplification audit. */
export const K112_SETTINGS_SECTIONS = [
  'general',
  'storage',
  'recovery',
  'export',
  'danger',
] as const;

export const K112_SETTINGS_HOOKS = [
  'data-settings-section',
  'data-settings-general',
  'data-settings-storage',
  'data-settings-recovery',
  'data-settings-export',
  'data-settings-danger',
] as const;

export const K112_REMOVED_SETTINGS_ARTIFACTS = [
  'components/common/SettingsView.tsx',
  'defaultColor',
  'planner-defaults-section',
] as const;

export const K112_SETTINGS_CANONICAL_PATHS = {
  vaultExport: 'settings-export',
  vaultRestore: 'settings-recovery',
  signOut: 'sidebar-sign-out',
  theme: 'settings-general-theme',
} as const;

export function auditSettings(): readonly string[] {
  return [...K112_SETTINGS_SECTIONS, ...K112_SETTINGS_HOOKS, ...K112_REMOVED_SETTINGS_ARTIFACTS];
}
