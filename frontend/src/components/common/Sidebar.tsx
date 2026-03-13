import { Calendar, Dumbbell, BarChart2, Settings, Moon, Sun, LogOut, BookOpen } from 'lucide-react';
import { AppSettings } from '../../types';
import { TabId } from '../AppContent';

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
}: SidebarProps) => (
  <div
    className={`w-full lg:w-[72px] rounded-none lg:rounded-[32px] flex flex-row lg:flex-col items-center justify-around lg:justify-between shadow-xl mb-2 lg:mb-0 lg:mr-5 shrink-0 z-20 transition-colors duration-500 px-2 py-2 lg:py-5 ${
      appSettings.darkMode ? 'bg-zinc-900' : 'bg-[#1C1C1E]'
    }`}
  >
    {/* ── 주요 탭 ── */}
    <div className="flex flex-row lg:flex-col gap-1 lg:gap-1.5">
      {(['planner', 'health', 'analytics', 'note'] as const).map((tab) => {
        const Icon =
          tab === 'planner'   ? Calendar :
          tab === 'health'    ? Dumbbell :
          tab === 'analytics' ? BarChart2 : BookOpen;
        const label = tab === 'note' ? 'Note' : tab.charAt(0).toUpperCase() + tab.slice(1);
        const isActive = activeTab === tab;
        const isNote = tab === 'note';
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
            {isNote && (
              <span className={`absolute -top-1 -right-1 text-[7px] font-bold px-1 py-0.5 rounded-full leading-none ${
                isActive ? 'bg-[#1C1C1E] text-[#FACC15]' : 'bg-[#FACC15] text-[#1C1C1E]'
              }`}>β</span>
            )}
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
          {appSettings.darkMode ? 'Light' : 'Dark'}
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
        <span className="text-[9px] font-bold leading-none text-gray-500 mt-0.5">Out</span>
      </button>
    </div>
  </div>
);
