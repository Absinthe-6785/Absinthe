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
  setCachedNotes,
  getNotesPersistenceMode,
  isNotesIndexedDbRevisionEvent,
  clearNotesPersistence,
  detachNotesPersistenceAccount,
} from '../lib/notePersistence';
import {
  type NotesAuthorityLoadState,
  type NotesAccountRecoveryContext,
  activateNotesAccountAuthority,
  getActiveNotesAuthorityAccountId,
  loadAccountScopedNotes,
  createNotesAccountRecoveryContext,
  isNotesAuthorityRequestActive,
  isNotesAccountRecoveryContextActive,
  isNotesAccountAuthorityActive,
  saveNotesForRecoveryContext,
  saveFoldersForRecoveryContext,
  loadNotesForRecoveryContext,
  loadFoldersForRecoveryContext,
  applyNotesFoldersForRecoveryContext,
  USER_INITIATED_SINGLE_NOTE_DELETE,
  prepareNotesSingleDelete,
  beginNotesSingleDelete,
  confirmNotesSingleRemoteDelete,
  commitNotesSingleDelete,
  abortNotesSingleDelete,
  reconcileNotesSingleDeletesForBootstrap,
  completeNotesSingleDeleteBootstrapReconciliation,
  validateNotesSingleDeleteTarget,
  type NotesSingleDeleteAuthorization,
} from '../lib/notesAccountAuthority';
import { deleteSingleRemoteNote } from '../lib/notesSingleDeleteRemote';
import {
  type NoteBase as Note,
  type NoteFolderBase as NoteFolder,
  loadFolders,
  loadActiveNoteId,
  saveFolders,
  saveActiveNoteId,
  clearNotesStorage,
  createDefaultWelcomeNotes,
  mergeNoteArrays,
  mergeNotesFromStorageJson,
  mergeFoldersFromStorageJson,
  normalizeNoteFolderId,
  noteSyncPayload,
  normalizeNoteProperties,
  NOTES_KEY,
  FOLDERS_KEY,
  ACTIVE_KEY,
  LOCAL_NOTES_SAVE_ERROR,
  LOCAL_FOLDERS_SAVE_ERROR,
  normalizeNote,
} from '../components/views/noteUtils';
import {
  NOTES_IDB_NAME,
  NOTES_IDB_STORE,
  NOTES_IDB_VERSION,
  bumpNotesIndexedDbRevision,
} from '../lib/noteIndexedDb';
import { recordArchiveRestore } from '../components/views/features/knowledge/archive/archiveRestoreRecents';
import { knowledgeIndexService } from '../components/views/features/knowledge';
import { invalidateNoteGalaxyMapCache } from '../components/views/features/knowledge/graph/knowledgeUniverse/galaxyClustering';
import {
  fetchCompleteNotesFoldersSnapshot,
  mapDbFolder,
  isNotesCloudSyncEnabled,
  noteRevisionTime,
} from '../lib/notesSyncClient';
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
  mayReset,
  mayRestoreLocalCoreJsonBackup,
  isRecoveryModeActive,
  mayUndoRestore,
  mayUploadRemote,
  mayWriteLegacyNotes,
  recordRecoveryBlock,
  type LocalCoreJsonRestoreAuthorizationInput,
} from '../lib/recoverySafetyPolicy';
import { resolveNotesRuntimeSyncMode } from '../lib/syncMode';
import { validateCanonicalVaultExportManifest } from '../lib/vaultExportValidate';
import { stableRecoveryJson } from '../lib/recoveryExportPackage';
import { sha256Hex } from '../lib/localDatabase/outboxIdentity';
import { collectNoteAttachmentRefs, gcOrphanedLocalNoteAttachments } from '../lib/noteAttachmentGc';

export type { Note, NoteFolder };
export { estimateDeletedNoteBytes };

export interface CreateNoteOpts {
  title?: string;
  body?: string;
  folderId?: string | null;
  /** UI 가상 폴더(trash/starred) — folderId 미지정 시 사용 */
  folderContext?: string | null | 'trash' | 'starred';
}

type SyncIssueSource =
  | 'note_remote_write'
  | 'note_remote_delete'
  | 'folder_remote'
  | 'local_notes_persistence'
  | 'local_folders_persistence'
  | 'initialization'
  | 'bootstrap'
  | 'recovery'
  | 'recovery_permanent_delete';

interface SyncIssueState {
  readonly source: SyncIssueSource;
  readonly targetId?: string;
  readonly retryable: boolean;
  /** Matches syncError so direct test/runtime state replacements cannot reuse stale ownership. */
  readonly message: string;
}

function isSafetyCriticalSyncIssueSource(source: SyncIssueSource): boolean {
  return source === 'local_notes_persistence'
    || source === 'local_folders_persistence'
    || source === 'recovery'
    || source === 'recovery_permanent_delete';
}

function isLowerPrioritySyncIssueSource(source: SyncIssueSource): boolean {
  return source === 'note_remote_write'
    || source === 'note_remote_delete'
    || source === 'folder_remote'
    || source === 'bootstrap'
    || source === 'initialization';
}

function shouldPreserveExistingSyncIssue(
  existing: SyncIssueState | null,
  incoming: SyncIssueSource,
): boolean {
  return existing !== null
    && isSafetyCriticalSyncIssueSource(existing.source)
    && isLowerPrioritySyncIssueSource(incoming);
}

interface NotesState {
  notes: Note[];
  folders: NoteFolder[];
  activeNoteId: string | null;
  /** The authenticated local authority currently bound to Notes/Folders. */
  activeAccountId: string | null;
  notesAuthorityState: NotesAuthorityLoadState;
  foldersAuthorityState: NotesAuthorityLoadState;
  /** Bumps on title/properties/relations/folder/create/delete — not body-only edits (K-83A). */
  vaultStructureVersion: number;
  /** Bumps on debounced body index flush — backlinks/links context (K-83A). */
  indexContentVersion: number;
  /** Planner Memo 패널용 폴더 필터 (NoteView는 자체 activeFolderId + starred 사용) */
  activeFolderId: string | null | 'trash';
  isSyncing: boolean;
  savedAt: Date | null;
  syncError: string | null;
  syncIssue: SyncIssueState | null;

