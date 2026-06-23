import { useState } from 'react';
import { Calendar, Dumbbell, Archive, Settings, Moon, Sun, LogOut, BookOpen, BookMarked, MoreHorizontal, Home } from 'lucide-react';
import { AppSettings } from '../../types';
import { resolveAppLanguage, getTranslator } from '../../lib/i18n';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';
import { MobileMoreSheet, type SettingsSectionId } from './MobileMoreSheet';

// AppContent 순환 참조 방지: TabId를 여기서 직접 정의
export type TabId = 'home' | 'planner' | 'health' | 'analytics' | 'settings' | 'note' | 'recipe';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  appSettings: AppSettings;
  updateSetting: (k: keyof AppSettings, v: AppSettings[keyof AppSettings]) => void;
  handleSignOut: () => void;
  userName: string;
  onOpenSettingsSection?: (section: SettingsSectionId) => void;
}

export const Sidebar = ({
  activeTab,
  setActiveTab,
  appSettings,
  updateSetting,
  handleSignOut,
  userName,
  onOpenSettingsSection,
}: SidebarProps) => {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const [moreOpen, setMoreOpen] = useState(false);

  const openSettingsSection = (section: SettingsSectionId) => {
    if (onOpenSettingsSection) onOpenSettingsSection(section);
    else setActiveTab('settings');
  };

  return (
  <>
  <div
    className="w-full lg:w-[72px] rounded-none lg:rounded-absinthe-2xl flex flex-row lg:flex-col items-center justify-around lg:justify-between shadow-absinthe-xl mb-2 lg:mb-0 lg:mr-5 shrink-0 z-20 transition-colors duration-500 px-2 py-2 lg:py-5 bg-sidebar"
    data-k126-mobile-sidebar
  >
    {/* ── 주요 탭 ── */}
    <div className="flex flex-row lg:flex-col gap-1 lg:gap-1.5">
      {(['home', 'note', 'health', 'analytics', 'planner', 'recipe'] as const).map((tab) => {
        const Icon =
          tab === 'home'      ? Home :
          tab === 'planner'   ? Calendar :
          tab === 'health'    ? Dumbbell :
          tab === 'analytics' ? Archive :
          tab === 'recipe'    ? BookMarked : BookOpen;
        const label =
          tab === 'home' ? t('home') :
          tab === 'planner' ? t('planner') :
          tab === 'health' ? t('health') :
          tab === 'analytics' ? t('analytics') :
          tab === 'note' ? t('note') : t('recipe');
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            aria-label={label}
            onClick={() => setActiveTab(tab)}
            className={`relative flex flex-col items-center justify-center gap-0.5 rounded-absinthe-lg transition-all
              px-2.5 py-2 lg:px-1.5 lg:py-2.5 w-16 lg:w-full
              ${isActive
                ? 'bg-primary text-primary-foreground shadow-absinthe-sm'
                : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground'
              }`}
          >
            <Icon size={20} strokeWidth={2.25} />
            <span className={`text-[9px] font-bold leading-none mt-0.5 ${isActive ? 'text-primary-foreground' : 'text-sidebar-muted'}`}>
              {label}
            </span>

          </button>
        );
      })}
    </div>

    {/* ── 모바일 More ── */}
    <button
      type="button"
      aria-label={t('k126MoreSheetTitle')}
      onClick={() => setMoreOpen(true)}
      className={`flex lg:hidden flex-col items-center justify-center gap-0.5 px-2.5 py-2 w-16 rounded-absinthe-lg transition-all ${
        moreOpen || activeTab === 'settings'
          ? 'bg-primary text-primary-foreground shadow-absinthe-sm'
          : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground'
      }`}
      data-k126-mobile-more-trigger
      style={{ minHeight: UI_INTERACTION.touchTargetMinPx }}
    >
      <MoreHorizontal size={20} strokeWidth={2.25} />
      <span className={`text-[9px] font-bold leading-none mt-0.5 ${moreOpen || activeTab === 'settings' ? 'text-primary-foreground' : 'text-sidebar-muted'}`}>
        {t('k81ContextMore')}
      </span>
    </button>

    {/* ── 데스크탑 하단 유틸 ── */}
    <div className="hidden lg:flex flex-row lg:flex-col gap-1 lg:gap-1.5">
      <button
        aria-label={t('toggleDarkMode')}
        onClick={() => updateSetting('darkMode', !appSettings.darkMode)}
        className="flex flex-col items-center justify-center gap-0.5 text-sidebar-muted px-2.5 py-2 lg:px-1.5 lg:py-2.5 w-16 lg:w-full rounded-absinthe-lg hover:bg-sidebar-hover hover:text-foreground transition-colors"
      >
        {appSettings.darkMode ? (
          <Sun size={20} strokeWidth={2.25} className="text-primary" />
        ) : (
          <Moon size={20} strokeWidth={2.25} />
        )}
        <span className="text-[9px] font-bold leading-none text-sidebar-muted mt-0.5">
          {appSettings.darkMode ? t('light') : t('dark')}
        </span>
      </button>

      <button
        aria-label={t('settings')}
        onClick={() => setActiveTab('settings')}
        className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-2 lg:px-1.5 lg:py-2.5 w-16 lg:w-full rounded-absinthe-lg transition-all ${
          activeTab === 'settings'
            ? 'bg-primary text-primary-foreground shadow-absinthe-sm'
            : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground'
        }`}
      >
        <Settings size={20} strokeWidth={2.25} />
        <span className={`text-[9px] font-bold leading-none mt-0.5 ${activeTab === 'settings' ? 'text-primary-foreground' : 'text-sidebar-muted'}`}>
          {t('settings')}
        </span>
      </button>

      <button
        aria-label={t('signOut')}
        onClick={handleSignOut}
        title={t('signOutUser').replace('{name}', userName)}
        className="flex flex-col items-center justify-center gap-0.5 text-sidebar-muted px-2.5 py-2 lg:px-1.5 lg:py-2.5 w-16 lg:w-full rounded-absinthe-lg hover:bg-sidebar-hover hover:text-danger transition-colors"
      >
        <LogOut size={20} strokeWidth={2.25} />
        <span className="text-[9px] font-bold leading-none text-sidebar-muted mt-0.5">{t('out')}</span>
      </button>
    </div>
  </div>

  <MobileMoreSheet
    open={moreOpen}
    onOpenChange={setMoreOpen}
    appSettings={appSettings}
    updateSetting={updateSetting}
    userName={userName}
    onSignOut={handleSignOut}
    onOpenSettings={() => setActiveTab('settings')}
    onOpenSettingsSection={openSettingsSection}
  />
  </>
  );
};

export type { SettingsSectionId };
