/**
 * useNotesStore — Notes + Planner Memo 공유 노트 상태
 *
 * 단일 localStorage(notes-v2 등) + DB sync.
 * NoteView·PlannerView 모두 이 스토어를 사용한다.
 */
import { create } from 'zustand';
import {
  applyVaultRestore,
  type VaultRestoreConflictStrategy,
  type VaultRestoreResult,
} from '../lib/importVaultBackup';
import type { VaultBackupManifest } from '../lib/exportVaultBackup';
import { API_URL } from '../lib/config';
import { authFetch } from '../lib/supabase';
import {
  type NoteBase as Note,
  type NoteFolderBase as NoteFolder,
  loadNotes,
  loadFolders,
  loadActiveNoteId,
  saveNotes,
  saveFolders,
  saveActiveNoteId,
  clearNotesStorage,
  createDefaultWelcomeNotes,
  mergeDbAndLocalNotes,
  getLocalOnlyNotes,
  mergeFolderArrays,
  mergeNotesFromStorageJson,
  mergeFoldersFromStorageJson,
  normalizeNoteFolderId,
  noteSyncPayload,
  normalizeNoteProperties,
  NOTES_KEY,
  FOLDERS_KEY,
  ACTIVE_KEY,
  NOTE_TRASH_RETENTION_MS,
  LOCAL_NOTES_SAVE_ERROR,
  LOCAL_FOLDERS_SAVE_ERROR,
} from '../components/views/noteUtils';
import { knowledgeIndexService } from '../components/views/features/knowledge';
import {
  clearKnowledgeHistory,
  recordNoteCreated,
  recordNoteDeleted,
  recordNoteUpdateDiff,
} from '../components/views/features/knowledge/history';

export type { Note, NoteFolder };

export interface CreateNoteOpts {
  title?: string;
  body?: string;
  folderId?: string | null;
  /** UI 가상 폴더(trash/starred) — folderId 미지정 시 사용 */
  folderContext?: string | null | 'trash' | 'starred';
}

interface NotesState {
  notes: Note[];
  folders: NoteFolder[];
  activeNoteId: string | null;
  /** Planner Memo 패널용 폴더 필터 (NoteView는 자체 activeFolderId + starred 사용) */
  activeFolderId: string | null | 'trash';
  isSyncing: boolean;
  savedAt: Date | null;
  syncError: string | null;

  setActiveNoteId: (id: string | null) => void;
  setActiveFolderId: (id: string | null | 'trash') => void;
  createNote: (opts?: CreateNoteOpts) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  toggleStar: (id: string) => void;
  duplicateNote: (note: Note) => string;
  moveNoteToTrash: (id: string) => void;
  restoreNote: (id: string) => void;
  permanentDeleteNote: (id: string) => void;
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  importNote: (note: Note) => void;
  importVaultRestore: (manifest: VaultBackupManifest, strategy: VaultRestoreConflictStrategy) => VaultRestoreResult;

  hydrateFromDB: () => Promise<void>;
  syncNoteToDB: (note: Note) => Promise<boolean>;
  flushPendingSync: () => void;
  retrySync: () => void;
  /** Settings Reset — localStorage + in-memory notes 초기화 */
  resetAllNotes: () => void;
}

// ── 노트별 body debounce (리렌더 불필요) ───────────────────────────
// 단일 pending 슬롯은 노트 전환·탭 종료 시 이전 노트 sync 유실 → id별 Map 사용
const pendingBodySync = new Map<string, Note>();
const bodySyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
let lastFailedNote: Note | null = null;
let lastFailedDeleteId: string | null = null;
const BODY_SYNC_MS = 600;

function clearBodySyncTimer(noteId: string) {
  const t = bodySyncTimers.get(noteId);
  if (t) {
    clearTimeout(t);
    bodySyncTimers.delete(noteId);
  }
}

function clearAllBodySyncTimers() {
  for (const t of bodySyncTimers.values()) clearTimeout(t);
  bodySyncTimers.clear();
}

function resolveFolderId(opts?: CreateNoteOpts): string | null {
  if (opts?.folderId !== undefined) return opts.folderId;
  return normalizeNoteFolderId(opts?.folderContext ?? null);
}