  setActiveNoteId: (id: string | null) => void;
  setActiveFolderId: (id: string | null | 'trash') => void;
  createNote: (opts?: CreateNoteOpts) => string;
  updateNote: (id: string, patch: Partial<Pick<Note, 'title' | 'body' | 'folderId' | 'starred' | 'properties' | 'relations'>>) => void;
  toggleStar: (id: string) => void;
  duplicateNote: (note: Note) => string;
  moveNoteToTrash: (id: string) => void;
  restoreNote: (id: string) => void;
  prepareNotePermanentDelete: (id: string) => NotesSingleDeleteAuthorization | null;
  permanentDeleteNote: (authorization: NotesSingleDeleteAuthorization) => Promise<boolean>;
  deleteNotePermanently: (authorization: NotesSingleDeleteAuthorization) => Promise<boolean>;
  emptyTrash: () => void;
  createFolder: (name: string) => string;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  importNote: (note: Note) => void;
  importVaultRestore: (manifest: VaultBackupManifest, strategy: VaultRestoreConflictStrategy) => Promise<VaultRestoreResult>;
  undoLastVaultRestore: () => boolean;
  canUndoVaultRestore: () => boolean;
  vaultRestoreCanUndo: boolean;

  bootstrapFromSupabase: () => Promise<void>;
  syncNoteToDB: (note: Note) => Promise<boolean>;
  flushPendingSync: () => void;
  retrySync: () => void;
  /** Settings Reset — localStorage + in-memory notes 초기화 */
  resetAllNotes: () => void;
  /** K-96B — hydrate notes from IndexedDB (or localStorage fallback) once at startup */
  initNotesStorage: (accountId?: string) => Promise<void>;
  /** Detach runtime memory on sign-out or account switch without deleting account data. */
  detachNotesStorage: () => void;
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

const LOCAL_CORE_JSON_RESTORE_AUTHORITY = Symbol('local-core-json-restore-authority');
const LOCAL_CORE_JSON_RESTORE_NAMESPACE = 'legacy-local-notes-global-v1';
type LocalCoreJsonRestorePurpose = 'restore' | 'rollback';
type LocalCoreJsonRestoreAuthorityState = 'ready' | 'notes_write_started' | 'complete' | 'invalidated';

interface LocalCoreJsonRestoreCapability {
  readonly marker: symbol;
}

interface LocalCoreJsonRestoreAuthorityRecord {
  readonly notesDigest: string;
  readonly foldersDigest: string;
  readonly snapshotDigest: string;
  readonly namespace: string;
  readonly operationEpoch: number;
  readonly purpose: LocalCoreJsonRestorePurpose;
  readonly recoveryContext?: NotesAccountRecoveryContext;
  state: LocalCoreJsonRestoreAuthorityState;
}

interface LocalCoreJsonRestoreAuthorityBinding {
  readonly notes: unknown;
  readonly folders: unknown;
  readonly snapshotNotes: unknown;
  readonly snapshotFolders: unknown;
  readonly operationEpoch: number;
  readonly namespace?: string;
  readonly recoveryContext?: NotesAccountRecoveryContext;
}

interface LocalCoreJsonRestoreAuthorities {
  readonly restore: LocalCoreJsonRestoreCapability;
  readonly rollback: LocalCoreJsonRestoreCapability;
}

const localCoreJsonRestoreAuthorities = new WeakMap<object, LocalCoreJsonRestoreAuthorityRecord>();

type RestoreNotesStructuralFailure = 'EMPTY_NOTES' | 'INVALID_NOTE_ID' | 'DUPLICATE_NOTE_ID' | 'INCOMPLETE_NOTE_SHAPE';
type RestoreFoldersBoundaryFailure = 'INVALID_AUTHORITY' | 'LIFECYCLE_STATE' | 'PURPOSE_MISMATCH' | 'NAMESPACE_MISMATCH'
  | 'STALE_EPOCH' | 'PAYLOAD_DIGEST_MISMATCH' | 'INVALID_FOLDER_SHAPE';

function localCoreJsonRestoreDigest(value: unknown): string | null {
  try {
    return sha256Hex(stableRecoveryJson(JSON.parse(JSON.stringify(value)) as unknown));
  } catch { return null; }
}

function diagnoseRestoreNotes(value: unknown): RestoreNotesStructuralFailure | null {
  if (!Array.isArray(value) || value.length === 0) return 'EMPTY_NOTES';
  const ids = new Set<string>();
  for (const note of value) {
    if (!note || typeof note !== 'object') return 'INCOMPLETE_NOTE_SHAPE';
    if (typeof note.id !== 'string' || note.id.trim().length === 0) return 'INVALID_NOTE_ID';
    if (ids.has(note.id)) return 'DUPLICATE_NOTE_ID';
    if (typeof note.title !== 'string' || typeof note.body !== 'string'
      || typeof note.updatedAt !== 'number' || !Number.isFinite(note.updatedAt)
      || (note.folderId !== null && typeof note.folderId !== 'string')
      || (note.deletedAt !== null && (typeof note.deletedAt !== 'number' || !Number.isFinite(note.deletedAt)))) return 'INCOMPLETE_NOTE_SHAPE';
    ids.add(note.id);
  }
  return null;
}

function validRestoreNotes(value: unknown): value is readonly Note[] {
  return diagnoseRestoreNotes(value) === null;
}

function validRestoreSnapshotNotes(value: unknown): value is readonly Note[] {
  return Array.isArray(value) && (value.length === 0 || validRestoreNotes(value));
}

function validRestoreFolders(value: unknown): value is readonly NoteFolder[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  for (const folder of value) {
    if (!folder || typeof folder.id !== 'string' || folder.id.trim().length === 0 || ids.has(folder.id)
      || typeof folder.name !== 'string' || folder.name.trim().length === 0
      || typeof folder.createdAt !== 'number' || !Number.isFinite(folder.createdAt)) return false;
    ids.add(folder.id);
  }
  return true;
}

function authorityRecord(capability: unknown): LocalCoreJsonRestoreAuthorityRecord | null {
  if (!capability || typeof capability !== 'object') return null;
  return localCoreJsonRestoreAuthorities.get(capability) ?? null;
}

function createLocalCoreJsonRestoreAuthority(
  binding: LocalCoreJsonRestoreAuthorityBinding,
  purpose: LocalCoreJsonRestorePurpose,
): LocalCoreJsonRestoreCapability | null {
  const notesDigest = localCoreJsonRestoreDigest(binding.notes);
  const foldersDigest = localCoreJsonRestoreDigest(binding.folders);
  const snapshotDigest = localCoreJsonRestoreDigest([binding.snapshotNotes, binding.snapshotFolders]);
  const validAuthorityNotes = purpose === 'rollback'
    ? validRestoreSnapshotNotes(binding.notes)
    : validRestoreNotes(binding.notes);
  if (!validAuthorityNotes || !validRestoreFolders(binding.folders)
    || !validRestoreSnapshotNotes(binding.snapshotNotes) || !validRestoreFolders(binding.snapshotFolders)
    || !notesDigest || !foldersDigest || !snapshotDigest
    || !Number.isSafeInteger(binding.operationEpoch) || binding.operationEpoch < 1
    || (binding.namespace !== undefined && binding.namespace.trim().length === 0)) return null;
  const authority = Object.freeze({ marker: LOCAL_CORE_JSON_RESTORE_AUTHORITY });
  localCoreJsonRestoreAuthorities.set(authority, {
    notesDigest,
    foldersDigest,
    snapshotDigest,
    namespace: binding.namespace ?? LOCAL_CORE_JSON_RESTORE_NAMESPACE,
    operationEpoch: binding.operationEpoch,
    purpose,
    recoveryContext: binding.recoveryContext,
    state: 'ready',
  });
  return authority;
}

function validateRestorePayload(
  capability: unknown,
  purpose: LocalCoreJsonRestorePurpose,
  notes: unknown,
  folders: unknown,
  snapshotNotes: unknown,
  snapshotFolders: unknown,
  expectedNamespace = LOCAL_CORE_JSON_RESTORE_NAMESPACE,
): boolean {
  const record = authorityRecord(capability);
  const validAuthorityNotes = purpose === 'rollback'
    ? validRestoreSnapshotNotes(notes)
    : validRestoreNotes(notes);
  return Boolean(record && record.state === 'ready' && record.purpose === purpose
    && record.namespace === expectedNamespace
    && (purpose === 'rollback' || !record.recoveryContext || isNotesAccountRecoveryContextActive(record.recoveryContext))
    && isOperationEpochCurrent(record.operationEpoch)
    && localCoreJsonRestoreDigest(notes) === record.notesDigest
    && localCoreJsonRestoreDigest(folders) === record.foldersDigest
    && localCoreJsonRestoreDigest([snapshotNotes, snapshotFolders]) === record.snapshotDigest
    && validAuthorityNotes && validRestoreFolders(folders)
    && validRestoreSnapshotNotes(snapshotNotes));
}

function validateRestoreFolders(
  capability: unknown,
  purpose: LocalCoreJsonRestorePurpose,
  folders: unknown,
  snapshotNotes: unknown,
  snapshotFolders: unknown,
  expectedNamespace = LOCAL_CORE_JSON_RESTORE_NAMESPACE,
): boolean {
  return diagnoseRestoreFolders(capability, purpose, folders, snapshotNotes, snapshotFolders, expectedNamespace) === null;
}

function diagnoseRestoreFolders(
  capability: unknown,
  purpose: LocalCoreJsonRestorePurpose,
  folders: unknown,
  snapshotNotes: unknown,
  snapshotFolders: unknown,
  expectedNamespace = LOCAL_CORE_JSON_RESTORE_NAMESPACE,
): RestoreFoldersBoundaryFailure | null {
  const record = authorityRecord(capability);
  if (!record) return 'INVALID_AUTHORITY';
  if (record.state !== 'notes_write_started') return 'LIFECYCLE_STATE';
  if (record.purpose !== purpose) return 'PURPOSE_MISMATCH';
  if (record.namespace !== expectedNamespace) return 'NAMESPACE_MISMATCH';
  if (purpose === 'restore' && record.recoveryContext && !isNotesAccountRecoveryContextActive(record.recoveryContext)) return 'STALE_EPOCH';
  if (!isOperationEpochCurrent(record.operationEpoch)) return 'STALE_EPOCH';
  if (localCoreJsonRestoreDigest(folders) !== record.foldersDigest
    || localCoreJsonRestoreDigest([snapshotNotes, snapshotFolders]) !== record.snapshotDigest) return 'PAYLOAD_DIGEST_MISMATCH';
  if (!validRestoreFolders(folders)) return 'INVALID_FOLDER_SHAPE';
  return null;
}

function completeRestoreAuthority(
  capability: unknown,
  purpose: LocalCoreJsonRestorePurpose,
  expectedNamespace = LOCAL_CORE_JSON_RESTORE_NAMESPACE,
): boolean {
  const record = authorityRecord(capability);
  if (!record || record.state !== 'notes_write_started' || record.purpose !== purpose
    || record.namespace !== expectedNamespace || !isOperationEpochCurrent(record.operationEpoch)) return false;
  if (purpose === 'restore' && record.recoveryContext && !isNotesAccountRecoveryContextActive(record.recoveryContext)) return false;
  record.state = 'complete';
  return true;
}

function invalidateRestoreAuthority(capability: unknown): void {
  const record = authorityRecord(capability);
  if (record) record.state = 'invalidated';
}

async function saveAuthorizedRestoreNotes(
  notes: readonly Note[],
  capability: unknown,
  purpose: LocalCoreJsonRestorePurpose,
  expectedNamespace = LOCAL_CORE_JSON_RESTORE_NAMESPACE,
): Promise<boolean> {
  const record = authorityRecord(capability);
  const accountScoped = getNotesPersistenceMode() === 'accountScoped';
  const validAuthorityNotes = purpose === 'rollback'
    ? validRestoreSnapshotNotes(notes)
    : validRestoreNotes(notes);
  if (!record || record.state !== 'ready' || record.purpose !== purpose
    || !isOperationEpochCurrent(record.operationEpoch)
    || record.namespace !== expectedNamespace
    || (!accountScoped && !mayWriteLegacyNotes())
    || (purpose === 'restore' && record.recoveryContext && !isNotesAccountRecoveryContextActive(record.recoveryContext))
    || localCoreJsonRestoreDigest(notes) !== record.notesDigest || !validAuthorityNotes) return false;
  record.state = 'notes_write_started';
  // Account-scoped recovery must use the same authority as normal account
  // persistence. It must never clear or repurpose the legacy global database.
  if (accountScoped) {
    if (!record.recoveryContext) return false;
    const saved = await saveNotesForRecoveryContext(record.recoveryContext, notes);
    return saved && (purpose === 'rollback' || isNotesAccountRecoveryContextActive(record.recoveryContext));
  }
  if (getNotesPersistenceMode() === 'localStorage') {
    try {
      localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
      return true;
    } catch {
      return false;
    }
  }
  let db: IDBDatabase | null = null;
  try {
    db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(NOTES_IDB_NAME, NOTES_IDB_VERSION);
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(NOTES_IDB_STORE)) request.result.createObjectStore(NOTES_IDB_STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
    });
    const openedDb = db;
    if (!openedDb) return false;
    await new Promise<void>((resolve, reject) => {
      const tx = openedDb.transaction(NOTES_IDB_STORE, 'readwrite');
      const store = tx.objectStore(NOTES_IDB_STORE);
      tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed'));
      tx.onabort = () => reject(new Error('IndexedDB write aborted'));
      tx.oncomplete = () => resolve();
      const clear = store.clear();
      clear.onerror = () => reject(clear.error ?? new Error('IndexedDB clear failed'));
      clear.onsuccess = () => {
        if (!isOperationEpochCurrent(record.operationEpoch)) {
          tx.abort();
          return;
        }
        notes.forEach(note => store.put(normalizeNote(note)));
      };
    });
    openedDb.close();
    db = null;
    bumpNotesIndexedDbRevision();
    return true;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

function saveAuthorizedRestoreFolders(
  folders: readonly NoteFolder[],
  capability: unknown,
  purpose: LocalCoreJsonRestorePurpose,
): boolean {
  const record = authorityRecord(capability);
  if (!record || record.state !== 'notes_write_started' || record.purpose !== purpose) return false;
  if (record.recoveryContext) {
    if (purpose === 'restore' && !isNotesAccountRecoveryContextActive(record.recoveryContext)) return false;
    return saveFoldersForRecoveryContext(record.recoveryContext, folders);
  }
  return saveFolders(folders as NoteFolder[]);
}

async function loadAuthorizedRestoreNotes(capability: unknown): Promise<Note[]> {
  const record = authorityRecord(capability);
  if (record?.recoveryContext) return loadNotesForRecoveryContext(record.recoveryContext) as Promise<Note[]>;
  return loadNotesAsync() as Promise<Note[]>;
}

function loadAuthorizedRestoreFolders(capability: unknown): NoteFolder[] {
  const record = authorityRecord(capability);
  if (record?.recoveryContext) return loadFoldersForRecoveryContext(record.recoveryContext) as NoteFolder[];
  return loadFolders();
}

async function withLocalCoreJsonRestoreAuthorities<T>(
  input: LocalCoreJsonRestoreAuthorizationInput,
  binding: LocalCoreJsonRestoreAuthorityBinding,
  operation: (authorities: LocalCoreJsonRestoreAuthorities) => Promise<T>,
): Promise<T | null> {
  if (!mayRestoreLocalCoreJsonBackup(input) || input.selectedNoteCount !== (binding.notes as Note[]).length) return null;
  const restore = createLocalCoreJsonRestoreAuthority(binding, 'restore');
  const rollback = createLocalCoreJsonRestoreAuthority({
    ...binding,
    notes: binding.snapshotNotes,
    folders: binding.snapshotFolders,
  }, 'rollback');
  if (!restore || !rollback) return null;
  try { return await operation({ restore, rollback }); }
  finally {
    invalidateRestoreAuthority(restore);
    invalidateRestoreAuthority(rollback);
  }
}

type LocalCoreJsonRestoreAuthorityTestHooks = {
  create: typeof createLocalCoreJsonRestoreAuthority;
  diagnoseNotes: typeof diagnoseRestoreNotes;
  diagnoseFolders: typeof diagnoseRestoreFolders;
  validatePayload: typeof validateRestorePayload;
  validateFolders: typeof validateRestoreFolders;
  saveNotes: typeof saveAuthorizedRestoreNotes;
  complete: typeof completeRestoreAuthority;
  invalidate: typeof invalidateRestoreAuthority;
  persist: typeof persistAndVerifyRestoreState;
  run: (
    input: LocalCoreJsonRestoreAuthorizationInput,
    binding: LocalCoreJsonRestoreAuthorityBinding,
    operation: (authorities: LocalCoreJsonRestoreAuthorities) => Promise<unknown>,
  ) => Promise<unknown | null>;
};

/** Test-only access to the private capability machinery; production builds expose no hook. */
export const __testOnlyLocalCoreJsonRestoreAuthorityHooks: LocalCoreJsonRestoreAuthorityTestHooks | undefined =
  import.meta.env.MODE === 'test' ? Object.freeze({
    create: createLocalCoreJsonRestoreAuthority,
    diagnoseNotes: diagnoseRestoreNotes,
    diagnoseFolders: diagnoseRestoreFolders,
    validatePayload: validateRestorePayload,
    validateFolders: validateRestoreFolders,
    saveNotes: saveAuthorizedRestoreNotes,
    complete: completeRestoreAuthority,
    invalidate: invalidateRestoreAuthority,
    persist: persistAndVerifyRestoreState,
    run: withLocalCoreJsonRestoreAuthorities,
  }) : undefined;

async function persistAndVerifyRestoreState(
  expected: { notes: Note[]; folders: NoteFolder[] },
  previous: { notes: Note[]; folders: NoteFolder[] },
  authorities: LocalCoreJsonRestoreAuthorities,
): Promise<{ notes: Note[]; folders: NoteFolder[] }> {
  let stage: VaultRestoreDurabilityStage = 'notes_write';
  try {
    if (!validateRestorePayload(
      authorities.restore,
      'restore',
      expected.notes,
      expected.folders,
      previous.notes,
      previous.folders,
    )) throw new Error('restore_authority_payload');
    const notesWrite = await saveAuthorizedRestoreNotes(expected.notes, authorities.restore, 'restore');
    if (!notesWrite) throw new Error('notes_write:rejected');

    stage = 'folders_write';
    if (!validateRestoreFolders(
      authorities.restore,
      'restore',
      expected.folders,
      previous.notes,
      previous.folders,
    )) throw new Error('restore_authority_folders');
    if (!saveAuthorizedRestoreFolders(expected.folders, authorities.restore, 'restore')) throw new Error('folders_write:rejected');

    stage = 'notes_readback';
    const persistedNotes = await loadAuthorizedRestoreNotes(authorities.restore);
    if (!sameDurablePayload(expected.notes, persistedNotes)) throw new Error('notes_readback:mismatch');

    stage = 'folders_readback';
    const persistedFolders = loadAuthorizedRestoreFolders(authorities.restore);
    if (!sameDurablePayload(expected.folders, persistedFolders)) throw new Error('folders_readback:mismatch');
    if (!completeRestoreAuthority(authorities.restore, 'restore')) throw new Error('restore_authority_complete');

    return { notes: [...persistedNotes], folders: [...persistedFolders] };
  } catch (cause) {
    let rollbackVerified = false;
    try {
      if (!validateRestorePayload(
        authorities.rollback,
        'rollback',
        previous.notes,
        previous.folders,
        previous.notes,
        previous.folders,
      )) throw new Error('rollback_authority_payload');
      const rollbackNotes = await saveAuthorizedRestoreNotes(previous.notes, authorities.rollback, 'rollback');
      if (!validateRestoreFolders(
        authorities.rollback,
        'rollback',
        previous.folders,
        previous.notes,
        previous.folders,
      )) throw new Error('rollback_authority_folders');
      if (!rollbackNotes || !saveAuthorizedRestoreFolders(previous.folders, authorities.rollback, 'rollback')) throw new Error('rollback_write');
      const readbackNotes = await loadAuthorizedRestoreNotes(authorities.rollback);
      const readbackFolders = loadAuthorizedRestoreFolders(authorities.rollback);
      rollbackVerified = sameDurablePayload(previous.notes, readbackNotes)
        && sameDurablePayload(previous.folders, readbackFolders);
      if (rollbackVerified && !completeRestoreAuthority(authorities.rollback, 'rollback')) rollbackVerified = false;
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
    relations?: Record<string, string[]> | null;
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
    relations: localIsNewer
      ? local.relations
      : (n.relations ?? local?.relations),
  };
}

// Legacy browser-global Notes/Folders are intentionally never exposed before
// an authenticated account authority has loaded its own namespace.
const initialNotes: Note[] = [];
const initialFolders: NoteFolder[] = [];
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
  const currentSyncIssue = (): SyncIssueState | null => {
    const state = get();
    const issue = state.syncIssue;
    return issue && state.syncError === issue.message ? issue : null;
  };

  const setSyncIssue = (
    message: string,
    source: SyncIssueSource,
    options: { targetId?: string; retryable?: boolean } = {},
  ): void => {
    if (shouldPreserveExistingSyncIssue(currentSyncIssue(), source)) return;
    set({
      syncError: message,
      syncIssue: {
        source,
        targetId: options.targetId,
        retryable: options.retryable ?? false,
        message,
      },
    });
  };

  const clearSyncIssue = (source: SyncIssueSource, targetId?: string): boolean => {
    const issue = currentSyncIssue();
    if (!issue || issue.source !== source
      || issue.targetId !== targetId) return false;
    set({ syncError: null, syncIssue: null });
    return true;
  };

  const dismissNoTargetStaleSyncIssue = (): void => {
    if (!get().syncError) return;
    const issue = currentSyncIssue();
    if (!issue) {
      set({ syncError: null, syncIssue: null });
      return;
    }
    const retryTargetMissing = (issue.source === 'note_remote_write' && !lastFailedNote)
      || (issue.source === 'note_remote_delete' && !lastFailedDeleteId);
    if (retryTargetMissing) set({ syncError: null, syncIssue: null });
  };

  const syncNoteToDB = async (note: Note): Promise<boolean> => {
    if (!mayUploadRemote()) {
      recordRecoveryBlock('upload_remote');
      setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
      return false;
    }
    const operationEpoch = captureOperationEpoch();
    if (!isNotesCloudSyncEnabled()) {
      if (lastFailedNote?.id === note.id) lastFailedNote = null;
      clearSyncIssue('note_remote_write', note.id);
      set({ savedAt: new Date() });
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
        setSyncIssue(`Cloud sync failed (${res.status})`, 'note_remote_write', { targetId: note.id, retryable: true });
        return false;
      }
      if (lastFailedNote?.id === note.id) lastFailedNote = null;
      clearSyncIssue('note_remote_write', note.id);
      set({ savedAt: new Date() });
      return true;
    } catch (err) {
      if (err instanceof RecoveryModeBlockedError) {
        setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
        return false;
      }
      lastFailedNote = note;
      setSyncIssue(err instanceof Error ? err.message : 'Cloud sync failed', 'note_remote_write', { targetId: note.id, retryable: true });
      return false;
    }
  };

