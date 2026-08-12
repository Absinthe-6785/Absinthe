/**
 * useNotesStore — Notes + Planner Memo 공유 노트 상태
 *
 * 단일 localStorage(notes-v2 등) + DB sync.
 * NoteView·PlannerView 모두 이 스토어를 사용한다.
 */
import { create } from 'zustand';
import {
  applyVaultRestore,
  canonicalizeVaultRestoreManifest,
  validateCanonicalVaultBackupManifest,
  type VaultRestoreConflictStrategy,
  type VaultRestoreResult,
} from '../lib/importVaultBackup';
import type { VaultBackupManifest } from '../lib/exportVaultBackup';
import {
  saveVaultRestoreSnapshot,
  clearVaultRestoreSnapshot,
  hasVaultRestoreSnapshot,
  loadVaultRestoreSnapshot,
} from '../lib/vaultRestoreSnapshot';
import { API_URL } from '../lib/config';
import { authFetch } from '../lib/supabase';
import { scheduleAutoSnapshot } from '../lib/vaultSnapshotAuto';
import '@/lib/notePersistence';
import {
  initNotesPersistence,
  loadNotesAsync,
  saveNotesAsync,
  saveNotesSyncResult,
  getNotesPersistenceMode,
  isNotesIndexedDbRevisionEvent,
  clearNotesPersistence,
} from '../lib/notePersistence';
import {
  type NoteBase as Note,
  type NoteFolderBase as NoteFolder,
  loadNotes,
  loadFolders,
  loadActiveNoteId,
  saveFolders,
  saveActiveNoteId,
  clearNotesStorage,
  createDefaultWelcomeNotes,
  mergeNoteArrays,
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
import { recordArchiveRestore } from '../components/views/features/knowledge/archive/archiveRestoreRecents';
import { knowledgeIndexService } from '../components/views/features/knowledge';
import { invalidateNoteGalaxyMapCache } from '../components/views/features/knowledge/graph/knowledgeUniverse/galaxyClustering';
import {
  fetchFoldersFromCloud,
  fetchNotesFromCloud,
  mapDbFolder,
  mergeDeltaNoteRows,
  computeLastSyncTimestamp,
  getNoteSyncStatus,
  isNotesCloudSyncEnabled,
  noteRevisionTime,
  selectDirtyNotesForPush,
  writeLastNotesSyncAt,
  type NotesSyncMode,
} from '../lib/notesSyncClient';
import { runCoalescedHydrate } from '../lib/syncRequestGate';
import {
  clearKnowledgeHistory,
  recordNoteCreated,
  recordNoteDeleted,
  recordNoteUpdateDiff,
} from '../components/views/features/knowledge/history';
import { pruneNoteNavigationStack } from '../lib/noteNavigationStack';
import { estimateDeletedNoteBytes } from '../lib/trashNoteStorage';
import {
  LOCAL_CORE_JSON_RESTORE_OPERATION,
  LOCAL_CORE_JSON_RESTORE_VALIDATION,
  RECOVERY_MODE_MESSAGE,
  RecoveryModeBlockedError,
  assertCurrentOperationEpoch,
  captureOperationEpoch,
  isOperationEpochCurrent,
  mayApplyCrossTabMutation,
  mayEmptyTrash,
  mayHydrateRemote,
  mayReset,
  mayRestoreLocalCoreJsonBackup,
  mayUndoRestore,
  mayUploadRemote,
  mayWriteLegacyNotes,
  recordRecoveryBlock,
  type LocalCoreJsonRestoreAuthorizationInput,
} from '../lib/recoverySafetyPolicy';
import { resolveNotesRuntimeSyncMode } from '../lib/syncMode';
import { validateCanonicalVaultExportManifest } from '../lib/vaultExportValidate';
import { stableRecoveryJson } from '../lib/recoveryExportPackage';

export type { Note, NoteFolder };
export { estimateDeletedNoteBytes };

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
  /** Bumps on title/properties/relations/folder/create/delete — not body-only edits (K-83A). */
  vaultStructureVersion: number;
  /** Bumps on debounced body index flush — backlinks/links context (K-83A). */
  indexContentVersion: number;
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
  deleteNotePermanently: (id: string) => void;
  emptyTrash: () => void;
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  importNote: (note: Note) => void;
  importVaultRestore: (manifest: VaultBackupManifest, strategy: VaultRestoreConflictStrategy) => Promise<VaultRestoreResult>;
  undoLastVaultRestore: () => boolean;
  canUndoVaultRestore: () => boolean;
  vaultRestoreCanUndo: boolean;

  hydrateFromDB: (options?: { mode?: NotesSyncMode }) => Promise<void>;
  hydrateFromDBFull: () => Promise<void>;
  syncNoteToDB: (note: Note) => Promise<boolean>;
  flushPendingSync: () => void;
  retrySync: () => void;
  /** Settings Reset — localStorage + in-memory notes 초기화 */
  resetAllNotes: () => void;
  /** K-96B — hydrate notes from IndexedDB (or localStorage fallback) once at startup */
  initNotesStorage: () => Promise<void>;
}

