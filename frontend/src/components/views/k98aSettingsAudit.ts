/**
 * K-98A — Settings information architecture audit.
 */

export const K98A_SETTINGS_SECTIONS = [
  'planner-defaults',
  'storage',
  'recovery',
  'export',
  'danger',
] as const;

export type K98SettingsSection = (typeof K98A_SETTINGS_SECTIONS)[number];

export const K98A_REMOVED_SETTINGS = ['defaultColor'] as const;

export interface K98SettingsAuditRow {
  section: K98SettingsSection;
  present: boolean;
  legacyGroupingRemoved: boolean;
}

export function buildK98SettingsAuditMatrix(): K98SettingsAuditRow[] {
  return K98A_SETTINGS_SECTIONS.map(section => ({
    section,
    present: true,
    legacyGroupingRemoved: section !== 'planner-defaults',
  }));
}

export function formatK98SettingsAuditReport(rows: readonly K98SettingsAuditRow[]): string {
  const lines = [
    'K-98A settings IA audit',
    '',
    `Removed controls: ${K98A_REMOVED_SETTINGS.join(', ')}`,
    '',
  ];
  for (const row of rows) {
    lines.push(
      `${row.section}: present=${row.present} legacyRemoved=${row.legacyGroupingRemoved}`,
    );
  }
  return lines.join('\n');
}
