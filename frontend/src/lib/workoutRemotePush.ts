import { API_URL } from './config';
import { HEALTH_ROUTINE_DEVICE_ID_KEY } from './healthRoutineSync';
import { hashCanonicalPayload } from './localDatabase/canonicalPayload';
import type { LocalDatabaseRepository, WorkoutPushClaimFence, WorkoutPushSettlement } from './localDatabase/repository';
import type { OutboxRecord } from './localDatabase/types';
import { validTimestamp, validateOutboxRecord } from './localDatabase/validation';
import { runtimeAccountSyncAccountId } from './remoteBoundary';
import { supabase } from './supabase';
import { validateWorkoutSessionV1 } from './workoutSessionV1';
import {
  canonicalWorkoutUuid, WORKOUT_DIGEST, WORKOUT_REMOTE_DOMAIN, WORKOUT_WIRE_UUID,
} from './workoutRemoteContract';

type Session = { accountId: string; accessToken: string };
type MutationRequest = {
  protocolVersion: 2;
  namespaceKey: string; generationId: string; deviceId: string;
  bindingId: string; authorityEpoch: number; domain: typeof WORKOUT_REMOTE_DOMAIN;
  entityId: string; mutationId: string; idempotencyKey: string;
  operation: OutboxRecord['operation']; remoteCasBaseRevision: number | null;
  localRevision: number; payload: OutboxRecord['payload']; payloadHash: string; requestDigest: string;
};

export interface WorkoutPushOptions {
  baseUrl: string;
  getSession: () => Promise<Session | null>;
  currentAccountId: () => string | null;
  currentDeviceId: () => string | null;
  fetchImpl?: typeof fetch;
  now?: () => string;
  limit?: number;
  leaseDurationMs?: number;
  retryBaseDelayMs?: number;
  retryMaxDelayMs?: number;
  workerId?: string;
  onDiagnostic?: (event: string, code?: string) => void;
}

export interface WorkoutPushIterationResult {
  claimed: number; success: number; exactReplay: number; retryable: number;
  conflict: number; permanent: number; idempotent: number; blocked: number;
}

function requestFromBoundRow(row: OutboxRecord): MutationRequest {
  validateOutboxRecord(row);
  const binding = row.deliveryBinding;
  if (row.domain !== WORKOUT_REMOTE_DOMAIN || binding?.state !== 'bound'
    || row.deliveryBlockCode != null || row.payloadHash === null
    || row.accountId == null || row.deviceId == null
    || binding.boundPayloadHash !== row.payloadHash
    || hashCanonicalPayload(row.payload) !== row.payloadHash
    || binding.wireEntityId !== canonicalWorkoutUuid(row.entityId)) {
    throw new Error('WORKOUT_BOUND_REQUEST_INVALID');
  }
  if (row.payload.kind === 'entity_snapshot') {
    validateWorkoutSessionV1(row.payload.record);
    if (canonicalWorkoutUuid(row.payload.record.id) !== binding.wireEntityId) {
      throw new Error('WORKOUT_BOUND_REQUEST_INVALID');
    }
  } else if (canonicalWorkoutUuid(row.payload.entityId) !== binding.wireEntityId) {
    throw new Error('WORKOUT_BOUND_REQUEST_INVALID');
  }
  return {
    protocolVersion: 2, namespaceKey: row.namespaceKey, generationId: row.generationId,
    deviceId: row.deviceId, bindingId: binding.generationBindingId,
    authorityEpoch: binding.authorityEpoch, domain: WORKOUT_REMOTE_DOMAIN,
    entityId: binding.wireEntityId, mutationId: row.mutationId,
    idempotencyKey: row.idempotencyKey, operation: row.operation,
    remoteCasBaseRevision: binding.remoteCasBaseRevision, localRevision: row.localRevision,
    payload: row.payload, payloadHash: row.payloadHash, requestDigest: binding.requestDigest,
  };
}

function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}

