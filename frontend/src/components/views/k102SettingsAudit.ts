/**
 * K-102 — Settings cleanup audit.
 */
export const K102_SETTINGS_SECTIONS = [
  'general',
  'data-safety',
  'danger',
] as const;

export interface K102SettingsRow {
  section: (typeof K102_SETTINGS_SECTIONS)[number];
  dataHook: string;
  compactPadding: boolean;
}

export function auditSettingsSections(): K102SettingsRow[] {
  return K102_SETTINGS_SECTIONS.map(section => ({
    section,
    dataHook: `data-settings-section="${section}"`,
    compactPadding: true,
  }));
}

export function formatK102SettingsReport(rows: readonly K102SettingsRow[]): string {
  const lines = ['K-102 settings audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.section}: ${row.dataHook} compact=${row.compactPadding}`);
  }
  return lines.join('\n');
}
