import { LocalDatabaseError } from './errors';
import { validateSafeIdentifier } from './namespace';
import { deriveOutboxIdempotencyKey, validOutboxIdempotencyKey } from './outboxIdentity';
import { LOCAL_DATABASE_VERSION } from './types';
import type {
  AttachmentStateRecord, DatabaseMetaRecord, GenerationRecord, LegacyMigrationProvenance, LocalEntityEnvelope, MigrationStateRecord, OutboxRecord,
  ResurrectionProvenance, RestoreApplicationManifestV1, RestoreProvenance, RestoreSessionRecord, SafeSourceReference, SyncCheckpointRecord,
} from './types';

const SAFE_CODE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SENSITIVE = /(?:https?:\/\/|[?#\\/]|bearer|token|cookie|password|secret|authorization|eyJ)/i;

export function validTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value));
}

function validOutboxChronology(value: OutboxRecord): boolean {
  if (!validTimestamp(value.createdAt) || !validTimestamp(value.updatedAt) || !validTimestamp(value.availableAt)
    || !Number.isSafeInteger(value.attemptCount) || value.attemptCount < 0) return false;
  const createdAt = Date.parse(value.createdAt);
  const updatedAt = Date.parse(value.updatedAt);
  if (createdAt > updatedAt || Date.parse(value.availableAt) < createdAt) return false;

  if (value.attemptCount === 0) {
    if (value.lastAttemptAt !== null) return false;
  } else {
    if (!validTimestamp(value.lastAttemptAt)) return false;
    const lastAttemptAt = Date.parse(value.lastAttemptAt);
    if (lastAttemptAt < createdAt || lastAttemptAt > updatedAt) return false;
  }

  if (value.leaseExpiresAt !== null && !validTimestamp(value.leaseExpiresAt)) return false;
  if (value.acknowledgedAt !== null && !validTimestamp(value.acknowledgedAt)) return false;
  if (value.status === 'claimed') {
    if (value.attemptCount < 1 || !validTimestamp(value.lastAttemptAt) || !validTimestamp(value.leaseExpiresAt)
      || Date.parse(value.leaseExpiresAt) < Date.parse(value.lastAttemptAt)) return false;
  }
  if (value.status === 'acknowledged') {
    if (value.attemptCount < 1 || !validTimestamp(value.lastAttemptAt) || !validTimestamp(value.acknowledgedAt)) return false;
    const lastAttemptAt = Date.parse(value.lastAttemptAt);
    const acknowledgedAt = Date.parse(value.acknowledgedAt);
    if (acknowledgedAt < createdAt || acknowledgedAt < lastAttemptAt || acknowledgedAt > updatedAt) return false;
  }
  return true;
}

export function validateDatabaseMeta(value: DatabaseMetaRecord, namespaceKey: string, schemaVersion: number): void {
  if (!value || value.namespaceKey !== namespaceKey || value.namespaceFingerprint !== namespaceKey
    || value.databaseFormatVersion !== LOCAL_DATABASE_VERSION || value.schemaVersion !== schemaVersion
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
  if (!['local', 'remote', 'backup', 'snapshot', 'recovery_package', 'legacy_migration', 'test'].includes(source.kind)
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
  if (value.restoreProvenance !== undefined && value.restoreProvenance !== null) validateRestoreProvenance(value.restoreProvenance);
  if (value.migrationProvenance !== undefined && value.migrationProvenance !== null) {
    validateLegacyMigrationProvenance(value.migrationProvenance);
  }
}

export function validateLegacyMigrationProvenance(value: LegacyMigrationProvenance): void {
  if (!value || value.conversionVersion !== 1 || !SAFE_CODE.test(value.sourceAdapter)
    || value.sourceSchemaVersion !== null && (!Number.isSafeInteger(value.sourceSchemaVersion) || value.sourceSchemaVersion < 0)
    || !SAFE_CODE.test(value.migrationSessionId) || !/^[a-f0-9]{64}$/.test(value.sourceSnapshotDigest)
    || !validTimestamp(value.migratedAt) || !/^[a-f0-9]{64}$/.test(value.legacyKeyDigest)) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'validate_legacy_migration_provenance');
  }
}

