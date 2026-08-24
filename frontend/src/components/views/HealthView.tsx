import { useState, useEffect, useMemo, useRef, useCallback, MouseEvent, ChangeEvent, TouchEvent } from 'react';
import { Plus, X, Trash2, Save, Dumbbell, Activity, ChevronLeft, ChevronRight, Lock, Pencil, GripVertical, Loader2, ClipboardCopy, Check, FileText, MoreHorizontal } from 'lucide-react';
import { authFetch } from '../../lib/supabase';
import { API_URL } from '../../lib/config';
import { useConfirm } from '../../hooks/useConfirm';
import { useAppStore } from '../../store/useAppStore';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { useApiMutation } from '../../hooks/useApiMutation';
import { ConfirmModal } from '../common/ConfirmModal';
import { WorkspaceCardSkeleton } from '../common/WorkspaceCardSkeleton';
import { WorkspaceErrorBoundary } from '../common/WorkspaceErrorBoundary';
import { WorkspacePageHeader } from '../common/WorkspacePageHeader';
import { WorkspaceToolbar, WorkspaceToolbarPrimary } from '../common/WorkspaceToolbar';
import { WORKSPACE_GAP_CLASS } from '../../lib/uiSpacingTokens';
import { UI_INTERACTION } from '../../lib/uiInteractionTokens';
import { UI_SPACING } from '../../lib/uiSpacingTokens';
import { useTranslation } from '../../lib/i18n';
import { useIsMobile } from '../../hooks/useIsMobile';
import { useSwipeNavigation } from '../../hooks/useSwipeNavigation';
import { useNotesStore } from '../../store/useNotesStore';
import { openHealthDayNote, openNote, openWorkspaceSearch, switchToTab } from '../../lib/noteNavigation';
import { registerSearchDomainHandlers } from './features/search/searchDomainNavigation';
import { HealthProps, Workout, WorkoutSet, StrengthSet, CardioSet, ExerciseBlock, HealthRoutine, Inbody, Theme,
         isCardioSet, isStrengthSet, makeDefaultSet, makeNextSet } from '../../types';
import { HealthWorkspaceNav, HEALTH_WORKSPACE_SECTIONS, type HealthWorkspaceSection } from './features/health/HealthWorkspaceNav';
import { ProteinTracker } from './features/health/nutrition';
import { getRecoveryEntry } from './features/health/recovery/recoveryNotes';
import { WORKSPACE_CARD, WORKSPACE_CARD_RADIUS_CLASS, WORKSPACE_CARD_SURFACE, WORKSPACE_MODAL_SURFACE } from '../common/workspaceCardSizes';
import { formatAbsoluteDateKey, formatLongDate } from './k102DateFormat';
import { buildHealthProjection } from './features/health/buildHealthProjection';
import type { RangeWorkoutRow } from './features/health/workout/workoutMetrics';
import { computeWorkoutPrBadgeMap } from './features/health/computeWorkoutPrBadge';
import { HealthBlockLibrary } from './features/health/HealthBlockLibrary';
import { HealthSupportingPanels } from './features/health/HealthSupportingPanels';
import { WorkoutPrBadge } from './features/health/WorkoutPrBadge';
import { PreviousWorkoutView } from './features/health/PreviousWorkoutView';
import { PreviousWorkoutSheet } from './features/health/PreviousWorkoutSheet';
import { previousWorkoutSWRConfig } from './features/health/previousWorkoutSWR';
import { HealthMobileSetupNav, type HealthMobileSurface, type HealthSetupSection } from './features/health/HealthMobileSetupNav';
import { HealthMobileWorkoutActions } from './features/health/HealthMobileWorkoutActions';
import {
  normalizePreviousWorkoutRows,
  previousWorkoutRange,
  type PreviousWorkoutHistoryRow,
} from './features/health/previousWorkoutSession';
import { buildPreviousWorkoutHistoryProjection } from './features/health/previousWorkoutProjection';
import { useHealthWorkoutDraft } from './features/health/useHealthWorkoutDraft';
import { readHealthSectionPrefs } from './features/health/healthSectionPrefs';
import { buildSetsFromPlannedCount, buildSetsFromPrevCount } from './features/health/workoutSetCount';
import { fetchPrevWorkoutForBlocks } from './features/health/prevWorkoutFetch';
import {
  formatPreviousBestCue,
  formatPreviousSetReference,
  matchPreviousSetReference,
} from './features/health/previousMicroCue';
import {
  editableWeightValue as editableWeightInput,
  formatCanonicalWeight,
  formatSavedWeight,
  inputToCanonicalKg,
  normalizeStrengthSetForSave,
} from './features/health/healthWeight';
import {
  getRoutinePlannedSetsForDay,
  saveRoutinePlannedSetsForDay,
  showsPlannedSetCount,
} from './features/health/routinePlannedSets';
import {
  DEFAULT_ROUTINE_PRESET_ID,
  createEmptyRoutinePreset,
  createRoutinePresetId,
  createRoutinePresetState,
  readRoutinePresetState,
  routinePresetById,
  routinePresetPlannedSetCount,
  routinePresetToHealthRoutines,
  sanitizeRoutinePresetName,
  syncLegacyDefaultRoutinePreset,
  updateRoutinePresetState,
  writeRoutinePresetState,
  type RoutinePresetState,
} from './features/health/routinePresets';
import { isRoutinePresetMenuOutsideTarget } from './features/health/routinePresetMenu';
import useSWR from 'swr';
import { fetcher } from '../../lib/fetcher';
import { remoteSWRKey } from '../../lib/remoteBoundary';
import { shouldUseRemoteData } from '../../lib/remoteBoundary';
import { createLocalHealthRepository, readLocalHealthWorkoutRange, readLocalPreviousWorkoutRows } from '../../lib/healthLocalRuntime';
import {
  isCurrentHealthAccountGeneration,
  localHealthMemoKey,
  localHealthWriteFailureDisposition,
  type HealthAccountGenerationToken,
} from '../../lib/healthBackfillUiSafety';

type PreviousWorkoutSWRKey =
  | readonly ['local', string, string, string]
  | readonly ['remote', string, string];

