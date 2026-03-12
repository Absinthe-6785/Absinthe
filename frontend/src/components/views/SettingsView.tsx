import { useState, useCallback, useRef } from 'react';
import { Settings, Save, Download, LogOut, Loader2, ArchiveRestore, FileJson, FileText, AlertTriangle } from 'lucide-react';
import { API_URL } from '../../lib/config';
import { authFetch } from '../../lib/supabase';
import { SettingsProps } from '../../types';
import { exportAllToCsv } from '../../lib/csvExport';

export const SettingsView = ({ appSettings, updateSetting, showToast, theme, THEME_COLORS, onSignOut }: SettingsProps) => {
  // ── CSV Export ────────────────────────────────────────────────────────────
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 8) + '01';
  const [exportStart, setExportStart] = useState(firstOfMonth);
  const [exportEnd,   setExportEnd]   = useState(today);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState('');

  const handleExport = useCallback(async () => {
    if (!exportStart || !exportEnd) return showToast('Start and end date required', 'error');
    if (exportStart > exportEnd)    return showToast('End date must be after start date', 'error');
    setIsExporting(true);
    setExportProgress('Starting export...');
    try {
      await exportAllToCsv({ startDate: exportStart, endDate: exportEnd, onProgress: setExportProgress });
      showToast('CSV downloaded! 📥');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      showToast(`Export failed${msg ? ': ' + msg : ''}`, 'error');
    } finally {
      setIsExporting(false);
      setExportProgress('');
    }
  }, [exportStart, exportEnd, showToast]);

  // ── Backup & Restore ──────────────────────────────────────────────────────
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreMsg, setRestoreMsg]   = useState<{ type: 'success'|'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleBackupJSON = async () => {
    setIsBackingUp(true);
    try {
      const res = await authFetch(`${API_URL}/api/backup`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `fOr_Absinthe_backup_${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('JSON backup downloaded! 💾');
    } catch { showToast('Backup failed', 'error'); }
    finally { setIsBackingUp(false); }
  };

  const handleBackupMarkdown = async () => {
    setIsBackingUp(true);
    try {
      const res = await authFetch(`${API_URL}/api/backup`);
      if (!res.ok) throw new Error('Failed');
      const data = await res.json();
      const folderMap: Record<string, string> = {};
      (data.note_folders || []).forEach((f: { id: string; name: string }) => { folderMap[f.id] = f.name; });
      const md = (data.notes || [])
        .filter((n: { deleted_at: number | null }) => !n.deleted_at)
        .map((n: { title: string; body: string; folder_id: string | null; updated_at: number }) =>
          `# ${n.title}\n> Folder: ${n.folder_id ? (folderMap[n.folder_id] ?? 'Unknown') : 'No Folder'}\n> Updated: ${new Date(n.updated_at).toLocaleString('ko-KR')}\n\n${n.body}\n\n---\n`
        ).join('\n');
      const blob = new Blob([md], { type: 'text/markdown' });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href = url;
      a.download = `fOr_Absinthe_notes_${new Date().toISOString().slice(0,10)}.md`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Markdown downloaded! 📝');
    } catch { showToast('Markdown export failed', 'error'); }
    finally { setIsBackingUp(false); }
  };

  const [reloadCountdown, setReloadCountdown] = useState<number | null>(null);

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith('.json')) {
      setRestoreMsg({ type: 'error', text: 'Only JSON backup files are supported.' });
      return;
    }
    setIsRestoring(true);
    setRestoreMsg(null);
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      if (!data.version) throw new Error('Invalid backup file');
      const res = await authFetch(`${API_URL}/api/restore`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Restore failed');
      setRestoreMsg({ type: 'success', text: 'Restore complete! Reloading in 3 seconds...' });
      showToast('Restore complete! 🎉');
      // 3초 카운트다운 후 자동 reload
      setReloadCountdown(3);
      const tick = setInterval(() => {
        setReloadCountdown(prev => {
          if (prev === null || prev <= 1) { clearInterval(tick); window.location.reload(); return null; }
          return prev - 1;
        });
      }, 1000);
    } catch {
      setRestoreMsg({ type: 'error', text: 'Restore failed: please check that the file is a valid backup.' });
    } finally {
      setIsRestoring(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

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
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-6 lg:p-8 flex flex-col relative overflow-hidden transition-colors ${theme.card}`}>
            <h2 className="font-heading text-lg font-bold mb-6 flex items-center gap-2">
              <Save size={20} className="text-[#FACC15]"/> Data Management
            </h2>
            <div className="space-y-6">

              {/* CSV Export */}
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-base font-bold">Export Data (CSV)</p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Download schedules, todos, routines, workouts and InBody records.</p>
                </div>
                <div className={`flex flex-col sm:flex-row items-stretch sm:items-center gap-3 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-xs font-bold shrink-0 ${theme.textMuted}`}>From</span>
                    <input type="date" value={exportStart} max={exportEnd}
                      onChange={e => setExportStart(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold outline-none tabular-nums"/>
                  </div>
                  <span className={`font-bold text-center ${theme.textMuted}`}>—</span>
                  <div className="flex items-center gap-2 flex-1">
                    <span className={`text-xs font-bold shrink-0 ${theme.textMuted}`}>To</span>
                    <input type="date" value={exportEnd} min={exportStart}
                      onChange={e => setExportEnd(e.target.value)}
                      className="flex-1 bg-transparent text-sm font-semibold outline-none tabular-nums"/>
                  </div>
                  <button onClick={handleExport} disabled={isExporting}
                    className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm transition-colors shrink-0
                      ${isExporting ? 'opacity-60 cursor-not-allowed bg-[#1C1C1E] text-[#FACC15]' : 'bg-[#1C1C1E] text-[#FACC15] hover:bg-gray-800'}`}>
                    {isExporting ? <><Loader2 size={16} className="animate-spin"/> Exporting...</> : <><Download size={16}/> Export</>}
                  </button>
                </div>
                {isExporting && exportProgress && (
                  <p className={`text-xs font-semibold animate-pulse ${theme.textMuted}`}>{exportProgress}</p>
                )}
              </div>

              {/* Backup & Restore */}
              <div className={`flex flex-col gap-5 pt-6 border-t ${theme.border}`}>
                <div>
                  <p className="text-base font-bold flex items-center gap-1.5">
                    <ArchiveRestore size={18} className="text-[#FACC15]"/> Backup & Restore
                  </p>
                  <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>Save or restore all your data as a file. Upload to Google Drive manually for safekeeping.</p>
                </div>

                {/* Download Backup */}
                <div className={`flex flex-col sm:flex-row gap-3 p-4 rounded-2xl border ${theme.border} ${theme.input}`}>
                  <div className="flex-1">
                    <p className="text-sm font-bold mb-0.5">Download Backup</p>
                    <p className={`text-xs ${theme.textMuted}`}>JSON (full restore) · Markdown (notes read-only)</p>
                  </div>
                  <div className="flex gap-2 shrink-0 items-center">
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
                    <p className="text-sm font-bold mb-0.5">Restore from Backup</p>
                    <p className={`text-xs ${theme.textMuted}`}>Select a JSON backup file to merge it with your existing data.</p>
                  </div>
                  <div className="flex flex-col gap-2 shrink-0 items-start sm:items-end">
                    <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleRestore}/>
                    <button onClick={() => fileInputRef.current?.click()} disabled={isRestoring}
                      className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold text-sm bg-[#1C1C1E] text-[#FACC15] hover:bg-gray-800 transition-colors disabled:opacity-50">
                      {isRestoring
                        ? <><Loader2 size={14} className="animate-spin"/> Restoring...</>
                        : <><ArchiveRestore size={14}/> Select File</>}
                    </button>
                    {restoreMsg && (
                      <div className={`flex flex-col gap-1.5 ${restoreMsg.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        <p className="text-xs font-semibold flex items-center gap-1">
                          <AlertTriangle size={11}/> {restoreMsg.text}
                        </p>
                        {restoreMsg.type === 'success' && (
                          <button
                            onClick={() => window.location.reload()}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-500/20 hover:bg-green-500/30 transition-colors self-start flex items-center gap-1.5">
                            ↺ Reload now {reloadCountdown !== null ? `(${reloadCountdown})` : ''}
                          </button>
                        )}
                      </div>
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
