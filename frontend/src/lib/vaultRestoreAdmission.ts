import {
  buildVaultRestorePreview,
  type VaultRestoreConflictStrategy,
  type VaultRestorePreview,
} from './importVaultBackup';
import type { VaultBackupManifest } from './exportVaultBackup';
import {
  readVaultRestoreDirectJsonSource,
  readVaultRestoreDirectZipSource,
  readVaultRestoreSnapshotSource,
  sameValidatedRestoreSource,
  type RestoreSourceOrigin,
  type ValidatedRestoreSource,
  type VaultRestoreSnapshotSourceStorage,
} from './vaultRestoreSourceRead';

declare const opaqueRestoreToken: unique symbol;
export type RestorePreviewHandle = Readonly<{ readonly [opaqueRestoreToken]: 'preview' }>;
export type RestoreAdmission = Readonly<{ readonly [opaqueRestoreToken]: 'admission' }>;

export type RestoreDenialCode =
  | 'INVALID_SOURCE_INTEGRITY'
  | 'UNKNOWN_SOURCE_GENERATION'
  | 'SOURCE_UNAVAILABLE'
  | 'SOURCE_CHANGED'
  | 'INVALID_MANIFEST'
  | 'INVALID_INTENT'
  | 'INVALID_ADMISSION'
  | 'SOURCE_REJECTED';

export type RestoreResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly code: RestoreDenialCode };

/**
 * Slice A binding values only. They are caller-supplied and are NOT authenticated
 * production Notes authority; Slice B must source them inside private composition.
 */
export interface RestoreOperationContext {
  readonly accountId: string;
  readonly generation: number;
  readonly operationEpoch: number;
}

export interface RestoreIntent {
  readonly noteIds: readonly string[];
  readonly folderIds: readonly string[];
  readonly strategy: VaultRestoreConflictStrategy;
  readonly restoreCore: boolean;
  readonly restoreExtensions: boolean;
  readonly restoreCloud: boolean;
  readonly backupBeforeRestore: boolean;
}

export interface PreparedRestore {
  readonly handle: RestorePreviewHandle;
  readonly origin: RestoreSourceOrigin;
  readonly sourceId: string;
  /** Detached display projection. It is never used as canonical owner state. */
  readonly preview: VaultRestorePreview;
  readonly intent: RestoreIntent;
  readonly previewRevision: number;
}

export interface ConsumedRestoreAdmission {
  readonly origin: RestoreSourceOrigin;
  readonly sourceId: string;
  readonly manifest: Readonly<VaultBackupManifest>;
  readonly intent: RestoreIntent;
  readonly previewRevision: number;
}

type Phase = 'PREVIEW' | 'ADMITTED' | 'RUNNING' | 'COMPLETED' | 'INVALIDATED';

interface OperationState {
  phase: Phase;
  readonly source: ValidatedRestoreSource;
  readonly file?: Blob;
  readonly snapshotId?: string;
  readonly manifest: Readonly<VaultBackupManifest>;
  intent: RestoreIntent;
  readonly context: RestoreOperationContext;
  revision: number;
  confirmationInFlight: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function freezeDeep<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) freezeDeep(child);
  }
  return value;
}

function copyContext(context: RestoreOperationContext): RestoreOperationContext | null {
  if (!isRecord(context)
    || typeof context.accountId !== 'string'
    || context.accountId.trim().length === 0
    || !Number.isSafeInteger(context.generation)
    || context.generation < 0
    || !Number.isSafeInteger(context.operationEpoch)
    || context.operationEpoch < 0) return null;
  return Object.freeze({
    accountId: context.accountId,
    generation: context.generation,
    operationEpoch: context.operationEpoch,
  });
}

function sameContext(a: RestoreOperationContext, b: RestoreOperationContext): boolean {
  return a.accountId === b.accountId
    && a.generation === b.generation
    && a.operationEpoch === b.operationEpoch;
}