export function validateResurrectionProvenance(value: ResurrectionProvenance): void {
  if (!value || typeof value.restoresEntityId !== 'string' || value.restoresEntityId.length === 0 || value.restoresEntityId.length > 512
    || SENSITIVE.test(value.restoresEntityId) || !SAFE_CODE.test(value.sourcePackageId)
    || !SAFE_CODE.test(value.sourceRestoreSessionId) || !validTimestamp(value.restoredAt)
    || (value.supersedesTombstoneRevision !== null
      && (!Number.isSafeInteger(value.supersedesTombstoneRevision) || value.supersedesTombstoneRevision < 1))) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'validate_resurrection');
  }
}

export function validateRestoreProvenance(value: RestoreProvenance): void {
  if (!value || !SAFE_CODE.test(value.packageId) || !SAFE_CODE.test(value.restoreSessionId)
    || !['insert', 'replace', 'skip_identical', 'conflict', 'resurrect', 'preserve_local'].includes(value.classification)
    || (value.sourceRevision !== null && (!Number.isSafeInteger(value.sourceRevision) || value.sourceRevision < 1))
    || (value.expectedLocalRevision !== null && (!Number.isSafeInteger(value.expectedLocalRevision) || value.expectedLocalRevision < 1))
    || (value.sourceUpdatedAt !== null && !validTimestamp(value.sourceUpdatedAt))
    || (value.sourceDeletedAt !== null && !validTimestamp(value.sourceDeletedAt))
    || !validTimestamp(value.restoredAt)
    || (value.mutationId !== null && !/^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.mutationId))) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'validate_restore_provenance');
  }
  if (value.resurrection !== null) validateResurrectionProvenance(value.resurrection);
  if ((value.classification === 'resurrect') !== (value.resurrection !== null)) {
    throw new LocalDatabaseError('INVALID_RESERVED_RECORD', 'validate_restore_provenance');
  }
}