  const removeNoteFromDB = async (id: string): Promise<boolean> => {
    if (!mayUploadRemote()) {
      recordRecoveryBlock('upload_remote');
      setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
      return false;
    }
    const operationEpoch = captureOperationEpoch();
    if (!isNotesCloudSyncEnabled()) {
      if (lastFailedDeleteId === id) lastFailedDeleteId = null;
      clearSyncIssue('note_remote_delete', id);
      return true;
    }
    try {
      const res = await authFetch(`${API_URL}/api/notes/${id}`, { method: 'DELETE' });
      assertCurrentOperationEpoch(operationEpoch, 'upload_remote');
      if (!res.ok) {
        lastFailedDeleteId = id;
        setSyncIssue(`Cloud delete failed (${res.status})`, 'note_remote_delete', { targetId: id, retryable: true });
        return false;
      }
      if (lastFailedDeleteId === id) lastFailedDeleteId = null;
      clearSyncIssue('note_remote_delete', id);
      return true;
    } catch (err) {
      if (err instanceof RecoveryModeBlockedError) {
        setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
        return false;
      }
      lastFailedDeleteId = id;
      setSyncIssue(err instanceof Error ? err.message : 'Cloud delete failed', 'note_remote_delete', { targetId: id, retryable: true });
      return false;
    }
  };

