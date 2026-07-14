import {
  advanceLegacyNotesCutoverFence,
  beginLegacyNotesCutoverFence,
  cancelLegacyNotesCutoverFence,
  createLegacyNotesCutoverFenceIdentity,
  createRecoveryCutoverAuthorization,
  isLegacyCutoverFenceIdentity,
  readLegacyNotesCutoverFence,
  sameLegacyCutoverFenceIdentity,
  validateRecoveryCutoverAuthorization,
  LegacyCutoverFenceError,
  type LegacyCutoverFenceIdentity,
  type RecoveryCutoverAuthorization,
} from '../recoverySafetyPolicy';
import { LocalDatabaseError, localDatabaseError, type LocalDatabaseErrorCode } from './errors';
import {
  readVerifiedLegacyNotesCutoverEvidence,
  validateLegacyNotesSourceUnchangedForCutover,
  validateVerifiedLegacyNotesCutoverEvidenceInTransaction,
  verifyLegacyNotesMigration,
  type LegacyNotesMigrationRuntime,
  type LegacyNotesSourceAdapter,
  type VerifiedLegacyNotesCutoverEvidence,
} from './legacyNotesMigration';
import { sha256Hex } from './outboxIdentity';
import { transitionActiveGenerationInTransaction } from './activeGenerationTransition';
import {
  buildLocalFirstRuntimeModeRecord,
  localFirstRuntimeModeKey,
  publicLocalFirstRuntimeMode,
  validatePersistedLocalFirstRuntimeMode,
  type LocalFirstRuntimeMode,
  type LocalFirstRuntimeModeRecordV1,
  type PersistedLocalFirstRuntimeModeRecordV1,
} from './runtimeMode';
import { LOCAL_DATABASE_STORES } from './schema';
import type { DatabaseMetaRecord, GenerationRecord, RestoreSessionRecord } from './types';
import { validTimestamp, validateDatabaseMeta, validateGenerationRecord, validateRestoreSession } from './validation';

const CUTOVER_STORAGE_PREFIX = 'k326:cutover:';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const HASH = /^[a-f0-9]{64}$/;
const ACTIVE_CUTOVER_STATUSES = new Set<LocalFirstCutoverStatus>([
  'planned', 'preflight', 'activating', 'failed_precommit_fenced', 'failed_precommit_releasing', 'activated',
]);
const ACTIVE_RESTORE_STATUSES = new Set(['created', 'validating', 'staged', 'committing']);

export type LocalFirstCutoverStatus =
  | 'planned' | 'preflight' | 'activating' | 'failed_precommit_fenced' | 'failed_precommit_releasing'
  | 'activated' | 'confirmed' | 'failed' | 'cancelled';
export type { LocalFirstRuntimeMode, LocalFirstRuntimeModeRecordV1 } from './runtimeMode';
export type LocalFirstCutoverFailureCode =
  | 'MIGRATION_SOURCE_CHANGED'
  | 'LEGACY_SOURCE_AUTHORITY_REQUIRED'
  | 'LEGACY_SOURCE_AUTHORITY_REVOKED'
  | 'LEGACY_SOURCE_IDENTITY_MISMATCH'
  | 'CUTOVER_PRECONDITION_FAILED'
  | 'CUTOVER_CANCELLED';

export interface LocalFirstCutoverPlanV1 {
  kind: 'local_first_cutover_plan_v1';
  version: 1;
  namespaceKey: string;
  schemaVersion: number;
  userId: string;
  projectRef: string;
  deviceId: string;
  migrationSessionId: string;
  expectedPredecessorGenerationId: string;
  targetGenerationId: string;
  authorityId: string;
  authorityVersion: 1;
  authorityDigest: string;
  externalRootDigest: string;
  rootBindingDigest: string;
  sourceBindingDigest: string;
  sourceSnapshotDigest: string;
  targetManifestDigest: string;
  targetStateDigest: string;
  targetEntryCount: number;
  expectedRuntimeStorageMode: 'legacy';
  targetRuntimeStorageMode: 'local_first';
  postActivationChecks: readonly string[];
  prohibitedSideEffects: readonly string[];
  planDigest: string;
}

export interface LocalFirstCutoverSessionV1 {
  kind: 'local_first_cutover_session_v2';
  version: 2;
  namespaceKey: string;
  cutoverSessionId: string;
  plan: LocalFirstCutoverPlanV1;
  status: LocalFirstCutoverStatus;
  attempt: number;
  createdAt: string;
  updatedAt: string;
  activatedAt: string | null;
  confirmedAt: string | null;
  failure: { code: LocalFirstCutoverFailureCode; context: string } | null;
  fence: LocalFirstCutoverFenceEvidenceV1 | null;
}

export interface LocalFirstCutoverFenceEvidenceV1 {
  kind: 'local_first_cutover_fence_evidence_v1';
  version: 1;
  identity: LegacyCutoverFenceIdentity;
  lateIdentity: LegacyCutoverFenceIdentity | null;
  planDigest: string;
  phase: 'installing' | 'installed' | 'releasing' | 'released' | 'committed';
  installedAt: string | null;
  releasedAt: string | null;
}

interface PersistedLocalFirstCutoverSessionV1 extends LocalFirstCutoverSessionV1 {
  migrationId: string;
}

export type CutoverFailurePoint =
  | 'before_activation_transaction'
  | 'pointer_write'
  | 'mode_write'
  | 'session_transition'
  | 'transaction_completion'
  | 'after_activation_commit';
export type FailedPrecommitFenceRecoveryFailurePoint = 'after_fence_release';

export interface PlanLocalFirstCutoverOptions {
  cutoverSessionId: string;
  migrationSessionId: string;
  authorization: RecoveryCutoverAuthorization;
  now?: string;
}

export interface ActivateLocalFirstCutoverOptions {
  authorization: RecoveryCutoverAuthorization;
  now?: string;
  testOnlyFailAt?: CutoverFailurePoint;
}

export interface LocalFirstCutoverResult {
  cutoverSessionId: string;
  migrationSessionId: string;
  activeGenerationId: string;
  mode: 'local_first';
  status: 'activated' | 'confirmed';
  entityCount: number;
  manifestDigest: string;
  targetStateDigest: string;
}

export interface LocalFirstCutoverRuntime extends LegacyNotesMigrationRuntime {}

function fail(code: LocalDatabaseErrorCode, operation = 'local_first_cutover'): never {
  throw new LocalDatabaseError(code, operation);
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new DOMException('Request failed', 'UnknownError'));
  });
}

function transactionCompletion(transaction: IDBTransaction, operation: string): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new LocalDatabaseError('TRANSACTION_ABORTED', operation));
    transaction.onerror = () => undefined;
  });
}

function abortQuietly(transaction: IDBTransaction): void {
  try { transaction.abort(); } catch { /**/ }
}

