import { useState, useEffect, useMemo, useRef, useCallback, MouseEvent, ChangeEvent, TouchEvent } from 'react';
import { Plus, X, Trash2, Save, Dumbbell, Target, Activity, ChevronLeft, ChevronRight, Lock, Pencil, GripVertical, Loader2, ClipboardCopy, Check } from 'lucide-react';
import { authFetch } from '../../lib/supabase';
import { API_URL } from '../../lib/config';
import { useConfirm } from '../../hooks/useConfirm';
import { useAppStore } from '../../store/useAppStore';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmModal } from '../common/ConfirmModal';
import { EmptyState } from '../common/EmptyState';
import { useTranslation } from '../../lib/i18n';
import { HealthProps, Workout, WorkoutSet, StrengthSet, CardioSet, ExerciseBlock, HealthRoutine, Inbody,
         isCardioSet, isStrengthSet, makeDefaultSet, makeNextSet } from '../../types';
import { buildCalendarDays } from '../../lib/calendarUtils';

// ── 프로틴 트래커 서브 컴포넌트 ─────────────────────────────────────────
interface ProteinSource { id: string; name: string; category: string; source_type: 'fixed' | 'per100g'; protein_per_serving: number | null; protein_per_100g: number | null; }
interface ProteinIntakeLog { id: string; source_id: string | null; amount_g: number; protein_g: number; note: string | null; protein_sources: { name: string; source_type: string; category: string } | null; }
interface ProteinProfile { weight: number; goal: string; activity: string; daily_target_g: number; }

const CATEGORIES = ['🍗 Meat', '🐟 Fish', '🥚 Egg & Dairy', '🌱 Plant', '🥤 Supplement', '🍽️ Meal', 'Other'] as const;
type Category = typeof CATEGORIES[number];

interface ProteinTrackerProps {
  theme: { card: string; input: string; textMuted: string; border: string; text: string; hoverBg: string };
  darkMode: boolean;
  selectedDate: Date;
  formatDate: (d: Date) => string;
  showToast: (msg: string, type?: string) => void;
}

const PROTEIN_FACTORS: Record<string, [number, number]> = {
  'muscle-low':[1.6,2.0],'muscle-mod':[1.8,2.2],'muscle-high':[2.0,2.4],'muscle-very':[2.2,2.6],
  'maintain-low':[1.2,1.6],'maintain-mod':[1.4,1.8],'maintain-high':[1.6,2.0],'maintain-very':[1.8,2.2],
  'fat-low':[1.6,2.2],'fat-mod':[1.8,2.4],'fat-high':[2.0,2.6],'fat-very':[2.2,2.8],
  'athlete-low':[1.8,2.4],'athlete-mod':[2.0,2.6],'athlete-high':[2.2,2.8],'athlete-very':[2.4,3.2],
};

