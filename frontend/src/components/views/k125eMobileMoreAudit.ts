/**
 * K-125E / K-132B — Mobile More sheet audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditK125eMobileMoreSheet(): Record<string, boolean> {
  const sheet = readFileSync(join(ROOT, 'components/common/MobileMoreSheet.tsx'), 'utf8');
  const i18n = readFileSync(join(ROOT, 'lib/i18n.ts'), 'utf8');
  return {
    sheetHook: sheet.includes('data-k126-mobile-more-sheet'),
    backdropHook: sheet.includes('data-k126-mobile-more-backdrop'),
    settingsRow: sheet.includes('data-k126-more-settings'),
    dataSafetyRow: sheet.includes('data-k126-more-data-safety'),
    signOut: sheet.includes('data-k126-more-signout'),
    removedExport: !sheet.includes('data-k126-more-export'),
    removedBackupDup: !sheet.includes('data-k126-more-backup'),
    removedAbout: !sheet.includes('data-k126-more-about'),
    safeAreaPadding: sheet.includes('safe-area-inset-bottom'),
    touchTargets: sheet.includes('touchTargetMinPx'),
    i18nKeys: i18n.includes('k132MoreDataSafety') && i18n.includes('k126MoreSheetTitle'),
  };
}

export function auditK125eRc(): boolean {
  return Object.values(auditK125eMobileMoreSheet()).every(Boolean);
}
