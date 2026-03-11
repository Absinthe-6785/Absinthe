import { useState, useCallback } from 'react';
import { Settings, Save, Download, LogOut, Loader2, Upload, ArchiveRestore, FileJson, FileText, AlertTriangle } from 'lucide-react';
import { useRef } from 'react';
import { API_URL } from '../../lib/config';
import { authFetch } from '../../lib/supabase';
import { useApiMutation } from '../../hooks/useApiMutation';
import { SettingsProps } from '../../types';
import { exportAllToCsv } from '../../lib/csvExport';

export const SettingsView = ({ appSettings, updateSetting, showToast, theme, THEME_COLORS, mutateDaily, mutateStatic, onSignOut }: SettingsProps) => {
  const { mutate: api } = useApiMutation(mutateDaily, mutateStatic, showToast);
  // ── Export 상태 ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  const [exportStart, setExportStart] = useState(firstOfMonth);
  const [exportEnd,   setExportEnd]   = useState(today);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');
  const [isBackingUp, setIsBackingUp]     = useState(false);
  const [isRestoring, setIsRestoring]     = useState(false);
  const [restoreMsg, setRestoreMsg]       = useState<{ type: 'success'|'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = useCallback(async () => {
    if (!exportStart || !exportEnd) return showToast('Start and end date required', 'error');
    if (exportStart > exportEnd)    return showToast('End date must be after start date', 'error');

    setIsExporting(true);
    setExportProgress('Starting export...');
    try {
      await exportAllToCsv({
        startDate: exportStart,
        endDate:   exportEnd,
        onProgress: setExportProgress,
      });
      showToast('CSV downloaded! 📥');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      showToast(`Export failed${msg ? ': ' + msg : ''}`, 'error');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  }, [exportStart, exportEnd, showToast]);

  return (
    <div className="flex-1 flex flex-col overflow-hidden py-1 pr-1 animate-in fade-in duration-300">
      <div className="flex justify-between items-end mb-6 pl-2 pr-6 shrink-0">
        <div>
          <h1 className="font-heading text-2xl lg:text-3xl font-bold">Settings</h1>
          <p className={`text-sm lg:text-base font-medium mt-1 ${theme.textMuted}`}>Customize your planner and manage your data.</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-2 pb-20 lg:pb-2">
        <div className="max-w-4xl mx-auto space-y-5 lg:space-y-6">

          {/* ── Planner Defaults ── */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden transition-colors ${theme.card}`}>
            <h2 className="font-heading text-lg font-bold mb-6 flex items-center gap-2">
              <Settings size={20} className="text-[#FACC15]"/> Planner Defaults
            </h2>
            <div className="space-y-8">
              <div className="flex flex-col lg:flex-row lg:justify-between lg:items-center gap-4 lg:gap-0">
                <div>
                  <p className="text-base font-bold">Default Category</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Pre-selected category.</p>
                </div>
                <div className={`flex flex-wrap gap-2 p-2 rounded-2xl border ${theme.border} ${theme.input}`}>
                  {['Study', 'Work', 'Exercise', 'Personal', 'Sleep', 'Social'].map(cat => (
                    <button key={cat} onClick={() => updateSetting('defaultCategory', cat)}
                      className={`px-4 lg:px-5 py-2 lg:py-2.5 rounded-xl text-sm font-bold transition-all
                        ${appSettings.defaultCategory === cat ? 'bg-[#1C1C1E] text-[#FACC15] shadow-md' : 'text-gray-500 hover:text-current'}`}>
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
                  {THEME_COLORS.map(({ id, bg }) => (
                    <button key={id} onClick={() => updateSetting('defaultColor', id)}
                      className={`w-8 h-8 lg:w-10 lg:h-10 rounded-full transition-all shadow-sm ${bg}
                        ${appSettings.defaultColor === id
                          ? `ring-4 ring-offset-2 ${appSettings.darkMode ? 'ring-gray-300 ring-offset-[#2C2C2E]' : 'ring-gray-500'} scale-110`
                          : 'border-4 border-transparent hover:scale-110'}`}/>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Data Management ── */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden  transition-colors ${theme.card}`}>
            <h2 className="font-heading text-lg font-bold mb-6 flex items-center gap-2">
              <Save size={20}/> Data Management
            </h2>
            <div className="space-y-6">

              {/* Export Data */}
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-base font-bold">Export Data (CSV)</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>
                    Download schedules, todos, routines, workouts and InBody records.
                  </p>
                </div>

                {/* 날짜 범위 선택 + 버튼 */}
                <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-xs font-bold shrink-0 ${theme.textMuted}`}>From</span>
                    <input
                      type="date"
                      value={exportStart}
                      max={exportEnd}
                      onChange={e => setExportStart(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold outline-none tabular-nums"
                    />
                  </div>
                  <span className={`font-bold text-center ${theme.textMuted}`}>—</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-xs font-bold shrink-0 ${theme.textMuted}`}>To</span>
                    <input
                      type="date"
                      value={exportEnd}
                      min={exportStart}
                      onChange={e => setExportEnd(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold outline-none tabular-nums"
                    />
                  </div>
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shrink-0
                      ${isExporting
                        ? 'opacity-60 cursor-not-allowed bg-[#1C1C1E] text-[#FACC15]'
                        : 'bg-[#1C1C1E] text-[#FACC15] hover:bg-gray-800'}`}
                  >
                    {isExporting
                      ? <><Loader2 size={16} className="animate-spin"/> Exporting...</>
                      : <><Download size={16}/> Export</>
                    }
                  </button>
                </div>

                {/* 진행 상태 메시지 */}
                {isExporting && exportProgress && (
                  <p className={`text-xs font-semibold animate-pulse ${theme.textMuted}`}>
                    {exportProgress}
                  </p>
                )}
              </div>

              {/* Backup & Restore */}
              <div className={`flex flex-col gap-5 pt-6 border-t ${theme.border}`}>
                <div>
                  <p className="text-base font-bold flex items-center gap-1.5"><Save size={18} className="text-[#FACC15]"/> Backup & Restore</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>전체 데이터를 파일로 저장하거나 불러옵니다. Google Drive에 수동으로 업로드해두면 안전합니다.</p>
                </div>

                {/* 백업 버튼 */}
                <div className={`flex flex-col sm:flex-row gap-3 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-0.5">백업 다운로드</p>
                    <p className={`text-xs ${theme.textMuted}`}>JSON(완전 복원용) + Markdown(노트 읽기용)</p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button onClick={handleBackupJSON} disabled={isBackingUp}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-[#1C1C1E] text-[#FACC15] hover:bg-gray-800 transition-colors disabled:opacity-50">
                      {isBackingUp ? <Loader2 size={14} className="animate-spin"/> : <FileJson size={14}/>} JSON
                    </button>
                    <button onClick={handleBackupMarkdown} disabled={isBackingUp}
                      className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm border transition-colors disabled:opacity-50 ${theme.border} ${theme.hoverBg}`}>
                      {isBackingUp ? <Loader2 size={14} className="animate-spin"/> : <FileText size={14}/>} MD
                    </button>
                  </div>
                </div>

                {/* 복원 */}
                <div className={`flex flex-col sm:flex-row gap-3 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-0.5">백업에서 복원</p>
                    <p className={`text-xs ${theme.textMuted}`}>JSON 백업 파일을 선택하면 기존 데이터에 병합됩니다.</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-start sm:items-end">
                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleRestore}/>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-[#1C1C1E] text-[#FACC15] hover:bg-gray-800 transition-colors disabled:opacity-50">
                      {isRestoring ? <><Loader2 size={14} className="animate-spin"/> 복원 중...</> : <><ArchiveRestore size={14}/> 파일 선택</>}
                    </button>
                    {restoreMsg && (
                      <p className={`text-xs font-semibold flex items-center gap-1 ${restoreMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        <AlertTriangle size={11}/> {restoreMsg.text}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Sign Out */}
              <div className={`flex flex-col lg:flex-row justify-between lg:items-center gap-4 lg:gap-0 pt-6 border-t ${theme.border}`}>
                <div>
                  <p className="text-base font-bold flex items-center gap-1.5"><LogOut size={18}/> Sign Out</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Log out of your account.</p>
                </div>
                <button onClick={onSignOut} className={`px-6 py-3.5 rounded-xl font-bold text-sm transition-colors border ${theme.border} ${theme.hoverBg}`}>
                  Sign Out
                </button>
              </div>

            </div>
          </div>
        </div>
      </div>

    </div>
  );
};