function mapDbNote(
  n: {
    id: string;
    title: string;
    body: string;
    updated_at: number;
    folder_id?: string | null;
    deleted_at?: number | null;
    starred?: boolean;
    properties?: Record<string, string> | null;
  },
  local: Note | undefined,
): Note {
  const localIsNewer = local && local.updatedAt > n.updated_at;
  return {
    id: n.id,
    title:     localIsNewer ? (local.title ?? '') : (n.title ?? ''),
    body:      localIsNewer ? (local.body  ?? '') : (n.body  ?? ''),
    updatedAt: localIsNewer ? local.updatedAt     : n.updated_at,
    folderId:  localIsNewer
      ? (local.folderId ?? null)
      : (n.folder_id != null ? n.folder_id : (local?.folderId ?? null)),
    deletedAt: localIsNewer
      ? (local.deletedAt ?? null)
      : (n.deleted_at !== undefined ? (n.deleted_at ?? null) : (local?.deletedAt ?? null)),
    starred:   localIsNewer ? (local.starred ?? false) : (n.starred ?? local?.starred ?? false),
    properties: localIsNewer
      ? normalizeNoteProperties(local.properties)
      : normalizeNoteProperties(n.properties ?? local?.properties),
  };
}

const initialNotes = loadNotes();
const initialFolders = loadFolders();
knowledgeIndexService.buildFromNotes(initialNotes);

function rebuildKnowledgeIndex(notes: Note[]) {
  knowledgeIndexService.buildFromNotes(notes);
}

function syncKnowledgeIndexForNote(note: Note, patch?: Partial<Note>) {
  if (
    !patch ||
    'body' in patch ||
    'title' in patch ||
    'deletedAt' in patch ||
    'properties' in patch ||
    'relations' in patch
  ) {
    knowledgeIndexService.updateNote(note);
  }
}

