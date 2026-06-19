/**
 * K-119 — Settings cleanup audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K119_SETTINGS_SECTIONS = [
  'general',
  'storage',
  'recovery',
  'export',
  'danger',
] as const;

export function auditSettingsCleanup(): Record<string, boolean> {
  const settings = readFileSync(join(ROOT, 'components/views/SettingsView.tsx'), 'utf8');
  return {
    allSections: K119_SETTINGS_SECTIONS.every(s => settings.includes(`data-settings-section="${s}"`)),
    k119CardHook: settings.includes('data-k119-settings-card'),
    compactSpacing: settings.includes('space-y-3'),
    scrollHook: settings.includes('data-k119-settings-scroll'),
    signOutDescTrimmed: !settings.includes('k100SignOutDesc'),
  };
}

export function auditSettingsRc(): boolean {
  const r = auditSettingsCleanup();
  return r.allSections && r.k119CardHook && r.compactSpacing;
}
