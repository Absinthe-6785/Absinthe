import { createK323V2HttpClient } from './localDatabase/k323V2Transport';
import { runtimeAccountSyncAccountId } from './remoteBoundary';
import { supabase } from './supabase';
import { HEALTH_ROUTINE_DEVICE_ID_KEY } from './healthRoutineSync';
import type { LocalDatabaseRepository } from './localDatabase/repository';
import type { WorkoutRemoteAuthorityRecordV1 } from './localDatabase/types';
import { WORKOUT_REMOTE_DOMAIN, WORKOUT_SAFE_SCOPE, WORKOUT_WIRE_UUID } from './workoutRemoteContract';

export type WorkoutRemoteDiscoveryCode =
  | 'AUTH_REQUIRED' | 'FEATURE_DISABLED' | 'CAPABILITY_DISABLED' | 'AUTHORITY_RESET_FENCED'
  | 'STALE_GENERATION_BINDING' | 'NETWORK_RETRYABLE' | 'MALFORMED_RESPONSE'
  | 'PROJECT_SCOPE_MISMATCH' | 'IDENTITY_CHANGED' | 'SHARED_GENERATION_UNPROVEN';

export class WorkoutRemoteDiscoveryError extends Error {
  constructor(readonly code: WorkoutRemoteDiscoveryCode) {
    super(`workout_remote_discovery:${code}`);
  }
}

type Session = { accountId: string; accessToken: string };
type AuthorityResponse = {
  protocolVersion: 2; domain: typeof WORKOUT_REMOTE_DOMAIN; projectScope: string;
  capability: 'FOUNDATION_READY'; authorityState: 'OPEN'; authorityEpoch: number;
  bindingState: 'bound' | 'registration_required'; bindingId: string | null;
  serverEpoch: string | null; errorCode: null;
};
type GenerationResponse = {
  protocolVersion: 2; status: 'bound'; domain: typeof WORKOUT_REMOTE_DOMAIN;
  namespaceKey: string; generationId: string; deviceId: string; projectScope: string;
  bindingId: string; authorityEpoch: number; serverEpoch: string; errorCode: null;
};

export interface WorkoutRemoteControlOptions {
  baseUrl: string;
  /** Production supplies Supabase's current authenticated session; tests may inject a controlled session. */
  getSession: () => Promise<Session | null>;
  /** Synchronous app-shell auth snapshot, checked within the IDB transaction. */
  currentAccountId: () => string | null;
  /** Must read the currently selected durable device identity, never user agent data. */
  currentDeviceId: () => string | null;
  fetchImpl?: typeof fetch;
  onDiagnostic?: (event: string, code?: string) => void;
}

function record(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new WorkoutRemoteDiscoveryError('MALFORMED_RESPONSE');
  return value as Record<string, unknown>;
}

function validEpoch(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0;
}

function validUuid(value: unknown): value is string {
  return typeof value === 'string' && WORKOUT_WIRE_UUID.test(value);
}

function classifyResponse(response: Response, value: Record<string, unknown>): void {
  if (response.status === 401 || response.status === 403) throw new WorkoutRemoteDiscoveryError('AUTH_REQUIRED');
  if (response.status === 423 && value.detail === 'WORKOUT_REMOTE_FOUNDATION_DISABLED') {
    throw new WorkoutRemoteDiscoveryError('FEATURE_DISABLED');
  }
  if (value.errorCode === 'CAPABILITY_DISABLED') throw new WorkoutRemoteDiscoveryError('CAPABILITY_DISABLED');
  if (value.errorCode === 'AUTHORITY_RESET_FENCED') throw new WorkoutRemoteDiscoveryError('AUTHORITY_RESET_FENCED');
  if (value.errorCode === 'STALE_GENERATION_BINDING') throw new WorkoutRemoteDiscoveryError('STALE_GENERATION_BINDING');
  if (response.status >= 500) throw new WorkoutRemoteDiscoveryError('NETWORK_RETRYABLE');
  if (!response.ok) throw new WorkoutRemoteDiscoveryError('MALFORMED_RESPONSE');
}