export const useNotesStore = create<NotesState>((set, get) => {
  const syncNoteToDB = async (note: Note): Promise<boolean> => {
    try {
      const res = await authFetch(`${API_URL}/api/notes`, {
        method: 'POST',
        body: JSON.stringify(noteSyncPayload(note)),
      });
      if (!res.ok) {
        lastFailedNote = note;
        set({ syncError: `Cloud sync failed (${res.status})` });
        return false;
      }
      lastFailedNote = null;
      if (!lastFailedDeleteId) set({ syncError: null, savedAt: new Date() });
      else set({ savedAt: new Date() });
      return true;
    } catch (err) {
      lastFailedNote = note;
      set({ syncError: err instanceof Error ? err.message : 'Cloud sync failed' });
      return false;
    }
  };

  const removeNoteFromDB = async (id: string): Promise<boolean> => {
    try {
      const res = await authFetch(`${API_URL}/api/notes/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        lastFailedDeleteId = id;
        set({ syncError: `Cloud delete failed (${res.status})` });
        return false;
      }
      if (lastFailedDeleteId === id) lastFailedDeleteId = null;
      if (!lastFailedNote) set({ syncError: null });
      return true;
    } catch (err) {
      lastFailedDeleteId = id;
      set({ syncError: err instanceof Error ? err.message : 'Cloud delete failed' });
      return false;
    }
  };

  const persistNotes = (notes: Note[]) => {
    if (!saveNotes(notes)) set({ syncError: LOCAL_NOTES_SAVE_ERROR });
  };

  const persistFolders = (folders: NoteFolder[]) => {
    if (!saveFolders(folders)) set({ syncError: LOCAL_FOLDERS_SAVE_ERROR });
  };

  const syncFolderToDB = async (folder: NoteFolder) => {
    try {
      await authFetch(`${API_URL}/api/note_folders`, {
        method: 'POST',
        body: JSON.stringify({ id: folder.id, name: folder.name, created_at: folder.createdAt }),
      });
    } catch { /**/ }
  };

  const removeFolderFromDB = async (id: string) => {
    try { await authFetch(`${API_URL}/api/note_folders/${id}`, { method: 'DELETE' }); } catch { /**/ }
  };

  const flushPendingSync = () => {
    clearAllBodySyncTimers();
    const pending = [...pendingBodySync.values()];
    pendingBodySync.clear();
    for (const note of pending) void syncNoteToDB(note);
  };

  const scheduleBodySync = (note: Note) => {
    pendingBodySync.set(note.id, note);
    clearBodySyncTimer(note.id);
    bodySyncTimers.set(note.id, setTimeout(() => {
      bodySyncTimers.delete(note.id);
      const latest = pendingBodySync.get(note.id);
      pendingBodySync.delete(note.id);
      if (latest) void syncNoteToDB(latest);
    }, BODY_SYNC_MS));
  };

  return {
    notes: initialNotes,
    folders: initialFolders,
    activeNoteId: loadActiveNoteId(initialNotes),
    activeFolderId: null,
    isSyncing: false,
    savedAt: null,
    syncError: null,

    setActiveNoteId: (id) => {
      if (id) {
        const now = Date.now();
        const notes = get().notes.map(n =>
          n.id === id ? { ...n, lastOpenedAt: now } : n,
        );
        set({ activeNoteId: id, notes });
        persistNotes(notes);
      } else {
        set({ activeNoteId: id });
      }
      saveActiveNoteId(id);
    },

    setActiveFolderId: (id) => set({ activeFolderId: id }),

    createNote: (opts) => {
      const id = `note-${Date.now()}`;
      const now = Date.now();
      const note: Note = {
        id,
        title: opts?.title ?? '',
        body: opts?.body ?? '',
        createdAt: now,
        lastOpenedAt: now,
        updatedAt: now,
        folderId: resolveFolderId(opts),
        deletedAt: null,
        starred: false,
      };
      const notes = [note, ...get().notes];
      set({ notes, activeNoteId: id });
      persistNotes(notes);
      saveActiveNoteId(id);
      knowledgeIndexService.updateNote(note);
      recordNoteCreated(id);
      void syncNoteToDB(note);
      return id;
    },

    importNote: (note) => {
      const notes = [note, ...get().notes];
      set({ notes, activeNoteId: note.id });
      persistNotes(notes);
      saveActiveNoteId(note.id);
      knowledgeIndexService.updateNote(note);
      void syncNoteToDB(note);
    },

    importVaultRestore: (manifest, strategy) => {
      const beforeIds = new Set(get().notes.map(n => n.id));
      const prevFolderIds = new Set(get().folders.map(f => f.id));
      const { notes, folders, result } = applyVaultRestore(
        manifest,
        get().notes,
        get().folders,
        strategy,
      );
      set({ notes, folders });
      persistNotes(notes);
      persistFolders(folders);
      for (const note of notes) {
        knowledgeIndexService.updateNote(note);
      }
      const manifestIds = new Set(manifest.notes.map(n => n.id));
      for (const note of notes) {
        if (!note.deletedAt && (
          !beforeIds.has(note.id) ||
          (manifestIds.has(note.id) && strategy === 'replace')
        )) {
          void syncNoteToDB(note);
        }
      }
      folders
        .filter(f => !prevFolderIds.has(f.id))
        .forEach(f => { void syncFolderToDB(f); });
      flushPendingSync();
      return result;
    },

    updateNote: (id, patch) => {
      const previous = get().notes.find(n => n.id === id);
      const normalizedPatch = 'properties' in patch
        ? { ...patch, properties: normalizeNoteProperties(patch.properties) }
        : patch;
      const notes = get().notes.map(n =>
        n.id === id ? { ...n, ...normalizedPatch, updatedAt: Date.now() } : n
      );
      set({ notes });
      persistNotes(notes);
      const updated = notes.find(n => n.id === id);
      if (!updated) return;
      if (previous) recordNoteUpdateDiff(previous, updated);
      syncKnowledgeIndexForNote(updated, patch);
      if ('body' in patch) {
        scheduleBodySync(updated);
      } else {
        flushPendingSync();
        void syncNoteToDB(updated);
      }
    },

    toggleStar: (id) => {
      const notes = get().notes.map(n =>
        n.id === id ? { ...n, starred: !n.starred, updatedAt: Date.now() } : n
      );
      set({ notes });
      persistNotes(notes);
      const note = notes.find(n => n.id === id);
      if (note) void syncNoteToDB(note);
    },

    duplicateNote: (note) => {
      const id = `note-${Date.now()}`;
      const now = Date.now();
      const copy: Note = {
        ...note,
        id,
        title: note.title + ' (copy)',
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      const notes = [copy, ...get().notes];
      set({ notes, activeNoteId: id });
      persistNotes(notes);
      saveActiveNoteId(id);
      knowledgeIndexService.updateNote(copy);
      recordNoteCreated(id);
      void syncNoteToDB(copy);
      return id;
    },

    moveNoteToTrash: (id) => {
      const now = Date.now();
      const notes = get().notes.map(n =>
        n.id === id ? { ...n, deletedAt: now, updatedAt: now } : n
      );
      const nextActive = notes.find(n => !n.deletedAt)?.id ?? null;
      set({ notes, activeNoteId: nextActive });
      persistNotes(notes);
      saveActiveNoteId(nextActive);
      const trashed = notes.find(n => n.id === id);
      if (trashed) {
        knowledgeIndexService.removeNote(id);
        void syncNoteToDB(trashed);
      }
    },

    restoreNote: (id) => {
      const notes = get().notes.map(n =>
        n.id === id ? { ...n, deletedAt: null, updatedAt: Date.now() } : n
      );
      const restored = notes.find(n => n.id === id);
      set({
        notes,
        activeNoteId: id,
        activeFolderId: restored?.folderId ?? get().activeFolderId,
      });
      persistNotes(notes);
      saveActiveNoteId(id);
      if (restored) {
        knowledgeIndexService.updateNote(restored);
        void syncNoteToDB(restored);
      }
    },

    permanentDeleteNote: (id) => {
      clearBodySyncTimer(id);
      pendingBodySync.delete(id);
      recordNoteDeleted(id);
      knowledgeIndexService.removeNote(id);
      const notes = get().notes.filter(n => n.id !== id);
      const nextActive = get().activeNoteId === id
        ? (notes.find(n => !n.deletedAt)?.id ?? null)
        : get().activeNoteId;
      set({ notes, activeNoteId: nextActive });
      persistNotes(notes);
      saveActiveNoteId(nextActive);
      void removeNoteFromDB(id);
    },

    createFolder: (name) => {
      const id = `folder-${Date.now()}`;
      const folder: NoteFolder = { id, name, createdAt: Date.now() };
      const folders = [...get().folders, folder];
      set({ folders, activeFolderId: id });
      persistFolders(folders);
      void syncFolderToDB(folder);
      return id;
    },

    renameFolder: (id, name) => {
      const folders = get().folders.map(f => f.id === id ? { ...f, name } : f);
      set({ folders });
      persistFolders(folders);
      const folder = folders.find(f => f.id === id);
      if (folder) void syncFolderToDB(folder);
    },

    deleteFolder: (id) => {
      const movedIds = new Set(get().notes.filter(n => n.folderId === id).map(n => n.id));
      const now = Date.now();
      const notes = get().notes.map(n =>
        movedIds.has(n.id) ? { ...n, folderId: null, updatedAt: now } : n
      );
      const folders = get().folders.filter(f => f.id !== id);
      const activeFolderId = get().activeFolderId === id ? null : get().activeFolderId;
      set({ folders, notes, activeFolderId });
      persistNotes(notes);
      persistFolders(folders);
      void removeFolderFromDB(id);
      notes.filter(n => movedIds.has(n.id)).forEach(n => { void syncNoteToDB(n); });
    },

    hydrateFromDB: async () => {
      set({ isSyncing: true });
      try {
        const fRes = await authFetch(`${API_URL}/api/note_folders`);
        if (!fRes.ok) set({ syncError: `Failed to load folders (${fRes.status})` });
        if (fRes.ok) {
          const raw = await fRes.json();
          const dbFolders: NoteFolder[] = raw.map((f: { id: string; name: string; created_at: number }) => ({
            id: f.id, name: f.name, createdAt: f.created_at,
          }));
          const localFolders = get().folders;
          const dbIds = new Set(dbFolders.map(f => f.id));
          const localOnly = localFolders.filter(f => !dbIds.has(f.id));
          const mergedFolders = mergeFolderArrays(localOnly, dbFolders);
          if (mergedFolders.length > 0) {
            set({ folders: mergedFolders });
            persistFolders(mergedFolders);
            if (localOnly.length > 0) {
              await Promise.allSettled(localOnly.map(f => syncFolderToDB(f)));
            }
          }
        }

        const nRes = await authFetch(`${API_URL}/api/notes`);
        if (!nRes.ok) set({ syncError: `Failed to load notes (${nRes.status})` });
        if (nRes.ok) {
          const raw = await nRes.json();
          const localNotes = get().notes;
          const dbNotes: Note[] = raw.map((n: Parameters<typeof mapDbNote>[0]) => {
            const local = localNotes.find(l => l.id === n.id);
            return mapDbNote(n, local);
          });

          const dbIds = raw.map((n: { id: string }) => n.id);
          const localOnly = getLocalOnlyNotes(dbIds, localNotes);
          if (localOnly.length > 0) {
            await Promise.allSettled(localOnly.map(note => syncNoteToDB(note)));
          }

          const expired = dbNotes.filter(
            n => n.deletedAt && Date.now() - n.deletedAt >= NOTE_TRASH_RETENTION_MS,
          );
          expired.forEach(n => { void removeNoteFromDB(n.id); });

          const merged = mergeDbAndLocalNotes(dbNotes, localNotes);
          if (dbNotes.length > 0 || localOnly.length > 0) {
            const prevActive = get().activeNoteId;
            const stillValid = merged.some(n => n.id === prevActive && !n.deletedAt);
            const nextActive = stillValid ? prevActive : (merged.find(n => !n.deletedAt)?.id ?? null);
            set({ notes: merged, activeNoteId: nextActive });
            persistNotes(merged);
            saveActiveNoteId(nextActive);
            rebuildKnowledgeIndex(merged);
          } else if (dbNotes.length === 0) {
            await Promise.allSettled(localNotes.map(note => syncNoteToDB(note)));
          }
        }
      } catch (err) {
        set({ syncError: err instanceof Error ? err.message : 'Failed to load from cloud' });
      } finally {
        set({ isSyncing: false });
      }
    },

    syncNoteToDB,
    flushPendingSync,
    retrySync: () => {
      if (!saveNotes(get().notes)) {
        set({ syncError: LOCAL_NOTES_SAVE_ERROR });
        return;
      }
      if (!saveFolders(get().folders)) {
        set({ syncError: LOCAL_FOLDERS_SAVE_ERROR });
        return;
      }
      if (lastFailedDeleteId) {
        void removeNoteFromDB(lastFailedDeleteId);
        return;
      }
      const target = lastFailedNote
        ?? get().notes.find(n => n.id === get().activeNoteId)
        ?? null;
      if (target) void syncNoteToDB(target);
      else if (!lastFailedDeleteId) set({ syncError: null });
    },

    resetAllNotes: () => {
      clearAllBodySyncTimers();
      pendingBodySync.clear();
      lastFailedNote = null;
      lastFailedDeleteId = null;
      clearNotesStorage();
      clearKnowledgeHistory();
      const notes = createDefaultWelcomeNotes();
      set({
        notes,
        folders: [],
        activeNoteId: notes[0]?.id ?? null,
        activeFolderId: null,
        syncError: null,
        savedAt: null,
        isSyncing: false,
      });
      rebuildKnowledgeIndex(notes);
    },
  };
});

// ── 다중 탭: storage 이벤트로 localStorage 변경 병합 ─────────────────
let applyingStorageMerge = false;

function applyStorageMerge(key: string | null, newValue: string | null) {
  if (!key || applyingStorageMerge) return;
  const state = useNotesStore.getState();

  if (key === NOTES_KEY) {
    const merged = mergeNotesFromStorageJson(state.notes, newValue);
    const prevActive = state.activeNoteId;
    const stillValid = merged.some(n => n.id === prevActive && !n.deletedAt);
    const nextActive = stillValid ? prevActive : loadActiveNoteId(merged);
    applyingStorageMerge = true;
    useNotesStore.setState({ notes: merged, activeNoteId: nextActive });
    rebuildKnowledgeIndex(merged);
    if (!saveNotes(merged)) useNotesStore.setState({ syncError: LOCAL_NOTES_SAVE_ERROR });
    if (nextActive !== prevActive) saveActiveNoteId(nextActive);
    applyingStorageMerge = false;
    return;
  }

  if (key === FOLDERS_KEY) {
    const merged = mergeFoldersFromStorageJson(state.folders, newValue);
    applyingStorageMerge = true;
    useNotesStore.setState({ folders: merged });
    if (!saveFolders(merged)) useNotesStore.setState({ syncError: LOCAL_FOLDERS_SAVE_ERROR });
    applyingStorageMerge = false;
    return;
  }

  if (key === ACTIVE_KEY && newValue !== null) {
    const id = newValue || null;
    if (id && state.notes.some(n => n.id === id)) {
      useNotesStore.setState({ activeNoteId: id });
    }
  }
}

// 페이지 이탈 · 탭 전환 시 body debounce flush
if (typeof window !== 'undefined') {
  const flush = () => useNotesStore.getState().flushPendingSync();
  window.addEventListener('pagehide', flush);
  window.addEventListener('beforeunload', flush);
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.storageArea !== localStorage) return;
    applyStorageMerge(e.key, e.newValue);
  });
}

export { applyStorageMerge };
