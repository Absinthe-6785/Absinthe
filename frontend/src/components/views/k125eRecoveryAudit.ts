/**
 * K-125E — Backup & recovery reliability audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { K125E_RECOVERY_SECTIONS } from './features/settings/recoveryExport';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export { K125E_RECOVERY_SECTIONS };

export function auditK125eRecovery(): Record<string, boolean> {
  const settings = readFileSync(join(ROOT, 'components/views/SettingsView.tsx'), 'utf8');
  const panel = readFileSync(join(ROOT, 'components/views/features/settings/RecoveryCenterPanel.tsx'), 'utf8');
  const snapshotList = readFileSync(join(ROOT, 'components/views/features/settings/SnapshotList.tsx'), 'utf8');
  const snapshotCard = readFileSync(join(ROOT, 'components/views/features/settings/SnapshotCard.tsx'), 'utf8');
  const recoveryExport = readFileSync(join(ROOT, 'components/views/features/settings/recoveryExport.ts'), 'utf8');
  const modal = readFileSync(join(ROOT, 'components/views/features/knowledge/VaultRestoreModal.tsx'), 'utf8');

  return {
    noDefaultCategory: !settings.includes("updateSetting('defaultCategory'"),
    storageCompact: settings.includes('data-k125e-storage-compact'),
    backupSection: settings.includes('data-k125e-section="backup"'),
    recoverySection: panel.includes('data-k125e-section="recovery"'),
    exportSection: settings.includes('data-k125e-section="export"'),
    recoverySectionsOrder: K125E_RECOVERY_SECTIONS.join(',') === 'backup,recovery,export',
    snapshotListComponent: snapshotList.includes('data-k125e-snapshot-list'),
    snapshotCardDensity: snapshotCard.includes('data-k125e-snapshot-card')
      && snapshotCard.includes('data-k125e-snapshot-inspect')
      && snapshotCard.includes('data-k125e-snapshot-restore'),
    snapshotStatusBadges: snapshotCard.includes('data-k125e-snapshot-status'),
    validationHelpers: recoveryExport.includes('mapValidationErrorToKey')
      && recoveryExport.includes('formatValidationErrors')
      && recoveryExport.includes('resolveSnapshotStatusBadge'),
    restoreModalFlow: modal.includes('data-k125e-restore-flow')
      && modal.includes('data-k125e-restore-ack')
      && modal.includes('data-k125e-restore-confirm'),
    restoreModalValidation: modal.includes('formatValidationErrors')
      && modal.includes('data-k125e-restore-invalid'),
    hiddenFileInput: settings.includes('vaultRestore.fileInputRef'),
    noDuplicateZipInPanel: !panel.includes('vaultBackupZipExport'),
  };
}

export function auditK125eRecoveryRc(): boolean {
  return Object.values(auditK125eRecovery()).every(Boolean);
}