function serverTimestamp(value: unknown): value is string {
  return validTimestamp(value) && /T.+(?:Z|[+-]\d{2}:\d{2})$/.test(value);
}

function validatedSuccess(value: Record<string, unknown>, request: MutationRequest):
  { kind: 'success'; outcome: 'success' | 'exact_replay'; serverRevision: number;
    remoteMutationRef: string; serverCommittedAt: string } | null {
  if (value.protocolVersion !== 2 || value.outcome !== 'success' && value.outcome !== 'exact_replay'
    || value.errorCode !== null || value.domain !== request.domain || value.entityId !== request.entityId
    || value.mutationId !== request.mutationId || value.idempotencyKey !== request.idempotencyKey
    || value.operation !== request.operation || value.payloadHash !== request.payloadHash
    || value.authorityEpoch !== request.authorityEpoch || value.bindingId !== request.bindingId
    || typeof value.remoteMutationRef !== 'string' || !WORKOUT_WIRE_UUID.test(value.remoteMutationRef)
    || !Number.isSafeInteger(value.serverRevision) || (value.serverRevision as number) < 1
    || value.serverRevision !== (request.remoteCasBaseRevision ?? 0) + 1
    || !Number.isSafeInteger(value.changeSequence) || (value.changeSequence as number) < 1
    || !serverTimestamp(value.serverCommittedAt)) return null;
  const expectedContentHash = request.payload.kind === 'entity_snapshot'
    ? hashCanonicalPayload(request.payload.record) : null;
  if (expectedContentHash === null
    ? typeof value.contentHash !== 'string' || !WORKOUT_DIGEST.test(value.contentHash)
    : value.contentHash !== expectedContentHash) return null;
  return { kind: 'success', outcome: value.outcome,
    serverRevision: value.serverRevision as number,
    remoteMutationRef: value.remoteMutationRef, serverCommittedAt: value.serverCommittedAt };
}

function boundedConflictEvidence(value: Record<string, unknown>): Readonly<Record<string, unknown>> {
  const revision = value.currentServerRevision;
  const contentHash = value.currentContentHash;
  const isDeleted = value.currentIsDeleted;
  const remoteRef = value.currentRemoteMutationRef;
  return {
    currentServerRevision: Number.isSafeInteger(revision) && (revision as number) > 0 ? revision : null,
    currentContentHash: typeof contentHash === 'string' && WORKOUT_DIGEST.test(contentHash) ? contentHash : null,
    currentIsDeleted: typeof isDeleted === 'boolean' ? isDeleted : null,
    currentRemoteMutationRef: typeof remoteRef === 'string' && WORKOUT_WIRE_UUID.test(remoteRef) ? remoteRef : null,
  };
}

