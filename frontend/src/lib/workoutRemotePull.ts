import { API_URL } from './config';
import { HEALTH_ROUTINE_DEVICE_ID_KEY } from './healthRoutineSync';
import type { LocalDatabaseRepository, WorkoutPullFence } from './localDatabase/repository';
import type { WorkoutRemoteAuthorityRecordV1 } from './localDatabase/types';
import { runtimeAccountSyncAccountId } from './remoteBoundary';
import { supabase } from './supabase';
import { WORKOUT_REMOTE_DOMAIN } from './workoutRemoteContract';
import {
  WorkoutPullProtocolError, WORKOUT_PULL_LEASE, WORKOUT_PULL_PAGE_LIMIT, WORKOUT_PULL_PROVIDER,
  WORKOUT_SNAPSHOT_PAGE_LIMIT, validateWorkoutPullPage, validateWorkoutSnapshotPage,
  validateWorkoutSnapshotStart,
} from './workoutRemotePullProtocol';

type Session = { accountId: string; accessToken: string };

export interface WorkoutPullOptions {
  baseUrl: string;
  getSession: () => Promise<Session | null>;
  currentAccountId: () => string | null;
  currentDeviceId: () => string | null;
  fetchImpl?: typeof fetch;
  now?: () => string;
  workerId?: string;
  leaseDurationMs?: number;
  onDiagnostic?: (event: string, code?: string) => void;
  /** Test-only rollback of the canonical transaction. */
  testOnlyAbortBeforeCheckpoint?: boolean;
}

export type WorkoutPullResult =
  | { kind: 'applied'; nextCursor: number; applied: number; conflicts: number; ownEchoes: number }
  | { kind: 'empty'; nextCursor: number }
  | { kind: 'full_resync_required'; code: 'CURSOR_INVALID' | 'SERVER_EPOCH_MISMATCH' };

export type WorkoutFullResyncResult =
  | { kind: 'staged'; itemCount: number; watermark: number }
  | { kind: 'committed'; itemCount: number; watermark: number; applied: number; conflicts: number }
  | { kind: 'abandoned'; code: 'SNAPSHOT_TOKEN_INVALID' };

function query(authority: WorkoutRemoteAuthorityRecordV1): URLSearchParams {
  return new URLSearchParams({ namespaceKey: authority.namespaceKey, generationId: authority.generationId,
    deviceId: authority.deviceId, bindingId: authority.generationBindingId,
    authorityEpoch: String(authority.authorityEpoch) });
}

