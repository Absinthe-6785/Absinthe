/**
 * K-125E — Mobile More sheet audit (K-126B implementation).
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
    appearanceSection: sheet.includes('data-k126-more-section="appearance"'),
    vaultSection: sheet.includes('data-k126-more-section="vault"'),
    applicationSection: sheet.includes('data-k126-more-section="application"'),
    accountSection: sheet.includes('data-k126-more-section="account"'),
    themeControls: sheet.includes('data-k126-more-theme') && sheet.includes('updateSetting'),
    vaultDeepLinks: sheet.includes('onOpenSettingsSection') && sheet.includes('goSection'),
    snapshotStatus: sheet.includes('data-k126-snapshot-status'),
    signOut: sheet.includes('data-k126-more-signout'),
    versionInfo: sheet.includes('data-k126-more-version') && sheet.includes('ABSINTHE_APP_VERSION'),
    safeAreaPadding: sheet.includes('safe-area-inset-bottom'),
    touchTargets: sheet.includes('touchTargetMinPx'),
    i18nKeys: i18n.includes('k126MoreSheetTitle') && i18n.includes('k126MoreVault'),
  };
}

export function auditK125eRc(): boolean {
  return Object.values(auditK125eMobileMoreSheet()).every(Boolean);
}
