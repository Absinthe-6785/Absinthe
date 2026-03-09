import { useState, useEffect, useMemo, MouseEvent, ChangeEvent } from 'react';
import { Plus, X, Trash2, Save, Dumbbell, Target, Activity, ChevronLeft, ChevronRight } from 'lucide-react';
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

  // isDirty: 사용자가 세트를 편집 중인 상태.
  // true일 때는 SWR 백그라운드 재검증이 localWorkouts를 덮어쓰지 않음.
  // handleSaveWorkouts 성공 후 false로 리셋.
  const [isDirty, setIsDirty] = useState(false);
  const [localWorkouts, setLocalWorkouts] = useState<Workout[]>([]);

  // localWorkouts와 동일 패턴: InBody도 편집 중 SWR 재검증이 덮어쓰지 않도록 보호.
  // revalidateOnFocus(기본 true)가 발생하면 입력 중인 수치가 날아가는 버그 방지.
  const [isInbodyDirty, setIsInbodyDirty] = useState(false);

  // selectedDate가 바뀌면 다른 날짜 데이터를 봐야 하므로 편집 중 상태를 초기화.
  // 개선 전: isDirty=true인 채로 날짜 이동 → 새 날짜 workouts가 fetch돼도
  //          isDirty 가드 때문에 localWorkouts가 갱신되지 않아 이전 날짜 데이터 표시.
  // 개선 후: selectedDate 변경 시 isDirty 즉시 리셋 → workouts useEffect가 정상 동기화.
  useEffect(() => { setIsDirty(false); setIsInbodyDirty(false); }, [selectedDate]);

  useEffect(() => {
    if (!isDirty) setLocalWorkouts(workouts || []);
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
    const existingIds = localWorkouts.map(w => w.block_id);
    const next = [...localWorkouts];
    routine.blocks.forEach((id: string) => {
      if (!existingIds.includes(id)) {
        const b = healthBlocks.find((bk: ExerciseBlock) => bk.id === id);
        if (b) next.push({ id: `temp-${Date.now()}-${b.id}`, block_id: b.id, exercise_blocks: b, sets: [makeDefaultSet(b.type)] });
      }
    });
    setLocalWorkouts(next);
    // 루틴 로드도 localWorkouts를 수정하므로 dirty 플래그 설정
    // 개선 전: 미설정 → SWR 재검증 시 로드한 내용이 덮어씌워짐
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
  const handleAddSet = (wIdx: number) => {
    setIsDirty(true);
    setLocalWorkouts(prev => {
      const next = [...prev];
      const w = { ...next[wIdx] };
      // makeNextSet이 이전 세트의 타입을 보존하며 값을 복사 — as any 불필요
      const last = w.sets[w.sets.length - 1] ?? makeDefaultSet(w.exercise_blocks.type);
      w.sets = [...w.sets, makeNextSet(last)];
      next[wIdx] = w;
      return next;
    });
  };
  const handleUpdateSet = (wIdx: number, sIdx: number, field: Exclude<keyof StrengthSet | keyof CardioSet, 'type' | 'set' | 'pace'>, value: string | number | boolean) => {
    setIsDirty(true);
    setLocalWorkouts(prev => {
      const next = [...prev];
      next[wIdx] = { ...next[wIdx], sets: next[wIdx].sets.map((s, i) => i === sIdx ? { ...s, [field]: value } as WorkoutSet : s) };
      return next;
    });
  };
  const handleSaveWorkouts = async () => {
    // 빈 배열 guard: localWorkouts가 없으면 allSettled([])가 즉시 fulfilled=[]를 반환해
    // failed === 0 → "Workout Saved!" 오표시. 저장할 항목이 없으면 early return.
    if (localWorkouts.length === 0) return showToast('No workouts to save', 'error');

    // Promise.allSettled → 개별 성공/실패를 확인해 정확한 피드백 제공.
    // 개선 전: authFetch는 4xx/5xx에서도 Response를 반환(throw 안 함) →
    //          allSettled가 항상 fulfilled로 분류 → failed === 0 → "Workout Saved!" 오표시.
    // 개선 후: .then(res => { if (!res.ok) throw }) 로 HTTP 오류를 reject로 변환.
    const results = await Promise.allSettled(
      localWorkouts.map(w =>
        authFetch(`${API_URL}/api/workouts`, {
          method: 'POST',
          body: JSON.stringify({ date: formatDate(selectedDate), block_id: w.block_id, sets: w.sets }),
        }).then(res => {
          if (!res.ok) throw new Error(`[${res.status}]`);
          return res;
        })
      )
    );
    const failed = results.filter(r => r.status === 'rejected').length;
    if (failed === 0) {
      showToast('Workout Saved! 💪');
      setIsDirty(false); // 저장 완료 → SWR 재검증 허용
      mutateDaily();
    } else if (failed < results.length) {
      showToast(`${results.length - failed}/${results.length} saved. Some failed.`, 'error');
      setIsDirty(false); // 부분 성공도 저장 완료 → 재시도 시 중복 전송 방지
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
      <div className="lg:flex-[3.5] flex flex-col gap-4 lg:gap-5 shrink-0">
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
          {/* 태그 필터 바 */}
          {(() => {
            const allTags = Array.from(new Set((healthBlocks ?? []).flatMap((b: ExerciseBlock) => b.tags ?? [])));
            const filtered = activeTagFilter
              ? (healthBlocks ?? []).filter((b: ExerciseBlock) => (b.tags ?? []).includes(activeTagFilter))
              : (healthBlocks ?? []);
            return (
              <>
                {allTags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mb-3 shrink-0">
                    <button
                      onClick={() => setActiveTagFilter(null)}
                      className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors
                        ${activeTagFilter === null ? 'bg-[#FACC15] text-[#1C1C1E]' : `${theme.input} ${theme.textMuted}`}`}>
                      All
                    </button>
                    {allTags.map(tag => (
                      <button key={tag}
                        onClick={() => setActiveTagFilter(activeTagFilter === tag ? null : tag)}
                        className={`text-xs font-bold px-2.5 py-1 rounded-lg transition-colors
                          ${activeTagFilter === tag ? 'bg-[#FACC15] text-[#1C1C1E]' : `${theme.input} ${theme.textMuted}`}`}>
                        #{tag}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 overflow-y-auto min-h-0 pr-1 pb-2 content-start">
                  {filtered.length === 0 && <EmptyState theme={theme} onClick={() => openBlockModal()} icon={Dumbbell} text="Create exercise blocks"/>}
                  {filtered.map((b: ExerciseBlock) => (
                    <div key={b.id} onClick={() => handleAddWorkoutToToday(b)}
                      className={`group relative text-sm font-semibold px-3.5 py-2.5 rounded-xl border border-transparent hover:border-[#FACC15] active:border-[#FACC15] cursor-pointer flex flex-col gap-0.5 transition-colors ${theme.input}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${b.type === 'strength' ? 'bg-blue-500' : b.type === 'bodyweight' ? 'bg-purple-500' : 'bg-green-500'}`}/>
                        <span className="truncate max-w-[100px]">{b.name}</span>
                      </div>
                      {(b.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 pl-4">
                          {(b.tags ?? []).map(tag => (
                            <span key={tag} className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${theme.card} opacity-70`}>#{tag}</span>
                          ))}
                        </div>
                      )}
                      {/* 수정 버튼 */}
                      <button onClick={e => { e.stopPropagation(); openBlockModal(b); }}
                        className={`absolute -top-1.5 -left-1.5 bg-blue-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 active:scale-90 transition-all`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      </button>
                      {/* 삭제 버튼 */}
                      <button onClick={e => handleDeleteBlock(b.id, e)}
                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 active:scale-90 transition-all">
                        <X size={10}/>
                      </button>
                    </div>
                  ))}
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
      <div className={`flex-1 lg:flex-[6.5] flex-col gap-4 lg:gap-5 min-h-0 shrink-0 ${mobileHealthTab === 'workout' ? 'flex' : 'hidden lg:flex'}`}>
        <div className={`flex-[1.8] rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col overflow-hidden relative transition-colors ${theme.card}`}>
          <div className={`flex justify-between items-center mb-5 border-b pb-5 ${theme.border}`}>
            <div>
              <h2 className="font-heading text-2xl font-bold">Today's Workout</h2>
              <p className={`text-sm font-medium mt-1 ${theme.textMuted}`}>
                {selectedDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
              </p>
            </div>
            <select onChange={handleLoadRoutine}
              className="bg-[#1C1C1E] text-[#FACC15] font-bold text-sm lg:text-base px-4 lg:px-5 py-2 lg:py-3 rounded-xl outline-none cursor-pointer shadow-md">
              <option>Load Routine</option>
              {Array.from({ length: splitCount }).map((_, i) => <option key={i} value={`Day ${i + 1}`}>Load Day {i + 1}</option>)}
            </select>
          </div>

          <div className="flex-1 overflow-y-auto space-y-5 pb-24 pr-2">
            {localWorkouts.length === 0 && <EmptyState theme={theme} icon={Dumbbell} text="No workouts added. Let's get moving!"/>}
            {localWorkouts.map((w: Workout, wIdx: number) => (
              <div key={w.id} className={`border rounded-3xl p-5 relative group shadow-sm ${theme.border}`}>
                <button onClick={() => handleRemoveWorkout(wIdx, w.id)}
                  className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-red-500 active:scale-95 transition-colors">
                  <Trash2 size={18}/>
                </button>
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${w.exercise_blocks?.type === 'cardio' ? 'bg-green-500' : w.exercise_blocks?.type === 'bodyweight' ? 'bg-purple-500' : 'bg-blue-500'}`}/>
                  <h3 className="font-heading text-lg font-bold">{w.exercise_blocks?.name || 'Unknown'}</h3>
                </div>
                <div className="space-y-2">
                  {(w.sets || []).map((s: WorkoutSet, sIdx: number) => (
                    <div key={sIdx} className={`flex gap-2 px-3 py-3 rounded-xl items-center transition-opacity ${s.done ? 'opacity-40' : theme.input}`}>
                      <div className={`w-7 text-sm font-bold text-center shrink-0 ${theme.textMuted}`}>{sIdx + 1}</div>
                      {isStrengthSet(s) && (
                        <input type="number" inputMode="decimal" min="0" step="0.5" value={s.kg} placeholder="kg"
                          onChange={e => handleUpdateSet(wIdx, sIdx, 'kg', e.target.value)}
                          className={`flex-1 text-base font-semibold text-center rounded-lg py-2 outline-none shadow-sm focus:ring-2 focus:ring-[#FACC15] ${theme.card}`}/>
                      )}
                      {isCardioSet(s) ? (
                        <>
                          <input type="text" inputMode="numeric" value={s.time} placeholder="time"
                            onChange={e => handleUpdateSet(wIdx, sIdx, 'time', e.target.value)}
                            className={`flex-1 text-base font-semibold text-center rounded-lg py-2 outline-none shadow-sm focus:ring-2 focus:ring-[#FACC15] ${theme.card}`}/>
                          <input type="text" inputMode="decimal" value={s.distance} placeholder="km"
                            onChange={e => handleUpdateSet(wIdx, sIdx, 'distance', e.target.value)}
                            className={`flex-1 text-base font-semibold text-center rounded-lg py-2 outline-none shadow-sm focus:ring-2 focus:ring-[#FACC15] ${theme.card}`}/>
                        </>
                      ) : isStrengthSet(s) ? (
                        <input type="number" inputMode="numeric" min="0" value={s.reps} placeholder="reps"
                          onChange={e => handleUpdateSet(wIdx, sIdx, 'reps', e.target.value)}
                          className={`flex-1 text-base font-semibold text-center rounded-lg py-2 outline-none shadow-sm focus:ring-2 focus:ring-[#FACC15] ${theme.card}`}/>
                      ) : null}
                      <div className="w-8 flex justify-center shrink-0">
                        <input type="checkbox" checked={s.done} onChange={e => handleUpdateSet(wIdx, sIdx, 'done', e.target.checked)} className="w-6 h-6 accent-[#FACC15] cursor-pointer"/>
                      </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => handleAddSet(wIdx)} className="mt-4 w-full text-sm font-bold py-2.5 rounded-xl bg-[#FACC15] text-[#1C1C1E] opacity-90 hover:opacity-100 transition-colors">
                  + Add Set
                </button>
              </div>
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-5 lg:p-6 pt-10"
            style={{ backgroundImage: `linear-gradient(to top, ${appSettings.darkMode ? '#2C2C2E' : '#ffffff'} 60%, transparent)` }}>
            <button onClick={handleSaveWorkouts} className="w-full bg-[#1C1C1E] text-[#FACC15] font-bold text-lg py-3.5 lg:py-4 rounded-2xl shadow-xl flex justify-center items-center gap-2 hover:bg-gray-800 transition-colors">
              <Save size={20}/> Complete Workout
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-4 lg:gap-5 shrink-0">
          {/* 캘린더 */}
          <div className={`flex-1 rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card}`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-heading text-base font-bold tabular-nums">
                {currentDate.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
              </h2>
              <div className="flex gap-1">
                <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className={`p-1 rounded-full ${theme.hoverBg}`}><ChevronLeft size={16}/></button>
                <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className={`p-1 rounded-full ${theme.hoverBg}`}><ChevronRight size={16}/></button>
              </div>
            </div>
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
      {showAssembleModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowAssembleModal(false)}>
          <div className={`rounded-[32px] p-6 lg:p-8 w-full max-w-[400px] shadow-2xl ${theme.card}`} onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-heading text-xl font-bold">Assemble {activeDayForm}</h3>
              <button onClick={() => setShowAssembleModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={18}/></button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-[300px] overflow-y-auto mb-6">
              {(healthBlocks || []).map((b: ExerciseBlock) => {
                const sel = tempRoutineBlocks.includes(b.id);
                return (
                  <div key={b.id} onClick={() => toggleBlockInRoutine(b.id)}
                    className={`text-sm font-semibold px-4 py-2.5 rounded-xl border-2 cursor-pointer transition-all
                      ${sel ? 'border-[#FACC15] bg-[#FEFCE8] text-[#1C1C1E]' : `border-transparent ${theme.input} hover:border-[#FACC15]/50`}`}>
                    {b.name}
                  </div>
                );
              })}
            </div>
            <button onClick={handleSaveRoutine} className="w-full bg-[#1C1C1E] text-[#FACC15] font-bold text-lg p-4 rounded-2xl hover:bg-gray-800 transition-colors">Save</button>
          </div>
        </div>
      )}

      {confirm && <ConfirmModal message={confirm.message} onConfirm={handleConfirm} onCancel={clearConfirm} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}
    </div>
  );
};