async function withWorkoutPullLease<T>(repository: LocalDatabaseRepository, options: WorkoutPullOptions,
  work: (fence: WorkoutPullFence, request: (path: string, init?: RequestInit) => Promise<unknown>) => Promise<T>): Promise<T> {
  const accountId = repository.namespace.userId.toLowerCase();
  const timestamp = options.now ?? (() => new Date().toISOString());
  const workerId = options.workerId ?? `workout-pull-${crypto.randomUUID()}`;
  const durationMs = options.leaseDurationMs ?? 30_000;
  if (!Number.isSafeInteger(durationMs) || durationMs < 1 || durationMs > 86_400_000) {
    throw new WorkoutPullProtocolError('INVALID_WORKER_OPTIONS');
  }
  const assertIdentity = () => {
    if (options.currentAccountId()?.toLowerCase() !== accountId
      || options.currentDeviceId() !== repository.namespace.deviceId) {
      options.onDiagnostic?.('workout_pull_identity_changed');
      throw new WorkoutPullProtocolError('IDENTITY_CHANGED');
    }
  };
  assertIdentity();
  const lease = await repository.acquireWorkerLease({ leaseName: WORKOUT_PULL_LEASE, ownerId: workerId,
    now: timestamp(), durationMs });
  try {
    const authority = await repository.getWorkoutRemoteAuthority();
    if (!authority) throw new WorkoutPullProtocolError('AUTHORITY_REQUIRED');
    assertIdentity();
    const fence = (): WorkoutPullFence => ({ lease, authority, currentAccountId: options.currentAccountId,
      currentDeviceId: options.currentDeviceId, now: timestamp(),
      testOnlyAbortBeforeCheckpoint: options.testOnlyAbortBeforeCheckpoint });
    const request = async (path: string, init?: RequestInit): Promise<unknown> => {
      assertIdentity();
      const session = await options.getSession();
      if (!session?.accessToken || session.accountId.toLowerCase() !== accountId) {
        throw new WorkoutPullProtocolError('AUTH_REQUIRED');
      }
      let response: Response;
      try {
        response = await (options.fetchImpl ?? fetch)(`${options.baseUrl.replace(/\/$/, '')}${path}`, {
          ...init, headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}` },
        });
      } catch { throw new WorkoutPullProtocolError('NETWORK_RETRYABLE'); }
      assertIdentity();
      const nextSession = await options.getSession();
      if (!nextSession?.accessToken || nextSession.accountId.toLowerCase() !== accountId) {
        throw new WorkoutPullProtocolError('AUTH_REQUIRED');
      }
      assertIdentity();
      if (response.status === 401 || response.status === 403) throw new WorkoutPullProtocolError('AUTH_REQUIRED');
      if (response.status >= 500 || response.status === 429) throw new WorkoutPullProtocolError('NETWORK_RETRYABLE');
      const value = await response.json().catch(() => null) as Record<string, unknown> | null;
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
      }
      if (response.status === 423 && value.detail === 'WORKOUT_REMOTE_FOUNDATION_DISABLED') {
        throw new WorkoutPullProtocolError('FEATURE_DISABLED');
      }
      if (value.status === 'rejected' || value.status === 'full_resync_required'
        && value.errorCode === 'SNAPSHOT_TOKEN_INVALID') {
        if (typeof value.errorCode !== 'string') throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
        throw new WorkoutPullProtocolError(value.errorCode);
      }
      if (!response.ok && value.status !== 'full_resync_required') {
        throw new WorkoutPullProtocolError('MALFORMED_RESPONSE');
      }
      return value;
    };
    return await work(fence(), request);
  } catch (error) {
    if (error instanceof WorkoutPullProtocolError && error.code === 'MALFORMED_RESPONSE') {
      options.onDiagnostic?.('workout_pull_malformed_response');
    }
    throw error;
  } finally {
    // A takeover may have replaced this token; never release another worker's lease.
    await repository.releaseWorkerLease({ leaseName: WORKOUT_PULL_LEASE, ownerId: workerId,
      leaseToken: lease.leaseToken, now: timestamp() }).catch(() => undefined);
  }
}

/** One explicit account-wide page. No product hook, timer, or push acknowledgement. */
export async function runWorkoutPullIteration(repository: LocalDatabaseRepository,
  options: WorkoutPullOptions): Promise<WorkoutPullResult> {
  return withWorkoutPullLease(repository, options, async (fence, request) => {
    const checkpoint = await repository.getSyncCheckpoint(WORKOUT_PULL_PROVIDER, WORKOUT_REMOTE_DOMAIN);
    const cursor = checkpoint?.sequence ?? 0;
    const serverEpoch = checkpoint?.serverEpoch ?? null;
    const params = query(fence.authority);
    params.set('cursor', String(cursor)); params.set('limit', String(WORKOUT_PULL_PAGE_LIMIT));
    if (serverEpoch !== null) params.set('serverEpoch', serverEpoch);
    const page = validateWorkoutPullPage(await request(`/api/sync/v2/workouts/changes?${params}`),
      cursor, fence.authority.authorityEpoch, serverEpoch);
    if (page.kind === 'full_resync_required') {
      options.onDiagnostic?.('workout_pull_full_resync_required', page.errorCode);
      return { kind: 'full_resync_required', code: page.errorCode };
    }
    const result = await repository.commitWorkoutPullPage({ ...fence, now: (options.now ?? (() => new Date().toISOString()))(),
      expectedCursor: cursor, expectedServerEpoch: serverEpoch, nextCursor: page.nextCursor,
      serverEpoch: page.serverEpoch, changes: page.changes });
    if (page.changes.length === 0) {
      options.onDiagnostic?.('workout_pull_empty');
      return { kind: 'empty', nextCursor: page.nextCursor };
    }
    options.onDiagnostic?.('workout_pull_page_applied');
    if (result.conflicts > 0) options.onDiagnostic?.('workout_pull_conflict');
    if (result.ownEchoes > 0) options.onDiagnostic?.('workout_pull_own_echo');
    return { kind: 'applied', nextCursor: page.nextCursor,
      applied: result.applied, conflicts: result.conflicts, ownEchoes: result.ownEchoes };
  });
}

/** One explicit snapshot page per call. Ready staging is committed atomically on resume. */
export async function runWorkoutFullResync(repository: LocalDatabaseRepository,
  options: WorkoutPullOptions): Promise<WorkoutFullResyncResult> {
  return withWorkoutPullLease(repository, options, async (fence, request) => {
    let session = await repository.getWorkoutFullResyncSession();
    if (session && (session.authorityEpoch !== fence.authority.authorityEpoch
      || session.generationBindingId !== fence.authority.generationBindingId)) {
      throw new WorkoutPullProtocolError('STALE_GENERATION_BINDING');
    }
    if (!session) {
      const value = await request('/api/sync/v2/workouts/snapshots', {
        method: 'POST', body: JSON.stringify({ protocolVersion: 2, ...Object.fromEntries(query(fence.authority)) ,
          authorityEpoch: fence.authority.authorityEpoch }),
      });
      const start = validateWorkoutSnapshotStart(value, fence.authority.authorityEpoch);
      session = await repository.startWorkoutFullResync({ ...fence,
        now: (options.now ?? (() => new Date().toISOString()))(),
        snapshotToken: start.snapshotToken, serverEpoch: start.serverEpoch, watermark: start.watermark });
      options.onDiagnostic?.('workout_full_resync_started');
    }
    if (session.status === 'ready') {
      const result = await repository.commitWorkoutFullResync({ ...fence,
        now: (options.now ?? (() => new Date().toISOString()))(), sessionId: session.sessionId });
      options.onDiagnostic?.('workout_full_resync_committed');
      return { kind: 'committed', itemCount: session.itemCount, watermark: session.watermark,
        applied: result.applied, conflicts: result.conflicts };
    }
    const params = query(fence.authority);
    params.set('limit', String(WORKOUT_SNAPSHOT_PAGE_LIMIT));
    if (session.afterEntityId !== null) params.set('afterEntityId', session.afterEntityId);
    let value: unknown;
    try { value = await request(`/api/sync/v2/workouts/snapshots/${session.snapshotToken}?${params}`); }
    catch (error) {
      if (error instanceof WorkoutPullProtocolError && error.code === 'SNAPSHOT_TOKEN_INVALID') {
        await repository.abandonWorkoutFullResync({ ...fence,
          now: (options.now ?? (() => new Date().toISOString()))(), sessionId: session.sessionId });
        options.onDiagnostic?.('workout_full_resync_abandoned', error.code);
        return { kind: 'abandoned', code: 'SNAPSHOT_TOKEN_INVALID' };
      }
      throw error;
    }
    const page = validateWorkoutSnapshotPage(value, {
      snapshotToken: session.snapshotToken, authorityEpoch: session.authorityEpoch,
      serverEpoch: session.serverEpoch, watermark: session.watermark,
    }, session.afterEntityId);
    const staged = await repository.stageWorkoutFullResyncPage({ ...fence,
      now: (options.now ?? (() => new Date().toISOString()))(), sessionId: session.sessionId,
      afterEntityId: session.afterEntityId, ...page });
    options.onDiagnostic?.('workout_full_resync_page_staged');
    if (staged.status === 'ready') {
      const result = await repository.commitWorkoutFullResync({ ...fence,
        now: (options.now ?? (() => new Date().toISOString()))(), sessionId: staged.sessionId });
      options.onDiagnostic?.('workout_full_resync_committed');
      return { kind: 'committed', itemCount: staged.itemCount, watermark: staged.watermark,
        applied: result.applied, conflicts: result.conflicts };
    }
    return { kind: 'staged', itemCount: staged.itemCount, watermark: staged.watermark };
  });
}

export function authenticatedWorkoutPullOptions(): WorkoutPullOptions {
  return {
    baseUrl: API_URL,
    getSession: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ? { accountId: session.user.id, accessToken: session.access_token } : null;
    },
    currentAccountId: runtimeAccountSyncAccountId,
    currentDeviceId: () => typeof localStorage === 'undefined'
      ? null : localStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY),
  };
}
