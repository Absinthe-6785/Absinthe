export const LOCAL_DATABASE_NAME = 'absinthe-local-v2';
export const LOCAL_DATABASE_VERSION = 5;
export const LOCAL_SCHEMA_VERSION = 1;

export type LocalDatabaseNamespace = Readonly<{
  userId: string;
  projectRef: string;
  deviceId: string;
  generationId: string;
  schemaVersion: number;
}>;

export type GenerationStatus = 'preparing' | 'active' | 'sealed' | 'abandoned' | 'failed';
export type GenerationReason = 'initial' | 'migration' | 'restore' | 'recovery' | 'test';
export type ValidationState = 'pending' | 'valid' | 'invalid';

export type SafeSourceReference = Readonly<{
  kind: 'local' | 'remote' | 'backup' | 'snapshot' | 'recovery_package' | 'legacy_migration' | 'test';
  reference: string;
}>;

export interface DatabaseMetaRecord {
  namespaceKey: string;
  databaseFormatVersion: number;
  namespaceFingerprint: string;
  activeGenerationId: string;
  createdAt: string;
  minimumCompatibleSchemaVersion: number;
  recoveryCompatible: boolean;
  migrationStatePointer: string | null;
  schemaVersion: number;
}

export interface GenerationRecord {
  namespaceKey: string;
  generationId: string;
  status: GenerationStatus;
  createdAt: string;
  activatedAt: string | null;
  predecessorGenerationId: string | null;
  creationReason: GenerationReason;
  schemaVersion: number;
  validationState: ValidationState;
  safeSourceReference: SafeSourceReference | null;
  activeNamespaceKey?: string;
}

export interface LocalEntityEnvelope<T = unknown> {
  namespaceKey: string;
  generationId: string;
  /** The authenticated account authority. Legacy v1-v4 rows may omit this during read-only upgrade. */
  accountId?: string;
  domain: string;
  entityId: string;
  record: T;
  revision: number;
  /** Durable sync-core name for revision. It is always equal to `revision` on v5 writes. */
  localRevision?: number;
  serverRevision?: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
  deletionState: 'active' | 'deleted';
  ownerId: string | null;
  contentHash: string | null;
  pendingMutationId?: string | null;
  lastRemoteMutationRef?: string | null;
  source: SafeSourceReference | null;
  restoreProvenance?: RestoreProvenance | null;
  migrationProvenance?: LegacyMigrationProvenance | null;
}

export interface LegacyMigrationProvenance {
  conversionVersion: 1;
  sourceAdapter: string;
  sourceSchemaVersion: number | null;
  migrationSessionId: string;
  sourceSnapshotDigest: string;
  migratedAt: string;
  legacyKeyDigest: string;
}

export type RestoreClassification = 'insert' | 'replace' | 'skip_identical' | 'conflict' | 'resurrect' | 'preserve_local';

export interface ResurrectionProvenance {
  restoresEntityId: string;
  sourcePackageId: string;
  sourceRestoreSessionId: string;
  supersedesTombstoneRevision: number | null;
  restoredAt: string;
}

export interface RestoreProvenance {
  packageId: string;
  restoreSessionId: string;
  classification: RestoreClassification;
  sourceRevision: number | null;
  sourceUpdatedAt: string | null;
  sourceDeletedAt: string | null;
  expectedLocalRevision: number | null;
  restoredAt: string;
  mutationId: string | null;
  resurrection: ResurrectionProvenance | null;
}

export type OutboxOperation = 'upsert' | 'tombstone' | 'restore';
export type OutboxStatus = 'pending' | 'claimed' | 'retry_wait' | 'acknowledged' | 'conflict' | 'permanent_failure' | 'superseded';

/** G2's explicit dormant state. Missing deliveryBinding remains legacy behavior. */
export interface UnboundDeliveryBindingV1 {
  version: 1;
  state: 'unbound';
}

export interface RestoreOutboxGenerationBoundary {
  kind: 'restore_generation_sequence_boundary';
  namespaceKey: string;
  sourceGenerationId: string;
  targetGenerationId: string;
  domain: string;
  entityId: string;
  sourceRevision: number;
  targetRevision: number;
  restoreSessionId: string;
  packageId: string;
  packageDigest: string;
  classification: 'replace' | 'resurrect';
  createdAt: string;
}