function authority(value: Record<string, unknown>): AuthorityResponse {
  if (value.protocolVersion !== 2 || value.domain !== WORKOUT_REMOTE_DOMAIN
    || typeof value.projectScope !== 'string' || !WORKOUT_SAFE_SCOPE.test(value.projectScope)
    || value.capability !== 'FOUNDATION_READY' || value.authorityState !== 'OPEN'
    || !validEpoch(value.authorityEpoch) || value.errorCode !== null
    || value.bindingState !== 'bound' && value.bindingState !== 'registration_required'
    || value.bindingState === 'bound' && (!validUuid(value.bindingId) || !validUuid(value.serverEpoch))
    || value.bindingState === 'registration_required' && value.bindingId !== null
    || value.serverEpoch !== null && !validUuid(value.serverEpoch)) {
    throw new WorkoutRemoteDiscoveryError('MALFORMED_RESPONSE');
  }
  return value as AuthorityResponse;
}

function generation(value: Record<string, unknown>, expected: {
  namespaceKey: string; generationId: string; deviceId: string; projectScope: string; authorityEpoch: number;
}): GenerationResponse {
  if (value.protocolVersion !== 2 || value.status !== 'bound' || value.domain !== WORKOUT_REMOTE_DOMAIN
    || value.namespaceKey !== expected.namespaceKey || value.generationId !== expected.generationId
    || value.deviceId !== expected.deviceId || value.errorCode !== null
    || !validUuid(value.bindingId) || !validUuid(value.serverEpoch) || !validEpoch(value.authorityEpoch)) {
    throw new WorkoutRemoteDiscoveryError('MALFORMED_RESPONSE');
  }
  if (value.projectScope !== expected.projectScope) throw new WorkoutRemoteDiscoveryError('PROJECT_SCOPE_MISMATCH');
  if (value.authorityEpoch !== expected.authorityEpoch) throw new WorkoutRemoteDiscoveryError('STALE_GENERATION_BINDING');
  return value as GenerationResponse;
}