function classifyResponse(status: number, value: Record<string, unknown> | null,
  request: MutationRequest, retryBaseDelayMs: number, retryMaxDelayMs: number):
  { settlement: WorkoutPushSettlement; outcome?: 'success' | 'exact_replay' } {
  const retry = (errorCode: string): { settlement: WorkoutPushSettlement } => ({
    settlement: { kind: 'retry', errorCode, baseDelayMs: retryBaseDelayMs, maxDelayMs: retryMaxDelayMs },
  });
  if (status === 401 || status === 403) return retry('AUTH_REQUIRED');
  if (status >= 500 || status === 429) return retry('NETWORK_RETRYABLE');
  if (status === 200 && value && (value.outcome === 'success' || value.outcome === 'exact_replay')) {
    const result = validatedSuccess(value, request);
    return result ? { settlement: result, outcome: result.outcome } : retry('MALFORMED_RESPONSE');
  }
  if (status === 423 && value?.detail === 'WORKOUT_REMOTE_FOUNDATION_DISABLED') {
    return { settlement: { kind: 'permanent', errorCode: 'FEATURE_DISABLED' } };
  }
  if (status === 400 && value?.detail === 'INVALID_PAYLOAD') {
    return { settlement: { kind: 'permanent', errorCode: 'INVALID_PAYLOAD' } };
  }
  if (!value || value.outcome !== 'rejected' || typeof value.errorCode !== 'string') {
    return retry('MALFORMED_RESPONSE');
  }
  const code = value.errorCode;
  if (['CAS_CONFLICT', 'ENTITY_ALREADY_EXISTS', 'ENTITY_NOT_TOMBSTONED',
    'ENTITY_TOMBSTONED', 'NOT_FOUND'].includes(code)) {
    return { settlement: { kind: 'conflict', errorCode: code, remoteEvidence: boundedConflictEvidence(value) } };
  }
  if (['STALE_AUTHORITY_EPOCH', 'STALE_GENERATION_BINDING', 'AUTHORITY_EVIDENCE_MISSING',
    'MUTATION_ID_CONFLICT', 'IDEMPOTENCY_CONFLICT', 'REQUEST_DIGEST_MISMATCH',
    'CAPABILITY_DISABLED', 'AUTHORITY_RESET_FENCED'].includes(code)) {
    return { settlement: { kind: 'permanent', errorCode: code } };
  }
  // An unknown deterministic rejection is blocked, never acknowledged or hot-looped.
  return { settlement: { kind: 'permanent', errorCode: 'UNKNOWN_SERVER_REJECTION' } };
}

