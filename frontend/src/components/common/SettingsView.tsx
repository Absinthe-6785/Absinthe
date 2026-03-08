/**
 * SettingsView — useConfirm 적용 예시
 *
 * 기존: 각 View마다 아래 코드를 중복 선언
 *   const [confirm, setConfirm] = useState<...>(null);
 *   const showConfirm = (msg, fn) => setConfirm({ message: msg, onConfirm: fn });
 *   {confirm && <ConfirmModal ... onConfirm={() => { confirm.onConfirm(); setConfirm(null); }} />}
 *
 * 변경: useConfirm() 한 줄로 대체. ConfirmModal 렌더 패턴도 단순화.
 */

import { Settings, Save, Download, AlertTriangle, LogOut } from 'lucide-react';
import { authFetch } from '../../lib/supabase';
import { ViewProps } from '../../types';
import { ConfirmModal } from '../common/ConfirmModal';
import { useConfirm } from '../../hooks/useConfirm';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export const SettingsView = ({
  appSettings, updateSetting, showToast, theme, mutateDaily, mutateStatic, onSignOut,
}: ViewProps) => {
  // ✅ DRY: useConfirm으로 3줄 → 1줄
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const doResetData = async () => {
    try {
      const res = await authFetch(`${API_URL}/api/reset`, { method: 'DELETE' });
      if (res.ok) {
        showToast('All data has been permanently deleted.');
        mutateDaily();
        mutateStatic();
      } else throw new Error();
    } catch {
      showToast('Failed to reset data.', 'error');
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden py-1 pr-1 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6 pl-2 pr-6 shrink-0">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className={`text-sm lg:text-base font-medium mt-1 ${theme.textMuted}`}>
            Customize your planner and manage your data.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-20 lg:pb-2">
        <div className="max-w-4xl mx-auto space-y-5 lg:space-y-6">

          {/* Planner Defaults */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden transition-colors ${theme.card}`}>
            <h2 className="font-heading text-lg font-bold mb-6 flex items-center gap-2">
              <Settings size={20} className="text-[#FACC15]" /> Planner Defaults
            </h2>
            <div className="space-y-8">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 lg:gap-0">
                <div>
                  <p className="text-base font-bold">Default Category</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Pre-selected category.</p>
                </div>
                <div className={`flex flex-wrap gap-2 p-2 rounded-2xl border ${theme.border} ${theme.input}`}>
                  {['Study', 'Work', 'Exercise', 'Personal'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => updateSetting('defaultCategory', cat)}
                      className={`px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-sm font-bold transition-all ${
                        appSettings.defaultCategory === cat
                          ? 'bg-[#1C1C1E] text-[#FACC15] shadow-md'
                          : 'text-gray-500 hover:text-current'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 lg:gap-0">
                <div>
                  <p className="text-base font-bold">Default Color</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Pre-selected timeline color.</p>
                </div>
                <div className={`flex gap-4 p-3 rounded-2xl border ${theme.border} ${theme.input}`}>
                  {['gold', 'blue', 'green', 'purple', 'pink', 'gray'].map((color) => (
                    <button
                      key={color}
                      onClick={() => updateSetting('defaultColor', color)}
                      className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full transition-all shadow-sm ${
                        color === 'blue'   ? 'bg-blue-500'   :
                        color === 'green'  ? 'bg-green-500'  :
                        color === 'purple' ? 'bg-purple-500' :
                        color === 'pink'   ? 'bg-pink-500'   :
                        color === 'gray'   ? 'bg-gray-500'   : 'bg-[#FACC15]'
                      } ${
                        appSettings.defaultColor === color
                          ? `ring-4 ring-offset-2 ${appSettings.darkMode ? 'ring-gray-300 ring-offset-[#2C2C2E]' : 'ring-gray-500'} scale-110`
                          : 'border-4 border-transparent hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Data Management */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden border-2 border-red-500/20 transition-colors ${theme.card}`}>
            <h2 className="font-heading text-lg font-bold text-red-500 mb-6 flex items-center gap-2">
              <Save size={20} /> Data Management
            </h2>
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0">
                <div>
                  <p className="text-base font-bold">Export Data (CSV)</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Download all your records.</p>
                </div>
                <button
                  disabled
                  onClick={() => showToast('Export feature coming soon!', 'error')}
                  className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-colors flex justify-center items-center gap-2 opacity-50 cursor-not-allowed ${theme.input}`}
                >
                  <Download size={18} /> Coming Soon
                </button>
              </div>

              <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0 pt-6 border-t ${theme.border}`}>
                <div>
                  <p className="text-base font-bold text-red-500 flex items-center gap-1.5">
                    <AlertTriangle size={18} /> Reset All Data
                  </p>
                  <p className="text-sm font-medium mt-1 text-red-500/70">This action cannot be undone.</p>
                </div>
                <button
                  onClick={() => showConfirm('Are you sure? This will permanently delete ALL your data.', doResetData)}
                  className="bg-red-500/10 text-red-500 border border-red-500/20 px-6 py-3.5 rounded-xl font-bold text-sm hover:bg-red-500 hover:text-white transition-colors"
                >
                  Reset Data
                </button>
              </div>

              <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0 pt-6 border-t ${theme.border}`}>
                <div>
                  <p className="text-base font-bold flex items-center gap-1.5">
                    <LogOut size={18} /> Sign Out
                  </p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Log out of your account.</p>
                </div>
                <button
                  onClick={onSignOut}
                  className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-colors border ${theme.border} ${theme.hoverBg}`}
                >
                  Sign Out
                </button>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* ✅ ConfirmModal — useConfirm으로 단일 패턴으로 통일 */}
      {confirm && (
        <ConfirmModal
          message={confirm.message}
          onConfirm={handleConfirm}
          onCancel={clearConfirm}
          darkMode={appSettings.darkMode}
        />
      )}
    </div>
  );
};
