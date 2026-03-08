import { DateTime } from 'luxon';

// ─────────────────────────────────────────────
// 도메인 엔티티 타입
// ─────────────────────────────────────────────
export interface Schedule {
  id: string; text: string; start_time: string; end_time: string;
  is_dday: boolean; color: string; category: string;
}
export interface DDay { id: string; text: string; date: string; }
export interface Todo { id: string; text: string; done: boolean; }
export interface Routine { id: string; text: string; done: boolean; is_active: boolean; }
export interface ExerciseBlock { id: string; name: string; type: string; }

// ─── WorkoutSet — Discriminated Union ───────────────────────────────────────
// 기존: 모든 필드가 optional인 단일 인터페이스 → `(s as any).kg` 같은 캐스팅 불가피
// 변경: type 필드로 좁히면 해당 필드만 존재를 TypeScript가 보장
export interface StrengthSet {
  type: 'strength' | 'bodyweight';
  set: number;
  kg: number | string;
  reps: number | string;
  done: boolean;
}
export interface CardioSet {
  type: 'cardio';
  set: number;
  time: string;
  distance: string;
  pace: string;
  done: boolean;
}
export type WorkoutSet = StrengthSet | CardioSet;

/** type 필드로 set 종류를 좁히는 타입 가드 */
export const isCardioSet = (s: WorkoutSet): s is CardioSet => s.type === 'cardio';
export const isStrengthSet = (s: WorkoutSet): s is StrengthSet =>
  s.type === 'strength' || s.type === 'bodyweight';

/** ExerciseBlock.type 문자열로 기본 세트를 만드는 팩토리 */
export const makeDefaultSet = (blockType: string, setNumber = 1): WorkoutSet =>
  blockType === 'cardio'
    ? { type: 'cardio',    set: setNumber, time: '', distance: '', pace: '', done: false }
    : { type: blockType as 'strength' | 'bodyweight', set: setNumber, kg: '', reps: '', done: false };

/** 이전 세트에서 입력값을 복사해 다음 세트를 만드는 팩토리 */
export const makeNextSet = (prev: WorkoutSet): WorkoutSet =>
  isCardioSet(prev)
    ? { type: 'cardio', set: prev.set + 1, time: prev.time, distance: prev.distance, pace: prev.pace, done: false }
    : { type: prev.type, set: prev.set + 1, kg: prev.kg, reps: prev.reps, done: false };
// ─────────────────────────────────────────────────────────────────────────────

export interface Workout {
  id: string; block_id: string; exercise_blocks: ExerciseBlock; sets: WorkoutSet[];
}
export interface Inbody { weight: number; smm: number; pbf: number; }
export interface WeeklySchedule {
  id: string; day: number; title: string; start_time: string; end_time: string; color: string;
}
export interface AppSettings {
  darkMode: boolean; defaultCategory: string; defaultColor: string;
}
export interface HealthRoutine { id: string; day_name: string; blocks: string[]; }
export interface Theme {
  card: string; input: string; border: string; textMuted: string; hoverBg: string;
}
export type ThemeColor = { id: string; bg: string; text: string; border: string };

// ─────────────────────────────────────────────
// 공통 베이스 — 모든 뷰에서 사용
// ─────────────────────────────────────────────
export interface BaseViewProps {
  showToast: (m: string, t?: 'success' | 'error') => void;
  appSettings: AppSettings;
  updateSetting: (k: keyof AppSettings, v: AppSettings[keyof AppSettings]) => void;
  theme: Theme;
  THEME_COLORS: ThemeColor[];
}

// SWR 재검증 — daily/static 데이터를 가진 뷰에서 공통 사용
interface MutateProps {
  mutateDaily: () => void;
  mutateStatic: () => void;
}

// Optimistic update — PlannerView 전용
interface OptimisticProps {
  mutateTodos: (updater: (cur: Todo[]) => Todo[], revalidate?: boolean) => void;
  mutateRoutines: (updater: (cur: Routine[]) => Routine[], revalidate?: boolean) => void;
}

// 날짜/시각 — 날짜를 다루는 뷰(Planner, Health)에서 공통 사용
interface DateProps {
  now: DateTime;
  currentDate: Date;
  setCurrentDate: (d: Date) => void;
  selectedDate: Date;
  setSelectedDate: (d: Date) => void;
  formatDate: (d: Date | DateTime) => string;
  isToday: (d: string) => boolean;
}

// ─────────────────────────────────────────────
// 뷰별 Props
// ─────────────────────────────────────────────
export interface PlannerProps extends BaseViewProps, DateProps, MutateProps, OptimisticProps {
  schedules: Schedule[];
  todos: Todo[];
  routines: Routine[];
  ddays: DDay[];
  markedDates: string[];
}

export interface HealthProps extends BaseViewProps, DateProps, MutateProps {
  workouts: Workout[];
  inbody: Inbody;
  healthBlocks: ExerciseBlock[];
  healthRoutines: HealthRoutine[];
}

export interface AnalyticsProps extends BaseViewProps {
  mutateStatic: () => void;
  now: DateTime;
  formatDate: (d: Date | DateTime) => string;
  schedules: Schedule[];
  routines: Routine[];
  weeklySchedules: WeeklySchedule[];
}

export interface SettingsProps extends BaseViewProps, MutateProps {
  onSignOut: () => void;
}

// ─────────────────────────────────────────────
// ViewProps — AppContent의 globalProps 타입으로만 사용
// ─────────────────────────────────────────────
export interface ViewProps
  extends BaseViewProps, DateProps, MutateProps, OptimisticProps {
  user: { id: string; name: string };
  onSignOut: () => void;
  schedules: Schedule[];
  todos: Todo[];
  routines: Routine[];
  ddays: DDay[];
  markedDates: string[];
  workouts: Workout[];
  inbody: Inbody;
  healthBlocks: ExerciseBlock[];
  healthRoutines: HealthRoutine[];
  weeklySchedules: WeeklySchedule[];
}
