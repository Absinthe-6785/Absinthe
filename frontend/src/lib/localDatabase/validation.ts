import { LocalDatabaseError } from './errors';
import { validateSafeIdentifier } from './namespace';
import type {
  AttachmentStateRecord, DatabaseMetaRecord, GenerationRecord, LocalEntityEnvelope, MigrationStateRecord, OutboxRecord,
  RestoreSessionRecord, SafeSourceReference, SyncCheckpointRecord,
} from './types';

const SAFE_CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SENSITIVE = /(?:https?:\/\/|[?#\\/]|bearer|token|cookie|password|secret|authorization|eyJ)/i;

export function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

export function validateDatabaseMeta(value: DatabaseMetaRecord, namespaceKey: string, schemaVersion: number): void {
  if (!value || value.namespaceKey !== namespaceKey || value.namespaceFingerprint !== namespaceKey
    || value.databaseFormatVersion !== 1 || value.schemaVersion !== schemaVersion
    || value.minimumCompatibleSchemaVersion !== 1 || value.recoveryCompatible !== true
    || !SAFE_CODE.test(value.activeGenerationId) || !validTimestamp(value.createdAt)
    || (value.migrationStatePointer !== null && !SAFE_CODE.test(value.migrationStatePointer))) {
    throw new LocalDatabaseError('MALFORMED_METADATA', 'validate_metadata');
  }
}

export function validateGenerationRecord(value: GenerationRecord, namespaceKey: string, schemaVersion: number): void {
  if (!value || value.namespaceKey !== namespaceKey || value.schemaVersion !== schemaVersion
    || !SAFE_CODE.test(value.generationId)
    || !['preparing', 'active', 'sealed', 'abandoned', 'failed'].includes(value.status)
    || !['initial', 'migration', 'restore', 'recovery', 'test'].includes(value.creationReason)
    || !['pending', 'valid', 'invalid'].includes(value.validationState)
    || !validTimestamp(value.createdAt) || (value.activatedAt !== null && !validTimestamp(value.activatedAt))
    || (value.status === 'active') !== (value.activeNamespaceKey === namespaceKey)) {
    throw new LocalDatabaseError('MALFORMED_METADATA', 'validate_generation');
  }
  validateSafeSource(value.safeSourceReference);
}

export function validateSafeSource(source: SafeSourceReference | null | undefined): void {
  if (source == null) return;
  if (!['local', 'remote', 'backup', 'snapshot', 'recovery_package', 'test'].includes(source.kind)
    || !SAFE_CODE.test(source.reference) || SENSITIVE.test(source.reference)) {
    throw new LocalDatabaseError('INVALID_ENTITY', 'validate_source');
  }
}

export function validateEntityEnvelope(value: LocalEntityEnvelope): void {
  validateSafeIdentifier(value.domain, 'validate_entity');
  if (typeof value.entityId !== 'string' || value.entityId.length === 0 || value.entityId.length > 512 || SENSITIVE.test(value.entityId)) {
    throw new LocalDatabaseError('INVALID_ENTITY', 'validate_entity');
  }
  if (!Number.isSafeInteger(value.revision) || value.revision < 1
    || !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt)
    || (value.deletedAt !== null && !validTimestamp(value.deletedAt))
    || value.isDeleted !== (value.deletedAt !== null)
    || value.deletionState !== (value.deletedAt === null ? 'active' : 'deleted')) {
    throw new LocalDatabaseError('INVALID_ENTITY', 'validate_entity');
  }
  if (value.ownerId !== null) validateSafeIdentifier(value.ownerId, 'validate_entity');
  if (value.contentHash !== null && !/^[a-f0-9]{64}$/i.test(value.contentHash)) {
    throw new LocalDatabaseError('INVALID_ENTITY', 'validate_entity');
  }
  validateSafeSource(value.source);
}

export function validateOutboxRecord(value: OutboxRecord): void {
  for (const item of [value.mutationId, value.domain, value.entityId, value.idempotencyKey]) {
    if (typeof item !== 'string' || item.length === 0 || item.length > 512 || SENSITIVE.test(item)) {
      throw new LocalDatabaseError('INVALID_OUTBOX', 'validate_outbox');
    }
  }
  const payload = value.payload as { kind?: unknown; record?: unknown; entityId?: unknown; deletedAt?: unknown; revision?: unknown } | null;
  const payloadKeys = payload !== null && typeof payload === 'object' && !Array.isArray(payload)
    ? Object.keys(payload).sort() : [];
  const snapshotPayloadValid = payload?.kind === 'entity_snapshot'
    && Object.prototype.hasOwnProperty.call(payload, 'record')
    && payloadKeys.join(',') === 'kind,record';
  const tombstonePayloadValid = payload?.kind === 'tombstone'
    && payload.entityId === value.entityId
    && validTimestamp(payload.deletedAt)
    && payload.revision === value.localRevision
    && payloadKeys.join(',') === 'deletedAt,entityId,kind,revision';
  const payloadValid = value.payloadMode === 'inline' && value.payloadHash === null
    && (snapshotPayloadValid || tombstonePayloadValid);
  const revisionsValid = value.baseRevision === null
    ? value.operation === 'upsert' && value.localRevision === 1
    : Number.isSafeInteger(value.baseRevision) && value.baseRevision > 0
      && value.baseRevision < Number.MAX_SAFE_INTEGER
      && value.localRevision === value.baseRevision + 1;
  if (!['upsert', 'tombstone'].includes(value.operation)
    || !['pending', 'processing', 'retry', 'completed', 'failed'].includes(value.status)
    || !Number.isSafeInteger(value.localRevision) || value.localRevision < 1
    || (value.baseRevision !== null && (!Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0))
    || !Number.isSafeInteger(value.attemptCount) || value.attemptCount < 0
    || !validTimestamp(value.createdAt) || !payloadValid || !revisionsValid
    || (value.operation === 'upsert') !== (payload.kind === 'entity_snapshot')
    || (value.operation === 'tombstone') !== (payload.kind === 'tombstone')) {
    throw new LocalDatabaseError('INVALID_OUTBOX', 'validate_outbox');
  }
}

export function validateCheckpoint(value: SyncCheckpointRecord): void {
  for (const item of [value.provider, value.stream, value.checkpointValue]) validateSafeIdentifier(item, 'validate_checkpoint');
  if ((value.serverEpoch !== null && !SAFE_CODE.test(value.serverEpoch)) || !validTimestamp(value.updatedAt)) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'validate_checkpoint');
  }
}

