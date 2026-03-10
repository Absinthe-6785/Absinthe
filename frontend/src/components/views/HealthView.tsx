import { useState, useEffect, useMemo, useRef, MouseEvent, ChangeEvent } from 'react';
import { Plus, X, Trash2, Save, Dumbbell, Target, Activity, ChevronLeft, ChevronRight, Lock, Pencil } from 'lucide-react';
import { authFetch } from '../../lib/supabase';
import { API_URL } from '../../lib/config';
import { useConfirm } from '../../hooks/useConfirm';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmModal } from '../common/ConfirmModal';
import { EmptyState } from '../common/EmptyState';
import { HealthProps, Workout, WorkoutSet, StrengthSet, CardioSet, ExerciseBlock, HealthRoutine, Inbody,
         isCardioSet, isStrengthSet, makeDefaultSet, makeNextSet } from '../../types';
import { buildCalendarDays } from '../../lib/calendarUtils';

export const HealthView = ({
  currentDate, setCurrentDate, selectedDate, setSelectedDate,
  formatDate, isToday, showToast, mutateDaily, mutateStatic,
  workouts, healthBlocks, healthRoutines, inbody, theme, appSettings,
  THEME_COLORS,
}: HealthProps) => {
  const { mutate: api } = useApiMutation(mutateDaily, mutateStatic, showToast);
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
  const [newBlock, setNewBlock] = useState<Partial<ExerciseBlock>>({ name: '', type: 'strength', tags: [] });
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
  const [mobileHealthTab, setMobileHealthTab] = useState<'blocks' | 'routine' | 'workout'>('workout');

  // 배너 캘린더 — 선택 날짜를 자동으로 가운데 스크롤
  const bannerScrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bannerScrollRef.current;
    if (!el) return;
    const idx = selectedDate.getDate() - 1;
    const itemW = 52; // w-11(44px) + gap-2(8px)
    const scrollTarget = idx * itemW - el.clientWidth / 2 + itemW / 2;
    el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [selectedDate]);

  // isDirty: 사용자가 세트를 편집 중인 상태.
  // true일 때는 SWR 백그라운드 재검증이 localWorkouts를 덮어쓰지 않음.
  // handleSaveWorkouts 성공 후 false로 리셋.
  const [isDirty, setIsDirty] = useState(false);
  // isWorkoutLocked: Complete Workout 저장 후 잠금 — Edit 버튼 누르기 전까지 수정 불가
  const [isWorkoutLocked, setIsWorkoutLocked] = useState(false);
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>([]);

  // weightUnits: 운동 카드(block_id)별 독립 kg/lbs 토글
  // DB에는 항상 kg로 저장. lbs 모드 시 입력→×0.4536→저장, 출력→÷0.4536→표시.
  // localStorage persist — 재방문/날짜 이동 시에도 단위 선택 유지
  const WEIGHT_UNITS_KEY = 'health-weight-units';
  const [weightUnits, setWeightUnits] = useState<Record<string, 'kg' | 'lbs'>>(() => {
    try {
      const saved = localStorage.getItem('health-weight-units');
      return saved ? (JSON.parse(saved) as Record<string, 'kg' | 'lbs'>) : {};
    } catch { return {}; }
  });
  const getUnit = (blockId: string): 'kg' | 'lbs' => weightUnits[blockId] ?? 'kg';
  const toggleUnit = (blockId: string) => {
    setWeightUnits(prev => {
      const next = { ...prev, [blockId]: (prev[blockId] === 'lbs' ? 'kg' : 'lbs') } as Record<string, 'kg' | 'lbs'>;
      try { localStorage.setItem('health-weight-units', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  };

  const KG_PER_LBS = 0.45359237;
  // 표시용: DB(kg) → 해당 카드 단위로 변환
  const displayKg = (kg: number | string, blockId: string): string => {
    const n = parseFloat(String(kg));
    if (isNaN(n) || kg === '' || kg === null) return '';
    return getUnit(blockId) === 'lbs'
      ? String(Math.round(n / KG_PER_LBS * 10) / 10)
      : String(n);
  };
  // 저장용: 해당 카드 단위 입력값 → kg으로 변환
  const inputToKg = (val: string, blockId: string): string => {
    if (val === '' || val === null) return '';
    const n = parseFloat(val);
    if (isNaN(n)) return '';
    return getUnit(blockId) === 'lbs'
      ? String(Math.round(n * KG_PER_LBS * 100) / 100)
      : val;
  };

  // localWorkouts와 동일 패턴: InBody도 편집 중 SWR 재검증이 덮어쓰지 않도록 보호.
  // revalidateOnFocus(기본 true)가 발생하면 입력 중인 수치가 날아가는 버그 방지.
  const [isInbodyDirty, setIsInbodyDirty] = useState(false);

  // selectedDate가 바뀌면 다른 날짜 데이터를 봐야 하므로 편집 중 상태를 초기화.
  // 개선 전: isDirty=true인 채로 날짜 이동 → 새 날짜 workouts가 fetch돼도
  //          isDirty 가드 때문에 localWorkouts가 갱신되지 않아 이전 날짜 데이터 표시.
  // 개선 후: selectedDate 변경 시 isDirty 즉시 리셋 → workouts useEffect가 정상 동기화.
  useEffect(() => { setIsDirty(false); setIsInbodyDirty(false); }, [selectedDate]);

  useEffect(() => {
    if (!isDirty) {
      const sorted = [...(workouts || [])].sort((a, b) => {
        const ao = a.sort_order ?? 9999;
        const bo = b.sort_order ?? 9999;
        return ao - bo;
      });
      setLocalWorkouts(sorted);
      // 저장된 기록이 있으면 자동 잠금 — 의도치 않은 수정 방지
      setIsWorkoutLocked(sorted.length > 0);
    }
  }, [workouts, isDirty]);

  const [localInbody, setLocalInbody] = useState<Inbody>({ weight: 0, smm: 0, pbf: 0 });
  useEffect(() => {
    if (!isInbodyDirty)
      setLocalInbody({ weight: Number(inbody?.weight || 0), smm: Number(inbody?.smm || 0), pbf: Number(inbody?.pbf || 0) });
  }, [inbody, isInbodyDirty]);

  useEscapeKey(() => { setShowBlockModal(false); setShowAssembleModal(false); clearConfirm(); });

  // ── 운동 블록 ──────────────────────────────────────────────────────
  const openBlockModal = (block?: ExerciseBlock) => {
    if (block) {
      setEditingBlock(block);
      setNewBlock({ name: block.name, type: block.type, tags: block.tags ?? [] });
    } else {
      setEditingBlock(null);
      setNewBlock({ name: '', type: 'strength', tags: [] });
    }
    setTagInput('');
    setShowBlockModal(true);
  };

  const commitTag = () => {
    const t = tagInput.trim();
    if (!t) return;
    const already = (newBlock.tags ?? []).includes(t);
    if (!already) setNewBlock(b => ({ ...b, tags: [...(b.tags ?? []), t] }));
    setTagInput('');
  };

  const removeTag = (tag: string) =>
    setNewBlock(b => ({ ...b, tags: (b.tags ?? []).filter(t => t !== tag) }));

  const handleSaveBlock = async () => {
    if (!newBlock.name) return showToast('Enter name!', 'error');
    const payload = { name: newBlock.name, type: newBlock.type, tags: newBlock.tags ?? [] };
    const ok = editingBlock
      ? await api('PUT', `/api/blocks/${editingBlock.id}`, payload, { revalidate: 'static', successMsg: 'Block updated' })
      : await api('POST', '/api/blocks', payload, { revalidate: 'static', successMsg: 'Block created' });
    if (ok) { setShowBlockModal(false); setNewBlock({ name: '', type: 'strength', tags: [] }); setEditingBlock(null); }
  };

  const handleDeleteBlock = (id: string, e: MouseEvent) => {
    e.stopPropagation();
    showConfirm('Delete this block?', () =>
      api('DELETE', `/api/blocks/${id}`, undefined, { revalidate: 'static', successMsg: 'Block deleted' }),
      { confirmLabel: 'Delete' },
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
    const ok = await api('POST', '/api/health_routines', { day_name: activeDayForm, blocks: tempRoutineBlocks }, { revalidate: 'static', successMsg: 'Routine Saved' });
    if (ok) setShowAssembleModal(false);
  };

  // ── 워크아웃 로컬 조작 ─────────────────────────────────────────────
  const handleLoadRoutine = (e: ChangeEvent<HTMLSelectElement>) => {
    const dayName = e.target.value;
    if (dayName === 'Load Routine') return;
    const routine = healthRoutines.find((r: HealthRoutine) => r.day_name === dayName);
    if (!routine?.blocks?.length) { showToast('No blocks assembled.', 'error'); e.target.value = 'Load Routine'; return; }

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
    e.target.value = 'Load Routine';
    showToast('Loaded!');
  };
  const handleAddWorkoutToToday = (block: ExerciseBlock) => {
    if (localWorkouts.find(w => w.block_id === block.id)) return showToast('Already added!', 'error');
    setIsDirty(true);
    setLocalWorkouts([...localWorkouts, { id: `temp-${Date.now()}`, block_id: block.id, exercise_blocks: block, sets: [makeDefaultSet(block.type)] }]);
  };
  const handleRemoveWorkout = async (index: number, dbId: string) => {
    try {
      if (!dbId.startsWith('temp')) {
        const res = await authFetch(`${API_URL}/api/workouts/${dbId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`[${res.status}]`);
        // DB 삭제 성공 즉시 mutateDaily → SWR 캐시도 동기화.
        mutateDaily();
      }
      const next = localWorkouts.filter((_, i) => i !== index);
      setLocalWorkouts(next);
      if (next.length === 0) setIsDirty(false);
    } catch { showToast('Failed to remove', 'error'); }
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
    if (localWorkouts.length === 0) return showToast('No workouts to save', 'error');

    // 순차 저장 — sort_order 보장을 위해 병렬(allSettled) 대신 순서대로 await
    // 병렬 저장 시 네트워크 응답 순서가 뒤바뀌어 sort_order가 섞이는 문제 방지
    let failed = 0;
    for (let idx = 0; idx < localWorkouts.length; idx++) {
      const w = localWorkouts[idx];
      try {
        const res = await authFetch(`${API_URL}/api/workouts`, {
          method: 'POST',
          body: JSON.stringify({ date: formatDate(selectedDate), block_id: w.block_id, sets: w.sets, sort_order: idx }),
        });
        if (!res.ok) failed++;
      } catch { failed++; }
    }
    const total = localWorkouts.length;
    if (failed === 0) {
      showToast('Workout Saved! 💪');
      setIsDirty(false);
      setIsWorkoutLocked(true);
      mutateDaily();
    } else if (failed < total) {
      showToast(`${total - failed}/${total} saved. Some failed.`, 'error');
      setIsDirty(false);
      setIsWorkoutLocked(true);
      mutateDaily();
    } else {
      showToast('Failed to save workout', 'error');
    }
  };
  const handleSaveInbody = async () => {
    if (localInbody.weight < 0 || localInbody.smm < 0 || localInbody.pbf < 0)
      return showToast('Values cannot be negative', 'error');
    const ok = await api('POST', '/api/inbody',
      { date: formatDate(selectedDate), weight: Number(localInbody.weight), smm: Number(localInbody.smm), pbf: Number(localInbody.pbf) },
      { revalidate: 'daily', successMsg: 'InBody Saved! 📈' }
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
          {(['blocks', 'routine', 'workout'] as const).map(tab => (
            <button key={tab}
              onClick={() => setMobileHealthTab(tab)}
              className={`flex-1 py-2.5 rounded-2xl text-xs font-bold transition-colors
                ${mobileHealthTab === tab
                  ? 'bg-[#1C1C1E] text-[#FACC15]'
                  : `${theme.input} ${theme.textMuted}`}`}>
              {tab === 'blocks' ? 'Blocks' : tab === 'routine' ? 'Routine' : 'Workout'}
            </button>
          ))}
        </div>
        <div className={`lg:h-[40%] min-h-0 max-h-[280px] lg:max-h-none rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card} ${mobileHealthTab !== 'blocks' ? 'hidden lg:flex' : ''}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-heading text-lg font-bold">Workout Blocks</h2>
            <button onClick={() => openBlockModal()} className="bg-[#1C1C1E] text-[#FACC15] px-2.5 py-2 rounded-xl shadow-md"><Plus size={16}/></button>
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
                className={`group relative text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-transparent hover:border-[#FACC15] active:border-[#FACC15] cursor-pointer transition-colors ${theme.input}`}>
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
                        ${activeTagFilter === null ? 'bg-[#FACC15] text-[#1C1C1E]' : `${theme.input} ${theme.textMuted}`}`}>
                      All
                    </button>
                    {allTags.map(tag => (
                      <button key={tag} onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors
                          ${activeTagFilter === tag ? 'bg-[#FACC15] text-[#1C1C1E]' : `${theme.input} ${theme.textMuted}`}`}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}

                {/* 블록 없을 때 */}
                {blocks.length === 0 && <EmptyState theme={theme} onClick={() => openBlockModal()} icon={Dumbbell} text="Create exercise blocks"/>}

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
                          <span className={`text-[11px] font-black tracking-wide ${theme.textMuted}`}>OTHER</span>
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

        <div className={`max-h-[420px] lg:max-h-none lg:flex-[1.5] rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card} ${mobileHealthTab === 'routine' ? '' : 'hidden lg:flex'}`}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-heading text-lg font-bold">Routine Setup</h2>
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
              <span className={`text-xs font-semibold ${theme.textMuted}`}>Split(s)</span>
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
                    <button onClick={() => openAssembleModal(dayName)} className="text-sm text-blue-500 font-bold">+ Assemble</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {blocks.map(b => <span key={b.id} className={`text-xs font-semibold px-2.5 py-1 rounded-lg border shadow-sm ${theme.card} ${theme.border}`}>{b.name}</span>)}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 우측: 오늘의 운동 + 캘린더 + InBody ── */}
      <div className={`flex-1 lg:flex-[6.5] flex-col gap-4 lg:gap-5 min-h-0 lg:overflow-hidden lg:pr-1 lg:pb-4 ${mobileHealthTab === 'workout' ? 'flex' : 'hidden lg:flex'}`}>
        <div className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors min-h-0 lg:flex-1 ${theme.card}`}>
          <div className={`flex justify-between items-center mb-5 border-b pb-5 ${theme.border}`}>
            <div>
              <h2 className="font-heading text-2xl font-bold">Today's Workout</h2>
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>
                {selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
            </div>
            {!isWorkoutLocked && (
              <select onChange={handleLoadRoutine}
                className="bg-[#1C1C1E] text-[#FACC15] font-bold text-sm lg:text-base px-4 lg:px-5 py-2 lg:py-3 rounded-xl outline-none cursor-pointer shadow-md">
                <option>Load Routine</option>
                {Array.from({ length: splitCount }).map((_, i) => <option key={i} value={`Day ${i + 1}`}>Load Day {i + 1}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-5 pb-2 lg:flex-1 lg:overflow-y-auto lg:min-h-0">
            {localWorkouts.length === 0 && <EmptyState theme={theme} icon={Dumbbell} text="No workouts added. Let's get moving!"/>}
            {localWorkouts.map((w: Workout, wIdx: number) => (
              <div key={w.id} className={`border rounded-3xl p-5 relative group shadow-sm ${theme.border}`}>
                {!isWorkoutLocked && (
                  <button onClick={() => handleRemoveWorkout(wIdx, w.id)}
                    className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-red-500 active:scale-95 transition-colors">
                    <Trash2 size={18}/>
                  </button>
                )}
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${w.exercise_blocks?.type === 'cardio' ? 'bg-green-500' : w.exercise_blocks?.type === 'bodyweight' ? 'bg-purple-500' : 'bg-blue-500'}`}/>
                  <h3 className="font-heading text-lg font-bold">{w.exercise_blocks?.name || 'Unknown'}</h3>
                </div>
                {/* 컬럼 헤더 — strength/bodyweight만 */}
                {isStrengthSet(w.sets?.[0] ?? makeDefaultSet(w.exercise_blocks?.type ?? 'strength')) && (
                  <div className={`flex gap-2 px-2 mb-1 text-[11px] font-bold ${theme.textMuted}`}>
                    <div className="w-8 text-center shrink-0 opacity-50">tap=del</div>
                    {w.exercise_blocks?.type !== 'bodyweight' && (
                      <div className="flex-1 flex items-center justify-center">
                        <button
                          onClick={() => toggleUnit(w.block_id)}
                          className={`flex items-center gap-0.5 px-2 py-0.5 rounded-lg transition-colors text-[11px] font-bold
                            ${appSettings.darkMode ? 'bg-[#3A3A3C] hover:bg-[#48484A]' : 'bg-gray-100 hover:bg-gray-200'}`}>
                          <span className={getUnit(w.block_id) === 'kg' ? 'text-[#FACC15]' : theme.textMuted}>kg</span>
                          <span className={`mx-0.5 ${theme.textMuted}`}>/</span>
                          <span className={getUnit(w.block_id) === 'lbs' ? 'text-[#FACC15]' : theme.textMuted}>lbs</span>
                        </button>
                      </div>
                    )}
                    <div className="flex-1 text-center">reps</div>
                    <div className="w-10 text-center shrink-0">✓</div>
                  </div>
                )}
                <div className="space-y-2">
                  {(w.sets || []).map((s: WorkoutSet, sIdx: number) => {
                    const isDS = isStrengthSet(s) && s.is_dropset;
                    return (
                      <div key={sIdx} className={`rounded-xl overflow-hidden transition-opacity ${s.done ? 'opacity-40' : ''}`}>
                        {/* 드랍세트 구분선 */}
                        {isDS && (
                          <div className="flex items-center gap-1 px-3 pt-1.5 pb-0.5">
                            <div className="h-px flex-1 bg-orange-400/50"/>
                            <span className="text-[10px] font-bold text-orange-400 shrink-0">DROP SET</span>
                            <div className="h-px flex-1 bg-orange-400/50"/>
                          </div>
                        )}
                        <div className={`flex gap-2 px-2 py-3 items-center
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
                              value={displayKg(s.kg, w.block_id)}
                              placeholder="—"
                              onChange={e => handleUpdateSet(wIdx, sIdx, 'kg', inputToKg(e.target.value, w.block_id))}
                              className={`flex-1 text-[15px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-[#FACC15] ${theme.card}`}/>
                          )}
                          {/* Bodyweight / Strength reps */}
                          {isStrengthSet(s) && (
                            <input type="number" inputMode="numeric" min="0"
                              value={s.reps} placeholder="—"
                              onChange={e => handleUpdateSet(wIdx, sIdx, 'reps', e.target.value)}
                              className={`flex-1 text-[15px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-[#FACC15] ${theme.card}`}/>
                          )}

                          {/* Cardio 입력 */}
                          {isCardioSet(s) && (
                            <>
                              <input type="text" inputMode="numeric" value={s.time} placeholder="min"
                                onChange={e => handleUpdateSet(wIdx, sIdx, 'time', e.target.value)}
                                className={`flex-1 text-[15px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-[#FACC15] ${theme.card}`}/>
                              <input type="text" inputMode="decimal" value={s.distance} placeholder="km"
                                onChange={e => handleUpdateSet(wIdx, sIdx, 'distance', e.target.value)}
                                className={`flex-1 text-[15px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-[#FACC15] ${theme.card}`}/>
                            </>
                          )}

                          {/* 완료 체크 — 큰 탭 버튼 */}
                          <button
                            onClick={() => handleUpdateSet(wIdx, sIdx, 'done', !s.done)}
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all active:scale-90
                              ${s.done ? 'bg-[#FACC15] text-[#1C1C1E]' : `${theme.card} ${theme.textMuted}`}`}>
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
                      className="flex-1 text-sm font-bold py-2.5 rounded-xl bg-[#FACC15] text-[#1C1C1E] active:scale-[0.98] transition-all">
                      + Set
                    </button>
                    {isStrengthSet(w.sets?.[0] ?? makeDefaultSet(w.exercise_blocks?.type ?? 'strength')) && (
                      <button onClick={() => handleAddSet(wIdx, true)}
                        className="flex-1 text-sm font-bold py-2.5 rounded-xl bg-orange-400/20 text-orange-400 border border-orange-400/40 active:scale-[0.98] transition-all">
                        ↓ Drop Set
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
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
                    <p className={`text-sm font-bold ${appSettings.darkMode ? 'text-green-400' : 'text-green-700'}`}>Workout Saved</p>
                    <p className={`text-[11px] ${appSettings.darkMode ? 'text-green-600' : 'text-green-500'}`}>Tap Edit to modify</p>
                  </div>
                </div>
                <button onClick={() => { setIsWorkoutLocked(false); setIsDirty(true); }}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#1C1C1E] text-[#FACC15] font-bold text-sm shadow-lg hover:bg-gray-800 active:scale-[0.97] transition-all shrink-0">
                  <Pencil size={14}/> Edit
                </button>
              </div>
            ) : (
              /* ── 편집 상태: Complete Workout 버튼 ── */
              <button onClick={handleSaveWorkouts}
                className="w-full bg-[#1C1C1E] text-[#FACC15] font-bold text-lg py-3.5 lg:py-4 rounded-2xl shadow-xl flex justify-center items-center gap-2 hover:bg-gray-800 active:scale-[0.98] transition-all">
                <Save size={20}/> Complete Workout
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 shrink-0">
          {/* 캘린더 — 모바일: 가로 스크롤 주간 배너 / 데스크탑: 월간 그리드 */}
          <div className={`flex-1 rounded-[24px] lg:rounded-[32px] shadow-sm p-4 lg:p-6 flex flex-col transition-colors ${theme.card}`}>
            {/* 공통 헤더 */}
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-heading text-base font-bold tabular-nums">
                {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
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
                            ? 'bg-[#FACC15] text-[#1C1C1E]'
                            : isTodayCell
                              ? `ring-2 ring-[#FACC15] ${theme.input}`
                              : theme.input}`}>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-[#1C1C1E]' : theme.textMuted}`}>
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
                        ${isSelected ? 'bg-[#FACC15] text-[#1C1C1E] shadow-md'
                          : isTodayCell ? `ring-2 ring-[#FACC15] ${theme.hoverBg}`
                          : theme.hoverBg}`}>
                        {day}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* InBody */}
          <div className={`flex-1 rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col justify-between transition-colors gap-3 lg:gap-0 ${theme.card}`}>
            <div className="flex justify-between items-center mb-2 lg:mb-4">
              <h2 className="font-heading text-lg font-bold flex items-center gap-2"><Target size={18} className="text-[#FACC15]"/> InBody</h2>
              <button onClick={handleSaveInbody} className="text-xs font-bold bg-[#1C1C1E] text-[#FACC15] px-3.5 py-2 rounded-xl hover:bg-gray-800 transition-colors">Save</button>
            </div>
            {[
              { label: 'Weight', field: 'weight' as const, unit: 'kg', color: 'text-blue-500' },
              { label: 'SMM',    field: 'smm'    as const, unit: 'kg', color: 'text-green-500' },
              { label: 'PBF',    field: 'pbf'    as const, unit: '%',  color: 'text-red-500' },
            ].map(({ label, field, unit, color }) => (
              <div key={field} className={`rounded-2xl p-3 flex justify-between items-center border-2 border-transparent focus-within:border-[#FACC15] transition-colors ${theme.input}`}>
                <div>
                  <p className={`text-xs font-semibold ml-1 ${theme.textMuted}`}>{label}</p>
                  <div className="flex items-end gap-1">
                    <input type="number" inputMode="decimal" min="0" step="0.1" value={localInbody[field] !== 0 ? localInbody[field] : ''} placeholder="0"
                      onChange={e => { setIsInbodyDirty(true); setLocalInbody(prev => ({ ...prev, [field]: Number(e.target.value) })); }}
                      className="w-16 bg-transparent text-xl font-bold outline-none ml-1"/>
                    <span className={`text-sm font-semibold mb-1 ${theme.textMuted}`}>{unit}</span>
                  </div>
                </div>
                <Activity size={20} className={`${color} mr-2`}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── 블록 생성/수정 모달 ── */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowBlockModal(false)}>
          <div className={`p-6 lg:p-8 rounded-[32px] w-full max-w-[380px] shadow-2xl ${theme.card}`} onClick={e => e.stopPropagation()}>
            <h3 className="font-heading text-xl font-bold mb-6 flex justify-between items-center">
              {editingBlock ? 'Edit Block' : 'New Block'}
              <button onClick={() => setShowBlockModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={18}/></button>
            </h3>

            {/* 이름 */}
            <input autoFocus type="text" value={newBlock.name ?? ''} placeholder="Exercise Name"
              onChange={e => setNewBlock({ ...newBlock, name: e.target.value })}
              onKeyDown={e => e.key === 'Enter' && handleSaveBlock()}
              className={`w-full p-4 rounded-2xl mb-4 outline-none focus:ring-2 focus:ring-[#FACC15] font-semibold text-base ${theme.input}`}/>

            {/* 타입 */}
            <select value={newBlock.type ?? 'strength'} onChange={e => setNewBlock({ ...newBlock, type: e.target.value })}
              className={`w-full p-4 rounded-2xl mb-4 outline-none font-semibold text-base ${theme.input}`}>
              <option value="strength">Strength</option>
              <option value="bodyweight">Bodyweight</option>
              <option value="cardio">Cardio</option>
            </select>

            {/* 태그 입력 */}
            <div className={`rounded-2xl p-3 mb-2 ${theme.input}`}>
              <p className={`text-xs font-bold mb-2 ${theme.textMuted}`}>Tags (Enter or comma to add)</p>
              {/* 등록된 태그 */}
              {(newBlock.tags ?? []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {(newBlock.tags ?? []).map(tag => (
                    <span key={tag} className="flex items-center gap-1 text-xs font-bold bg-[#FACC15] text-[#1C1C1E] px-2.5 py-1 rounded-lg">
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
                placeholder="e.g. chest, push, upper"
                onChange={e => {
                  const val = e.target.value;
                  if (val.endsWith(',')) {
                    const t = val.slice(0, -1).trim();
                    if (t && !(newBlock.tags ?? []).includes(t))
                      setNewBlock(b => ({ ...b, tags: [...(b.tags ?? []), t] }));
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
            <p className={`text-[11px] mb-4 ${theme.textMuted}`}>Tap a block to add to today's workout. Use tags to filter blocks.</p>

            <button onClick={handleSaveBlock} className="w-full bg-[#1C1C1E] text-[#FACC15] p-4 rounded-2xl font-bold text-lg hover:bg-gray-800 transition-colors">
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
                  <h3 className="font-heading text-xl font-bold">Assemble {activeDayForm}</h3>
                  <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{tempRoutineBlocks.length} selected · tap to toggle</p>
                </div>
                <button onClick={() => setShowAssembleModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={18}/></button>
              </div>

              {/* 선택된 순서 미리보기 */}
              {tempRoutineBlocks.length > 0 && (
                <div className={`mb-4 p-3 rounded-2xl shrink-0 ${appSettings.darkMode ? 'bg-[#1C1C1E]' : 'bg-gray-50'}`}>
                  <p className={`text-[11px] font-bold mb-2 ${theme.textMuted}`}>ORDER (drag to reorder)</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tempRoutineBlocks.map((id, idx) => {
                      const b = (healthBlocks || []).find((bk: ExerciseBlock) => bk.id === id);
                      return b ? (
                        <span key={id} className="flex items-center gap-1 bg-[#FACC15] text-[#1C1C1E] text-xs font-bold px-2.5 py-1 rounded-lg">
                          <span className="opacity-60 text-[10px]">{idx + 1}</span> {b.name}
                        </span>
                      ) : null;
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
                                ? 'border-[#FACC15] bg-[#FACC15] text-[#1C1C1E]'
                                : `border-transparent ${theme.input} hover:border-[#FACC15]/50`}`}>
                            {b.name}
                            {sel && (
                              <span className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-[#1C1C1E] text-[#FACC15] text-[10px] font-black rounded-full flex items-center justify-center">
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

              <button onClick={handleSaveRoutine} className="mt-5 shrink-0 w-full bg-[#1C1C1E] text-[#FACC15] font-bold text-lg p-4 rounded-2xl hover:bg-gray-800 transition-colors">
                Save Routine
              </button>
            </div>
          </div>
        );
      })()}

      {confirm && <ConfirmModal message={confirm.message} onConfirm={handleConfirm} onCancel={clearConfirm} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}
    </div>
  );
};