function normalizeIntent(input: RestoreIntent, source: ValidatedRestoreSource): RestoreIntent | null {
  if (!isRecord(input)
    || !Array.isArray(input.noteIds)
    || !Array.isArray(input.folderIds)
    || !['skip', 'replace', 'duplicate'].includes(input.strategy)
    || typeof input.restoreCore !== 'boolean'
    || typeof input.restoreExtensions !== 'boolean'
    || typeof input.restoreCloud !== 'boolean'
    || typeof input.backupBeforeRestore !== 'boolean') return null;

  const noteIds = [...input.noteIds];
  const folderIds = [...input.folderIds];
  if (noteIds.some(id => typeof id !== 'string' || id.trim().length === 0)
    || folderIds.some(id => typeof id !== 'string' || id.trim().length === 0)
    || new Set(noteIds).size !== noteIds.length
    || new Set(folderIds).size !== folderIds.length) return null;

  const availableNotes = new Set(source.manifest.notes.map(note => note.id));
  const availableFolders = new Set(source.manifest.folders.map(folder => folder.id));
  if (noteIds.some(id => !availableNotes.has(id)) || folderIds.some(id => !availableFolders.has(id))) return null;

  // Slice A preserves the approved local/core-only snapshot boundary.
  if (source.origin === 'snapshot'
    && (!input.restoreCore || input.restoreExtensions || input.restoreCloud)) return null;

  return Object.freeze({
    noteIds: Object.freeze(noteIds),
    folderIds: Object.freeze(folderIds),
    strategy: input.strategy,
    restoreCore: input.restoreCore,
    restoreExtensions: input.restoreExtensions,
    restoreCloud: input.restoreCloud,
    backupBeforeRestore: input.backupBeforeRestore,
  });
}

function createToken<T extends object>(): T {
  return Object.freeze(Object.create(null)) as T;
}

function preparedCopy(
  state: OperationState,
  handle: RestorePreviewHandle,
): PreparedRestore {
  const preview = buildVaultRestorePreview(
    cloneJson(state.manifest) as VaultBackupManifest,
    [],
    [],
  );
  return {
    handle,
    origin: state.source.origin,
    sourceId: state.source.sourceId,
    preview: cloneJson(preview),
    intent: cloneJson(state.intent),
    previewRevision: state.revision,
  };
}

function mapSourceError(code: string): RestoreDenialCode {
  if (code === 'INVALID_SOURCE_INTEGRITY' || code === 'UNKNOWN_SOURCE_GENERATION'
    || code === 'SOURCE_UNAVAILABLE' || code === 'INVALID_MANIFEST') return code;
  return 'SOURCE_REJECTED';
}

export interface VaultRestoreAdmissionOwner {
  openSnapshot(
    snapshotId: string,
    intent: RestoreIntent,
    context: RestoreOperationContext,
  ): Promise<RestoreResult<PreparedRestore>>;
  openDirectJson(
    file: Blob,
    intent: RestoreIntent,
    context: RestoreOperationContext,
  ): Promise<RestoreResult<PreparedRestore>>;
  openDirectZip(
    file: Blob,
    intent: RestoreIntent,
    context: RestoreOperationContext,
  ): Promise<RestoreResult<PreparedRestore>>;
  revise(
    handle: RestorePreviewHandle,
    intent: RestoreIntent,
    context: RestoreOperationContext,
  ): RestoreResult<PreparedRestore>;
  confirm(
    handle: RestorePreviewHandle,
    context: RestoreOperationContext,
  ): Promise<RestoreResult<RestoreAdmission>>;
  consume(
    admission: RestoreAdmission,
    context: RestoreOperationContext,
  ): Promise<RestoreResult<ConsumedRestoreAdmission>>;
  complete(admission: RestoreAdmission): boolean;
  fail(admission: RestoreAdmission): boolean;
  cancel(handle: RestorePreviewHandle): boolean;
}