/** Dormant G4B1 control-plane client. Never sends mutations or starts a worker. */
export function createWorkoutRemoteControlClient(options: WorkoutRemoteControlOptions) {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetchImpl = options.fetchImpl ?? fetch;
  async function session(expectedAccount: string): Promise<Session> {
    const result = await options.getSession();
    if (!result?.accessToken || result.accountId.toLowerCase() !== expectedAccount.toLowerCase()
      || options.currentAccountId()?.toLowerCase() !== expectedAccount.toLowerCase()) {
      throw new WorkoutRemoteDiscoveryError('AUTH_REQUIRED');
    }
    return result;
  }
  async function request(path: string, expectedAccount: string, init?: RequestInit): Promise<Record<string, unknown>> {
    const current = await session(expectedAccount);
    if (options.currentDeviceId() === null) throw new WorkoutRemoteDiscoveryError('IDENTITY_CHANGED');
    let response: Response;
    try {
      response = await fetchImpl(`${baseUrl}${path}`, {
        ...init,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${current.accessToken}` },
      });
    } catch {
      throw new WorkoutRemoteDiscoveryError('NETWORK_RETRYABLE');
    }
    if (response.status === 401 || response.status === 403) throw new WorkoutRemoteDiscoveryError('AUTH_REQUIRED');
    if (response.status >= 500) throw new WorkoutRemoteDiscoveryError('NETWORK_RETRYABLE');
    const value = record(await response.json().catch(() => null));
    classifyResponse(response, value);
    await session(expectedAccount);
    return value;
  }
  return {
    async discoverAndPersist(repository: LocalDatabaseRepository, testOnlyAbortBeforeCommit = false): Promise<WorkoutRemoteAuthorityRecordV1> {
      const { namespace, namespaceKey } = repository;
      const accountId = namespace.userId.toLowerCase();
      const discoveryStartedAt = new Date().toISOString();
      try {
        const discoverySequence = await repository.reserveWorkoutRemoteDiscovery();
        await session(accountId);
        if (options.currentDeviceId() !== namespace.deviceId) throw new WorkoutRemoteDiscoveryError('IDENTITY_CHANGED');
        const active = await repository.getActiveGeneration();
        if (active.generationId !== namespace.generationId || active.status !== 'active') {
          throw new WorkoutRemoteDiscoveryError('IDENTITY_CHANGED');
        }
        // Reuse the exact shared K-323 generation identity and registration primitive.
        const shared = createK323V2HttpClient({
          baseUrl,
          fetchImpl: (async (url, init) => {
            let response: Response;
            try { response = await fetchImpl(url, init); }
            catch { throw new WorkoutRemoteDiscoveryError('NETWORK_RETRYABLE'); }
            if (response.status === 401 || response.status === 403) throw new WorkoutRemoteDiscoveryError('AUTH_REQUIRED');
            if (response.status === 423) throw new WorkoutRemoteDiscoveryError('FEATURE_DISABLED');
            if (response.status >= 500) throw new WorkoutRemoteDiscoveryError('NETWORK_RETRYABLE');
            return response;
          }) as typeof fetch,
          getAccessToken: async () => (await session(accountId)).accessToken,
        });
        let sharedResult;
        try {
          sharedResult = await shared.ensureGeneration({
            protocolVersion: 2, accountId, namespaceKey, generationId: namespace.generationId,
            deviceId: namespace.deviceId, domains: ['health_routine_preset', 'health_routine_profile'],
          });
        } catch (error) {
          if (error instanceof WorkoutRemoteDiscoveryError) throw error;
          throw new WorkoutRemoteDiscoveryError('SHARED_GENERATION_UNPROVEN');
        }
        if (sharedResult.status !== 'active') throw new WorkoutRemoteDiscoveryError('SHARED_GENERATION_UNPROVEN');
        if (options.currentDeviceId() !== namespace.deviceId) throw new WorkoutRemoteDiscoveryError('IDENTITY_CHANGED');
        const query = new URLSearchParams({ namespaceKey, generationId: namespace.generationId, deviceId: namespace.deviceId });
        const discovered = authority(await request(`/api/sync/v2/workouts/authority?${query}`, accountId));
        const bound = discovered.bindingState === 'bound' ? {
          bindingId: discovered.bindingId!, authorityEpoch: discovered.authorityEpoch,
          serverEpoch: discovered.serverEpoch!, projectScope: discovered.projectScope,
        } : generation(await request('/api/sync/v2/workouts/generations', accountId, {
          method: 'POST', body: JSON.stringify({
            protocolVersion: 2, namespaceKey, generationId: namespace.generationId, deviceId: namespace.deviceId,
          }),
        }), { namespaceKey, generationId: namespace.generationId, deviceId: namespace.deviceId,
          projectScope: discovered.projectScope, authorityEpoch: discovered.authorityEpoch });
        await session(accountId);
        if (options.currentDeviceId() !== namespace.deviceId) throw new WorkoutRemoteDiscoveryError('IDENTITY_CHANGED');
        const evidence: WorkoutRemoteAuthorityRecordV1 = {
          accountId, namespaceKey, generationId: namespace.generationId, domain: WORKOUT_REMOTE_DOMAIN,
          deviceId: namespace.deviceId, protocolVersion: 2, projectScope: discovered.projectScope,
          capability: 'FOUNDATION_READY', authorityState: 'OPEN', authorityEpoch: discovered.authorityEpoch,
          bindingState: 'bound', generationBindingId: bound.bindingId,
          serverEpoch: bound.serverEpoch, verifiedAt: discoveryStartedAt,
          discoverySequence, verificationId: crypto.randomUUID(),
        };
        await repository.persistWorkoutRemoteAuthority(
          evidence, options.currentAccountId, options.currentDeviceId, testOnlyAbortBeforeCommit,
        );
        options.onDiagnostic?.('generation_binding_persisted');
        options.onDiagnostic?.('authority_discovery_success');
        return evidence;
      } catch (error) {
        const code = error instanceof WorkoutRemoteDiscoveryError ? error.code : 'IDENTITY_CHANGED';
        if (code === 'PROJECT_SCOPE_MISMATCH') options.onDiagnostic?.('project_scope_mismatch', code);
        options.onDiagnostic?.('authority_discovery_fail_closed', code);
        throw error;
      }
    },
    /** Explicit dormant orchestration: never reuses a previously stored authority token. */
    async discoverAndBind(repository: LocalDatabaseRepository, mutationId: string) {
      const evidence = await this.discoverAndPersist(repository);
      return repository.bindWorkoutMutation({ mutationId, expectedVerificationId: evidence.verificationId,
        currentAuthenticatedAccount: options.currentAccountId, currentDeviceId: options.currentDeviceId });
    },
  };
}

/** Production-authenticated, still dormant: callers must explicitly invoke discovery or binding. */
export function createAuthenticatedWorkoutRemoteControlClient(baseUrl: string, isCurrentAttempt: () => boolean = () => true) {
  return createWorkoutRemoteControlClient({
    baseUrl,
    getSession: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      return session?.access_token ? { accountId: session.user.id, accessToken: session.access_token } : null;
    },
    // A rapid A→B→A switch can restore the same account ID while an older A
    // request is still in flight. The runtime token also fences IDB settlement.
    currentAccountId: () => isCurrentAttempt() ? runtimeAccountSyncAccountId() : null,
    currentDeviceId: () => !isCurrentAttempt() || typeof localStorage === 'undefined'
      ? null : localStorage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY),
  });
}