// ── 노트별 body debounce (리렌더 불필요) ───────────────────────────
// 단일 pending 슬롯은 노트 전환·탭 종료 시 이전 노트 sync 유실 → id별 Map 사용
const pendingBodySync = new Map<string, Note>();
const bodySyncTimers = new Map<string, ReturnType<typeof setTimeout>>();
let lastFailedNote: Note | null = null;
let lastFailedDeleteId: string | null = null;
const BODY_SYNC_MS = 600;

export const VAULT_RESTORE_DURABILITY_FAILURE_MESSAGE =
  'Restore was not completed because durable Notes/Folders readback could not be verified.';
export const VAULT_RESTORE_RECOVERY_REQUIRED_MESSAGE =
  'Restore was stopped and recovery is required because the previous durable state could not be verified.';

type VaultRestoreDurabilityStage =
  | 'notes_write'
  | 'folders_write'
  | 'notes_readback'
  | 'folders_readback';

export class VaultRestoreDurabilityError extends Error {
  readonly code = 'VAULT_RESTORE_DURABILITY_NOT_VERIFIED';
  readonly stage: VaultRestoreDurabilityStage;
  readonly rollbackVerified: boolean;
  readonly cause?: unknown;

  constructor(stage: VaultRestoreDurabilityStage, rollbackVerified: boolean, cause?: unknown) {
    super(rollbackVerified
      ? VAULT_RESTORE_DURABILITY_FAILURE_MESSAGE
      : VAULT_RESTORE_RECOVERY_REQUIRED_MESSAGE);
    this.name = 'VaultRestoreDurabilityError';
    this.stage = stage;
    this.rollbackVerified = rollbackVerified;
    if (cause !== undefined) this.cause = cause;
  }
}

function sameDurablePayload(expected: unknown, actual: unknown): boolean {
  try {
    // Durable Notes/Folders are JSON-backed in local mode. Compare the exact
    // serialized representation so optional undefined fields do not make a
    // valid JSON readback unverifiable.
    const normalize = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown;
    return stableRecoveryJson(normalize(expected)) === stableRecoveryJson(normalize(actual));
  } catch {
    return false;
  }
}

async function persistAndVerifyRestoreState(
  expected: { notes: Note[]; folders: NoteFolder[] },
  previous: { notes: Note[]; folders: NoteFolder[] },
): Promise<{ notes: Note[]; folders: NoteFolder[] }> {
  let stage: VaultRestoreDurabilityStage = 'notes_write';
  try {
    const notesWrite = await saveNotesAsync(expected.notes);
    if (notesWrite.status !== 'persisted') throw new Error(`notes_write:${notesWrite.status}`);

    stage = 'folders_write';
    if (!saveFolders(expected.folders)) throw new Error('folders_write:rejected');

    stage = 'notes_readback';
    const persistedNotes = await loadNotesAsync();
    if (!sameDurablePayload(expected.notes, persistedNotes)) throw new Error('notes_readback:mismatch');

    stage = 'folders_readback';
    const persistedFolders = loadFolders();
    if (!sameDurablePayload(expected.folders, persistedFolders)) throw new Error('folders_readback:mismatch');

    return { notes: [...persistedNotes], folders: [...persistedFolders] };
  } catch (cause) {
    let rollbackVerified = false;
    try {
      const rollbackNotes = await saveNotesAsync(previous.notes);
      if (rollbackNotes.status !== 'persisted' || !saveFolders(previous.folders)) throw new Error('rollback_write');
      const readbackNotes = await loadNotesAsync();
      const readbackFolders = loadFolders();
      rollbackVerified = sameDurablePayload(previous.notes, readbackNotes)
        && sameDurablePayload(previous.folders, readbackFolders);
    } catch {
      rollbackVerified = false;
    }
    throw new VaultRestoreDurabilityError(stage, rollbackVerified, cause);
  }
}

import {
  mergeNotePatch,
  type NoteContentPatch,
} from './notePatchPolicy';

function isBodyOnlyPatch(patch: NoteContentPatch): boolean {
  const keys = Object.keys(patch) as (keyof typeof patch)[];
  return keys.length === 1 && keys[0] === 'body';
}