/**
 * Creates one operation owner. It only issues source-admission tokens; it has no
 * Notes-store write capability and is deliberately not wired into product runtime.
 */
export function createVaultRestoreAdmissionOwner(
  snapshotStorage: VaultRestoreSnapshotSourceStorage,
): VaultRestoreAdmissionOwner {
  const handles = new WeakMap<object, OperationState>();
  const admissions = new WeakMap<object, OperationState>();

  function register(
    source: ValidatedRestoreSource,
    file: Blob | undefined,
    snapshotId: string | undefined,
    intentInput: RestoreIntent,
    contextInput: RestoreOperationContext,
  ): RestoreResult<PreparedRestore> {
    const context = copyContext(contextInput);
    if (!context) return { ok: false, code: 'INVALID_ADMISSION' };
    const intent = normalizeIntent(intentInput, source);
    if (!intent) return { ok: false, code: 'INVALID_INTENT' };
    const state: OperationState = {
      phase: 'PREVIEW',
      source,
      ...(file ? { file } : {}),
      ...(snapshotId ? { snapshotId } : {}),
      manifest: freezeDeep(cloneJson(source.manifest)),
      intent,
      context,
      revision: 1,
      confirmationInFlight: false,
    };
    const handle = createToken<RestorePreviewHandle>();
    handles.set(handle as object, state);
    return { ok: true, value: preparedCopy(state, handle) };
  }

  const owner: VaultRestoreAdmissionOwner = {
    async openSnapshot(snapshotId, intent, context) {
      const read = readVaultRestoreSnapshotSource(snapshotId, snapshotStorage);
      if (!read.ok) return { ok: false, code: mapSourceError(read.code) };
      return register(read.source, undefined, snapshotId, intent, context);
    },
    async openDirectJson(file, intent, context) {
      const read = await readVaultRestoreDirectJsonSource(file);
      if (!read.ok) return { ok: false, code: mapSourceError(read.code) };
      return register(read.source, file, undefined, intent, context);
    },
    async openDirectZip(file, intent, context) {
      const read = await readVaultRestoreDirectZipSource(file);
      if (!read.ok) return { ok: false, code: mapSourceError(read.code) };
      return register(read.source, file, undefined, intent, context);
    },
    revise(handle, intentInput, contextInput) {
      const state = handles.get(handle as object);
      if (!state || (state.phase !== 'PREVIEW' && state.phase !== 'ADMITTED') || state.confirmationInFlight) {
        return { ok: false, code: 'INVALID_ADMISSION' };
      }
      const context = copyContext(contextInput);
      if (!context || !sameContext(state.context, context)) {
        state.phase = 'INVALIDATED';
        return { ok: false, code: 'INVALID_ADMISSION' };
      }
      const intent = normalizeIntent(intentInput, state.source);
      if (!intent) return { ok: false, code: 'INVALID_INTENT' };
      state.phase = 'INVALIDATED';
      const next: OperationState = {
        ...state,
        phase: 'PREVIEW',
        intent,
        revision: state.revision + 1,
        confirmationInFlight: false,
      };
      const nextHandle = createToken<RestorePreviewHandle>();
      handles.set(nextHandle as object, next);
      return { ok: true, value: preparedCopy(next, nextHandle) };
    },
    async confirm(handle, contextInput) {
      const state = handles.get(handle as object);
      if (!state || state.phase !== 'PREVIEW' || state.confirmationInFlight) {
        return { ok: false, code: 'INVALID_ADMISSION' };
      }
      const context = copyContext(contextInput);
      if (!context || !sameContext(state.context, context)) {
        state.phase = 'INVALIDATED';
        return { ok: false, code: 'INVALID_ADMISSION' };
      }
      // Set synchronously before the first await, blocking duplicate confirmations.
      state.confirmationInFlight = true;
      let reread: Awaited<ReturnType<typeof readVaultRestoreDirectJsonSource>> | ReturnType<typeof readVaultRestoreSnapshotSource>;
      if (state.source.origin === 'snapshot') {
        reread = readVaultRestoreSnapshotSource(state.snapshotId!, snapshotStorage);
      } else if (state.source.origin === 'direct-json') {
        reread = await readVaultRestoreDirectJsonSource(state.file!);
      } else {
        reread = await readVaultRestoreDirectZipSource(state.file!);
      }
      if (state.phase !== 'PREVIEW') return { ok: false, code: 'INVALID_ADMISSION' };
      state.confirmationInFlight = false;
      const contextAfterRead = copyContext(contextInput);
      if (!contextAfterRead || !sameContext(state.context, contextAfterRead)) {
        state.phase = 'INVALIDATED';
        return { ok: false, code: 'INVALID_ADMISSION' };
      }
      if (!reread.ok) {
        state.phase = 'INVALIDATED';
        return { ok: false, code: 'SOURCE_CHANGED' };
      }
      if (!sameValidatedRestoreSource(state.source, reread.source)) {
        state.phase = 'INVALIDATED';
        return { ok: false, code: 'SOURCE_CHANGED' };
      }
      state.phase = 'ADMITTED';
      const admission = createToken<RestoreAdmission>();
      admissions.set(admission as object, state);
      return { ok: true, value: admission };
    },
    async consume(admission, contextInput) {
      const state = admissions.get(admission as object);
      if (!state || state.phase !== 'ADMITTED') return { ok: false, code: 'INVALID_ADMISSION' };
      const context = copyContext(contextInput);
      if (!context || !sameContext(state.context, context)) {
        state.phase = 'INVALIDATED';
        return { ok: false, code: 'INVALID_ADMISSION' };
      }
      // Consumption is one-shot and changes state before returning any target data.
      state.phase = 'RUNNING';
      let reread: Awaited<ReturnType<typeof readVaultRestoreDirectJsonSource>> | ReturnType<typeof readVaultRestoreSnapshotSource>;
      if (state.source.origin === 'snapshot') {
        reread = readVaultRestoreSnapshotSource(state.snapshotId!, snapshotStorage);
      } else if (state.source.origin === 'direct-json') {
        reread = await readVaultRestoreDirectJsonSource(state.file!);
      } else {
        reread = await readVaultRestoreDirectZipSource(state.file!);
      }
      if (state.phase !== 'RUNNING') return { ok: false, code: 'INVALID_ADMISSION' };
      const contextAfterRead = copyContext(contextInput);
      if (!contextAfterRead || !sameContext(state.context, contextAfterRead)) {
        state.phase = 'INVALIDATED';
        return { ok: false, code: 'INVALID_ADMISSION' };
      }
      if (!reread.ok || !sameValidatedRestoreSource(state.source, reread.source)) {
        state.phase = 'INVALIDATED';
        return { ok: false, code: 'SOURCE_CHANGED' };
      }
      const manifest = freezeDeep(cloneJson(state.manifest));
      return {
        ok: true,
        value: {
          origin: state.source.origin,
          sourceId: state.source.sourceId,
          manifest,
          intent: cloneJson(state.intent),
          previewRevision: state.revision,
        },
      };
    },
    complete(admission) {
      const state = admissions.get(admission as object);
      if (!state || state.phase !== 'RUNNING') return false;
      state.phase = 'COMPLETED';
      return true;
    },
    fail(admission) {
      const state = admissions.get(admission as object);
      if (!state || state.phase !== 'RUNNING') return false;
      state.phase = 'INVALIDATED';
      return true;
    },
    cancel(handle) {
      const state = handles.get(handle as object);
      if (!state || (state.phase !== 'PREVIEW' && state.phase !== 'ADMITTED')) return false;
      state.phase = 'INVALIDATED';
      return true;
    },
  };
  return Object.freeze(owner);
}