export const HealthView = ({
  currentDate, setCurrentDate, selectedDate, setSelectedDate,
  formatDate, isToday, showToast, mutateDaily, mutateStatic,
  schedules, weeklySchedules,
  workouts, healthBlocks, healthRoutines, inbody, theme, appSettings,
  THEME_COLORS, isDailyLoading, user,
}: HealthProps) => {
  const { t, lang } = useTranslation();
  const isMobile = useIsMobile();
  const createNote = useNotesStore(s => s.createNote);
  const updateNote = useNotesStore(s => s.updateNote);
  const notes = useNotesStore(s => s.notes);
  const { mutate: api } = useApiMutation(mutateDaily, mutateStatic, showToast);
  const { weightUnits, toggleWeightUnit } = useAppStore();
  const { confirm, showConfirm, clearConfirm, handleConfirm } = useConfirm();
  const localMode = !shouldUseRemoteData();
  const accountGenerationRef = useRef(0);
  const activeAccountIdRef = useRef(user.id);
  if (activeAccountIdRef.current !== user.id) {
    activeAccountIdRef.current = user.id;
    accountGenerationRef.current += 1;
  }
  const currentAccountOperation = (token: HealthAccountGenerationToken): boolean =>
    isCurrentHealthAccountGeneration(
      token,
      activeAccountIdRef.current,
      accountGenerationRef.current,
    );

  const [legacySplitCount, setLegacySplitCount] = useState<number>(() => {
    const saved = localStorage.getItem('healthSplitCount');
    return saved ? Math.min(7, Math.max(1, Number(saved))) : 3;
  });
  const [splitCountInput, setSplitCountInput] = useState<string>(() => {
    const saved = localStorage.getItem('healthSplitCount');
    return saved ? String(Math.min(7, Math.max(1, Number(saved)))) : '3';
  });
  const [routinePresetState, setRoutinePresetState] = useState<RoutinePresetState>(() => (
    readRoutinePresetState(localStorage, user.id)
      ?? createRoutinePresetState({
        routines: healthRoutines ?? [],
        splitCount: legacySplitCount,
        plannedSetsByDay: Object.fromEntries(
          Array.from({ length: 7 }, (_, index) => {
            const dayName = `Day ${index + 1}`;
            return [dayName, getRoutinePlannedSetsForDay(dayName)];
          }),
        ),
      })
  ));
  const [presetMenuOpen, setPresetMenuOpen] = useState(false);
  const [presetRenameDraft, setPresetRenameDraft] = useState('');
  const presetMenuRef = useRef<HTMLDivElement>(null);
  const activePreset = routinePresetById(routinePresetState);
  const selectedHealthRoutines = useMemo(
    () => routinePresetToHealthRoutines(activePreset),
    [activePreset],
  );
  const splitCount = activePreset.splitCount;
  const [showBlockModal, setShowBlockModal] = useState(false);
  const [newBlock, setNewBlock] = useState<Partial<ExerciseBlock>>({ name: '', type: 'strength', tags: [], cardio_mode: 'both' });
  // editingBlock: 수정 대상 블록 (null이면 신규 생성 모드)
  const [editingBlock, setEditingBlock] = useState<ExerciseBlock | null>(null);
  // tagInput: 태그 입력 중간값 (Enter/쉼표로 확정)
  const [tagInput, setTagInput] = useState('');
  // activeTagFilter: 현재 선택된 태그 필터 (null이면 전체)
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [showAssembleModal, setShowAssembleModal] = useState(false);
  const [activeDayForm, setActiveDayForm] = useState('Day 1');
  const [tempRoutineBlocks, setTempRoutineBlocks] = useState<string[]>([]);
  const [tempRoutineSetCounts, setTempRoutineSetCounts] = useState<Record<string, number>>({});
  // 모바일 전용 탭 상태 — 데스크탑에서는 무시됨
  const [mobileHealthTab, setMobileHealthTab] = useState<HealthMobileSurface | 'previous'>('workout');
  const [setupSection, setSetupSection] = useState<HealthSetupSection>('routine');
  const [showQuickAddExercise, setShowQuickAddExercise] = useState(false);
  const [quickAddQuery, setQuickAddQuery] = useState('');
  const [isPreviousSheetOpen, setIsPreviousSheetOpen] = useState(false);
  const [selectedPreviousDate, setSelectedPreviousDate] = useState<string | null>(null);
  const [healthSection, setHealthSection] = useState<HealthWorkspaceSection>('workout');
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isWorkoutLocked, setIsWorkoutLocked] = useState(false);
  const [workoutOverflowIndex, setWorkoutOverflowIndex] = useState<number | null>(null);
  const inbodyQuickRef = useRef<HTMLDivElement>(null);
  const wasMobileRef = useRef(isMobile);
  const latestWorkoutRecordRef = useRef<HTMLDivElement>(null);
  const pendingLatestWorkoutIndexRef = useRef<number | null>(null);
  const quickCaptureInputRef = useRef<HTMLInputElement | null>(null);
  const pendingFocusSetRef = useRef<{ wIdx: number; sIdx: number } | null>(null);
  const persistRoutinePreset = useCallback((update: (current: RoutinePresetState) => RoutinePresetState) => {
    setRoutinePresetState(current => {
      const next = update(current);
      if (next !== current) writeRoutinePresetState(localStorage, user.id, next);
      return next;
    });
  }, [user.id]);
  const applyRoutinePresetAction = useCallback((action: Parameters<typeof updateRoutinePresetState>[1]) => {
    setRoutinePresetState(current => {
      const next = updateRoutinePresetState(current, action);
      if (next !== current) writeRoutinePresetState(localStorage, user.id, next);
      return next;
    });
  }, [user.id]);

  // Account changes must never reuse another account's selected preset or draft.
  useEffect(() => {
    const persisted = readRoutinePresetState(localStorage, user.id);
    const next = persisted ?? createRoutinePresetState({
      routines: healthRoutines ?? [],
      splitCount: legacySplitCount,
      plannedSetsByDay: Object.fromEntries(
        Array.from({ length: 7 }, (_, index) => {
          const dayName = `Day ${index + 1}`;
          return [dayName, getRoutinePlannedSetsForDay(dayName)];
        }),
      ),
    });
    setRoutinePresetState(next);
    setSplitCountInput(String(routinePresetById(next).splitCount));
    setPresetMenuOpen(false);
    setPresetRenameDraft('');
    setShowAssembleModal(false);
    setActiveDayForm('Day 1');
    setSetupSection('routine');
    setShowQuickAddExercise(false);
    setQuickAddQuery('');
    setTempRoutineBlocks([]);
    setTempRoutineSetCounts({});
    setSelectedPreviousDate(null);
    setIsPreviousSheetOpen(false);
  // Account identity is the reset boundary; the initial static rows are merged below.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  useEffect(() => {
    setMobileHealthTab('workout');
    setSetupSection('routine');
    setShowQuickAddExercise(false);
  }, [user.id]);

  useEffect(() => {
    // The contextual sheet is intentionally mobile-only. Closing it on a
    // responsive transition also prevents a mobile overlay from surviving
    // into the unchanged desktop Today/Previous layout.
    const enteringMobile = isMobile && !wasMobileRef.current;
    if (!isMobile) {
      setIsPreviousSheetOpen(false);
      setShowQuickAddExercise(false);
    } else if (enteringMobile || mobileHealthTab === 'previous') {
      // Desktop may leave the shared toggle on Previous; mobile has no such
      // permanent tab, so return to the mounted Workout surface.
      setMobileHealthTab('workout');
      setSetupSection('routine');
    }
    wasMobileRef.current = isMobile;
  }, [isMobile, mobileHealthTab]);

  useEffect(() => {
    setRoutinePresetState(current => {
      const next = syncLegacyDefaultRoutinePreset(current, {
        routines: healthRoutines ?? [],
        splitCount: legacySplitCount,
        plannedSetsByDay: Object.fromEntries(
          Array.from({ length: 7 }, (_, index) => {
            const dayName = `Day ${index + 1}`;
            return [dayName, getRoutinePlannedSetsForDay(dayName)];
          }),
        ),
      });
      if (next !== current) writeRoutinePresetState(localStorage, user.id, next);
      return next;
    });
  }, [healthRoutines, legacySplitCount, user.id]);

  useEffect(() => {
    if (!presetMenuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (isRoutinePresetMenuOutsideTarget(presetMenuRef.current, event.target)) setPresetMenuOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [presetMenuOpen]);

  useEffect(() => {
    setSplitCountInput(String(activePreset.splitCount));
  }, [activePreset.id, activePreset.splitCount]);

  // ── 날짜별 메모 ───────────────────────────────────────────────────────
  const [workoutMemo, setWorkoutMemo] = useState('');
  // ── 이전 세션 데이터 / PR — block_id 키로 캐시 ───────────────────────
  const [prevData, setPrevData] = useState<Record<string, {
    prev_sets: WorkoutSet[];
    prev_date: string | null;
    pr_kg: number | null;
  }>>({});
  const prevDataRef = useRef(prevData);
  useEffect(() => { prevDataRef.current = prevData; }, [prevData]);

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
          const displayVal = isStrengthSet(s) ? formatSavedWeight(s, unit) : '';
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
  const [localInbody, setLocalInbody] = useState<Inbody>({
    weight: null,
    smm: null,
    pbf: null,
    local_version: null,
  });
  const [healthSectionPrefs] = useState(() => readHealthSectionPrefs());

  // weightUnits: zustand store persist
  const getUnit = (blockId: string): 'kg' | 'lbs' => weightUnits[blockId] ?? 'kg';
  const displayKg = (kg: number | string, blockId: string): string =>
    formatCanonicalWeight(kg, getUnit(blockId));

  // ── Draft 자동 저장/복원 ──────────────────────────────────────────
  const selectedDateDraftKey = formatDate(selectedDate);
  const memoKey = localHealthMemoKey(user.id, selectedDateDraftKey);

  // selectedDate 변경 시 메모도 localStorage에서 복원
  useEffect(() => {
    const stored = localStorage.getItem(memoKey) ?? '';
    const recovery = getRecoveryEntry(formatDate(selectedDate));
    const recoveryText = recovery?.restDayNote?.trim() || recovery?.note?.trim() || '';
    setWorkoutMemo(stored || recoveryText);
    setPrevData({});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, user.id, memoKey]);

  const {
    localWorkouts,
    setLocalWorkouts,
    isDirty,
    setIsDirty,
    isDirtyRef,
    rawKgInput,
    setRawKgInput,
    replaceFromHydration,
    clearStoredDraft,
    clearDirtyAfterSave,
  } = useHealthWorkoutDraft({
    accountId: user.id,
    dateKey: selectedDateDraftKey,
    onDraftRestored: () => showToast(t('draftRestored')),
  });

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

  const ensurePrevData = useCallback(async (blockIds: readonly string[], source: string) => {
    const missing = [...new Set(blockIds.filter(id => id && id !== '__session__'))]
      .filter(id => prevDataRef.current[id] === undefined);
    if (missing.length === 0) return;
    const fetched = await fetchPrevWorkoutForBlocks(missing, formatDate(selectedDate), source, user.id);
    if (Object.keys(fetched).length > 0) {
      setPrevData(prev => ({ ...prev, ...fetched }));
    }
  }, [formatDate, selectedDate, user.id]);

  // localWorkouts가 세팅될 때 각 블록의 이전 세션 + PR fetch (max 4 concurrent)
  useEffect(() => {
    const ids = localWorkouts
      .filter(w => w.block_id !== '__session__')
      .map(w => w.block_id);
    if (ids.length === 0) return;
    void ensurePrevData(ids, 'HealthView.localWorkouts');
  }, [localWorkouts, ensurePrevData]);

  const fetchPrevForBlock = useCallback(async (blockId: string) => {
    if (prevData[blockId]?.prev_sets) return prevData[blockId].prev_sets;
    const result = await fetchPrevWorkoutForBlocks(
      [blockId],
      formatDate(selectedDate),
      'HealthView.fetchPrevForBlock',
      user.id,
    );
    const data = result[blockId];
    if (!data) return undefined;
    setPrevData(prev => ({ ...prev, [blockId]: data }));
    return data.prev_sets;
  }, [prevData, selectedDate, formatDate, user.id]);

  useEffect(() => {
    if (!selectedHealthRoutines.length) return;
    const ids = selectedHealthRoutines.flatMap((r: HealthRoutine) => r.blocks);
    void ensurePrevData(ids, 'HealthView.selectedRoutinePreset');
  }, [selectedHealthRoutines, ensurePrevData]);

  // selectedDate 변경 시에도 lock/save/InBody 정책은 HealthView가 소유한다.
  // Draft/input reset and hydration remain inside useHealthWorkoutDraft.
  useEffect(() => {
    setIsWorkoutLocked(false);
    setIsSaving(false);
    setIsInbodyDirty(false);
    setLocalInbody({ weight: null, smm: null, pbf: null, local_version: null });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate, user.id, selectedDateDraftKey]);

  // workouts(SWR)가 갱신될 때 isDirtyRef로 판단 → draft 복원 직후 덮어쓰기 방지
  useEffect(() => {
    if (!isDirtyRef.current) {
      const sorted = [...(workouts || [])].sort((a, b) => {
        const ao = a.sort_order ?? 9999;
        const bo = b.sort_order ?? 9999;
        return ao - bo;
      });
      replaceFromHydration(sorted);
      setIsWorkoutLocked(sorted.length > 0);
    }
  }, [replaceFromHydration, workouts]);

  useEffect(() => {
    if (!isInbodyDirty)
      setLocalInbody({
        weight: inbody?.weight ?? null,
        smm: inbody?.smm ?? null,
        pbf: inbody?.pbf ?? null,
        local_version: inbody?.local_version ?? null,
      });
  }, [inbody, isInbodyDirty]);

  useEscapeKey(() => {
    setShowBlockModal(false);
    setShowAssembleModal(false);
    setShowQuickAddExercise(false);
    setQuickAddQuery('');
    setPresetMenuOpen(false);
    clearConfirm();
  });

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
    showConfirm(t('deleteBlock'), () => {
      void api('DELETE', `/api/blocks/${id}`, undefined, { revalidate: 'static', successMsg: t('blockDeleted') });
    },
      { confirmLabel: t('deleteLabel') },
    );
  };

  // ── 루틴 조합 ──────────────────────────────────────────────────────
  const openAssembleModal = (dayName: string) => {
    setActiveDayForm(dayName);
    const existing = selectedHealthRoutines.find((r: HealthRoutine) => r.day_name === dayName);
    setTempRoutineBlocks(existing?.blocks ?? []);
    const selectedDay = activePreset.days.find(day => day.dayName === dayName);
    setTempRoutineSetCounts({
      ...(selectedDay?.plannedSets ?? {}),
      ...(selectedDay ? {} : getRoutinePlannedSetsForDay(dayName)),
    });
    setShowAssembleModal(true);
  };
  const toggleBlockInRoutine = (blockId: string) => {
    setTempRoutineBlocks(prev => {
      if (prev.includes(blockId)) {
        setTempRoutineSetCounts(counts => {
          const next = { ...counts };
          delete next[blockId];
          return next;
        });
        return prev.filter(id => id !== blockId);
      }
      const b = healthBlocks.find((bk: ExerciseBlock) => bk.id === blockId);
      if (b) {
        setTempRoutineSetCounts(counts => ({
          ...counts,
          [blockId]: routinePresetPlannedSetCount(activePreset, activeDayForm, blockId, b.type, prevData[blockId]?.prev_sets),
        }));
      }
      return [...prev, blockId];
    });
  };
  const handleSaveRoutine = async () => {
    const accountOperation: HealthAccountGenerationToken = {
      accountId: user.id,
      generation: accountGenerationRef.current,
    };
    const existingRoutineId = activePreset.days.find(day => day.dayName === activeDayForm)?.legacyRoutineId;
    let ok = true;
    if (activePreset.id === DEFAULT_ROUTINE_PRESET_ID) {
      if (localMode) {
        try {
          const repository = await createLocalHealthRepository(accountOperation.accountId);
          await repository.saveRoutine({
            id: existingRoutineId,
            dayName: activeDayForm,
            blocks: [...tempRoutineBlocks],
          });
          if (!currentAccountOperation(accountOperation)) return;
          mutateStatic?.();
          showToast(t('routineSaved'));
        } catch {
          ok = false;
          showToast(t('routineSaveFailed'), 'error');
        }
      } else {
        ok = await api(
          'POST',
          '/api/health_routines',
          { day_name: activeDayForm, blocks: tempRoutineBlocks },
          { revalidate: 'static', successMsg: t('routineSaved') },
        );
      }
    }
    if (!ok || !currentAccountOperation(accountOperation)) return;
    persistRoutinePreset(current => updateRoutinePresetState(current, {
      type: 'set-day',
      presetId: activePreset.id,
      dayName: activeDayForm,
      blocks: tempRoutineBlocks,
      plannedSets: tempRoutineSetCounts,
    }));
    if (activePreset.id !== DEFAULT_ROUTINE_PRESET_ID) showToast(t('routineSaved'));
    if (activePreset.id === DEFAULT_ROUTINE_PRESET_ID) {
      // Keep the existing legacy export keys in sync for old recovery packages.
      saveRoutinePlannedSetsForDay(activeDayForm, tempRoutineBlocks, tempRoutineSetCounts);
    }
    setShowAssembleModal(false);
  };

  // ── 워크아웃 로컬 조작 ─────────────────────────────────────────────
  const handleLoadRoutine = async (e: ChangeEvent<HTMLSelectElement>) => {
    const dayName = e.target.value;
    if (!dayName || dayName === '__load__') return;
    const routine = selectedHealthRoutines.find((r: HealthRoutine) => r.day_name === dayName);
    if (!routine?.blocks?.length) { showToast(t('noBlocks'), 'error'); e.target.value = '__load__'; return; }

    const routineOrdered: Workout[] = [];
    for (const id of routine.blocks) {
      const existing = localWorkouts.find(w => w.block_id === id);
      if (existing) {
        routineOrdered.push(existing);
        continue;
      }
      const b = healthBlocks.find((bk: ExerciseBlock) => bk.id === id);
      if (!b) continue;
      const prevSets = await fetchPrevForBlock(id);
      const count = routinePresetPlannedSetCount(activePreset, dayName, id, b.type, prevSets);
      routineOrdered.push({
        id: `temp-${Date.now()}-${b.id}`,
        block_id: b.id,
        exercise_blocks: b,
        sets: buildSetsFromPlannedCount(b.type, count),
      });
    }

    const unrelated = localWorkouts.filter(w => !routine.blocks.includes(w.block_id));
    setLocalWorkouts([...routineOrdered, ...unrelated]);
    setIsDirty(true);
    e.target.value = '__load__';
    showToast(t('loaded'));
  };

  const commitPresetSplit = () => {
    const nextSplit = Math.min(7, Math.max(1, Number(splitCountInput) || 1));
    applyRoutinePresetAction({ type: 'set-split', presetId: activePreset.id, splitCount: nextSplit });
    setSplitCountInput(String(nextSplit));
    if (activePreset.id === DEFAULT_ROUTINE_PRESET_ID) {
      setLegacySplitCount(nextSplit);
      localStorage.setItem('healthSplitCount', String(nextSplit));
    }
  };

  const handleCreatePreset = () => {
    applyRoutinePresetAction({
      type: 'create',
      preset: createEmptyRoutinePreset(createRoutinePresetId(), t('healthPresetNew')),
    });
    setPresetMenuOpen(false);
  };

  const handleDuplicatePreset = () => {
    const duplicate = {
      ...activePreset,
      id: createRoutinePresetId(),
      name: sanitizeRoutinePresetName(`${activePreset.name} ${t('healthPresetCopySuffix')}`),
      days: activePreset.days.map(day => ({
        ...day,
        blocks: [...day.blocks],
        plannedSets: { ...day.plannedSets },
        legacyRoutineId: undefined,
      })),
    };
    applyRoutinePresetAction({
      type: 'duplicate',
      sourcePresetId: activePreset.id,
      preset: duplicate,
    });
    setPresetMenuOpen(false);
  };

  const beginPresetRename = () => {
    setPresetRenameDraft(activePreset.name);
    setPresetMenuOpen(true);
  };

  const commitPresetRename = () => {
    const nextName = presetRenameDraft.trim();
    if (!nextName) {
      showToast(t('healthPresetNameRequired'), 'error');
      return;
    }
    applyRoutinePresetAction({ type: 'rename', presetId: activePreset.id, name: sanitizeRoutinePresetName(nextName, activePreset.name) });
    setPresetRenameDraft('');
    setPresetMenuOpen(false);
  };

  const handleDeletePreset = () => {
    if (routinePresetState.presets.length <= 1) {
      showToast(t('healthPresetLastCannotDelete'), 'error');
      return;
    }
    if (activePreset.id === DEFAULT_ROUTINE_PRESET_ID) {
      showToast(t('healthPresetDefaultCannotDelete'), 'error');
      return;
    }
    showConfirm(
      t('healthPresetDeleteConfirm').replace('{name}', activePreset.name),
      () => applyRoutinePresetAction({ type: 'delete', presetId: activePreset.id }),
      { confirmLabel: t('deleteLabel') },
    );
    setPresetMenuOpen(false);
  };

  const handleAddWorkoutToToday = async (block: ExerciseBlock) => {
    if (localWorkouts.find(w => w.block_id === block.id)) return showToast(t('alreadyAdded'), 'error');
    const prevSets = await fetchPrevForBlock(block.id);
    setIsDirty(true);
    pendingLatestWorkoutIndexRef.current = localWorkouts.length;
    setLocalWorkouts([...localWorkouts, {
      id: `temp-${Date.now()}`,
      block_id: block.id,
      exercise_blocks: block,
      sets: buildSetsFromPrevCount(block.type, prevSets),
    }]);
  };

  const handleQuickPresetChange = (presetId: string) => {
    applyRoutinePresetAction({ type: 'switch', presetId });
    const nextPreset = routinePresetById(routinePresetState, presetId);
    const currentDayNumber = Number(activeDayForm.replace('Day ', ''));
    setActiveDayForm(currentDayNumber >= 1 && currentDayNumber <= nextPreset.splitCount ? activeDayForm : 'Day 1');
  };

  const quickAddBlocks = useMemo(() => {
    const query = quickAddQuery.trim().toLowerCase();
    return (healthBlocks ?? []).filter(block => !query
      || [block.name, ...(block.tags ?? [])].join(' ').toLowerCase().includes(query));
  }, [healthBlocks, quickAddQuery]);

  // ── 세션 구분선 ───────────────────────────────────────────────────
  const SESSION_KEYS = ['sessionMorning', 'sessionAfternoon', 'sessionEvening'] as const;
  const handleAddSessionBreak = (labelKey: typeof SESSION_KEYS[number]) => {
    const label = t(labelKey);
    setIsDirty(true);
    pendingLatestWorkoutIndexRef.current = localWorkouts.length;
    setLocalWorkouts(prev => [...prev, {
      id: `session-${Date.now()}`,
      block_id: '__session__',
      exercise_blocks: { id: '__session__', name: label, type: 'strength', tags: [] } as ExerciseBlock,
      sets: [],
    }]);
  };

  const handleRemoveWorkout = async (index: number, dbId: string) => {
    const accountOperation: HealthAccountGenerationToken = {
      accountId: user.id,
      generation: accountGenerationRef.current,
    };
    try {
      // 세션 구분선은 DB에 없으므로 API 호출 없이 바로 제거
      if (dbId !== 'session' && !dbId.startsWith('session-') && !dbId.startsWith('temp')) {
        if (localMode) {
          const expectedVersion = localWorkouts[index]?.local_version;
          if (!expectedVersion) throw new Error('health_local_workout_expected_version_missing');
          const repository = await createLocalHealthRepository(accountOperation.accountId);
          if (!currentAccountOperation(accountOperation)) return;
          await repository.deleteWorkout(dbId, expectedVersion);
          if (!currentAccountOperation(accountOperation)) return;
          mutateDaily();
          mutateMonthWorkoutRows();
          mutateStatic();
        } else {
        const res = await authFetch(`${API_URL}/api/workouts/${dbId}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`[${res.status}]`);
        // DB 삭제 성공 즉시 mutateDaily → SWR 캐시도 동기화.
        mutateDaily();
        }
      }
      const next = localWorkouts.filter((_, i) => i !== index);
      if (!currentAccountOperation(accountOperation)) return;
      setLocalWorkouts(next);
      if (next.length === 0) { setIsDirty(false); clearStoredDraft(); }
    } catch (error) {
      if (!currentAccountOperation(accountOperation)) return;
      const failure = localHealthWriteFailureDisposition(error);
      showToast(t(failure.kind === 'conflict' ? 'healthWriteConflict' : 'failedRemove'), 'error');
    }
  };
  const handleAddSet = (wIdx: number, asDropset = false) => {
    if (isWorkoutLocked) return;
    setIsDirty(true);
    pendingLatestWorkoutIndexRef.current = wIdx;
    pendingFocusSetRef.current = { wIdx, sIdx: localWorkouts[wIdx]?.sets.length ?? 0 };
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
  const handleCompleteSetAndAdd = (wIdx: number, sIdx: number) => {
    if (isWorkoutLocked) return;
    setIsDirty(true);
    pendingLatestWorkoutIndexRef.current = wIdx;
    pendingFocusSetRef.current = { wIdx, sIdx: sIdx + 1 };
    setLocalWorkouts(prev => {
      const next = [...prev];
      const w = { ...next[wIdx] };
      const sets = [...w.sets];
      const current = sets[sIdx];
      if (!current) return prev;
      sets[sIdx] = { ...current, done: true } as WorkoutSet;
      if (sIdx === sets.length - 1) {
        sets.push(makeNextSet(current, false));
      }
      next[wIdx] = { ...w, sets };
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
  const handleWeightInput = (wIdx: number, sIdx: number, raw: string) => {
    const workout = localWorkouts[wIdx];
    if (!workout) return;
    const unit = getUnit(workout.block_id);
    setRawKgInput(prev => ({ ...prev, [`${wIdx}-${sIdx}`]: raw }));
    setIsDirty(true);
    setLocalWorkouts(prev => {
      const next = [...prev];
      next[wIdx] = {
        ...next[wIdx],
        sets: next[wIdx].sets.map((set, index) => index === sIdx
          ? {
            ...set,
            kg: inputToCanonicalKg(raw, unit),
            weight_input_raw: raw,
            weight_input_unit: unit,
          } as WorkoutSet
          : set),
      };
      return next;
    });
  };
  const handleToggleWeightUnit = (blockId: string) => {
    setRawKgInput(previous => {
      const next = { ...previous };
      localWorkouts.forEach((workout, wIdx) => {
        if (workout.block_id === blockId) {
          workout.sets.forEach((_, sIdx) => delete next[`${wIdx}-${sIdx}`]);
        }
      });
      return next;
    });
    toggleWeightUnit(blockId);
  };
  const handleSaveWorkouts = async () => {
    if (localWorkouts.filter(w => w.block_id !== '__session__').length === 0)
      return showToast(t('noWorkouts'), 'error');
    setIsSaving(true);
    const accountOperation: HealthAccountGenerationToken = {
      accountId: user.id,
      generation: accountGenerationRef.current,
    };
    const normalizedWorkouts = localWorkouts.map(workout => ({
      ...workout,
      sets: workout.sets.map(set => {
        if (!isStrengthSet(set)) return set;
        return normalizeStrengthSetForSave(set, getUnit(workout.block_id));
      }),
    }));

    if (localMode) {
      try {
        const repository = await createLocalHealthRepository(accountOperation.accountId);
        if (!currentAccountOperation(accountOperation)) return;
        const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const results = await repository.saveWorkouts(normalizedWorkouts
          .filter(w => w.block_id !== '__session__')
          .map((w, sortOrder) => ({
            id: uuidPattern.test(w.id) ? w.id : undefined,
            date: formatDate(selectedDate),
            blockId: w.block_id,
            sets: w.sets as unknown as Record<string, unknown>[],
            sortOrder,
            expectedVersion: w.local_version ?? null,
          })));
        if (!currentAccountOperation(accountOperation)) return;
        let resultIndex = 0;
        setLocalWorkouts(normalizedWorkouts.map(workout => {
          if (workout.block_id === '__session__') return workout;
          const result = results[resultIndex++];
          return result ? { ...workout, id: result.id, local_version: result.version } : workout;
        }));
        setIsSaving(false);
        showToast(t('workoutSaved'));
        clearDirtyAfterSave();
        setIsWorkoutLocked(true);
        mutateDaily();
        mutateMonthWorkoutRows();
        mutateStatic();
        return;
      } catch (error) {
        if (!currentAccountOperation(accountOperation)) return;
        const failure = localHealthWriteFailureDisposition(error);
        setIsSaving(false);
        showToast(t(failure.kind === 'conflict' ? 'healthWriteConflict' : 'failedSave'), 'error');
        return;
      }
    }

    // 순차 저장 — sort_order 보장을 위해 병렬(allSettled) 대신 순서대로 await
    // 세션 구분선(__session__)은 DB 저장 불필요 — 스킵
    let failed = 0;
    let dbIdx = 0; // 실제 DB 저장 순서 (세션 구분선 제외)
    for (let idx = 0; idx < normalizedWorkouts.length; idx++) {
      const w = normalizedWorkouts[idx];
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
      setLocalWorkouts(normalizedWorkouts);
      showToast(t('workoutSaved'));
      clearDirtyAfterSave();
      setIsWorkoutLocked(true);
      mutateDaily();
      if (localMode) mutateStatic();
      if (isMobile) {
        requestAnimationFrame(() => {
          inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
    } else if (failed < total) {
      showToast(t('partialSave').replace('{done}', String(total - failed)).replace('{total}', String(total)), 'error');
      clearDirtyAfterSave();
      setIsWorkoutLocked(true);
      mutateDaily();
      if (localMode) mutateStatic();
      if (isMobile) {
        requestAnimationFrame(() => {
          inbodyQuickRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      }
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
    if ([localInbody.weight, localInbody.smm, localInbody.pbf]
      .some(value => value !== null && value < 0))
      return showToast(t('valuesNegative'), 'error');
    const accountOperation: HealthAccountGenerationToken = {
      accountId: user.id,
      generation: accountGenerationRef.current,
    };
    if (localMode) {
      try {
        const repository = await createLocalHealthRepository(accountOperation.accountId);
        if (!currentAccountOperation(accountOperation)) return;
        const result = await repository.saveInbody({
          date: formatDate(selectedDate),
          weight: localInbody.weight,
          smm: localInbody.smm,
          pbf: localInbody.pbf,
          expectedVersion: localInbody.local_version ?? null,
        });
        if (!currentAccountOperation(accountOperation)) return;
        setLocalInbody(previous => ({ ...previous, local_version: result.version }));
        setIsInbodyDirty(false);
        mutateDaily();
        showToast(t('inbodySaved'));
      } catch (error) {
        if (!currentAccountOperation(accountOperation)) return;
        const failure = localHealthWriteFailureDisposition(error);
        showToast(t(failure.kind === 'conflict' ? 'healthWriteConflict' : 'failedSave'), 'error');
      }
      return;
    }
    if ([localInbody.weight, localInbody.smm, localInbody.pbf].some(value => value === null)) {
      showToast(t('enterWeight'), 'error');
      return;
    }
    const ok = await api('POST', '/api/inbody',
      { date: formatDate(selectedDate), weight: Number(localInbody.weight), smm: Number(localInbody.smm), pbf: Number(localInbody.pbf) },
      { revalidate: 'daily', successMsg: t('inbodySaved') }
    );
    if (ok) setIsInbodyDirty(false); // 저장 완료 → SWR 재검증 허용
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const monthStart = formatDate(new Date(year, month, 1));
  const monthEnd = formatDate(new Date(year, month + 1, 0));
  const rangeKey = localMode
    ? ['local-health-workout-range', user.id, monthStart, monthEnd] as const
    : remoteSWRKey(`${API_URL}/api/workouts/range?start_date=${monthStart}&end_date=${monthEnd}`);
  const { data: monthWorkoutRows = [], mutate: mutateMonthWorkoutRows } = useSWR<RangeWorkoutRow[]>(
    rangeKey,
    localMode
      ? ([, accountId, startDate, endDate]) => readLocalHealthWorkoutRange(accountId, startDate, endDate)
      : fetcher,
    { revalidateOnFocus: false },
  );

  const selectedDateKey = formatDate(selectedDate);

  const previousWorkoutRangeDates = useMemo(
    () => previousWorkoutRange(selectedDateKey),
    [selectedDateKey],
  );
  const previousWorkoutRemoteUrl = `${API_URL}/api/workouts/range?start_date=${previousWorkoutRangeDates.startDate}&end_date=${previousWorkoutRangeDates.endDate}`;
  const previousWorkoutRemoteKey = remoteSWRKey(previousWorkoutRemoteUrl);
  const isDesktopPrevious = !isMobile && mobileHealthTab === 'previous';
  const isPreviousContextOpen = isDesktopPrevious || isPreviousSheetOpen;
  const previousWorkoutKey: PreviousWorkoutSWRKey | null = isPreviousContextOpen
    ? localMode
      ? ['local', user.id, previousWorkoutRangeDates.startDate, previousWorkoutRangeDates.endDate]
      : previousWorkoutRemoteKey
        ? ['remote', user.id, previousWorkoutRemoteKey]
        : null
    : null;
  const previousWorkoutFetcher = useCallback(async (key: PreviousWorkoutSWRKey): Promise<PreviousWorkoutHistoryRow[]> => {
    if (key[0] === 'local') {
      return readLocalPreviousWorkoutRows(key[1], key[2], key[3]);
    }
    return normalizePreviousWorkoutRows(await fetcher<unknown[]>(key[2]));
  }, []);
  const {
    data: previousWorkoutRows = [],
    error: previousWorkoutError,
    isLoading: isPreviousWorkoutLoading,
    mutate: mutatePreviousWorkout,
  } = useSWR<PreviousWorkoutHistoryRow[]>(previousWorkoutKey, previousWorkoutFetcher, {
    ...previousWorkoutSWRConfig,
  });
  const previousWorkoutProjection = useMemo(
    () => buildPreviousWorkoutHistoryProjection({
      rows: previousWorkoutRows,
      referenceDate: selectedDateKey,
      selectedDate: selectedPreviousDate,
    }),
    [previousWorkoutRows, selectedDateKey, selectedPreviousDate],
  );
  const {
    sessions: previousWorkoutSessions,
    automaticDate: automaticPreviousDate,
    effectiveDate: effectivePreviousDate,
    session: previousWorkoutSession,
  } = previousWorkoutProjection;
  useEffect(() => {
    setSelectedPreviousDate(current => current && previousWorkoutSessions.some(session => session.date === current)
      ? current
      : automaticPreviousDate);
  }, [automaticPreviousDate, previousWorkoutSessions]);

  const healthProjection = useMemo(() => buildHealthProjection({
    rangeWorkouts: monthWorkoutRows,
    selectedDateKey,
    weightUnits,
  }), [monthWorkoutRows, selectedDateKey, weightUnits]);

  const workoutDates = healthProjection.workoutDates;

  const workoutSessionSummary = useMemo(() => {
    const exerciseCount = localWorkouts.filter(w => w.block_id !== '__session__').length;
    const setCount = localWorkouts.reduce((total, w) => total + (w.block_id === '__session__' ? 0 : w.sets.length), 0);
    const doneCount = localWorkouts.reduce(
      (total, w) => total + (w.block_id === '__session__' ? 0 : w.sets.filter(s => s.done).length),
      0,
    );
    return { exerciseCount, setCount, doneCount };
  }, [localWorkouts]);
  const hasWorkoutRecords = workoutSessionSummary.exerciseCount > 0;

  useEffect(() => {
    if (pendingLatestWorkoutIndexRef.current === null) return;
    requestAnimationFrame(() => {
      latestWorkoutRecordRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      pendingLatestWorkoutIndexRef.current = null;
    });
  }, [localWorkouts]);

  useEffect(() => {
    if (!pendingFocusSetRef.current) return;
    requestAnimationFrame(() => {
      quickCaptureInputRef.current?.focus({ preventScroll: true });
      quickCaptureInputRef.current?.select();
      pendingFocusSetRef.current = null;
    });
  }, [localWorkouts]);

  const prBadgeMap = useMemo(() => {
    const toDisplay = (kg: number, blockId: string) => parseFloat(displayKg(kg, blockId) || '0');
    return computeWorkoutPrBadgeMap(localWorkouts, prevData, toDisplay, getUnit);
  }, [localWorkouts, prevData, weightUnits]);

  const healthSectionIndex = HEALTH_WORKSPACE_SECTIONS.findIndex(s => s.id === healthSection);
  const openHealthDayLog = useCallback((section: 'workout' | 'nutrition') => {
    const sectionKey = section === 'workout' ? 'healthNavWorkout' : 'healthNavNutrition';
    openHealthDayNote(formatDate(selectedDate), createNote, updateNote, [
      { type: 'key', key: sectionKey },
      { type: 'key', key: 'healthOpenDayNote' },
    ]);
  }, [formatDate, selectedDate, createNote, updateNote]);

  const openHealthRelatedNote = useCallback((noteId: string) => {
    openNote(noteId, {
      returnTab: 'health',
      breadcrumb: [
        { type: 'key', key: 'healthNavOverview' },
        { type: 'key', key: 'healthConnectionsTitle' },
      ],
    });
  }, []);

  const openHealthScheduleConnections = useCallback(() => {
    switchToTab('planner');
  }, []);

  const openHealthArchiveConnections = useCallback(() => {
    switchToTab('analytics');
  }, []);

  const openWorkoutSessionNote = useCallback((dateLabel: string) => {
    openHealthDayNote(dateLabel, createNote, updateNote, [
      { type: 'key', key: 'healthNavWorkout' },
      { type: 'key', key: 'k113OpenWorkoutNote' },
    ]);
  }, [createNote, updateNote]);

  useEffect(() => {
    return registerSearchDomainHandlers({
      onOpenHealthDay: (dateLabel) => {
        const [y, m, d] = dateLabel.split('-').map(Number);
        if (y && m && d) {
          setSelectedDate(new Date(y, m - 1, d));
        }
        openWorkoutSessionNote(dateLabel);
      },
    });
  }, [openWorkoutSessionNote, setSelectedDate]);

  const swipeHealthSection = useSwipeNavigation(
    () => {
      const next = HEALTH_WORKSPACE_SECTIONS[healthSectionIndex + 1];
      if (next) setHealthSection(next.id);
    },
    () => {
      const prev = HEALTH_WORKSPACE_SECTIONS[healthSectionIndex - 1];
      if (prev) setHealthSection(prev.id);
    },
    { enabled: isMobile },
  );

  return (
    <WorkspaceErrorBoundary workspace="health">
    <div className={`flex-1 flex flex-col min-h-0 overflow-hidden animate-in fade-in duration-300 ${WORKSPACE_GAP_CLASS}`} data-workspace="health">
      <div className={`shrink-0 px-0.5 flex flex-col ${WORKSPACE_GAP_CLASS}`}>
        <WorkspacePageHeader
          workspace="health"
          title={t('health')}
          subtitle={t('k125HealthSubtitle')}
          icon={Dumbbell}
          theme={theme}
          dark={appSettings.darkMode}
        />
        <div className="hidden lg:block">
          <HealthWorkspaceNav active={healthSection} onChange={setHealthSection} theme={theme} />
        </div>
        <div className="lg:hidden">
          <HealthWorkspaceNav active={healthSection} onChange={setHealthSection} theme={theme} compact />
          {isMobile && (
            <p className={`text-[10px] text-center mt-1 ${theme.textMuted}`}>{t('healthSwipeSectionHint')}</p>
          )}
        </div>
      </div>

      <div
        className={`flex-1 flex flex-col min-h-0 overflow-y-auto overscroll-contain xl:overflow-hidden ${UI_SPACING.scrollOverscroll}`}
        data-k120-scroll-health
        onTouchStart={swipeHealthSection.onTouchStart}
        onTouchEnd={swipeHealthSection.onTouchEnd}
      >

      {healthSection === 'nutrition' && (
        <div className="flex-1 min-h-0 pb-4">
          <ProteinTracker accountId={user.id} mode="full" theme={theme} darkMode={appSettings.darkMode} selectedDate={selectedDate} formatDate={formatDate} showToast={showToast} onOpenDayNote={() => openHealthDayLog('nutrition')} />
        </div>
      )}

      {healthSection === 'workout' && (
    <>
    <div className="flex flex-col gap-3 lg:gap-4 pb-8 xl:grid xl:flex-1 xl:pb-0 min-h-0 xl:h-full xl:overflow-hidden xl:grid-cols-[minmax(340px,0.37fr)_minmax(680px,0.63fr)]" data-k129b-health-overview data-k134a-health-flow data-k134b-health-natural-scroll data-k136a-health-workspace-flow>
      {/* ── 좌측: Routine + Blocks (~38%) ── */}
      <div className="flex flex-col gap-2.5 shrink-0 xl:grid xl:grid-rows-[minmax(0,0.52fr)_minmax(0,0.48fr)] xl:gap-3 xl:h-full min-h-0 xl:min-w-0 xl:overflow-hidden" data-k129b-health-secondary data-k136a-health-left>
        <HealthMobileSetupNav
          activeSurface={mobileHealthTab === 'setup' ? 'setup' : 'workout'}
          onSurfaceChange={setMobileHealthTab}
          activeSection={setupSection}
          onSectionChange={setSetupSection}
          theme={theme}
        />
        <HealthBlockLibrary
          blocks={healthBlocks ?? []}
          activeTagFilter={activeTagFilter}
          setActiveTagFilter={setActiveTagFilter}
          theme={theme}
          darkMode={appSettings.darkMode}
          onAddToToday={handleAddWorkoutToToday}
          onEditBlock={openBlockModal}
          onDeleteBlock={handleDeleteBlock}
          onNewBlock={() => openBlockModal()}
          mobileVisible={mobileHealthTab === 'setup' && setupSection === 'blocks'}
        />

        <div className={`xl:h-full xl:min-h-0 ${WORKSPACE_CARD.sm} ${WORKSPACE_CARD_SURFACE} flex flex-col overflow-hidden transition-colors ${theme.card} ${mobileHealthTab === 'setup' && setupSection === 'routine' ? '' : 'hidden lg:flex'}`} data-k126-workout-routine data-health-09b-routine>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="font-heading text-base font-bold shrink-0">{t('routineSetup')}</h2>
              <select
                aria-label={t('healthPresetLabel')}
                value={activePreset.id}
                onChange={e => {
                  applyRoutinePresetAction({ type: 'switch', presetId: e.target.value });
                  setPresetMenuOpen(false);
                }}
                className={`min-w-0 max-w-[150px] rounded-xl border px-2.5 py-1.5 text-xs font-bold outline-none ${theme.input}`}
              >
                {routinePresetState.presets.map(preset => (
                  <option key={preset.id} value={preset.id}>{preset.name}</option>
                ))}
              </select>
              <div ref={presetMenuRef} className="relative shrink-0">
                <button
                  type="button"
                  aria-label={t('healthPresetActions')}
                  aria-expanded={presetMenuOpen}
                  aria-controls="health-preset-actions-menu"
                  onClick={() => setPresetMenuOpen(open => !open)}
                  className={`rounded-xl p-1.5 ${theme.hoverBg}`}
                >
                  <MoreHorizontal size={17} aria-hidden />
                </button>
                {presetMenuOpen && (
                  <div id="health-preset-actions-menu" role="menu" className={`absolute left-0 top-full z-30 mt-1 w-48 rounded-xl border p-1.5 shadow-lg ${theme.card} ${theme.border}`}>
                    <button type="button" onClick={handleCreatePreset} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-bold ${theme.hoverBg}`}>{t('healthPresetNew')}</button>
                    <button type="button" onClick={handleDuplicatePreset} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-bold ${theme.hoverBg}`}>{t('healthPresetDuplicate')}</button>
                    {presetRenameDraft ? (
                      <div className="flex gap-1 p-1">
                        <input
                          autoFocus
                          value={presetRenameDraft}
                          maxLength={48}
                          onChange={e => setPresetRenameDraft(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') commitPresetRename(); }}
                          className={`min-w-0 flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none ${theme.input}`}
                        />
                        <button type="button" onClick={commitPresetRename} className="rounded-lg bg-primary px-2 text-primary-foreground"><Check size={13} /></button>
                      </div>
                    ) : (
                      <button type="button" onClick={beginPresetRename} className={`w-full rounded-lg px-2.5 py-2 text-left text-xs font-bold ${theme.hoverBg}`}>{t('healthPresetRename')}</button>
                    )}
                    <button type="button" onClick={handleDeletePreset} className="w-full rounded-lg px-2.5 py-2 text-left text-xs font-bold text-danger hover:bg-danger/10">{t('healthPresetDelete')}</button>
                  </div>
                )}
              </div>
            </div>
            <div className={`flex shrink-0 items-center gap-2 px-3 py-1.5 rounded-xl ${theme.input}`}>
              <input
                type="number" inputMode="numeric" min="1" max="7"
                value={splitCountInput}
                onChange={e => setSplitCountInput(e.target.value)}
                onBlur={commitPresetSplit}
                onKeyDown={e => { if (e.key === 'Enter') { commitPresetSplit(); (e.target as HTMLInputElement).blur(); } }}
                className="w-8 bg-transparent text-lg font-bold outline-none text-center tabular-nums"/>
              <span className={`text-xs font-semibold ${theme.textMuted}`}>{t('splits')}</span>
            </div>
          </div>
          <div className="grid flex-1 grid-cols-1 2xl:grid-cols-2 gap-2 lg:gap-2.5 min-h-0 overflow-y-auto overscroll-contain pr-1" data-k136b-routine-scroll>
            {Array.from({ length: splitCount }).map((_, i) => {
              const dayName = `Day ${i + 1}`;
              const routine = selectedHealthRoutines.find((r: HealthRoutine) => r.day_name === dayName);
              const blocks = (routine?.blocks ?? [])
                .map((id: string) => healthBlocks?.find((b: ExerciseBlock) => b.id === id))
                .filter((b): b is ExerciseBlock => !!b);
              return (
                <div key={dayName} className={`rounded-xl p-3 border ${theme.border}`}>
                  <div className="flex justify-between items-center mb-2">
                    <h3 className="font-heading text-sm font-bold">{dayName}</h3>
                    <button onClick={() => openAssembleModal(dayName)} className="text-[11px] text-blue-500 font-bold">{t('assembleBtn')}</button>
                  </div>
                  <div className="flex flex-col gap-1 min-h-[24px]">
                    {blocks.length === 0 ? (
                      <span className={`text-[10px] ${theme.textMuted}`}>—</span>
                    ) : blocks.map(b => (
                      <div key={b.id} className="flex items-center justify-between gap-2 text-xs font-semibold">
                        <span className="truncate">{b.name}</span>
                        {showsPlannedSetCount(b.type) ? (
                          <span className={`shrink-0 tabular-nums ${theme.textMuted}`}>
                            {t('k76SetCount').replace('{count}', String(routinePresetPlannedSetCount(activePreset, dayName, b.id, b.type, prevData[b.id]?.prev_sets)))}
                          </span>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── 우측: Today's Workout (primary ~62%) ── */}
      <div
        className={`lg:min-w-0 min-h-0 shrink-0 pb-3 lg:pb-0 lg:pr-1 xl:overflow-hidden
          flex flex-col gap-2.5
          xl:grid xl:grid-rows-[minmax(0,0.58fr)_minmax(0,0.42fr)] xl:gap-3 xl:h-full
          ${mobileHealthTab === 'workout' || isDesktopPrevious ? 'flex xl:grid' : 'hidden lg:flex xl:grid'}`}
        data-k129b-health-primary
        data-k136a-health-center
        data-k138-health-right-grid
      >
        <div
          className={`${WORKSPACE_CARD_SURFACE} flex min-h-0 flex-col overflow-hidden transition-colors ${WORKSPACE_CARD.workoutHero} lg:min-h-[280px] xl:min-h-0 ${theme.card} xl:h-full`}
          data-k129b-today-workout-primary
          data-k138-workout-row
          data-k137-workout-density={hasWorkoutRecords ? 'populated' : 'empty'}
        >
        {isDailyLoading ? (
          <WorkspaceCardSkeleton theme={theme} minHeight={WORKSPACE_CARD.workoutHero} bars={4} />
        ) : (
        <>
          <div className={`sticky top-0 z-20 -mx-1 px-1 pt-0 pb-3 mb-3 border-b backdrop-blur ${theme.border} ${theme.card}`} data-k129c-session-header>
            <div className="flex justify-between items-start gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-xl font-bold">{isDesktopPrevious ? t('previousWorkout') : t('todayWorkout')}</h2>
                {!isDesktopPrevious && (
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${isWorkoutLocked ? (appSettings.darkMode ? 'bg-green-900/40 text-green-300' : 'bg-green-50 text-green-700') : (appSettings.darkMode ? 'bg-blue-900/35 text-blue-300' : 'bg-blue-50 text-blue-700')}`}>
                    {isWorkoutLocked ? t('healthSessionSaved') : t('healthSessionActive')}
                  </span>
                )}
              </div>
              {!isDesktopPrevious && (
                <>
                  <p className={`text-xs font-medium mt-1 ${theme.textMuted}`}>
                    {formatLongDate(selectedDate, lang)}
                  </p>
                  <div className={`mt-2 flex flex-wrap items-center gap-1.5 text-[11px] font-bold ${theme.textMuted}`} data-k129c-session-summary>
                    <span className={`rounded-lg px-2 py-1 ${appSettings.darkMode ? 'bg-surface-alt' : 'bg-gray-100'}`}>
                      {t('healthSessionExerciseCount').replace('{count}', String(workoutSessionSummary.exerciseCount))}
                    </span>
                    <span className={`rounded-lg px-2 py-1 ${appSettings.darkMode ? 'bg-surface-alt' : 'bg-gray-100'}`}>
                      {t('healthSessionSetCount').replace('{count}', String(workoutSessionSummary.setCount))}
                    </span>
                    <span className={`rounded-lg px-2 py-1 ${appSettings.darkMode ? 'bg-surface-alt' : 'bg-gray-100'}`}>
                      {t('healthSessionDoneCount').replace('{count}', String(workoutSessionSummary.doneCount))}
                    </span>
                  </div>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
              <HealthMobileWorkoutActions
                isMobile={isMobile}
                isDesktopPrevious={isDesktopPrevious}
                isWorkoutLocked={isWorkoutLocked}
                previousLabel={t('previousWorkout')}
                addExerciseLabel={t('addExercise')}
                theme={theme}
                onPrevious={() => setIsPreviousSheetOpen(true)}
                onAddExercise={() => { setQuickAddQuery(''); setShowQuickAddExercise(true); }}
              />
              <div className={`hidden lg:flex items-center rounded-xl border p-0.5 ${theme.border} ${theme.input}`} role="group" aria-label={t('previousWorkoutToggle')}>
                <button
                  type="button"
                  onClick={() => setMobileHealthTab('workout')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${!isDesktopPrevious ? 'bg-primary text-primary-foreground' : theme.textMuted}`}
                >
                  {t('todayShort')}
                </button>
                <button
                  type="button"
                  onClick={() => setMobileHealthTab('previous')}
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${isDesktopPrevious ? 'bg-primary text-primary-foreground' : theme.textMuted}`}
                >
                  {t('tabPrevious')}
                </button>
              </div>
            {!isWorkoutLocked && !isDesktopPrevious && (
              <div className="flex items-center gap-2">
                {isMobile && (
                  <div className="flex min-w-0 items-center gap-1.5" data-health-quick-setup>
                    <select
                      aria-label={t('healthPresetLabel')}
                      value={activePreset.id}
                      onChange={e => handleQuickPresetChange(e.target.value)}
                      className={`min-h-[40px] min-w-0 max-w-[120px] rounded-xl border px-2 py-2 text-xs font-bold outline-none ${theme.input} ${theme.border}`}
                    >
                      {routinePresetState.presets.map(preset => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
                    </select>
                    <select
                      aria-label={t('healthDayLabel')}
                      value={activeDayForm}
                      onChange={e => setActiveDayForm(e.target.value)}
                      className={`min-h-[40px] max-w-[88px] rounded-xl border px-2 py-2 text-xs font-bold outline-none ${theme.input} ${theme.border}`}
                    >
                      {Array.from({ length: splitCount }).map((_, i) => <option key={i} value={`Day ${i + 1}`}>{t('loadDay').replace('{n}', String(i + 1))}</option>)}
                    </select>
                  </div>
                )}
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
          </div>
          </div>

          {isDesktopPrevious && (
            <PreviousWorkoutView
              session={previousWorkoutSession}
              isLoading={isPreviousWorkoutLoading}
              hasError={!!previousWorkoutError}
              theme={theme}
              darkMode={appSettings.darkMode}
              t={t}
              formatDate={date => formatLongDate(new Date(`${date}T12:00:00`), lang)}
              formatCompactDate={date => formatAbsoluteDateKey(date, lang)}
              formatWeight={(value, blockId) => displayKg(value, blockId)}
              weightUnit={blockId => getUnit(blockId)}
              onRetry={() => { void mutatePreviousWorkout(); }}
              sessions={previousWorkoutSessions}
              selectedDate={effectivePreviousDate}
              onSelectDate={setSelectedPreviousDate}
            />
          )}
          <div className={isDesktopPrevious ? 'hidden' : 'contents'}>
          <div
            className={`min-h-0 flex-1 overscroll-contain space-y-3 pr-1 scroll-smooth
              ${hasWorkoutRecords
                ? 'overflow-y-auto pb-24'
                : 'overflow-hidden flex flex-col justify-center pb-1'}`}
            data-k129b-workout-records-scroll
            data-k129c-session-timeline
          >
            {localWorkouts.length === 0 && (
              <div className={`rounded-2xl border border-dashed px-4 py-4 lg:px-5 lg:py-4 ${theme.border} ${appSettings.darkMode ? 'bg-surface/40' : 'bg-gray-50/70'}`} data-k121-empty-state="health-workouts" data-k129c-workout-empty data-k134a-workout-empty data-k134b-health-empty-compact>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-heading text-lg font-bold">{t('noWorkoutsEmpty')}</p>
                    <p className={`mt-1 max-w-xl text-sm leading-relaxed ${theme.textMuted}`}>{t('healthWorkoutEmptyPolishDesc')}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => { setMobileHealthTab('setup'); setSetupSection('blocks'); }}
                      className="inline-flex min-h-[44px] items-center justify-center rounded-xl bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
                    >
                      {t('k99EmptyHealthWorkoutsAction')}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setMobileHealthTab('setup'); setSetupSection('routine'); }}
                      className={`inline-flex min-h-[44px] items-center justify-center rounded-xl border px-4 py-2 text-sm font-bold ${theme.border} ${theme.textMuted} hover:text-foreground`}
                    >
                      {t('tabRoutine')}
                    </button>
                  </div>
                </div>
              </div>
            )}
            {localWorkouts.map((w: Workout, wIdx: number) => {
              const isLatestTarget = pendingLatestWorkoutIndexRef.current === wIdx;

              /* ── 세션 구분선 렌더링 ── */
              if (w.block_id === '__session__') {
                return (
                  <div
                    key={w.id}
                    ref={isLatestTarget ? latestWorkoutRecordRef : undefined}
                    data-workout-index={wIdx}
                    draggable={!isWorkoutLocked}
                    onDragStart={e => handleDragStart(e, wIdx)}
                    onDragEnter={() => handleDragEnter(wIdx)}
                    onDragEnd={handleDragEnd}
                    onDragOver={e => e.preventDefault()}
                    onTouchStart={e => handleTouchStart(e, wIdx)}
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleDragEnd}
                    className="flex items-center gap-3 py-2 select-none"
                    data-k129c-session-divider>
                    {!isWorkoutLocked && (
                      <GripVertical size={15} className={`shrink-0 cursor-grab active:cursor-grabbing ${appSettings.darkMode ? 'text-gray-600' : 'text-gray-300'}`}/>
                    )}
                    <div className={`flex-1 h-px ${appSettings.darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}/>
                    <span className={`text-[11px] font-black tracking-widest px-3 py-1.5 rounded-full shrink-0 border ${theme.border}
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
              const previousBestCue = formatPreviousBestCue(
                prevData[w.block_id]?.prev_sets,
                getUnit(w.block_id),
                w.exercise_blocks?.type,
              );
              const previousBestLabel = previousBestCue?.kind === 'bodyweight'
                ? t('previousBestBodyweight').replace('{reps}', previousBestCue.reps)
                : previousBestCue?.reps
                  ? t('previousBestWeightReps')
                    .replace('{weight}', previousBestCue.weight)
                    .replace('{unit}', previousBestCue.unit)
                    .replace('{reps}', previousBestCue.reps)
                  : previousBestCue
                    ? t('previousBestWeightOnly')
                      .replace('{weight}', previousBestCue.weight)
                      .replace('{unit}', previousBestCue.unit)
                    : null;
              return (
                <div
                key={w.id}
                ref={isLatestTarget ? latestWorkoutRecordRef : undefined}
                data-workout-index={wIdx}
                draggable={!isWorkoutLocked}
                onDragStart={e => handleDragStart(e, wIdx)}
                onDragEnter={() => handleDragEnter(wIdx)}
                onDragEnd={handleDragEnd}
                onDragOver={e => e.preventDefault()}
                onTouchStart={e => handleTouchStart(e, wIdx)}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleDragEnd}
                className={`border ${WORKSPACE_CARD_RADIUS_CLASS} p-5 lg:p-6 relative isolate z-0 group shadow-sm transition-all duration-150 ${theme.border} ${
                  dragOverIndex === wIdx && dragIndex !== wIdx
                    ? appSettings.darkMode ? 'border-primary bg-primary/5 scale-[1.01]' : 'border-primary bg-yellow-50/50 scale-[1.01]'
                    : ''
                } ${!isWorkoutLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
                data-k126-workout-exercise-card
                data-k129c-exercise-card
              >
                {!isWorkoutLocked && (
                  isMobile ? (
                    <div className="absolute top-3 right-3 z-10">
                      <button
                        type="button"
                        aria-label={t('k126WorkoutActions')}
                        onClick={e => { e.stopPropagation(); setWorkoutOverflowIndex(workoutOverflowIndex === wIdx ? null : wIdx); }}
                        className={`inline-flex items-center justify-center rounded-lg p-2 ${theme.textMuted} hover:bg-muted/60`}
                        style={{ minWidth: UI_INTERACTION.touchTargetMinPx, minHeight: UI_INTERACTION.touchTargetMinPx }}
                        data-k126-workout-overflow-trigger
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      {workoutOverflowIndex === wIdx ? (
                        <div
                          className={`absolute right-0 top-full mt-1 min-w-[120px] rounded-xl shadow-lg border p-1 z-20 ${theme.card} ${theme.border}`}
                          data-k126-workout-overflow-menu
                        >
                          <button
                            type="button"
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold text-red-500 hover:bg-red-500/10 min-h-[44px]"
                            onClick={() => { setWorkoutOverflowIndex(null); handleRemoveWorkout(wIdx, w.id); }}
                          >
                            <Trash2 size={12} /> {t('delete')}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <button onClick={() => handleRemoveWorkout(wIdx, w.id)}
                      className="absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-red-500 active:scale-95 transition-colors">
                      <Trash2 size={18}/>
                    </button>
                  )
                )}
                <div className={`flex items-center gap-3 mb-4 pb-3 border-b ${theme.border}`}>
                  {!isWorkoutLocked && (
                    <GripVertical size={18} className={`shrink-0 ${appSettings.darkMode ? 'text-gray-600' : 'text-gray-300'} cursor-grab active:cursor-grabbing`}/>
                  )}
                  <div className={`w-3 h-3 rounded-full shrink-0 ${w.exercise_blocks?.type === 'cardio' ? 'bg-green-500' : w.exercise_blocks?.type === 'bodyweight' ? 'bg-purple-500' : 'bg-blue-500'}`}/>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading text-lg font-bold truncate">{w.exercise_blocks?.name || 'Unknown'}</h3>
                    <p className={`text-[11px] font-bold mt-0.5 ${theme.textMuted}`}>
                      {t('healthExerciseSetSummary').replace('{count}', String(w.sets.length))}
                    </p>
                    {previousBestLabel && (
                      <p
                        className={`mt-1 truncate text-[11px] font-semibold ${theme.textMuted}`}
                        data-health-previous-micro-cue
                        title={previousBestLabel}
                      >
                        {previousBestLabel}
                      </p>
                    )}
                  </div>
                  <WorkoutPrBadge badge={prBadgeMap[w.block_id] ?? null} darkMode={appSettings.darkMode} />
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
                          onClick={() => handleToggleWeightUnit(w.block_id)}
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
                <div className="space-y-2.5" data-k129c-set-group>
                  {(w.sets || []).map((s: WorkoutSet, sIdx: number) => {
                    const isDS = isStrengthSet(s) && s.is_dropset;
                    const previousSet = matchPreviousSetReference(
                      s,
                      prevData[w.block_id]?.prev_sets,
                      w.exercise_blocks?.type,
                      w.sets,
                    );
                    const previousSetCue = formatPreviousSetReference(
                      previousSet,
                      getUnit(w.block_id),
                      w.exercise_blocks?.type,
                    );
                    const previousSetLabel = previousSetCue?.kind === 'bodyweight'
                      ? t('previousSetReferenceBodyweight').replace('{reps}', previousSetCue.reps)
                      : previousSetCue?.reps
                        ? t('previousSetReferenceWeightReps')
                          .replace('{weight}', previousSetCue.weight)
                          .replace('{unit}', previousSetCue.unit)
                          .replace('{reps}', previousSetCue.reps)
                        : previousSetCue
                          ? t('previousSetReferenceWeightOnly')
                            .replace('{weight}', previousSetCue.weight)
                            .replace('{unit}', previousSetCue.unit)
                          : null;
                    return (
                      <div key={sIdx} className={`rounded-xl overflow-hidden transition-opacity ${s.done ? 'opacity-55' : ''}`}>
                        {/* 드랍세트 구분선 */}
                        {isDS && (
                          <div className="flex items-center gap-1 px-3 pt-1.5 pb-0.5">
                            <div className="h-px flex-1 bg-orange-400/50"/>
                            <span className="text-[10px] font-bold text-orange-400 shrink-0">{t('dropSet')}</span>
                            <div className="h-px flex-1 bg-orange-400/50"/>
                          </div>
                        )}
                        <div
                          ref={isLatestTarget && sIdx === w.sets.length - 1 ? latestWorkoutRecordRef : undefined}
                          className={`flex gap-2 px-2.5 py-3 items-center border rounded-xl
                          ${isDS ? 'bg-orange-400/10 border-orange-400/30' : `${theme.input} ${theme.border}`}`}
                        >

                          {/* 세트 번호 — 탭하면 해당 세트 삭제 */}
                          <button
                            onClick={() => !isWorkoutLocked && w.sets.length > 1 && handleRemoveSet(wIdx, sIdx)}
                            title={isWorkoutLocked ? '' : t('healthTapDeleteSet')}
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
                              ref={pendingFocusSetRef.current?.wIdx === wIdx && pendingFocusSetRef.current?.sIdx === sIdx ? quickCaptureInputRef : undefined}
                              step={getUnit(w.block_id) === 'lbs' ? '10' : '5'}
                              value={rawKgInput[`${wIdx}-${sIdx}`] ?? editableWeightInput(s, getUnit(w.block_id))}
                              placeholder="—"
                              onChange={e => {
                                const raw = e.target.value;
                                setRawKgInput(prev => ({ ...prev, [`${wIdx}-${sIdx}`]: raw }));
                                handleWeightInput(wIdx, sIdx, raw);
                              }}
                              onFocus={() => {
                                setRawKgInput(prev => ({ ...prev, [`${wIdx}-${sIdx}`]: editableWeightInput(s, getUnit(w.block_id)) }));
                              }}
                              onBlur={() => {
                                setRawKgInput(prev => { const n = { ...prev }; delete n[`${wIdx}-${sIdx}`]; return n; });
                              }}
                              className={`flex-1 min-w-0 text-[16px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-blue-400 ${theme.card}`}/>
                          )}
                          {/* Bodyweight / Strength reps */}
                          {isStrengthSet(s) && (
                            <input type="number" inputMode="numeric" min="0"
                              ref={w.exercise_blocks?.type === 'bodyweight' && pendingFocusSetRef.current?.wIdx === wIdx && pendingFocusSetRef.current?.sIdx === sIdx ? quickCaptureInputRef : undefined}
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
                                    ref={pendingFocusSetRef.current?.wIdx === wIdx && pendingFocusSetRef.current?.sIdx === sIdx ? quickCaptureInputRef : undefined}
                                    value={s.time}
                                    placeholder="0:00"
                                    onChange={e => handleTimeInput(wIdx, sIdx, e.target.value)}
                                    onBlur={e => handleTimeBlur(wIdx, sIdx, e.target.value)}
                                    className={`flex-1 min-w-0 text-[16px] font-bold text-center rounded-xl py-3 outline-none focus:ring-2 focus:ring-blue-400 ${theme.card}`}/>
                                )}
                                {(mode === 'distance' || mode === 'both') && (
                                  <input type="text" inputMode="decimal" value={s.distance} placeholder="km"
                                    ref={mode === 'distance' && pendingFocusSetRef.current?.wIdx === wIdx && pendingFocusSetRef.current?.sIdx === sIdx ? quickCaptureInputRef : undefined}
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
                        {previousSetLabel && (
                          <p
                            className={`px-3 pt-1 text-[11px] font-semibold ${theme.textMuted}`}
                            data-health-previous-set-reference
                            title={previousSetLabel}
                          >
                            {previousSetLabel}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Add Set / Drop Set 버튼 — 잠금 시 숨김 */}
                {!isWorkoutLocked && (
                  <div className={`sticky bottom-2 z-10 mt-4 flex gap-2 rounded-2xl border p-2 backdrop-blur ${theme.border} ${theme.card}`} data-k129c-sticky-exercise-controls>
                    <button
                      onClick={() => handleCompleteSetAndAdd(wIdx, Math.max(0, w.sets.length - 1))}
                      disabled={w.sets.length === 0}
                      className={`flex-1 text-sm font-bold py-2.5 rounded-xl active:scale-[0.98] transition-all ${appSettings.darkMode ? 'bg-surface-alt text-gray-100' : 'bg-gray-100 text-gray-700'} disabled:opacity-50`}
                    >
                      {t('healthDoneNextShort')}
                    </button>
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
          <div className={`${hasWorkoutRecords ? 'sticky bottom-0' : ''} z-30 shrink-0 pt-2 pb-1 border-t backdrop-blur ${theme.border} ${theme.card}`} data-k129c-sticky-workout-controls>
            {isWorkoutLocked ? (
              /* ── 잠금 상태: Saved 배너 + Edit 버튼만 표시 ── */
              <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border
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
                    title={t('healthCopyWorkoutSummary')}
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
              <WorkspaceToolbar workspace="health" stickyPosition="bottom" legacyDataHook="data-k104-health-no-sticky-mobile">
                <WorkspaceToolbarPrimary
                  label={isSaving ? t('loading') : t('completeWorkout')}
                  icon={isSaving ? <Loader2 size={20} className="animate-spin" /> : <Save size={20} />}
                  onClick={handleSaveWorkouts}
                  disabled={isSaving}
                  className={`rounded-2xl text-base shadow-xl ${isSaving ? 'opacity-70' : ''}`}
                  dataHook="data-k120-health-save"
                />
              </WorkspaceToolbar>
            )}
            {/* ── 날짜별 메모 ── */}
            <div className="mt-2 rounded-xl p-2 bg-surface-alt" data-k104-health-workout-footer>
              <p className={`text-[10px] font-bold mb-1 ${theme.textMuted}`}>{t('memo')}</p>
              <textarea
                value={workoutMemo}
                onChange={e => {
                  setWorkoutMemo(e.target.value);
                  localStorage.setItem(memoKey, e.target.value);
                }}
                placeholder={t('memoPlaceholder')}
                rows={1}
                className={`w-full bg-transparent outline-none resize-none text-sm leading-relaxed placeholder-gray-400 ${theme.text}`}
              />
              <button
                type="button"
                onClick={() => openHealthDayLog('workout')}
                className={`mt-2 flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border ${theme.border} ${theme.textMuted} hover:text-foreground transition-colors min-h-[44px]`}
              >
                <FileText size={14} />
                {t('healthOpenDayNote')}
              </button>
           </div>
          </div>
          </div>
        </>
        )}
        </div>

      <div
        ref={inbodyQuickRef}
        className="flex min-w-0 min-h-0 flex-col gap-2.5 pb-4 xl:h-full xl:pb-0 xl:overflow-hidden"
        data-k136a-health-right
        data-k138-support-row
      >
        <HealthSupportingPanels
          accountId={user.id}
          selectedDate={selectedDate}
          currentDate={currentDate}
          setCurrentDate={setCurrentDate}
          setSelectedDate={setSelectedDate}
          formatDate={formatDate}
          isToday={isToday}
          theme={theme}
          lang={lang}
          workoutDates={workoutDates}
          localInbody={localInbody}
          setLocalInbody={setLocalInbody}
          setIsInbodyDirty={setIsInbodyDirty}
          onSaveInbody={handleSaveInbody}
          appSettings={appSettings}
          showToast={showToast}
          onOpenNutrition={() => setHealthSection('nutrition')}
          inbodyHistoryCollapsed={healthSectionPrefs.inbodyHistoryCollapsed}
        />
      </div>
      </div>
    </div>
    </>
      )}

      <PreviousWorkoutSheet
        open={isPreviousSheetOpen && isMobile}
        onOpenChange={setIsPreviousSheetOpen}
        session={previousWorkoutSession}
        isLoading={isPreviousWorkoutLoading}
        hasError={!!previousWorkoutError}
        theme={theme}
        darkMode={appSettings.darkMode}
        t={t}
        formatDate={date => formatLongDate(new Date(`${date}T12:00:00`), lang)}
        formatCompactDate={date => formatAbsoluteDateKey(date, lang)}
        formatWeight={(value, blockId) => displayKg(value, blockId)}
        weightUnit={blockId => getUnit(blockId)}
        onRetry={() => { void mutatePreviousWorkout(); }}
        sessions={previousWorkoutSessions}
        selectedDate={effectivePreviousDate}
        onSelectDate={setSelectedPreviousDate}
      />

      {showQuickAddExercise && isMobile && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/60 p-3 backdrop-blur-sm"
          role="presentation"
          onClick={() => setShowQuickAddExercise(false)}
          data-health-quick-add-overlay
        >
          <div
            className={`${WORKSPACE_MODAL_SURFACE} w-full max-w-lg max-h-[78dvh] ${theme.card}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="health-quick-add-title"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <h2 id="health-quick-add-title" className="font-heading text-lg font-bold">{t('addExercise')}</h2>
              <button type="button" onClick={() => setShowQuickAddExercise(false)} className={`rounded-xl p-2 ${theme.hoverBg}`} aria-label={t('close')}>
                <X size={18} aria-hidden />
              </button>
            </div>
            <input
              autoFocus
              type="search"
              value={quickAddQuery}
              onChange={event => setQuickAddQuery(event.target.value)}
              placeholder={t('healthExerciseSearchPlaceholder')}
              className={`mb-3 w-full rounded-xl border px-3 py-2.5 text-sm font-semibold outline-none ${theme.input} ${theme.border}`}
              data-health-quick-add-search
            />
            <div className="min-h-0 max-h-[52dvh] space-y-2 overflow-y-auto overscroll-contain" data-health-quick-add-list>
              {quickAddBlocks.length === 0 ? (
                <p className={`py-6 text-center text-sm font-semibold ${theme.textMuted}`}>{t('healthExerciseSearchEmpty')}</p>
              ) : quickAddBlocks.map(block => (
                <button
                  key={block.id}
                  type="button"
                  onClick={() => {
                    void handleAddWorkoutToToday(block);
                    setShowQuickAddExercise(false);
                  }}
                  className={`flex min-h-[48px] w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left ${theme.border} ${theme.hoverBg}`}
                  data-health-quick-add-block={block.id}
                >
                  <span className="min-w-0 truncate text-sm font-bold">{block.name}</span>
                  <Plus size={16} className="shrink-0 text-primary" aria-hidden />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── 블록 생성/수정 모달 ── */}
      {showBlockModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[100] p-4 backdrop-blur-sm" onClick={() => setShowBlockModal(false)}>
          <div className={`${WORKSPACE_MODAL_SURFACE} w-full max-w-[380px] ${theme.card}`} onClick={e => e.stopPropagation()}>
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
            <div className={`${WORKSPACE_MODAL_SURFACE} w-full max-w-[440px] flex flex-col max-h-[85vh] ${theme.card}`} onClick={e => e.stopPropagation()}>
              <div className="flex justify-between items-center mb-5 shrink-0">
                <div>
                  <h3 className="font-heading text-xl font-bold">{t('assembleTitle')} {activeDayForm}</h3>
                  <p className={`text-xs mt-0.5 ${theme.textMuted}`}>{t('assembleHint').replace('{count}', String(tempRoutineBlocks.length))}</p>
                </div>
                <button onClick={() => setShowAssembleModal(false)} className={`p-2 rounded-full ${theme.hoverBg}`}><X size={18}/></button>
              </div>

              {/* 선택된 순서 미리보기 — 드래그로 재정렬 + 세트 수 */}
              {tempRoutineBlocks.length > 0 && (
                <div className="mb-4 p-3 rounded-2xl shrink-0 bg-surface-alt">
                  <p className={`text-[11px] font-bold mb-2 ${theme.textMuted}`}>{t('orderDrag')}</p>
                  <div className="flex flex-col gap-1.5">
                    {tempRoutineBlocks.map((id, idx) => {
                      const b = (healthBlocks || []).find((bk: ExerciseBlock) => bk.id === id);
                      if (!b) return null;
                      const isDraggingThis = routineDragIdx === idx;
                      const isDragOver = routineDragOverIdx === idx && routineDragIdx !== idx;
                      return (
                        <div
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
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-grab active:cursor-grabbing select-none transition-all bg-primary text-primary-foreground
                            ${isDraggingThis ? 'opacity-40 scale-[0.98]' : ''}
                            ${isDragOver ? 'ring-2 ring-primary-foreground/40' : ''}`}>
                          <GripVertical size={12} className="opacity-50 shrink-0"/>
                          <span className="text-[10px] opacity-60 tabular-nums w-4">{idx + 1}</span>
                          <span className="text-xs font-bold truncate flex-1 min-w-0">{b.name}</span>
                          {showsPlannedSetCount(b.type) ? (
                            <label className="flex items-center gap-1 shrink-0 text-[10px] font-bold opacity-90">
                              <input
                                type="number"
                                inputMode="numeric"
                                min={1}
                                max={12}
                                value={tempRoutineSetCounts[id] ?? routinePresetPlannedSetCount(activePreset, activeDayForm, id, b.type, prevData[id]?.prev_sets)}
                                onClick={e => e.stopPropagation()}
                                onChange={e => {
                                  const n = Math.min(12, Math.max(1, Number(e.target.value) || 1));
                                  setTempRoutineSetCounts(prev => ({ ...prev, [id]: n }));
                                }}
                                className="w-9 bg-white/15 rounded px-1 py-0.5 text-center tabular-nums outline-none"
                              />
                              {t('setsLabel')}
                            </label>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 태그별 블록 목록 */}
              <div className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1">
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

      </div>

      {confirm && <ConfirmModal message={confirm.message} onConfirm={handleConfirm} onCancel={clearConfirm} darkMode={appSettings.darkMode} confirmLabel={confirm.confirmLabel} variant={confirm.variant}/>}
    </div>
    </WorkspaceErrorBoundary>
  );
};
