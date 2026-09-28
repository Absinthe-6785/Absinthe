import type { LocalDatabaseRepository } from './localDatabase/repository';
import type { WorkoutRemoteResetIntentV1 } from './localDatabase/types';
import { workoutResetRequestDigest, WORKOUT_DIGEST, WORKOUT_WIRE_UUID_V4 } from './workoutRemoteContract';

export class WorkoutRemoteResetError extends Error {
  constructor(readonly code: string) { super(`workout_remote_reset:${code}`); }
}

export interface WorkoutRemoteResetOptions {
  baseUrl: string;
  getSession: () => Promise<{ accountId: string; accessToken: string } | null>;
  currentAccountId: () => string | null;
  currentDeviceId: () => string | null;
  fetchImpl?: typeof fetch;
  onDiagnostic?: (event: string, code?: string) => void;
}

type ResetResponse = {
  protocolVersion: 2;
  projectScope: string;
  status: 'applying' | 'completed';
  resetId: string;
  sourceEpoch: number;
  targetEpoch: number;
  inventoryCount: number;
  activeCount: number;
  appliedCount: number;
  inventoryDigest: string;
  completionDigest: string | null;
  errorCode: null;
};

function parseResponse(value: unknown, intent: WorkoutRemoteResetIntentV1): ResetResponse {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new WorkoutRemoteResetError('MALFORMED_RESPONSE');
  }
  const data = value as Record<string, unknown>;
  if (data.protocolVersion !== 2 || data.status !== 'applying' && data.status !== 'completed'
    || data.projectScope !== intent.projectScope
    || data.resetId !== intent.resetId || data.sourceEpoch !== intent.sourceEpoch
    || data.targetEpoch !== intent.sourceEpoch + 1
    || !Number.isSafeInteger(data.inventoryCount) || (data.inventoryCount as number) < 0
    || !Number.isSafeInteger(data.activeCount) || (data.activeCount as number) < 0
    || (data.activeCount as number) > (data.inventoryCount as number)
    || !Number.isSafeInteger(data.appliedCount) || (data.appliedCount as number) < 0
    || (data.appliedCount as number) > (data.activeCount as number)
    || typeof data.inventoryDigest !== 'string' || !WORKOUT_DIGEST.test(data.inventoryDigest)
    || data.completionDigest !== null && (typeof data.completionDigest !== 'string'
      || !WORKOUT_DIGEST.test(data.completionDigest))
    || data.status === 'completed' && (data.completionDigest === null
      || data.appliedCount !== data.activeCount)
    || data.status === 'applying' && data.completionDigest !== null
    || data.errorCode !== null) throw new WorkoutRemoteResetError('MALFORMED_RESPONSE');
  return data as ResetResponse;
}

/** Dormant G4C primitive. One call starts/replays and applies at most one 25-row server batch. */
export function createWorkoutRemoteResetClient(options: WorkoutRemoteResetOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  async function session(accountId: string, deviceId: string) {
    const current = await options.getSession();
    if (!current?.accessToken || current.accountId.toLowerCase() !== accountId
      || options.currentAccountId()?.toLowerCase() !== accountId
      || options.currentDeviceId() !== deviceId) throw new WorkoutRemoteResetError('IDENTITY_CHANGED');
    return current;
  }
  async function request(path: string, intent: WorkoutRemoteResetIntentV1): Promise<ResetResponse> {
    const current = await session(intent.accountId, intent.deviceId);
    const wire = {
      protocolVersion: 2, namespaceKey: intent.namespaceKey,
      generationId: intent.generationId, deviceId: intent.deviceId,
      bindingId: intent.generationBindingId, authorityEpoch: intent.sourceEpoch,
      resetId: intent.resetId, requestDigest: intent.requestDigest,
    };
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${current.accessToken}` },
        body: JSON.stringify(wire),
      });
    } catch { throw new WorkoutRemoteResetError('NETWORK_RETRYABLE'); }
    if (response.status === 401 || response.status === 403) throw new WorkoutRemoteResetError('AUTH_REQUIRED');
    if (response.status >= 500) throw new WorkoutRemoteResetError('NETWORK_RETRYABLE');
    const value = await response.json().catch(() => null) as Record<string, unknown> | null;
    if (!response.ok) {
      const code = typeof value?.errorCode === 'string' ? value.errorCode :
        typeof value?.detail === 'string' ? value.detail : 'MALFORMED_RESPONSE';
      options.onDiagnostic?.('workout_reset_rejected', code);
      throw new WorkoutRemoteResetError(code);
    }
    await session(intent.accountId, intent.deviceId);
    return parseResponse(value, intent);
  }
  return {
    async runStep(repository: LocalDatabaseRepository): Promise<WorkoutRemoteResetIntentV1> {
      const { namespace, namespaceKey } = repository;
      const accountId = namespace.userId.toLowerCase();
      await session(accountId, namespace.deviceId);
      let intent = await repository.getWorkoutRemoteResetIntent();
      if (intent?.status === 'completed') return intent;
      if (!intent) {
        const authority = await repository.getWorkoutRemoteAuthority();
        if (!authority || authority.accountId !== accountId || authority.deviceId !== namespace.deviceId) {
          throw new WorkoutRemoteResetError('AUTHORITY_EVIDENCE_MISSING');
        }
        const resetId = crypto.randomUUID().toLowerCase();
        if (!WORKOUT_WIRE_UUID_V4.test(resetId)) throw new WorkoutRemoteResetError('INVALID_RESET_ID');
        const requestDigest = workoutResetRequestDigest({
          authenticatedOwnerId: accountId, projectScope: authority.projectScope,
          namespaceKey, generationId: namespace.generationId, deviceId: namespace.deviceId,
          generationBindingId: authority.generationBindingId,
          authorityEpoch: authority.authorityEpoch, resetId,
        });
        const now = new Date().toISOString();
        intent = await repository.reserveWorkoutRemoteResetIntent({
          accountId, namespaceKey, generationId: namespace.generationId,
          domain: 'health_workout_session.reset', deviceId: namespace.deviceId,
          projectScope: authority.projectScope, generationBindingId: authority.generationBindingId,
          sourceEpoch: authority.authorityEpoch, resetId, requestDigest,
          status: 'prepared', targetEpoch: null, inventoryCount: null, activeCount: null,
          appliedCount: 0, inventoryDigest: null, completionDigest: null,
          createdAt: now, updatedAt: now,
        }, options.currentAccountId, options.currentDeviceId);
        options.onDiagnostic?.('workout_reset_intent_durable');
      }
      const started = await request('/api/sync/v2/workouts/resets', intent);
      intent = await repository.recordWorkoutRemoteResetProgress(started,
        options.currentAccountId, options.currentDeviceId, new Date().toISOString());
      if (intent.status === 'completed') {
        options.onDiagnostic?.('workout_reset_completed');
        return intent;
      }
      const progressed = await request(`/api/sync/v2/workouts/resets/${intent.resetId}/continue`, intent);
      const recorded = await repository.recordWorkoutRemoteResetProgress(progressed,
        options.currentAccountId, options.currentDeviceId, new Date().toISOString());
      options.onDiagnostic?.(recorded.status === 'completed'
        ? 'workout_reset_completed' : 'workout_reset_batch_applied');
      return recorded;
    },
  };
}