function bumpVaultStructure(
  set: (partial: Partial<NotesState> | ((state: NotesState) => Partial<NotesState>)) => void,
  get: () => NotesState,
): void {
  invalidateNoteGalaxyMapCache();
  set({ vaultStructureVersion: get().vaultStructureVersion + 1 });
}

function bumpIndexContent(
  set: (partial: Partial<NotesState> | ((state: NotesState) => Partial<NotesState>)) => void,
  get: () => NotesState,
): void {
  set({ indexContentVersion: get().indexContentVersion + 1 });
}

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
  const remoteRevision = Math.max(n.updated_at ?? 0, n.deleted_at ?? 0);
  const localIsNewer = local && noteRevisionTime(local) > remoteRevision;
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
    starred:   Boolean(local?.starred) || Boolean(n.starred),
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
  invalidateNoteGalaxyMapCache();
}

function syncKnowledgeIndexForNote(note: Note, patch?: Partial<Note>) {
  if (
    !patch ||
    'title' in patch ||
    'deletedAt' in patch ||
    'properties' in patch ||
    'relations' in patch ||
    'folderId' in patch
  ) {
    knowledgeIndexService.updateNote(note);
  } else if ('body' in patch && !isBodyOnlyPatch(patch)) {
    knowledgeIndexService.updateNote(note);
  }
}

function resolveActiveNoteAfterRemoval(
  prevActive: string | null,
  removedIds: ReadonlySet<string>,
  notes: Note[],
  activeFolderId: string | null | 'trash',
): string | null {
  if (!prevActive || !removedIds.has(prevActive)) return prevActive;
  if (activeFolderId === 'trash') {
    return notes.find(n => n.deletedAt)?.id ?? null;
  }
  return notes.find(n => !n.deletedAt)?.id ?? null;
}

export function isVaultRestoreUndoAvailable(): boolean {
  return mayUndoRestore() && hasVaultRestoreSnapshot();
}