const ProteinTracker = ({ theme, darkMode, selectedDate, formatDate, showToast }: ProteinTrackerProps) => {
  const { t } = useTranslation();

  const [tab, setTab] = useState<'goal' | 'sources' | 'log'>('log');

  const [profile, setProfile]             = useState<ProteinProfile | null>(null);
  const [profWeight, setProfWeight]       = useState('');
  const [profGoal, setProfGoal]           = useState<'muscle'|'maintain'|'fat'|'athlete'>('muscle');
  const [profAct, setProfAct]             = useState<'low'|'mod'|'high'|'very'>('mod');
  const [profileLoaded, setProfileLoaded] = useState(false);

  const [sources, setSources]             = useState<ProteinSource[]>([]);
  const [showAddSource, setShowAddSource] = useState(false);
  const [newSrcName, setNewSrcName]       = useState('');
  const [newSrcType, setNewSrcType]       = useState<'fixed'|'per100g'>('fixed');
  const [newSrcVal, setNewSrcVal]         = useState('');
  const [newSrcCat, setNewSrcCat]         = useState<Category>('Other');

  // 소스 수정 state
  const [editSrcId, setEditSrcId]         = useState<string | null>(null);
  const [editSrcName, setEditSrcName]     = useState('');
  const [editSrcCat, setEditSrcCat]       = useState<Category>('Other');
  const [editSrcType, setEditSrcType]     = useState<'fixed'|'per100g'>('fixed');
  const [editSrcVal, setEditSrcVal]       = useState('');

  const [intakeLogs, setIntakeLogs]       = useState<ProteinIntakeLog[]>([]);
  const [selectedSrc, setSelectedSrc]     = useState<string>('');   // '' = 미선택, '__custom__' = 직접입력
  const [intakeAmt, setIntakeAmt]         = useState('');
  const [customNote, setCustomNote]       = useState('');
  const [customProtein, setCustomProtein] = useState('');

  const dateStr = formatDate(selectedDate);

  useEffect(() => {
    (async () => {
      try {
        const [pRes, sRes] = await Promise.all([
          authFetch(`${API_URL}/api/protein_profile`),
          authFetch(`${API_URL}/api/protein_sources`),
        ]);
        if (pRes.ok) {
          const p = await pRes.json();
          if (p?.daily_target_g) {
            setProfile(p);
            setProfWeight(String(p.weight));
            setProfGoal(p.goal as typeof profGoal);
            setProfAct(p.activity as typeof profAct);
          }
        }
        if (sRes.ok) setSources(await sRes.json());
      } catch { /* silent */ }
      setProfileLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch(`${API_URL}/api/protein_intake?date=${dateStr}`);
        if (res.ok) setIntakeLogs(await res.json());
        else setIntakeLogs([]);
      } catch { setIntakeLogs([]); }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateStr]);

  const wNum        = parseFloat(profWeight) || 0;
  const [lo, hi]    = PROTEIN_FACTORS[`${profGoal}-${profAct}`] ?? [1.6, 2.0];
  const calcTarget  = Math.round((wNum * lo + wNum * hi) / 2);
  const dailyTarget = profile?.daily_target_g ?? 0;
  const totalIntake = Math.round(intakeLogs.reduce((s, l) => s + l.protein_g, 0) * 100) / 100;
  const pct         = dailyTarget > 0 ? Math.min(100, Math.round((totalIntake / dailyTarget) * 1000) / 10) : 0;

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
      setProfile(payload);
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
      const data = await res.json();
      setSources(prev => [...prev, data[0]]);
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
      const data = await res.json();
      setIntakeLogs(prev => [...prev, { ...data[0], protein_sources: null }]);
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
      const data = await res.json();
      setSources(prev => prev.map(s => s.id === editSrcId ? { ...s, ...payload } : s));
      setEditSrcId(null);
      showToast(t('sourceUpdated'));
    } catch { showToast(t('failedUpdateSource'), 'error'); }
  };

  const handleDeleteSource = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/protein_sources/${id}`, { method: 'DELETE' });
      setSources(prev => prev.filter(s => s.id !== id));
      showToast(t('sourceDeleted'));
    } catch { /* silent */ }
  };

  const handleLogIntake = async () => {
    const src = sources.find(s => s.id === selectedSrc);
    if (!src) return;
    // 둘 다 amount 필수 (fixed는 개수, per100g는 그램)
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
      const data = await res.json();
      setIntakeLogs(prev => [...prev, { ...data[0], protein_sources: { name: src.name, source_type: src.source_type, category: src.category } }]);
      setIntakeAmt('');
      showToast(t('intakeLogged'));
    } catch { showToast(t('failedLogIntake'), 'error'); }
  };

  const handleDeleteIntake = async (id: string) => {
    try {
      await authFetch(`${API_URL}/api/protein_intake/${id}`, { method: 'DELETE' });
      setIntakeLogs(prev => prev.filter(l => l.id !== id));
      showToast(t('intakeDeleted'));
    } catch { /* silent */ }
  };

  const selectedSrcObj  = sources.find(s => s.id === selectedSrc);
  const previewProtein  = selectedSrcObj && intakeAmt && parseFloat(intakeAmt) > 0
    ? selectedSrcObj.source_type === 'fixed'
      ? Math.round((selectedSrcObj.protein_per_serving ?? 0) * parseFloat(intakeAmt) * 100) / 100
      : Math.round((selectedSrcObj.protein_per_100g ?? 0) * parseFloat(intakeAmt || '0') / 100 * 100) / 100
    : null;

  if (!profileLoaded) return (
    <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col gap-4 h-full min-h-[480px] ${theme.card}`}>
      <div className="h-7 w-36 rounded-xl bg-current opacity-10 animate-pulse"/>
      <div className="h-10 w-full rounded-2xl bg-current opacity-10 animate-pulse"/>
      <div className="h-[320px] w-full rounded-2xl bg-current opacity-10 animate-pulse"/>
    </div>
  );

  return (
    <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col gap-4 transition-colors h-full ${theme.card}`}>
      <div className="flex items-center justify-between">
        <h2 className="font-heading text-lg font-bold flex items-center gap-2">🥤 {t('proteinTracker')}</h2>
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

      {/* 탭 콘텐츠 — min-h로 높이 고정하여 탭 전환 시 레이아웃 흔들림 방지 */}
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
            <span className="text-2xl mr-1">⚖️</span>
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
          {/* 카테고리별 그룹 스크롤 목록 */}
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0 pr-0.5">
            {sources.length === 0 && !showAddSource && (
              <p className={`text-sm text-center py-4 ${theme.textMuted}`}>{t('noSources')}</p>
            )}
            {CATEGORIES.map(cat => {
              const catSources = sources.filter(s => (s.category || 'Other') === cat);
              if (catSources.length === 0) return null;
              return (
                <div key={cat} className="mb-3">
                  <p className={`text-[10px] font-black uppercase tracking-wider mb-1.5 px-0.5 ${theme.textMuted}`}>{cat}</p>
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
                              setEditSrcCat((src.category || 'Other') as Category);
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
                            <select value={editSrcCat} onChange={e => setEditSrcCat(e.target.value as Category)}
                              className={`w-full text-sm font-semibold outline-none rounded-xl px-2 py-1.5 ${darkMode ? 'text-gray-300 bg-surface' : 'text-gray-700 bg-gray-100'}`}>
                              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
          {/* 하단 고정: 추가 폼 or + Add 버튼 */}
          <div className="shrink-0 pt-2">
            {showAddSource ? (
              <div className={`rounded-2xl p-4 flex flex-col gap-3 border-2 border-primary/40 ${theme.input}`}>
                <input autoFocus type="text" value={newSrcName} placeholder={t('proteinSourceName')}
                  onChange={e => setNewSrcName(e.target.value)}
                  className="w-full bg-transparent text-sm font-semibold outline-none"/>
                <select value={newSrcCat} onChange={e => setNewSrcCat(e.target.value as Category)}
                  className={`w-full bg-transparent text-sm font-semibold outline-none ${darkMode ? 'text-gray-300 bg-surface' : 'text-gray-700 bg-gray-100'} rounded-xl px-2 py-1.5`}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
          {/* 진행률 바 */}
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

          {/* 소스 선택 입력 폼 */}
          <div className={`rounded-2xl p-3 flex flex-col gap-2 border-2 border-transparent focus-within:border-primary/40 transition-colors shrink-0 mb-2.5 ${theme.input}`}>
            <select value={selectedSrc} onChange={e => { setSelectedSrc(e.target.value); setIntakeAmt(''); setCustomNote(''); setCustomProtein(''); }}
              className={`w-full bg-transparent text-sm font-semibold outline-none ${!selectedSrc ? theme.textMuted : ''}`}>
              <option value="">{t('addIntakeLabel')}</option>
              <option value="__custom__">{t('directInput')}</option>
              {/* 카테고리별 optgroup */}
              {CATEGORIES.filter(cat => sources.some(s => (s.category || 'Other') === cat)).map(cat => (
                <optgroup key={cat} label={cat}>
                  {sources.filter(s => (s.category || 'Other') === cat).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              ))}
              {/* 카테고리 없는 소스 fallback */}
              {sources.filter(s => !s.category).length > 0 && (
                <optgroup label="Other">
                  {sources.filter(s => !s.category).map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </optgroup>
              )}
            </select>

            {/* 직접 입력 모드 */}
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

            {/* 소스 선택 모드 */}
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

          {/* 로그 목록 — 카테고리별 섹션 그룹핑 */}
          {intakeLogs.length > 0 ? (
            <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-0 pt-0.5">
              {(['__custom__', ...CATEGORIES] as const).map(cat => {
                const logs = cat === '__custom__'
                  ? intakeLogs.filter(l => !l.protein_sources)
                  : intakeLogs.filter(l => l.protein_sources && (l.protein_sources.category || 'Other') === cat);
                if (logs.length === 0) return null;
                const catLabel = cat === '__custom__' ? t('customEntryLabel') : cat;
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
};

export const HealthView = ({
  currentDate, setCurrentDate, selectedDate, setSelectedDate,
  formatDate, isToday, showToast, mutateDaily, mutateStatic,
  workouts, healthBlocks, healthRoutines, inbody, theme, appSettings,
  THEME_COLORS,
}: HealthProps) => {
  const { t, lang } = useTranslation();
  const { mutate: api } = useApiMutation(mutateDaily, mutateStatic, showToast);
  const { weightUnits, toggleWeightUnit } = useAppStore();
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();

  const [splitCount, setSplitCount] = useState<number>(() => {
    const saved = localStorage.getItem('healthSplitCount');
    return saved ? Math.min(7, Math.max(1, Number(saved))) : 3;
  });
  const [splitCountInput, setSplitCountInput] = useState<string>(() => {
    const saved = localStorage.getItem('healthSplitCount');
    return saved ? String(Math.min(7, Math.max(1, Number(saved)))) : '3';
  });
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [newBlock, setNewBlock] = useState<Partial<ExerciseBlock>>({ name: '', type: 'strength', tags: [], cardio_mode: 'both' });
  // editingBlock: 수정 대상 블록 (null이면 신규 생성 모드)
  const [editingBlock, setEditingBlock] = useState<ExerciseBlock | null>(null);
  // tagInput: 태그 입력 중간값 (Enter/쉼표로 확정)
  const [tagInput, setTagInput] = useState('');
  // activeTagFilter: 현재 선택된 태그 필터 (null이면 전체)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showAssembleModal, setShowAssembleModal] = useState(false);
  const [activeDayForm, setActiveDayForm] = useState('');
  const [tempRoutineBlocks, setTempRoutineBlocks] = useState<string[]>([]);
  // 모바일 전용 탭 상태 — 데스크탑에서는 무시됨
  const [mobileHealthTab, setMobileHealthTab] = useState<'blocks' | 'routine' | 'workout' | 'protein'>('workout');
  // isDirty: 사용자가 세트를 편집 중인 상태.
  const [isDirty, setIsDirty] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isWorkoutLocked, setIsWorkoutLocked] = useState(false);
  // ── lbs 입력 중 raw 값 보존 (wIdx-sIdx 키) — 변환 재계산으로 커서 고정되는 버그 방지
  const [rawKgInput, setRawKgInput] = useState<Record<string, string>>({});
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>([]);
  // ── 날짜별 메모 ───────────────────────────────────────────────────────
  const [workoutMemo, setWorkoutMemo] = useState('');
  // ── 이전 세션 데이터 / PR — block_id 키로 캐시 ───────────────────────
  const [prevData, setPrevData] = useState<Record<string, {
    prev_sets: WorkoutSet[];
    prev_date: string | null;
    pr_kg: number | null;
  }>>({});

  // ── 운동 요약 텍스트 생성 ────────────────────────────────────────────
  // 저장된 localWorkouts를 클립보드에 붙여넣기 가능한 텍스트로 변환
  const buildWorkoutSummary = useCallback((date: string, ws: Workout[], memo: string): string => {
    const lines: string[] = [`📅 ${date}`, ''];
    let exerciseNum = 1;
    ws.forEach(w => {
      // 세션 구분선
      if (w.block_id === '__session__') {
        lines.push(`── ${w.exercise_blocks?.name ?? ''} ──`);
        lines.push('');
        return;
      }
      const name = w.exercise_blocks?.name ?? 'Unknown';
      lines.push(`${exerciseNum++}. ${name}`);
      w.sets.forEach(s => {
        if (isCardioSet(s)) {
          const parts = [`Set ${s.set}`];
          if (s.time)     parts.push(`⏱ ${s.time}`);
          if (s.distance) parts.push(`📍 ${s.distance}km`);
          if (s.pace)     parts.push(`🏃 ${s.pace}/km`);
          lines.push(`   ${parts.join('  ')}`);
        } else {
          const unit = weightUnits[w.block_id] === 'lbs' ? 'lbs' : 'kg';
          const displayVal = s.kg !== '' ? displayKg(s.kg, w.block_id) : '';
          const kgStr = displayVal !== '' ? `${displayVal}${unit}` : '-';
          const reps = s.reps !== '' ? `${s.reps}reps` : '-';
          const drop = s.is_dropset ? ' [DROP]' : '';
          lines.push(`   Set ${s.set}${drop}  ${kgStr} × ${reps}`);
        }
      });
      lines.push('');
    });
    // 총 세트 요약 (세션 구분선 제외)
    const realWs = ws.filter(w => w.block_id !== '__session__');
    const totalSets = realWs.reduce((acc, w) => acc + w.sets.filter(s => !isCardioSet(s) && s.done).length, 0);
    const totalCardioTime = realWs.reduce((acc, w) => {
      return acc + w.sets.filter(s => isCardioSet(s) && s.done && (s as CardioSet).time)
        .reduce((m, s) => {
          const parts = (s as CardioSet).time.split(':').map(Number);
          const mins = parts.length === 3
            ? parts[0] * 60 + parts[1] + parts[2] / 60
            : parts.length === 2
              ? parts[0] + parts[1] / 60
              : parts[0];
          return m + mins;
        }, 0);
    }, 0);
    if (totalSets > 0) lines.push(`💪 Total sets: ${totalSets}`);
    if (totalCardioTime > 0) {
      const h = Math.floor(totalCardioTime / 60);
      const m = Math.round(totalCardioTime % 60);
      lines.push(`⏱ Total cardio: ${h > 0 ? `${h}h ` : ''}${m}min`);
    }
    if (memo.trim()) { lines.push(''); lines.push(`📝 ${memo.trim()}`); }
    return lines.join('\n');
  }, [weightUnits]);

  const handleCopySummary = useCallback(async () => {
    const text = buildWorkoutSummary(formatDate(selectedDate), localWorkouts, workoutMemo);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard API 미지원 시 fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.style.position = 'fixed';
      ta.style.opacity  = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [buildWorkoutSummary, formatDate, selectedDate, localWorkouts, workoutMemo]);
  // ── 드래그 정렬 상태 (워크아웃) ──────────────────────────────────
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const dragNodeRef = useRef<HTMLDivElement | null>(null);
  const dragStartY = useRef<number>(0);
  // ── 드래그 정렬 상태 (루틴 ORDER) ────────────────────────────────
  const [routineDragIdx, setRoutineDragIdx] = useState<number | null>(null);
  const [routineDragOverIdx, setRoutineDragOverIdx] = useState<number | null>(null);
  // InBody도 편집 중 SWR 재검증이 덮어쓰지 않도록 보호.
  const [isInbodyDirty, setIsInbodyDirty] = useState(false);
  const [localInbody, setLocalInbody] = useState<Inbody>({ weight: 0, smm: 0, pbf: 0 });

  // weightUnits: zustand store persist
  const getUnit = (blockId: string): 'kg' | 'lbs' => weightUnits[blockId] ?? 'kg';

  const KG_PER_LBS = 0.45359237;
  const r1 = (n: number) => parseFloat(n.toFixed(1));
  const displayKg = (kg: number | string, blockId: string): string => {
    const n = parseFloat(String(kg));
    if (isNaN(n) || kg === '' || kg === null) return '';
    return getUnit(blockId) === 'lbs'
      ? String(r1(n / KG_PER_LBS))
      : String(r1(n));
  };
  const inputToKg = (val: string, blockId: string): string => {
    if (val === '' || val === null) return '';
    const n = parseFloat(val);
    if (isNaN(n)) return '';
    // lbs → kg: 반올림 없이 원본 정밀도 유지 (반올림하면 역변환 시 오차 발생)
    return getUnit(blockId) === 'lbs'
      ? String(n * KG_PER_LBS)
      : val;
  };

  // 배너 캘린더 — 선택 날짜를 자동으로 가운데 스크롤
  const bannerScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bannerScrollRef.current;
    if (!el) return;
    const idx = selectedDate.getDate() - 1;
    const itemW = 52;
    const scrollTarget = idx * itemW - el.clientWidth / 2 + itemW / 2;
    el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [selectedDate]);

  // ── Draft 자동 저장/복원 ──────────────────────────────────────────
  const draftKey = `healthDraft:${formatDate(selectedDate)}`;
  const memoKey  = `healthMemo:${formatDate(selectedDate)}`;

  // selectedDate 변경 시 메모도 localStorage에서 복원
  useEffect(() => {
    setWorkoutMemo(localStorage.getItem(memoKey) ?? '');
    setPrevData({}); // 날짜 변경 시 이전 세션 캐시 초기화
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // localWorkouts가 세팅될 때 각 블록의 이전 세션 + PR fetch
  useEffect(() => {
    const dateStr = formatDate(selectedDate);
    const realWorkouts = localWorkouts.filter(w => w.block_id !== '__session__');
    if (realWorkouts.length === 0) return;
    realWorkouts.forEach(async w => {
      if (prevData[w.block_id] !== undefined) return; // 이미 캐시됨
      try {
        const res = await authFetch(`${API_URL}/api/workouts/prev/${w.block_id}?before_date=${dateStr}`);
        if (!res.ok) return;
        const data = await res.json();
        setPrevData(prev => ({ ...prev, [w.block_id]: data }));
      } catch { /* silent */ }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localWorkouts]);

  // isDirtyRef: workouts effect가 stale closure로 draft를 덮어쓰는 경쟁 조건 방어.
  // isDirty state 대신 ref를 읽으면 항상 최신값을 참조하므로 deps 없이 안전.
  const isDirtyRef = useRef(false);
  useEffect(() => { isDirtyRef.current = isDirty; }, [isDirty]);

  // selectedDate 변경 시: draft가 있으면 복원, 없으면 서버 데이터로 초기화
  useEffect(() => {
    setIsInbodyDirty(false);
    const raw = localStorage.getItem(draftKey);
    if (raw) {
      try {
        const draft: Workout[] = JSON.parse(raw);
        setLocalWorkouts(draft);
        setIsDirty(true);
        isDirtyRef.current = true; // 동일 배치에서 workouts effect가 읽을 수 있도록 즉시 반영
        setIsWorkoutLocked(false);
        showToast(t('draftRestored'));
        return;
      } catch { localStorage.removeItem(draftKey); }
    }
    setIsDirty(false);
    isDirtyRef.current = false;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate]);

  // isDirty 중 localWorkouts 변경 시마다 draft 저장
  useEffect(() => {
    if (isDirty && localWorkouts.length > 0) {
      localStorage.setItem(draftKey, JSON.stringify(localWorkouts));
    }
  }, [localWorkouts, isDirty, draftKey]);

  // workouts(SWR)가 갱신될 때 isDirtyRef로 판단 → draft 복원 직후 덮어쓰기 방지
  useEffect(() => {
    if (!isDirtyRef.current) {
      const sorted = [...(workouts || [])].sort((a, b) => {
        const ao = a.sort_order ?? 9999;
        const bo = b.sort_order ?? 9999;
        return ao - bo;
      });
      setLocalWorkouts(sorted);
      setIsWorkoutLocked(sorted.length > 0);
    }
  }, [workouts]);

  useEffect(() => {
    if (!isInbodyDirty)
      setLocalInbody({ weight: Number(inbody?.weight || 0), smm: Number(inbody?.smm || 0), pbf: Number(inbody?.pbf || 0) });
  }, [inbody, isInbodyDirty]);

  useEscapeKey(() => { setShowBlockModal(false); setShowAssembleModal(false); clearConfirm(); });

  // ── 운동 블록 ──────────────────────────────────────────────────────
  const openBlockModal = (block?: ExerciseBlock) => {
    if (block) {
      setEditingBlock(block);
      setNewBlock({ name: block.name, type: block.type, tags: block.tags ?? [], cardio_mode: block.cardio_mode ?? 'both' });
    } else {
      setEditingBlock(null);
      setNewBlock({ name: '', type: 'strength', tags: [], cardio_mode: 'both' });
    }
    setTagInput('');
    setShowBlockModal(true);
  };

  const commitTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const already = (newBlock.tags ?? []).includes(tag);
    if (!already) setNewBlock(b => ({ ...b, tags: [...(b.tags ?? []), tag] }));
    setTagInput('');
  };

  const removeTag = (tag: string) =>
    setNewBlock(b => ({ ...b, tags: (b.tags ?? []).filter(tg => tg !== tag) }));

  const handleSaveBlock = async () => {
    if (!newBlock.name) return showToast(t('enterName'), 'error');
    const payload = { name: newBlock.name, type: newBlock.type, tags: newBlock.tags ?? [], cardio_mode: newBlock.cardio_mode ?? 'both' };
    const ok = editingBlock
      ? await api('PUT', `/api/blocks/${editingBlock.id}`, payload, { revalidate: 'static', successMsg: t('blockUpdated') })
      : await api('POST', '/api/blocks', payload, { revalidate: 'static', successMsg: t('blockCreated') });
    if (ok) { setShowBlockModal(false); setNewBlock({ name: '', type: 'strength', tags: [], cardio_mode: 'both' }); setEditingBlock(null); }
  };

  const handleDeleteBlock = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    showConfirm(t('deleteBlock'), () =>
      api('DELETE', `/api/blocks/${id}`, undefined, { revalidate: 'static', successMsg: t('blockDeleted') }),
      { confirmLabel: t('deleteLabel') },
    );
  };

  // ── 루틴 조합 ──────────────────────────────────────────────────────
  const openAssembleModal = (dayName: string) => {
    setActiveDayForm(dayName);
    const existing = healthRoutines.find((r: HealthRoutine) => r.day_name === dayName);
    setTempRoutineBlocks(existing?.blocks ?? []);
    setShowAssembleModal(true);
  };
  const toggleBlockInRoutine = (blockId: string) =>
    setTempRoutineBlocks(prev => prev.includes(blockId) ? prev.filter(id => id !== blockId) : [...prev, blockId]);
  const handleSaveRoutine = async () => {
    const ok = await api('POST', '/api/health_routines', { day_name: activeDayForm, blocks: tempRoutineBlocks }, { revalidate: 'static', successMsg: t('routineSaved') });
    if (ok) setShowAssembleModal(false);
  };

  // ── 워크아웃 로컬 조작 ─────────────────────────────────────────────
  const handleLoadRoutine = (e: ChangeEvent<HTMLSelectElement>) => {
    const dayName = e.target.value;
    if (!dayName || dayName === '__load__') return;
    const routine = healthRoutines.find((r: HealthRoutine) => r.day_name === dayName);
    if (!routine?.blocks?.length) { showToast(t('noBlocks'), 'error'); e.target.value = '__load__'; return; }

    // routine.blocks 순서를 완전한 기준으로 삼아 최종 배열을 구성.
    // 1) 루틴에 포함된 블록: routine.blocks[i] 순서 그대로
    //    - 이미 localWorkouts에 있으면 기존 세트 데이터 보존
    //    - 없으면 새 기본 세트로 생성
    // 2) 루틴에 없는 기존 블록: 맨 뒤에 순서 유지하여 추가
    const routineOrdered: Workout[] = routine.blocks.map((id: string) => {
      const existing = localWorkouts.find(w => w.block_id === id);
      if (existing) return existing;
      const b = healthBlocks.find((bk: ExerciseBlock) => bk.id === id);
      if (!b) return null;
      return { id: `temp-${Date.now()}-${b.id}`, block_id: b.id, exercise_blocks: b, sets: [makeDefaultSet(b.type)] };
    }).filter((w): w is Workout => !!w);

    const unrelated = localWorkouts.filter(w => !routine.blocks.includes(w.block_id));
    setLocalWorkouts([...routineOrdered, ...unrelated]);
    setIsDirty(true);
    e.target.value = '__load__';
    showToast(t('loaded'));
  };
  const handleAddWorkoutToToday = (block: ExerciseBlock) => {
    if (localWorkouts.find(w => w.block_id === block.id)) return showToast(t('alreadyAdded'), 'error');
    setIsDirty(true);
    setLocalWorkouts([...localWorkouts, { id: `temp-${Date.now()}`, block_id: block.id, exercise_blocks: block, sets: [makeDefaultSet(block.type)] }]);
  };

  // ── 세션 구분선 ───────────────────────────────────────────────────
  const SESSION_KEYS = ['sessionMorning', 'sessionAfternoon', 'sessionEvening'] as const;
  const handleAddSessionBreak = (labelKey: typeof SESSION_KEYS[number]) => {
    const label = t(labelKey);
    setIsDirty(true);
    setLocalWorkouts(prev => [...prev, {
      id: `session-${Date.now()}`,
      block_id: '__session__',
      exercise_blocks: { id: '__session__', name: label, type: 'strength', tags: [] } as ExerciseBlock,
      sets: [],
    }]);
  };

  const handleRemoveWorkout = async (index: number, dbId: string) => {
    try {
      // 세션 구분선은 DB에 없으므로 API 호출 없이 바로 제거
      if (dbId !== 'session' && !dbId.startsWith('session-') && !dbId.startsWith('temp')) {
        const res = await authFetch(`${API_URL}/api/workouts/${dbId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`[${res.status}]`);
        // DB 삭제 성공 즉시 mutateDaily → SWR 캐시도 동기화.
        mutateDaily();
      }
      const next = localWorkouts.filter((_, i) => i !== index);
      setLocalWorkouts(next);
      if (next.length === 0) { setIsDirty(false); localStorage.removeItem(draftKey); }
    } catch { showToast(t('failedRemove'), 'error'); }
  };
  const handleAddSet = (wIdx: number, asDropset = false) => {
    if (isWorkoutLocked) return;
    setIsDirty(true);
    setLocalWorkouts(prev => {
      const next = [...prev];
      const w = { ...next[wIdx] };
      // makeNextSet이 이전 세트의 타입을 보존하며 값을 복사 — as any 불필요
      const last = w.sets[w.sets.length - 1] ?? makeDefaultSet(w.exercise_blocks.type);
      w.sets = [...w.sets, makeNextSet(last, asDropset)];
      next[wIdx] = w;
      return next;
    });
  };
  // ── Cardio 시간 자동 포맷 ──────────────────────────────────────────────────
  // 숫자만 입력하면 자동으로 H:MM:SS / MM:SS 형식으로 변환
  // "130" → "1:30" / "10000" → "1:00:00" / "1:30" → 그대로
  const formatTimeInput = (raw: string): string => {
    // 이미 : 포함 → 그대로
    if (raw.includes(':')) return raw;
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    const n = parseInt(digits, 10);
    if (digits.length <= 2) {
      // 1~99 → 분으로 처리: "5" → "5:00", "45" → "45:00"
      return `${n}:00`;
    } else if (digits.length <= 4) {
      // 3~4자리 → MM:SS: "130" → "1:30", "1530" → "15:30"
      const ss = n % 100;
      const mm = Math.floor(n / 100);
      return `${mm}:${String(ss).padStart(2, '0')}`;
    } else {
      // 5~6자리 → H:MM:SS: "10000" → "1:00:00", "13045" → "1:30:45"
      const ss = n % 100;
      const mm = Math.floor(n / 100) % 100;
      const hh = Math.floor(n / 10000);
      return `${hh}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
    }
  };

  const handleTimeInput = (wIdx: number, sIdx: number, raw: string) => {
    // 입력 중엔 raw 값 그대로 표시, blur 시 포맷
    handleUpdateSet(wIdx, sIdx, 'time', raw);
  };

  const handleTimeBlur = (wIdx: number, sIdx: number, raw: string) => {
    if (!raw) return;
    handleUpdateSet(wIdx, sIdx, 'time', formatTimeInput(raw));
  };

  const handleRemoveSet = (wIdx: number, sIdx: number) => {
    if (isWorkoutLocked) return;
    setIsDirty(true);
    setLocalWorkouts(prev => {
      const next = [...prev];
      const w = { ...next[wIdx] };
      w.sets = w.sets.filter((_, i) => i !== sIdx).map((s, i) => ({ ...s, set: i + 1 }));
      next[wIdx] = w;
      return next;
    });
  };
  const handleUpdateSet = (wIdx: number, sIdx: number, field: Exclude<keyof StrengthSet | keyof CardioSet, 'type' | 'set' | 'pace'>, value: string | number | boolean) => {
    if (isWorkoutLocked) return;
    setIsDirty(true);
    setLocalWorkouts(prev => {
      const next = [...prev];
      next[wIdx] = { ...next[wIdx], sets: next[wIdx].sets.map((s, i) => i === sIdx ? { ...s, [field]: value } as WorkoutSet : s) };
      return next;
    });
  };
  const handleSaveWorkouts = async () => {
    if (localWorkouts.filter(w => w.block_id !== '__session__').length === 0)
      return showToast(t('noWorkouts'), 'error');
    setIsSaving(true);

    // 순차 저장 — sort_order 보장을 위해 병렬(allSettled) 대신 순서대로 await
    // 세션 구분선(__session__)은 DB 저장 불필요 — 스킵
    let failed = 0;
    let dbIdx = 0; // 실제 DB 저장 순서 (세션 구분선 제외)
    for (let idx = 0; idx < localWorkouts.length; idx++) {
      const w = localWorkouts[idx];
      if (w.block_id === '__session__') continue;
      try {
        const res = await authFetch(`${API_URL}/api/workouts`, {
          method: 'POST',
          body: JSON.stringify({ date: formatDate(selectedDate), block_id: w.block_id, sets: w.sets, sort_order: dbIdx }),
        });
        if (!res.ok) failed++;
      } catch { failed++; }
      dbIdx++;
    }
    const total = dbIdx; // 실제 저장 시도한 운동 수
    setIsSaving(false);
    if (failed === 0) {
      localStorage.removeItem(draftKey);
      showToast(t('workoutSaved'));
      setIsDirty(false);
      setIsWorkoutLocked(true);
      mutateDaily();
    } else if (failed < total) {
      localStorage.removeItem(draftKey);
      showToast(t('partialSave').replace('{done}', String(total - failed)).replace('{total}', String(total)), 'error');
      setIsDirty(false);
      setIsWorkoutLocked(true);
      mutateDaily();
    } else {
      showToast(t('failedSave'), 'error');
    }
  };
  // ── 드래그 정렬 핸들러 ────────────────────────────────────────────
  const handleDragStart = (e: React.MouseEvent<HTMLDivElement>, index: number) => {
    if (isWorkoutLocked) return;
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.currentTarget.style.opacity = '0.5';
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, index: number) => {
    if (isWorkoutLocked) return;
    setDragIndex(index);
    dragNodeRef.current = e.currentTarget;
    e.currentTarget.style.opacity = '0.5';
  };

  const handleDragEnter = (index: number) => {
    if (dragIndex === null || dragIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (dragIndex !== null && dragOverIndex !== null && dragIndex !== dragOverIndex) {
      setLocalWorkouts(prev => {
        const next = [...prev];
        const [moved] = next.splice(dragIndex, 1);
        next.splice(dragOverIndex, 0, moved);
        return next;
      });
      setIsDirty(true);
    }
    setDragIndex(null);
    setDragOverIndex(null);
    if (dragNodeRef.current) dragNodeRef.current.style.opacity = '1';
    dragNodeRef.current = null;
  };

  // 터치 드래그
  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (dragIndex === null) return;
    e.preventDefault();
    const touch = e.touches[0];
    const elements = document.elementsFromPoint(touch.clientX, touch.clientY);
    const cardEl = elements.find(el => el.getAttribute('data-workout-index'));
    if (cardEl) {
      const idx = Number(cardEl.getAttribute('data-workout-index'));
      if (idx !== dragIndex) setDragOverIndex(idx);
    }
  };

  const handleSaveInbody = async () => {
    if (localInbody.weight < 0 || localInbody.smm < 0 || localInbody.pbf < 0)
      return showToast(t('valuesNegative'), 'error');
    const ok = await api('POST', '/api/inbody',
      { date: formatDate(selectedDate), weight: Number(localInbody.weight), smm: Number(localInbody.smm), pbf: Number(localInbody.pbf) },
      { revalidate: 'daily', successMsg: t('inbodySaved') }
    );
    if (ok) setIsInbodyDirty(false); // 저장 완료 → SWR 재검증 허용
  };

  const { year, month, calendarDays } = useMemo(() => {
    const y = currentDate.getFullYear(), m = currentDate.getMonth();
    return {
      year: y, month: m,
      calendarDays: buildCalendarDays(y, m),
    };
  }, [currentDate]);

  return (
    <div className="flex-1 flex flex-col lg:flex-row gap-4 lg:gap-5 overflow-y-auto lg:overflow-hidden pb-10 lg:pb-0 animate-in fade-in duration-300">
      {/* ── 좌측: 블록 / 루틴 설정 — 모바일에서 가로 탭 전환 ── */}
      <div className="lg:flex-[3.5] flex flex-col gap-4 lg:gap-5 shrink-0 lg:overflow-y-auto lg:pb-4">
        {/* 모바일 전용 탭 헤더 */}
        <div className="flex lg:hidden gap-2">
          {(['blocks', 'routine', 'workout', 'protein'] as const).map(tab => (
            <button key={tab}
              onClick={() => setMobileHealthTab(tab)}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-colors
                ${mobileHealthTab === tab
                  ? 'bg-primary text-primary-foreground'
                  : `${theme.input} ${theme.textMuted}`}`}>
              {tab === 'blocks' ? t('tabBlocks') : tab === 'routine' ? t('tabRoutine') : tab === 'workout' ? t('tabWorkout') : '🥤 Protein'}
            </button>
          ))}
        </div>
        <div className={`lg:h-[40%] min-h-0 max-h-[280px] lg:max-h-none rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card} ${mobileHealthTab !== 'blocks' ? 'hidden lg:flex' : ''}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-heading text-lg font-bold">{t('workoutBlocks')}</h2>
            <button onClick={() => openBlockModal()} className="bg-primary text-primary-foreground px-2.5 py-2 rounded-xl shadow-md"><Plus size={16}/></button>
          </div>
          {/* 태그별 그룹 + 필터 */}
          {(() => {
            const blocks = healthBlocks ?? [];
            const allTags = Array.from(new Set(blocks.flatMap((b: ExerciseBlock) => b.tags ?? [])));

            // 태그별 그룹 생성: 필터 선택 시 해당 태그만, 전체일 때는 태그별 섹션
            const tagged = allTags.map(tag => ({
              tag,
              items: blocks.filter((b: ExerciseBlock) => (b.tags ?? []).includes(tag)),
            })).filter(g => !activeTagFilter || g.tag === activeTagFilter);
            const untagged = blocks.filter((b: ExerciseBlock) => (b.tags ?? []).length === 0);
            const showUntagged = !activeTagFilter;

            const BlockCard = ({ b }: { b: ExerciseBlock }) => (
              <div onClick={() => handleAddWorkoutToToday(b)}
                className={`group relative text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-transparent hover:border-primary active:border-primary cursor-pointer transition-colors ${theme.input}`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.type === 'strength' ? 'bg-blue-500' : b.type === 'bodyweight' ? 'bg-purple-500' : 'bg-green-500'}`}/>
                  <span className="truncate max-w-[110px]">{b.name}</span>
                </div>
                <button onClick={e => { e.stopPropagation(); openBlockModal(b); }}
                  className="absolute -top-1.5 -left-1.5 bg-blue-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 active:scale-90 transition-all">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                </button>
                <button onClick={e => handleDeleteBlock(b.id, e)}
                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 active:scale-90 transition-all">
                  <X size={10}/>
                </button>
              </div>
            );

            return (
              <>
                {/* 태그 필터 바 */}
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
                    <button onClick={() => setActiveTagFilter(null)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors
                        ${activeTagFilter === null ? 'bg-blue-500 text-white' : `${theme.input} ${theme.textMuted}`}`}>
                      {t('filterAll')}
                    </button>
                    {allTags.map(tag => (
                      <button key={tag} onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors
                          ${activeTagFilter === tag ? 'bg-blue-500 text-white' : `${theme.input} ${theme.textMuted}`}`}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* 블록 없을 때 */}
                {blocks.length === 0 && <EmptyState theme={theme} icon={Dumbbell} text={t('noBlocksEmpty')}/>}

                {/* 태그별 그룹 섹션 */}
                <div className="overflow-y-auto min-h-0 pr-1 pb-2 space-y-3">
                  {tagged.map(({ tag, items }) => (
                    <div key={tag}>
                      <div className={`flex items-center gap-2 mb-1.5`}>
                        <span className={`text-[11px] font-black tracking-wide ${theme.textMuted}`}>#{tag.toUpperCase()}</span>
                        <div className={`flex-1 h-px ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}/>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {items.map((b: ExerciseBlock) => <BlockCard key={b.id} b={b}/>)}
                      </div>
                    </div>
                  ))}

                  {/* 태그 없는 블록 */}
                  {showUntagged && untagged.length > 0 && (
                    <div>
                      {allTags.length > 0 && (
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`text-[11px] font-black tracking-wide ${theme.textMuted}`}>{t('other')}</span>
                          <div className={`flex-1 h-px ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}/>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {untagged.map((b: ExerciseBlock) => <BlockCard key={b.id} b={b}/>)}
                      </div>
                    </div>
                  )}
                </div>
              </>
            );
          })()}
        </div>

        <div className={`lg:flex-[1.5] rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card} ${mobileHealthTab === 'routine' ? '' : 'hidden lg:flex'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-heading text-lg font-bold">{t('routineSetup')}</h2>
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl ${theme.input}`}>
              <input
                type="number" inputMode="numeric" min="1" max="7"
                value={splitCountInput}
                onChange={e => setSplitCountInput(e.target.value)}
                onBlur={() => {
                  const n = Math.min(7, Math.max(1, Number(splitCountInput) || 1));
                  setSplitCount(n);
                  setSplitCountInput(String(n));
                  localStorage.setItem('healthSplitCount', String(n));
                }}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    const n = Math.min(7, Math.max(1, Number(splitCountInput) || 1));
                    setSplitCount(n);
                    setSplitCountInput(String(n));
                    localStorage.setItem('healthSplitCount', String(n));
                    (e.target as HTMLInputElement).blur();
                  }
                }}
                className="w-8 bg-transparent text-lg font-bold outline-none text-center tabular-nums"/>
              <span className={`text-xs font-semibold ${theme.textMuted}`}>{t('splits')}</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto space-y-4">
            {Array.from({ length: splitCount }).map((_, i) => {
              const dayName = `Day ${i + 1}`;
              const routine = healthRoutines?.find((r: HealthRoutine) => r.day_name === dayName);
              const blocks = (routine?.blocks ?? [])
                .map((id: string) => healthBlocks?.find((b: ExerciseBlock) => b.id === id))
                .filter((b): b is ExerciseBlock => !!b);
              return (
                <div key={dayName} className={`rounded-2xl p-4 border ${theme.border}`}>
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="font-heading text-base font-bold">{dayName}</h3>
                    <button onClick={() => openAssembleModal(dayName)} className="text-sm text-blue-500 font-bold">{t('assembleBtn')}</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                    {blocks.map(b => (
                      <span key={b.id} className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shadow-sm whitespace-nowrap ${theme.card} ${theme.border}`}>
                        {b.name}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 우측: 오늘의 운동 + 캘린더 + InBody ── */}
      <div className={`flex-1 lg:flex-[6.5] flex-col gap-4 lg:gap-5 min-h-0 overflow-y-auto lg:overflow-hidden lg:pr-1 pb-4 lg:pb-4 ${mobileHealthTab === 'workout' ? 'flex' : 'hidden lg:flex'}`}>
        <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors lg:min-h-0 lg:flex-1 ${theme.card}`}>
          <div className={`flex justify-between items-center mb-5 border-b pb-5 ${theme.border}`}>
            <div>
              <h2 className="font-heading text-2xl font-bold">{t('todayWorkout')}</h2>
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>
                {selectedDate.toLocaleDateString(lang, { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
            </div>
            {!isWorkoutLocked && (
              <div className="flex items-center gap-2 shrink-0">
                {/* 세션 구분선 추가 드롭다운 */}
                <select
                  onChange={e => {
                    const v = e.target.value as typeof SESSION_KEYS[number] | '';
                    if (v) handleAddSessionBreak(v);
                    e.target.value = '';
                  }}
                  className={`text-xs font-bold px-3 py-2 rounded-xl outline-none cursor-pointer border ${appSettings.darkMode ? 'bg-surface text-gray-300 border-gray-700' : 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  <option value="">{t('addSession')}</option>
                  {SESSION_KEYS.map(k => (
                    <option key={k} value={k}>{t(k)}</option>
                  ))}
                </select>
                <select onChange={handleLoadRoutine}
                  className="bg-primary text-primary-foreground font-bold text-sm lg:text-base px-4 lg:px-5 py-2 lg:py-3 rounded-xl outline-none cursor-pointer shadow-md">
                  <option value="__load__">{t('loadRoutine')}</option>
                  {Array.from({ length: splitCount }).map((_, i) => <option key={i} value={`Day ${i + 1}`}>{t('loadDay').replace('{n}', String(i + 1))}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="space-y-3 pb-2 lg:space-y-5 lg:flex-1 lg:overflow-y-auto lg:min-h-0 lg:pr-1">
            {localWorkouts.length === 0 && <EmptyState theme={theme} icon={Dumbbell} text={t('noWorkoutsEmpty')}/>}
            {localWorkouts.map((w: Workout, wIdx: number) => {

              /* ── 세션 구분선 렌더링 ── */
              if (w.block_id === '__session__') {
                return (
                  <div
                    key={w.id}
                    data-workout-index={wIdx}
                    draggable={!isWorkoutLocked}
                    onDragStart={e => handleDragStart(e, wIdx)}
                    onDragEnter={() => handleDragEnter(wIdx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    onTouchStart={e => handleTouchStart(e, wIdx)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleDragEnd}
                    className="flex items-center gap-2 py-1 select-none">
                    {!isWorkoutLocked && (
                      <GripVertical size={15} className={`shrink-0 cursor-grab active:cursor-grabbing ${appSettings.darkMode ? 'text-gray-600' : 'text-gray-300'}`}/>
                    )}
                    <div className={`flex-1 h-px ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}/>
                    <span className={`text-[11px] font-black tracking-widest px-3 py-1 rounded-full shrink-0
                      ${appSettings.darkMode ? 'bg-surface text-gray-400' : 'bg-gray-100 text-gray-400'}`}>
                      {w.exercise_blocks?.name}
                    </span>
                    <div className={`flex-1 h-px ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}/>
                    {!isWorkoutLocked && (
                      <button
                        onClick={() => handleRemoveWorkout(wIdx, w.id)}
                        className="shrink-0 p-1 rounded-full text-gray-400 hover:text-red-500 active:scale-95 transition-colors">
                        <X size={13}/>
                      </button>
                    )}
                  </div>
                );
              }

              /* ── 일반 운동 카드 렌더링 ── */
              return (
                <div
                key={w.id}
                data-workout-index={wIdx}
                draggable={!isWorkoutLocked}
                onDragStart={e => handleDragStart(e, wIdx)}
                onDragEnter={() => handleDragEnter(wIdx)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                onTouchStart={e => handleTouchStart(e, wIdx)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleDragEnd}
                className={`border rounded-3xl p-5 relative group shadow-sm transition-all duration-150 ${theme.border} ${
                  dragOverIndex === wIdx && dragIndex !== wIdx
                    ? appSettings.darkMode ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-primary bg-yellow-50/50 scale-[1.01]'
                    : ''
                } ${!isWorkoutLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}>
                {!isWorkoutLocked && (
                  <button onClick={() => handleRemoveWorkout(wIdx, w.id)}
                    className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-red-500 active:scale-95 transition-colors">
                    <Trash2 size={18}/>
                  </button>
                )}
                <div className="flex items-center gap-3 mb-4">
                  {!isWorkoutLocked && (
                    <GripVertical size={18} className={`shrink-0 ${appSettings.darkMode ? 'text-gray-600' : 'text-gray-300'} cursor-grab active:cursor-grabbing`}/>
                  )}
                  <div className={`w-3 h-3 rounded-full shrink-0 ${w.exercise_blocks?.type === 'cardio' ? 'bg-green-500' : w.exercise_blocks?.type === 'bodyweight' ? 'bg-purple-500' : 'bg-blue-500'}`}/>
                  <h3 className="font-heading text-lg font-bold flex-1">{w.exercise_blocks?.name || 'Unknown'}</h3>
                  {/* PR / 이전 세션 배지 */}
                  {(() => {
                    const pd = prevData[w.block_id];
                    if (!pd || w.exercise_blocks?.type === 'cardio') return null;
                    // raw kg → 표시 단위로 변환 후 비교 (float 오차 및 구버전 저장값 차이 방지)
                    const toDisplay = (kg: number) => parseFloat(displayKg(kg, w.block_id) || '0');
                    const curMax = Math.max(0, ...w.sets.filter(s => isStrengthSet(s) && s.done && (s as StrengthSet).kg !== '').map(s => toDisplay(parseFloat(String((s as StrengthSet).kg)))));
                    const prevMax = pd.prev_sets.filter(s => isStrengthSet(s) && s.done && (s as StrengthSet).kg !== '').reduce((m, s) => Math.max(m, toDisplay(parseFloat(String((s as StrengthSet).kg)))), 0);
                    const prKgDisplay = pd.pr_kg !== null ? toDisplay(pd.pr_kg) : null;
                    const isPR = prKgDisplay !== null && curMax > 0 && curMax > prKgDisplay;
                    const diff = curMax > 0 && prevMax > 0 ? parseFloat((curMax - prevMax).toFixed(1)) : 0;
                    const unit = getUnit(w.block_id);
                    return (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isPR && (
                          <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-400 text-amber-900 tracking-wider">
                            PR 🏆
                          </span>
                        )}
                        {prevMax > 0 && !isPR && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full tabular-nums ${
                            diff > 0
                              ? 'bg-green-500/15 text-green-500'
                              : diff < 0
                                ? 'bg-red-500/15 text-red-400'
                                : appSettings.darkMode ? 'bg-gray-700 text-gray-400' : 'bg-gray-100 text-gray-500'
                          }`}>
                            {diff > 0 ? `+${diff}` : diff < 0 ? `${diff}` : `=${prevMax}`}{unit}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
                {/* 컬럼 헤더 — cardio */}
                {isCardioSet(w.sets?.[0] ?? makeDefaultSet(w.exercise_blocks?.type ?? 'strength')) && (() => {
                  const mode = w.exercise_blocks?.cardio_mode ?? 'both';
                  return (
                    <div className={`flex gap-1.5 px-2 mb-1 text-[11px] font-bold ${theme.textMuted}`}>
                      <div className="w-7 text-center shrink-0 opacity-50">{t('tapDel')}</div>
                      {(mode === 'time' || mode === 'both') && <div className="flex-1 text-center">{t('colMmss')}</div>}
                      {(mode === 'distance' || mode === 'both') && <div className="flex-1 text-center">km</div>}
                      <div className="w-9 text-center shrink-0">✓</div>
                    </div>
                  );
                })()}
                {/* 컬럼 헤더 — strength/bodyweight만 */}
                {isStrengthSet(w.sets?.[0] ?? makeDefaultSet(w.exercise_blocks?.type ?? 'strength')) && (
                  <div className={`flex gap-1.5 px-2 mb-1 text-[11px] font-bold ${theme.textMuted}`}>
                    <div className="w-7 text-center shrink-0 opacity-50">{t('tapDel')}</div>
                    {w.exercise_blocks?.type !== 'bodyweight' && (
                      <div className="flex-1 flex items-center justify-center">
                        <button
                          onClick={() => toggleWeightUnit(w.block_id)}
                          className={`flex items-center gap-0.5 px-2 py-0.5 rounded-lg transition-colors text-[11px] font-bold
                            ${appSettings.darkMode ? 'bg-surface-alt hover:bg-[#48484A]' : 'bg-gray-100 hover:bg-gray-200'}`}>
                          <span className={getUnit(w.block_id) === 'kg' ? 'text-primary' : theme.textMuted}>kg</span>
                          <span className={`mx-0.5 ${theme.textMuted}`}>/</span>
                          <span className={getUnit(w.block_id) === 'lbs' ? 'text-primary' : theme.textMuted}>lbs</span>
                        </button>
                      </div>
                    )}
                    <div className="flex-1 text-center">reps</div>
                    <div className="w-9 text-center shrink-0">✓</div>
                  </div>
                )}
                <div className="space-y-1.5">
                  {(w.sets || []).map((s: WorkoutSet, sIdx: number) => {
                    const isDS = isStrengthSet(s) && s.is_dropset;
                    return (
                      <div key={sIdx} className={`rounded-xl overflow-hidden transition-opacity ${s.done ? 'opacity-40' : ''}`}>
                        {/* 드랍세트 구분선 */}
                        {isDS && (
                          <div className="flex items-center gap-1 px-3 pt-1.5 pb-0.5">
                            <div className="h-px flex-1 bg-orange-400/50"/>
                            <span className="text-[10px] font-bold text-orange-400 shrink-0">{t('dropSet')}</span>
                            <div className="h-px flex-1 bg-orange-400/50"/>
                          </div>
                        )}
                        <div className={`flex gap-1.5 px-2 py-2.5 items-center
                          ${isDS ? 'bg-orange-400/10 border border-orange-400/30 rounded-xl' : theme.input}`}>

                          {/* 세트 번호 — 탭하면 해당 세트 삭제 */}
                          <button
                            onClick={() => !isWorkoutLocked && w.sets.length > 1 && handleRemoveSet(wIdx, sIdx)}
                            title={isWorkoutLocked ? '' : 'Tap to delete'}
                            className={`w-8 h-8 text-xs font-bold flex items-center justify-center rounded-lg shrink-0 transition-colors
                              ${isWorkoutLocked
                                ? theme.textMuted
                                : w.sets.length > 1
                                  ? `active:bg-red-500 active:text-white ${theme.card}`
                                  : theme.textMuted}`}>
                            {sIdx + 1}
                          </button>

                          {/* Strength 입력 (카드별 kg/lbs 단위 변환) */}
                          {isStrengthSet(s) && w.exercise_blocks?.type !== 'bodyweight' && (
                            <input type="number" inputMode="decimal" min="0"
                              step={getUnit(w.block_id) === 'lbs' ? '10' : '5'}
                              value={rawKgInput[`${wIdx}-${sIdx}`] ?? displayKg(s.kg, w.block_id)}
                              placeholder="—"
                              onChange={e => {
                                const raw = e.target.value;
                                setRawKgInput(prev => ({ ...prev, [`${wIdx}-${sIdx}`]: raw }));
                                handleUpdateSet(wIdx, sIdx, 'kg', inputToKg(raw, w.block_id));
                              }}
                              onFocus={() => {
                                setRawKgInput(prev => ({ ...prev, [`${wIdx}-${sIdx}`]: displayKg(s.kg, w.block_id) }));
                              }}
                              onBlur={() => {
                                setRawKgInput(prev => { const n = { ...prev }; delete n[`${wIdx}-${sIdx}`]; return n; });
                              }}
                              className={`flex-1 min-w-0 text-[16px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-blue-400 ${theme.card}`}/>
                          )}
                          {/* Bodyweight / Strength reps */}
                          {isStrengthSet(s) && (
                            <input type="number" inputMode="numeric" min="0"
                              value={s.reps} placeholder="—"
                              onChange={e => handleUpdateSet(wIdx, sIdx, 'reps', e.target.value)}
                              className={`flex-1 min-w-0 text-[16px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-blue-400 ${theme.card}`}/>
                          )}

                          {/* Cardio 입력 */}
                          {isCardioSet(s) && (() => {
                            const mode = w.exercise_blocks?.cardio_mode ?? 'both';
                            return (
                              <>
                                {(mode === 'time' || mode === 'both') && (
                                  <input type="text" inputMode="numeric"
                                    value={s.time}
                                    placeholder="0:00"
                                    onChange={e => handleTimeInput(wIdx, sIdx, e.target.value)}
                                    onBlur={e => handleTimeBlur(wIdx, sIdx, e.target.value)}
                                    className={`flex-1 min-w-0 text-[16px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-blue-400 ${theme.card}`}/>
                                )}
                                {(mode === 'distance' || mode === 'both') && (
                                  <input type="text" inputMode="decimal" value={s.distance} placeholder="km"
                                    onChange={e => handleUpdateSet(wIdx, sIdx, 'distance', e.target.value)}
                                    className={`flex-1 min-w-0 text-[16px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-blue-400 ${theme.card}`}/>
                                )}
                              </>
                            );
                          })()}

                          {/* 완료 체크 — 큰 탭 버튼 */}
                          <button
                            onClick={() => handleUpdateSet(wIdx, sIdx, 'done', !s.done)}
                            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90
                              ${s.done ? 'bg-green-500 text-white' : `${theme.card} ${theme.textMuted}`}`}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Add Set / Drop Set 버튼 — 잠금 시 숨김 */}
                {!isWorkoutLocked && (
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => handleAddSet(wIdx)}
                      className="flex-1 text-sm font-bold py-2.5 rounded-xl bg-primary text-primary-foreground active:scale-[0.98] transition-all">
                      {isCardioSet(w.sets?.[0] ?? makeDefaultSet(w.exercise_blocks?.type ?? 'strength')) ? t('addRound') : t('addSet')}
                    </button>
                    {isStrengthSet(w.sets?.[0] ?? makeDefaultSet(w.exercise_blocks?.type ?? 'strength')) && (
                      <button onClick={() => handleAddSet(wIdx, true)}
                        className="flex-1 text-sm font-bold py-2.5 rounded-xl bg-orange-400/20 text-orange-400 border border-orange-400/40 active:scale-[0.98] transition-all">
                        {t('addDropSet')}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
            })}
          </div>
          <div className="shrink-0 pt-4">
            {isWorkoutLocked ? (
              /* ── 잠금 상태: Saved 배너 + Edit 버튼만 표시 ── */
              <div className={`flex items-center justify-between gap-3 px-5 py-4 rounded-2xl border
                ${appSettings.darkMode ? 'bg-green-900/30 border-green-700/40' : 'bg-green-50 border-green-200'}`}>
                <div className="flex items-center gap-2.5">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0
                    ${appSettings.darkMode ? 'bg-green-800/60' : 'bg-green-100'}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
                      className={appSettings.darkMode ? 'text-green-400' : 'text-green-600'}>
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div>
                    <p className={`text-sm font-bold ${appSettings.darkMode ? 'text-green-400' : 'text-green-700'}`}>{t('workoutSavedShort')}</p>
                    <p className={`text-[11px] ${appSettings.darkMode ? 'text-green-600' : 'text-green-500'}`}>{t('tapEditModify')}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleCopySummary}
                    title="Copy workout summary to clipboard"
                    className={`flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold text-sm shadow-lg active:scale-[0.97] transition-all
                      ${copied
                        ? (appSettings.darkMode ? 'bg-green-800/60 text-green-300' : 'bg-green-100 text-green-700')
                        : (appSettings.darkMode ? 'bg-surface-alt text-gray-200 hover:bg-[#48484A]' : 'bg-gray-100 text-gray-700 hover:bg-gray-200')
                      }`}>
                    {copied ? <><Check size={13}/> {t('copiedBtn')}</> : <><ClipboardCopy size={13}/> {t('copyBtn')}</>}
                  </button>
                  <button onClick={() => { setIsWorkoutLocked(false); setIsDirty(true); }}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow-lg hover:bg-gray-800 active:scale-[0.97] transition-all">
                    <Pencil size={14}/> {t('editBtn')}
                  </button>
                </div>
              </div>
            ) : (
              /* ── 편집 상태: Complete Workout 버튼 ── */
              <button onClick={handleSaveWorkouts}
                disabled={isSaving}
            className={`w-full bg-primary text-primary-foreground font-bold text-lg py-4 rounded-2xl shadow-xl flex justify-center items-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all sticky bottom-2 z-10 ${isSaving ? 'opacity-70' : ''}`}>
                {isSaving ? <Loader2 size={20} className="animate-spin"/> : <Save size={20}/>} {isSaving ? t('loading') : t('completeWorkout')}
              </button>
            )}
            {/* ── 날짜별 메모 ── */}
            <div className={`mt-3 rounded-2xl p-3 ${appSettings.bg-surface-alt}`}>
              <p className={`text-[11px] font-bold mb-1.5 ${theme.textMuted}`}>📝 MEMO</p>
              <textarea
                value={workoutMemo}
                onChange={e => {
                  setWorkoutMemo(e.target.value);
                  localStorage.setItem(memoKey, e.target.value);
                }}
                placeholder={t('memoPlaceholder')}
                rows={3}
                className={`w-full bg-transparent outline-none resize-none text-sm leading-relaxed placeholder-gray-400 ${theme.text}`}
              />
            </div>
          </div>
        </div>

        <div className={`flex-col lg:flex-row gap-4 lg:gap-5 shrink-0 ${mobileHealthTab === "workout" ? "flex" : "hidden lg:flex"}`}>
          {/* 캘린더 — 모바일: 가로 스크롤 주간 배너 / 데스크탑: 월간 그리드 */}
          <div className={`flex-1 rounded-[24px] lg:rounded-[32px] shadow-sm p-3 lg:p-6 flex flex-col transition-colors ${theme.card}`}>
            {/* 공통 헤더 */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-heading text-base font-bold tabular-nums">
                {currentDate.toLocaleString(lang, { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-1">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className={`p-1.5 rounded-full ${theme.hoverBg}`}><ChevronLeft size={15}/></button>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className={`p-1.5 rounded-full ${theme.hoverBg}`}><ChevronRight size={15}/></button>
              </div>
            </div>

            {/* 모바일 전용 — 가로 스크롤 배너 (해당 월 전체 날짜) */}
            <div ref={bannerScrollRef} className="lg:hidden overflow-x-auto pb-1 -mx-1 px-1 scroll-smooth">
              <div className="flex gap-2 w-max">
                {(() => {
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const days = Array.from({ length: new Date(year, month + 1, 0).getDate() }, (_, i) => i + 1);
                  const DAY_LABELS = ['Su','Mo','Tu','We','Th','Fr','Sa'];
                  return days.map(day => {
                    const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                    const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                    const isTodayCell = isToday(dateStr);
                    const dow = new Date(year, month, day).getDay();
                    return (
                      <button key={day}
                        onClick={() => setSelectedDate(new Date(year, month, day))}
                        className={`flex flex-col items-center gap-1 px-2 py-2 rounded-2xl transition-colors shrink-0 w-11
                          ${isSelected
                            ? 'bg-primary text-primary-foreground'
                            : isTodayCell
                              ? `ring-2 ring-primary ${theme.input}`
                              : theme.input}`}>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-primary-foreground' : theme.textMuted}`}>
                          {DAY_LABELS[dow]}
                        </span>
                        <span className="text-sm font-bold">{day}</span>
                      </button>
                    );
                  });
                })()}
              </div>
            </div>

            {/* 데스크탑 전용 — 기존 월간 그리드 */}
            <div className="hidden lg:block">
              <div className={`grid grid-cols-7 gap-1 text-center text-[11px] font-semibold mb-2 ${theme.textMuted}`}>
                {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <div key={d}>{d}</div>)}
              </div>
              <div className="grid grid-cols-7 gap-y-2 text-center text-sm font-bold">
                {calendarDays.map((day, idx) => {
                  if (!day) return <div key={`e-${idx}`}/>;
                  const pad = (n: number) => String(n).padStart(2, '0');
                  const dateStr = `${year}-${pad(month + 1)}-${pad(day)}`;
                  const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;
                  const isTodayCell = isToday(dateStr);
                  return (
                    <div key={day} onClick={() => setSelectedDate(new Date(year, month, day))} className="flex justify-center items-center h-9 cursor-pointer">
                      <div className={`w-9 h-9 flex items-center justify-center rounded-full transition-colors font-bold text-sm
                        ${isSelected ? 'bg-blue-500 text-white shadow-md'
                          : isTodayCell ? `ring-2 ring-blue-400 ${theme.hoverBg}`
                          : theme.hoverBg}`}>
                        {day}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* InBody — 세로 배열 (데스크탑) / 가로 스크롤 (모바일) */}
          <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm px-5 py-4 transition-colors ${theme.card} lg:w-[160px] lg:shrink-0`}>
            {/* 제목과 저장 버튼 — 세로 배치로 여유 확보 */}
            <div className="flex flex-col gap-2.5 mb-3">
              <h2 className="font-heading text-base font-bold flex items-center gap-2"><Target size={16} className="text-primary"/> {t('inbody')}</h2>
              <button onClick={handleSaveInbody} className="w-full text-xs font-bold bg-primary text-primary-foreground px-3 py-2 rounded-xl hover:bg-gray-800 transition-colors">{t('save')}</button>
            </div>
            {/* 모바일: 가로 3열 / 데스크탑: 세로 3행 */}
            <div className="flex gap-3 lg:flex-col lg:gap-2">
              {[
                { label: t('inbodyWeight'), field: 'weight' as const, unit: 'kg', color: 'text-blue-400'  },
                { label: t('inbodySMM'),    field: 'smm'    as const, unit: 'kg', color: 'text-green-400' },
                { label: t('inbodyPBF'),    field: 'pbf'    as const, unit: '%',  color: 'text-red-400'   },
              ].map(({ label, field, unit, color }) => (
                <div key={field} className={`flex-1 lg:flex-none rounded-2xl p-2.5 border-2 border-transparent focus-within:border-primary transition-colors ${theme.input}`}>
                  <p className={`text-[10px] font-bold mb-1 ${color}`}>{label}</p>
                  <div className="flex items-end gap-0.5">
                    <input type="number" inputMode="decimal" min="0" step="0.1"
                      value={localInbody[field] !== 0 ? localInbody[field] : ''} placeholder="0"
                      onChange={e => { setIsInbodyDirty(true); setLocalInbody(prev => ({ ...prev, [field]: Number(e.target.value) })); }}
                      className="w-full bg-transparent text-lg font-black outline-none tabular-nums"/>
                    <span className={`text-xs font-semibold pb-0.5 ${theme.textMuted}`}>{unit}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── 프로틴 트래커 — 데스크탑 인라인, 모바일은 별도 탭으로 이동 ── */}
          <div className="flex-1 min-w-0 hidden lg:block">
            <ProteinTracker
              theme={theme}
              darkMode={appSettings.darkMode}
              selectedDate={selectedDate}
              formatDate={formatDate}
              showToast={showToast}
            />
          </div>
        </div>
      </div>

      {/* ── 모바일 전용: Protein 탭 패널 ── */}
      <div className={`flex-1 flex-col gap-4 min-h-0 overflow-y-auto pb-4 ${mobileHealthTab === 'protein' ? 'flex lg:hidden' : 'hidden'}`}>
        <ProteinTracker
          theme={theme}
          darkMode={appSettings.darkMode}
          selectedDate={selectedDate}
          formatDate={formatDate}
          showToast={showToast}
        />
      </div>

      {/* ── 블록 생성/수정 모달 ── */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowBlockModal(false)}>
          <div className={`p-6 lg:p-8 rounded-[32px] w-full max-w-[380px] shadow-2xl ${theme.card}`} onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-xl font-bold mb-6 flex justify-between items-center">
              {editingBlock ? t('editBlock') : t('newBlockLabel')}
              <button onClick={() => setShowBlockModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={18}/></button>
            </h3>

            {/* 이름 */}
            <input autoFocus type="text" value={newBlock.name ?? ''} placeholder={t('exerciseName')}
              onChange={e => setNewBlock({ ...newBlock, name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleSaveBlock()}
              className={`w-full p-4 rounded-2xl mb-4 outline-none focus:ring-2 focus:ring-blue-400 font-semibold text-base ${theme.input}`}/>

            {/* 타입 */}
            <select value={newBlock.type ?? 'strength'} onChange={e => setNewBlock({ ...newBlock, type: e.target.value, cardio_mode: 'both' })}
              className={`w-full p-4 rounded-2xl mb-4 outline-none font-semibold text-base ${theme.input}`}>
              <option value="strength">{t('strength')}</option>
              <option value="bodyweight">{t('bodyweight')}</option>
              <option value="cardio">{t('cardio')}</option>
            </select>

            {/* Cardio 모드 선택 */}
            {newBlock.type === 'cardio' && (
              <div className={`rounded-2xl p-3 mb-4 ${theme.input}`}>
                <p className={`text-xs font-bold mb-2 ${theme.textMuted}`}>{t('cardioMode')}</p>
                <div className="flex gap-2">
                  {(['time', 'distance', 'both'] as const).map(mode => (
                    <button key={mode} onClick={() => setNewBlock({ ...newBlock, cardio_mode: mode })}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all
                        ${(newBlock.cardio_mode ?? 'both') === mode
                          ? 'bg-primary text-primary-foreground'
                          : `${appSettings.darkMode ? 'bg-surface' : 'bg-gray-100'} ${theme.textMuted}`}`}>
                      {mode === 'time' ? t('cardioTime') : mode === 'distance' ? t('cardioDistance') : t('cardioBoth')}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* 태그 입력 */}
            <div className={`rounded-2xl p-3 mb-2 ${theme.input}`}>
              <p className={`text-xs font-bold mb-2 ${theme.textMuted}`}>{t('tagsPlaceholder')}</p>
              {/* 등록된 태그 */}
              {(newBlock.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(newBlock.tags ?? []).map(tag => (
                    <span key={tag} className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg ${appSettings.darkMode ? 'bg-blue-900/50 text-blue-300' : 'bg-blue-50 text-blue-600'}`}>
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="ml-0.5 hover:opacity-70"><X size={10}/></button>
                    </span>
                  ))}
                </div>
              )}
              {/* 태그 입력란 */}
              <input
                type="text"
                value={tagInput}
                placeholder={t('exNamePlaceholder')}
                onChange={e => {
                  const val = e.target.value;
                  if (val.endsWith(',')) {
                    const tag = val.slice(0, -1).trim();
                    if (tag && !(newBlock.tags ?? []).includes(tag))
                      setNewBlock(b => ({ ...b, tags: [...(b.tags ?? []), tag] }));
                    setTagInput('');
                  } else {
                    setTagInput(val);
                  }
                }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commitTag(); } }}
                onBlur={commitTag}
                className="w-full bg-transparent outline-none text-sm font-semibold placeholder-gray-400"
              />
            </div>
            <p className={`text-[11px] mb-4 ${theme.textMuted}`}>{t('tapBlockHint')}</p>

            <button onClick={handleSaveBlock} className="w-full bg-primary text-primary-foreground p-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-colors">
              {editingBlock ? 'Save Changes' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* ── 루틴 조합 모달 ── */}
      {showAssembleModal && (() => {
        // 태그별 그룹화 — Assemble 모달
        const assembleGroups: Record<string, ExerciseBlock[]> = {};
        (healthBlocks || []).forEach((b: ExerciseBlock) => {
          const tags = b.tags?.length ? b.tags : ['OTHER'];
          tags.forEach(tag => {
            if (!assembleGroups[tag]) assembleGroups[tag] = [];
            assembleGroups[tag].push(b);
          });
        });
        // OTHER를 항상 맨 뒤로
        const assembleTagOrder = Object.keys(assembleGroups).sort((a, b) =>
          a === 'OTHER' ? 1 : b === 'OTHER' ? -1 : a.localeCompare(b));
        return (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowAssembleModal(false)}>
            <div className={`rounded-[32px] p-6 lg:p-8 w-full max-w-[440px] shadow-2xl flex flex-col max-h-[85vh] ${theme.card}`} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-5 shrink-0">
                <div>
                  <h3 className="font-heading text-xl font-bold">{t('assembleTitle')} {activeDayForm}</h3>
                  <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{t('assembleHint').replace('{count}', String(tempRoutineBlocks.length))}</p>
                </div>
                <button onClick={() => setShowAssembleModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={18}/></button>
              </div>

              {/* 선택된 순서 미리보기 — 드래그로 재정렬 */}
              {tempRoutineBlocks.length > 0 && (
                <div className={`mb-4 p-3 rounded-2xl shrink-0 ${appSettings.bg-surface-alt}`}>
                  <p className={`text-[11px] font-bold mb-2 ${theme.textMuted}`}>{t('orderDrag')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tempRoutineBlocks.map((id, idx) => {
                      const b = (healthBlocks || []).find((bk: ExerciseBlock) => bk.id === id);
                      if (!b) return null;
                      const isDraggingThis = routineDragIdx === idx;
                      const isDragOver = routineDragOverIdx === idx && routineDragIdx !== idx;
                      return (
                        <span
                          key={id}
                          draggable
                          onDragStart={() => setRoutineDragIdx(idx)}
                          onDragEnter={() => setRoutineDragOverIdx(idx)}
                          onDragOver={e => e.preventDefault()}
                          onDragEnd={() => {
                            if (routineDragIdx !== null && routineDragOverIdx !== null && routineDragIdx !== routineDragOverIdx) {
                              setTempRoutineBlocks(prev => {
                                const next = [...prev];
                                const [moved] = next.splice(routineDragIdx, 1);
                                next.splice(routineDragOverIdx, 0, moved);
                                return next;
                              });
                            }
                            setRoutineDragIdx(null);
                            setRoutineDragOverIdx(null);
                          }}
                          onTouchStart={() => setRoutineDragIdx(idx)}
                          onTouchMove={e => {
                            const touch = e.touches[0];
                            const el = document.elementFromPoint(touch.clientX, touch.clientY);
                            const chip = el?.closest('[data-routine-idx]');
                            if (chip) {
                              const over = Number(chip.getAttribute('data-routine-idx'));
                              if (!isNaN(over)) setRoutineDragOverIdx(over);
                            }
                          }}
                          onTouchEnd={() => {
                            if (routineDragIdx !== null && routineDragOverIdx !== null && routineDragIdx !== routineDragOverIdx) {
                              setTempRoutineBlocks(prev => {
                                const next = [...prev];
                                const [moved] = next.splice(routineDragIdx, 1);
                                next.splice(routineDragOverIdx, 0, moved);
                                return next;
                              });
                            }
                            setRoutineDragIdx(null);
                            setRoutineDragOverIdx(null);
                          }}
                          data-routine-idx={idx}
                          className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-lg cursor-grab active:cursor-grabbing select-none transition-all
                            ${isDraggingThis ? 'opacity-40 scale-95' : ''}
                            ${isDragOver ? 'ring-2 ring-[#1C1C1E] scale-105' : ''}
                            bg-primary text-primary-foreground`}>
                          <span className="opacity-60 text-[10px]">{idx + 1}</span>
                          {b.name}
                          <GripVertical size={11} className="opacity-40 ml-0.5"/>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 태그별 블록 목록 */}
              <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {assembleTagOrder.map(tag => (
                  <div key={tag}>
                    <p className={`text-[11px] font-black tracking-wider mb-2 ${theme.textMuted}`}>
                      #{tag}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {assembleGroups[tag].map((b: ExerciseBlock) => {
                        const sel = tempRoutineBlocks.includes(b.id);
                        const selIdx = tempRoutineBlocks.indexOf(b.id);
                        return (
                          <div key={b.id} onClick={() => toggleBlockInRoutine(b.id)}
                            className={`relative text-sm font-semibold px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all select-none
                              ${sel
                                ? 'border-blue-500 bg-blue-500 text-white'
                                : `border-transparent ${theme.input} hover:border-blue-400/50`}`}>
                            {b.name}
                            {sel && (
                              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-primary text-primary-foreground text-[10px] font-black rounded-full flex items-center justify-center">
                                {selIdx + 1}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <button onClick={handleSaveRoutine} className="mt-5 shrink-0 w-full bg-primary text-primary-foreground font-bold text-lg p-4 rounded-2xl hover:bg-gray-800 transition-colors">
                {t('saveRoutine')}
              </button>
            </div>
          </div>
        );
      })()}

      {confirm && <ConfirmModal message={confirm.message} onConfirm={handleConfirm} onCancel={clearConfirm} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}
    </div>
  );
};
