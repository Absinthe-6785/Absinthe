import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings } from '../types';

interface StoreState {
  appSettings: AppSettings;
  /** memoText는 persist 범위에서 제외 — 별도 debounce 저장으로 localStorage 부하 방지 */
  memoText: string;
  updateSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => void;
  setMemoText: (text: string) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  defaultCategory: 'Study',
  defaultColor: 'gold',
};

const MEMO_STORAGE_KEY = 'planner-memo';
const MEMO_DEBOUNCE_MS = 500;

/**
 * useAppStore — 앱 전역 설정 + 메모 텍스트 상태 관리.
 *
 * appSettings: persist로 저장. 설정 변경은 버튼 클릭 단위라 빈도가 낮음.
 *
 * memoText: persist 범위에서 제외(partialize).
 *   개선 전: memoText가 persist 안에 있어 매 keystroke마다 store 전체를
 *            JSON 직렬화 → localStorage 쓰기 발생. Zustand v4 persist에는
 *            throttle 옵션이 없어 직접 해결 필요.
 *   개선 후: partialize로 persist 범위에서 제외하고, setMemoText 내부에서
 *            debounce 타이머로 500ms 후에만 localStorage에 씀.
 *            초기값은 localStorage에서 직접 읽어 hydration 보장.
 */

// debounce 타이머 — 모듈 레벨에서 관리 (store 외부)
let memoDebounceTimer: ReturnType<typeof setTimeout> | null = null;

const saveMemoDebounced = (text: string) => {
  if (memoDebounceTimer) clearTimeout(memoDebounceTimer);
  memoDebounceTimer = setTimeout(() => {
    try { localStorage.setItem(MEMO_STORAGE_KEY, text); } catch { /* storage full 등 무시 */ }
  }, MEMO_DEBOUNCE_MS);
};

const loadMemoInitial = (): string => {
  try { return localStorage.getItem(MEMO_STORAGE_KEY) ?? "Today's key goal!\n- Drink 2L water"; }
  catch { return "Today's key goal!\n- Drink 2L water"; }
};

export const useAppStore = create<StoreState>()(
  persist(
    (set) => ({
      appSettings: DEFAULT_SETTINGS,
      memoText: loadMemoInitial(),
      updateSetting: (key, value) =>
        set((state) => ({ appSettings: { ...state.appSettings, [key]: value } })),
      setMemoText: (text) => {
        set({ memoText: text });
        saveMemoDebounced(text);
      },
    }),
    {
      name: 'planner-storage',
      storage: createJSONStorage(() => localStorage),
      version: 1,
      // memoText는 별도 키로 debounce 저장하므로 persist 범위에서 제외
      partialize: (state) => ({ appSettings: state.appSettings }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<StoreState>;
        if (version < 1) {
          return {
            ...state,
            appSettings: { ...DEFAULT_SETTINGS, ...(state.appSettings ?? {}) },
          };
        }
        return state as StoreState;
      },
    }
  )
);
