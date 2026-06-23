import { useMemo } from 'react';
import {
  Settings,
  Moon,
  Sun,
  Download,
  RotateCcw,
  HardDrive,
  LogOut,
  Info,
  Archive,
} from 'lucide-react';
import type { AppSettings } from '../../types';
import { resolveAppLanguage, getTranslator } from '../../lib/i18n';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';
import { WORKSPACE_GAP_CLASS } from '../../lib/uiSpacingTokens';
import { PopoverDismiss, PopoverPanel, PopoverPortal, PopoverRoot } from './popover/Popover';
import { getVaultStorageMetrics, formatStorageMegabytes } from '../../lib/vaultStorageMetrics';
import { ABSINTHE_APP_VERSION } from '../../lib/vaultBackupConstants';

export type SettingsSectionId = 'general' | 'storage' | 'recovery' | 'export' | 'danger';

export interface MobileMoreSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appSettings: AppSettings;
  updateSetting: (k: keyof AppSettings, v: AppSettings[keyof AppSettings]) => void;
  userName: string;
  onSignOut: () => void;
  onOpenSettings: () => void;
  onOpenSettingsSection: (section: SettingsSectionId) => void;
}

function MoreRow({
  icon: Icon,
  label,
  description,
  onClick,
  danger,
  dataHook,
}: {
  icon: typeof Settings;
  label: string;
  description?: string;
  onClick: () => void;
  danger?: boolean;
  dataHook?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 rounded-xl px-3 py-3 text-left font-semibold text-sm transition-colors hover:bg-muted/60 ${
        danger ? 'text-danger' : ''
      }`}
      style={{ minHeight: UI_INTERACTION.touchTargetMinPx }}
      {...(dataHook ? { [dataHook]: 'true' } : {})}
      data-k126-more-row
    >
      <Icon size={18} strokeWidth={2.25} className={danger ? 'text-danger' : 'text-primary shrink-0'} />
      <span className="flex flex-col min-w-0">
        <span className="truncate">{label}</span>
        {description ? <span className="text-[11px] font-medium text-muted-foreground truncate">{description}</span> : null}
      </span>
    </button>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <h3 className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground px-1 mb-1">
      {children}
    </h3>
  );
}

/** K-126B — mobile More sheet for settings, theme, vault shortcuts, and account actions. */
export function MobileMoreSheet({
  open,
  onOpenChange,
  appSettings,
  updateSetting,
  userName,
  onSignOut,
  onOpenSettings,
  onOpenSettingsSection,
}: MobileMoreSheetProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const storageMetrics = useMemo(() => (open ? getVaultStorageMetrics() : null), [open]);

  const close = () => onOpenChange(false);
  const goSettings = () => { close(); onOpenSettings(); };
  const goSection = (section: SettingsSectionId) => { close(); onOpenSettingsSection(section); };

  const snapshotSummary = storageMetrics?.lastSnapshotAt
    ? t('snapshotCountSummary')
        .replace('{count}', String(storageMetrics.snapshotCount))
        .replace('{size}', formatStorageMegabytes(storageMetrics.snapshotBytes))
    : t('storageNoSnapshot');

  return (
    <PopoverRoot open={open} onOpenChange={onOpenChange} isMobile>
      <PopoverPortal>
        <PopoverDismiss variant="sheet" data-hook="data-k126-mobile-more-backdrop">
          <PopoverPanel
            className="w-full max-h-[85dvh] bg-background border-t border-border overflow-hidden flex flex-col"
            aria-label={t('k126MoreSheetTitle')}
            dataHooks={{ 'data-k126-mobile-more-sheet': 'true' }}
          >
            <div
              className={`flex flex-col min-h-0 flex-1 overflow-y-auto overscroll-contain px-1 ${WORKSPACE_GAP_CLASS}`}
              style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
            >
              <div className="shrink-0 px-2 pt-1 pb-2 border-b border-border/60">
                <p className="font-heading text-base font-bold">{t('k126MoreSheetTitle')}</p>
                <p className="text-xs text-muted-foreground">{userName}</p>
              </div>

              <section data-k126-more-section="appearance">
                <SectionTitle>{t('k126MoreAppearance')}</SectionTitle>
                <div className={`flex p-1 rounded-2xl border border-border bg-muted/30`}>
                  {([
                    { dark: false, label: t('k100ThemeLight'), icon: Sun },
                    { dark: true, label: t('k100ThemeDark'), icon: Moon },
                  ] as const).map(({ dark, label, icon: Icon }) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => updateSetting('darkMode', dark)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-xl text-sm font-bold transition-all min-h-[44px] ${
                        appSettings.darkMode === dark
                          ? 'bg-primary text-primary-foreground shadow-sm'
                          : 'text-muted-foreground'
                      }`}
                      data-k126-more-theme={dark ? 'dark' : 'light'}
                    >
                      <Icon size={16} />
                      {label}
                    </button>
                  ))}
                </div>
              </section>

              <section data-k126-more-section="vault">
                <SectionTitle>{t('k126MoreVault')}</SectionTitle>
                <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 mb-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wide">{t('lastSnapshotLabel')}</p>
                  <p className="text-xs font-semibold tabular-nums" data-k126-snapshot-status>{snapshotSummary}</p>
                </div>
                <MoreRow icon={Archive} label={t('k126MoreBackup')} onClick={() => goSection('export')} dataHook="data-k126-more-backup" />
                <MoreRow icon={RotateCcw} label={t('k98SettingsRecovery')} onClick={() => goSection('recovery')} dataHook="data-k126-more-recovery" />
                <MoreRow icon={Download} label={t('k98SettingsExport')} onClick={() => goSection('export')} dataHook="data-k126-more-export" />
                <MoreRow icon={HardDrive} label={t('k98SettingsStorage')} description={formatStorageMegabytes(storageMetrics?.vaultBytes ?? 0)} onClick={() => goSection('storage')} dataHook="data-k126-more-storage" />
              </section>

              <section data-k126-more-section="application">
                <SectionTitle>{t('k126MoreApplication')}</SectionTitle>
                <MoreRow icon={Settings} label={t('settingsTitle')} onClick={goSettings} dataHook="data-k126-more-settings" />
                <MoreRow icon={Info} label={t('k126MoreAbout')} onClick={goSettings} dataHook="data-k126-more-about" />
              </section>

              <section data-k126-more-section="account">
                <SectionTitle>{t('k126MoreAccount')}</SectionTitle>
                <div className="rounded-xl border border-border/60 bg-muted/20 px-3 py-2 mb-1 text-xs text-muted-foreground" data-k126-more-version>
                  <p className="font-bold text-foreground">{t('k126AppVersion').replace('{version}', ABSINTHE_APP_VERSION)}</p>
                  <p>{t('k126BuildInfo').replace('{mode}', import.meta.env.MODE)}</p>
                </div>
                <MoreRow icon={LogOut} label={t('signOut')} onClick={() => { close(); onSignOut(); }} danger dataHook="data-k126-more-signout" />
              </section>
            </div>
          </PopoverPanel>
        </PopoverDismiss>
      </PopoverPortal>
    </PopoverRoot>
  );
}
