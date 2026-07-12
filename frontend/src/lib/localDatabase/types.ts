export const LOCAL_DATABASE_NAME = 'absinthe-local-v2';
export const LOCAL_DATABASE_VERSION = 2;
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
  kind: 'local' | 'remote' | 'backup' | 'snapshot' | 'recovery_package' | 'test';
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
  domain: string;
  entityId: string;
  record: T;
  revision: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  isDeleted: boolean;
  deletionState: 'active' | 'deleted';
  ownerId: string | null;
  contentHash: string | null;
  source: SafeSourceReference | null;
}

export type OutboxOperation = 'upsert' | 'tombstone';
export type OutboxStatus = 'pending' | 'claimed' | 'retry_wait' | 'acknowledged' | 'permanent_failure' | 'superseded';

export interface OutboxRecord {
  namespaceKey: string;
  generationId: string;
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
  supersededByMutationId: string | null;
}

export interface SyncCheckpointRecord {
  namespaceKey: string;
  generationId: string;
  provider: string;
  stream: string;
  checkpointValue: string;
  serverEpoch: string | null;
  updatedAt: string;
}

export interface RestoreSessionRecord {
  namespaceKey: string;
  sessionId: string;
  expectedActiveGenerationId: string;
  sourceGenerationId: string;
  targetGenerationId: string;
  status: 'preparing' | 'validating' | 'ready' | 'committed' | 'failed' | 'abandoned';
  packageFingerprint: string;
  validationResult: ValidationState;
  startedAt: string;
  committedAt: string | null;
  failureCode: string | null;
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

export type EntityMutationInput<T = unknown> = EntityCreateInput<T> | EntityUpdateInput<T> | EntityTombstoneInput;

export interface EntityListOptions {
  domain: string;
  includeDeleted?: boolean;
}

export interface CommitLocalMutationInput<T = unknown> {
  mutation: EntityMutationInput<T>;
  now: string;
  testOnlyAbortAt?: 'before_entity' | 'before_outbox' | 'after_writes';
}

export interface CommittedLocalMutation<T = unknown> {
  entity: LocalEntityEnvelope<T>;
  outbox: OutboxRecord;
}

export interface ClaimOutboxInput {
  workerId: string;
  now: string;
  leaseDurationMs: number;
  limit: number;
  recoverExpiredClaims?: boolean;
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

export type OutboxStatusCounts = Readonly<Record<OutboxStatus, number>>;
