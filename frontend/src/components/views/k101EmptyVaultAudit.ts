/**
 * K-101 — Empty vault audit.
 */
export interface K101EmptyVaultRow {
  surface: string;
  dataHook: string;
  hasCreate: boolean;
  hasTodaysNote: boolean;
  hasImport: boolean;
}

export function auditEmptyVault(): K101EmptyVaultRow[] {
  return [
    {
      surface: 'note-editor',
      dataHook: 'data-vault-empty',
      hasCreate: true,
      hasTodaysNote: true,
      hasImport: true,
    },
  ];
}

export function formatK101EmptyVaultReport(rows: readonly K101EmptyVaultRow[]): string {
  const lines = ['K-101 empty vault audit', ''];
  for (const row of rows) {
    lines.push(`  ${row.surface}: ${row.dataHook} (create=${row.hasCreate}, today=${row.hasTodaysNote}, import=${row.hasImport})`);
  }
  return lines.join('\n');
}
