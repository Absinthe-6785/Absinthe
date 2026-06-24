import { Shield, Settings, LogOut } from 'lucide-react';
import type { AppSettings } from '../../types';
import { resolveAppLanguage, getTranslator } from '../../lib/i18n';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';
import { WORKSPACE_GAP_CLASS } from '../../lib/uiSpacingTokens';
import { PopoverDismiss, PopoverPanel, PopoverPortal, PopoverRoot } from './popover/Popover';

export type SettingsSectionId = 'general' | 'data-safety' | 'danger';

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
  onClick,
  danger,
  dataHook,
}: {
  icon: typeof Settings;
  label: string;
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
      <span className="truncate">{label}</span>
    </button>
  );
}

/** K-132B — mobile More sheet: settings shortcuts and account actions only. */
export function MobileMoreSheet({
  open,
  onOpenChange,
  appSettings,
  userName,
  onSignOut,
  onOpenSettings,
  onOpenSettingsSection,
}: MobileMoreSheetProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));

  const close = () => onOpenChange(false);
  const goSettings = () => { close(); onOpenSettings(); };
  const goDataSafety = () => { close(); onOpenSettingsSection('data-safety'); };

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

              <section data-k126-more-section="shortcuts">
                <MoreRow icon={Settings} label={t('settingsTitle')} onClick={goSettings} dataHook="data-k126-more-settings" />
                <MoreRow icon={Shield} label={t('k132MoreDataSafety')} onClick={goDataSafety} dataHook="data-k126-more-data-safety" />
              </section>

              <section data-k126-more-section="account">
                <MoreRow icon={LogOut} label={t('signOut')} onClick={() => { close(); onSignOut(); }} danger dataHook="data-k126-more-signout" />
              </section>
            </div>
          </PopoverPanel>
        </PopoverDismiss>
      </PopoverPortal>
    </PopoverRoot>
  );
}
