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
    className={`w-full lg:w-20 rounded-none lg:rounded-[36px] flex flex-row lg:flex-col items-center justify-around lg:justify-between shadow-xl mb-2 lg:mb-0 lg:mr-5 shrink-0 z-20 transition-colors duration-500 px-3 py-2 lg:py-6 ${
      appSettings.darkMode ? 'bg-zinc-900' : 'bg-[#1C1C1E]'
    }`}
  >
    <div className="flex flex-row lg:flex-col gap-3 lg:gap-4">
      {(['planner', 'health', 'analytics', 'wiki'] as const).map((tab) => {
        const Icon =
          tab === 'planner'   ? Calendar :
          tab === 'health'    ? Dumbbell :
          tab === 'analytics' ? BarChart2 : BookOpen;
        const label = tab === 'wiki' ? 'Wiki' : tab.charAt(0).toUpperCase() + tab.slice(1);
        const isWiki = tab === 'wiki';
        return (
          <button
            key={tab}
            aria-label={label}
            onClick={() => setActiveTab(tab)}
            className={`relative p-3.5 rounded-full shadow-md transition-all ${
              activeTab === tab
                ? 'bg-[#FACC15] text-[#1C1C1E]'
                : 'bg-[#333333] text-gray-400 hover:text-white'
            }`}
          >
            <Icon size={22} strokeWidth={2.5} />
            {isWiki && (
              <span className={`absolute -top-1 -right-1 text-[8px] font-bold px-1 py-0.5 rounded-full leading-none ${
                activeTab === 'wiki' ? 'bg-[#1C1C1E] text-[#FACC15]' : 'bg-[#FACC15] text-[#1C1C1E]'
              }`}>β</span>
            )}
          </button>
        );
      })}
    </div>

    <div className="flex flex-row lg:flex-col gap-3 lg:gap-4">
      <button
        aria-label="Toggle Dark Mode"
        onClick={() => updateSetting('darkMode', !appSettings.darkMode)}
        className="bg-[#333333] text-gray-300 p-3.5 rounded-full shadow-sm hover:text-white transition-colors"
      >
        {appSettings.darkMode ? (
          <Sun size={22} strokeWidth={2.5} className="text-[#FACC15]" />
        ) : (
          <Moon size={22} strokeWidth={2.5} />
        )}
      </button>

      <button
        aria-label="Settings"
        onClick={() => setActiveTab('settings')}
        className={`p-3.5 rounded-full shadow-md transition-all ${
          activeTab === 'settings'
            ? 'bg-[#FACC15] text-[#1C1C1E]'
            : 'bg-[#333333] text-gray-400 hover:text-white'
        }`}
      >
        <Settings size={22} strokeWidth={2.5} />
      </button>

      <button
        aria-label="Sign Out"
        onClick={handleSignOut}
        title={`Sign out (${userName})`}
        className="bg-[#333333] text-gray-400 p-3.5 rounded-full shadow-sm hover:text-red-400 transition-colors"
      >
        <LogOut size={22} strokeWidth={2.5} />
      </button>
    </div>
  </div>
);