/** Explicit one-shot dormant driver. No product boot hook, timer, pull, or checkpoint writes. */
export async function runWorkoutPushIteration(repository: LocalDatabaseRepository,
  options: WorkoutPushOptions): Promise<WorkoutPushIterationResult> {
  const now = options.now ?? (() => new Date().toISOString());
  const limit = options.limit ?? 10;
  const leaseDurationMs = options.leaseDurationMs ?? 30_000;
  const retryBaseDelayMs = options.retryBaseDelayMs ?? 1_000;
  const retryMaxDelayMs = options.retryMaxDelayMs ?? 60_000;
  const workerId = options.workerId ?? `workout-push-${crypto.randomUUID()}`;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100
    || !Number.isSafeInteger(leaseDurationMs) || leaseDurationMs < 1 || leaseDurationMs > 86_400_000
    || !Number.isSafeInteger(retryBaseDelayMs) || retryBaseDelayMs < 1
    || !Number.isSafeInteger(retryMaxDelayMs) || retryMaxDelayMs < retryBaseDelayMs) {
    throw new Error('WORKOUT_PUSH_OPTIONS_INVALID');
  }
  const result: WorkoutPushIterationResult = {
    claimed: 0, success: 0, exactReplay: 0, retryable: 0,
    conflict: 0, permanent: 0, idempotent: 0, blocked: 0,
  };
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const currentSession = async (): Promise<Session | null> => {
    try { return await options.getSession(); } catch { return null; }
  };
  // Claim one immediately before each send. A slow request cannot consume the
  // lease lifetime of later rows in this bounded sequential iteration.
  for (let index = 0; index < limit; index += 1) {
    const [claimed] = await repository.claimNextBoundWorkoutMutations({
      workerId, now: now(), leaseDurationMs, limit: 1, recoverExpiredClaims: true,
      currentAccountId: options.currentAccountId, currentDeviceId: options.currentDeviceId,
    });
    if (!claimed) break;
    result.claimed += 1;
    options.onDiagnostic?.('workout_push_claimed');
    const fence: WorkoutPushClaimFence = { claimed, workerId,
      currentAccountId: options.currentAccountId, currentDeviceId: options.currentDeviceId };
    try {
      const current = await repository.readClaimedBoundWorkoutMutation(fence, now());
      const request = requestFromBoundRow(current);
      const session = await currentSession();
      const owner = repository.namespace.userId.toLowerCase();
      let classified: ReturnType<typeof classifyResponse>;
      if (!session?.accessToken || session.accountId.toLowerCase() !== owner
        || options.currentAccountId()?.toLowerCase() !== owner
        || options.currentDeviceId() !== repository.namespace.deviceId) {
        classified = { settlement: { kind: 'retry', errorCode: 'AUTH_REQUIRED',
          baseDelayMs: retryBaseDelayMs, maxDelayMs: retryMaxDelayMs } };
      } else {
        // The await above may have allowed another tab to reclaim this lease.
        await repository.readClaimedBoundWorkoutMutation(fence, now());
        if (options.currentAccountId()?.toLowerCase() !== owner
          || options.currentDeviceId() !== repository.namespace.deviceId) {
          throw new Error('WORKOUT_PUSH_IDENTITY_CHANGED');
        }
        let response: Response | null = null;
        try {
          response = await (options.fetchImpl ?? fetch)(`${baseUrl}/api/sync/v2/workouts/mutations`, {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessToken}` },
            body: JSON.stringify(request),
          });
        } catch { /* uncertain commit: replay the exact bound request later */ }
        if (response === null) {
          classified = { settlement: { kind: 'retry', errorCode: 'NETWORK_RETRYABLE',
            baseDelayMs: retryBaseDelayMs, maxDelayMs: retryMaxDelayMs } };
        } else {
          let value: Record<string, unknown> | null = null;
          try { value = object(await response.json()); } catch { /* malformed/uncertain response */ }
          classified = classifyResponse(response.status, value, request, retryBaseDelayMs, retryMaxDelayMs);
        }
      }
      // A switched owner cannot settle the previous owner's namespace either.
      const settledSession = await currentSession();
      if (options.currentAccountId()?.toLowerCase() !== owner
        || options.currentDeviceId() !== repository.namespace.deviceId
        || settledSession && settledSession.accountId.toLowerCase() !== owner
        || classified.settlement.kind !== 'retry' && !settledSession) {
        result.blocked += 1;
        options.onDiagnostic?.('workout_push_auth_fence');
        break;
      }
      const settled = await repository.settleBoundWorkoutMutation({
        ...fence, now: now(), settlement: classified.settlement,
      });
      if (settled.idempotent) {
        result.idempotent += 1;
        options.onDiagnostic?.('workout_push_settlement_idempotent');
      } else if (classified.outcome === 'exact_replay') {
        result.exactReplay += 1;
        options.onDiagnostic?.('workout_push_exact_replay');
      } else if (classified.outcome === 'success') {
        result.success += 1;
        options.onDiagnostic?.('workout_push_success');
      } else if (classified.settlement.kind === 'retry') {
        result.retryable += 1;
        options.onDiagnostic?.(classified.settlement.errorCode === 'MALFORMED_RESPONSE'
          ? 'workout_push_malformed_response' : 'workout_push_retryable', classified.settlement.errorCode);
      } else if (classified.settlement.kind === 'conflict') {
        result.conflict += 1;
        options.onDiagnostic?.('workout_push_conflict', classified.settlement.errorCode);
      } else if (classified.settlement.kind === 'permanent') {
        result.permanent += 1;
        const event = classified.settlement.errorCode === 'STALE_AUTHORITY_EPOCH'
          ? 'workout_push_stale_authority' : classified.settlement.errorCode === 'STALE_GENERATION_BINDING'
            ? 'workout_push_stale_binding' : 'workout_push_permanent_rejection';
        options.onDiagnostic?.(event, classified.settlement.errorCode);
      } else {
        result.blocked += 1;
        options.onDiagnostic?.('workout_push_fail_closed');
      }
    } catch {
      // A lost lease, changed generation, or corrupt row is never force-settled.
      result.blocked += 1;
      options.onDiagnostic?.('workout_push_fail_closed');
    }
    if (options.currentAccountId()?.toLowerCase() !== repository.namespace.userId.toLowerCase()
      || options.currentDeviceId() !== repository.namespace.deviceId) break;
  }
  return result;
}

/** Authenticated production adapter remains dormant until an explicit internal caller invokes it. */
export function authenticatedWorkoutPushOptions(): WorkoutPushOptions {
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
