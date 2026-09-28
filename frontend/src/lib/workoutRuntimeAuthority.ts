import { API_URL } from './config';
import { LocalDatabaseError } from './localDatabase/errors';
import {
  closeLocalDatabase, createWorkoutAuthorityLocalDatabaseCapability,
  openLocalDatabase, type LocalDatabaseRepository,
} from './localDatabase/repository';
import { LOCAL_SCHEMA_VERSION, type WorkoutRemoteAuthorityRecordV1 } from './localDatabase/types';
import { runtimeAccountSyncAccountId } from './remoteBoundary';
import {
  HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID,
  HEALTH_ROUTINE_PROJECT_REF, readOrCreateDeviceId,
} from './healthRoutineSync';
import {
  createAuthenticatedWorkoutRemoteControlClient, WorkoutRemoteDiscoveryError,
} from './workoutRemoteClient';
import { WORKOUT_WIRE_UUID } from './workoutRemoteContract';

export type WorkoutAuthorityRuntimeState = Readonly<{
  kind: 'idle' | 'not_ready' | 'discovering' | 'ready' | 'disabled'
    | 'reset_fenced' | 'retry_later' | 'auth_lost' | 'stale' | 'fail_closed';
  accountId: string | null;
  code?: string;
  authorityEpoch?: number;
}>;

type ControlClient = Pick<ReturnType<typeof createAuthenticatedWorkoutRemoteControlClient>, 'discoverAndPersist'>;

export interface WorkoutAuthorityRuntimePorts {
  currentAccountId: () => string | null;
  readOrCreateDeviceId: () => string | null;
  currentDeviceId: () => string | null;
  openRepository: (accountId: string, deviceId: string) => Promise<LocalDatabaseRepository>;
  closeRepository: (repository: LocalDatabaseRepository) => void;
  createClient: (isCurrentAttempt: () => boolean) => ControlClient;
  online: () => boolean;
  onDiagnostic?: (event: string, code?: string) => void;
}

function classify(error: unknown, accountId: string): WorkoutAuthorityRuntimeState {
  if (error instanceof WorkoutRemoteDiscoveryError) {
    const code = error.code;
    if (code === 'FEATURE_DISABLED' || code === 'CAPABILITY_DISABLED') return { kind: 'disabled', accountId, code };
    if (code === 'AUTHORITY_RESET_FENCED') return { kind: 'reset_fenced', accountId, code };
    if (code === 'NETWORK_RETRYABLE') return { kind: 'retry_later', accountId, code };
    if (code === 'AUTH_REQUIRED') return { kind: 'auth_lost', accountId, code };
    if (code === 'IDENTITY_CHANGED' || code === 'STALE_GENERATION_BINDING') return { kind: 'stale', accountId, code };
    return { kind: 'fail_closed', accountId, code };
  }
  if (error instanceof LocalDatabaseError) {
    if (error.code === 'STALE_GENERATION' || error.code === 'NAMESPACE_MISMATCH'
      || error.code === 'GENERATION_NOT_ACTIVE') return { kind: 'stale', accountId, code: error.code };
    if (error.code === 'OPEN_BLOCKED' || error.code === 'OPEN_FAILED') {
      return { kind: 'not_ready', accountId, code: error.code };
    }
    return { kind: 'fail_closed', accountId, code: error.code };
  }
  return { kind: 'fail_closed', accountId, code: 'UNEXPECTED_FAILURE' };
}

