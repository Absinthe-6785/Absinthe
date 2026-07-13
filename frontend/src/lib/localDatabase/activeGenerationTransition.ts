import { LocalDatabaseError } from './errors';
import {
  advanceLocalFirstRuntimeMode,
  localFirstRuntimeModeKey,
  validatePersistedLocalFirstRuntimeMode,
  type PersistedLocalFirstRuntimeModeRecordV1,
} from './runtimeMode';
import { LOCAL_DATABASE_STORES } from './schema';
import type { DatabaseMetaRecord, GenerationRecord } from './types';
import { validateDatabaseMeta, validateGenerationRecord } from './validation';

export type ActiveGenerationTransitionKind = 'generic' | 'cutover' | 'restore';

export interface ActiveGenerationTransitionRuntime {
  namespaceKey: string;
  namespace: { schemaVersion: number };
}

export interface ActiveGenerationTransitionInput {
  transaction: IDBTransaction;
  runtime: ActiveGenerationTransitionRuntime;
  kind: ActiveGenerationTransitionKind;
  expectedActiveGenerationId: string;
  targetGenerationId: string;
  activatedAt: string;
  nextCutoverMode?: PersistedLocalFirstRuntimeModeRecordV1;
  validateRecords?: (previous: GenerationRecord, target: GenerationRecord) => void;
  afterPointerWrite?: () => void;
  afterModeWrite?: () => void;
}

export interface ActiveGenerationTransitionResult {
  previous: GenerationRecord;
  active: GenerationRecord;
  meta: DatabaseMetaRecord;
  mode: PersistedLocalFirstRuntimeModeRecordV1 | null;
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new DOMException('Request failed', 'UnknownError'));
  });
}

function generationKey(namespaceKey: string, generationId: string): [string, string] {
  return [namespaceKey, generationId];
}

export async function transitionActiveGenerationInTransaction(
  input: ActiveGenerationTransitionInput,
): Promise<ActiveGenerationTransitionResult> {
  const { transaction, runtime } = input;
  const metaStore = transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta);
  const generationStore = transaction.objectStore(LOCAL_DATABASE_STORES.generations);
  const migrationStore = transaction.objectStore(LOCAL_DATABASE_STORES.migrationState);
  const meta = await requestResult(metaStore.get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
  const modeRaw = await requestResult(migrationStore.get(localFirstRuntimeModeKey(runtime.namespaceKey)));
  if (!meta) throw new LocalDatabaseError('MALFORMED_METADATA', 'active_generation_transition');
  validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion);

  let mode: PersistedLocalFirstRuntimeModeRecordV1 | null = null;
  if (modeRaw !== undefined) {
    mode = validatePersistedLocalFirstRuntimeMode(modeRaw, runtime.namespaceKey);
    if (mode.activeGenerationId !== meta.activeGenerationId) {
      throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'active_generation_transition');
    }
  }
  if (meta.activeGenerationId !== input.expectedActiveGenerationId) {
    throw new LocalDatabaseError('STALE_GENERATION', 'active_generation_transition');
  }
  if (input.kind === 'generic' && mode !== null) {
    throw new LocalDatabaseError('ACTIVE_GENERATION_TRANSITION_REQUIRES_PROTOCOL', 'activate_generation');
  }
  if (input.kind === 'cutover' && (mode?.mode !== 'legacy' || !input.nextCutoverMode)) {
    throw new LocalDatabaseError('CUTOVER_PRECONDITION_FAILED', 'active_generation_transition');
  }
  if (input.kind === 'restore' && mode?.mode === 'legacy') {
    throw new LocalDatabaseError('ACTIVE_GENERATION_TRANSITION_REQUIRES_PROTOCOL', 'restore_generation_transition');
  }

  const previous = await requestResult(generationStore.get(
    generationKey(runtime.namespaceKey, input.expectedActiveGenerationId),
  )) as GenerationRecord | undefined;
  const target = await requestResult(generationStore.get(
    generationKey(runtime.namespaceKey, input.targetGenerationId),
  )) as GenerationRecord | undefined;
  if (!previous || previous.status !== 'active') {
    throw new LocalDatabaseError('MALFORMED_METADATA', 'active_generation_transition');
  }
  if (!target) throw new LocalDatabaseError('GENERATION_NOT_FOUND', 'active_generation_transition');
  validateGenerationRecord(previous, runtime.namespaceKey, runtime.namespace.schemaVersion);
  validateGenerationRecord(target, runtime.namespaceKey, runtime.namespace.schemaVersion);
  if (mode === null && previous.creationReason === 'migration'
    && previous.safeSourceReference?.kind === 'legacy_migration') {
    throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'active_generation_transition');
  }
  if (target.status !== 'preparing' || target.validationState === 'invalid') {
    throw new LocalDatabaseError('INVALID_GENERATION_TRANSITION', 'active_generation_transition');
  }
  input.validateRecords?.(previous, target);

  const sealed = { ...previous, status: 'sealed' as const, activeNamespaceKey: undefined };
  const active: GenerationRecord = {
    ...target,
    status: 'active',
    activatedAt: input.activatedAt,
    predecessorGenerationId: previous.generationId,
    validationState: 'valid',
    activeNamespaceKey: runtime.namespaceKey,
  };
  const nextMeta = { ...meta, activeGenerationId: target.generationId };
  generationStore.put(sealed);
  generationStore.put(active);
  metaStore.put(nextMeta);
  input.afterPointerWrite?.();

  let nextMode = mode;
  if (input.kind === 'cutover') {
    nextMode = validatePersistedLocalFirstRuntimeMode(input.nextCutoverMode, runtime.namespaceKey);
    if (nextMode.mode !== 'local_first' || nextMode.activeGenerationId !== target.generationId) {
      throw new LocalDatabaseError('CUTOVER_PRECONDITION_FAILED', 'active_generation_transition');
    }
    migrationStore.put(nextMode);
  } else if (input.kind === 'restore' && mode?.mode === 'local_first') {
    nextMode = advanceLocalFirstRuntimeMode(mode, target.generationId, input.activatedAt);
    migrationStore.put(nextMode);
  }
  input.afterModeWrite?.();
  return { previous, active, meta: nextMeta, mode: nextMode };
}
