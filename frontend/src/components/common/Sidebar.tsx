import { useState } from 'react';
import { Calendar, Dumbbell, Archive, Settings, Moon, Sun, LogOut, BookOpen, BookMarked, MoreHorizontal } from 'lucide-react';
import { AppSettings } from '../../types';
import { resolveAppLanguage, getTranslator } from '../../lib/i18n';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';

// AppContent 순환 참조 방지: TabId를 여기서 직접 정의
export type TabId = 'planner' | 'health' | 'analytics' | 'settings' | 'note' | 'recipe';

interface SidebarProps {
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  appSettings: AppSettings;
  updateSetting: (k: keyof AppSettings, v: AppSettings[keyof AppSettings]) => void;
  handleSignOut: () => void;
  userName: string;
}

export const Sidebar = ({
  activeTab,
  setActiveTab,
  appSettings,
  updateSetting,
  handleSignOut,
  userName,
}: SidebarProps) => {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const [moreOpen, setMoreOpen] = useState(false);

  return (
  <div
    className="w-full lg:w-[72px] rounded-none lg:rounded-absinthe-2xl flex flex-row lg:flex-col items-center justify-around lg:justify-between shadow-absinthe-xl mb-2 lg:mb-0 lg:mr-5 shrink-0 z-20 transition-colors duration-500 px-2 py-2 lg:py-5 bg-sidebar"
    data-k125f-app-navigation
  >
    {/* ── 주요 탭 ── */}
    <div className="flex flex-row lg:flex-col gap-1 lg:gap-1.5">
      {(['note', 'health', 'analytics', 'planner', 'recipe'] as const).map((tab) => {
        const Icon =
          tab === 'planner'   ? Calendar :
          tab === 'health'    ? Dumbbell :
          tab === 'analytics' ? Archive :
          tab === 'recipe'    ? BookMarked : BookOpen;
        const label = tab === 'planner' ? t('planner') : tab === 'health' ? t('health') : tab === 'analytics' ? t('analytics') : tab === 'note' ? t('note') : t('recipe');
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

    {/* ── 하단 유틸 — desktop inline; mobile overflow sheet ── */}
    <div className="hidden lg:flex flex-col gap-1.5">
      <button
        aria-label={t('toggleDarkMode')}
        onClick={() => updateSetting('darkMode', !appSettings.darkMode)}
        className="flex flex-col items-center justify-center gap-0.5 text-sidebar-muted px-1.5 py-2.5 w-full rounded-absinthe-lg hover:bg-sidebar-hover hover:text-foreground transition-colors"
        data-k125f-theme-toggle
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
        className={`flex flex-col items-center justify-center gap-0.5 px-1.5 py-2.5 w-full rounded-absinthe-lg transition-all ${
          activeTab === 'settings'
            ? 'bg-primary text-primary-foreground shadow-absinthe-sm'
            : 'text-sidebar-muted hover:bg-sidebar-hover hover:text-foreground'
        }`}
        data-k125f-settings-nav
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
        className="flex flex-col items-center justify-center gap-0.5 text-sidebar-muted px-1.5 py-2.5 w-full rounded-absinthe-lg hover:bg-sidebar-hover hover:text-danger transition-colors"
      >
        <LogOut size={20} strokeWidth={2.25} />
        <span className="text-[9px] font-bold leading-none text-sidebar-muted mt-0.5">{t('out')}</span>
      </button>
    </div>

    <div className="relative lg:hidden">
      <button
        type="button"
        aria-label={t('nvMoreActions')}
        onClick={() => setMoreOpen(v => !v)}
        className="flex flex-col items-center justify-center gap-0.5 text-sidebar-muted px-2.5 py-2 w-16 rounded-absinthe-lg hover:bg-sidebar-hover hover:text-foreground transition-colors"
        data-k125f-nav-more
        style={{ minHeight: UI_INTERACTION.touchTargetMinPx }}
      >
        <MoreHorizontal size={20} strokeWidth={2.25} />
        <span className="text-[9px] font-bold leading-none text-sidebar-muted mt-0.5">{t('k81ContextMore')}</span>
      </button>
      {moreOpen && (
        <>
          <button type="button" className="fixed inset-0 z-[198]" aria-label="Close" onClick={() => setMoreOpen(false)} />
          <div
            className="absolute bottom-full right-0 mb-2 z-[199] min-w-[160px] rounded-xl border shadow-lg bg-background p-1"
            data-k125f-nav-more-sheet
          >
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg hover:bg-black/5"
              onClick={() => { updateSetting('darkMode', !appSettings.darkMode); setMoreOpen(false); }}
            >
              {appSettings.darkMode ? <Sun size={14} /> : <Moon size={14} />}
              {appSettings.darkMode ? t('light') : t('dark')}
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg hover:bg-black/5"
              onClick={() => { setActiveTab('settings'); setMoreOpen(false); }}
            >
              <Settings size={14} /> {t('settings')}
            </button>
            <button
              type="button"
              className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg text-red-500 hover:bg-red-500/10"
              onClick={() => { handleSignOut(); setMoreOpen(false); }}
            >
              <LogOut size={14} /> {t('out')}
            </button>
          </div>
        </>
      )}
    </div>
  </div>

  );
};