export const useNotesStore = create<NotesState>((set, get) => {
  const syncNoteToDB = async (note: Note): Promise<boolean> => {
    if (!mayUploadRemote()) {
      recordRecoveryBlock('upload_remote');
      set({ syncError: RECOVERY_MODE_MESSAGE });
      return false;
    }
    const operationEpoch = captureOperationEpoch();
    if (!isNotesCloudSyncEnabled()) {
      lastFailedNote = null;
      if (!lastFailedDeleteId) set({ syncError: null, savedAt: new Date() });
      else set({ savedAt: new Date() });
      return true;
    }
    const syncStatus = getNoteSyncStatus(note);
    if (syncStatus === 'clean') {
      if (!lastFailedDeleteId) set({ syncError: null, savedAt: new Date() });
      else set({ savedAt: new Date() });
      return true;
    }
    try {
      const res = await authFetch(`${API_URL}/api/notes`, {
        method: 'POST',
        body: JSON.stringify(noteSyncPayload(note)),
      });
      assertCurrentOperationEpoch(operationEpoch, 'upload_remote');
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
      if (err instanceof RecoveryModeBlockedError) {
        set({ syncError: RECOVERY_MODE_MESSAGE });
        return false;
      }
      lastFailedNote = note;
      set({ syncError: err instanceof Error ? err.message : 'Cloud sync failed' });
      return false;
    }
  };

  const removeNoteFromDB = async (id: string): Promise<boolean> => {
    if (!mayUploadRemote()) {
      recordRecoveryBlock('upload_remote');
      set({ syncError: RECOVERY_MODE_MESSAGE });
      return false;
    }
    const operationEpoch = captureOperationEpoch();
    if (!isNotesCloudSyncEnabled()) {
      if (lastFailedDeleteId === id) lastFailedDeleteId = null;
      if (!lastFailedNote) set({ syncError: null });
      return true;
    }
    try {
      const res = await authFetch(`${API_URL}/api/notes/${id}`, { method: 'DELETE' });
      assertCurrentOperationEpoch(operationEpoch, 'upload_remote');
      if (!res.ok) {
        lastFailedDeleteId = id;
        set({ syncError: `Cloud delete failed (${res.status})` });
        return false;
      }
      if (lastFailedDeleteId === id) lastFailedDeleteId = null;
      if (!lastFailedNote) set({ syncError: null });
      return true;
    } catch (err) {
      if (err instanceof RecoveryModeBlockedError) {
        set({ syncError: RECOVERY_MODE_MESSAGE });
        return false;
      }
      lastFailedDeleteId = id;
      set({ syncError: err instanceof Error ? err.message : 'Cloud delete failed' });
      return false;
    }
  };

  const persistNotes = (notes: Note[]) => {
    if (getNotesPersistenceMode() === 'localStorage') {
      const result = saveNotesSyncResult(notes);
      if (result.status !== 'persisted') set({ syncError: LOCAL_NOTES_SAVE_ERROR });
      else scheduleAutoSnapshot(notes, get().folders);
      return;
    }
    void saveNotesAsync(notes).then(result => {
      if (result.status !== 'persisted') set({ syncError: LOCAL_NOTES_SAVE_ERROR });
      else scheduleAutoSnapshot(notes, get().folders);
    });
  };

  const persistFolders = (folders: NoteFolder[]) => {
    if (!saveFolders(folders)) set({ syncError: LOCAL_FOLDERS_SAVE_ERROR });
    else scheduleAutoSnapshot(get().notes, folders);
  };

  const syncFolderToDB = async (folder: NoteFolder): Promise<boolean> => {
    if (!mayUploadRemote()) {
      recordRecoveryBlock('upload_remote');
      set({ syncError: RECOVERY_MODE_MESSAGE });
      return false;
    }
    const operationEpoch = captureOperationEpoch();
    if (!isNotesCloudSyncEnabled()) return true;
    try {
      const res = await authFetch(`${API_URL}/api/note_folders`, {
        method: 'POST',
        body: JSON.stringify({ id: folder.id, name: folder.name, created_at: folder.createdAt }),
      });
      assertCurrentOperationEpoch(operationEpoch, 'upload_remote');
      if (!res.ok) return false;
      return true;
    } catch (err) {
      if (err instanceof RecoveryModeBlockedError) set({ syncError: RECOVERY_MODE_MESSAGE });
      return false;
    }
  };

  const removeFolderFromDB = async (id: string): Promise<boolean> => {
    if (!mayUploadRemote()) {
      recordRecoveryBlock('upload_remote');
      set({ syncError: RECOVERY_MODE_MESSAGE });
      return false;
    }
    const operationEpoch = captureOperationEpoch();
    if (!isNotesCloudSyncEnabled()) return true;
    try {
      const res = await authFetch(`${API_URL}/api/note_folders/${id}`, { method: 'DELETE' });
      assertCurrentOperationEpoch(operationEpoch, 'upload_remote');
      return res.ok;
    } catch (err) {
      if (err instanceof RecoveryModeBlockedError) set({ syncError: RECOVERY_MODE_MESSAGE });
      return false;
    }
  };

  const flushPendingSync = () => {
    clearAllBodySyncTimers();
    const pending = [...pendingBodySync.values()];
    pendingBodySync.clear();
    for (const note of pending) {
      knowledgeIndexService.updateNote(note);
      void syncNoteToDB(note);
    }
    if (pending.length > 0) bumpIndexContent(set, get);
  };

  const scheduleBodySync = (note: Note, set: (partial: Partial<NotesState> | ((state: NotesState) => Partial<NotesState>)) => void, get: () => NotesState) => {
    pendingBodySync.set(note.id, note);
    clearBodySyncTimer(note.id);
    bodySyncTimers.set(note.id, setTimeout(() => {
      bodySyncTimers.delete(note.id);
      const latest = pendingBodySync.get(note.id);
      pendingBodySync.delete(note.id);
      if (latest) {
        knowledgeIndexService.updateNote(latest);
        bumpIndexContent(set, get);
        void syncNoteToDB(latest);
      }
    }, BODY_SYNC_MS));
  };

  return {
    notes: initialNotes,
    folders: initialFolders,
    activeNoteId: loadActiveNoteId(initialNotes),
    activeFolderId: null,
    vaultStructureVersion: 0,
    indexContentVersion: 0,
    isSyncing: false,
    savedAt: null,
    syncError: null,
    vaultRestoreCanUndo: isVaultRestoreUndoAvailable(),

    setActiveNoteId: (id) => {
      if (id) {
        const now = Date.now();
        const notes = get().notes.map(n =>
          n.id === id ? { ...n, lastOpenedAt: now } : n,
        );
        set({ activeNoteId: id, notes, vaultStructureVersion: get().vaultStructureVersion + 1 });
        persistNotes(notes);
        invalidateNoteGalaxyMapCache();
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
      set({ notes, activeNoteId: id, vaultStructureVersion: get().vaultStructureVersion + 1 });
      persistNotes(notes);
      saveActiveNoteId(id);
      knowledgeIndexService.updateNote(note);
      invalidateNoteGalaxyMapCache();
      recordNoteCreated(id);
      void syncNoteToDB(note);
      return id;
    },

    importNote: (note) => {
      const notes = [note, ...get().notes];
      set({ notes, activeNoteId: note.id, vaultStructureVersion: get().vaultStructureVersion + 1 });
      persistNotes(notes);
      saveActiveNoteId(note.id);
      knowledgeIndexService.updateNote(note);
      invalidateNoteGalaxyMapCache();
      void syncNoteToDB(note);
    },

    importVaultRestore: (manifest, strategy) => {
      const currentNotes = get().notes;
      const currentFolders = get().folders;
      const canonicalManifest = canonicalizeVaultRestoreManifest(manifest);
      let backupValid = false;
      try {
        backupValid = canonicalManifest !== null
          && validateCanonicalVaultExportManifest(canonicalManifest).valid
          && validateCanonicalVaultBackupManifest(
            canonicalManifest,
            currentNotes,
            currentFolders,
          ).valid;
      } catch {
        backupValid = false;
      }
      const authorizationInput = {
        operation: LOCAL_CORE_JSON_RESTORE_OPERATION,
        syncMode: resolveNotesRuntimeSyncMode(),
        strategy,
        createVerifiedSnapshot: true,
        restoreCore: true,
        restoreExtensions: false,
        restoreCloud: false,
        backupValidation: backupValid ? LOCAL_CORE_JSON_RESTORE_VALIDATION : 'invalid',
        selectedNoteCount: canonicalManifest?.notes.length ?? 0,
      } satisfies LocalCoreJsonRestoreAuthorizationInput;
      if (!canonicalManifest || !mayRestoreLocalCoreJsonBackup(authorizationInput)) {
        recordRecoveryBlock('restore');
        throw new RecoveryModeBlockedError('restore');
      }
      saveVaultRestoreSnapshot(currentNotes, currentFolders);
      const beforeIds = new Set(currentNotes.map(n => n.id));
      const prevFolderIds = new Set(currentFolders.map(f => f.id));
      const { notes, folders, result } = applyVaultRestore(
        canonicalManifest,
        currentNotes,
        currentFolders,
        strategy,
      );
      return persistAndVerifyRestoreState(
        { notes, folders },
        { notes: currentNotes, folders: currentFolders },
      ).then(persisted => {
        set({
          notes: persisted.notes,
          folders: persisted.folders,
          syncError: null,
          vaultRestoreCanUndo: isVaultRestoreUndoAvailable(),
        });
        rebuildKnowledgeIndex(persisted.notes);
        bumpVaultStructure(set, get);
        const manifestIds = new Set(canonicalManifest.notes.map(n => n.id));
        if (isNotesCloudSyncEnabled()) {
          for (const note of persisted.notes) {
            if (!note.deletedAt && (
              !beforeIds.has(note.id) ||
              (manifestIds.has(note.id) && strategy === 'replace')
            )) {
              void syncNoteToDB(note);
            }
          }
          persisted.folders
            .filter(f => !prevFolderIds.has(f.id))
            .forEach(f => { void syncFolderToDB(f); });
          flushPendingSync();
        }
        return result;
      }, error => {
        set({
          vaultRestoreCanUndo: false,
          syncError: error instanceof VaultRestoreDurabilityError && !error.rollbackVerified
            ? VAULT_RESTORE_RECOVERY_REQUIRED_MESSAGE
            : VAULT_RESTORE_DURABILITY_FAILURE_MESSAGE,
        });
        throw error;
      });
    },

    canUndoVaultRestore: isVaultRestoreUndoAvailable,

    undoLastVaultRestore: () => {
      if (!mayUndoRestore()) {
        recordRecoveryBlock('undo_restore');
        set({ syncError: RECOVERY_MODE_MESSAGE });
        return false;
      }
      const snapshot = loadVaultRestoreSnapshot();
      if (!snapshot) {
        set({ vaultRestoreCanUndo: false });
        return false;
      }
      set({ notes: snapshot.notes, folders: snapshot.folders });
      persistNotes(snapshot.notes);
      persistFolders(snapshot.folders);
      for (const note of snapshot.notes) {
        knowledgeIndexService.updateNote(note);
      }
      snapshot.notes.forEach(n => { void syncNoteToDB(n); });
      clearVaultRestoreSnapshot();
      set({ vaultRestoreCanUndo: false });
      flushPendingSync();
      return true;
    },

    updateNote: (id, patch) => {
      const previous = get().notes.find(n => n.id === id);
      const normalizedPatch = 'properties' in patch
        ? { ...patch, properties: normalizeNoteProperties(patch.properties) }
        : patch;
      const notes = get().notes.map(n =>
        n.id === id ? mergeNotePatch(n, normalizedPatch) : n
      );
      set({ notes });
      persistNotes(notes);
      const updated = notes.find(n => n.id === id);
      if (!updated) return;
      if (previous) recordNoteUpdateDiff(previous, updated);
      const bodyOnly = isBodyOnlyPatch(normalizedPatch);
      if (bodyOnly) {
        scheduleBodySync(updated, set, get);
      } else {
        syncKnowledgeIndexForNote(updated, normalizedPatch);
        bumpVaultStructure(set, get);
        flushPendingSync();
        void syncNoteToDB(updated);
      }
    },

    toggleStar: (id) => {
      const notes = get().notes.map(n =>
        n.id === id ? { ...n, starred: !n.starred } : n
      );
      set({ notes, vaultStructureVersion: get().vaultStructureVersion + 1 });
      persistNotes(notes);
      invalidateNoteGalaxyMapCache();
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
      set({ notes, activeNoteId: id, vaultStructureVersion: get().vaultStructureVersion + 1 });
      persistNotes(notes);
      saveActiveNoteId(id);
      knowledgeIndexService.updateNote(copy);
      invalidateNoteGalaxyMapCache();
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
      set({ notes, activeNoteId: nextActive, vaultStructureVersion: get().vaultStructureVersion + 1 });
      persistNotes(notes);
      saveActiveNoteId(nextActive);
      invalidateNoteGalaxyMapCache();
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
        vaultStructureVersion: get().vaultStructureVersion + 1,
      });
      persistNotes(notes);
      saveActiveNoteId(id);
      invalidateNoteGalaxyMapCache();
      if (restored) {
        knowledgeIndexService.updateNote(restored);
        void syncNoteToDB(restored);
        recordArchiveRestore(id);
      }
    },

    permanentDeleteNote: (id) => {
      get().deleteNotePermanently(id);
    },

    deleteNotePermanently: (id) => {
      if (!mayEmptyTrash()) {
        recordRecoveryBlock('empty_trash');
        set({ syncError: RECOVERY_MODE_MESSAGE });
        return;
      }
      const removedIds = new Set([id]);
      for (const removedId of removedIds) {
        clearBodySyncTimer(removedId);
        pendingBodySync.delete(removedId);
        recordNoteDeleted(removedId);
      }
      knowledgeIndexService.removeNote(id);
      pruneNoteNavigationStack(removedIds);
      const notes = get().notes.filter(n => n.id !== id);
      const nextActive = resolveActiveNoteAfterRemoval(
        get().activeNoteId,
        removedIds,
        notes,
        get().activeFolderId,
      );
      set({
        notes,
        activeNoteId: nextActive,
        vaultStructureVersion: get().vaultStructureVersion + 1,
        indexContentVersion: get().indexContentVersion + 1,
      });
      persistNotes(notes);
      saveActiveNoteId(nextActive);
      invalidateNoteGalaxyMapCache();
      void removeNoteFromDB(id);
    },

    emptyTrash: () => {
      if (!mayEmptyTrash()) {
        recordRecoveryBlock('empty_trash');
        set({ syncError: RECOVERY_MODE_MESSAGE });
        return;
      }
      const trashed = get().notes.filter(n => n.deletedAt);
      if (trashed.length === 0) return;

      const removedIds = new Set(trashed.map(n => n.id));
      for (const id of removedIds) {
        clearBodySyncTimer(id);
        pendingBodySync.delete(id);
        recordNoteDeleted(id);
      }
      pruneNoteNavigationStack(removedIds);

      const notes = get().notes.filter(n => !n.deletedAt);
      rebuildKnowledgeIndex(notes);
      const nextActive = resolveActiveNoteAfterRemoval(
        get().activeNoteId,
        removedIds,
        notes,
        get().activeFolderId,
      );
      set({
        notes,
        activeNoteId: nextActive,
        vaultStructureVersion: get().vaultStructureVersion + 1,
        indexContentVersion: get().indexContentVersion + 1,
      });
      persistNotes(notes);
      saveActiveNoteId(nextActive);

      for (const note of trashed) {
        void removeNoteFromDB(note.id);
      }
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
      set({ folders, notes, activeFolderId, vaultStructureVersion: get().vaultStructureVersion + 1 });
      persistNotes(notes);
      persistFolders(folders);
      invalidateNoteGalaxyMapCache();
      for (const n of notes.filter(n => movedIds.has(n.id))) {
        knowledgeIndexService.updateNote(n);
        void syncNoteToDB(n);
      }
      void removeFolderFromDB(id);
    },

    hydrateFromDB: async (options) => {
      await runCoalescedHydrate(async () => {
        if (!mayHydrateRemote()) {
          recordRecoveryBlock('hydrate_remote');
          set({ isSyncing: false, syncError: RECOVERY_MODE_MESSAGE });
          return;
        }
        const operationEpoch = captureOperationEpoch();
        if (!isNotesCloudSyncEnabled()) {
          set({ isSyncing: false, syncError: null });
          return;
        }
        const mode = options?.mode;
        set({ isSyncing: true });
        try {
          try {
            const folderResult = await fetchFoldersFromCloud(mode);
            assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
            if (!folderResult.skipped) {
              const dbFolders: NoteFolder[] = folderResult.rows.map(mapDbFolder);
              const localFolders = get().folders;
              const dbIds = new Set(dbFolders.map(f => f.id));
              const localOnly = localFolders.filter(f => !dbIds.has(f.id));
              const mergedFolders = mergeFolderArrays(localOnly, dbFolders);
              if (mergedFolders.length > 0) {
                assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
                set({ folders: mergedFolders });
                assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
                persistFolders(mergedFolders);
                if (localOnly.length > 0) {
                  await Promise.allSettled(localOnly.map(f => syncFolderToDB(f)));
                }
              }
            }
          } catch (folderErr) {
            if (folderErr instanceof RecoveryModeBlockedError) throw folderErr;
            set({ syncError: folderErr instanceof Error ? folderErr.message : 'Failed to load folders' });
          }

          const notesResult = await fetchNotesFromCloud(mode);
          assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
          const raw = notesResult.rows;
          const localNotes = get().notes;
          const dbNotes: Note[] = raw.map((n: Parameters<typeof mapDbNote>[0]) => {
            const local = localNotes.find(l => l.id === n.id);
            return mapDbNote(n, local);
          });

          if (dbNotes.length > 0) {
            const expired = dbNotes.filter(
              n => n.deletedAt && Date.now() - n.deletedAt >= NOTE_TRASH_RETENTION_MS,
            );
            expired.forEach(n => { void removeNoteFromDB(n.id); });

            const merged = mergeDeltaNoteRows(localNotes, dbNotes);
            assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
            const prevActive = get().activeNoteId;
            const stillValid = merged.some(n => n.id === prevActive && !n.deletedAt);
            const nextActive = stillValid ? prevActive : (merged.find(n => !n.deletedAt)?.id ?? null);
            set({ notes: merged, activeNoteId: nextActive, vaultStructureVersion: get().vaultStructureVersion + 1 });
            persistNotes(merged);
            saveActiveNoteId(nextActive);
            rebuildKnowledgeIndex(merged);
          }

          const dirtyNotes = selectDirtyNotesForPush(get().notes, notesResult.lastSyncAt);
          const pushResults = await Promise.all(
            dirtyNotes.map(async note => ({ note, ok: await syncNoteToDB(note) })),
          );
          assertCurrentOperationEpoch(operationEpoch, 'hydrate_remote');
          const failedPush = pushResults.some(result => !result.ok);
          const pushedNotes = pushResults
            .filter((result): result is { note: Note; ok: true } => result.ok)
            .map(result => result.note);
          if (!failedPush && (raw.length > 0 || pushedNotes.length > 0)) {
            writeLastNotesSyncAt(computeLastSyncTimestamp([
              ...raw,
              ...pushedNotes.map(n => ({
                id: n.id,
                title: n.title,
                body: n.body,
                updated_at: n.updatedAt,
                folder_id: n.folderId,
                deleted_at: n.deletedAt,
              })),
            ]));
          }
          if (!failedPush) set({ syncError: null });
        } catch (err) {
          set({ syncError: err instanceof Error ? err.message : 'Failed to load from cloud' });
        } finally {
          set({ isSyncing: false });
        }
      });
    },

    hydrateFromDBFull: async () => {
      await get().hydrateFromDB({ mode: 'recovery' });
    },

    syncNoteToDB,
    flushPendingSync,
    retrySync: () => {
      const afterNotesSaved = () => {
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
      };

      if (getNotesPersistenceMode() === 'localStorage') {
        const result = saveNotesSyncResult(get().notes);
        if (result.status !== 'persisted') {
          set({ syncError: LOCAL_NOTES_SAVE_ERROR });
          return;
        }
        afterNotesSaved();
        return;
      }

      void saveNotesAsync(get().notes).then(result => {
        if (result.status !== 'persisted') {
          set({ syncError: LOCAL_NOTES_SAVE_ERROR });
          return;
        }
        afterNotesSaved();
      });
    },

    initNotesStorage: async () => {
      const result = await initNotesPersistence();
      const currentNotes = get().notes;
      const notes = currentNotes.length > 0
        ? mergeNoteArrays(result.notes, currentNotes)
        : result.notes;
      const prevActive = get().activeNoteId;
      const stillValid = notes.some(n => n.id === prevActive);
      const nextActive = stillValid ? prevActive : loadActiveNoteId(notes);
      set({
        notes,
        activeNoteId: nextActive,
        vaultStructureVersion: get().vaultStructureVersion + 1,
        syncError: result.fallbackError ?? get().syncError,
      });
      if (notes.length !== result.notes.length || currentNotes.length > 0) {
        persistNotes(notes);
      }
      rebuildKnowledgeIndex(notes);
      if (nextActive !== prevActive) saveActiveNoteId(nextActive);
    },

    resetAllNotes: () => {
      if (!mayReset()) {
        recordRecoveryBlock('reset');
        set({ syncError: RECOVERY_MODE_MESSAGE });
        return;
      }
      clearAllBodySyncTimers();
      pendingBodySync.clear();
      lastFailedNote = null;
      lastFailedDeleteId = null;
      clearKnowledgeHistory();
      clearNotesStorage();
      void clearNotesPersistence();
      const notes = createDefaultWelcomeNotes();
      set({
        notes,
        folders: [],
        activeNoteId: notes[0]?.id ?? null,
        activeFolderId: null,
        syncError: null,
        savedAt: null,
        isSyncing: false,
        vaultStructureVersion: get().vaultStructureVersion + 1,
        indexContentVersion: 0,
      });
      rebuildKnowledgeIndex(notes);
    },
  };
});

