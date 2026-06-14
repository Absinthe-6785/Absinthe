import { useState, useEffect } from 'react';
import { X, Pencil, Apple, Scale } from 'lucide-react';
import { authFetch } from '@/lib/supabase';
import { API_URL } from '@/lib/config';
import { useTranslation } from '@/lib/i18n';
import type { Theme } from '@/types';
import { useProteinData } from '../hooks/useProteinData';
import {
  PROTEIN_CATEGORY_KEYS,
  CATEGORY_I18N,
  PROTEIN_FACTORS,
  normalizeProteinCategory,
  type ProteinCategory,
} from './proteinConstants';

export interface ProteinTrackerProps {
  theme: Theme;
  darkMode: boolean;
  selectedDate: Date;
  formatDate: (d: Date) => string;
  showToast: (m: string, t?: 'success' | 'error') => void;
}

export function ProteinTracker({ theme, darkMode, selectedDate, formatDate, showToast }: ProteinTrackerProps) {
  const { t } = useTranslation();

  const [tab, setTab] = useState<'goal' | 'sources' | 'log'>('log');

  const dateStr = formatDate(selectedDate);
  const {
    profile,
    sources,
    intakeLogs,
    totalIntake,
    dailyTarget,
    proteinPct: pct,
    isLoading: proteinLoading,
    mutateProfile,
    mutateSources,
    mutateIntake,
  } = useProteinData(dateStr, selectedDate, formatDate);

  const [profWeight, setProfWeight]       = useState('');
  const [profGoal, setProfGoal]           = useState<'muscle'|'maintain'|'fat'|'athlete'>('muscle');
  const [profAct, setProfAct]             = useState<'low'|'mod'|'high'|'very'>('mod');
  const [profileFormSynced, setProfileFormSynced] = useState(false);

  const [showAddSource, setShowAddSource] = useState(false);
  const [newSrcName, setNewSrcName]       = useState('');
  const [newSrcType, setNewSrcType]       = useState<'fixed'|'per100g'>('fixed');
  const [newSrcVal, setNewSrcVal]         = useState('');
  const [newSrcCat, setNewSrcCat]         = useState<ProteinCategory>('Other');

  const [editSrcId, setEditSrcId]         = useState<string | null>(null);
  const [editSrcName, setEditSrcName]     = useState('');
  const [editSrcCat, setEditSrcCat]       = useState<ProteinCategory>('Other');
  const [editSrcType, setEditSrcType]     = useState<'fixed'|'per100g'>('fixed');
  const [editSrcVal, setEditSrcVal]       = useState('');

  const [intakeAmt, setIntakeAmt]         = useState('');
  const [customNote, setCustomNote]       = useState('');
  const [customProtein, setCustomProtein] = useState('');

  useEffect(() => {
    if (profile && !profileFormSynced) {
      setProfWeight(String(profile.weight));
      setProfGoal(profile.goal as typeof profGoal);
      setProfAct(profile.activity as typeof profAct);
      setProfileFormSynced(true);
    }
  }, [profile, profileFormSynced, profGoal, profAct]);

  const wNum        = parseFloat(profWeight) || 0;
  const [lo, hi]    = PROTEIN_FACTORS[`${profGoal}-${profAct}`] ?? [1.6, 2.0];
  const calcTarget  = Math.round((wNum * lo + wNum * hi) / 2);
  const [selectedSrc, setSelectedSrc]     = useState<string>('');

  const GOAL_OPTS = [
    { v: 'muscle'   as const, label: t('goalMuscle'),  color: 'bg-blue-500'   },
    { v: 'maintain' as const, label: t('goalMaintain'), color: 'bg-green-500'  },
    { v: 'fat'      as const, label: t('goalFat'),      color: 'bg-orange-500' },
    { v: 'athlete'  as const, label: t('goalAthlete'),  color: 'bg-purple-500' },
  ];
  const ACT_OPTS = [
    { v: 'low'  as const, label: t('actLow')  },
    { v: 'mod'  as const, label: t('actMod')  },
    { v: 'high' as const, label: t('actHigh') },
    { v: 'very' as const, label: t('actVery') },
  ];

  const handleSaveProfile = async () => {
    if (!wNum) return showToast(t('enterWeight'), 'error');
    const payload = { weight: wNum, goal: profGoal, activity: profAct, daily_target_g: calcTarget };
    try {
      const res = await authFetch(`${API_URL}/api/protein_profile`, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      mutateProfile();
      setProfileFormSynced(true);
      showToast(t('proteinGoalSaved'));
      setTab('log');
    } catch { showToast(t('failedSaveGoal'), 'error'); }
  };

  const handleAddSource = async () => {
    if (!newSrcName.trim() || !newSrcVal) return;
    const payload = {
      name: newSrcName.trim(), category: newSrcCat, source_type: newSrcType,
      protein_per_serving: newSrcType === 'fixed'   ? parseFloat(newSrcVal) : null,
      protein_per_100g:    newSrcType === 'per100g' ? parseFloat(newSrcVal) : null,
    };
    try {
      const res = await authFetch(`${API_URL}/api/protein_sources`, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      mutateSources();
      setNewSrcName(''); setNewSrcVal(''); setNewSrcCat('Other'); setShowAddSource(false);
      showToast(t('sourceCreated'));
    } catch { showToast(t('failedAddSource'), 'error'); }
  };

  const handleLogCustom = async () => {
    const protein = parseFloat(customProtein);
    if (!protein || protein <= 0) return;
    try {
      const res = await authFetch(`${API_URL}/api/protein_intake`, {
        method: 'POST',
        body: JSON.stringify({ date: dateStr, source_id: null, amount_g: protein, protein_g: protein, note: customNote.trim() || 'Custom entry' }),
      });
      if (!res.ok) throw new Error();
      mutateIntake();
      setCustomNote(''); setCustomProtein(''); setSelectedSrc('');
      showToast(t('intakeLogged'));
    } catch { showToast(t('failedLogIntake'), 'error'); }
  };

  const handleUpdateSource = async () => {
    if (!editSrcId || !editSrcName.trim() || !editSrcVal) return;
    const payload = {
      name: editSrcName.trim(), category: editSrcCat, source_type: editSrcType,
      protein_per_serving: editSrcType === 'fixed'   ? parseFloat(editSrcVal) : null,
      protein_per_100g:    editSrcType === 'per100g' ? parseFloat(editSrcVal) : null,
    };
    try {
      const res = await authFetch(`${API_URL}/api/protein_sources/${editSrcId}`, { method: 'PUT', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      mutateSources();
      setEditSrcId(null);
      showToast(t('sourceUpdated'));
    } catch { showToast(t('failedUpdateSource'), 'error'); }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/protein_sources/${id}`, { method: 'DELETE' });
      mutateSources();
      showToast(t('sourceDeleted'));
    } catch { /* silent */ }
  };

  const handleLogIntake = async () => {
    const src = sources.find(s => s.id === selectedSrc);
    if (!src) return;
    if (!intakeAmt || parseFloat(intakeAmt) <= 0) return;
    const amt     = parseFloat(intakeAmt);
    const protein = src.source_type === 'fixed'
      ? Math.round((src.protein_per_serving ?? 0) * amt * 100) / 100
      : Math.round((src.protein_per_100g ?? 0) * amt / 100 * 100) / 100;
    try {
      const res = await authFetch(`${API_URL}/api/protein_intake`, {
        method: 'POST',
        body: JSON.stringify({ date: dateStr, source_id: src.id, amount_g: amt, protein_g: protein }),
      });
      if (!res.ok) throw new Error();
      mutateIntake();
      setIntakeAmt('');
      showToast(t('intakeLogged'));
    } catch { showToast(t('failedLogIntake'), 'error'); }
  };

  const handleDeleteIntake = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/protein_intake/${id}`, { method: 'DELETE' });
      mutateIntake();
      showToast(t('intakeDeleted'));
    } catch { /* silent */ }
  };

  const selectedSrcObj  = sources.find(s => s.id === selectedSrc);
  const previewProtein  = selectedSrcObj && intakeAmt && parseFloat(intakeAmt) > 0
    ? selectedSrcObj.source_type === 'fixed'
      ? Math.round((selectedSrcObj.protein_per_serving ?? 0) * parseFloat(intakeAmt) * 100) / 100
      : Math.round((selectedSrcObj.protein_per_100g ?? 0) * parseFloat(intakeAmt || '0') / 100 * 100) / 100
    : null;

  if (proteinLoading) return (
    <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col gap-4 h-full min-h-[480px] ${theme.card}`}>
      <div className="h-7 w-36 rounded-xl bg-current opacity-10 animate-pulse"/>
      <div className="h-10 w-full rounded-2xl bg-current opacity-10 animate-pulse"/>
      <div className="h-[320px] w-full rounded-2xl bg-current opacity-10 animate-pulse"/>
    </div>
  );

  return (
    <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col gap-4 transition-colors h-full ${theme.card}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold flex items-center gap-2"><Apple size={18} className="text-primary" /> {t('proteinTracker')}</h2>
      </div>
      <div className="flex rounded-2xl p-1 gap-1 shrink-0 bg-surface-alt">
        {([['goal', t('proteinProfile')], ['sources', t('proteinSources')], ['log', t('proteinLog')]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setTab(v)}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
              ${tab === v ? 'bg-primary text-primary-foreground shadow-sm' : theme.textMuted}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'goal' && (
        <div className="flex flex-col gap-3 h-[320px] overflow-y-auto">
          <div className={`rounded-2xl p-3 flex justify-between items-center border-2 border-transparent focus-within:border-primary transition-colors ${theme.input}`}>
            <div>
              <p className={`text-xs font-semibold ml-1 mb-0.5 ${theme.textMuted}`}>{t('bodyWeight')}</p>
              <div className="flex items-end gap-1">
                <input type="number" inputMode="decimal" min="0" step="0.1"
                  value={profWeight} placeholder="0" onChange={e => setProfWeight(e.target.value)}
                  className="w-16 bg-transparent text-xl font-bold outline-none ml-1"/>
                <span className={`text-sm font-semibold mb-1 ${theme.textMuted}`}>kg</span>
              </div>
            </div>
            <span className="text-muted mr-1"><Scale size={20} /></span>
          </div>
          <div>
            <p className={`text-xs font-bold mb-2 ${theme.textMuted}`}>{t('goal').toUpperCase()}</p>
            <div className="grid grid-cols-2 gap-2">
              {GOAL_OPTS.map(({ v, label, color }) => (
                <button key={v} onClick={() => setProfGoal(v)}
                  className={`py-2.5 rounded-xl text-xs font-bold transition-all
                    ${profGoal === v ? `${color} text-white shadow-md` : `${theme.input} ${theme.textMuted}`}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={`text-xs font-bold mb-2 ${theme.textMuted}`}>{t('activityLevel').toUpperCase()}</p>
            <div className="grid grid-cols-2 gap-2">
              {ACT_OPTS.map(({ v, label }) => (
                <button key={v} onClick={() => setProfAct(v)}
                  className={`py-2 rounded-xl text-xs font-semibold transition-all
                    ${profAct === v ? 'bg-primary text-primary-foreground shadow-md' : `${theme.input} ${theme.textMuted}`}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          {wNum > 0 && (
            <div className="rounded-2xl p-3 flex items-center justify-between bg-surface-alt">
              <p className={`text-xs font-bold ${theme.textMuted}`}>{t('dailyProtein')}</p>
              <p className="text-2xl font-black text-primary tabular-nums">{calcTarget}g</p>
            </div>
          )}
          <button onClick={handleSaveProfile}
            className="w-full bg-primary text-primary-foreground font-bold py-3.5 rounded-2xl hover:bg-gray-800 transition-colors">
            {t('saveGoal')}
          </button>
        </div>
      )}

      {tab === 'sources' && (
        <div className="flex flex-col min-h-[320px] h-[320px]">
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0 pr-0.5">
            {sources.length === 0 && !showAddSource && (
              <p className={`text-sm text-center py-4 ${theme.textMuted}`}>{t('noSources')}</p>
            )}
            {PROTEIN_CATEGORY_KEYS.map(cat => {
              const catSources = sources.filter(s => normalizeProteinCategory(s.category || 'Other') === cat);
              if (catSources.length === 0) return null;
              return (
                <div key={cat} className="mb-3">
                  <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 px-0.5 ${theme.textMuted}`}>{t(CATEGORY_I18N[cat])}</p>
                  <div className="flex flex-col gap-2">
                    {catSources.map(src => (
                      <div key={src.id} className={`rounded-2xl shrink-0 overflow-hidden ${theme.input}`}>
                        <div className="p-3 flex items-center justify-between">
                          <div className="min-w-0 mr-2">
                            <p className="text-sm font-bold truncate">{src.name}</p>
                            <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                              {src.source_type === 'fixed' ? `${src.protein_per_serving}g / ${t('serving')}` : `${src.protein_per_100g}g / 100g`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${src.source_type === 'fixed' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'}`}>
                              {src.source_type === 'fixed' ? t('proteinFixed').split(' ')[0] : '/100g'}
                            </span>
                            <button onClick={() => {
                              if (editSrcId === src.id) { setEditSrcId(null); return; }
                              setEditSrcId(src.id);
                              setEditSrcName(src.name);
                              setEditSrcCat((src.category || 'Other') as ProteinCategory);
                              setEditSrcType(src.source_type);
                              setEditSrcVal(String(src.source_type === 'fixed' ? src.protein_per_serving : src.protein_per_100g));
                            }} className={`p-1.5 rounded-full transition-colors ${editSrcId === src.id ? 'bg-primary/20 text-primary' : 'hover:bg-gray-500/20 text-gray-400'}`}>
                              <Pencil size={13}/>
                            </button>
                            <button onClick={() => handleDeleteSource(src.id)} className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-colors">
                              <X size={13}/>
                            </button>
                          </div>
                        </div>
                        {editSrcId === src.id && (
                          <div className={`px-3 pb-3 flex flex-col gap-2 border-t ${darkMode ? 'border-white/10' : 'border-black/5'}`}>
                            <input type="text" value={editSrcName} onChange={e => setEditSrcName(e.target.value)}
                              className="w-full bg-transparent text-sm font-semibold outline-none pt-2"/>
                            <select value={editSrcCat} onChange={e => setEditSrcCat(e.target.value as ProteinCategory)}
                              className={`w-full text-sm font-semibold outline-none rounded-xl px-2 py-1.5 ${darkMode ? 'text-gray-300 bg-surface' : 'text-gray-700 bg-gray-100'}`}>
                              {PROTEIN_CATEGORY_KEYS.map(c => <option key={c} value={c}>{t(CATEGORY_I18N[c])}</option>)}
                            </select>
                            <div className="flex gap-2">
                              {(['fixed', 'per100g'] as const).map(v => (
                                <button key={v} onClick={() => setEditSrcType(v)}
                                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all
                                    ${editSrcType === v ? 'bg-primary text-primary-foreground' : `${darkMode ? 'bg-surface' : 'bg-gray-200'} ${theme.textMuted}`}`}>
                                  {v === 'fixed' ? t('proteinFixed') : t('proteinPer100g')}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" inputMode="decimal" min="0" step="0.1" value={editSrcVal}
                                onChange={e => setEditSrcVal(e.target.value)}
                                className="w-16 text-lg font-bold outline-none bg-transparent"/>
                              <span className={`text-xs font-semibold flex-1 ${theme.textMuted}`}>
                                g {editSrcType === 'fixed' ? `/ ${t('serving')}` : '/ 100g'}
                              </span>
                              <button onClick={() => setEditSrcId(null)}
                                className={`py-1.5 px-3 rounded-xl text-xs font-bold ${theme.input}`}>{t('cancel')}</button>
                              <button onClick={handleUpdateSource}
                                className="py-1.5 px-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground">{t('save')}</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="shrink-0 pt-2">
            {showAddSource ? (
              <div className={`rounded-2xl p-4 flex flex-col gap-3 border-2 border-primary/40 ${theme.input}`}>
                <input autoFocus type="text" value={newSrcName} placeholder={t('proteinSourceName')}
                  onChange={e => setNewSrcName(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none"/>
                <select value={newSrcCat} onChange={e => setNewSrcCat(e.target.value as ProteinCategory)}
                  className={`w-full bg-transparent text-sm font-semibold outline-none ${darkMode ? 'text-gray-300 bg-surface' : 'text-gray-700 bg-gray-100'} rounded-xl px-2 py-1.5`}>
                  {PROTEIN_CATEGORY_KEYS.map(c => <option key={c} value={c}>{t(CATEGORY_I18N[c])}</option>)}
                </select>
                <div className="flex gap-2">
                  {(['fixed', 'per100g'] as const).map(v => (
                    <button key={v} onClick={() => setNewSrcType(v)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                        ${newSrcType === v ? 'bg-primary text-primary-foreground' : `${darkMode ? 'bg-surface' : 'bg-gray-200'} ${theme.textMuted}`}`}>
                      {v === 'fixed' ? t('proteinFixed') : t('proteinPer100g')}
                    </button>
                  ))}
                </div>
                <div className={`flex items-center gap-2 rounded-xl p-2.5 ${darkMode ? 'bg-surface' : 'bg-gray-100'}`}>
                  <input type="number" inputMode="decimal" min="0" step="0.1" value={newSrcVal} placeholder="0"
                    onChange={e => setNewSrcVal(e.target.value)}
                    className="w-16 bg-transparent text-lg font-bold outline-none"/>
                  <span className={`text-xs font-semibold ${theme.textMuted}`}>g {newSrcType === 'fixed' ? `/ ${t('serving')}` : '/ 100g'}</span>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowAddSource(false); setNewSrcName(''); setNewSrcVal(''); }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${theme.input}`}>{t('cancel')}</button>
                  <button onClick={handleAddSource}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground">{t('add')}</button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddSource(true)}
                className={`w-full py-3 rounded-2xl text-sm font-bold border-2 border-dashed transition-colors
                  ${darkMode ? 'border-gray-700 text-gray-400 hover:border-primary hover:text-primary' : 'border-gray-300 text-gray-400 hover:border-primary hover:text-primary'}`}>
                + {t('add')}
              </button>
            )}
          </div>
        </div>
      )}

      {tab === 'log' && (
        <div className="flex flex-col min-h-[320px] h-[320px] gap-0">
          {dailyTarget > 0 ? (
            <div className="rounded-2xl p-3.5 shrink-0 mb-2.5 bg-surface-alt">
              <div className="flex justify-between items-baseline mb-1.5">
                <span className="text-2xl font-black text-primary tabular-nums">{totalIntake}g</span>
                <span className={`text-xs font-bold ${theme.textMuted}`}>/ {dailyTarget}g</span>
              </div>
              <div className={`h-2 rounded-full overflow-hidden ${darkMode ? 'bg-surface' : 'bg-gray-200'}`}>
                <div className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-green-500' : 'bg-primary'}`} style={{ width: `${pct}%` }}/>
              </div>
              <p className={`text-xs font-bold mt-1 text-right ${pct >= 100 ? 'text-green-500' : theme.textMuted}`}>{pct}%</p>
            </div>
          ) : (
            <button onClick={() => setTab('goal')}
              className={`text-xs text-center py-3 rounded-2xl font-bold border-2 border-dashed mb-2.5 transition-colors shrink-0
                ${darkMode ? 'border-gray-700 text-gray-400 hover:border-primary hover:text-primary' : 'border-gray-300 text-gray-400 hover:border-primary hover:text-primary'}`}>
              {t('saveGoal')} →
            </button>
          )}

          <div className={`rounded-2xl p-3 flex flex-col gap-2 border-2 border-transparent focus-within:border-primary/40 transition-colors shrink-0 mb-2.5 ${theme.input}`}>
            <select value={selectedSrc} onChange={e => { setSelectedSrc(e.target.value); setIntakeAmt(''); setCustomNote(''); setCustomProtein(''); }}
              className={`w-full bg-transparent text-sm font-semibold outline-none ${!selectedSrc ? theme.textMuted : ''}`}>
              <option value="">{t('addIntakeLabel')}</option>
              <option value="__custom__">{t('directInput')}</option>
              {PROTEIN_CATEGORY_KEYS.filter(cat => sources.some(s => normalizeProteinCategory(s.category || 'Other') === cat)).map(cat => (
                <optgroup key={cat} label={cat}>
                  {sources.filter(s => (s.category || 'Other') === cat).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
              {sources.filter(s => !s.category).length > 0 && (
                <optgroup label="Other">
                  {sources.filter(s => !s.category).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              )}
            </select>

            {selectedSrc === '__custom__' && (
              <div className="flex flex-col gap-2">
                <input type="text" value={customNote} placeholder={t('memoOptional')} onChange={e => setCustomNote(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none border-b border-gray-600/30 pb-1"/>
                <div className="flex items-center gap-2">
                  <input type="number" inputMode="decimal" min="0" step="0.1" value={customProtein} placeholder="0"
                    onChange={e => setCustomProtein(e.target.value)}
                    className="w-16 bg-transparent text-lg font-bold outline-none"/>
                  <span className={`text-xs font-semibold flex-1 ${theme.textMuted}`}>{t('gProtein')}</span>
                  <button onClick={handleLogCustom} disabled={!customProtein || parseFloat(customProtein) <= 0}
                    className="bg-primary text-primary-foreground text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all">
                    {t('add')}
                  </button>
                </div>
              </div>
            )}

            {selectedSrc && selectedSrc !== '__custom__' && (
              <div className="flex items-center gap-2">
                {selectedSrcObj?.source_type === 'per100g' ? (
                  <>
                    <input type="number" inputMode="decimal" min="0" step="1"
                      value={intakeAmt} placeholder="0" onChange={e => setIntakeAmt(e.target.value)}
                      className="w-16 bg-transparent text-lg font-bold outline-none"/>
                    <span className={`text-xs font-semibold flex-1 ${theme.textMuted}`}>
                      {`g${previewProtein !== null ? ` → ${previewProtein}${t('gProtein')}` : ''}`}
                    </span>
                  </>
                ) : (
                  <>
                    <input type="number" inputMode="numeric" min="1" step="1"
                      value={intakeAmt} placeholder="1" onChange={e => setIntakeAmt(e.target.value)}
                      className="w-14 bg-transparent text-lg font-bold outline-none"/>
                    <span className={`text-xs font-semibold flex-1 ${theme.textMuted}`}>
                      {t('unit')}{previewProtein !== null ? ` → ${previewProtein}${t('gProtein')}` : ` (${selectedSrcObj?.protein_per_serving}g / ${t('unit')})`}
                    </span>
                  </>
                )}
                <button onClick={handleLogIntake}
                  disabled={!intakeAmt || parseFloat(intakeAmt) <= 0}
                  className="bg-primary text-primary-foreground text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all">
                  {t('add')}
                </button>
              </div>
            )}

            {sources.length === 0 && selectedSrc === '' && (
              <button onClick={() => setTab('sources')} className={`text-xs font-bold ${theme.textMuted} hover:text-primary transition-colors text-left`}>
                {t('addSourceFirst')}
              </button>
            )}
          </div>

          {intakeLogs.length > 0 ? (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0 pt-0.5">
              {(['__custom__', ...PROTEIN_CATEGORY_KEYS] as const).map(cat => {
                const logs = cat === '__custom__'
                  ? intakeLogs.filter(l => !l.protein_sources)
                  : intakeLogs.filter(l => l.protein_sources && normalizeProteinCategory(l.protein_sources.category || 'Other') === cat);
                if (logs.length === 0) return null;
                const catLabel = cat === '__custom__' ? t('customEntryLabel') : t(CATEGORY_I18N[cat]);
                return (
                  <div key={cat} className="mb-2">
                    <p className={`text-[10px] font-black uppercase tracking-wider mb-1 px-1 ${theme.textMuted}`}>{catLabel}</p>
                    <div className="flex flex-col gap-1">
                      {logs.map(log => (
                        <div key={log.id} className={`rounded-xl px-3 py-2 flex items-center justify-between shrink-0 ${theme.input}`}>
                          <div className="min-w-0 mr-2">
                            <p className="text-sm font-bold truncate">
                              {log.protein_sources?.name ?? log.note ?? t('customEntryLabel')}
                            </p>
                            <p className={`text-xs ${theme.textMuted}`}>
                              {log.protein_sources?.source_type === 'per100g' ? `${log.amount_g}g · ` : ''}{log.protein_g}{t('gProtein')}
                            </p>
                          </div>
                          <button onClick={() => handleDeleteIntake(log.id)} className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0">
                            <X size={13}/>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={`text-xs text-center py-3 ${theme.textMuted}`}>{t('noIntakeToday')}</p>
          )}
        </div>
      )}
    </div>
  );
}