  const persistNotes = (notes: Note[]) => {
    const handleResult = (result: ReturnType<typeof saveNotesSyncResult>) => {
      if (result.status !== 'persisted') {
        setSyncIssue(LOCAL_NOTES_SAVE_ERROR, 'local_notes_persistence', {
          retryable: result.status !== 'blocked',
        });
      } else {
        clearSyncIssue('local_notes_persistence');
        scheduleAutoSnapshot(notes, get().folders);
      }
    };
    if (getNotesPersistenceMode() === 'localStorage') {
      handleResult(saveNotesSyncResult(notes));
      return;
    }
    void saveNotesAsync(notes).then(handleResult);
  };

  const persistFolders = (folders: NoteFolder[]) => {
    if (!saveFolders(folders)) {
      setSyncIssue(LOCAL_FOLDERS_SAVE_ERROR, 'local_folders_persistence', { retryable: true });
    } else {
      clearSyncIssue('local_folders_persistence');
      scheduleAutoSnapshot(get().notes, folders);
    }
  };

  const syncFolderToDB = async (folder: NoteFolder): Promise<boolean> => {
    if (!mayUploadRemote()) {
      recordRecoveryBlock('upload_remote');
      setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
      return false;
    }
    const operationEpoch = captureOperationEpoch();
    if (!isNotesCloudSyncEnabled()) {
      clearSyncIssue('folder_remote', folder.id);
      return true;
    }
    try {
      const res = await authFetch(`${API_URL}/api/note_folders`, {
        method: 'POST',
        body: JSON.stringify({ id: folder.id, name: folder.name, created_at: folder.createdAt }),
      });
      assertCurrentOperationEpoch(operationEpoch, 'upload_remote');
      if (!res.ok) {
        setSyncIssue(`Cloud folder sync failed (${res.status})`, 'folder_remote', { targetId: folder.id });
        return false;
      }
      clearSyncIssue('folder_remote', folder.id);
      return true;
    } catch (err) {
      if (err instanceof RecoveryModeBlockedError) setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
      else setSyncIssue(err instanceof Error ? err.message : 'Cloud folder sync failed', 'folder_remote', { targetId: folder.id });
      return false;
    }
  };