export function validateOutboxRecord(value: OutboxRecord): void {
  for (const item of [value.mutationId, value.domain, value.entityId]) {
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
  const noLease = value.leaseOwner === null && value.leaseExpiresAt === null;
  const safeOptional = (item: string | null): boolean => item === null || SAFE_CODE.test(item);
  const validMutationId = (item: unknown): item is string => typeof item === 'string'
    && /^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(item);
  const statusValid = value.status === 'pending'
    ? noLease && value.acknowledgedAt === null && value.acknowledgedBy === null && value.supersededByMutationId === null
      && value.lastErrorCode === null && value.remoteMutationRef === null
      && Date.parse(value.availableAt) >= Date.parse(value.updatedAt)
    : value.status === 'claimed'
      ? value.leaseOwner !== null && SAFE_CODE.test(value.leaseOwner) && validTimestamp(value.leaseExpiresAt)
        && validTimestamp(value.lastAttemptAt) && value.attemptCount >= 1 && value.acknowledgedAt === null && value.acknowledgedBy === null
        && value.supersededByMutationId === null && value.lastErrorCode === null && value.remoteMutationRef === null
        && Date.parse(value.leaseExpiresAt) >= Date.parse(value.lastAttemptAt)
      : value.status === 'retry_wait'
        ? noLease && validTimestamp(value.lastAttemptAt) && value.attemptCount >= 1
          && value.lastErrorCode !== null && SAFE_CODE.test(value.lastErrorCode)
          && value.acknowledgedAt === null && value.acknowledgedBy === null && value.supersededByMutationId === null && value.remoteMutationRef === null
          && Date.parse(value.availableAt) >= Date.parse(value.updatedAt)
        : value.status === 'acknowledged'
          ? noLease && validTimestamp(value.acknowledgedAt) && value.acknowledgedBy !== null
            && SAFE_CODE.test(value.acknowledgedBy) && value.supersededByMutationId === null
            && value.lastErrorCode === null && safeOptional(value.remoteMutationRef)
            && validTimestamp(value.lastAttemptAt) && value.attemptCount >= 1
            && Date.parse(value.acknowledgedAt) >= Date.parse(value.lastAttemptAt)
          : value.status === 'permanent_failure'
            ? noLease && value.attemptCount >= 1 && value.lastErrorCode !== null && SAFE_CODE.test(value.lastErrorCode)
              && validTimestamp(value.lastAttemptAt) && value.acknowledgedAt === null && value.acknowledgedBy === null
              && value.supersededByMutationId === null && value.remoteMutationRef === null
            : value.status === 'superseded'
              ? noLease && validMutationId(value.supersededByMutationId) && value.supersededByMutationId !== value.mutationId
                && value.acknowledgedAt === null && value.acknowledgedBy === null
                && value.remoteMutationRef === null && value.lastErrorCode === null
              : false;
  const expectedIdempotencyKey = deriveOutboxIdempotencyKey(value);
  const deliveryBlockValid = value.deliveryBlockCode === undefined || value.deliveryBlockCode === null
    || value.deliveryBlockCode === 'REMOTE_RESURRECTION_UNSUPPORTED';
  const resurrection = value.resurrection ?? null;
  const boundary = value.generationBoundary ?? null;
  if (resurrection !== null) validateResurrectionProvenance(resurrection);
  const boundaryKeys = boundary === null ? '' : Object.keys(boundary).sort().join(',');
  const expectedBoundaryKeys = [
    'classification', 'createdAt', 'domain', 'entityId', 'kind', 'namespaceKey', 'packageDigest', 'packageId',
    'restoreSessionId', 'sourceGenerationId', 'sourceRevision', 'targetGenerationId', 'targetRevision',
  ].sort().join(',');
  const boundaryValid = boundary === null || boundaryKeys === expectedBoundaryKeys
    && boundary.kind === 'restore_generation_sequence_boundary'
    && boundary.namespaceKey === value.namespaceKey
    && SAFE_CODE.test(boundary.sourceGenerationId)
    && boundary.targetGenerationId === value.generationId
    && boundary.domain === value.domain && boundary.entityId === value.entityId
    && typeof boundary.domain === 'string' && boundary.domain.length > 0 && boundary.domain.length <= 512 && !SENSITIVE.test(boundary.domain)
    && typeof boundary.entityId === 'string' && boundary.entityId.length > 0 && boundary.entityId.length <= 512 && !SENSITIVE.test(boundary.entityId)
    && SAFE_CODE.test(boundary.restoreSessionId)
    && SAFE_CODE.test(boundary.packageId) && /^[a-f0-9]{64}$/.test(boundary.packageDigest)
    && boundary.sourceGenerationId !== value.generationId
    && value.generationId === `restore-${boundary.restoreSessionId}`
    && Number.isSafeInteger(boundary.sourceRevision) && boundary.sourceRevision > 0
    && Number.isSafeInteger(boundary.targetRevision) && boundary.targetRevision === boundary.sourceRevision + 1
    && boundary.targetRevision === value.localRevision
    && ['replace', 'resurrect'].includes(boundary.classification)
    && validTimestamp(boundary.createdAt) && boundary.createdAt === value.createdAt
    && value.operation === 'upsert' && value.baseRevision === boundary.sourceRevision
    && value.localRevision === boundary.sourceRevision + 1
    && (boundary.classification === 'resurrect') === (resurrection !== null);
  if (!['upsert', 'tombstone'].includes(value.operation)
    || !validOutboxIdempotencyKey(value.idempotencyKey) || value.idempotencyKey !== expectedIdempotencyKey
    || !validMutationId(value.mutationId)
    || !Number.isSafeInteger(value.localRevision) || value.localRevision < 1
    || (value.baseRevision !== null && (!Number.isSafeInteger(value.baseRevision) || value.baseRevision < 0))
    || !validOutboxChronology(value)
    || !safeOptional(value.lastErrorCode) || !safeOptional(value.remoteMutationRef)
    || !payloadValid || !revisionsValid || !statusValid
    || (value.operation === 'upsert') !== (payload.kind === 'entity_snapshot')
    || (value.operation === 'tombstone') !== (payload.kind === 'tombstone') || !deliveryBlockValid
    || (resurrection !== null) !== (value.deliveryBlockCode === 'REMOTE_RESURRECTION_UNSUPPORTED')
    || (resurrection !== null && value.operation !== 'upsert') || !boundaryValid) {
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
  validateSafeIdentifier(value.packageId, 'validate_restore_session');
  validateSafeIdentifier(value.stagingGenerationId, 'validate_restore_session');
  if (value.targetGenerationId !== null) validateSafeIdentifier(value.targetGenerationId, 'validate_restore_session');
  validateSafeIdentifier(value.expectedActiveGenerationId, 'validate_restore_session');
  if (value.sourceGenerationId !== null) validateSafeIdentifier(value.sourceGenerationId, 'validate_restore_session');
  const summary = value.summary;
  const blocking = value.blockingState;
  const applicationManifestValid = value.applicationManifest === null
    ? ['created', 'validating'].includes(value.status)
      || ['failed', 'cancelled'].includes(value.status) && value.targetGenerationId === null
    : validateRestoreApplicationManifest(value.applicationManifest)
      && !['created', 'validating'].includes(value.status)
      && value.applicationManifest.restoreSessionId === value.sessionId
      && value.applicationManifest.packageId === value.packageId
      && value.applicationManifest.packageDigest === value.packageDigest
      && value.applicationManifest.namespaceKey === value.namespaceKey
      && value.applicationManifest.sourceGenerationId === value.sourceGenerationId
      && value.applicationManifest.targetGenerationId === value.stagingGenerationId
      && value.applicationManifest.entryCount === value.entityCount;
  const manifestSummary = value.applicationManifest === null ? null : value.applicationManifest.entries.reduce((result, entry) => {
    if (entry.classification === 'insert') result.inserted += 1;
    else if (entry.classification === 'replace') result.replaced += 1;
    else if (entry.classification === 'resurrect') result.resurrected += 1;
    else if (entry.classification === 'skip_identical' || entry.classification === 'preserve_local') result.skipped += 1;
    else result.conflicts += 1;
    return result;
  }, { inserted: 0, replaced: 0, skipped: 0, resurrected: 0, conflicts: 0 });
  const manifestSummaryValid = manifestSummary === null || Object.keys(manifestSummary).every(key =>
    manifestSummary[key as keyof typeof manifestSummary] === value.summary[key as keyof RestoreSessionRecord['summary']]);
  const blockingValid = blocking === null || blocking !== undefined
    && Object.keys(blocking).sort().join(',') === ['attemptCount', 'code', 'detectedAt'].sort().join(',')
    && blocking.code === 'RESTORE_UNSETTLED_OUTBOX_CONFLICT'
    && validTimestamp(blocking.detectedAt)
    && Number.isSafeInteger(blocking.attemptCount) && blocking.attemptCount > 0
    && ['staged', 'committing'].includes(value.status)
    && Date.parse(blocking.detectedAt) >= Date.parse(value.createdAt)
    && Date.parse(blocking.detectedAt) <= Date.parse(value.updatedAt);
  const chronology = validTimestamp(value.createdAt) && validTimestamp(value.updatedAt)
    && Date.parse(value.createdAt) <= Date.parse(value.updatedAt)
    && (value.committedAt === null || validTimestamp(value.committedAt) && Date.parse(value.committedAt) >= Date.parse(value.createdAt)
      && Date.parse(value.committedAt) <= Date.parse(value.updatedAt))
    && (value.failedAt === null || validTimestamp(value.failedAt) && Date.parse(value.failedAt) >= Date.parse(value.createdAt)
      && Date.parse(value.failedAt) <= Date.parse(value.updatedAt));
  const lifecycleReferencesValid = ['created', 'validating'].includes(value.status)
    ? value.targetGenerationId === null
    : ['staged', 'committing', 'committed'].includes(value.status)
      ? value.sourceGenerationId !== null && value.targetGenerationId === value.stagingGenerationId
      : true;
  const terminalValid = value.status === 'committed'
    ? value.committedAt !== null && value.failedAt === null && value.failureCode === null
      && value.targetGenerationId === value.stagingGenerationId
    : value.status === 'failed'
      ? value.failedAt !== null && value.failureCode !== null && value.committedAt === null
      : value.status === 'cancelled'
        ? value.committedAt === null && value.failureCode === 'RESTORE_CANCELLED'
        : value.committedAt === null && value.failedAt === null && value.failureCode === null;
  const failureCodes = new Set([
    'INVALID_RESTORE_PROTOCOL', 'INVALID_RESTORE_PACKAGE', 'PACKAGE_DIGEST_MISMATCH',
    'PACKAGE_ENTITY_COUNT_MISMATCH', 'DUPLICATE_RESTORE_ENTITY', 'UNSUPPORTED_RESTORE_DOMAIN',
    'RESTORE_PAYLOAD_TOO_LARGE', 'RESTORE_NAMESPACE_MISMATCH', 'RESTORE_PROJECT_MISMATCH',
    'RESTORE_SESSION_CONFLICT', 'RESTORE_CANCELLED', 'RESTORE_ACTIVE_GENERATION_CHANGED',
    'RESTORE_ENTITY_REVISION_CONFLICT', 'RESTORE_TOMBSTONE_CONFLICT',
    'REMOTE_RESURRECTION_UNSUPPORTED', 'RESTORE_UNSETTLED_OUTBOX_CONFLICT', 'RESTORE_TRANSACTION_FAILED',
  ]);
  if (value.protocolVersion !== 1 || !/^[a-f0-9]{64}$/.test(value.packageDigest)
    || !['created', 'validating', 'staged', 'committing', 'committed', 'failed', 'cancelled'].includes(value.status)
    || !Number.isSafeInteger(value.entityCount) || value.entityCount < 0
    || !summary || !Object.values(summary).every(count => Number.isSafeInteger(count) && count >= 0)
    || summary.inserted + summary.replaced + summary.skipped + summary.resurrected + summary.conflicts > value.entityCount
    || (value.status === 'committed'
      && summary.inserted + summary.replaced + summary.skipped + summary.resurrected + summary.conflicts !== value.entityCount)
    || (value.failureCode !== null && (!SAFE_CODE.test(value.failureCode) || !failureCodes.has(value.failureCode)))
    || !chronology || !terminalValid || !lifecycleReferencesValid || !blockingValid
    || !applicationManifestValid || !manifestSummaryValid) {
    throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'validate_restore_session');
  }
}

const RESTORE_APPLICATION_ENTRY_KEYS = [
  'classification', 'domain', 'entityId', 'expectedEntityDigest', 'expectedIdempotencyKey', 'expectedMutationId',
  'expectedOperation', 'expectedProvenanceDigest', 'requiresOutbox', 'requiresSequenceBoundary', 'sourceRevision', 'targetRevision',
].sort().join(',');
const RESTORE_APPLICATION_MANIFEST_KEYS = [
  'entries', 'entryCount', 'manifestDigest', 'namespaceKey', 'packageDigest', 'packageId', 'restoreSessionId',
  'sourceGenerationId', 'stagedEntityCount', 'stagedSetDigest', 'targetGenerationId', 'version',
].sort().join(',');

export function validateRestoreApplicationManifest(value: RestoreApplicationManifestV1): boolean {
  if (!value || Object.keys(value).sort().join(',') !== RESTORE_APPLICATION_MANIFEST_KEYS
    || value.version !== 1 || !SAFE_CODE.test(value.restoreSessionId) || !SAFE_CODE.test(value.packageId)
    || !/^[a-f0-9]{64}$/.test(value.packageDigest) || !/^[a-f0-9]{64}$/.test(value.manifestDigest)
    || typeof value.namespaceKey !== 'string' || value.namespaceKey.length < 1 || value.namespaceKey.length > 512
    || !SAFE_CODE.test(value.sourceGenerationId) || !SAFE_CODE.test(value.targetGenerationId)
    || value.sourceGenerationId === value.targetGenerationId
    || !Number.isSafeInteger(value.stagedEntityCount) || value.stagedEntityCount < 0
    || !/^[a-f0-9]{64}$/.test(value.stagedSetDigest)
    || !Number.isSafeInteger(value.entryCount) || value.entryCount < 0 || value.entryCount > 5_000
    || !Array.isArray(value.entries) || value.entries.length !== value.entryCount) return false;
  let previousKey = '';
  for (const entry of value.entries) {
    if (!entry || Object.keys(entry).sort().join(',') !== RESTORE_APPLICATION_ENTRY_KEYS
      || entry.domain !== 'notes' || typeof entry.entityId !== 'string' || entry.entityId.length < 1 || entry.entityId.length > 512
      || !['insert', 'replace', 'resurrect', 'skip_identical', 'preserve_local', 'conflict'].includes(entry.classification)
      || typeof entry.requiresOutbox !== 'boolean' || typeof entry.requiresSequenceBoundary !== 'boolean') return false;
    const key = `${entry.domain}\0${entry.entityId}`;
    if (key <= previousKey) return false;
    previousKey = key;
    const applied = ['insert', 'replace', 'resurrect'].includes(entry.classification);
    const digestValid = (item: string | null): boolean => item === null || /^[a-f0-9]{64}$/.test(item);
    if (!digestValid(entry.expectedEntityDigest) || !digestValid(entry.expectedProvenanceDigest)) return false;
    if (applied) {
      if (!entry.requiresOutbox || entry.expectedOperation !== 'upsert'
        || entry.expectedEntityDigest === null || entry.expectedProvenanceDigest === null
        || entry.expectedMutationId === null
        || !/^mut\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(entry.expectedMutationId)
        || entry.expectedIdempotencyKey === null || !validOutboxIdempotencyKey(entry.expectedIdempotencyKey)) return false;
      if (entry.classification === 'insert') {
        if (entry.sourceRevision !== null || entry.targetRevision !== 1 || entry.requiresSequenceBoundary) return false;
      } else if (!Number.isSafeInteger(entry.sourceRevision) || entry.sourceRevision! < 1
        || entry.sourceRevision! >= Number.MAX_SAFE_INTEGER || entry.targetRevision !== entry.sourceRevision! + 1
        || !entry.requiresSequenceBoundary) return false;
    } else if (entry.requiresOutbox || entry.requiresSequenceBoundary || entry.expectedOperation !== null
      || entry.expectedEntityDigest !== null || entry.expectedProvenanceDigest !== null
      || entry.expectedMutationId !== null || entry.expectedIdempotencyKey !== null || entry.targetRevision !== null
      || !Number.isSafeInteger(entry.sourceRevision) || entry.sourceRevision! < 1) return false;
  }
  return true;
}

export interface RestoreSequenceBoundaryGraph {
  outbox: OutboxRecord;
  session: RestoreSessionRecord;
  databaseMeta: DatabaseMetaRecord;
  sourceGeneration: GenerationRecord | null;
  targetGeneration: GenerationRecord | null;
  sourceEntity: LocalEntityEnvelope | null;
  targetEntity: LocalEntityEnvelope | null;
  namespaceKey: string;
  schemaVersion: number;
}

export function validateRestoreSequenceBoundaryGraph(graph: RestoreSequenceBoundaryGraph): void {
  try {
    const { outbox, session, databaseMeta, sourceGeneration, targetGeneration, sourceEntity, targetEntity,
      namespaceKey, schemaVersion } = graph;
    validateOutboxRecord(outbox);
    const boundary = outbox.generationBoundary;
    if (!boundary || !sourceGeneration || !targetGeneration || !sourceEntity || !targetEntity) throw new Error('boundary_graph');
    validateRestoreSessionGraph({
      session, databaseMeta, sourceGeneration, stagingGeneration: targetGeneration, targetGeneration,
      namespaceKey, schemaVersion,
    });
    validateEntityEnvelope(sourceEntity); validateEntityEnvelope(targetEntity);
    const provenance = targetEntity.restoreProvenance;
    if (session.status !== 'committed' || session.blockingState !== null
      || session.namespaceKey !== boundary.namespaceKey || session.sessionId !== boundary.restoreSessionId
      || session.packageId !== boundary.packageId || session.packageDigest !== boundary.packageDigest
      || session.sourceGenerationId !== boundary.sourceGenerationId
      || session.targetGenerationId !== boundary.targetGenerationId
      || sourceGeneration.generationId !== boundary.sourceGenerationId
      || targetGeneration.generationId !== boundary.targetGenerationId
      || targetGeneration.predecessorGenerationId !== sourceGeneration.generationId
      || targetGeneration.safeSourceReference?.kind !== 'recovery_package'
      || targetGeneration.safeSourceReference.reference !== boundary.packageId
      || sourceEntity.namespaceKey !== namespaceKey || sourceEntity.generationId !== boundary.sourceGenerationId
      || sourceEntity.domain !== boundary.domain || sourceEntity.entityId !== boundary.entityId
      || sourceEntity.revision !== boundary.sourceRevision
      || (boundary.classification === 'replace' && sourceEntity.isDeleted)
      || (boundary.classification === 'resurrect' && !sourceEntity.isDeleted)
      || targetEntity.namespaceKey !== namespaceKey || targetEntity.generationId !== boundary.targetGenerationId
      || targetEntity.domain !== boundary.domain || targetEntity.entityId !== boundary.entityId
      || targetEntity.revision < boundary.targetRevision
      || !provenance || provenance.packageId !== boundary.packageId
      || provenance.restoreSessionId !== boundary.restoreSessionId
      || provenance.classification !== boundary.classification
      || provenance.expectedLocalRevision !== boundary.sourceRevision
      || provenance.mutationId !== outbox.mutationId || provenance.restoredAt !== boundary.createdAt) throw new Error('boundary_graph');
  } catch {
    throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'validate_restore_sequence_boundary_graph');
  }
}

