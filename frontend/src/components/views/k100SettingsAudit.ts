/**
 * K-100 / K-128 — Settings IA and layout audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K100_SETTINGS_SECTIONS = [
  'general',
  'storage',
  'recovery',
  'danger',
] as const;

export type K100SettingsSection = (typeof K100_SETTINGS_SECTIONS)[number];

export function auditK100SettingsSections(): K100SettingsSection[] {
  return [...K100_SETTINGS_SECTIONS];
}

export function auditSettingsCleanup(): Record<string, boolean> {
  const settings = readFileSync(join(ROOT, 'components/views/SettingsView.tsx'), 'utf8');
  return {
    allSections: K100_SETTINGS_SECTIONS.every(s => settings.includes(`data-settings-section="${s}"`)),
    settingsCardHook: settings.includes('data-k119-settings-card'),
    compactSpacing: settings.includes('space-y-3'),
    scrollHook: settings.includes('data-k119-settings-scroll'),
    signOutDescTrimmed: !settings.includes('k100SignOutDesc'),
    cardSurface: settings.includes('WORKSPACE_CARD_SURFACE'),
  };
}

export function auditSettingsRc(): boolean {
  const r = auditSettingsCleanup();
  return r.allSections && r.settingsCardHook && r.compactSpacing && r.cardSurface;
}

export function formatK100SettingsReport(sections: readonly K100SettingsSection[]): string {
  const lines = ['K-100 settings audit', '', 'Sections:'];
  for (const section of sections) {
    lines.push(`  data-settings-section="${section}"`);
  }
  return lines.join('\n');
}
