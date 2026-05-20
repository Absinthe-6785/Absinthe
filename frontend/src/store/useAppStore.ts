import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { AppSettings } from '../types';
import { API_URL } from '../lib/config';
import { authFetch } from '../lib/supabase';

// ─── 타입 정의 ────────────────────────────────────────────────────────
export interface NoteFolder {
  id: string;
  name: string;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  updatedAt: number;
  folderId: string | null;   // null = 전체 (미분류)
  deletedAt: number | null;  // null = 정상, timestamp = 휴지통
  starred?: boolean;         // NoteView 즐겨찾기 (optional — 구버전 호환)
}

interface StoreState {
  appSettings: AppSettings;
  memoText: string;
  notes: Note[];
  folders: NoteFolder[];
  activeNoteId: string | null;
  activeFolderId: string | null | 'trash'; // null=전체, 'trash'=휴지통
  updateSetting: (key: keyof AppSettings, value: AppSettings[keyof AppSettings]) => void;
  setMemoText: (text: string) => void;
  // Folder CRUD
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  setActiveFolderId: (id: string | null | 'trash') => void;
  // Note CRUD
  createNote: () => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred'>>) => void;
  moveNoteToTrash: (id: string) => void;
  restoreNote: (id: string) => void;
  permanentDeleteNote: (id: string) => void;
  setActiveNoteId: (id: string | null) => void;
  // DB sync
  fetchNotes: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  syncNote: (note: Note) => Promise<void>;
  removeNoteFromDB: (id: string) => Promise<void>;
  syncFolder: (folder: NoteFolder) => Promise<void>;
  removeFolderFromDB: (id: string) => Promise<void>;
  // kg/lbs
  weightUnits: Record<string, 'kg' | 'lbs'>;
  setWeightUnit: (blockId: string, unit: 'kg' | 'lbs') => void;
  toggleWeightUnit: (blockId: string) => void;
}

const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  defaultCategory: 'Study',
  defaultColor: 'gold',
  language: 'en',
};

const NOTES_KEY   = 'planner-notes-v2';
const FOLDERS_KEY = 'planner-note-folders';
const ACTIVE_KEY  = 'planner-active-note';
const MEMO_MS     = 500;

let notesTimer: ReturnType<typeof setTimeout> | null = null;
const saveNotes = (notes: Note[]) => {
  if (notesTimer) clearTimeout(notesTimer);
  notesTimer = setTimeout(() => {
    try { localStorage.setItem(NOTES_KEY, JSON.stringify(notes)); } catch { /**/ }
  }, MEMO_MS);
};

const saveFolders = (folders: NoteFolder[]) => {
  try { localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders)); } catch { /**/ }
};

const syncTimers: Record<string, ReturnType<typeof setTimeout>> = {};
const syncDebounced = (note: Note, fn: (n: Note) => void) => {
  if (syncTimers[note.id]) clearTimeout(syncTimers[note.id]);
  syncTimers[note.id] = setTimeout(() => fn(note), 1500);
};

const loadNotes = (): Note[] => {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (raw) return JSON.parse(raw) as Note[];
    // 구버전 마이그레이션
    const old = localStorage.getItem('planner-notes');
    if (old) {
      const parsed = JSON.parse(old) as Note[];
      return parsed.map(n => ({ ...n, folderId: null, deletedAt: null }));
    }
  } catch { /**/ }
  return [{ id: `note-${Date.now()}`, title: "Today's key goal!", body: '- Drink 2L water', updatedAt: Date.now(), folderId: null, deletedAt: null }];
};

const loadActive = (notes: Note[]): string | null => {
  try {
    const s = localStorage.getItem(ACTIVE_KEY);
    return (s && notes.find(n => n.id === s)) ? s : (notes.find(n => !n.deletedAt)?.id ?? null);
  } catch { return notes.find(n => !n.deletedAt)?.id ?? null; }
};