// ── 다중 탭: storage 이벤트로 localStorage 변경 병합 ─────────────────
let applyingStorageMerge = false;

function applyStorageMerge(key: string | null, newValue: string | null) {
  if (!key || applyingStorageMerge) return;
  if ((isNotesIndexedDbRevisionEvent(key) || key === NOTES_KEY || key === FOLDERS_KEY)
    && (!mayApplyCrossTabMutation() || !mayWriteLegacyNotes())) {
    recordRecoveryBlock('cross_tab_mutation');
    return;
  }
  const state = useNotesStore.getState();

  if (isNotesIndexedDbRevisionEvent(key)) {
    const operationEpoch = captureOperationEpoch();
    applyingStorageMerge = true;
    void loadNotesAsync().then(merged => {
      if (!isOperationEpochCurrent(operationEpoch) || !mayApplyCrossTabMutation() || !mayWriteLegacyNotes()) {
        recordRecoveryBlock('cross_tab_mutation', 'stale_operation_epoch');
        applyingStorageMerge = false;
        return;
      }
      const prevActive = state.activeNoteId;
      const stillValid = merged.some(n => n.id === prevActive && !n.deletedAt);
      const nextActive = stillValid ? prevActive : loadActiveNoteId(merged);
      useNotesStore.setState({
        notes: merged,
        activeNoteId: nextActive,
        vaultStructureVersion: state.vaultStructureVersion + 1,
      });
      rebuildKnowledgeIndex(merged);
      if (nextActive !== prevActive) saveActiveNoteId(nextActive);
      applyingStorageMerge = false;
    }).catch(() => {
      applyingStorageMerge = false;
    });
    return;
  }

  if (key === NOTES_KEY) {
    const merged = mergeNotesFromStorageJson(state.notes, newValue);
    const prevActive = state.activeNoteId;
    const stillValid = merged.some(n => n.id === prevActive && !n.deletedAt);
    const nextActive = stillValid ? prevActive : loadActiveNoteId(merged);
    applyingStorageMerge = true;
    useNotesStore.setState({
      notes: merged,
      activeNoteId: nextActive,
      vaultStructureVersion: state.vaultStructureVersion + 1,
    });
    rebuildKnowledgeIndex(merged);
    if (getNotesPersistenceMode() === 'localStorage') {
      if (saveNotesSyncResult(merged).status !== 'persisted') {
        useNotesStore.setState({ syncError: LOCAL_NOTES_SAVE_ERROR });
      }
    } else {
      void saveNotesAsync(merged).then(result => {
        if (result.status !== 'persisted') useNotesStore.setState({ syncError: LOCAL_NOTES_SAVE_ERROR });
      });
    }
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

knowledgeIndexService.setBodyProvider((noteId) => {
  const note = useNotesStore.getState().notes.find(n => n.id === noteId);
  return note?.body ?? '';
});