export interface RemoteOutboxSequenceBoundary {
  kind: 'remote_entity_sequence_boundary';
  namespaceKey: string;
  generationId: string;
  domain: string;
  entityId: string;
  baselineLocalRevision: number;
  baselineServerRevision: number;
  remoteMutationRef: string;
  baselineContentHash: string;
  createdAt: string;
}

export interface OutboxRecord {
  namespaceKey: string;
  generationId: string;
  accountId?: string;
  deviceId?: string;
  mutationId: string;
  domain: string;
  entityId: string;
  operation: OutboxOperation;
  baseRevision: number | null;
  localRevision: number;
  payloadMode: 'inline';
  payload: Readonly<
    | { kind: 'entity_snapshot'; record: unknown }
    | { kind: 'tombstone'; entityId: string; deletedAt: string; revision: number }
  >;
  payloadHash: string | null;
  createdAt: string;
  updatedAt: string;
  availableAt: string;
  attemptCount: number;
  status: OutboxStatus;
  idempotencyKey: string;
  lastAttemptAt: string | null;
  lastErrorCode: string | null;
  leaseOwner: string | null;
  leaseExpiresAt: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  remoteMutationRef: string | null;
  acknowledgedRevision?: number | null;
  serverCommittedAt?: string | null;
  supersededByMutationId: string | null;
  /** A durable delivery prerequisite. The record is not claimable until this mutation is acknowledged. */
  dependsOnMutationId?: string | null;
  resurrection?: ResurrectionProvenance | null;
  deliveryBlockCode?: 'REMOTE_RESURRECTION_UNSUPPORTED' | 'UNBOUND_ATTEMPT_QUARANTINED' | null;
  /** Absent on REL-05D/E/F rows; only new dormant G2 workout rows set this. */
  deliveryBinding?: UnboundDeliveryBindingV1;
  generationBoundary?: RestoreOutboxGenerationBoundary | null;
  remoteSequenceBoundary?: RemoteOutboxSequenceBoundary | null;
}

export interface SyncCheckpointRecord {
  namespaceKey: string;
  generationId: string;
  accountId?: string;
  provider: string;
  stream: string;
  checkpointValue: string;
  sequence?: number;
  serverEpoch: string | null;
  updatedAt: string;
  invalidatedAt?: string | null;
  invalidationReason?: string | null;
}

export type ConflictResolutionState = 'unresolved' | 'resolved_local' | 'resolved_remote' | 'resolved_merged' | 'dismissed';

export interface SyncConflictRecord {
  namespaceKey: string;
  generationId: string;
  accountId: string;
  conflictId: string;
  domain: string;
  entityId: string;
  mutationId: string | null;
  localCandidate: unknown;
  remoteCandidate: unknown;
  remoteMetadata: Readonly<Record<string, unknown>> | null;
  localRevision: number;
  serverRevision: number | null;
  localContentHash: string;
  remoteContentHash: string | null;
  conflictType: string;
  createdAt: string;
  resolutionState: ConflictResolutionState;
  resolvedAt: string | null;
}

export interface SyncWorkerLeaseRecord {
  namespaceKey: string;
  generationId: string;
  accountId: string;
  leaseName: string;
  ownerId: string;
  leaseToken: string;
  leaseEpoch: number;
  acquiredAt: string;
  renewedAt: string;
  expiresAt: string;
  releasedAt: string | null;
}

export type RestoreSessionStatus = 'created' | 'validating' | 'staged' | 'committing' | 'committed' | 'failed' | 'cancelled';
export interface RestoreSummary { inserted: number; replaced: number; skipped: number; resurrected: number; conflicts: number }
export type RestoreApplicationClassification = 'insert' | 'replace' | 'resurrect' | 'skip_identical' | 'preserve_local' | 'conflict';
export interface RestoreApplicationEntryV1 {
  domain: 'notes';
  entityId: string;
  classification: RestoreApplicationClassification;
  sourceRevision: number | null;
  targetRevision: number | null;
  expectedEntityDigest: string | null;
  expectedProvenanceDigest: string | null;
  requiresOutbox: boolean;
  expectedMutationId: string | null;
  expectedIdempotencyKey: string | null;
  expectedOperation: 'upsert' | 'tombstone' | null;
  requiresSequenceBoundary: boolean;
}
export interface RestoreApplicationManifestV1 {
  version: 1;
  restoreSessionId: string;
  packageId: string;
  packageDigest: string;
  namespaceKey: string;
  sourceGenerationId: string;
  targetGenerationId: string;
  entries: RestoreApplicationEntryV1[];
  entryCount: number;
  stagedEntityCount: number;
  stagedSetDigest: string;
  manifestDigest: string;
}
export interface RestoreBlockingState {
  code: 'RESTORE_UNSETTLED_OUTBOX_CONFLICT';
  detectedAt: string;
  attemptCount: number;
}