/** One account-scoped, control-plane-only attempt. No product mutation or worker is started here. */
export function createWorkoutRuntimeAuthorityController(ports: WorkoutAuthorityRuntimePorts) {
  let sequence = 0;
  let state: WorkoutAuthorityRuntimeState = { kind: 'idle', accountId: null };
  let inFlight: { accountId: string; sequence: number; promise: Promise<WorkoutAuthorityRuntimeState> } | null = null;

  function publish(next: WorkoutAuthorityRuntimeState, run: number): WorkoutAuthorityRuntimeState {
    if (sequence !== run) return { kind: 'stale', accountId: next.accountId, code: 'SUPERSEDED' };
    state = next;
    ports.onDiagnostic?.(`workout_authority_bootstrap_${next.kind}`, next.code);
    return next;
  }

  function start(accountId: string): Promise<WorkoutAuthorityRuntimeState> {
    const owner = accountId.toLowerCase();
    if (inFlight?.accountId === owner && inFlight.sequence === sequence) return inFlight.promise;
    const run = ++sequence;
    publish({ kind: 'discovering', accountId: owner }, run);
    const promise = (async (): Promise<WorkoutAuthorityRuntimeState> => {
      let repository: LocalDatabaseRepository | null = null;
      let expectedDeviceId: string | null = null;
      try {
        if (!WORKOUT_WIRE_UUID.test(owner) || ports.currentAccountId()?.toLowerCase() !== owner) {
          return publish({ kind: 'not_ready', accountId: owner, code: 'ACCOUNT_NOT_READY' }, run);
        }
        if (!ports.online()) return publish({ kind: 'retry_later', accountId: owner, code: 'OFFLINE' }, run);
        const deviceId = ports.readOrCreateDeviceId();
        if (!deviceId) return publish({ kind: 'not_ready', accountId: owner, code: 'DEVICE_NOT_READY' }, run);
        expectedDeviceId = deviceId;
        const current = () => sequence === run && ports.currentAccountId()?.toLowerCase() === owner
          && ports.currentDeviceId() === deviceId;
        if (!current()) return publish({ kind: 'stale', accountId: owner, code: 'IDENTITY_CHANGED' }, run);
        repository = await ports.openRepository(owner, deviceId);
        if (!current()) return publish({ kind: 'stale', accountId: owner, code: 'IDENTITY_CHANGED' }, run);
        const active = await repository.getActiveGeneration();
        if (active.generationId !== repository.namespace.generationId || active.status !== 'active') {
          return publish({ kind: 'stale', accountId: owner, code: 'STALE_GENERATION' }, run);
        }
        if (!current()) return publish({ kind: 'stale', accountId: owner, code: 'IDENTITY_CHANGED' }, run);
        const evidence: WorkoutRemoteAuthorityRecordV1 = await ports.createClient(current).discoverAndPersist(repository);
        if (!current()) return publish({ kind: 'stale', accountId: owner, code: 'IDENTITY_CHANGED' }, run);
        const activeAfter = await repository.getActiveGeneration();
        if (activeAfter.generationId !== repository.namespace.generationId || !current()) {
          return publish({ kind: 'stale', accountId: owner, code: 'STALE_GENERATION' }, run);
        }
        if (evidence.accountId !== owner || evidence.namespaceKey !== repository.namespaceKey
          || evidence.generationId !== repository.namespace.generationId || evidence.deviceId !== deviceId
          || evidence.capability !== 'FOUNDATION_READY' || evidence.authorityState !== 'OPEN') {
          return publish({ kind: 'fail_closed', accountId: owner, code: 'INVALID_AUTHORITY_EVIDENCE' }, run);
        }
        return publish({ kind: 'ready', accountId: owner, authorityEpoch: evidence.authorityEpoch }, run);
      } catch (error) {
        if (sequence !== run) return { kind: 'stale', accountId: owner, code: 'SUPERSEDED' };
        const activeAccount = ports.currentAccountId();
        if ((expectedDeviceId !== null && ports.currentDeviceId() !== expectedDeviceId)
          || activeAccount?.toLowerCase() !== owner) {
          return publish({ kind: 'stale', accountId: owner, code: 'IDENTITY_CHANGED' }, run);
        }
        return publish(classify(error, owner), run);
      } finally {
        if (repository) ports.closeRepository(repository);
      }
    })();
    inFlight = { accountId: owner, sequence: run, promise };
    void promise.then(
      () => { if (inFlight?.promise === promise) inFlight = null; },
      () => { if (inFlight?.promise === promise) inFlight = null; },
    );
    return promise;
  }

  return {
    start,
    cancel: () => {
      sequence += 1;
      inFlight = null;
      state = { kind: 'idle', accountId: null };
      ports.onDiagnostic?.('workout_authority_bootstrap_cancelled');
    },
    snapshot: () => state,
  };
}

async function openSharedActiveRepository(accountId: string, deviceId: string): Promise<LocalDatabaseRepository> {
  const capability = createWorkoutAuthorityLocalDatabaseCapability();
  const namespace = {
    userId: accountId, projectRef: HEALTH_ROUTINE_PROJECT_REF,
    deviceId, generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: LOCAL_SCHEMA_VERSION,
  };
  let repository = await openLocalDatabase(namespace, { capability });
  try {
    try {
      await repository.initializeNamespace();
    } catch (error) {
      if (!(error instanceof LocalDatabaseError) || error.code !== 'STALE_GENERATION') throw error;
    }
    const metadata = await repository.readDatabaseMetadata();
    if (metadata.activeGenerationId !== repository.namespace.generationId) {
      closeLocalDatabase(repository);
      repository = await openLocalDatabase({ ...namespace, generationId: metadata.activeGenerationId }, { capability });
    }
    const active = await repository.getActiveGeneration();
    if (active.generationId !== repository.namespace.generationId) {
      throw new LocalDatabaseError('STALE_GENERATION', 'workout_authority_bootstrap');
    }
    return repository;
  } catch (error) {
    closeLocalDatabase(repository);
    throw error;
  }
}

export function createProductionWorkoutRuntimeAuthorityController() {
  return createWorkoutRuntimeAuthorityController({
    currentAccountId: runtimeAccountSyncAccountId,
    readOrCreateDeviceId: () => {
      if (typeof localStorage === 'undefined') return null;
      try { return readOrCreateDeviceId(localStorage); } catch { return null; }
    },
    currentDeviceId: () => {
      if (typeof localStorage === 'undefined') return null;
      try { return localStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY); } catch { return null; }
    },
    openRepository: openSharedActiveRepository,
    closeRepository: closeLocalDatabase,
    createClient: current => createAuthenticatedWorkoutRemoteControlClient(API_URL, current),
    online: () => typeof navigator !== 'undefined' && navigator.onLine,
  });
}
