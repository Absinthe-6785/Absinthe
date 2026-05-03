import { Calendar, Dumbbell, BarChart2, Settings, Moon, Sun, LogOut, BookOpen, BookMarked } from 'lucide-react';
import { AppSettings } from '../../types';
import { getTranslator } from '../../lib/i18n';

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
  const t = getTranslator((appSettings.language ?? 'en') as 'en' | 'ko' | 'ja');
  return (
  <div
    className={`w-full lg:w-[72px] rounded-none lg:rounded-[32px] flex flex-row lg:flex-col items-center justify-around lg:justify-between shadow-xl mb-2 lg:mb-0 lg:mr-5 shrink-0 z-20 transition-colors duration-500 px-2 py-2 lg:py-5 ${
      appSettings.darkMode ? 'bg-zinc-900' : 'bg-[#1C1C1E]'
    }`}
  >
    {/* ── 주요 탭 ── */}
    <div className="flex flex-row lg:flex-col gap-1 lg:gap-1.5">
      {(['planner', 'health', 'analytics', 'note', 'recipe'] as const).map((tab) => {
        const Icon =
          tab === 'planner'   ? Calendar :
          tab === 'health'    ? Dumbbell :
          tab === 'analytics' ? BarChart2 :
          tab === 'recipe'    ? BookMarked : BookOpen;
        const label = tab === 'planner' ? t('planner') : tab === 'health' ? t('health') : tab === 'analytics' ? t('analytics') : tab === 'note' ? t('note') : t('recipe');
        const isActive = activeTab === tab;
        return (
          <button
            key={tab}
            aria-label={label}
            onClick={() => setActiveTab(tab)}
            className={`relative flex flex-col items-center justify-center gap-0.5 rounded-2xl transition-all
              px-2.5 py-2 lg:px-1.5 lg:py-2.5 w-16 lg:w-full
              ${isActive
                ? 'bg-[#FACC15] text-[#1C1C1E]'
                : 'text-gray-400 hover:bg-[#2A2A2A] hover:text-gray-200'
              }`}
          >
            <Icon size={20} strokeWidth={2.5} />
            <span className={`text-[9px] font-bold leading-none mt-0.5 ${isActive ? 'text-[#1C1C1E]' : 'text-gray-500'}`}>
              {label}
            </span>

          </button>
        );
      })}
    </div>

    {/* ── 하단 유틸 ── */}
    <div className="flex flex-row lg:flex-col gap-1 lg:gap-1.5">
      <button
        aria-label="Toggle Dark Mode"
        onClick={() => updateSetting('darkMode', !appSettings.darkMode)}
        className="flex flex-col items-center justify-center gap-0.5 text-gray-400 px-2.5 py-2 lg:px-1.5 lg:py-2.5 w-16 lg:w-full rounded-2xl hover:bg-[#2A2A2A] hover:text-gray-200 transition-colors"
      >
        {appSettings.darkMode ? (
          <Sun size={20} strokeWidth={2.5} className="text-[#FACC15]" />
        ) : (
          <Moon size={20} strokeWidth={2.5} />
        )}
        <span className="text-[9px] font-bold leading-none text-gray-500 mt-0.5">
          {appSettings.darkMode ? t('light') : t('dark')}
        </span>
      </button>

      <button
        aria-label="Settings"
        onClick={() => setActiveTab('settings')}
        className={`flex flex-col items-center justify-center gap-0.5 px-2.5 py-2 lg:px-1.5 lg:py-2.5 w-16 lg:w-full rounded-2xl transition-all ${
          activeTab === 'settings'
            ? 'bg-[#FACC15] text-[#1C1C1E]'
            : 'text-gray-400 hover:bg-[#2A2A2A] hover:text-gray-200'
        }`}
      >
        <Settings size={20} strokeWidth={2.5} />
        <span className={`text-[9px] font-bold leading-none mt-0.5 ${activeTab === 'settings' ? 'text-[#1C1C1E]' : 'text-gray-500'}`}>
          Settings
        </span>
      </button>

      <button
        aria-label="Sign Out"
        onClick={handleSignOut}
        title={`Sign out (${userName})`}
        className="flex flex-col items-center justify-center gap-0.5 text-gray-400 px-2.5 py-2 lg:px-1.5 lg:py-2.5 w-16 lg:w-full rounded-2xl hover:bg-[#2A2A2A] hover:text-red-400 transition-colors"
      >
        <LogOut size={20} strokeWidth={2.5} />
        <span className="text-[9px] font-bold leading-none text-gray-500 mt-0.5">{t('out')}</span>
      </button>
    </div>
  </div>

  );
};