export interface RestoreSessionRecord {
  namespaceKey: string;
  sessionId: string;
  packageId: string;
  protocolVersion: 1;
  expectedActiveGenerationId: string;
  sourceGenerationId: string | null;
  stagingGenerationId: string;
  targetGenerationId: string | null;
  status: RestoreSessionStatus;
  packageDigest: string;
  entityCount: number;
  createdAt: string;
  updatedAt: string;
  committedAt: string | null;
  failedAt: string | null;
  failureCode: string | null;
  blockingState: RestoreBlockingState | null;
  applicationManifest: RestoreApplicationManifestV1 | null;
  summary: RestoreSummary;
}

export interface MigrationStateRecord {
  namespaceKey: string;
  migrationId: string;
  sourceDatabase: string;
  sourceSchemaVersion: number;
  targetDatabase: string;
  targetSchemaVersion: number;
  sourceGenerationId: string;
  expectedActiveGenerationId: string;
  targetGenerationId: string;
  phase: string;
  lastDurableStep: string;
  counts: Readonly<Record<string, number>>;
  verificationState: ValidationState;
  rollbackEligibility: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AttachmentStateRecord {
  namespaceKey: string;
  generationId: string;
  attachmentId: string;
  referencedBy: string[];
  localAvailability: string;
  remoteAvailability: string;
  checksumState: string;
  syncState: string;
  storageLocatorReference: string | null;
  createdAt: string;
  updatedAt: string;
}

interface EntityMutationCommon<T = unknown> {
  domain: string;
  entityId: string;
  record: T;
  ownerId?: string | null;
  contentHash?: string | null;
  source?: SafeSourceReference | null;
  timestamp?: string;
}

export interface EntityCreateInput<T = unknown> extends EntityMutationCommon<T> {
  mode: 'create';
}

export interface EntityUpdateInput<T = unknown> extends EntityMutationCommon<T> {
  mode: 'update';
  expectedRevision: number;
}

export interface EntityTombstoneInput {
  mode: 'tombstone';
  domain: string;
  entityId: string;
  record: null;
  expectedRevision: number;
  timestamp?: string;
}

export interface EntityRestoreInput<T = unknown> extends EntityMutationCommon<T> {
  mode: 'restore';
  expectedRevision: number;
}

export type EntityMutationInput<T = unknown> = EntityCreateInput<T> | EntityUpdateInput<T> | EntityTombstoneInput | EntityRestoreInput<T>;

export interface EntityListOptions {
  domain: string;
  includeDeleted?: boolean;
}

export interface CommitLocalMutationInput<T = unknown> {
  mutation: EntityMutationInput<T>;
  now: string;
  dependsOnMutationId?: string | null;
  deliveryBinding?: UnboundDeliveryBindingV1;
  testOnlyAbortAt?: 'before_entity' | 'before_outbox' | 'after_writes';
}

export interface CommittedLocalMutation<T = unknown> {
  entity: LocalEntityEnvelope<T>;
  outbox: OutboxRecord;
}

export interface ReconcileOutboxPrerequisiteInput<T = unknown> {
  prerequisiteMutationId: string;
  prerequisiteStatus: 'conflict' | 'acknowledged';
  expectedEntityRevision: number;
  correctedRecord: T;
  remoteRecord: T;
  remoteServerRevision: number;
  remoteMutationRef: string;
  now: string;
}

export interface ReconciledOutboxPrerequisite<T = unknown> {
  prerequisite: OutboxRecord;
  replacement: OutboxRecord;
  entity: LocalEntityEnvelope<T>;
  dependents: OutboxRecord[];
}

export interface ClaimOutboxInput {
  workerId: string;
  now: string;
  leaseDurationMs: number;
  limit: number;
  recoverExpiredClaims?: boolean;
  /** Domains selected before the batch limit, in dependency priority order. */
  priorityDomains?: readonly string[];
  /** Apply domain priority only when this operation exists in the full eligible set. */
  priorityTriggerOperation?: OutboxOperation;
}

export interface RetryOutboxInput {
  mutationId: string;
  workerId: string;
  now: string;
  errorCode: string;
  baseDelayMs: number;
  maxDelayMs: number;
}

export interface AcknowledgeOutboxInput {
  mutationId: string;
  workerId: string;
  now: string;
  remoteMutationRef?: string | null;
  acknowledgedRevision?: number | null;
  serverCommittedAt?: string | null;
}

export interface FailOutboxInput {
  mutationId: string;
  workerId: string;
  now: string;
  errorCode: string;
}

export interface ResetOutboxInput { mutationId: string; now: string }

export interface OutboxListInput {
  status?: OutboxStatus;
  domain?: string;
  entityId?: string;
  limit: number;
}

export interface AdvanceCheckpointInput {
  provider: string;
  stream: string;
  checkpointValue: string;
  sequence: number;
  serverEpoch: string | null;
  now: string;
  testOnlyAbort?: boolean;
}

export interface DurableRemoteEntityApply<T = unknown> {
  expectedLocalRevision: number | null;
  entity: LocalEntityEnvelope<T>;
}

export interface CommitRemoteEntityBatchInput<T = unknown> {
  namespaceKey: string;
  generationId: string;
  accountId: string;
  domain: string;
  provider: string;
  checkpointValue: string;
  sequence: number;
  serverEpoch: string | null;
  now: string;
  entities: ReadonlyArray<DurableRemoteEntityApply<T>>;
  testOnlyAbortAt?: 'before_checkpoint' | 'after_checkpoint';
}

export interface RemoteConvergenceCandidate<T = unknown> {
  entityId: string;
  record: T;
  serverRevision: number;
  remoteMutationRef: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  ownerId?: string | null;
  source?: SafeSourceReference | null;
}

export interface RemoteConvergenceApply<T = unknown> {
  expectedLocalRevision: number | null;
  candidate: RemoteConvergenceCandidate<T>;
}

export interface CommitRemoteConvergenceBatchInput<T = unknown> {
  namespaceKey: string;
  generationId: string;
  accountId: string;
  domain: string;
  provider: string;
  checkpointValue: string;
  sequence: number;
  serverEpoch: string | null;
  now: string;
  changes: ReadonlyArray<RemoteConvergenceApply<T>>;
  testOnlyAbortAt?: 'before_checkpoint' | 'after_checkpoint';
}

export interface CommittedRemoteConvergenceBatch<T = unknown> {
  entities: LocalEntityEnvelope<T>[];
  conflicts: SyncConflictRecord[];
  checkpoint: SyncCheckpointRecord;
}

export interface CommittedRemoteEntityBatch<T = unknown> {
  entities: LocalEntityEnvelope<T>[];
  checkpoint: SyncCheckpointRecord;
}

export interface InvalidateCheckpointInput {
  provider: string;
  stream: string;
  reason: string;
  now: string;
}

export interface RecordConflictInput {
  conflictId: string;
  mutationId?: string | null;
  domain: string;
  entityId: string;
  localCandidate: unknown;
  remoteCandidate: unknown;
  remoteMetadata?: Readonly<Record<string, unknown>> | null;
  localRevision: number;
  serverRevision?: number | null;
  conflictType: string;
  now: string;
}

export interface ResolveConflictInput {
  conflictId: string;
  resolutionState: Exclude<ConflictResolutionState, 'unresolved'>;
  now: string;
}

export interface WorkerLeaseInput {
  leaseName: string;
  ownerId: string;
  now: string;
  durationMs: number;
}

export interface RenewWorkerLeaseInput extends WorkerLeaseInput { leaseToken: string }

export interface ReleaseWorkerLeaseInput {
  leaseName: string;
  ownerId: string;
  leaseToken: string;
  now: string;
}

export type OutboxStatusCounts = Readonly<Record<OutboxStatus, number>>;