const loadFolders = (): NoteFolder[] => {
  try {
    const raw = localStorage.getItem(FOLDERS_KEY);
    if (raw) return JSON.parse(raw) as NoteFolder[];
  } catch { /**/ }
  return [];
};

export const useAppStore = create<StoreState>()(
  persist(
    (set, get) => {
      const initialNotes = loadNotes();
      const initialFolders = loadFolders();
      return {
        appSettings: DEFAULT_SETTINGS,
        memoText: '',
        // ⚠️  notes/folders/activeNoteId는 PlannerView Memo 전용.
        //     NoteView는 별도 localStorage 키(NV_NOTES_KEY)와 자체 useState로 독립 관리.
        //     두 시스템은 키가 달라 충돌 없음. 향후 통합 시 NoteView 쪽으로 일원화 권장.
        notes: initialNotes,
        folders: initialFolders,
        activeNoteId: loadActive(initialNotes),
        activeFolderId: null,

        updateSetting: (key, value) =>
          set(s => ({ appSettings: { ...s.appSettings, [key]: value } })),
        setMemoText: text => set({ memoText: text }),

        // ── Folder ──────────────────────────────────────────────────
        createFolder: (name) => {
          const id = `folder-${Date.now()}`;
          const folder: NoteFolder = { id, name, createdAt: Date.now() };
          const folders = [...get().folders, folder];
          set({ folders, activeFolderId: id });
          saveFolders(folders);
          get().syncFolder(folder);
          return id;
        },
        renameFolder: (id, name) => {
          const folders = get().folders.map(f => f.id === id ? { ...f, name } : f);
          set({ folders });
          saveFolders(folders);
          const folder = folders.find(f => f.id === id);
          if (folder) get().syncFolder(folder);
        },
        deleteFolder: (id) => {
          // 폴더 삭제 시 소속 노트는 미분류(folderId=null)로 이동
          // set() 전에 이동 대상 id를 먼저 캡처 — set() 이후 get().notes는 이미 변경된 상태라
          // folderId로 원래 소속을 추적할 수 없음
          const movedNoteIds = new Set(get().notes.filter(n => n.folderId === id).map(n => n.id));
          const notes = get().notes.map(n => n.folderId === id ? { ...n, folderId: null } : n);
          const folders = get().folders.filter(f => f.id !== id);
          const activeFolderId = get().activeFolderId === id ? null : get().activeFolderId;
          set({ folders, notes, activeFolderId });
          saveNotes(notes);
          saveFolders(folders);
          get().removeFolderFromDB(id);
          // 실제로 이 폴더에 속했던 노트만 DB sync (원래 미분류였던 노트 제외)
          notes.filter(n => movedNoteIds.has(n.id)).forEach(n => get().syncNote(n));
        },
        setActiveFolderId: id => set({ activeFolderId: id }),

        // ── Note ────────────────────────────────────────────────────
        createNote: () => {
          const id = `note-${Date.now()}`;
          const folderId = (() => {
            const af = get().activeFolderId;
            return (af === null || af === 'trash') ? null : af;
          })();
          const note: Note = { id, title: 'New Note', body: '', updatedAt: Date.now(), folderId, deletedAt: null };
          const notes = [note, ...get().notes];
          set({ notes, activeNoteId: id });
          saveNotes(notes);
          try { localStorage.setItem(ACTIVE_KEY, id); } catch { /**/ }
          get().syncNote(note);
          return id;
        },
        updateNote: (id, patch) => {
          const notes = get().notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n);
          notes.sort((a, b) => {
            if (!!a.deletedAt !== !!b.deletedAt) return a.deletedAt ? 1 : -1;
            return b.updatedAt - a.updatedAt;
          });
          set({ notes });
          saveNotes(notes);
          const updated = notes.find(n => n.id === id);
          if (updated) syncDebounced(updated, n => get().syncNote(n));
        },
        moveNoteToTrash: (id) => {
          const notes = get().notes.map(n =>
            n.id === id ? { ...n, deletedAt: Date.now() } : n
          );
          // 휴지통 이동 후 다음 활성 노트로 이동
          const nextActive = notes.find(n => !n.deletedAt)?.id ?? null;
          set({ notes, activeNoteId: nextActive });
          saveNotes(notes);
          const updated = notes.find(n => n.id === id);
          if (updated) get().syncNote(updated);
        },
        restoreNote: (id) => {
          const notes = get().notes.map(n =>
            n.id === id ? { ...n, deletedAt: null, updatedAt: Date.now() } : n
          );
          set({ notes, activeNoteId: id, activeFolderId: notes.find(n => n.id === id)?.folderId ?? null });
          saveNotes(notes);
          const updated = notes.find(n => n.id === id);
          if (updated) get().syncNote(updated);
        },
        permanentDeleteNote: (id) => {
          const notes = get().notes.filter(n => n.id !== id);
          const nextActive = get().activeNoteId === id ? (notes.find(n => !n.deletedAt)?.id ?? null) : get().activeNoteId;
          set({ notes, activeNoteId: nextActive });
          saveNotes(notes);
          get().removeNoteFromDB(id);
        },
        setActiveNoteId: id => {
          set({ activeNoteId: id });
          try { localStorage.setItem(ACTIVE_KEY, id ?? ''); } catch { /**/ }
        },

        // ── DB sync ─────────────────────────────────────────────────
        fetchNotes: async () => {
          try {
            const res = await authFetch(`${API_URL}/api/notes`);
            if (!res.ok) return;
            const raw = await res.json();
            const localNotes = get().notes;

            // DB 노트 변환 — folder_id/deleted_at 없는 구버전 DB는 localStorage 값 우선
            const dbNotes: Note[] = raw.map((n: { id: string; title: string; body: string; updated_at: number; folder_id?: string | null; deleted_at?: number | null }) => {
              const local = localNotes.find(l => l.id === n.id);
              return {
                id: n.id,
                title: n.title,
                body: n.body,
                updatedAt: n.updated_at,
                // DB에 folder_id 컬럼이 있고 값이 있으면 DB 우선, 없으면 localStorage 보존
                folderId: (n.folder_id != null) ? n.folder_id : (local?.folderId ?? null),
                // DB에 deleted_at 컬럼이 있으면 DB 우선, 없으면 localStorage 보존
                deletedAt: (n.deleted_at !== undefined) ? (n.deleted_at ?? null) : (local?.deletedAt ?? null),
              };
            });

            // 30일 지난 휴지통 노트 자동 제거 (백그라운드)
            const MONTH = 30 * 24 * 60 * 60 * 1000;
            const valid = dbNotes.filter(n => !n.deletedAt || (Date.now() - n.deletedAt < MONTH));
            const expired = dbNotes.filter(n => n.deletedAt && Date.now() - n.deletedAt >= MONTH);
            expired.forEach(n => get().removeNoteFromDB(n.id));

            if (valid.length > 0) {
              // activeNoteId는 현재 값 유지 (덮어쓰지 않음)
              const currentActiveId = get().activeNoteId;
              const activeStillValid = valid.some(n => n.id === currentActiveId && !n.deletedAt);
              set({
                notes: valid,
                activeNoteId: activeStillValid ? currentActiveId : (valid.find(n => !n.deletedAt)?.id ?? null),
              });
              saveNotes(valid);

              // localStorage에만 있던 folderId를 DB에 일괄 반영 (최초 1회)
              const needsSync = valid.filter(n => {
                const dbRaw = raw.find((r: { id: string }) => r.id === n.id);
                return n.folderId != null && dbRaw?.folder_id == null;
              });
              if (needsSync.length > 0) {
                // 병렬 sync (경쟁 조건 없음 — upsert)
                await Promise.all(needsSync.map(n => get().syncNote(n)));
              }
            } else {
              // DB에 노트 없음 → localStorage 노트를 DB에 업로드
              const local = get().notes;
              await Promise.all(local.map(note =>
                authFetch(`${API_URL}/api/notes`, {
                  method: 'POST',
                  body: JSON.stringify({ id: note.id, title: note.title, body: note.body, updated_at: note.updatedAt, folder_id: note.folderId, deleted_at: note.deletedAt }),
                })
              ));
            }
          } catch { /**/ }
        },
        fetchFolders: async () => {
          try {
            const res = await authFetch(`${API_URL}/api/note_folders`);
            if (!res.ok) return;
            const raw = await res.json();
            const folders: NoteFolder[] = raw.map((f: { id: string; name: string; created_at: number }) => ({
              id: f.id, name: f.name, createdAt: f.created_at,
            }));
            set({ folders });
            saveFolders(folders);
          } catch { /**/ }
        },
        syncNote: async (note) => {
          try {
            await authFetch(`${API_URL}/api/notes`, {
              method: 'POST',
              body: JSON.stringify({ id: note.id, title: note.title, body: note.body, updated_at: note.updatedAt, folder_id: note.folderId, deleted_at: note.deletedAt }),
            });
          } catch { /**/ }
        },
        removeNoteFromDB: async (id) => {
          try { await authFetch(`${API_URL}/api/notes/${id}`, { method: 'DELETE' }); } catch { /**/ }
        },
        syncFolder: async (folder) => {
          try {
            await authFetch(`${API_URL}/api/note_folders`, {
              method: 'POST',
              body: JSON.stringify({ id: folder.id, name: folder.name, created_at: folder.createdAt }),
            });
          } catch { /**/ }
        },
        removeFolderFromDB: async (id) => {
          try { await authFetch(`${API_URL}/api/note_folders/${id}`, { method: 'DELETE' }); } catch { /**/ }
        },

        // ── weightUnits ─────────────────────────────────────────────
        weightUnits: (() => {
          try {
            const raw = localStorage.getItem('planner-storage');
            if (raw) return JSON.parse(raw)?.state?.weightUnits ?? {};
          } catch { /**/ }
          return {};
        })(),
        setWeightUnit: (blockId, unit) =>
          set(s => ({ weightUnits: { ...s.weightUnits, [blockId]: unit } })),
        toggleWeightUnit: (blockId) =>
          set(s => ({ weightUnits: { ...s.weightUnits, [blockId]: s.weightUnits[blockId] === 'lbs' ? 'kg' : 'lbs' } })),
      };
    },
    {
      name: 'planner-storage',
      storage: createJSONStorage(() => localStorage),
      version: 4,
      partialize: s => ({ appSettings: s.appSettings, weightUnits: s.weightUnits }),
      // v1→v2: 초기 버전 (appSettings만 persist)
      // v2→v3: weightUnits 추가
      // v3→v4: appSettings.language 추가
      // v5 이상 추가 시: fromVersion별 분기로 마이그레이션 로직 확장
      migrate: (persisted: unknown, fromVersion: number) => {
        const s = persisted as Partial<StoreState>;
        // 모든 버전 공통: DEFAULT_SETTINGS로 누락 필드 보완 + weightUnits 초기화
        // fromVersion이 낮을수록 더 많은 필드가 누락될 수 있으나
        // DEFAULT_SETTINGS spread로 안전하게 복원 가능한 단순 구조이므로 단일 로직 유지.
        // 향후 스키마 변경(필드 제거/rename)이 생기면 fromVersion 분기 추가 필요.
        if (fromVersion < 1) {
          // v0 이하: 완전 초기화
          return { appSettings: DEFAULT_SETTINGS, weightUnits: {} } as StoreState;
        }
        return { ...s, appSettings: { ...DEFAULT_SETTINGS, ...(s.appSettings ?? {}) }, weightUnits: s.weightUnits ?? {} } as StoreState;
      },
      onRehydrateStorage: () => s => {
        if (s && !s.weightUnits) s.weightUnits = {};
      },
    }
  )
);