export function validateRestoreSession(value: RestoreSessionRecord): void {
  validateSafeIdentifier(value.sessionId, 'validate_restore_session');
  validateSafeIdentifier(value.targetGenerationId, 'validate_restore_session');
  validateSafeIdentifier(value.expectedActiveGenerationId, 'validate_restore_session');
  validateSafeIdentifier(value.sourceGenerationId, 'validate_restore_session');
  if (!/^[a-f0-9]{64}$/i.test(value.packageFingerprint)
    || !['preparing', 'validating', 'ready', 'committed', 'failed', 'abandoned'].includes(value.status)
    || !['pending', 'valid', 'invalid'].includes(value.validationResult)
    || (value.failureCode !== null && !SAFE_CODE.test(value.failureCode))
    || !validTimestamp(value.startedAt) || (value.committedAt !== null && !validTimestamp(value.committedAt))) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'validate_restore_session');
  }
}

export function validateMigrationState(value: MigrationStateRecord): void {
  validateSafeIdentifier(value.migrationId, 'validate_migration');
  validateSafeIdentifier(value.phase, 'validate_migration');
  for (const item of [value.sourceDatabase, value.targetDatabase, value.targetGenerationId, value.expectedActiveGenerationId, value.lastDurableStep]) {
    validateSafeIdentifier(item, 'validate_migration');
  }
  validateSafeIdentifier(value.sourceGenerationId, 'validate_migration');
  if (!Number.isSafeInteger(value.sourceSchemaVersion) || value.sourceSchemaVersion < 1
    || !Number.isSafeInteger(value.targetSchemaVersion) || value.targetSchemaVersion < 1
    || !['pending', 'valid', 'invalid'].includes(value.verificationState)
    || typeof value.rollbackEligibility !== 'boolean'
    || !Object.values(value.counts).every(count => Number.isSafeInteger(count) && count >= 0)
    || !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt)) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'validate_migration');
  }
}

export function validateAttachmentState(value: AttachmentStateRecord): void {
  validateSafeIdentifier(value.attachmentId, 'validate_attachment_state');
  for (const item of [value.localAvailability, value.remoteAvailability, value.checksumState, value.syncState]) {
    validateSafeIdentifier(item, 'validate_attachment_state');
  }
  if (!Array.isArray(value.referencedBy) || !value.referencedBy.every(item => typeof item === 'string' && item.length <= 512 && !SENSITIVE.test(item))
    || (value.storageLocatorReference !== null && (!SAFE_CODE.test(value.storageLocatorReference) || SENSITIVE.test(value.storageLocatorReference)))
    || !validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt)) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'validate_attachment_state');
  }
}
