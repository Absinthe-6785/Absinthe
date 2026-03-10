import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings } from '../types';

// ─── 다중 메모 타입 ───────────────────────────────────────────────────────────
export interface Note {
  id: string;
  title: string;   // 첫 줄
  body: string;    // 나머지 본문
  updatedAt: number; // Date.now()
}

interface StoreState {
  appSettings: AppSettings;
  /** 하위호환용 단일 메모 — 마이그레이션 후 미사용 */
  memoText: string;
  /** 다중 노트 목록 */
  notes: Note[];
  /** 현재 열려있는 노트 ID */
  activeNoteId: string | null;
  updateSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => void;
  setMemoText: (text: string) => void;
  // Notes CRUD
  createNote: () => string;           // 새 노트 생성 후 id 반환
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body'>>) => void;
  deleteNote: (id: string) => void;
  setActiveNoteId: (id: string | null) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  defaultCategory: 'Study',
  defaultColor: 'gold',
};

const NOTES_STORAGE_KEY = 'planner-notes';
const ACTIVE_NOTE_KEY   = 'planner-active-note';
const MEMO_DEBOUNCE_MS  = 500;

// debounce 타이머
let notesDebounceTimer: ReturnType<typeof setTimeout> | null = null;
const saveNotesDebounced = (notes: Note[]) => {
  if (notesDebounceTimer) clearTimeout(notesDebounceTimer);
  notesDebounceTimer = setTimeout(() => {
    try { localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes)); } catch { /* ignore */ }
  }, MEMO_DEBOUNCE_MS);
};

// 초기 노트 로드 — 기존 단일 메모를 첫 노트로 마이그레이션
const loadNotesInitial = (): Note[] => {
  try {
    const raw = localStorage.getItem(NOTES_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as Note[];
    // 기존 단일 메모 마이그레이션
    const legacy = localStorage.getItem('planner-memo');
    const lines = (legacy ?? "Today's key goal!\n- Drink 2L water").split('\n');
    return [{
      id: `note-${Date.now()}`,
      title: lines[0] || 'My first note',
      body: lines.slice(1).join('\n'),
      updatedAt: Date.now(),
    }];
  } catch {
    return [{ id: `note-${Date.now()}`, title: 'My first note', body: '', updatedAt: Date.now() }];
  }
};

const loadActiveNoteId = (notes: Note[]): string | null => {
  try {
    const saved = localStorage.getItem(ACTIVE_NOTE_KEY);
    return (saved && notes.find(n => n.id === saved)) ? saved : (notes[0]?.id ?? null);
  } catch { return notes[0]?.id ?? null; }
};

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => {
      const initialNotes = loadNotesInitial();
      const initialActiveId = loadActiveNoteId(initialNotes);
      return {
        appSettings: DEFAULT_SETTINGS,
        memoText: '',
        notes: initialNotes,
        activeNoteId: initialActiveId,
        updateSetting: (key, value) =>
          set((state) => ({ appSettings: { ...state.appSettings, [key]: value } })),
        setMemoText: (text) => set({ memoText: text }),

        createNote: () => {
          const id = `note-${Date.now()}`;
          const newNote: Note = { id, title: 'New Note', body: '', updatedAt: Date.now() };
          const notes = [newNote, ...get().notes];
          set({ notes, activeNoteId: id });
          saveNotesDebounced(notes);
          try { localStorage.setItem(ACTIVE_NOTE_KEY, id); } catch { /* ignore */ }
          return id;
        },

        updateNote: (id, patch) => {
          const notes = get().notes.map(n =>
            n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n
          );
          // 최근 수정 노트를 맨 앞으로 정렬
          notes.sort((a, b) => b.updatedAt - a.updatedAt);
          set({ notes });
          saveNotesDebounced(notes);
        },

        deleteNote: (id) => {
          const notes = get().notes.filter(n => n.id !== id);
          const activeNoteId = get().activeNoteId === id
            ? (notes[0]?.id ?? null)
            : get().activeNoteId;
          set({ notes, activeNoteId });
          saveNotesDebounced(notes);
          try { localStorage.setItem(ACTIVE_NOTE_KEY, activeNoteId ?? ''); } catch { /* ignore */ }
        },

        setActiveNoteId: (id) => {
          set({ activeNoteId: id });
          try { localStorage.setItem(ACTIVE_NOTE_KEY, id ?? ''); } catch { /* ignore */ }
        },
      };
    },
    {
      name: 'planner-storage',
      storage: createJSONStorage(() => localStorage),
      version: 2,
      partialize: (state) => ({ appSettings: state.appSettings }),
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as Partial<StoreState>;
        if (version < 2) {
          return { ...state, appSettings: { ...DEFAULT_SETTINGS, ...(state.appSettings ?? {}) } };
        }
        return state as StoreState;
      },
    }
  )
);
