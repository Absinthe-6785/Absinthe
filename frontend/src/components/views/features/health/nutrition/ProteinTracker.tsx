import { useState, useEffect, useMemo } from 'react';
import { X, Pencil, Apple, Scale, FileText, ChevronDown, Plus } from 'lucide-react';
import { authFetch } from '@/lib/supabase';
import { API_URL } from '@/lib/config';
import { useTranslation } from '@/lib/i18n';
import type { ProteinSource, Theme } from '@/types';
import type { ToastType } from '@/hooks/useToast';
import { WORKSPACE_CARD } from '@/components/common/workspaceCardSizes';
import { useProteinData } from '../hooks/useProteinData';
import {
  PROTEIN_CATEGORY_KEYS,
  CATEGORY_I18N,
  PROTEIN_FACTORS,
  normalizeProteinCategory,
  type ProteinCategory,
} from './proteinConstants';
import {
  formatProteinLogTime,
  rankQuickAddSources,
  recordProteinSourceUse,
} from './proteinQuickAdd';

export interface ProteinTrackerProps {
  theme: Theme;
  darkMode: boolean;
  selectedDate: Date;
  formatDate: (d: Date) => string;
  showToast: (m: string, t?: ToastType) => void;
  onOpenDayNote?: () => void;
  mode?: 'full' | 'compact';
  onOpenFull?: () => void;
}