  const removeFolderFromDB = async (id: string): Promise<boolean> => {
    if (!mayUploadRemote()) {
      recordRecoveryBlock('upload_remote');
      setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
      return false;
    }
    const operationEpoch = captureOperationEpoch();
    if (!isNotesCloudSyncEnabled()) {
      clearSyncIssue('folder_remote', id);
      return true;
    }
    try {
      const res = await authFetch(`${API_URL}/api/note_folders/${id}`, { method: 'DELETE' });
      assertCurrentOperationEpoch(operationEpoch, 'upload_remote');
      if (!res.ok) {
        setSyncIssue(`Cloud folder delete failed (${res.status})`, 'folder_remote', { targetId: id });
        return false;
      }
      clearSyncIssue('folder_remote', id);
      return true;
    } catch (err) {
      if (err instanceof RecoveryModeBlockedError) setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
      else setSyncIssue(err instanceof Error ? err.message : 'Cloud folder delete failed', 'folder_remote', { targetId: id });
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
    activeNoteId: null,
    activeAccountId: null,
    notesAuthorityState: 'NOT_LOADED',
    foldersAuthorityState: 'NOT_LOADED',
    activeFolderId: null,
    vaultStructureVersion: 0,
    indexContentVersion: 0,
    isSyncing: false,
    savedAt: null,
    syncError: null,
    syncIssue: null,
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
      const recoveryContext = getNotesPersistenceMode() === 'accountScoped'
        ? createNotesAccountRecoveryContext() ?? undefined
        : undefined;
      if (getNotesPersistenceMode() === 'accountScoped' && !recoveryContext) {
        recordRecoveryBlock('restore', 'unsafe_replacement');
        throw new RecoveryModeBlockedError('restore');
      }
      const verifiedSnapshot = saveVaultRestoreSnapshot(currentNotes, currentFolders);
      const restoreEpoch = captureOperationEpoch();
      const beforeIds = new Set(currentNotes.map(n => n.id));
      const prevFolderIds = new Set(currentFolders.map(f => f.id));
      const appliedRestore = applyVaultRestore(
        canonicalManifest,
        currentNotes,
        currentFolders,
        strategy,
      );
      const manifestNoteIds = new Set(canonicalManifest.notes.map(note => note.id));
      const manifestFolderIds = new Set(canonicalManifest.folders.map(folder => folder.id));
      const notes = isRecoveryModeActive() && strategy === 'replace'
        ? appliedRestore.notes.filter(note => manifestNoteIds.has(note.id))
        : appliedRestore.notes;
      const folders = isRecoveryModeActive() && strategy === 'replace'
        ? appliedRestore.folders.filter(folder => manifestFolderIds.has(folder.id))
        : appliedRestore.folders;
      const { result } = appliedRestore;
      const authorizedRestore: Promise<{ notes: Note[]; folders: NoteFolder[] } | null> = withLocalCoreJsonRestoreAuthorities(
        authorizationInput,
        {
          notes,
          folders,
          snapshotNotes: verifiedSnapshot.notes,
          snapshotFolders: verifiedSnapshot.folders,
          operationEpoch: restoreEpoch,
          recoveryContext,
        },
        authorities => persistAndVerifyRestoreState(
          { notes, folders },
          { notes: verifiedSnapshot.notes, folders: verifiedSnapshot.folders },
          authorities,
        ),
      );
      if (!authorizedRestore) {
        recordRecoveryBlock('restore', 'unsafe_replacement');
        throw new RecoveryModeBlockedError('restore');
      }
      return authorizedRestore.then(persisted => {
        if (recoveryContext && !isNotesAccountRecoveryContextActive(recoveryContext)) {
          throw new RecoveryModeBlockedError('restore');
        }
        if (!persisted) {
          recordRecoveryBlock('restore', 'unsafe_replacement');
          throw new RecoveryModeBlockedError('restore');
        }
        const existingIssue = currentSyncIssue();
        const keepExistingIssue = existingIssue && existingIssue.source !== 'recovery';
        set({
          notes: persisted.notes,
          folders: persisted.folders,
          syncError: keepExistingIssue ? get().syncError : null,
          syncIssue: keepExistingIssue ? existingIssue : null,
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
        if (recoveryContext && !isNotesAccountRecoveryContextActive(recoveryContext)) throw error;
        const message = error instanceof VaultRestoreDurabilityError && !error.rollbackVerified
          ? VAULT_RESTORE_RECOVERY_REQUIRED_MESSAGE
          : VAULT_RESTORE_DURABILITY_FAILURE_MESSAGE;
        setSyncIssue(message, 'recovery');
        set({ vaultRestoreCanUndo: false });
        throw error;
      });
    },

    canUndoVaultRestore: isVaultRestoreUndoAvailable,

    undoLastVaultRestore: () => {
      if (!mayUndoRestore()) {
        recordRecoveryBlock('undo_restore');
        setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
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
      clearSyncIssue('recovery');
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

    prepareNotePermanentDelete: (id) => {
      const state = get();
      const accountId = state.activeAccountId;
      const note = state.notes.find(candidate => candidate.id === id);
      if (!accountId || !note?.deletedAt) {
        setSyncIssue('Permanent delete requires one trashed Note in the active account.', 'recovery_permanent_delete', { targetId: id });
        return null;
      }
      const authorization = prepareNotesSingleDelete({
        operation: USER_INITIATED_SINGLE_NOTE_DELETE,
        accountId,
        note,
        explicitUserAction: true,
      });
      if (!authorization) {
        setSyncIssue('Permanent delete authorization could not be established.', 'recovery_permanent_delete', { targetId: id });
      }
      return authorization;
    },

    permanentDeleteNote: async (authorization) => get().deleteNotePermanently(authorization),

    deleteNotePermanently: async (authorization) => {
      const begun = await beginNotesSingleDelete(authorization);
      if (!begun) {
        setSyncIssue('Permanent delete was blocked because its account or operation context is stale.', 'recovery_permanent_delete');
        return false;
      }
      const targetBeforeDelete = get().notes.find(note => note.id === begun.noteId);
      const beforeRemote = validateNotesSingleDeleteTarget(
        authorization,
        begun.accountId,
        targetBeforeDelete,
      );
      if (!beforeRemote.valid) {
        abortNotesSingleDelete(authorization);
        setSyncIssue(`Permanent delete was not completed (${beforeRemote.reason}). The Note was kept.`, 'recovery_permanent_delete', { targetId: begun.noteId });
        return false;
      }
      const attachmentGcCandidates = targetBeforeDelete
        ? collectNoteAttachmentRefs(targetBeforeDelete)
        : new Set<string>();
      const remote = await deleteSingleRemoteNote(authorization, begun.accountId, begun.noteId);
      if (!remote.ok) {
        if (remote.outcome === 'confirmed_not_deleted') abortNotesSingleDelete(authorization);
        setSyncIssue(remote.outcome === 'ambiguous'
          ? 'Permanent delete could not be confirmed; it will be reconciled safely. The Note was kept.'
          : `Permanent delete failed (${remote.error}). The Note was kept.`, 'recovery_permanent_delete', { targetId: begun.noteId });
        return false;
      }
      if (!confirmNotesSingleRemoteDelete(authorization)) {
        setSyncIssue('Permanent delete stopped after the remote response became stale. The local Note was kept.', 'recovery_permanent_delete', { targetId: begun.noteId });
        return false;
      }
      const commit = await commitNotesSingleDelete(
        authorization,
        () => validateNotesSingleDeleteTarget(
          authorization,
          begun.accountId,
          get().notes.find(note => note.id === begun.noteId),
        ),
      );
      if (commit.status !== 'COMMITTED') {
        setSyncIssue(commit.status === 'CONFLICT'
          ? `Permanent delete was not completed (${commit.reason}). The newer or restored Note was kept.`
          : 'Permanent delete could not be verified in local durable storage. The visible Note was kept.', 'recovery_permanent_delete', { targetId: begun.noteId });
        return false;
      }

      const id = begun.noteId;
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
        savedAt: new Date(),
      });
      clearSyncIssue('recovery_permanent_delete', id);
      setCachedNotes(notes);
      saveActiveNoteId(nextActive);
      invalidateNoteGalaxyMapCache();
      if (attachmentGcCandidates.size > 0) {
        void gcOrphanedLocalNoteAttachments({
          accountId: begun.accountId,
          candidateAttachmentIds: attachmentGcCandidates,
          getSurvivingNotes: () => get().activeAccountId === begun.accountId ? get().notes : null,
          readDurableSurvivingNotes: async () => {
            if (get().activeAccountId !== begun.accountId) return null;
            try {
              return await loadAccountScopedNotes(begun.accountId);
            } catch {
              return null;
            }
          },
        }).catch(() => { /* Best-effort GC must never change the committed Note deletion. */ });
      }
      return true;
    },

    emptyTrash: () => {
      if (!mayEmptyTrash()) {
        recordRecoveryBlock('empty_trash');
        setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
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

    bootstrapFromSupabase: async () => {
      const context = createNotesAccountRecoveryContext();
      if (!context) return;
      set({ isSyncing: true });
      try {
        const accountId = getActiveNotesAuthorityAccountId();
        if (!accountId) throw new Error('notes_bootstrap_account_missing');
        const remote = await fetchCompleteNotesFoldersSnapshot(accountId);
        if (!isNotesAccountRecoveryContextActive(context)) throw new Error('notes_bootstrap_stale');
        const previousNotes = await loadNotesForRecoveryContext(context);
        const previousFolders = loadFoldersForRecoveryContext(context);
        // Absence is not deletion evidence. Even a complete remote snapshot
        // must not remove a proven local row unless its explicit tombstone is
        // present in the response.
        const remoteNoteIds = new Set(remote.notes.map(note => note.id));
        const remoteFolderIds = new Set(remote.folders.map(folder => folder.id));
        const deleteReconciliation = reconcileNotesSingleDeletesForBootstrap(accountId, remoteNoteIds, previousNotes);
        if (previousNotes.some(note => !remoteNoteIds.has(note.id)
          && !deleteReconciliation.authorizedMissingNoteIds.has(note.id)
          && !deleteReconciliation.preservedConflictNoteIds.has(note.id))
          || previousFolders.some(folder => !remoteFolderIds.has(folder.id))) {
          throw new Error('notes_bootstrap_missing_remote_row_preserved_local');
        }
        const preservedConflictIds = deleteReconciliation.preservedConflictNoteIds;
        const previousById = new Map(previousNotes.map(note => [note.id, note]));
        const notes = remote.notes.map(row => {
          const preserved = preservedConflictIds.has(row.id) ? previousById.get(row.id) : undefined;
          return preserved ?? mapDbNote(row, undefined);
        });
        for (const note of previousNotes) {
          if (preservedConflictIds.has(note.id) && !remoteNoteIds.has(note.id)) notes.push(note);
        }
        const folders = remote.folders.map(mapDbFolder);
        const applied = await applyNotesFoldersForRecoveryContext(
          context, previousNotes, previousFolders, notes, folders,
        );
        if (!applied.applied) {
          throw new Error(applied.rollbackVerified
            ? 'notes_bootstrap_apply_failed'
            : 'notes_bootstrap_recovery_required');
        }
        if (!isNotesAccountRecoveryContextActive(context)) throw new Error('notes_bootstrap_stale');
        if (!completeNotesSingleDeleteBootstrapReconciliation(deleteReconciliation.markersToClear)) {
          throw new Error('notes_single_delete_marker_clear_failed');
        }
        const previousActive = get().activeNoteId;
        const nextActive = notes.some(note => note.id === previousActive && !note.deletedAt)
          ? previousActive : (notes.find(note => !note.deletedAt)?.id ?? null);
        const conflictMessage = preservedConflictIds.size > 0
          ? 'Permanent delete conflict was preserved locally and requires explicit resolution.'
          : null;
        const conflictTargetId = preservedConflictIds.size === 1
          ? [...preservedConflictIds][0]
          : undefined;
        const existingIssue = currentSyncIssue();
        const resolvedRecoveryConflict = existingIssue?.source === 'recovery_permanent_delete'
          && existingIssue.targetId !== undefined
          && deleteReconciliation.markersToClear.some(marker => marker.noteId === existingIssue.targetId);
        const keepExistingIssue = !conflictMessage
          && existingIssue
          && existingIssue.source !== 'bootstrap'
          && !resolvedRecoveryConflict;
        set({
          notes,
          folders,
          activeNoteId: nextActive,
          notesAuthorityState: notes.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED',
          foldersAuthorityState: folders.length === 0 ? 'LOADED_EMPTY' : 'LOADED_POPULATED',
          vaultStructureVersion: get().vaultStructureVersion + 1,
          syncError: conflictMessage ?? (keepExistingIssue ? get().syncError : null),
          syncIssue: conflictMessage
            ? { source: 'recovery_permanent_delete', targetId: conflictTargetId, retryable: false, message: conflictMessage }
            : (keepExistingIssue ? existingIssue : null),
        });
        saveActiveNoteId(nextActive);
        rebuildKnowledgeIndex(notes);
      } catch (error) {
        if (isNotesAccountRecoveryContextActive(context)) {
          setSyncIssue(error instanceof Error ? error.message : 'notes_bootstrap_failed', 'bootstrap');
        }
      } finally {
        if (isNotesAccountRecoveryContextActive(context)) set({ isSyncing: false });
      }
    },

    syncNoteToDB,
    flushPendingSync,
    retrySync: () => {
      const afterNotesSaved = () => {
        if (!saveFolders(get().folders)) {
          setSyncIssue(LOCAL_FOLDERS_SAVE_ERROR, 'local_folders_persistence', { retryable: true });
          return;
        }
        clearSyncIssue('local_folders_persistence');
        if (lastFailedDeleteId) {
          void removeNoteFromDB(lastFailedDeleteId);
          return;
        }
        if (lastFailedNote) {
          void syncNoteToDB(lastFailedNote);
          return;
        }
        dismissNoTargetStaleSyncIssue();
      };

      if (getNotesPersistenceMode() === 'localStorage') {
        const result = saveNotesSyncResult(get().notes);
        if (result.status !== 'persisted') {
          setSyncIssue(LOCAL_NOTES_SAVE_ERROR, 'local_notes_persistence', {
            retryable: result.status !== 'blocked',
          });
          return;
        }
        clearSyncIssue('local_notes_persistence');
        afterNotesSaved();
        return;
      }

      void saveNotesAsync(get().notes).then(result => {
        if (result.status !== 'persisted') {
          setSyncIssue(LOCAL_NOTES_SAVE_ERROR, 'local_notes_persistence', {
            retryable: result.status !== 'blocked',
          });
          return;
        }
        clearSyncIssue('local_notes_persistence');
        afterNotesSaved();
      });
    },

    initNotesStorage: async (accountId) => {
      const request = accountId?.trim() ? activateNotesAccountAuthority(accountId) : null;
      let result;
      try {
        result = await initNotesPersistence(accountId, request ?? undefined);
      } catch (error) {
        if (request && !isNotesAuthorityRequestActive(request)) return;
        set({
          notes: [],
          folders: [],
          activeNoteId: null,
          activeAccountId: accountId?.trim() || null,
          notesAuthorityState: 'RECOVERY_REQUIRED',
          foldersAuthorityState: 'RECOVERY_REQUIRED',
        });
        setSyncIssue(error instanceof Error ? error.message : LOCAL_NOTES_SAVE_ERROR, 'initialization');
        rebuildKnowledgeIndex([]);
        throw error;
      }
      if (result.accountId && (result.requestGeneration === undefined
        || !isNotesAuthorityRequestActive({ accountId: result.accountId, generation: result.requestGeneration }))) return;
      // The unauthenticated compatibility path retains its legacy merge for
      // existing tests and migration tooling. Authenticated runtime calls pass
      // an account id and intentionally never merge across account memory.
      const currentNotes = get().notes;
      const notes = result.accountId
        ? result.notes
        : (currentNotes.length > 0 ? mergeNoteArrays(result.notes, currentNotes) : result.notes);
      const folders = loadFolders();
      const previousActive = get().activeNoteId;
      const nextActive = result.accountId
        ? loadActiveNoteId(notes)
        : (notes.some(note => note.id === previousActive) ? previousActive : loadActiveNoteId(notes));
      const fallbackError = result.fallbackError;
      set({
        notes,
        folders,
        activeNoteId: nextActive,
        activeAccountId: result.accountId ?? null,
        notesAuthorityState: result.notesAuthorityState?.state ?? 'NOT_LOADED',
        foldersAuthorityState: result.foldersAuthorityState?.state ?? 'NOT_LOADED',
        vaultStructureVersion: get().vaultStructureVersion + 1,
      });
      if (fallbackError) {
        // Initialization fallback is distinct from a failed local write. A
        // readable load does not prove that a prior write failure recovered.
        setSyncIssue(fallbackError, 'initialization', { retryable: true });
      } else {
        clearSyncIssue('initialization');
      }
      if (!result.accountId && (notes.length !== result.notes.length || currentNotes.length > 0)) {
        persistNotes(notes);
      }
      rebuildKnowledgeIndex(notes);
      saveActiveNoteId(nextActive);
    },

    detachNotesStorage: () => {
      clearAllBodySyncTimers();
      pendingBodySync.clear();
      lastFailedNote = null;
      lastFailedDeleteId = null;
      detachNotesPersistenceAccount();
      set({
        notes: [],
        folders: [],
        activeNoteId: null,
        activeFolderId: null,
        activeAccountId: null,
        notesAuthorityState: 'NOT_LOADED',
        foldersAuthorityState: 'NOT_LOADED',
        syncError: null,
        syncIssue: null,
        isSyncing: false,
        savedAt: null,
        vaultStructureVersion: get().vaultStructureVersion + 1,
        indexContentVersion: 0,
      });
      rebuildKnowledgeIndex([]);
    },

    resetAllNotes: () => {
      if (!mayReset()) {
        recordRecoveryBlock('reset');
        setSyncIssue(RECOVERY_MODE_MESSAGE, 'recovery');
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
        syncIssue: null,
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

function setStoreSyncIssue(
  message: string,
  source: SyncIssueSource,
  options: { targetId?: string; retryable?: boolean } = {},
): void {
  const state = useNotesStore.getState();
  const existing = state.syncIssue && state.syncError === state.syncIssue.message
    ? state.syncIssue
    : null;
  if (shouldPreserveExistingSyncIssue(existing, source)) return;
  useNotesStore.setState({
    syncError: message,
    syncIssue: {
      source,
      targetId: options.targetId,
      retryable: options.retryable ?? false,
      message,
    },
  });
}

function clearStoreSyncIssue(source: SyncIssueSource): void {
  const state = useNotesStore.getState();
  if (state.syncIssue?.message !== state.syncError || state.syncIssue.source !== source) return;
  useNotesStore.setState({ syncError: null, syncIssue: null });
}

function applyStorageMerge(key: string | null, newValue: string | null) {
  if (!key || applyingStorageMerge) return;
  // Account-scoped Notes/Folders never consume events from the legacy global
  // browser keys or their previous IndexedDB revision signal.
  if (isNotesAccountAuthorityActive()) return;
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
      const result = saveNotesSyncResult(merged);
      if (result.status !== 'persisted') {
        setStoreSyncIssue(LOCAL_NOTES_SAVE_ERROR, 'local_notes_persistence', {
          retryable: result.status !== 'blocked',
        });
      } else {
        clearStoreSyncIssue('local_notes_persistence');
      }
    } else {
      void saveNotesAsync(merged).then(result => {
        if (result.status !== 'persisted') {
          setStoreSyncIssue(LOCAL_NOTES_SAVE_ERROR, 'local_notes_persistence', {
            retryable: result.status !== 'blocked',
          });
        } else {
          clearStoreSyncIssue('local_notes_persistence');
        }
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
    if (!saveFolders(merged)) setStoreSyncIssue(LOCAL_FOLDERS_SAVE_ERROR, 'local_folders_persistence', { retryable: true });
    else clearStoreSyncIssue('local_folders_persistence');
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
