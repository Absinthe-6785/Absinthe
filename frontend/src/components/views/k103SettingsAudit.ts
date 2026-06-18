/**
 * K-103 — Settings cleanup audit.
 */
export const K103_SETTINGS_SECTIONS = [
  'general',
  'storage',
  'recovery',
  'export',
  'danger',
] as const;

export interface K103SettingsRow {
  section: (typeof K103_SETTINGS_SECTIONS)[number];
  dataHook: string;
}

export function auditSettingsCleanup(): K103SettingsRow[] {
  return K103_SETTINGS_SECTIONS.map(section => ({
    section,
    dataHook: `data-settings-section="${section}"`,
  }));
}

export function formatK103SettingsReport(rows: readonly K103SettingsRow[]): string {
  const lines = ['K-103 settings audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.section}: ${row.dataHook}`);
  }
  return lines.join('\n');
}