export function ProteinTracker({
  theme,
  darkMode,
  selectedDate,
  formatDate,
  showToast,
  onOpenDayNote,
  mode = 'full',
  onOpenFull,
}: ProteinTrackerProps) {
  const { t } = useTranslation();
  const [showFoodLibrary, setShowFoodLibrary] = useState(false);
  const [showGoalPanel, setShowGoalPanel] = useState(false);

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

  const [profWeight, setProfWeight] = useState('');
  const [profGoal, setProfGoal] = useState<'muscle' | 'maintain' | 'fat' | 'athlete'>('muscle');
  const [profAct, setProfAct] = useState<'low' | 'mod' | 'high' | 'very'>('mod');
  const [profileFormSynced, setProfileFormSynced] = useState(false);

  const [showAddSource, setShowAddSource] = useState(false);
  const [newSrcName, setNewSrcName] = useState('');
  const [newSrcType, setNewSrcType] = useState<'fixed' | 'per100g'>('fixed');
  const [newSrcVal, setNewSrcVal] = useState('');
  const [newSrcCat, setNewSrcCat] = useState<ProteinCategory>('Other');

  const [editSrcId, setEditSrcId] = useState<string | null>(null);
  const [editSrcName, setEditSrcName] = useState('');
  const [editSrcCat, setEditSrcCat] = useState<ProteinCategory>('Other');
  const [editSrcType, setEditSrcType] = useState<'fixed' | 'per100g'>('fixed');
  const [editSrcVal, setEditSrcVal] = useState('');

  const [intakeAmt, setIntakeAmt] = useState('');
  const [customNote, setCustomNote] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [selectedSrc, setSelectedSrc] = useState('');

  useEffect(() => {
    if (profile && !profileFormSynced) {
      setProfWeight(String(profile.weight));
      setProfGoal(profile.goal as typeof profGoal);
      setProfAct(profile.activity as typeof profAct);
      setProfileFormSynced(true);
    }
  }, [profile, profileFormSynced, profGoal, profAct]);

  const wNum = parseFloat(profWeight) || 0;
  const [lo, hi] = PROTEIN_FACTORS[`${profGoal}-${profAct}`] ?? [1.6, 2.0];
  const calcTarget = Math.round((wNum * lo + wNum * hi) / 2);
  const remaining = Math.max(0, dailyTarget - totalIntake);

  const quickAddSources = useMemo(() => rankQuickAddSources(sources), [sources]);

  const timelineLogs = useMemo(
    () => [...intakeLogs].sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    }),
    [intakeLogs],
  );

  const sourcesByCategory = useMemo(() => {
    const grouped = new Map<ProteinCategory, ProteinSource[]>();
    for (const cat of PROTEIN_CATEGORY_KEYS) grouped.set(cat, []);
    for (const src of sources) {
      const cat = normalizeProteinCategory(src.category || 'Other');
      grouped.get(cat)!.push(src);
    }
    return grouped;
  }, [sources]);

  const GOAL_OPTS = [
    { v: 'muscle' as const, label: t('goalMuscle'), color: 'bg-blue-500' },
    { v: 'maintain' as const, label: t('goalMaintain'), color: 'bg-green-500' },
    { v: 'fat' as const, label: t('goalFat'), color: 'bg-orange-500' },
    { v: 'athlete' as const, label: t('goalAthlete'), color: 'bg-purple-500' },
  ];
  const ACT_OPTS = [
    { v: 'low' as const, label: t('actLow') },
    { v: 'mod' as const, label: t('actMod') },
    { v: 'high' as const, label: t('actHigh') },
    { v: 'very' as const, label: t('actVery') },
  ];

  const postIntake = async (body: Record<string, unknown>, sourceId?: string) => {
    const res = await authFetch(`${API_URL}/api/protein_intake`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error();
    if (sourceId) recordProteinSourceUse(sourceId);
    mutateIntake();
    showToast(t('intakeLogged'));
  };

  const handleSaveProfile = async () => {
    if (!wNum) return showToast(t('enterWeight'), 'error');
    const payload = { weight: wNum, goal: profGoal, activity: profAct, daily_target_g: calcTarget };
    try {
      const res = await authFetch(`${API_URL}/api/protein_profile`, { method: 'POST', body: JSON.stringify(payload) });
      if (!res.ok) throw new Error();
      mutateProfile();
      setProfileFormSynced(true);
      showToast(t('proteinGoalSaved'));
      setShowGoalPanel(false);
    } catch { showToast(t('failedSaveGoal'), 'error'); }
  };

  const handleAddSource = async () => {
    if (!newSrcName.trim() || !newSrcVal) return;
    const payload = {
      name: newSrcName.trim(), category: newSrcCat, source_type: newSrcType,
      protein_per_serving: newSrcType === 'fixed' ? parseFloat(newSrcVal) : null,
      protein_per_100g: newSrcType === 'per100g' ? parseFloat(newSrcVal) : null,
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
      await postIntake({
        date: dateStr, source_id: null, amount_g: protein, protein_g: protein,
        note: customNote.trim() || 'Custom entry',
      });
      setCustomNote(''); setCustomProtein(''); setSelectedSrc('');
    } catch { showToast(t('failedLogIntake'), 'error'); }
  };

  const handleUpdateSource = async () => {
    if (!editSrcId || !editSrcName.trim() || !editSrcVal) return;
    const payload = {
      name: editSrcName.trim(), category: editSrcCat, source_type: editSrcType,
      protein_per_serving: editSrcType === 'fixed' ? parseFloat(editSrcVal) : null,
      protein_per_100g: editSrcType === 'per100g' ? parseFloat(editSrcVal) : null,
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
    const amt = parseFloat(intakeAmt);
    const protein = src.source_type === 'fixed'
      ? Math.round((src.protein_per_serving ?? 0) * amt * 100) / 100
      : Math.round((src.protein_per_100g ?? 0) * amt / 100 * 100) / 100;
    try {
      await postIntake({ date: dateStr, source_id: src.id, amount_g: amt, protein_g: protein }, src.id);
      setIntakeAmt('');
    } catch { showToast(t('failedLogIntake'), 'error'); }
  };

  const handleQuickAdd = async (src: ProteinSource) => {
    const amt = src.source_type === 'fixed' ? 1 : 100;
    const protein = src.source_type === 'fixed'
      ? Math.round((src.protein_per_serving ?? 0) * 100) / 100
      : Math.round((src.protein_per_100g ?? 0) * 100) / 100;
    if (protein <= 0) return;
    try {
      await postIntake({ date: dateStr, source_id: src.id, amount_g: amt, protein_g: protein }, src.id);
    } catch { showToast(t('failedLogIntake'), 'error'); }
  };

  const handleDeleteIntake = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/protein_intake/${id}`, { method: 'DELETE' });
      mutateIntake();
      showToast(t('intakeDeleted'));
    } catch { /* silent */ }
  };

  const selectedSrcObj = sources.find(s => s.id === selectedSrc);
  const previewProtein = selectedSrcObj && intakeAmt && parseFloat(intakeAmt) > 0
    ? selectedSrcObj.source_type === 'fixed'
      ? Math.round((selectedSrcObj.protein_per_serving ?? 0) * parseFloat(intakeAmt) * 100) / 100
      : Math.round((selectedSrcObj.protein_per_100g ?? 0) * parseFloat(intakeAmt || '0') / 100 * 100) / 100
    : null;

  const cardTier = mode === 'compact' ? WORKSPACE_CARD.sm : WORKSPACE_CARD.hero;

  if (proteinLoading) {
    return (
      <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-4 lg:p-5 flex flex-col gap-3 ${cardTier} ${theme.card}`} data-workspace="nutrition">
        <div className="h-6 w-28 rounded-xl bg-current opacity-10 animate-pulse" />
        <div className="h-12 w-full rounded-2xl bg-current opacity-10 animate-pulse" />
        <div className="h-24 w-full rounded-2xl bg-current opacity-10 animate-pulse" />
      </div>
    );
  }

  const progressBlock = (large: boolean) => (
    dailyTarget > 0 ? (
      <div className={`rounded-2xl shrink-0 bg-surface-alt ${large ? 'p-4' : 'p-3'}`} data-protein-progress>
        <div className="flex items-baseline gap-2 mb-2">
          <span className={`font-black text-primary tabular-nums ${large ? 'text-4xl' : 'text-2xl'}`}>
            {totalIntake}
          </span>
          <span className={`font-bold tabular-nums ${large ? 'text-lg' : 'text-sm'} ${theme.textMuted}`}>
            / {dailyTarget}g
          </span>
        </div>
        <div className={`rounded-full overflow-hidden ${large ? 'h-3' : 'h-2'} ${darkMode ? 'bg-surface' : 'bg-gray-200'}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${pct >= 100 ? 'bg-green-500' : 'bg-primary'}`}
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className={`flex justify-between mt-1.5 ${large ? 'text-sm' : 'text-xs'} font-bold`}>
          <span className={pct >= 100 ? 'text-green-500' : theme.textMuted}>{pct}%</span>
          {remaining > 0 ? (
            <span className={theme.textMuted}>{t('k73Remaining')} {remaining}{t('gProtein')}</span>
          ) : (
            <span className="text-green-500">{t('k73ProteinGoalMet')}</span>
          )}
        </div>
      </div>
    ) : (
      <button
        type="button"
        onClick={() => (mode === 'compact' ? onOpenFull?.() : setShowGoalPanel(true))}
        className={`text-xs text-center py-3 rounded-2xl font-bold border-2 border-dashed transition-colors shrink-0
          ${darkMode ? 'border-gray-700 text-gray-400 hover:border-primary hover:text-primary' : 'border-gray-300 text-gray-400 hover:border-primary hover:text-primary'}`}
      >
        {t('saveGoal')} →
      </button>
    )
  );

  const quickAddBlock = (horizontal = false) => (
    <section className="flex flex-col gap-2" data-protein-quick-add>
      <h3 className={`font-bold uppercase tracking-wide text-muted ${mode === 'compact' ? 'text-[10px]' : 'text-xs'}`}>
        {t('k73QuickAdd')}
      </h3>
      {quickAddSources.length === 0 ? (
        <p className={`text-xs ${theme.textMuted}`}>{t('addSourceFirst')}</p>
      ) : (
        <div className={horizontal ? 'flex gap-2 overflow-x-auto pb-1 -mx-0.5 px-0.5' : 'flex flex-wrap gap-2'}>
          {quickAddSources.map(src => {
            const grams = src.source_type === 'fixed'
              ? src.protein_per_serving ?? 0
              : src.protein_per_100g ?? 0;
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => handleQuickAdd(src)}
                className={`shrink-0 rounded-xl font-bold border transition-colors min-h-[44px]
                  ${horizontal ? 'px-3 py-2 text-xs' : 'px-3 py-2.5 text-sm'}
                  ${theme.input} border-transparent hover:border-primary active:scale-[0.98]`}
              >
                <span className="block truncate max-w-[140px]">{src.name}</span>
                <span className={`block text-[10px] font-semibold ${theme.textMuted}`}>+{grams}g</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );

  if (mode === 'compact') {
    return (
      <div
        className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-4 flex flex-col gap-3 transition-colors ${cardTier} ${theme.card}`}
        data-workspace="nutrition-compact"
      >
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-bold flex items-center gap-1.5">
            <Apple size={14} className="text-primary" /> {t('proteinTracker')}
          </h2>
          {onOpenFull ? (
            <button type="button" onClick={onOpenFull} className="text-[10px] font-bold text-primary hover:underline">
              {t('k73OpenFullTracker')}
            </button>
          ) : null}
        </div>
        {progressBlock(false)}
        {quickAddBlock(true)}
        {timelineLogs.length > 0 ? (
          <ul className="flex flex-col gap-1 max-h-24 overflow-y-auto">
            {timelineLogs.slice(0, 4).map(log => (
              <li key={log.id} className={`text-[11px] font-semibold truncate ${theme.textMuted}`}>
                {formatProteinLogTime(log.created_at)}{' '}
                {log.protein_sources?.name ?? log.note ?? t('customEntryLabel')}{' '}
                <span className="text-primary">+{log.protein_g}g</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col gap-4 transition-colors h-full ${cardTier} ${theme.card}`}
      data-workspace="nutrition"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold flex items-center gap-2">
          <Apple size={18} className="text-primary" /> {t('proteinTracker')}
        </h2>
      </div>

      {progressBlock(true)}
      {quickAddBlock(false)}

      <section className="flex flex-col gap-2 min-h-0" data-protein-timeline>
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{t('k73TodayTimeline')}</h3>
        {timelineLogs.length > 0 ? (
          <ul className="flex flex-col gap-1.5 max-h-[200px] overflow-y-auto">
            {timelineLogs.map(log => (
              <li key={log.id} className={`rounded-xl px-3 py-2 flex items-center justify-between gap-2 ${theme.input}`}>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold truncate tabular-nums">
                    <span className={`${theme.textMuted} font-semibold mr-2`}>{formatProteinLogTime(log.created_at)}</span>
                    {log.protein_sources?.name ?? log.note ?? t('customEntryLabel')}
                    <span className="text-primary ml-1.5">+{log.protein_g}g</span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteIntake(log.id)}
                  className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400 transition-colors shrink-0"
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className={`text-xs text-center py-3 ${theme.textMuted}`}>{t('noIntakeToday')}</p>
        )}
      </section>

      <div className={`rounded-2xl p-3 flex flex-col gap-2 border-2 border-transparent focus-within:border-primary/40 transition-colors shrink-0 ${theme.input}`}>
        <p className={`text-[10px] font-bold uppercase tracking-wide ${theme.textMuted}`}>{t('addIntakeLabel')}</p>
        <select
          value={selectedSrc}
          onChange={e => { setSelectedSrc(e.target.value); setIntakeAmt(''); setCustomNote(''); setCustomProtein(''); }}
          className={`w-full bg-transparent text-sm font-semibold outline-none min-h-[44px] ${!selectedSrc ? theme.textMuted : ''}`}
        >
          <option value="">{t('addIntakeLabel')}</option>
          <option value="__custom__">{t('directInput')}</option>
          {PROTEIN_CATEGORY_KEYS.map(cat => {
            const catSources = sourcesByCategory.get(cat) ?? [];
            if (catSources.length === 0) return null;
            return (
              <optgroup key={cat} label={t(CATEGORY_I18N[cat])}>
                {catSources.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </optgroup>
            );
          })}
        </select>

        {selectedSrc === '__custom__' && (
          <div className="flex flex-col gap-2">
            <input type="text" value={customNote} placeholder={t('memoOptional')} onChange={e => setCustomNote(e.target.value)}
              className="w-full bg-transparent text-sm font-semibold outline-none border-b border-gray-600/30 pb-1" />
            <div className="flex items-center gap-2">
              <input type="number" inputMode="decimal" min="0" step="0.1" value={customProtein} placeholder="0"
                onChange={e => setCustomProtein(e.target.value)}
                className="w-16 bg-transparent text-lg font-bold outline-none" />
              <span className={`text-xs font-semibold flex-1 ${theme.textMuted}`}>{t('gProtein')}</span>
              <button type="button" onClick={handleLogCustom} disabled={!customProtein || parseFloat(customProtein) <= 0}
                className="bg-primary text-primary-foreground text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all min-h-[44px]">
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
                  className="w-16 bg-transparent text-lg font-bold outline-none" />
                <span className={`text-xs font-semibold flex-1 ${theme.textMuted}`}>
                  {`g${previewProtein !== null ? ` → ${previewProtein}${t('gProtein')}` : ''}`}
                </span>
              </>
            ) : (
              <>
                <input type="number" inputMode="numeric" min="1" step="1"
                  value={intakeAmt} placeholder="1" onChange={e => setIntakeAmt(e.target.value)}
                  className="w-14 bg-transparent text-lg font-bold outline-none" />
                <span className={`text-xs font-semibold flex-1 ${theme.textMuted}`}>
                  {t('unit')}{previewProtein !== null ? ` → ${previewProtein}${t('gProtein')}` : ` (${selectedSrcObj?.protein_per_serving}g / ${t('unit')})`}
                </span>
              </>
            )}
            <button type="button" onClick={handleLogIntake}
              disabled={!intakeAmt || parseFloat(intakeAmt) <= 0}
              className="bg-primary text-primary-foreground text-xs font-bold px-3.5 py-2 rounded-xl hover:bg-gray-800 disabled:opacity-40 transition-all min-h-[44px]">
              {t('add')}
            </button>
          </div>
        )}
      </div>

      <section className="flex flex-col gap-2 border-t pt-3 border-border/40" data-protein-food-library>
        <button
          type="button"
          onClick={() => setShowFoodLibrary(v => !v)}
          className="flex items-center justify-between gap-2 text-left min-h-[44px]"
        >
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{t('k73FoodLibrary')}</h3>
          <ChevronDown size={16} className={`transition-transform ${showFoodLibrary ? 'rotate-180' : ''} ${theme.textMuted}`} />
        </button>

        {showFoodLibrary ? (
          <div className="flex flex-col gap-3 max-h-[280px] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowGoalPanel(v => !v)}
              className={`flex items-center justify-between rounded-xl px-3 py-2 text-xs font-bold ${theme.input}`}
            >
              {t('proteinProfile')}
              <ChevronDown size={14} className={`transition-transform ${showGoalPanel ? 'rotate-180' : ''}`} />
            </button>

            {showGoalPanel ? (
              <div className="flex flex-col gap-3 px-1">
                <div className={`rounded-2xl p-3 flex justify-between items-center ${theme.input}`}>
                  <div>
                    <p className={`text-xs font-semibold ml-1 mb-0.5 ${theme.textMuted}`}>{t('bodyWeight')}</p>
                    <div className="flex items-end gap-1">
                      <input type="number" inputMode="decimal" min="0" step="0.1"
                        value={profWeight} placeholder="0" onChange={e => setProfWeight(e.target.value)}
                        className="w-16 bg-transparent text-xl font-bold outline-none ml-1" />
                      <span className={`text-sm font-semibold mb-1 ${theme.textMuted}`}>kg</span>
                    </div>
                  </div>
                  <Scale size={20} className="text-muted" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {GOAL_OPTS.map(({ v, label, color }) => (
                    <button key={v} type="button" onClick={() => setProfGoal(v)}
                      className={`py-2 rounded-xl text-xs font-bold transition-all
                        ${profGoal === v ? `${color} text-white shadow-md` : `${theme.input} ${theme.textMuted}`}`}>
                      {label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ACT_OPTS.map(({ v, label }) => (
                    <button key={v} type="button" onClick={() => setProfAct(v)}
                      className={`py-2 rounded-xl text-xs font-semibold transition-all
                        ${profAct === v ? 'bg-primary text-primary-foreground shadow-md' : `${theme.input} ${theme.textMuted}`}`}>
                      {label}
                    </button>
                  ))}
                </div>
                {wNum > 0 ? (
                  <div className="rounded-2xl p-3 flex items-center justify-between bg-surface-alt">
                    <p className={`text-xs font-bold ${theme.textMuted}`}>{t('dailyProtein')}</p>
                    <p className="text-2xl font-black text-primary tabular-nums">{calcTarget}g</p>
                  </div>
                ) : null}
                <button type="button" onClick={handleSaveProfile}
                  className="w-full bg-primary text-primary-foreground font-bold py-3 rounded-2xl hover:bg-gray-800 transition-colors">
                  {t('saveGoal')}
                </button>
              </div>
            ) : null}

            {sources.length === 0 && !showAddSource ? (
              <p className={`text-sm text-center py-2 ${theme.textMuted}`}>{t('noSources')}</p>
            ) : null}

            {PROTEIN_CATEGORY_KEYS.map(cat => {
              const catSources = sources.filter(s => normalizeProteinCategory(s.category || 'Other') === cat);
              if (catSources.length === 0) return null;
              return (
                <div key={cat} className="mb-1">
                  <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 ${theme.textMuted}`}>{t(CATEGORY_I18N[cat])}</p>
                  <div className="flex flex-col gap-2">
                    {catSources.map(src => (
                      <div key={src.id} className={`rounded-2xl overflow-hidden ${theme.input}`}>
                        <div className="p-3 flex items-center justify-between gap-2">
                          <div className="min-w-0 mr-2">
                            <p className="text-sm font-bold truncate">{src.name}</p>
                            <p className={`text-xs mt-0.5 ${theme.textMuted}`}>
                              {src.source_type === 'fixed' ? `${src.protein_per_serving}g / ${t('serving')}` : `${src.protein_per_100g}g / 100g`}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button type="button" onClick={() => {
                              if (editSrcId === src.id) { setEditSrcId(null); return; }
                              setEditSrcId(src.id);
                              setEditSrcName(src.name);
                              setEditSrcCat((src.category || 'Other') as ProteinCategory);
                              setEditSrcType(src.source_type);
                              setEditSrcVal(String(src.source_type === 'fixed' ? src.protein_per_serving : src.protein_per_100g));
                            }} className={`p-1.5 rounded-full ${editSrcId === src.id ? 'bg-primary/20 text-primary' : 'hover:bg-gray-500/20 text-gray-400'}`}>
                              <Pencil size={13} />
                            </button>
                            <button type="button" onClick={() => handleDeleteSource(src.id)} className="p-1.5 rounded-full hover:bg-red-500/20 text-red-400">
                              <X size={13} />
                            </button>
                          </div>
                        </div>
                        {editSrcId === src.id ? (
                          <div className={`px-3 pb-3 flex flex-col gap-2 border-t ${darkMode ? 'border-white/10' : 'border-black/5'}`}>
                            <input type="text" value={editSrcName} onChange={e => setEditSrcName(e.target.value)}
                              className="w-full bg-transparent text-sm font-semibold outline-none pt-2" />
                            <select value={editSrcCat} onChange={e => setEditSrcCat(e.target.value as ProteinCategory)}
                              className={`w-full text-sm font-semibold outline-none rounded-xl px-2 py-1.5 ${darkMode ? 'text-gray-300 bg-surface' : 'text-gray-700 bg-gray-100'}`}>
                              {PROTEIN_CATEGORY_KEYS.map(c => <option key={c} value={c}>{t(CATEGORY_I18N[c])}</option>)}
                            </select>
                            <div className="flex gap-2">
                              {(['fixed', 'per100g'] as const).map(v => (
                                <button key={v} type="button" onClick={() => setEditSrcType(v)}
                                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold
                                    ${editSrcType === v ? 'bg-primary text-primary-foreground' : `${darkMode ? 'bg-surface' : 'bg-gray-200'} ${theme.textMuted}`}`}>
                                  {v === 'fixed' ? t('proteinFixed') : t('proteinPer100g')}
                                </button>
                              ))}
                            </div>
                            <div className="flex items-center gap-2">
                              <input type="number" inputMode="decimal" min="0" step="0.1" value={editSrcVal}
                                onChange={e => setEditSrcVal(e.target.value)}
                                className="w-16 text-lg font-bold outline-none bg-transparent" />
                              <button type="button" onClick={() => setEditSrcId(null)}
                                className={`py-1.5 px-3 rounded-xl text-xs font-bold ${theme.input}`}>{t('cancel')}</button>
                              <button type="button" onClick={handleUpdateSource}
                                className="py-1.5 px-3 rounded-xl text-xs font-bold bg-primary text-primary-foreground">{t('save')}</button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {showAddSource ? (
              <div className={`rounded-2xl p-4 flex flex-col gap-3 border-2 border-primary/40 ${theme.input}`}>
                <input autoFocus type="text" value={newSrcName} placeholder={t('proteinSourceName')}
                  onChange={e => setNewSrcName(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none" />
                <select value={newSrcCat} onChange={e => setNewSrcCat(e.target.value as ProteinCategory)}
                  className={`w-full text-sm font-semibold outline-none rounded-xl px-2 py-1.5 ${darkMode ? 'text-gray-300 bg-surface' : 'text-gray-700 bg-gray-100'}`}>
                  {PROTEIN_CATEGORY_KEYS.map(c => <option key={c} value={c}>{t(CATEGORY_I18N[c])}</option>)}
                </select>
                <div className="flex gap-2">
                  {(['fixed', 'per100g'] as const).map(v => (
                    <button key={v} type="button" onClick={() => setNewSrcType(v)}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold
                        ${newSrcType === v ? 'bg-primary text-primary-foreground' : `${darkMode ? 'bg-surface' : 'bg-gray-200'} ${theme.textMuted}`}`}>
                      {v === 'fixed' ? t('proteinFixed') : t('proteinPer100g')}
                    </button>
                  ))}
                </div>
                <div className={`flex items-center gap-2 rounded-xl p-2.5 ${darkMode ? 'bg-surface' : 'bg-gray-100'}`}>
                  <input type="number" inputMode="decimal" min="0" step="0.1" value={newSrcVal} placeholder="0"
                    onChange={e => setNewSrcVal(e.target.value)}
                    className="w-16 bg-transparent text-lg font-bold outline-none" />
                  <span className={`text-xs font-semibold ${theme.textMuted}`}>g {newSrcType === 'fixed' ? `/ ${t('serving')}` : '/ 100g'}</span>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => { setShowAddSource(false); setNewSrcName(''); setNewSrcVal(''); }}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold ${theme.input}`}>{t('cancel')}</button>
                  <button type="button" onClick={handleAddSource}
                    className="flex-1 py-2.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground">{t('add')}</button>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => setShowAddSource(true)}
                className={`w-full py-2.5 rounded-2xl text-sm font-bold border-2 border-dashed flex items-center justify-center gap-1
                  ${darkMode ? 'border-gray-700 text-gray-400 hover:border-primary hover:text-primary' : 'border-gray-300 text-gray-400 hover:border-primary hover:text-primary'}`}>
                <Plus size={14} /> {t('add')}
              </button>
            )}
          </div>
        ) : null}
      </section>

      {onOpenDayNote ? (
        <button
          type="button"
          onClick={onOpenDayNote}
          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold shrink-0 ${theme.input} border ${theme.border} ${theme.textMuted} hover:opacity-90 transition-opacity min-h-[44px]`}
        >
          <FileText size={14} />
          {t('healthOpenDayNote')}
        </button>
      ) : null}
    </div>
  );
}