function compareCanonicalStrings(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort(compareCanonicalStrings)
    .map(key => `${JSON.stringify(key)}:${canonical(record[key])}`).join(',')}}`;
}

function exactKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value as object).sort(compareCanonicalStrings).join(',')
      === [...expected].sort(compareCanonicalStrings).join(',');
}

function exactOwnDataKeys(value: unknown, expected: readonly string[]): value is Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const keys = Reflect.ownKeys(value);
  return !keys.some(key => typeof key !== 'string')
    && (keys as string[]).sort(compareCanonicalStrings).join(',')
      === [...expected].sort(compareCanonicalStrings).join(',')
    && keys.every(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      return Boolean(descriptor && 'value' in descriptor && descriptor.enumerable);
    });
}

function timestamp(value: string): string {
  if (!validTimestamp(value)) fail('CUTOVER_PRECONDITION_FAILED', 'cutover_timestamp');
  return value;
}

function validateLogicalCutoverId(value: string): string {
  if (!SAFE_ID.test(value) || value.length > 96 || value.startsWith('k326:')) {
    fail('CUTOVER_PRECONDITION_FAILED', 'cutover_session_id');
  }
  return value;
}

function cutoverStorageId(value: string): string {
  return `${CUTOVER_STORAGE_PREFIX}${validateLogicalCutoverId(value)}`;
}

function cutoverKey(namespaceKey: string, cutoverSessionId: string): [string, string] {
  return [namespaceKey, cutoverStorageId(cutoverSessionId)];
}

function modeKey(namespaceKey: string): [string, string] {
  return localFirstRuntimeModeKey(namespaceKey);
}

const POST_ACTIVATION_CHECKS = Object.freeze([
  'active_pointer_matches_target',
  'generation_is_active',
  'legacy_source_unchanged',
  'runtime_mode_is_local_first',
  'target_digest_matches_manifest',
  'target_outbox_and_checkpoint_empty',
]);
const PROHIBITED_SIDE_EFFECTS = Object.freeze([
  'attachment_cleanup',
  'checkpoint_advance',
  'legacy_delete_or_rewrite',
  'network_or_remote_mutation',
  'outbox_synthesis',
  'restore_or_rollback',
]);

function planCore(value: Omit<LocalFirstCutoverPlanV1, 'planDigest'>): unknown[] {
  return ['absinthe-local-first-cutover-plan-v1', value];
}

function validatePlan(value: unknown, runtime: LocalFirstCutoverRuntime): LocalFirstCutoverPlanV1 {
  const keys = [
    'kind', 'version', 'namespaceKey', 'schemaVersion', 'userId', 'projectRef', 'deviceId', 'migrationSessionId',
    'expectedPredecessorGenerationId', 'targetGenerationId', 'authorityId', 'authorityVersion', 'authorityDigest',
    'externalRootDigest', 'rootBindingDigest', 'sourceBindingDigest', 'sourceSnapshotDigest', 'targetManifestDigest',
    'targetStateDigest', 'targetEntryCount', 'expectedRuntimeStorageMode', 'targetRuntimeStorageMode',
    'postActivationChecks', 'prohibitedSideEffects', 'planDigest',
  ];
  if (!exactKeys(value, keys)) fail('CORRUPT_PERSISTED_RECORD', 'validate_cutover_plan');
  const plan = value as unknown as LocalFirstCutoverPlanV1;
  const { planDigest, ...core } = plan;
  if (plan.kind !== 'local_first_cutover_plan_v1' || plan.version !== 1
    || plan.namespaceKey !== runtime.namespaceKey || plan.schemaVersion !== runtime.namespace.schemaVersion
    || plan.userId !== runtime.namespace.userId || plan.projectRef !== runtime.namespace.projectRef
    || plan.deviceId !== runtime.namespace.deviceId || !SAFE_ID.test(plan.migrationSessionId)
    || !SAFE_ID.test(plan.expectedPredecessorGenerationId) || !SAFE_ID.test(plan.targetGenerationId)
    || !SAFE_ID.test(plan.authorityId) || plan.authorityVersion !== 1
    || ![plan.authorityDigest, plan.externalRootDigest, plan.rootBindingDigest, plan.sourceBindingDigest,
      plan.sourceSnapshotDigest, plan.targetManifestDigest, plan.targetStateDigest, plan.planDigest].every(item => HASH.test(item))
    || !Number.isSafeInteger(plan.targetEntryCount) || plan.targetEntryCount < 0 || plan.targetEntryCount > 5_000
    || plan.expectedRuntimeStorageMode !== 'legacy' || plan.targetRuntimeStorageMode !== 'local_first'
    || canonical(plan.postActivationChecks) !== canonical(POST_ACTIVATION_CHECKS)
    || canonical(plan.prohibitedSideEffects) !== canonical(PROHIBITED_SIDE_EFFECTS)
    || planDigest !== sha256Hex(canonical(planCore(core)))) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_cutover_plan');
  }
  return plan;
}

function buildPlan(runtime: LocalFirstCutoverRuntime, evidence: VerifiedLegacyNotesCutoverEvidence): LocalFirstCutoverPlanV1 {
  const core: Omit<LocalFirstCutoverPlanV1, 'planDigest'> = {
    kind: 'local_first_cutover_plan_v1', version: 1, namespaceKey: runtime.namespaceKey,
    schemaVersion: runtime.namespace.schemaVersion, userId: runtime.namespace.userId,
    projectRef: runtime.namespace.projectRef, deviceId: runtime.namespace.deviceId,
    migrationSessionId: evidence.migrationSessionId,
    expectedPredecessorGenerationId: evidence.expectedActiveGenerationId,
    targetGenerationId: evidence.targetGenerationId,
    authorityId: evidence.authorityId, authorityVersion: evidence.authorityVersion,
    authorityDigest: evidence.authorityDigest, externalRootDigest: evidence.externalRootDigest,
    rootBindingDigest: evidence.rootBindingDigest, sourceBindingDigest: evidence.sourceBindingDigest,
    sourceSnapshotDigest: evidence.sourceSnapshotDigest, targetManifestDigest: evidence.manifestDigest,
    targetStateDigest: evidence.targetStateDigest, targetEntryCount: evidence.entryCount,
    expectedRuntimeStorageMode: 'legacy', targetRuntimeStorageMode: 'local_first',
    postActivationChecks: POST_ACTIVATION_CHECKS, prohibitedSideEffects: PROHIBITED_SIDE_EFFECTS,
  };
  const plan = Object.freeze({ ...core, planDigest: sha256Hex(canonical(planCore(core))) });
  validatePlan(plan, runtime);
  return plan;
}

function sessionKeys(): string[] {
  return ['kind', 'version', 'namespaceKey', 'migrationId', 'cutoverSessionId', 'plan', 'status', 'attempt',
    'createdAt', 'updatedAt', 'activatedAt', 'confirmedAt', 'failure', 'fence'];
}

function validateFenceEvidence(
  value: unknown,
  record: Pick<LocalFirstCutoverSessionV1, 'namespaceKey' | 'cutoverSessionId' | 'plan'>,
): LocalFirstCutoverFenceEvidenceV1 {
  const keys = ['kind', 'version', 'identity', 'lateIdentity', 'planDigest', 'phase', 'installedAt', 'releasedAt'];
  if (!exactOwnDataKeys(value, keys)) fail('CORRUPT_PERSISTED_RECORD', 'validate_cutover_fence_evidence');
  const evidence = value as unknown as LocalFirstCutoverFenceEvidenceV1;
  if (!isLegacyCutoverFenceIdentity(evidence.identity)
    || evidence.lateIdentity !== null && !isLegacyCutoverFenceIdentity(evidence.lateIdentity)) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_cutover_fence_evidence');
  }
  const identityMatches = (identity: LegacyCutoverFenceIdentity): boolean => identity.namespaceKey === record.namespaceKey
    && identity.cutoverSessionId === record.cutoverSessionId
    && identity.targetGenerationId === record.plan.targetGenerationId;
  const timestampsValid = evidence.phase === 'installing'
    ? evidence.installedAt === null && evidence.releasedAt === null
    : evidence.phase === 'released'
      ? evidence.installedAt !== null && validTimestamp(evidence.installedAt)
        && evidence.releasedAt !== null && validTimestamp(evidence.releasedAt)
        && Date.parse(evidence.releasedAt) >= Date.parse(evidence.installedAt)
      : evidence.installedAt !== null && validTimestamp(evidence.installedAt) && evidence.releasedAt === null;
  if (evidence.kind !== 'local_first_cutover_fence_evidence_v1' || evidence.version !== 1
    || evidence.planDigest !== record.plan.planDigest || !HASH.test(evidence.planDigest)
    || !['installing', 'installed', 'releasing', 'released', 'committed'].includes(evidence.phase)
    || !identityMatches(evidence.identity) || evidence.lateIdentity !== null && !identityMatches(evidence.lateIdentity)
    || evidence.lateIdentity !== null && !['releasing', 'released'].includes(evidence.phase)
    || !timestampsValid) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_cutover_fence_evidence');
  }
  return evidence;
}

function persistedSession(value: unknown, runtime: LocalFirstCutoverRuntime): LocalFirstCutoverSessionV1 {
  if (!exactKeys(value, sessionKeys())) fail('CORRUPT_PERSISTED_RECORD', 'validate_cutover_session');
  const record = value as unknown as PersistedLocalFirstCutoverSessionV1;
  const plan = validatePlan(record.plan, runtime);
  const fence = record.fence === null ? null : validateFenceEvidence(record.fence, record);
  const failureValid = record.failure === null || exactKeys(record.failure, ['code', 'context'])
    && ['MIGRATION_SOURCE_CHANGED', 'LEGACY_SOURCE_AUTHORITY_REQUIRED', 'LEGACY_SOURCE_AUTHORITY_REVOKED',
      'LEGACY_SOURCE_IDENTITY_MISMATCH', 'CUTOVER_PRECONDITION_FAILED', 'CUTOVER_CANCELLED'].includes(record.failure.code)
    && SAFE_ID.test(record.failure.context);
  const chronologyValid = validTimestamp(record.createdAt) && validTimestamp(record.updatedAt)
    && Date.parse(record.updatedAt) >= Date.parse(record.createdAt)
    && (record.activatedAt === null || validTimestamp(record.activatedAt)
      && Date.parse(record.activatedAt) >= Date.parse(record.createdAt)
      && Date.parse(record.updatedAt) >= Date.parse(record.activatedAt))
    && (record.confirmedAt === null || validTimestamp(record.confirmedAt)
      && record.activatedAt !== null
      && Date.parse(record.confirmedAt) >= Date.parse(record.activatedAt)
      && Date.parse(record.updatedAt) >= Date.parse(record.confirmedAt));
  const attemptValid = ['planned', 'preflight'].includes(record.status)
    ? record.attempt === 0
    : ['activating', 'failed_precommit_fenced', 'failed_precommit_releasing', 'activated', 'confirmed'].includes(record.status)
      ? record.attempt > 0
      : true;
  const lifecycleValid = ['planned', 'preflight'].includes(record.status)
    ? record.activatedAt === null && record.confirmedAt === null && record.failure === null && fence === null
    : record.status === 'activating'
      ? record.activatedAt === null && record.confirmedAt === null && record.failure === null
        && (fence === null || ['installing', 'installed'].includes(fence.phase))
    : ['failed_precommit_fenced', 'failed_precommit_releasing'].includes(record.status)
      ? record.activatedAt === null && record.confirmedAt === null && record.failure !== null && fence !== null
        && fence.phase === (record.status === 'failed_precommit_fenced' ? 'installed' : 'releasing')
      : record.status === 'activated'
      ? record.activatedAt !== null && record.confirmedAt === null && record.failure === null && fence?.phase === 'committed'
      : record.status === 'confirmed'
        ? record.activatedAt !== null && record.confirmedAt !== null && record.failure === null && fence?.phase === 'committed'
        : record.status === 'cancelled'
          ? record.activatedAt === null && record.confirmedAt === null && record.failure?.code === 'CUTOVER_CANCELLED'
            && fence === null
          : record.status === 'failed' && record.activatedAt === null && record.confirmedAt === null
            && record.failure !== null && (fence === null || fence.phase === 'released');
  if (record.kind !== 'local_first_cutover_session_v2' || record.version !== 2
    || record.namespaceKey !== runtime.namespaceKey || !SAFE_ID.test(record.cutoverSessionId)
    || record.cutoverSessionId.length > 96 || record.cutoverSessionId.startsWith('k326:')
    || record.migrationId !== cutoverStorageId(record.cutoverSessionId)
    || plan.migrationSessionId.length === 0 || ![
      'planned', 'preflight', 'activating', 'failed_precommit_fenced', 'failed_precommit_releasing',
      'activated', 'confirmed', 'failed', 'cancelled',
    ].includes(record.status)
    || !Number.isSafeInteger(record.attempt) || record.attempt < 0 || !attemptValid
    || !failureValid || !chronologyValid || !lifecycleValid) {
    fail('CORRUPT_PERSISTED_RECORD', 'validate_cutover_session');
  }
  const { migrationId: _storageId, ...session } = record;
  return session;
}

function toPersistedSession(value: LocalFirstCutoverSessionV1): PersistedLocalFirstCutoverSessionV1 {
  return { ...value, migrationId: cutoverStorageId(value.cutoverSessionId) };
}

function buildModeRecord(input: Omit<PersistedLocalFirstRuntimeModeRecordV1, 'kind' | 'version' | 'migrationId' | 'recordDigest'>): PersistedLocalFirstRuntimeModeRecordV1 {
  return buildLocalFirstRuntimeModeRecord(input);
}

function persistedMode(value: unknown, runtime: LocalFirstCutoverRuntime): PersistedLocalFirstRuntimeModeRecordV1 {
  return validatePersistedLocalFirstRuntimeMode(value, runtime.namespaceKey);
}

function publicMode(value: PersistedLocalFirstRuntimeModeRecordV1): LocalFirstRuntimeModeRecordV1 {
  return publicLocalFirstRuntimeMode(value);
}

function assertAuthorization(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
  targetGenerationId: string,
  authorization: RecoveryCutoverAuthorization,
): void {
  try {
    validateRecoveryCutoverAuthorization(authorization, { namespaceKey: runtime.namespaceKey, cutoverSessionId, targetGenerationId });
  } catch {
    fail('CUTOVER_RECOVERY_AUTHORIZATION_REQUIRED', 'authorize_cutover');
  }
}

function assertEvidenceMatchesPlan(evidence: VerifiedLegacyNotesCutoverEvidence, plan: LocalFirstCutoverPlanV1): void {
  if (evidence.migrationSessionId !== plan.migrationSessionId
    || evidence.expectedActiveGenerationId !== plan.expectedPredecessorGenerationId
    || evidence.targetGenerationId !== plan.targetGenerationId || evidence.entryCount !== plan.targetEntryCount
    || evidence.manifestDigest !== plan.targetManifestDigest || evidence.targetStateDigest !== plan.targetStateDigest
    || evidence.sourceSnapshotDigest !== plan.sourceSnapshotDigest || evidence.authorityId !== plan.authorityId
    || evidence.authorityVersion !== plan.authorityVersion || evidence.authorityDigest !== plan.authorityDigest
    || evidence.externalRootDigest !== plan.externalRootDigest || evidence.rootBindingDigest !== plan.rootBindingDigest
    || evidence.sourceBindingDigest !== plan.sourceBindingDigest) {
    fail('CUTOVER_PRECONDITION_FAILED', 'match_cutover_evidence');
  }
}

function assertNoActiveRestore(values: unknown[], namespaceKey: string): void {
  for (const value of values) {
    if ((value as { namespaceKey?: unknown } | null)?.namespaceKey !== namespaceKey) continue;
    try { validateRestoreSession(value as RestoreSessionRecord); }
    catch { fail('CORRUPT_PERSISTED_RECORD', 'validate_cutover_restore_conflict'); }
    if (ACTIVE_RESTORE_STATUSES.has((value as RestoreSessionRecord).status)) {
      fail('CUTOVER_SESSION_CONFLICT', 'cutover_restore_conflict');
    }
  }
}

function cutoverSessionsFromValues(
  values: unknown[], runtime: LocalFirstCutoverRuntime,
): LocalFirstCutoverSessionV1[] {
  const sessions: LocalFirstCutoverSessionV1[] = [];
  for (const value of values) {
    const record = value as { kind?: unknown; migrationId?: unknown; namespaceKey?: unknown } | null;
    if (record?.namespaceKey !== runtime.namespaceKey) continue;
    const reserved = typeof record?.migrationId === 'string' && record.migrationId.startsWith(CUTOVER_STORAGE_PREFIX);
    if (record?.kind !== 'local_first_cutover_session_v2' && !reserved) continue;
    sessions.push(persistedSession(value, runtime));
  }
  return sessions;
}

function assertNoCompetingCutover(
  values: unknown[], runtime: LocalFirstCutoverRuntime, currentCutoverSessionId: string,
): void {
  const conflict = cutoverSessionsFromValues(values, runtime).find(session => session.cutoverSessionId !== currentCutoverSessionId
    && ACTIVE_CUTOVER_STATUSES.has(session.status));
  if (conflict) fail('CUTOVER_SESSION_CONFLICT', 'competing_cutover_session');
}

async function readSession(
  runtime: LocalFirstCutoverRuntime, cutoverSessionId: string,
): Promise<LocalFirstCutoverSessionV1 | null> {
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readonly');
  const done = transactionCompletion(tx, 'read_cutover_session');
  const raw = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.migrationState)
    .get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
  await done;
  return raw === undefined ? null : persistedSession(raw, runtime);
}

export function createLocalFirstCutoverAuthorization(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
  migrationSessionId: string,
  purpose: 'test' | 'developer',
): RecoveryCutoverAuthorization {
  runtime.assertOpen('create_cutover_authorization');
  validateLogicalCutoverId(cutoverSessionId);
  if (!SAFE_ID.test(migrationSessionId)) fail('CUTOVER_PRECONDITION_FAILED', 'cutover_migration_id');
  return createRecoveryCutoverAuthorization({
    namespaceKey: runtime.namespaceKey,
    cutoverSessionId,
    targetGenerationId: `migration-${migrationSessionId}`,
    purpose,
  });
}

export async function planLocalFirstCutover(
  runtime: LocalFirstCutoverRuntime,
  adapter: LegacyNotesSourceAdapter,
  options: PlanLocalFirstCutoverOptions,
): Promise<LocalFirstCutoverSessionV1> {
  runtime.assertOpen('plan_local_first_cutover');
  validateLogicalCutoverId(options.cutoverSessionId);
  const at = timestamp(options.now ?? runtime.clock());
  const previouslyPersisted = await readSession(runtime, options.cutoverSessionId);
  if (previouslyPersisted) {
    if (previouslyPersisted.plan.migrationSessionId !== options.migrationSessionId) {
      fail('CUTOVER_SESSION_CONFLICT', 'cutover_plan_mismatch');
    }
    assertAuthorization(runtime, options.cutoverSessionId, previouslyPersisted.plan.targetGenerationId, options.authorization);
    if (['activated', 'confirmed', 'failed_precommit_fenced', 'failed_precommit_releasing', 'failed', 'cancelled']
      .includes(previouslyPersisted.status)) return previouslyPersisted;
  }
  await validateLegacyNotesSourceUnchangedForCutover(runtime, adapter, options.migrationSessionId);
  const evidence = await readVerifiedLegacyNotesCutoverEvidence(runtime, options.migrationSessionId, 'inactive');
  const plan = buildPlan(runtime, evidence);
  assertAuthorization(runtime, options.cutoverSessionId, plan.targetGenerationId, options.authorization);

  const tx = runtime.db.transaction([
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.migrationState, LOCAL_DATABASE_STORES.restoreSessions,
  ], 'readwrite');
  const done = transactionCompletion(tx, 'plan_local_first_cutover');
  try {
    const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    if (!meta) fail('CUTOVER_PRECONDITION_FAILED', 'cutover_metadata');
    try { validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion); }
    catch { fail('CORRUPT_PERSISTED_RECORD', 'cutover_metadata'); }
    if (meta.activeGenerationId !== plan.expectedPredecessorGenerationId) fail('CUTOVER_PRECONDITION_FAILED', 'cutover_predecessor');
    const restoreValues = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).getAll()) as unknown[];
    assertNoActiveRestore(restoreValues, runtime.namespaceKey);
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const allMigrationValues = await requestResult(store.getAll()) as unknown[];
    assertNoCompetingCutover(allMigrationValues, runtime, options.cutoverSessionId);
    const existingRaw = await requestResult(store.get(cutoverKey(runtime.namespaceKey, options.cutoverSessionId)));
    const modeRaw = await requestResult(store.get(modeKey(runtime.namespaceKey)));
    if (existingRaw !== undefined && modeRaw === undefined) {
      fail('CORRUPT_PERSISTED_RECORD', 'cutover_runtime_mode_missing');
    }
    let mode: PersistedLocalFirstRuntimeModeRecordV1;
    if (modeRaw === undefined) {
      mode = buildModeRecord({ namespaceKey: runtime.namespaceKey, mode: 'legacy', activeGenerationId: meta.activeGenerationId,
        cutoverSessionId: null, targetGenerationId: null, updatedAt: at, activatedAt: null });
      store.add(mode);
    } else {
      mode = persistedMode(modeRaw, runtime);
      if (mode.mode !== 'legacy' || mode.activeGenerationId !== meta.activeGenerationId) {
        fail('CUTOVER_PRECONDITION_FAILED', 'cutover_runtime_mode');
      }
    }
    if (existingRaw !== undefined) {
      const existing = persistedSession(existingRaw, runtime);
      if (canonical(existing.plan) !== canonical(plan)) fail('CUTOVER_SESSION_CONFLICT', 'cutover_plan_mismatch');
      await done; return existing;
    }
    const session: LocalFirstCutoverSessionV1 = {
      kind: 'local_first_cutover_session_v2', version: 2, namespaceKey: runtime.namespaceKey,
      cutoverSessionId: options.cutoverSessionId, plan, status: 'planned', attempt: 0,
      createdAt: at, updatedAt: at, activatedAt: null, confirmedAt: null, failure: null, fence: null,
    };
    persistedSession(toPersistedSession(session), runtime); store.add(toPersistedSession(session));
    await done; return session;
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'plan_local_first_cutover');
  }
}

export async function preflightLocalFirstCutover(
  runtime: LocalFirstCutoverRuntime,
  adapter: LegacyNotesSourceAdapter,
  cutoverSessionId: string,
  authorization: RecoveryCutoverAuthorization,
  atValue?: string,
): Promise<LocalFirstCutoverSessionV1> {
  runtime.assertOpen('preflight_local_first_cutover');
  const at = timestamp(atValue ?? runtime.clock());
  const before = await readSession(runtime, cutoverSessionId);
  if (!before) fail('CUTOVER_SESSION_CONFLICT', 'preflight_cutover_session');
  assertAuthorization(runtime, cutoverSessionId, before.plan.targetGenerationId, authorization);
  if (['failed_precommit_fenced', 'failed_precommit_releasing'].includes(before.status)) {
    fail('CUTOVER_FENCE_RECOVERY_REQUIRED', 'preflight_cutover_status');
  }
  if (['failed', 'cancelled'].includes(before.status)) fail(before.status === 'cancelled' ? 'CUTOVER_CANCELLED' : 'CUTOVER_SESSION_CONFLICT');
  if (['activated', 'confirmed'].includes(before.status)) return before;
  await verifyLegacyNotesMigration(runtime, adapter, before.plan.migrationSessionId, at);
  const evidence = await readVerifiedLegacyNotesCutoverEvidence(runtime, before.plan.migrationSessionId, 'inactive');
  assertEvidenceMatchesPlan(evidence, before.plan);

  const tx = runtime.db.transaction([
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.migrationState, LOCAL_DATABASE_STORES.restoreSessions,
  ], 'readwrite');
  const done = transactionCompletion(tx, 'preflight_local_first_cutover');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
    const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    const modeRaw = await requestResult(store.get(modeKey(runtime.namespaceKey)));
    if (raw === undefined || !meta || modeRaw === undefined) fail('CUTOVER_SESSION_CONFLICT', 'preflight_cutover_session');
    const current = persistedSession(raw, runtime); const mode = persistedMode(modeRaw, runtime);
    try { validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion); }
    catch { fail('CORRUPT_PERSISTED_RECORD', 'preflight_cutover_metadata'); }
    assertEvidenceMatchesPlan(evidence, current.plan);
    if (meta.activeGenerationId !== current.plan.expectedPredecessorGenerationId
      || mode.mode !== 'legacy' || mode.activeGenerationId !== meta.activeGenerationId) {
      fail('CUTOVER_PRECONDITION_FAILED', 'preflight_cutover_state');
    }
    assertNoActiveRestore(await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).getAll()) as unknown[], runtime.namespaceKey);
    if (current.status === 'preflight' || current.status === 'activating') { await done; return current; }
    if (current.status !== 'planned') fail('CUTOVER_SESSION_CONFLICT', 'preflight_cutover_status');
    const next = { ...current, status: 'preflight' as const, updatedAt: at };
    persistedSession(toPersistedSession(next), runtime); store.put(toPersistedSession(next));
    await done; return next;
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'preflight_local_first_cutover');
  }
}

async function transitionToActivating(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
  at: string,
): Promise<LocalFirstCutoverSessionV1> {
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const done = transactionCompletion(tx, 'begin_local_first_cutover');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
    if (raw === undefined) fail('CUTOVER_SESSION_CONFLICT', 'begin_cutover_session');
    const current = persistedSession(raw, runtime);
    if (current.status === 'activating') { await done; return current; }
    if (current.status !== 'preflight') fail('CUTOVER_SESSION_CONFLICT', 'begin_cutover_status');
    const next = { ...current, status: 'activating' as const, attempt: current.attempt + 1, updatedAt: at };
    persistedSession(toPersistedSession(next), runtime); store.put(toPersistedSession(next));
    await done; return next;
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'begin_local_first_cutover');
  }
}

function fenceEvidence(
  session: LocalFirstCutoverSessionV1,
  identity: LegacyCutoverFenceIdentity,
): LocalFirstCutoverFenceEvidenceV1 {
  return {
    kind: 'local_first_cutover_fence_evidence_v1', version: 1, identity, lateIdentity: null,
    planDigest: session.plan.planDigest, phase: 'installing', installedAt: null, releasedAt: null,
  };
}

function physicalFenceIdentity(value: LegacyCutoverFenceIdentity): LegacyCutoverFenceIdentity {
  return {
    namespaceKey: value.namespaceKey, cutoverSessionId: value.cutoverSessionId,
    targetGenerationId: value.targetGenerationId, fenceNonce: value.fenceNonce, fenceEpoch: value.fenceEpoch,
  };
}

function mapFenceError(error: unknown, operation: string): never {
  if (error instanceof LegacyCutoverFenceError) {
    const code = error.code === 'FENCE_OWNERSHIP_CONFLICT' ? 'CUTOVER_FENCE_OWNERSHIP_CONFLICT'
      : error.code === 'FENCE_RECOVERY_INCOMPLETE' || error.code === 'FENCE_READBACK_MISMATCH'
        ? 'CUTOVER_FENCE_RECOVERY_INCOMPLETE' : 'CUTOVER_FENCE_INSTANCE_MISMATCH';
    fail(code, operation);
  }
  fail('CUTOVER_FENCE_RECOVERY_INCOMPLETE', operation);
}

async function installCutoverFence(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
  authorization: RecoveryCutoverAuthorization,
  at: string,
): Promise<LocalFirstCutoverSessionV1> {
  const candidate = createLegacyNotesCutoverFenceIdentity(authorization);
  const prepareTx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const prepareDone = transactionCompletion(prepareTx, 'prepare_cutover_fence');
  let identity!: LegacyCutoverFenceIdentity;
  try {
    const store = prepareTx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
    if (raw === undefined) fail('CORRUPT_PERSISTED_RECORD', 'prepare_cutover_fence');
    const current = persistedSession(raw, runtime);
    if (current.status !== 'activating') fail('CUTOVER_FENCE_RECOVERY_REQUIRED', 'prepare_cutover_fence');
    if (current.fence !== null && !['installing', 'installed'].includes(current.fence.phase)) {
      fail('CUTOVER_FENCE_INSTANCE_MISMATCH', 'prepare_cutover_fence');
    }
    identity = current.fence?.identity ?? candidate;
    if (current.fence === null) {
      const next = { ...current, updatedAt: at, fence: fenceEvidence(current, identity) };
      persistedSession(toPersistedSession(next), runtime); store.put(toPersistedSession(next));
    }
    await prepareDone;
  } catch (error) {
    abortQuietly(prepareTx); await prepareDone.catch(() => undefined);
    throw localDatabaseError(error, 'prepare_cutover_fence');
  }

  try { beginLegacyNotesCutoverFence(authorization, identity); }
  catch (error) { mapFenceError(error, 'install_cutover_fence'); }

  const stores = [LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations,
    LOCAL_DATABASE_STORES.migrationState];
  const confirmTx = runtime.db.transaction(stores, 'readwrite');
  const confirmDone = transactionCompletion(confirmTx, 'confirm_cutover_fence');
  try {
    const store = confirmTx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
    const modeRaw = await requestResult(store.get(modeKey(runtime.namespaceKey)));
    const meta = await requestResult(confirmTx.objectStore(LOCAL_DATABASE_STORES.databaseMeta)
      .get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    if (raw === undefined || modeRaw === undefined || !meta) fail('CORRUPT_PERSISTED_RECORD', 'confirm_cutover_fence');
    const current = persistedSession(raw, runtime); const mode = persistedMode(modeRaw, runtime);
    const physical = readLegacyNotesCutoverFence();
    if (current.status !== 'activating' || current.fence === null
      || !sameLegacyCutoverFenceIdentity(current.fence.identity, identity)
      || !['installing', 'installed'].includes(current.fence.phase)
      || mode.mode !== 'legacy' || mode.activeGenerationId !== current.plan.expectedPredecessorGenerationId
      || meta.activeGenerationId !== current.plan.expectedPredecessorGenerationId
      || physical === null || physical === 'corrupt' || physical.phase !== 'activating'
      || !sameLegacyCutoverFenceIdentity(physical, identity)) {
      fail('CUTOVER_FENCE_INSTANCE_MISMATCH', 'confirm_cutover_fence');
    }
    const target = await requestResult(confirmTx.objectStore(LOCAL_DATABASE_STORES.generations).get([
      runtime.namespaceKey, current.plan.targetGenerationId,
    ])) as GenerationRecord | undefined;
    if (!target || target.status !== 'preparing' || target.activeNamespaceKey !== undefined) {
      fail('CUTOVER_ALREADY_ACTIVATED', 'confirm_cutover_fence');
    }
    const installed = current.fence.phase === 'installed' ? current : {
      ...current, updatedAt: at,
      fence: { ...current.fence, phase: 'installed' as const, installedAt: at },
    };
    persistedSession(toPersistedSession(installed), runtime); store.put(toPersistedSession(installed));
    await confirmDone; return installed;
  } catch (error) {
    abortQuietly(confirmTx); await confirmDone.catch(() => undefined);
    const physical = readLegacyNotesCutoverFence();
    if (physical !== null && physical !== 'corrupt' && physical.phase === 'activating'
      && sameLegacyCutoverFenceIdentity(physical, identity)) {
      try { cancelLegacyNotesCutoverFence(authorization, identity); } catch { /** remain fail closed */ }
    }
    throw localDatabaseError(error, 'confirm_cutover_fence');
  }
}

async function markFailedIfSafe(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
  code: LocalFirstCutoverFailureCode,
  at: string,
  fencePresent = false,
): Promise<void> {
  const tx = runtime.db.transaction(LOCAL_DATABASE_STORES.migrationState, 'readwrite');
  const done = transactionCompletion(tx, 'fail_local_first_cutover');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
    if (raw === undefined) { await done; return; }
    const current = persistedSession(raw, runtime);
    if (!['planned', 'preflight', 'activating'].includes(current.status)) { await done; return; }
    if (fencePresent && current.fence?.phase !== 'installed') { await done; return; }
    const next: LocalFirstCutoverSessionV1 = {
      ...current,
      status: fencePresent ? 'failed_precommit_fenced' : 'failed',
      updatedAt: at,
      failure: { code, context: fencePresent ? 'precommit_fence_cleanup' : 'activation_preflight' },
    };
    persistedSession(toPersistedSession(next), runtime); store.put(toPersistedSession(next)); await done;
  } catch { abortQuietly(tx); await done.catch(() => undefined); }
}

function outboxRange(namespaceKey: string, generationId: string): IDBKeyRange {
  return IDBKeyRange.bound([namespaceKey, generationId, ''], [namespaceKey, generationId, '\uffff']);
}

function checkpointRange(namespaceKey: string, generationId: string): IDBKeyRange {
  return IDBKeyRange.bound([namespaceKey, generationId, '', ''], [namespaceKey, generationId, '\uffff', '\uffff']);
}

async function validateFailedPrecommitRecoveryGraph(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
  transaction: IDBTransaction,
): Promise<LocalFirstCutoverSessionV1> {
  const migrationStore = transaction.objectStore(LOCAL_DATABASE_STORES.migrationState);
  const raw = await requestResult(migrationStore.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
  const modeRaw = await requestResult(migrationStore.get(modeKey(runtime.namespaceKey)));
  const meta = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.databaseMeta)
    .get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
  if (raw === undefined || modeRaw === undefined || !meta) {
    fail('CORRUPT_PERSISTED_RECORD', 'recover_precommit_fence_graph');
  }
  const session = persistedSession(raw, runtime);
  const mode = persistedMode(modeRaw, runtime);
  try { validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion); }
  catch { fail('CORRUPT_PERSISTED_RECORD', 'recover_precommit_fence_graph'); }
  if (!['failed_precommit_fenced', 'failed_precommit_releasing', 'failed'].includes(session.status)
    || session.status !== 'failed' && session.fence === null
    || mode.mode !== 'legacy'
    || mode.activeGenerationId !== session.plan.expectedPredecessorGenerationId
    || meta.activeGenerationId !== session.plan.expectedPredecessorGenerationId) {
    fail('CUTOVER_FENCE_RECOVERY_REQUIRED', 'recover_precommit_fence_graph');
  }
  const target = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.generations).get([
    runtime.namespaceKey, session.plan.targetGenerationId,
  ])) as GenerationRecord | undefined;
  if (!target) fail('CORRUPT_PERSISTED_RECORD', 'recover_precommit_fence_target');
  try { validateGenerationRecord(target, runtime.namespaceKey, runtime.namespace.schemaVersion); }
  catch { fail('CORRUPT_PERSISTED_RECORD', 'recover_precommit_fence_target'); }
  if (target.status !== 'preparing' || target.activeNamespaceKey !== undefined) {
    fail('CUTOVER_ALREADY_ACTIVATED', 'recover_precommit_fence_target');
  }
  const targetOutbox = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.outbox)
    .getAll(outboxRange(runtime.namespaceKey, session.plan.targetGenerationId))) as unknown[];
  const targetCheckpoints = await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.syncCheckpoints)
    .getAll(checkpointRange(runtime.namespaceKey, session.plan.targetGenerationId))) as unknown[];
  if (targetOutbox.length !== 0 || targetCheckpoints.length !== 0) {
    fail('CUTOVER_FENCE_RECOVERY_REQUIRED', 'recover_precommit_fence_queue_state');
  }
  assertNoActiveRestore(
    await requestResult(transaction.objectStore(LOCAL_DATABASE_STORES.restoreSessions).getAll()) as unknown[],
    runtime.namespaceKey,
  );
  assertNoCompetingCutover(
    await requestResult(migrationStore.getAll()) as unknown[], runtime, cutoverSessionId,
  );
  return session;
}

export async function recoverFailedPrecommitCutoverFence(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
  authorization: RecoveryCutoverAuthorization,
  atValue?: string,
  testOnlyFailAt?: FailedPrecommitFenceRecoveryFailurePoint,
): Promise<LocalFirstCutoverSessionV1> {
  runtime.assertOpen('recover_failed_precommit_cutover_fence');
  const at = timestamp(atValue ?? runtime.clock());
  const before = await readSession(runtime, cutoverSessionId);
  if (!before) fail('CUTOVER_SESSION_CONFLICT', 'recover_precommit_fence_session');
  assertAuthorization(runtime, cutoverSessionId, before.plan.targetGenerationId, authorization);
  const initialFence = readLegacyNotesCutoverFence();
  if (initialFence === 'corrupt') fail('CORRUPT_PERSISTED_RECORD', 'recover_precommit_fence_identity');
  if (['activated', 'confirmed'].includes(before.status)) {
    fail('CUTOVER_ALREADY_ACTIVATED', 'recover_precommit_fence_status');
  }
  if (!['failed_precommit_fenced', 'failed_precommit_releasing', 'failed'].includes(before.status)
    || before.status !== 'failed' && before.fence === null) {
    fail(['activated', 'confirmed'].includes(before.status) ? 'CUTOVER_ALREADY_ACTIVATED'
      : 'CUTOVER_FENCE_RECOVERY_REQUIRED', 'recover_precommit_fence_status');
  }

  const stores = [
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.outbox,
    LOCAL_DATABASE_STORES.syncCheckpoints, LOCAL_DATABASE_STORES.migrationState, LOCAL_DATABASE_STORES.restoreSessions,
  ];
  const validationTx = runtime.db.transaction(stores, 'readonly');
  const validationDone = transactionCompletion(validationTx, 'recover_precommit_fence_validate');
  let validatedSession!: LocalFirstCutoverSessionV1;
  try {
    validatedSession = await validateFailedPrecommitRecoveryGraph(runtime, cutoverSessionId, validationTx);
    await validationDone;
  } catch (error) {
    abortQuietly(validationTx); await validationDone.catch(() => undefined);
    throw localDatabaseError(error, 'recover_precommit_fence_validate');
  }
  if (validatedSession.status === 'failed' && initialFence === null) return validatedSession;
  if (validatedSession.status === 'failed' && validatedSession.fence === null) {
    fail('CUTOVER_FENCE_INSTANCE_MISMATCH', 'recover_precommit_fence_history');
  }

  const fence = readLegacyNotesCutoverFence();
  if (fence === 'corrupt') fail('CORRUPT_PERSISTED_RECORD', 'recover_precommit_fence_identity');
  if (before.status === 'failed_precommit_fenced' && fence === null) {
    fail('CUTOVER_FENCE_IDENTITY_MISMATCH', 'recover_precommit_fence_identity');
  }
  if (fence !== null && (fence.phase !== 'activating' || fence.namespaceKey !== runtime.namespaceKey
    || fence.cutoverSessionId !== cutoverSessionId || fence.targetGenerationId !== before.plan.targetGenerationId)) {
    fail('CUTOVER_FENCE_OWNERSHIP_CONFLICT', 'recover_precommit_fence_identity');
  }
  const expectedRemovalIdentity = validatedSession.fence!.lateIdentity ?? validatedSession.fence!.identity;
  if (fence !== null && before.status !== 'failed'
    && !sameLegacyCutoverFenceIdentity(fence, expectedRemovalIdentity)) {
    fail('CUTOVER_FENCE_INSTANCE_MISMATCH', 'recover_precommit_fence_identity');
  }
  if (before.status === 'failed_precommit_fenced' || before.status === 'failed') {
    const releaseTx = runtime.db.transaction(stores, 'readwrite');
    const releaseDone = transactionCompletion(releaseTx, 'recover_precommit_fence_releasing');
    try {
      const current = await validateFailedPrecommitRecoveryGraph(runtime, cutoverSessionId, releaseTx);
      const observed = readLegacyNotesCutoverFence();
      if (observed === null || observed === 'corrupt' || observed.phase !== 'activating'
        || observed.namespaceKey !== runtime.namespaceKey || observed.cutoverSessionId !== cutoverSessionId
        || observed.targetGenerationId !== current.plan.targetGenerationId
        || current.status === 'failed_precommit_fenced'
          && !sameLegacyCutoverFenceIdentity(observed, current.fence!.identity)) {
        fail('CUTOVER_FENCE_INSTANCE_MISMATCH', 'recover_precommit_fence_releasing');
      }
      const releasing: LocalFirstCutoverSessionV1 = {
        ...current, status: 'failed_precommit_releasing', updatedAt: at,
        fence: {
          ...current.fence!, phase: 'releasing', releasedAt: null,
          lateIdentity: current.status === 'failed' ? physicalFenceIdentity(observed) : current.fence!.lateIdentity,
        },
      };
      persistedSession(toPersistedSession(releasing), runtime);
      releaseTx.objectStore(LOCAL_DATABASE_STORES.migrationState).put(toPersistedSession(releasing));
      await releaseDone;
    } catch (error) {
      abortQuietly(releaseTx); await releaseDone.catch(() => undefined);
      throw localDatabaseError(error, 'recover_precommit_fence_releasing');
    }
  }
  const releasingSession = await readSession(runtime, cutoverSessionId);
  if (!releasingSession || releasingSession.status !== 'failed_precommit_releasing' || releasingSession.fence === null) {
    fail('CORRUPT_PERSISTED_RECORD', 'recover_precommit_fence_releasing');
  }
  const removalIdentity = releasingSession.fence.lateIdentity ?? releasingSession.fence.identity;
  const currentFence = readLegacyNotesCutoverFence();
  if (currentFence === 'corrupt') fail('CORRUPT_PERSISTED_RECORD', 'recover_precommit_fence_cleanup');
  if (currentFence !== null) {
    if (!sameLegacyCutoverFenceIdentity(currentFence, removalIdentity)) {
      fail('CUTOVER_FENCE_INSTANCE_MISMATCH', 'recover_precommit_fence_cleanup');
    }
    try { cancelLegacyNotesCutoverFence(authorization, removalIdentity); }
    catch (error) { mapFenceError(error, 'recover_precommit_fence_cleanup'); }
  }
  if (testOnlyFailAt === 'after_fence_release') {
    fail('TRANSACTION_FAILED', 'recover_precommit_fence_after_release');
  }
  if (readLegacyNotesCutoverFence() !== null) {
    fail('CUTOVER_FENCE_RECOVERY_INCOMPLETE', 'recover_precommit_fence_absence');
  }

  const terminalTx = runtime.db.transaction(stores, 'readwrite');
  const terminalDone = transactionCompletion(terminalTx, 'recover_precommit_fence_terminal');
  try {
    const current = await validateFailedPrecommitRecoveryGraph(runtime, cutoverSessionId, terminalTx);
    if (readLegacyNotesCutoverFence() !== null) {
      fail('CUTOVER_FENCE_CLEANUP_FAILED', 'recover_precommit_fence_terminal');
    }
    const failed: LocalFirstCutoverSessionV1 = {
      ...current, status: 'failed', updatedAt: at,
      failure: { code: current.failure?.code ?? 'CUTOVER_PRECONDITION_FAILED', context: 'precommit_fence_released' },
      fence: { ...current.fence!, phase: 'released', releasedAt: at },
    };
    persistedSession(toPersistedSession(failed), runtime);
    terminalTx.objectStore(LOCAL_DATABASE_STORES.migrationState).put(toPersistedSession(failed));
    await terminalDone;
    if (readLegacyNotesCutoverFence() !== null) {
      fail('CUTOVER_FENCE_REAPPEARED', 'recover_precommit_fence_terminal');
    }
    return failed;
  } catch (error) {
    abortQuietly(terminalTx); await terminalDone.catch(() => undefined);
    const latest = await readSession(runtime, cutoverSessionId);
    if (latest?.status === 'failed' && readLegacyNotesCutoverFence() === null) return latest;
    throw localDatabaseError(error, 'recover_precommit_fence_terminal');
  }
}

function cutoverResult(session: LocalFirstCutoverSessionV1): LocalFirstCutoverResult {
  return {
    cutoverSessionId: session.cutoverSessionId,
    migrationSessionId: session.plan.migrationSessionId,
    activeGenerationId: session.plan.targetGenerationId,
    mode: 'local_first',
    status: session.status === 'confirmed' ? 'confirmed' : 'activated',
    entityCount: session.plan.targetEntryCount,
    manifestDigest: session.plan.targetManifestDigest,
    targetStateDigest: session.plan.targetStateDigest,
  };
}

export async function confirmLocalFirstCutover(
  runtime: LocalFirstCutoverRuntime,
  adapter: LegacyNotesSourceAdapter,
  cutoverSessionId: string,
  authorization: RecoveryCutoverAuthorization,
  atValue?: string,
): Promise<LocalFirstCutoverResult> {
  runtime.assertOpen('confirm_local_first_cutover');
  const at = timestamp(atValue ?? runtime.clock());
  const before = await readSession(runtime, cutoverSessionId);
  if (!before) fail('CUTOVER_SESSION_CONFLICT', 'confirm_cutover_session');
  assertAuthorization(runtime, cutoverSessionId, before.plan.targetGenerationId, authorization);
  if (!['activated', 'confirmed'].includes(before.status)) fail('CUTOVER_CONFIRMATION_FAILED', 'confirm_cutover_status');
  if (before.fence?.phase !== 'committed') fail('CORRUPT_PERSISTED_RECORD', 'confirm_cutover_fence');
  const physicalFence = readLegacyNotesCutoverFence();
  if (physicalFence === null || physicalFence === 'corrupt'
    || !sameLegacyCutoverFenceIdentity(physicalFence, before.fence.identity)) {
    fail('CUTOVER_FENCE_INSTANCE_MISMATCH', 'confirm_cutover_fence');
  }
  const sourceEvidence = await validateLegacyNotesSourceUnchangedForCutover(runtime, adapter, before.plan.migrationSessionId);
  assertEvidenceMatchesPlan(sourceEvidence, before.plan);

  const stores = [
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
    LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.syncCheckpoints, LOCAL_DATABASE_STORES.migrationState,
  ];
  const tx = runtime.db.transaction(stores, 'readwrite');
  const done = transactionCompletion(tx, 'confirm_local_first_cutover');
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
    const modeRaw = await requestResult(store.get(modeKey(runtime.namespaceKey)));
    if (raw === undefined || modeRaw === undefined) fail('CORRUPT_PERSISTED_RECORD', 'confirm_cutover_graph');
    const current = persistedSession(raw, runtime); const mode = persistedMode(modeRaw, runtime);
    const evidence = await validateVerifiedLegacyNotesCutoverEvidenceInTransaction(
      runtime, tx, current.plan.migrationSessionId, 'active',
    );
    assertEvidenceMatchesPlan(evidence, current.plan);
    if (!['activated', 'confirmed'].includes(current.status) || mode.mode !== 'local_first'
      || mode.activeGenerationId !== current.plan.targetGenerationId
      || mode.cutoverSessionId !== current.cutoverSessionId || mode.targetGenerationId !== current.plan.targetGenerationId) {
      fail('CORRUPT_PERSISTED_RECORD', 'confirm_cutover_graph');
    }
    let confirmed = current;
    if (current.status === 'activated') {
      confirmed = { ...current, status: 'confirmed', updatedAt: at, confirmedAt: at };
      persistedSession(toPersistedSession(confirmed), runtime); store.put(toPersistedSession(confirmed));
    }
    await done;
    try { advanceLegacyNotesCutoverFence(authorization, before.fence.identity, 'confirmed'); }
    catch { fail('CUTOVER_CONFIRMATION_FAILED', 'confirm_cutover_fence'); }
    return cutoverResult(confirmed);
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'confirm_local_first_cutover');
  }
}

export async function activateLocalFirstCutover(
  runtime: LocalFirstCutoverRuntime,
  adapter: LegacyNotesSourceAdapter,
  cutoverSessionId: string,
  options: ActivateLocalFirstCutoverOptions,
): Promise<LocalFirstCutoverResult> {
  runtime.assertOpen('activate_local_first_cutover');
  const at = timestamp(options.now ?? runtime.clock());
  let session = await readSession(runtime, cutoverSessionId);
  if (!session) fail('CUTOVER_SESSION_CONFLICT', 'activate_cutover_session');
  assertAuthorization(runtime, cutoverSessionId, session.plan.targetGenerationId, options.authorization);
  if (session.status === 'confirmed' || session.status === 'activated') {
    return confirmLocalFirstCutover(runtime, adapter, cutoverSessionId, options.authorization, at);
  }
  if (session.status === 'planned') {
    try {
      session = await preflightLocalFirstCutover(runtime, adapter, cutoverSessionId, options.authorization, at);
    } catch (error) {
      const code = error instanceof LocalDatabaseError ? error.code : 'CUTOVER_PRECONDITION_FAILED';
      if (['MIGRATION_SOURCE_CHANGED', 'LEGACY_SOURCE_AUTHORITY_REQUIRED', 'LEGACY_SOURCE_AUTHORITY_REVOKED',
        'LEGACY_SOURCE_IDENTITY_MISMATCH'].includes(code)) {
        await markFailedIfSafe(runtime, cutoverSessionId, code as LocalFirstCutoverFailureCode, at);
      }
      throw error;
    }
  }
  if (session.status === 'preflight') session = await transitionToActivating(runtime, cutoverSessionId, at);
  if (session.status === 'cancelled') fail('CUTOVER_CANCELLED', 'activate_cutover_status');
  if (session.status !== 'activating') fail('CUTOVER_SESSION_CONFLICT', 'activate_cutover_status');
  session = await installCutoverFence(runtime, cutoverSessionId, options.authorization, at);

  try {
    await verifyLegacyNotesMigration(runtime, adapter, session.plan.migrationSessionId, at);
    const currentSource = await readVerifiedLegacyNotesCutoverEvidence(runtime, session.plan.migrationSessionId, 'inactive');
    assertEvidenceMatchesPlan(currentSource, session.plan);
  } catch (error) {
    const latest = await readSession(runtime, cutoverSessionId);
    if (latest && ['activated', 'confirmed'].includes(latest.status)) {
      return confirmLocalFirstCutover(runtime, adapter, cutoverSessionId, options.authorization, at);
    }
    const code = error instanceof LocalDatabaseError ? error.code : 'CUTOVER_PRECONDITION_FAILED';
    if (['MIGRATION_SOURCE_CHANGED', 'LEGACY_SOURCE_AUTHORITY_REQUIRED', 'LEGACY_SOURCE_AUTHORITY_REVOKED',
      'LEGACY_SOURCE_IDENTITY_MISMATCH'].includes(code)) {
      await markFailedIfSafe(runtime, cutoverSessionId, code as LocalFirstCutoverFailureCode, at, true);
      try {
        await recoverFailedPrecommitCutoverFence(runtime, cutoverSessionId, options.authorization, at);
      } catch { /** durable failed-precommit phase remains retryable and fail-closed */ }
    }
    throw error;
  }
  if (options.testOnlyFailAt === 'before_activation_transaction') {
    fail('TRANSACTION_FAILED', 'before_cutover_activation_transaction');
  }

  const stores = [
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.entities,
    LOCAL_DATABASE_STORES.outbox, LOCAL_DATABASE_STORES.syncCheckpoints, LOCAL_DATABASE_STORES.migrationState,
    LOCAL_DATABASE_STORES.restoreSessions,
  ];
  const tx = runtime.db.transaction(stores, 'readwrite');
  const done = transactionCompletion(tx, 'activate_local_first_cutover');
  let activated: LocalFirstCutoverSessionV1;
  try {
    const migrationStore = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(migrationStore.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
    if (raw === undefined) fail('CORRUPT_PERSISTED_RECORD', 'activate_cutover_graph');
    const current = persistedSession(raw, runtime);
    if (current.status !== 'activating' || current.fence?.phase !== 'installed'
      || canonical(current.plan) !== canonical(session.plan)) {
      fail('CUTOVER_SESSION_CONFLICT', 'activate_cutover_session');
    }
    const evidence = await validateVerifiedLegacyNotesCutoverEvidenceInTransaction(
      runtime, tx, current.plan.migrationSessionId, 'inactive',
    );
    assertEvidenceMatchesPlan(evidence, current.plan);
    assertNoActiveRestore(await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.restoreSessions).getAll()) as unknown[], runtime.namespaceKey);
    const allMigrationValues = await requestResult(migrationStore.getAll()) as unknown[];
    assertNoCompetingCutover(allMigrationValues, runtime, cutoverSessionId);
    const localFirstMode = buildModeRecord({
      namespaceKey: runtime.namespaceKey, mode: 'local_first', activeGenerationId: current.plan.targetGenerationId,
      cutoverSessionId, targetGenerationId: current.plan.targetGenerationId, updatedAt: at, activatedAt: at,
    });
    await transitionActiveGenerationInTransaction({
      transaction: tx,
      runtime,
      kind: 'cutover',
      expectedActiveGenerationId: current.plan.expectedPredecessorGenerationId,
      targetGenerationId: current.plan.targetGenerationId,
      activatedAt: at,
      nextCutoverMode: localFirstMode,
      validateRecords: (_predecessor, target) => {
        if (target.predecessorGenerationId !== null || target.creationReason !== 'migration'
          || target.safeSourceReference?.kind !== 'legacy_migration'
          || target.safeSourceReference.reference !== current.plan.migrationSessionId) {
          fail('CUTOVER_PRECONDITION_FAILED', 'activate_cutover_generation');
        }
      },
      afterPointerWrite: () => {
        if (options.testOnlyFailAt === 'pointer_write') fail('TRANSACTION_FAILED', 'cutover_pointer_write');
      },
      afterModeWrite: () => {
        if (options.testOnlyFailAt === 'mode_write') fail('TRANSACTION_FAILED', 'cutover_mode_write');
      },
    });
    activated = { ...current, status: 'activated', updatedAt: at, activatedAt: at, confirmedAt: null, failure: null,
      fence: { ...current.fence, phase: 'committed' } };
    persistedSession(toPersistedSession(activated), runtime); migrationStore.put(toPersistedSession(activated));
    if (options.testOnlyFailAt === 'session_transition') fail('TRANSACTION_FAILED', 'cutover_session_transition');
    if (options.testOnlyFailAt === 'transaction_completion') {
      tx.abort(); fail('TRANSACTION_FAILED', 'cutover_transaction_completion');
    }
    await done;
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined);
    const latest = await readSession(runtime, cutoverSessionId);
    if (latest && ['activated', 'confirmed'].includes(latest.status)) {
      return confirmLocalFirstCutover(runtime, adapter, cutoverSessionId, options.authorization, at);
    }
    throw localDatabaseError(error, 'activate_local_first_cutover');
  }
  try { advanceLegacyNotesCutoverFence(options.authorization, activated.fence!.identity, 'activated'); }
  catch { fail('CUTOVER_RECOVERY_AUTHORIZATION_REQUIRED', 'activate_cutover_fence_commit'); }
  if (options.testOnlyFailAt === 'after_activation_commit') fail('TRANSACTION_FAILED', 'after_cutover_activation_commit');
  return confirmLocalFirstCutover(runtime, adapter, cutoverSessionId, options.authorization, at);
}

export async function resumeLocalFirstCutover(
  runtime: LocalFirstCutoverRuntime,
  adapter: LegacyNotesSourceAdapter,
  cutoverSessionId: string,
  options: ActivateLocalFirstCutoverOptions,
): Promise<LocalFirstCutoverResult> {
  const session = await readSession(runtime, cutoverSessionId);
  if (!session) fail('CUTOVER_SESSION_CONFLICT', 'resume_cutover_session');
  if (session.status === 'cancelled') fail('CUTOVER_CANCELLED', 'resume_cutover_status');
  if (['failed_precommit_fenced', 'failed_precommit_releasing'].includes(session.status)) {
    fail('CUTOVER_FENCE_RECOVERY_REQUIRED', 'resume_cutover_status');
  }
  if (session.status === 'failed') fail('CUTOVER_SESSION_CONFLICT', 'resume_cutover_status');
  return activateLocalFirstCutover(runtime, adapter, cutoverSessionId, options);
}

export async function cancelLocalFirstCutover(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
  authorization: RecoveryCutoverAuthorization,
  atValue?: string,
): Promise<LocalFirstCutoverSessionV1> {
  runtime.assertOpen('cancel_local_first_cutover');
  const at = timestamp(atValue ?? runtime.clock());
  const before = await readSession(runtime, cutoverSessionId);
  if (!before) fail('CUTOVER_SESSION_CONFLICT', 'cancel_cutover_session');
  assertAuthorization(runtime, cutoverSessionId, before.plan.targetGenerationId, authorization);
  if (['activated', 'confirmed'].includes(before.status)) fail('CUTOVER_ALREADY_ACTIVATED', 'cancel_cutover_status');
  if (['failed_precommit_fenced', 'failed_precommit_releasing'].includes(before.status)) {
    return recoverFailedPrecommitCutoverFence(runtime, cutoverSessionId, authorization, at);
  }
  if (before.status === 'activating' && before.fence !== null) {
    await installCutoverFence(runtime, cutoverSessionId, authorization, at);
    await markFailedIfSafe(runtime, cutoverSessionId, 'CUTOVER_CANCELLED', at, true);
    return recoverFailedPrecommitCutoverFence(runtime, cutoverSessionId, authorization, at);
  }
  if (before.status === 'failed') fail('CUTOVER_SESSION_CONFLICT', 'cancel_cutover_status');

  const tx = runtime.db.transaction([LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.migrationState], 'readwrite');
  const done = transactionCompletion(tx, 'cancel_local_first_cutover');
  let cancelled: LocalFirstCutoverSessionV1;
  try {
    const store = tx.objectStore(LOCAL_DATABASE_STORES.migrationState);
    const raw = await requestResult(store.get(cutoverKey(runtime.namespaceKey, cutoverSessionId)));
    const modeRaw = await requestResult(store.get(modeKey(runtime.namespaceKey)));
    const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
    if (raw === undefined || modeRaw === undefined || !meta) fail('CORRUPT_PERSISTED_RECORD', 'cancel_cutover_graph');
    const current = persistedSession(raw, runtime); const mode = persistedMode(modeRaw, runtime);
    if (mode.mode !== 'legacy' || meta.activeGenerationId !== current.plan.expectedPredecessorGenerationId) {
      fail('CUTOVER_ALREADY_ACTIVATED', 'cancel_cutover_graph');
    }
    if (current.status === 'cancelled') { await done; cancelled = current; }
    else {
      if (!['planned', 'preflight', 'activating'].includes(current.status)) fail('CUTOVER_SESSION_CONFLICT', 'cancel_cutover_status');
      cancelled = { ...current, status: 'cancelled', updatedAt: at,
        failure: { code: 'CUTOVER_CANCELLED', context: 'operator_cancelled' } };
      persistedSession(toPersistedSession(cancelled), runtime); store.put(toPersistedSession(cancelled)); await done;
    }
  } catch (error) {
    abortQuietly(tx); await done.catch(() => undefined); throw localDatabaseError(error, 'cancel_local_first_cutover');
  }
  if (readLegacyNotesCutoverFence() !== null) {
    fail('CUTOVER_FENCE_OWNERSHIP_CONFLICT', 'cancel_cutover_fence');
  }
  return cancelled;
}

export async function getLocalFirstCutoverSession(
  runtime: LocalFirstCutoverRuntime,
  cutoverSessionId: string,
): Promise<LocalFirstCutoverSessionV1 | null> {
  runtime.assertOpen('get_local_first_cutover_session');
  validateLogicalCutoverId(cutoverSessionId);
  return readSession(runtime, cutoverSessionId);
}

export async function getLocalFirstRuntimeMode(
  runtime: LocalFirstCutoverRuntime,
): Promise<LocalFirstRuntimeModeRecordV1 | null> {
  runtime.assertOpen('get_local_first_runtime_mode');
  const tx = runtime.db.transaction([
    LOCAL_DATABASE_STORES.databaseMeta, LOCAL_DATABASE_STORES.generations, LOCAL_DATABASE_STORES.migrationState,
  ], 'readonly');
  const done = transactionCompletion(tx, 'get_local_first_runtime_mode');
  const raw = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.migrationState).get(modeKey(runtime.namespaceKey)));
  const meta = await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.databaseMeta).get(runtime.namespaceKey)) as DatabaseMetaRecord | undefined;
  const active = meta ? await requestResult(tx.objectStore(LOCAL_DATABASE_STORES.generations).get([
    runtime.namespaceKey, meta.activeGenerationId,
  ])) as GenerationRecord | undefined : undefined;
  await done;
  if (!meta) fail('CORRUPT_PERSISTED_RECORD', 'get_cutover_runtime_mode');
  try { validateDatabaseMeta(meta, runtime.namespaceKey, runtime.namespace.schemaVersion); }
  catch { fail('CORRUPT_PERSISTED_RECORD', 'get_cutover_runtime_mode'); }
  try {
    if (!active) throw new Error('missing');
    validateGenerationRecord(active, runtime.namespaceKey, runtime.namespace.schemaVersion);
  } catch { fail('CORRUPT_PERSISTED_RECORD', 'get_cutover_runtime_mode'); }
  if (active.status !== 'active' || active.activeNamespaceKey !== runtime.namespaceKey) {
    fail('CORRUPT_PERSISTED_RECORD', 'get_cutover_runtime_mode');
  }
  if (raw === undefined) {
    if (active.creationReason === 'migration' && active.safeSourceReference?.kind === 'legacy_migration') {
      fail('CORRUPT_PERSISTED_RECORD', 'get_cutover_runtime_mode');
    }
    return null;
  }
  const mode = persistedMode(raw, runtime);
  if (mode.activeGenerationId !== meta.activeGenerationId) fail('CORRUPT_PERSISTED_RECORD', 'get_cutover_runtime_mode');
  return publicMode(mode);
}