export interface RestoreSessionGraph {
  session: RestoreSessionRecord;
  databaseMeta: DatabaseMetaRecord;
  sourceGeneration: GenerationRecord | null;
  stagingGeneration: GenerationRecord | null;
  targetGeneration: GenerationRecord | null;
  namespaceKey: string;
  schemaVersion: number;
}

export function validateRestoreSessionGraph(graph: RestoreSessionGraph): void {
  try {
    const { session, databaseMeta, sourceGeneration, stagingGeneration, targetGeneration, namespaceKey, schemaVersion } = graph;
    validateRestoreSession(session);
    validateDatabaseMeta(databaseMeta, namespaceKey, schemaVersion);
    if (session.namespaceKey !== namespaceKey || session.sourceGenerationId === null
      || session.stagingGenerationId !== `restore-${session.sessionId}`
      || session.sourceGenerationId === session.stagingGenerationId
      || session.sourceGenerationId === session.targetGenerationId
      || !sourceGeneration || sourceGeneration.generationId !== session.sourceGenerationId
      || !stagingGeneration || stagingGeneration.generationId !== session.stagingGenerationId) throw new Error('restore_graph');
    validateGenerationRecord(sourceGeneration, namespaceKey, schemaVersion);
    validateGenerationRecord(stagingGeneration, namespaceKey, schemaVersion);
    if (stagingGeneration.creationReason !== 'restore'
      || stagingGeneration.predecessorGenerationId !== session.sourceGenerationId
      || stagingGeneration.safeSourceReference?.kind !== 'recovery_package'
      || stagingGeneration.safeSourceReference.reference !== session.packageId) throw new Error('restore_graph');

    const targetExpected = session.targetGenerationId !== null;
    if (targetExpected !== (targetGeneration !== null)) throw new Error('restore_graph');
    if (targetGeneration) {
      validateGenerationRecord(targetGeneration, namespaceKey, schemaVersion);
      if (targetGeneration.generationId !== session.targetGenerationId
        || targetGeneration.generationId !== stagingGeneration.generationId) throw new Error('restore_graph');
    }

    if (session.status === 'created' || session.status === 'validating') {
      if (session.targetGenerationId !== null || stagingGeneration.status !== 'preparing'
        || stagingGeneration.validationState !== 'pending'
        || sourceGeneration.status !== 'active' || databaseMeta.activeGenerationId !== sourceGeneration.generationId) throw new Error('restore_graph');
    } else if (session.status === 'staged' || session.status === 'committing') {
      if (!targetGeneration || stagingGeneration.status !== 'preparing' || stagingGeneration.validationState !== 'valid'
        || sourceGeneration.status !== 'active' || databaseMeta.activeGenerationId !== sourceGeneration.generationId) throw new Error('restore_graph');
    } else if (session.status === 'committed') {
      if (!targetGeneration || targetGeneration.status !== 'active' || targetGeneration.validationState !== 'valid'
        || databaseMeta.activeGenerationId !== targetGeneration.generationId || sourceGeneration.status !== 'sealed') throw new Error('restore_graph');
    } else {
      if (stagingGeneration.status === 'active' || databaseMeta.activeGenerationId === stagingGeneration.generationId
        || session.targetGenerationId !== null && stagingGeneration.validationState !== 'valid'
        || session.targetGenerationId === null && stagingGeneration.validationState !== 'pending') throw new Error('restore_graph');
    }
  } catch {
    throw new LocalDatabaseError('CORRUPT_PERSISTED_RECORD', 'validate_restore_session_graph');
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
