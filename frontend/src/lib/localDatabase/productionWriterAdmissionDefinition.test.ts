import { describe, expect, it } from 'vitest';
import {
  K329B_REVIEWED_WRITER_MANIFEST_ENTRIES,
  createWriterCoordinationModel,
  decodeWriterCoordinationModelCanonical,
  deriveCoordinationAuthorityDigest,
  encodeWriterCoordinationModelCanonical,
  reduceWriterCoordination,
  type AdmissionOperationRecord,
  type WriterCoordinationAction,
  type WriterCoordinationActor,
  type WriterCoordinationModelState,
  type WriterRegistrationRecord,
  type SourceVerificationObservation,
} from './writerCoordinationEligibility';

const PHYSICAL_SOURCE = '1'.repeat(64);
const COORDINATOR_SESSION = `writer-session-v1:${'a'.repeat(32)}`;
const VERIFIER_SESSION = `writer-session-v1:${'b'.repeat(32)}`;
const RECOVERY_SESSION = `writer-session-v1:${'c'.repeat(32)}`;
const coordinator: WriterCoordinationActor = { kind: 'coordinator', sessionId: COORDINATOR_SESSION };
const verifier: WriterCoordinationActor = { kind: 'verifier', sessionId: VERIFIER_SESSION };
const participating = K329B_REVIEWED_WRITER_MANIFEST_ENTRIES
  .filter(entry => entry.coordinationRequirement === 'must_participate');

function hex(index: number, width: number): string {
  return index.toString(16).padStart(width, '0').slice(-width);
}

function model(): WriterCoordinationModelState {
  return createWriterCoordinationModel({
    physicalSourceDigest: PHYSICAL_SOURCE,
    coordinatorSessionId: COORDINATOR_SESSION,
    verifierSessionId: VERIFIER_SESSION,
    recoverySessionId: RECOVERY_SESSION,
  });
}

function registration(index: number, overrides: Partial<WriterRegistrationRecord> = {}): WriterRegistrationRecord {
  const entry = participating[index % participating.length];
  const contextType = entry.contextTypes[0];
  return {
    kind: 'absinthe_writer_registration',
    schemaVersion: 1,
    byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL_SOURCE,
    writerTypeId: entry.writerTypeId,
    writerId: `writer-v1:${contextType}:${entry.writerTypeId}:${hex(index + 1, 32)}`,
    sessionId: `writer-session-v1:${hex(index + 101, 32)}`,
    contextType,
    coordinationEpoch: 1,
    capabilities: [...entry.requiredCapabilities],
    registrationState: 'registered',
    coordinated: false,
    acknowledgedDrainRevision: null,
    latestOperationId: null,
    lastSeenSequence: 0,
    ...overrides,
  };
}

function action(
  state: WriterCoordinationModelState,
  actor: WriterCoordinationActor,
  body: Record<string, unknown>,
): WriterCoordinationAction {
  return {
    ...body,
    actor,
    expectedTransitionRevision: state.authority.transitionRevision,
    expectedCoordinationEpoch: state.authority.coordinationEpoch,
    expectedAuthorityDigest: deriveCoordinationAuthorityDigest(state.authority),
  } as unknown as WriterCoordinationAction;
}

function apply(
  state: WriterCoordinationModelState,
  actor: WriterCoordinationActor,
  body: Record<string, unknown>,
): WriterCoordinationModelState {
  const result = reduceWriterCoordination(state, action(state, actor, body));
  expect(result).toMatchObject({ ok: true });
  if (!result.ok) throw new Error(result.code);
  return result.state;
}

function register(state: WriterCoordinationModelState, record: WriterRegistrationRecord): WriterCoordinationModelState {
  return apply(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
    type: 'REGISTER_WRITER',
    registration: record,
  });
}

function registerAll(): WriterCoordinationModelState {
  return participating.reduce((state, _entry, index) => register(state, registration(index)), model());
}

function operation(
  owner: WriterRegistrationRecord,
  state: WriterCoordinationModelState,
  index = 1,
): AdmissionOperationRecord {
  return {
    kind: 'absinthe_writer_admission_operation',
    schemaVersion: 1,
    byteFormatVersion: 1,
    physicalSourceDigest: PHYSICAL_SOURCE,
    operationId: `writer-operation-v1:${hex(index, 64)}`,
    idempotencyKey: `writer-idempotency-v1:${hex(index + 1000, 64)}`,
    writerTypeId: owner.writerTypeId,
    writerId: owner.writerId,
    sessionId: owner.sessionId,
    coordinationEpoch: state.authority.coordinationEpoch,
    admissionTransitionRevision: state.authority.transitionRevision,
    mutationType: 'entity_put',
    expectedSourceRevision: '40',
    state: 'admitted',
    committedSourceRevision: null,
    terminalResult: null,
  };
}

type IntegrationPolicySnapshot = {
  webLocksAvailable: boolean;
  protocolVersion: number;
  expectedProtocolVersion: number;
  maintenanceOwner: string | null;
  writerSessionId: string;
  writerKind: 'interactive' | 'sync' | 'maintenance';
  syncPaused: boolean;
};

function integrationPolicySnapshot(input: IntegrationPolicySnapshot): string | null {
  if (!input.webLocksAvailable) return 'WEB_LOCKS_UNAVAILABLE';
  if (input.protocolVersion !== input.expectedProtocolVersion) return 'UNSUPPORTED_PROTOCOL_VERSION';
  if (input.maintenanceOwner !== null && input.maintenanceOwner !== input.writerSessionId) {
    return 'MAINTENANCE_ADMISSION_EXCLUSIVE';
  }
  if (input.writerKind === 'sync' && input.syncPaused) return 'SYNC_APPLY_PAUSED';
  return null;
}

type SourceReceiptFixture = Readonly<{
  operationId: string;
  writerSessionId: string;
  mutationDigest: string;
  previousSourceRevision: string;
  committedSourceRevision: string;
  outboxMutationId: string;
  receiptDigest: string;
}>;

type SourceAuthorityFixture = Readonly<{
  revision: string;
  receipts: Readonly<Record<string, SourceReceiptFixture>>;
  outboxMutationIds: readonly string[];
}>;

type SourceMutationFixture = Readonly<{
  operationId: string;
  writerSessionId: string;
  mutationDigest: string;
  expectedSourceRevision: string;
}>;

type SourceCommitFixtureResult =
  | Readonly<{ ok: true; state: SourceAuthorityFixture; receipt: SourceReceiptFixture; reused: boolean }>
  | Readonly<{ ok: false; code: 'SOURCE_REVISION_MISMATCH' | 'OPERATION_IDENTITY_MISMATCH' }>;

function commitSourceFixture(state: SourceAuthorityFixture, input: SourceMutationFixture): SourceCommitFixtureResult {
  const existing = state.receipts[input.operationId];
  if (existing) {
    if (existing.writerSessionId !== input.writerSessionId
      || existing.mutationDigest !== input.mutationDigest
      || existing.previousSourceRevision !== input.expectedSourceRevision) {
      return { ok: false, code: 'OPERATION_IDENTITY_MISMATCH' };
    }
    return { ok: true, state, receipt: existing, reused: true };
  }
  if (input.expectedSourceRevision !== state.revision) {
    return { ok: false, code: 'SOURCE_REVISION_MISMATCH' };
  }
  const committedSourceRevision = (BigInt(state.revision) + 1n).toString(10);
  const receipt: SourceReceiptFixture = Object.freeze({
    operationId: input.operationId,
    writerSessionId: input.writerSessionId,
    mutationDigest: input.mutationDigest,
    previousSourceRevision: state.revision,
    committedSourceRevision,
    outboxMutationId: `outbox:${input.operationId}`,
    receiptDigest: `receipt:${input.operationId}:${committedSourceRevision}:${input.mutationDigest}`,
  });
  return {
    ok: true,
    reused: false,
    receipt,
    state: Object.freeze({
      revision: committedSourceRevision,
      receipts: Object.freeze({ ...state.receipts, [input.operationId]: receipt }),
      outboxMutationIds: Object.freeze([...state.outboxMutationIds, receipt.outboxMutationId]),
    }),
  };
}

type ReconciliationClassification =
  | 'NO_OPERATION'
  | 'ADMITTED_SOURCE_UNCOMMITTED'
  | 'RECONCILE_TERMINAL_FROM_RECEIPT'
  | 'COMMITTED'
  | 'CORRUPT_PERSISTED_GRAPH';

function classifyReceiptGraph(input: Readonly<{
  admission: boolean;
  receipt: boolean;
  entityRevisionAdvanced: boolean;
  outbox: boolean;
  terminalCommitted: boolean;
}>): ReconciliationClassification {
  if (input.receipt) {
    if (!input.admission || !input.entityRevisionAdvanced || !input.outbox) return 'CORRUPT_PERSISTED_GRAPH';
    return input.terminalCommitted ? 'COMMITTED' : 'RECONCILE_TERMINAL_FROM_RECEIPT';
  }
  if (input.terminalCommitted || input.entityRevisionAdvanced || input.outbox) return 'CORRUPT_PERSISTED_GRAPH';
  return input.admission ? 'ADMITTED_SOURCE_UNCOMMITTED' : 'NO_OPERATION';
}

type ReceiptBackedOperationFixture = Readonly<{
  namespaceFingerprint: string;
  generationId: string;
  operationId: string;
  coordinationEpoch: number;
  admissionReceiptDigest: string;
  receiptDigest: string | null;
  previousSourceRevision: unknown;
  committedSourceRevision: unknown;
  sourceAuthorityRevision: unknown;
  sourceAuthorityChainDigest: string;
  receiptChain: readonly SourceRevisionEvidenceFixture[];
  currentEntitySourceRevision: unknown;
  currentEntityLifecycle: 'active' | 'tombstoned' | 'resurrected';
  currentEntityDigestMatchesReceipt: boolean;
  currentAuthorityDigestMatchesChain: boolean;
  immutableOutboxIntentMatches: boolean;
  outboxDeliveryStatus: 'pending' | 'retry_wait' | 'acknowledged';
  admitted: boolean;
  terminal: 'absent' | 'committed' | 'failed' | 'aborted';
  terminalReceiptDigest: string | null;
}>;

type ReconcileCommittedSourceReceiptInput = Readonly<{
  namespaceFingerprint: string;
  generationId: string;
  operationId: string;
}>;

type ReceiptReconciliationResult =
  | Readonly<{ ok: true; operation: ReceiptBackedOperationFixture; reused: boolean }>
  | Readonly<{ ok: false; code:
      | 'RECONCILIATION_RECEIPT_NOT_FOUND'
      | 'RECONCILIATION_OPERATION_NOT_ADMITTED'
      | 'RECONCILIATION_RECEIPT_DIGEST_MISMATCH'
      | 'RECONCILIATION_SOURCE_REVISION_MISMATCH'
      | 'RECONCILIATION_TERMINAL_CONFLICT'
      | 'RECONCILIATION_STALE_EPOCH'
      | 'RECONCILIATION_CORRUPT_PERSISTED_STATE' }>;

type DecodeSourceRevisionResult =
  | Readonly<{ ok: true; canonical: string; value: bigint }>
  | Readonly<{ ok: false; code:
      | 'SOURCE_REVISION_NOT_STRING'
      | 'SOURCE_REVISION_NON_CANONICAL'
      | 'SOURCE_REVISION_OUT_OF_RANGE' }>;

type DecodeSourceRevisionErrorCode = Extract<DecodeSourceRevisionResult, { ok: false }>['code'];

function decodeSourceRevision(value: unknown): DecodeSourceRevisionResult {
  if (typeof value !== 'string') return { ok: false, code: 'SOURCE_REVISION_NOT_STRING' };
  if (value.length > 16) return { ok: false, code: 'SOURCE_REVISION_OUT_OF_RANGE' };
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) return { ok: false, code: 'SOURCE_REVISION_NON_CANONICAL' };
  return { ok: true, canonical: value, value: BigInt(value) };
}

type SourceRevisionEvidenceFixture = Readonly<{
  operationId: string;
  previousSourceRevision: string;
  committedSourceRevision: string;
  previousChainDigest: string;
  receiptDigest: string;
  committedAuthorityDigest: string;
  chainDigest: string;
}>;

function revisionEvidence(
  operationId: string,
  previousSourceRevision: string,
  committedSourceRevision: string,
  previousChainDigest: string,
  receiptDigest = `receipt:${operationId}:${committedSourceRevision}`,
): SourceRevisionEvidenceFixture {
  return Object.freeze({
    operationId,
    previousSourceRevision,
    committedSourceRevision,
    previousChainDigest,
    receiptDigest,
    committedAuthorityDigest: `authority:${committedSourceRevision}`,
    chainDigest: `chain:${previousChainDigest}:${operationId}:${committedSourceRevision}`,
  });
}

function validReceiptLineage(
  receiptRevision: bigint,
  currentRevision: bigint,
  receiptDigest: string,
  lineage: readonly SourceRevisionEvidenceFixture[],
  currentChainDigest: string,
): boolean {
  // This fixture models only the current unsealed segment. Historical membership uses the
  // authenticated segment/MMR proof below and never expands this array with source age.
  if (lineage.length === 0 || lineage.length > 64) return false;
  let expectedPrevious = receiptRevision - 1n;
  let expectedPreviousChain = lineage[0].previousChainDigest;
  const committed = new Set<string>();
  for (const evidence of lineage) {
    const previous = decodeSourceRevision(evidence.previousSourceRevision);
    const next = decodeSourceRevision(evidence.committedSourceRevision);
    if (!previous.ok || !next.ok || previous.value !== expectedPrevious || next.value !== previous.value + 1n
      || evidence.previousChainDigest !== expectedPreviousChain || committed.has(evidence.committedSourceRevision)) return false;
    if (next.value === receiptRevision && evidence.receiptDigest !== receiptDigest) return false;
    committed.add(evidence.committedSourceRevision);
    expectedPrevious = next.value;
    expectedPreviousChain = evidence.chainDigest;
  }
  return expectedPrevious === currentRevision && expectedPreviousChain === currentChainDigest;
}

function reconcileCommittedSourceReceiptFixture(
  persisted: ReceiptBackedOperationFixture,
  input: ReconcileCommittedSourceReceiptInput,
  currentEpoch: number,
): ReceiptReconciliationResult {
  if (persisted.namespaceFingerprint !== input.namespaceFingerprint
    || persisted.generationId !== input.generationId
    || persisted.operationId !== input.operationId
    || !persisted.admitted) {
    return { ok: false, code: 'RECONCILIATION_OPERATION_NOT_ADMITTED' };
  }
  if (persisted.coordinationEpoch !== currentEpoch) {
    return { ok: false, code: 'RECONCILIATION_STALE_EPOCH' };
  }
  if (persisted.receiptDigest === null || persisted.previousSourceRevision === null
    || persisted.committedSourceRevision === null) {
    return { ok: false, code: 'RECONCILIATION_RECEIPT_NOT_FOUND' };
  }
  const previousRevision = decodeSourceRevision(persisted.previousSourceRevision);
  const committedRevision = decodeSourceRevision(persisted.committedSourceRevision);
  const authorityRevision = decodeSourceRevision(persisted.sourceAuthorityRevision);
  const entityRevision = decodeSourceRevision(persisted.currentEntitySourceRevision);
  if (!previousRevision.ok || !committedRevision.ok || !authorityRevision.ok || !entityRevision.ok) {
    return { ok: false, code: 'RECONCILIATION_CORRUPT_PERSISTED_STATE' };
  }
  if (!persisted.immutableOutboxIntentMatches) {
    return { ok: false, code: 'RECONCILIATION_RECEIPT_DIGEST_MISMATCH' };
  }
  if (committedRevision.value !== previousRevision.value + 1n
    || authorityRevision.value < committedRevision.value
    || entityRevision.value < committedRevision.value
    || !validReceiptLineage(committedRevision.value, authorityRevision.value,
      persisted.receiptDigest, persisted.receiptChain, persisted.sourceAuthorityChainDigest)) {
    return { ok: false, code: 'RECONCILIATION_SOURCE_REVISION_MISMATCH' };
  }
  if (!persisted.currentAuthorityDigestMatchesChain) {
    return { ok: false, code: 'RECONCILIATION_SOURCE_REVISION_MISMATCH' };
  }
  if (entityRevision.value === committedRevision.value && !persisted.currentEntityDigestMatchesReceipt) {
    return { ok: false, code: 'RECONCILIATION_RECEIPT_DIGEST_MISMATCH' };
  }
  if (persisted.terminal === 'failed' || persisted.terminal === 'aborted') {
    return { ok: false, code: 'RECONCILIATION_TERMINAL_CONFLICT' };
  }
  if (persisted.terminal === 'committed') {
    if (persisted.terminalReceiptDigest !== persisted.receiptDigest) {
      return { ok: false, code: 'RECONCILIATION_TERMINAL_CONFLICT' };
    }
    return { ok: true, operation: persisted, reused: true };
  }
  return {
    ok: true,
    reused: false,
    operation: Object.freeze({
      ...persisted,
      terminal: 'committed',
      terminalReceiptDigest: persisted.receiptDigest,
    }),
  };
}

function receiptBackedOperation(
  overrides: Partial<ReceiptBackedOperationFixture> = {},
): ReceiptBackedOperationFixture {
  return Object.freeze({
    namespaceFingerprint: 'namespace-digest',
    generationId: 'generation-a',
    operationId: 'operation-a',
    coordinationEpoch: 7,
    admissionReceiptDigest: 'admission-digest',
    receiptDigest: 'receipt-digest',
    previousSourceRevision: '40',
    committedSourceRevision: '41',
    sourceAuthorityRevision: '41',
    sourceAuthorityChainDigest: revisionEvidence('operation-a', '40', '41', 'bootstrap-chain', 'receipt-digest').chainDigest,
    receiptChain: Object.freeze([revisionEvidence('operation-a', '40', '41', 'bootstrap-chain', 'receipt-digest')]),
    currentEntitySourceRevision: '41',
    currentEntityLifecycle: 'active',
    currentEntityDigestMatchesReceipt: true,
    currentAuthorityDigestMatchesChain: true,
    immutableOutboxIntentMatches: true,
    outboxDeliveryStatus: 'pending',
    admitted: true,
    terminal: 'absent',
    terminalReceiptDigest: null,
    ...overrides,
  });
}

type DrainAdmissionDecision =
  | 'SOURCE_COMMIT_ALLOWED'
  | 'RECONCILE_ONLY'
  | 'NEW_ADMISSION_CLOSED'
  | 'STALE_EPOCH'
  | 'OPERATION_ALREADY_TERMINAL';

function evaluateDrainAwareAdmission(input: Readonly<{
  admittedBeforeDrain: boolean;
  drainState: 'open' | 'requested' | 'closed' | 'quiescent';
  admissionEpoch: number;
  currentEpoch: number;
  terminal: boolean;
  receiptExists: boolean;
}>): DrainAdmissionDecision {
  if (input.admissionEpoch !== input.currentEpoch) return 'STALE_EPOCH';
  if (!input.admittedBeforeDrain && input.drainState !== 'open') return 'NEW_ADMISSION_CLOSED';
  if (input.terminal) return 'OPERATION_ALREADY_TERMINAL';
  if (input.receiptExists) return 'RECONCILE_ONLY';
  return 'SOURCE_COMMIT_ALLOWED';
}

type BootstrapEvidenceFixture = Readonly<{
  authorityRecordVersion: 'source-authority-bootstrap-v1';
  namespaceFingerprint: string;
  namespaceKeyDigest: string;
  generationId: string;
  revision: '0';
  activeGeneration: true;
  databaseName: 'absinthe-local-v2';
  databaseSchemaVersion: number;
  sourceProtocolVersion: string;
  sourceImplementationId: string;
  entityCount: number;
  noteCount: number;
  folderCount: number;
  tombstoneCount: number;
  relationshipCount: number;
  relationshipDigest: string;
  aggregateEntityDigest: string;
  attachmentMetadataCount: number;
  attachmentMetadataDigest: string;
  attachmentBlobAtomicity: 'not_claimed';
  outboxCount: number;
  generationManifestDigest: string;
  outboxBaselineDigest: string;
  checkpointDigest: string;
  checkpointCount: number;
  checkpointVersion: string;
  coordinationEpoch: number;
  coordinationStateDigest: string;
  bootstrapMethodVersion: string;
}>;

type BootstrapResult =
  | Readonly<{ ok: true; authority: BootstrapEvidenceFixture; reused: boolean }>
  | Readonly<{ ok: false; code:
      | 'SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT'
      | 'SOURCE_AUTHORITY_BOOTSTRAP_NOT_QUIESCENT'
      | 'SOURCE_AUTHORITY_BOOTSTRAP_SESSION_CONFLICT' }>;

type BootstrapCandidateFixture = Omit<BootstrapEvidenceFixture,
  'revision'>;

const ATTACHMENT_METADATA_AUTHORITY_POLICY = Object.freeze({
  authorityBearing: Object.freeze([
    'attachmentId', 'generationId', 'canonicalReferenceIds', 'contentChecksum',
    'storageObjectIdentity', 'createdSourceRevision', 'lastMutatedSourceRevision',
    'deletedSourceRevision',
  ]),
  operationalProjection: Object.freeze([
    'localAvailability', 'remoteAvailability', 'syncState', 'transferProgress', 'retryState',
    'leaseState', 'lastErrorCode', 'cacheState', 'observedAt', 'updatedAt',
  ]),
  excluded: Object.freeze(['blobBytes', 'externalProviderPayload', 'cacheBytes', 'authData']),
  ambiguousCurrentFieldsFailWith: 'ATTACHMENT_AUTHORITY_CLASSIFICATION_REQUIRED',
  attachmentBlobAtomicity: 'not_claimed',
});

type AttachmentProjectionFixture = Readonly<{
  canonical: Readonly<{
    attachmentId: string;
    generationId: string;
    canonicalReferenceIds: readonly string[];
    contentChecksum: string;
    storageObjectIdentity: string;
    createdSourceRevision: string;
    lastMutatedSourceRevision: string;
    deletedSourceRevision: string | null;
  }>;
  operational: Readonly<{
    localAvailability: string;
    remoteAvailability: string;
    syncState: string;
    retryCount: number;
    leaseOwner: string | null;
    remoteAcknowledgedAt: string | null;
    updatedAt: string;
  }>;
}>;

function attachmentAuthorityDigestFixture(input: AttachmentProjectionFixture): string {
  const canonical = input.canonical;
  return `sha256:${JSON.stringify(['attachment-authority-v1', canonical.attachmentId,
    canonical.generationId, [...canonical.canonicalReferenceIds].sort(), canonical.contentChecksum,
    canonical.storageObjectIdentity, canonical.createdSourceRevision,
    canonical.lastMutatedSourceRevision, canonical.deletedSourceRevision ?? null])}`;
}

function attachmentProjectionFixture(
  canonicalOverrides: Partial<AttachmentProjectionFixture['canonical']> = {},
  operationalOverrides: Partial<AttachmentProjectionFixture['operational']> = {},
): AttachmentProjectionFixture {
  return Object.freeze({
    canonical: Object.freeze({
      attachmentId: 'attachment-a', generationId: 'generation-a',
      canonicalReferenceIds: Object.freeze(['note-a']), contentChecksum: 'sha256:content-a',
      storageObjectIdentity: 'object-a', createdSourceRevision: '1',
      lastMutatedSourceRevision: '1', deletedSourceRevision: null, ...canonicalOverrides,
    }),
    operational: Object.freeze({
      localAvailability: 'present', remoteAvailability: 'unknown', syncState: 'pending',
      retryCount: 0, leaseOwner: null, remoteAcknowledgedAt: null,
      updatedAt: '2026-07-17T00:00:00.000Z', ...operationalOverrides,
    }),
  });
}

function bootstrapCandidate(
  overrides: Partial<BootstrapCandidateFixture> = {},
): BootstrapCandidateFixture {
  return Object.freeze({
    authorityRecordVersion: 'source-authority-bootstrap-v1',
    namespaceFingerprint: 'namespace-digest',
    namespaceKeyDigest: 'namespace-key-digest',
    generationId: 'generation-a',
    activeGeneration: true,
    databaseName: 'absinthe-local-v2',
    databaseSchemaVersion: 4,
    sourceProtocolVersion: 'source-protocol-v1',
    sourceImplementationId: 'local-first-source-v1',
    entityCount: 108,
    noteCount: 103,
    folderCount: 5,
    tombstoneCount: 2,
    relationshipCount: 108,
    relationshipDigest: 'relationship-digest',
    aggregateEntityDigest: 'entity-digest',
    attachmentMetadataCount: 3,
    attachmentMetadataDigest: 'attachment-metadata-digest',
    attachmentBlobAtomicity: 'not_claimed',
    outboxCount: 0,
    generationManifestDigest: 'manifest-digest',
    outboxBaselineDigest: 'outbox-digest',
    checkpointDigest: 'checkpoint-digest',
    checkpointCount: 1,
    checkpointVersion: 'checkpoint-v1',
    coordinationEpoch: 7,
    coordinationStateDigest: 'coordination-digest',
    bootstrapMethodVersion: 'bootstrap-v1',
    ...overrides,
  });
}

function bootstrapSourceAuthorityFixture(
  existing: BootstrapEvidenceFixture | null,
  candidate: BootstrapCandidateFixture,
): BootstrapResult {
  const authority = Object.freeze({ ...candidate, revision: '0' as const });
  if (existing === null) return { ok: true, authority, reused: false };
  const canonical = (value: BootstrapEvidenceFixture): string => JSON.stringify([
    value.authorityRecordVersion, value.namespaceFingerprint, value.namespaceKeyDigest,
    value.generationId, value.revision, value.activeGeneration, value.databaseName,
    value.databaseSchemaVersion, value.sourceProtocolVersion, value.sourceImplementationId,
    value.entityCount, value.noteCount, value.folderCount, value.tombstoneCount,
    value.relationshipCount, value.relationshipDigest, value.aggregateEntityDigest,
    value.attachmentMetadataCount, value.attachmentMetadataDigest, value.attachmentBlobAtomicity,
    value.outboxCount, value.generationManifestDigest, value.outboxBaselineDigest,
    value.checkpointDigest, value.checkpointCount, value.checkpointVersion,
    value.coordinationEpoch, value.coordinationStateDigest, value.bootstrapMethodVersion,
  ]);
  const existingCanonical = canonical(existing);
  const candidateCanonical = canonical(authority);
  if (existingCanonical !== candidateCanonical) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT' };
  }
  return { ok: true, authority: existing, reused: true };
}

type RestoreChunkReceiptFixture = Readonly<{
  receiptVersion: 'restore-chunk-receipt-v1';
  restoreSessionId: string;
  namespaceFingerprint: string;
  generationId: string;
  maintenanceOwnerDigest: string;
  chunkIndex: number;
  previousChunkReceiptDigest: string;
  previousSourceRevision: string;
  committedSourceRevision: string;
  planDigest: string;
  chunkInputDigest: string;
  chunkResultDigest: string;
  affectedEntityDigest: string;
  affectedEntityCount: number;
  attachmentMetadataDigest: string;
  attachmentMetadataCount: number;
  immutableOutboxIntentDigest: string;
  immutableOutboxIntentCount: number;
  checkpointEffectDigest: string;
  committedAuthorityDigest: string;
  resultingSourceChainDigest: string;
  protocolVersion: string;
  sourceImplementationId: string;
  chunkReceiptDigest: string;
}>;

type RestoreFinalManifestFixture = Readonly<{
  manifestVersion: 'restore-final-manifest-v1';
  restoreSessionId: string;
  namespaceFingerprint: string;
  generationId: string;
  baseSourceRevision: string;
  finalCommittedSourceRevision: string;
  immutablePlanDigest: string;
  finalChunkIndex: number;
  finalChunkCount: number;
  orderedChunkChainDigest: string;
  finalSourceReceiptChainHead: string;
  completeAuthorityDigest: string;
  finalEntityCount: number;
  finalEntityDigest: string;
  finalAttachmentMetadataCount: number;
  finalAttachmentMetadataDigest: string;
  finalOutboxCount: number;
  finalOutboxIntentDigest: string;
  finalCheckpointDigest: string;
  coordinationEpoch: number;
  coordinationQuiescenceDigest: string;
  protocolVersion: string;
  sourceImplementationId: string;
  completionState: 'complete';
  evidenceOnly: true;
  sourceRevisionIncremented: false;
  finalManifestDigest: string;
}>;

type ChunkedRestoreFixture = Readonly<{
  restoreSessionId: string;
  namespaceFingerprint: string;
  generationId: string;
  maintenanceOwnerDigest: string;
  baseSourceRevision: string;
  planDigest: string;
  restoreManifestDigest: string;
  protocolVersion: string;
  plannedChunkDigests: readonly string[];
  receipts: readonly RestoreChunkReceiptFixture[];
  recordedCursor: number;
  status: 'in_progress' | 'finalized' | 'corrupt';
  finalManifest: RestoreFinalManifestFixture | null;
}>;

type RestoreChunkResult =
  | Readonly<{ ok: true; state: ChunkedRestoreFixture; receipt: RestoreChunkReceiptFixture; reused: boolean }>
  | Readonly<{ ok: false; code: 'RESTORE_CHUNK_SKIPPED' | 'RESTORE_CHUNK_CONFLICT' | 'RESTORE_CHAIN_CORRUPT' }>;

function restoreFixture(): ChunkedRestoreFixture {
  return Object.freeze({
    restoreSessionId: 'restore-session-a',
    namespaceFingerprint: 'namespace-digest',
    generationId: 'generation-a',
    maintenanceOwnerDigest: 'maintenance-owner-digest',
    baseSourceRevision: '10',
    planDigest: 'restore-plan-digest',
    restoreManifestDigest: 'restore-manifest-digest',
    protocolVersion: 'restore-protocol-v1',
    plannedChunkDigests: Object.freeze(['chunk-input-0', 'chunk-input-1']),
    receipts: Object.freeze([]),
    recordedCursor: 0,
    status: 'in_progress',
    finalManifest: null,
  });
}

function canonicalRestoreChunkReceiptPreimage(
  receipt: Omit<RestoreChunkReceiptFixture, 'chunkReceiptDigest'>,
): string {
  return JSON.stringify([
    receipt.receiptVersion, receipt.restoreSessionId, receipt.namespaceFingerprint,
    receipt.generationId, receipt.maintenanceOwnerDigest, receipt.chunkIndex,
    receipt.previousChunkReceiptDigest, receipt.previousSourceRevision,
    receipt.committedSourceRevision, receipt.planDigest, receipt.chunkInputDigest,
    receipt.chunkResultDigest, receipt.affectedEntityDigest, receipt.affectedEntityCount,
    receipt.attachmentMetadataDigest, receipt.attachmentMetadataCount,
    receipt.immutableOutboxIntentDigest, receipt.immutableOutboxIntentCount,
    receipt.checkpointEffectDigest, receipt.committedAuthorityDigest,
    receipt.resultingSourceChainDigest, receipt.protocolVersion, receipt.sourceImplementationId,
  ]);
}

function canonicalRestoreFinalManifestPreimage(
  manifest: Omit<RestoreFinalManifestFixture, 'finalManifestDigest'>,
): string {
  return JSON.stringify([
    manifest.manifestVersion, manifest.restoreSessionId, manifest.namespaceFingerprint,
    manifest.generationId, manifest.baseSourceRevision, manifest.finalCommittedSourceRevision,
    manifest.immutablePlanDigest, manifest.finalChunkIndex, manifest.finalChunkCount,
    manifest.orderedChunkChainDigest, manifest.finalSourceReceiptChainHead,
    manifest.completeAuthorityDigest, manifest.finalEntityCount, manifest.finalEntityDigest,
    manifest.finalAttachmentMetadataCount, manifest.finalAttachmentMetadataDigest,
    manifest.finalOutboxCount, manifest.finalOutboxIntentDigest, manifest.finalCheckpointDigest,
    manifest.coordinationEpoch, manifest.coordinationQuiescenceDigest,
    manifest.protocolVersion, manifest.sourceImplementationId, manifest.completionState,
    manifest.evidenceOnly, manifest.sourceRevisionIncremented,
  ]);
}

function commitRestoreChunkFixture(
  state: ChunkedRestoreFixture,
  chunkIndex: number,
  chunkInputDigest: string,
): RestoreChunkResult {
  if (state.status !== 'in_progress') return { ok: false, code: 'RESTORE_CHAIN_CORRUPT' };
  const existing = state.receipts[chunkIndex];
  if (existing) {
    return existing.chunkInputDigest === chunkInputDigest
      ? { ok: true, state, receipt: existing, reused: true }
      : { ok: false, code: 'RESTORE_CHUNK_CONFLICT' };
  }
  if (chunkIndex !== state.receipts.length || state.plannedChunkDigests[chunkIndex] !== chunkInputDigest) {
    return { ok: false, code: chunkIndex > state.receipts.length ? 'RESTORE_CHUNK_SKIPPED' : 'RESTORE_CHUNK_CONFLICT' };
  }
  const previous = state.receipts.at(-1);
  const previousRevision = previous?.committedSourceRevision ?? state.baseSourceRevision;
  const decoded = decodeSourceRevision(previousRevision);
  if (!decoded.ok) return { ok: false, code: 'RESTORE_CHAIN_CORRUPT' };
  const committedSourceRevision = (decoded.value + 1n).toString(10);
  const previousChunkReceiptDigest = previous?.chunkReceiptDigest ?? 'restore-chain-root';
  const receiptWithoutDigest = Object.freeze({
    receiptVersion: 'restore-chunk-receipt-v1' as const,
    restoreSessionId: state.restoreSessionId,
    namespaceFingerprint: state.namespaceFingerprint,
    generationId: state.generationId,
    maintenanceOwnerDigest: state.maintenanceOwnerDigest,
    chunkIndex,
    previousChunkReceiptDigest,
    previousSourceRevision: previousRevision,
    committedSourceRevision,
    planDigest: state.planDigest,
    chunkInputDigest,
    chunkResultDigest: `chunk-result:${chunkIndex}`,
    affectedEntityDigest: `entities:${chunkIndex}`,
    affectedEntityCount: 54,
    attachmentMetadataDigest: `attachments:${chunkIndex}`,
    attachmentMetadataCount: 2,
    immutableOutboxIntentDigest: `outbox-intent:${chunkIndex}`,
    immutableOutboxIntentCount: 54,
    checkpointEffectDigest: `checkpoint:${chunkIndex}`,
    committedAuthorityDigest: `authority:${committedSourceRevision}`,
    resultingSourceChainDigest: `source-chain:${previousChunkReceiptDigest}:${committedSourceRevision}`,
    protocolVersion: state.protocolVersion,
    sourceImplementationId: 'local-first-source-v1',
  });
  const receipt = Object.freeze({ ...receiptWithoutDigest,
    chunkReceiptDigest: `sha256:${canonicalRestoreChunkReceiptPreimage(receiptWithoutDigest)}` });
  return { ok: true, receipt, reused: false, state: Object.freeze({
    ...state, receipts: Object.freeze([...state.receipts, receipt]), recordedCursor: chunkIndex + 1,
  }) };
}

type RestoreFinalizeResult =
  | Readonly<{ ok: true; state: ChunkedRestoreFixture; manifest: RestoreFinalManifestFixture }>
  | Readonly<{ ok: false; code: 'RESTORE_FINALIZATION_INCOMPLETE' | 'RESTORE_FINAL_DIGEST_MISMATCH' }>;

function restoreRestartCursor(state: ChunkedRestoreFixture): number | null {
  for (let index = 0; index < state.receipts.length; index += 1) {
    const current = state.receipts[index];
    const previous = state.receipts[index - 1];
    if (current.chunkIndex !== index
      || current.previousChunkReceiptDigest !== (previous?.chunkReceiptDigest ?? 'restore-chain-root')
      || current.previousSourceRevision !== (previous?.committedSourceRevision ?? state.baseSourceRevision)) return null;
  }
  return state.recordedCursor === state.receipts.length ? state.receipts.length : null;
}

function restoreEligible(state: ChunkedRestoreFixture): boolean {
  return state.status === 'finalized' && state.finalManifest !== null
    && state.finalManifest.completionState === 'complete'
    && state.finalManifest.orderedChunkChainDigest === state.receipts.at(-1)?.chunkReceiptDigest
    && restoreRestartCursor(state) === state.plannedChunkDigests.length;
}

const K331D_BOUNDS = Object.freeze({
  receiptsPerSegment: 64,
  segmentCanonicalBytes: 256 * 1024,
  membershipHashNodes: 64,
  membershipProofBytes: 16 * 1024,
  rawReceiptReads: 64,
  bootstrapRecordsPerSegment: 64,
  bootstrapSegmentCanonicalBytes: 256 * 1024,
  bootstrapEvidenceBytes: 8 * 1024,
});

type ReceiptMembershipProofFixture = Readonly<{
  proofVersion: 'receipt-membership-proof-v1';
  receiptRevision: unknown;
  receiptDigest: string;
  segmentIndex: number;
  segmentStartRevision: unknown;
  segmentEndRevision: unknown;
  segmentRootDigest: string;
  accumulatorRootDigest: string;
  currentChainHeadDigest: string;
  hashNodes: readonly string[];
  encodedBytes: number;
  rawReceiptReads: number;
  sealed: boolean;
  compactedMembershipIndexPresent: boolean;
  proofAuthenticatesReceipt: boolean;
  checkpointPathValid: boolean;
  checkpointCoordinatesUnique: boolean;
}>;

function verifyBoundedReceiptMembership(
  proof: ReceiptMembershipProofFixture | null,
  expectedReceiptRevision: string,
  expectedReceiptDigest: string,
): 'VERIFIED'
  | 'LINEAGE_MEMBERSHIP_PROOF_MISSING'
  | 'LINEAGE_MEMBERSHIP_PROOF_INVALID'
  | 'LINEAGE_SEGMENT_CHECKPOINT_CONFLICT'
  | 'RECEIPT_MEMBERSHIP_PROOF_BOUND_EXCEEDED'
  | 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE' {
  if (proof === null) return 'LINEAGE_MEMBERSHIP_PROOF_MISSING';
  const revisions = [proof.receiptRevision, proof.segmentStartRevision, proof.segmentEndRevision]
    .map(decodeSourceRevision);
  if (revisions.some(revision => !revision.ok)) return 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE';
  const [receipt, start, end] = revisions;
  if (!receipt.ok || !start.ok || !end.ok) return 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE';
  if (proof.hashNodes.length > K331D_BOUNDS.membershipHashNodes
    || proof.encodedBytes > K331D_BOUNDS.membershipProofBytes
    || proof.rawReceiptReads > K331D_BOUNDS.rawReceiptReads) return 'RECEIPT_MEMBERSHIP_PROOF_BOUND_EXCEEDED';
  if (!proof.checkpointPathValid || !proof.checkpointCoordinatesUnique) {
    return 'LINEAGE_SEGMENT_CHECKPOINT_CONFLICT';
  }
  if (receipt.canonical !== expectedReceiptRevision || proof.receiptDigest !== expectedReceiptDigest
    || receipt.value < start.value || receipt.value > end.value || !proof.proofAuthenticatesReceipt
    || proof.currentChainHeadDigest.length === 0 || proof.accumulatorRootDigest.length === 0) {
    return 'LINEAGE_MEMBERSHIP_PROOF_INVALID';
  }
  if (proof.sealed && !proof.compactedMembershipIndexPresent) return 'LINEAGE_MEMBERSHIP_PROOF_MISSING';
  return 'VERIFIED';
}

const RECEIPT_RETENTION_POLICY = Object.freeze({
  sealedSegmentSize: 64,
  minimumLaterSealedSegmentsBeforeCompaction: 2,
  neverCompact: Object.freeze([
    'UNRESOLVED_OPERATION', 'PENDING_RECEIPT_RECONCILIATION', 'ACTIVE_RESTORE_REFERENCE',
    'ACTIVE_MIGRATION_REFERENCE', 'CORRUPTION_HOLD', 'UNSEALED_SEGMENT',
  ]),
  compactionTransaction: Object.freeze([
    'write_immutable_compacted_membership_index', 'write_purge_certificate_when_applicable',
    'delete_raw_receipt',
  ]),
  sourceRevisionEffect: 'NONE_EVIDENCE_ONLY',
});

type CompactedReceiptIndexFixture = Readonly<{
  operationId: string;
  sourceRevision: string;
  receiptDigest: string;
  segmentIndex: number;
  checkpointDigest: string;
  terminalReceiptDigest: string;
  membershipLocatorDigest: string;
}>;

type ReceiptCompactionFixture = Readonly<{
  operationId: string;
  sourceRevision: string;
  receiptDigest: string;
  terminalReceiptDigest: string | null;
  unresolved: boolean;
  pendingReconciliation: boolean;
  activeRestoreReference: boolean;
  corruptionHold: boolean;
  segmentSealed: boolean;
  membershipProofValid: boolean;
  laterSealedSegmentCount: number;
  existingIndex: CompactedReceiptIndexFixture | null;
  rawReceiptPresent: boolean;
}>;

type ReceiptCompactionResult = Readonly<{
  ok: true;
  reused: boolean;
  index: CompactedReceiptIndexFixture;
  rawReceiptPresent: false;
}> | Readonly<{
  ok: false;
  code: 'LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE'
    | 'LINEAGE_MEMBERSHIP_PROOF_MISSING'
    | 'LINEAGE_COMPACTION_CONFLICT';
}>;

function compactReceiptFixture(input: ReceiptCompactionFixture): ReceiptCompactionResult {
  if (input.unresolved || input.pendingReconciliation || input.activeRestoreReference
    || input.corruptionHold || input.terminalReceiptDigest === null) {
    return { ok: false, code: 'LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE' };
  }
  if (!input.segmentSealed || !input.membershipProofValid
    || input.laterSealedSegmentCount < RECEIPT_RETENTION_POLICY.minimumLaterSealedSegmentsBeforeCompaction) {
    return { ok: false, code: 'LINEAGE_MEMBERSHIP_PROOF_MISSING' };
  }
  const index = Object.freeze({
    operationId: input.operationId, sourceRevision: input.sourceRevision,
    receiptDigest: input.receiptDigest, segmentIndex: 0, checkpointDigest: 'checkpoint:0',
    terminalReceiptDigest: input.terminalReceiptDigest,
    membershipLocatorDigest: `membership:${input.sourceRevision}:${input.receiptDigest}`,
  });
  if (input.existingIndex !== null) {
    return JSON.stringify(input.existingIndex) === JSON.stringify(index)
      ? { ok: true, reused: true, index: input.existingIndex, rawReceiptPresent: false }
      : { ok: false, code: 'LINEAGE_COMPACTION_CONFLICT' };
  }
  return { ok: true, reused: false, index, rawReceiptPresent: false };
}

function compactableReceipt(
  overrides: Partial<ReceiptCompactionFixture> = {},
): ReceiptCompactionFixture {
  return Object.freeze({
    operationId: 'operation-a', sourceRevision: '41', receiptDigest: 'receipt:41',
    terminalReceiptDigest: 'receipt:41', unresolved: false, pendingReconciliation: false,
    activeRestoreReference: false, corruptionHold: false, segmentSealed: true,
    membershipProofValid: true, laterSealedSegmentCount: 2, existingIndex: null,
    rawReceiptPresent: true, ...overrides,
  });
}

type DurableQuiescenceGraphFixture = Readonly<{
  admissionOpen: boolean;
  coordinationState: 'open' | 'draining' | 'quiescent' | 'transitioning';
  operations: readonly Readonly<{
    admitted: boolean;
    terminal: 'absent' | 'committed' | 'failed' | 'aborted';
    receiptPresent: boolean;
  }>[];
  registrations: readonly Readonly<{ lifecycle: 'registered' | 'draining' | 'quiescent' | 'retired' }>[];
  sessions: readonly Readonly<{
    kind: 'restore' | 'migration' | 'recovery' | 'bootstrap' | 'maintenance';
    status: 'planned' | 'active' | 'complete' | 'failed' | 'cancelled';
  }>[];
  authorityEpochTransition: 'idle' | 'prepared' | 'committing';
}>;

type DerivedQuiescenceFixture = Readonly<{
  admittedOperationCount: number;
  unresolvedOperationCount: number;
  pendingReceiptReconciliationCount: number;
  nonQuiescentWriterCount: number;
  activeMaintenanceSessionCount: number;
  epochTransitionInProgress: boolean;
  quiescent: boolean;
}>;

function deriveDurableQuiescence(graph: DurableQuiescenceGraphFixture): DerivedQuiescenceFixture {
  const admitted = graph.operations.filter(operation => operation.admitted);
  const unresolved = admitted.filter(operation => operation.terminal === 'absent');
  const pendingReceiptReconciliation = unresolved.filter(operation => operation.receiptPresent);
  const nonQuiescentWriterCount = graph.registrations
    .filter(registration => registration.lifecycle !== 'quiescent' && registration.lifecycle !== 'retired').length;
  const activeMaintenanceSessionCount = graph.sessions
    .filter(session => session.status === 'planned' || session.status === 'active').length;
  const epochTransitionInProgress = graph.authorityEpochTransition !== 'idle'
    || graph.coordinationState === 'transitioning';
  return Object.freeze({
    admittedOperationCount: admitted.length,
    unresolvedOperationCount: unresolved.length,
    pendingReceiptReconciliationCount: pendingReceiptReconciliation.length,
    nonQuiescentWriterCount,
    activeMaintenanceSessionCount,
    epochTransitionInProgress,
    quiescent: !graph.admissionOpen && graph.coordinationState === 'quiescent'
      && unresolved.length === 0 && nonQuiescentWriterCount === 0
      && activeMaintenanceSessionCount === 0 && !epochTransitionInProgress,
  });
}

function quiescentGraph(
  overrides: Partial<DurableQuiescenceGraphFixture> = {},
): DurableQuiescenceGraphFixture {
  return Object.freeze({
    admissionOpen: false,
    coordinationState: 'quiescent',
    operations: Object.freeze([
      Object.freeze({ admitted: true, terminal: 'committed', receiptPresent: true }),
    ]),
    registrations: Object.freeze([Object.freeze({ lifecycle: 'quiescent' })]),
    sessions: Object.freeze([]),
    authorityEpochTransition: 'idle',
    ...overrides,
  });
}

type BootstrapSegmentFixture = Readonly<{
  kind: 'absinthe_source_bootstrap_segment';
  schemaVersion: 1;
  sessionId: string;
  namespaceFingerprint: string;
  generationId: string;
  category: 'entities' | 'attachments' | 'outbox' | 'checkpoints';
  segmentIndex: number;
  recordCount: number;
  canonicalBytes: number;
  evidenceBytes: number;
  keyRangeDigest: string;
  segmentRootDigest: string;
  previousSegmentDigest: string | null;
  baselineDigest: string;
}>;

type BootstrapGraphFixture = Readonly<{
  sessionId: string;
  namespaceFingerprint: string;
  generationId: string;
  baselineDigest: string;
  currentBaselineDigest: string;
  sourceAuthorityExists: boolean;
  segmentPlan: readonly Readonly<{ category: BootstrapSegmentFixture['category']; count: number }>[];
  segments: readonly BootstrapSegmentFixture[];
  quiescenceGraph: DurableQuiescenceGraphFixture;
  attachmentAuthorityClassified: boolean;
}>;

type StagedBootstrapResult = Readonly<{
  ok: boolean;
  code: 'SOURCE_AUTHORITY_BOOTSTRAP_READY'
    | 'SOURCE_AUTHORITY_BOOTSTRAP_SEGMENT_BOUND_EXCEEDED'
    | 'SOURCE_AUTHORITY_BOOTSTRAP_BASELINE_CHANGED'
    | 'SOURCE_AUTHORITY_BOOTSTRAP_SEGMENT_SET_MISMATCH'
    | 'SOURCE_AUTHORITY_BOOTSTRAP_NOT_QUIESCENT'
    | 'ATTACHMENT_AUTHORITY_CLASSIFICATION_REQUIRED';
  evidenceDigest?: string;
}>;

function canonicalBootstrapPreimage(graph: BootstrapGraphFixture): string {
  const ordered = [...graph.segments].sort((left, right) => {
    const category = left.category < right.category ? -1 : left.category > right.category ? 1 : 0;
    return category || left.segmentIndex - right.segmentIndex;
  });
  return JSON.stringify([
    'absinthe-source-bootstrap-evidence', 1, graph.sessionId.normalize('NFC'),
    graph.namespaceFingerprint, graph.generationId, graph.baselineDigest,
    ordered.map(segment => [segment.category, segment.segmentIndex, segment.recordCount,
      segment.canonicalBytes, segment.keyRangeDigest, segment.segmentRootDigest,
      segment.previousSegmentDigest ?? null, segment.baselineDigest]),
  ]);
}

function finalizeStagedBootstrap(graph: BootstrapGraphFixture): StagedBootstrapResult {
  if (graph.sourceAuthorityExists || graph.currentBaselineDigest !== graph.baselineDigest) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_BASELINE_CHANGED' };
  }
  if (!deriveDurableQuiescence(graph.quiescenceGraph).quiescent) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_NOT_QUIESCENT' };
  }
  if (!graph.attachmentAuthorityClassified) {
    return { ok: false, code: 'ATTACHMENT_AUTHORITY_CLASSIFICATION_REQUIRED' };
  }
  if (graph.segments.some(segment => segment.recordCount > K331D_BOUNDS.bootstrapRecordsPerSegment
    || segment.canonicalBytes > K331D_BOUNDS.bootstrapSegmentCanonicalBytes
    || segment.evidenceBytes > K331D_BOUNDS.bootstrapEvidenceBytes)) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_SEGMENT_BOUND_EXCEEDED' };
  }
  const expected = graph.segmentPlan
    .flatMap(plan => Array.from({ length: plan.count }, (_, segmentIndex) => `${plan.category}:${segmentIndex}`))
    .sort();
  const actual = graph.segments.map(segment => `${segment.category}:${segment.segmentIndex}`).sort();
  if (JSON.stringify(expected) !== JSON.stringify(actual)
    || graph.segments.some(segment => segment.sessionId !== graph.sessionId
      || segment.namespaceFingerprint !== graph.namespaceFingerprint
      || segment.generationId !== graph.generationId || segment.baselineDigest !== graph.baselineDigest)) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_SEGMENT_SET_MISMATCH' };
  }
  const preimage = canonicalBootstrapPreimage(graph);
  return { ok: true, code: 'SOURCE_AUTHORITY_BOOTSTRAP_READY', evidenceDigest: `sha256:${preimage}` };
}

function bootstrapGraph(
  overrides: Partial<BootstrapGraphFixture> = {},
): BootstrapGraphFixture {
  const base = Object.freeze({
    sessionId: 'bootstrap-session-a', namespaceFingerprint: 'namespace-digest',
    generationId: 'generation-a', baselineDigest: 'baseline-a',
  });
  const segments = Object.freeze((['entities', 'attachments', 'outbox', 'checkpoints'] as const)
    .map(category => Object.freeze({
      kind: 'absinthe_source_bootstrap_segment' as const, schemaVersion: 1 as const,
      ...base, category, segmentIndex: 0, recordCount: category === 'entities' ? 64 : 4,
      canonicalBytes: 4096, evidenceBytes: 1024, keyRangeDigest: `range:${category}`,
      segmentRootDigest: `root:${category}`, previousSegmentDigest: null,
    })));
  return Object.freeze({
    ...base, currentBaselineDigest: 'baseline-a', sourceAuthorityExists: false,
    segmentPlan: Object.freeze((['entities', 'attachments', 'outbox', 'checkpoints'] as const)
      .map(category => Object.freeze({ category, count: 1 }))),
    segments, quiescenceGraph: quiescentGraph(), attachmentAuthorityClassified: true, ...overrides,
  });
}

function persistBootstrapSegmentFixture(
  existing: BootstrapSegmentFixture | null,
  candidate: BootstrapSegmentFixture,
  currentBaselineDigest: string,
): Readonly<{ ok: true; reused: boolean; segment: BootstrapSegmentFixture }>
  | Readonly<{ ok: false; code: 'BOOTSTRAP_FINALIZATION_STATE_CHANGED' | 'BOOTSTRAP_SEGMENT_CONFLICT' }> {
  if (candidate.baselineDigest !== currentBaselineDigest) {
    return { ok: false, code: 'BOOTSTRAP_FINALIZATION_STATE_CHANGED' };
  }
  if (candidate.recordCount > K331D_BOUNDS.bootstrapRecordsPerSegment
    || candidate.canonicalBytes > K331D_BOUNDS.bootstrapSegmentCanonicalBytes
    || candidate.evidenceBytes > K331D_BOUNDS.bootstrapEvidenceBytes) {
    return { ok: false, code: 'BOOTSTRAP_SEGMENT_CONFLICT' };
  }
  if (existing === null) return { ok: true, reused: false, segment: candidate };
  return JSON.stringify(existing) === JSON.stringify(candidate)
    ? { ok: true, reused: true, segment: existing }
    : { ok: false, code: 'BOOTSTRAP_SEGMENT_CONFLICT' };
}

type EntityRevisionEnvelopeFixture = Readonly<{
  lifecycle: 'active' | 'tombstoned' | 'purged';
  createdSourceRevision: string;
  lastMutatedSourceRevision: string;
  deletedSourceRevision: string | null;
  revisionZeroInitialization: 'native' | 'preexisting_state_not_historical_event';
  purgeCertificateDigest: string | null;
}>;

function transitionEntityRevision(
  current: EntityRevisionEnvelopeFixture | null,
  action: 'create' | 'update' | 'tombstone' | 'resurrect' | 'purge',
  revision: string,
): EntityRevisionEnvelopeFixture | 'INVALID_LIFECYCLE_TRANSITION' {
  if (!decodeSourceRevision(revision).ok) return 'INVALID_LIFECYCLE_TRANSITION';
  if (action === 'create') {
    if (current !== null) return 'INVALID_LIFECYCLE_TRANSITION';
    return Object.freeze({ lifecycle: 'active', createdSourceRevision: revision,
      lastMutatedSourceRevision: revision, deletedSourceRevision: null,
      revisionZeroInitialization: 'native', purgeCertificateDigest: null });
  }
  if (current === null || current.lifecycle === 'purged') return 'INVALID_LIFECYCLE_TRANSITION';
  if (action === 'update' && current.lifecycle === 'active') return Object.freeze({
    ...current, lastMutatedSourceRevision: revision,
  });
  if (action === 'tombstone' && current.lifecycle === 'active') return Object.freeze({
    ...current, lifecycle: 'tombstoned', lastMutatedSourceRevision: revision,
    deletedSourceRevision: revision,
  });
  if (action === 'resurrect' && current.lifecycle === 'tombstoned') return Object.freeze({
    ...current, lifecycle: 'active', lastMutatedSourceRevision: revision, deletedSourceRevision: null,
  });
  if (action === 'purge' && current.lifecycle === 'tombstoned') return Object.freeze({
    ...current, lifecycle: 'purged', lastMutatedSourceRevision: revision,
    deletedSourceRevision: current.deletedSourceRevision, purgeCertificateDigest: `purge:${revision}`,
  });
  return 'INVALID_LIFECYCLE_TRANSITION';
}

const ENTITY_REVISION_MODEL = Object.freeze({
  revisionZeroActive: Object.freeze({ createdSourceRevision: '0', lastMutatedSourceRevision: '0',
    deletedSourceRevision: null, revisionZeroInitialization: 'preexisting_state_not_historical_event' }),
  revisionZeroTombstone: Object.freeze({ createdSourceRevision: '0', lastMutatedSourceRevision: '0',
    deletedSourceRevision: '0', revisionZeroInitialization: 'preexisting_state_not_historical_event' }),
  folders: 'FIRST_CLASS_ENTITY_ENVELOPE',
  relations: 'INDEPENDENT_REVISIONED_RELATION_RECORDS',
  boundedBulk: 'ALL_AFFECTED_RECORDS_SHARE_ONE_COMMITTED_SOURCE_REVISION',
  purge: 'REQUIRES_TOMBSTONE_RECEIPT_MEMBERSHIP_AND_IMMUTABLE_PURGE_CERTIFICATE',
});

type RestorePersistedGraphFixture = Readonly<{
  lookup: Readonly<{ namespaceFingerprint: string; generationId: string; restoreSessionId: string }>;
  session: ChunkedRestoreFixture;
  authorityRevision: unknown;
  authorityDigest: string;
  expectedAuthorityRevision: string;
  expectedAuthorityDigest: string;
  persistedPlanDigest: string;
  authenticatedChunkChainHead: string;
  quiescenceGraph: DurableQuiescenceGraphFixture;
  existingManifest: RestoreFinalManifestFixture | null;
}>;

function finalizeRestoreFromPersistedGraph(
  graph: RestorePersistedGraphFixture,
): RestoreFinalizeResult {
  const authorityRevision = decodeSourceRevision(graph.authorityRevision);
  if (!authorityRevision.ok) return { ok: false, code: 'RESTORE_FINAL_DIGEST_MISMATCH' };
  if (graph.lookup.restoreSessionId !== graph.session.restoreSessionId
    || graph.lookup.namespaceFingerprint !== graph.session.namespaceFingerprint
    || graph.lookup.generationId !== graph.session.generationId
    || graph.persistedPlanDigest !== graph.session.planDigest
    || graph.authenticatedChunkChainHead !== graph.session.receipts.at(-1)?.chunkReceiptDigest
    || restoreRestartCursor(graph.session) !== graph.session.plannedChunkDigests.length
    || authorityRevision.canonical !== graph.expectedAuthorityRevision
    || graph.authorityDigest !== graph.expectedAuthorityDigest
    || !deriveDurableQuiescence(graph.quiescenceGraph).quiescent) {
    return { ok: false, code: 'RESTORE_FINAL_DIGEST_MISMATCH' };
  }
  const last = graph.session.receipts.at(-1);
  if (!last) return { ok: false, code: 'RESTORE_FINALIZATION_INCOMPLETE' };
  const manifestWithoutDigest = Object.freeze({
    manifestVersion: 'restore-final-manifest-v1' as const,
    restoreSessionId: graph.session.restoreSessionId,
    namespaceFingerprint: graph.session.namespaceFingerprint,
    generationId: graph.session.generationId,
    baseSourceRevision: graph.session.baseSourceRevision,
    finalCommittedSourceRevision: last.committedSourceRevision,
    immutablePlanDigest: graph.session.planDigest,
    finalChunkIndex: last.chunkIndex,
    finalChunkCount: graph.session.plannedChunkDigests.length,
    orderedChunkChainDigest: last.chunkReceiptDigest,
    finalSourceReceiptChainHead: last.resultingSourceChainDigest,
    completeAuthorityDigest: graph.authorityDigest,
    finalEntityCount: 108, finalEntityDigest: 'final-entity-digest',
    finalAttachmentMetadataCount: 4, finalAttachmentMetadataDigest: 'final-attachment-digest',
    finalOutboxCount: 108, finalOutboxIntentDigest: 'final-outbox-intent-digest',
    finalCheckpointDigest: 'final-checkpoint-digest', coordinationEpoch: 7,
    coordinationQuiescenceDigest: 'quiescence:7', protocolVersion: graph.session.protocolVersion,
    sourceImplementationId: 'local-first-source-v1',
    completionState: 'complete' as const, evidenceOnly: true as const,
    sourceRevisionIncremented: false as const,
  });
  const manifest = Object.freeze({ ...manifestWithoutDigest,
    finalManifestDigest: `sha256:${canonicalRestoreFinalManifestPreimage(manifestWithoutDigest)}` });
  if (graph.existingManifest !== null) {
    return JSON.stringify(graph.existingManifest) === JSON.stringify(manifest)
      ? { ok: true, state: Object.freeze({ ...graph.session, status: 'finalized', finalManifest: graph.existingManifest }),
        manifest: graph.existingManifest }
      : { ok: false, code: 'RESTORE_FINAL_DIGEST_MISMATCH' };
  }
  return { ok: true, state: Object.freeze({ ...graph.session, status: 'finalized', finalManifest: manifest }), manifest };
}

const K331D_FUTURE_STORES = Object.freeze([
  'source_authority', 'source_mutation_receipts', 'revision_segment_checkpoints',
  'revision_mmr_accumulator', 'compacted_receipt_membership_index', 'purge_certificates',
  'bootstrap_sessions', 'bootstrap_segment_evidence', 'restore_chunk_receipts',
  'restore_final_manifests', 'attachment_canonical_authority', 'attachment_transfer_projection',
]);

const K331D_STABLE_ERRORS = Object.freeze([
  'LINEAGE_MEMBERSHIP_PROOF_MISSING', 'LINEAGE_MEMBERSHIP_PROOF_INVALID',
  'LINEAGE_SEGMENT_CHECKPOINT_CONFLICT', 'LINEAGE_COMPACTION_CONFLICT',
  'LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE', 'BOOTSTRAP_SEGMENT_LIMIT_EXCEEDED',
  'BOOTSTRAP_SEGMENT_CONFLICT', 'BOOTSTRAP_STAGED_PROOF_INCOMPLETE',
  'BOOTSTRAP_FINALIZATION_STATE_CHANGED', 'BOOTSTRAP_NOT_QUIESCENT',
  'RESTORE_FINALIZATION_STATE_CHANGED', 'RESTORE_FINALIZATION_NOT_QUIESCENT',
  'RESTORE_FINALIZATION_CHAIN_MISMATCH', 'RESTORE_FINALIZATION_AUTHORITY_MISMATCH',
  'SOURCE_REVISION_CORRUPT_PERSISTED_STATE', 'ATTACHMENT_AUTHORITY_CLASSIFICATION_REQUIRED',
]);

const K331D_ERROR_CLASSIFICATION = Object.freeze({
  LINEAGE_MEMBERSHIP_PROOF_MISSING: 'NON_RETRYABLE_CORRUPTION',
  LINEAGE_MEMBERSHIP_PROOF_INVALID: 'NON_RETRYABLE_CORRUPTION',
  LINEAGE_SEGMENT_CHECKPOINT_CONFLICT: 'OWNER_INTERVENTION_CORRUPTION',
  LINEAGE_COMPACTION_CONFLICT: 'OWNER_INTERVENTION_CORRUPTION',
  LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE: 'RETRY_AFTER_TERMINAL_PROJECTION',
  BOOTSTRAP_SEGMENT_LIMIT_EXCEEDED: 'RESTART_SESSION_WITH_LOWER_OWNER_LIMIT',
  BOOTSTRAP_SEGMENT_CONFLICT: 'OWNER_INTERVENTION_CORRUPTION',
  BOOTSTRAP_STAGED_PROOF_INCOMPLETE: 'RETRY_MISSING_EXACT_SEGMENT',
  BOOTSTRAP_FINALIZATION_STATE_CHANGED: 'RESTART_SESSION_REQUIRED',
  BOOTSTRAP_NOT_QUIESCENT: 'RETRY_AFTER_DURABLE_QUIESCENCE',
  RESTORE_FINALIZATION_STATE_CHANGED: 'NON_RETRYABLE_STALE_GRAPH',
  RESTORE_FINALIZATION_NOT_QUIESCENT: 'RETRY_AFTER_DURABLE_QUIESCENCE',
  RESTORE_FINALIZATION_CHAIN_MISMATCH: 'OWNER_INTERVENTION_CORRUPTION',
  RESTORE_FINALIZATION_AUTHORITY_MISMATCH: 'OWNER_INTERVENTION_CORRUPTION',
  SOURCE_REVISION_CORRUPT_PERSISTED_STATE: 'OWNER_INTERVENTION_CORRUPTION',
  ATTACHMENT_AUTHORITY_CLASSIFICATION_REQUIRED: 'OWNER_PROTOCOL_DECISION_REQUIRED',
});

const PERSISTED_REVISION_BOUNDARIES = Object.freeze([
  'source_authority', 'source_mutation_receipt', 'segment_checkpoint',
  'compacted_membership_index', 'entity_envelope', 'attachment_authority', 'restore_session',
  'restore_chunk_receipt', 'restore_final_manifest', 'bootstrap_session', 'bootstrap_segment',
] as const);

function decodePersistedRevisionBoundary(
  boundary: typeof PERSISTED_REVISION_BOUNDARIES[number],
  value: unknown,
): Readonly<{ ok: true; revision: string }> | Readonly<{
    ok: false;
    code: 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE';
    context: typeof PERSISTED_REVISION_BOUNDARIES[number];
  }> {
  const decoded = decodeSourceRevision(value);
  return decoded.ok
    ? { ok: true, revision: decoded.canonical }
    : { ok: false, code: 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE', context: boundary };
}

const PER_ENTITY_SOURCE_REVISION_POLICY = Object.freeze({
  selection: 'PER_ENTITY_SOURCE_REVISION_BINDING_REQUIRED',
  fields: Object.freeze(['createdSourceRevision', 'lastMutatedSourceRevision', 'deletedSourceRevision']),
  directDigestComparison: 'ONLY_WHEN_ENTITY_LAST_MUTATED_REVISION_EQUALS_RECEIPT_REVISION',
});

const K331B_FUTURE_TASK_ORDER = Object.freeze([
  'K-332_SOURCE_AUTHORITY_AND_PROTOCOL_CONTRACT',
  'K-333_PROTOCOL_AND_REPOSITORY_MODEL_EXTENSION',
  'K-334_DORMANT_SOURCE_TRANSACTION_REPOSITORY',
  'K-335_DORMANT_COORDINATION_CLIENT',
]);

const CENTRAL_MUTATION_MANIFEST_POLICY = Object.freeze({
  role: 'AUDIT_AND_ADMISSION_INVENTORY',
  routesMutations: false,
  invokesFunctions: false,
  overridesCoordinationAuthority: false,
  wrapperReferenceCardinality: 'EXACTLY_ONE_ENTRY',
});

const FIRST_WRITE_PROTOCOL_POLICY = Object.freeze({
  compatibilityDescriptor: 'transient',
  transition: 'ATOMIC_REGISTER_AND_ADMIT',
  durableRegisteredIdleBoundary: false,
});

const K331A_FIELD_CLASSIFICATION = Object.freeze({
  reused: Object.freeze([
    'writerTypeId', 'contextType', 'capabilities', 'mutationType', 'writerId', 'sessionId', 'operationId',
    'coordinationEpoch', 'admissionTransitionRevision', 'expectedSourceRevision', 'physicalSourceDigest',
    'manifestVersion', 'authorityDigest', 'terminalState', 'drainState', 'checkpointChain',
  ]),
  persistedNew: Object.freeze([
    'contextId', 'semanticMutationKind', 'protocolVersion', 'sourceImplementationId',
    'sourceTransactionReceiptDigest', 'committedSourceRevision', 'maintenanceOwnerIdentity',
  ]),
  transient: Object.freeze(['webLockState', 'pendingPromise', 'uiState', 'runtimeCallback', 'visibilityState']),
});

const PHYSICAL_SINK_REACHABILITY = Object.freeze({
  clearIndexedDbNotes: 'PRODUCTION_REACHABLE_VIA_RESET',
  deleteNoteFromIndexedDb: 'DORMANT_VIA_UNREFERENCED_FACADE',
});

function sourceObservation(): SourceVerificationObservation {
  return {
    physicalSourceDigest: PHYSICAL_SOURCE,
    sourceType: 'indexeddb',
    ownershipProven: true,
    canonical: true,
    withinBounds: true,
    revisionBefore: '41',
    digestBefore: '2'.repeat(64),
    revisionAfter: '41',
    digestAfter: '2'.repeat(64),
    authoritativeSourceDecision: 'indexeddb',
    ambiguityCode: null,
    k328AdapterAvailable: true,
    k328PhysicalSourceDigest: PHYSICAL_SOURCE,
  };
}

describe('K-331 dormant production-writer admission definition', () => {
  it('registers two tab-scoped sessions without transferring identity', () => {
    let state = model();
    const first = registration(0);
    const second = registration(participating.length, {
      writerId: `writer-v1:${first.contextType}:${first.writerTypeId}:${hex(99, 32)}`,
      sessionId: `writer-session-v1:${hex(199, 32)}`,
    });
    state = register(state, first);
    state = register(state, second);
    expect(state.registrations.map(value => value.sessionId)).toEqual([first.sessionId, second.sessionId]);
  });

  it('rejects a capability mismatch at registration', () => {
    const state = model();
    const record = registration(0, { capabilities: ['admission'] });
    expect(reduceWriterCoordination(state, action(
      state,
      { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId },
      { type: 'REGISTER_WRITER', registration: record },
    ))).toEqual({ ok: false, code: 'WRITER_NOT_COORDINATED' });
  });

  it('treats an exact duplicate operation identity as idempotent', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    const admitted = operation(owner, state);
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: admitted,
    });
    const repeated = reduceWriterCoordination(state, action(
      state,
      { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'ADMIT_OPERATION', operation: admitted },
    ));
    expect(repeated).toEqual({ ok: true, state });
  });

  it('rejects a conflicting duplicate operation identity', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    const admitted = operation(owner, state);
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: admitted,
    });
    expect(reduceWriterCoordination(state, action(
      state,
      { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'ADMIT_OPERATION', operation: { ...admitted, expectedSourceRevision: '41' } },
    ))).toEqual({ ok: false, code: 'IN_FLIGHT_STATE_AMBIGUOUS' });
  });

  it('allows a pre-drain admitted operation to terminalize during drain request', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: operation(owner, state),
    });
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'TERMINALIZE_OPERATION',
      operationId: state.operations[0].operationId,
      result: 'committed',
      committedSourceRevision: '41',
    });
    expect(state.authority.unresolvedOperationCount).toBe(0);
    expect(state.operations[0]).toMatchObject({ state: 'committed', committedSourceRevision: '41' });
  });

  it('rejects new admission after the durable drain closure transition', () => {
    let state = registerAll();
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    expect(state.authority).toMatchObject({
      state: 'DRAIN_REQUESTED',
      admissionOpen: false,
      drainRequestTransitionRevision: state.authority.transitionRevision,
    });
    const owner = state.registrations[0];
    expect(reduceWriterCoordination(state, action(
      state,
      { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId },
      { type: 'ADMIT_OPERATION', operation: operation(owner, state) },
    ))).toEqual({ ok: false, code: 'ADMISSION_NOT_CLOSED' });
  });

  it('persists an unresolved admitted operation across deterministic restart', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: operation(owner, state),
    });
    const decoded = decodeWriterCoordinationModelCanonical(encodeWriterCoordinationModelCanonical(state));
    expect(decoded).toMatchObject({ ok: true, value: { authority: { unresolvedOperationCount: 1 } } });
    if (!decoded.ok) throw new Error(decoded.code);
    expect(decoded.value.operations[0].state).toBe('admitted');
  });

  it('blocks quiescence when a crash leaves an operation ambiguous', () => {
    let state = registerAll();
    const owner = state.registrations[0];
    state = apply(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: operation(owner, state),
    });
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    expect(state.authority.unresolvedOperationCount).toBe(1);
    expect(state.operations[0].state).toBe('admitted');
  });

  it('rejects a stale tab action after an epoch transition', () => {
    let state = registerAll();
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    const revision = state.authority.drainRequestTransitionRevision!;
    for (const record of state.registrations) {
      state = apply(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
        type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: revision,
      });
    }
    state = apply(state, coordinator, { type: 'CLOSE_ADMISSION' });
    state = apply(state, coordinator, { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' });
    state = apply(state, coordinator, { type: 'BEGIN_DRAIN' });
    state = apply(state, coordinator, { type: 'MARK_QUIESCENT' });
    const owner = state.registrations[0];
    const stale = action(state, { kind: 'writer', writerId: owner.writerId, sessionId: owner.sessionId }, {
      type: 'ADMIT_OPERATION', operation: operation(owner, state),
    });
    stale.expectedCoordinationEpoch -= 1;
    expect(reduceWriterCoordination(state, stale)).toEqual({ ok: false, code: 'COORDINATION_EPOCH_STALE' });
  });

  it('policy snapshot: Web Locks unsupported fails closed', () => {
    expect(integrationPolicySnapshot({ webLocksAvailable: false, protocolVersion: 1, expectedProtocolVersion: 1,
      maintenanceOwner: null, writerSessionId: 'session-a', writerKind: 'interactive', syncPaused: false }))
      .toBe('WEB_LOCKS_UNAVAILABLE');
  });

  it('policy snapshot: mixed writer-coordination protocol versions are rejected', () => {
    expect(integrationPolicySnapshot({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 2,
      maintenanceOwner: null, writerSessionId: 'session-a', writerKind: 'interactive', syncPaused: false }))
      .toBe('UNSUPPORTED_PROTOCOL_VERSION');
  });

  it('policy snapshot: maintenance admission is exclusive', () => {
    expect(integrationPolicySnapshot({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 1,
      maintenanceOwner: 'maintenance-session', writerSessionId: 'interactive-session',
      writerKind: 'interactive', syncPaused: false })).toBe('MAINTENANCE_ADMISSION_EXCLUSIVE');
  });

  it('policy snapshot: sync apply pauses while the drain policy is active', () => {
    expect(integrationPolicySnapshot({ webLocksAvailable: true, protocolVersion: 1, expectedProtocolVersion: 1,
      maintenanceOwner: null, writerSessionId: 'sync-session', writerKind: 'sync', syncPaused: true }))
      .toBe('SYNC_APPLY_PAUSED');
  });

  it('round-trips restart evidence deterministically without time or browser state', () => {
    const state = registerAll();
    const first = encodeWriterCoordinationModelCanonical(state);
    const decoded = decodeWriterCoordinationModelCanonical(first);
    expect(decoded).toMatchObject({ ok: true });
    if (!decoded.ok) throw new Error(decoded.code);
    expect(encodeWriterCoordinationModelCanonical(decoded.value)).toEqual(first);
  });

  it('architecture fixture: exact source retry returns the existing receipt without another revision', () => {
    const initial: SourceAuthorityFixture = Object.freeze({ revision: '40', receipts: Object.freeze({}), outboxMutationIds: Object.freeze([]) });
    const input: SourceMutationFixture = Object.freeze({
      operationId: 'operation-a', writerSessionId: 'session-a', mutationDigest: 'digest-a', expectedSourceRevision: '40',
    });
    const first = commitSourceFixture(initial, input);
    expect(first).toMatchObject({ ok: true, reused: false, state: { revision: '41', outboxMutationIds: ['outbox:operation-a'] } });
    if (!first.ok) throw new Error(first.code);
    const retry = commitSourceFixture(first.state, input);
    expect(retry).toMatchObject({ ok: true, reused: true, state: { revision: '41', outboxMutationIds: ['outbox:operation-a'] } });
    if (!retry.ok) throw new Error(retry.code);
    expect(retry.receipt).toBe(first.receipt);
  });

  it('architecture fixture: conflicting source receipt reuse fails closed', () => {
    const initial: SourceAuthorityFixture = Object.freeze({ revision: '40', receipts: Object.freeze({}), outboxMutationIds: Object.freeze([]) });
    const first = commitSourceFixture(initial, {
      operationId: 'operation-a', writerSessionId: 'session-a', mutationDigest: 'digest-a', expectedSourceRevision: '40',
    });
    if (!first.ok) throw new Error(first.code);
    expect(commitSourceFixture(first.state, {
      operationId: 'operation-a', writerSessionId: 'session-a', mutationDigest: 'digest-b', expectedSourceRevision: '40',
    })).toEqual({ ok: false, code: 'OPERATION_IDENTITY_MISMATCH' });
  });

  it('architecture fixture: receipt reconciliation has no ambiguous success classification', () => {
    expect(classifyReceiptGraph({ admission: true, receipt: false, entityRevisionAdvanced: false,
      outbox: false, terminalCommitted: false })).toBe('ADMITTED_SOURCE_UNCOMMITTED');
    expect(classifyReceiptGraph({ admission: true, receipt: true, entityRevisionAdvanced: true,
      outbox: true, terminalCommitted: false })).toBe('RECONCILE_TERMINAL_FROM_RECEIPT');
    expect(classifyReceiptGraph({ admission: true, receipt: true, entityRevisionAdvanced: true,
      outbox: true, terminalCommitted: true })).toBe('COMMITTED');
    expect(classifyReceiptGraph({ admission: true, receipt: false, entityRevisionAdvanced: false,
      outbox: false, terminalCommitted: true })).toBe('CORRUPT_PERSISTED_GRAPH');
    expect(classifyReceiptGraph({ admission: false, receipt: true, entityRevisionAdvanced: true,
      outbox: true, terminalCommitted: false })).toBe('CORRUPT_PERSISTED_GRAPH');
    expect(classifyReceiptGraph({ admission: true, receipt: true, entityRevisionAdvanced: true,
      outbox: false, terminalCommitted: false })).toBe('CORRUPT_PERSISTED_GRAPH');
    expect(classifyReceiptGraph({ admission: true, receipt: false, entityRevisionAdvanced: true,
      outbox: false, terminalCommitted: false })).toBe('CORRUPT_PERSISTED_GRAPH');
  });

  it('behavioral model evidence: checkpoint 5 and source evidence commit in one reducer transition', () => {
    let state = registerAll();
    state = apply(state, coordinator, { type: 'CAPTURE_BEFORE_DRAIN' });
    state = apply(state, coordinator, { type: 'REQUEST_DRAIN' });
    const drainRevision = state.authority.drainRequestTransitionRevision!;
    for (const record of state.registrations) {
      state = apply(state, { kind: 'writer', writerId: record.writerId, sessionId: record.sessionId }, {
        type: 'ACKNOWLEDGE_DRAIN', writerId: record.writerId, drainRequestTransitionRevision: drainRevision,
      });
    }
    state = apply(state, coordinator, { type: 'CLOSE_ADMISSION' });
    state = apply(state, coordinator, { type: 'CAPTURE_AFTER_ADMISSION_CLOSED' });
    state = apply(state, coordinator, { type: 'BEGIN_DRAIN' });
    state = apply(state, coordinator, { type: 'MARK_QUIESCENT' });
    state = apply(state, coordinator, { type: 'CAPTURE_AFTER_OPERATIONS_TERMINAL' });
    state = apply(state, verifier, { type: 'CAPTURE_BEFORE_SOURCE_VERIFICATION' });
    state = apply(state, verifier, { type: 'BEGIN_SOURCE_VERIFICATION' });
    expect(state).toMatchObject({ sourceEvidence: null, checkpointChain: expect.any(Array) });
    expect(state.checkpointChain).toHaveLength(4);
    state = apply(state, verifier, { type: 'CAPTURE_SOURCE_EVIDENCE', observation: sourceObservation() });
    expect(state.sourceEvidence).not.toBeNull();
    expect(state.checkpointChain).toHaveLength(5);
    expect(state.checkpointChain[4].sourceEvidenceDigest).toBe(state.sourceEvidence!.evidenceDigest);
  });

  it('policy snapshot: first write atomically registers and admits without a durable idle boundary', () => {
    expect(FIRST_WRITE_PROTOCOL_POLICY).toEqual({
      compatibilityDescriptor: 'transient',
      transition: 'ATOMIC_REGISTER_AND_ADMIT',
      durableRegisteredIdleBoundary: false,
    });
  });

  it('policy snapshot: existing, new persisted, and transient protocol fields do not overlap', () => {
    const sets = Object.values(K331A_FIELD_CLASSIFICATION).map(values => new Set(values));
    for (let left = 0; left < sets.length; left += 1) {
      for (let right = left + 1; right < sets.length; right += 1) {
        expect([...sets[left]].filter(value => sets[right].has(value))).toEqual([]);
      }
    }
  });

  it('source topology snapshot: IDB clear is reachable while the delete facade is dormant', () => {
    expect(PHYSICAL_SINK_REACHABILITY).toEqual({
      clearIndexedDbNotes: 'PRODUCTION_REACHABLE_VIA_RESET',
      deleteNoteFromIndexedDb: 'DORMANT_VIA_UNREFERENCED_FACADE',
    });
  });

  it('architecture fixture: repository reconciliation accepts lookup identity but no caller receipt truth', () => {
    const input: ReconcileCommittedSourceReceiptInput = Object.freeze({
      namespaceFingerprint: 'namespace-digest', generationId: 'generation-a', operationId: 'operation-a',
    });
    expect(Object.keys(input).sort()).toEqual(['generationId', 'namespaceFingerprint', 'operationId']);
    expect(reconcileCommittedSourceReceiptFixture(receiptBackedOperation(), input, 7))
      .toMatchObject({ ok: true, reused: false, operation: { terminal: 'committed', terminalReceiptDigest: 'receipt-digest' } });
  });

  it('architecture fixture: exact receipt reconciliation retry is idempotent', () => {
    const persisted = receiptBackedOperation({ terminal: 'committed', terminalReceiptDigest: 'receipt-digest' });
    const result = reconcileCommittedSourceReceiptFixture(persisted, {
      namespaceFingerprint: persisted.namespaceFingerprint,
      generationId: persisted.generationId,
      operationId: persisted.operationId,
    }, 7);
    expect(result).toEqual({ ok: true, operation: persisted, reused: true });
  });

  it('architecture fixture: committed receipt conflicts with failure or abort terminal state', () => {
    for (const terminal of ['failed', 'aborted'] as const) {
      const persisted = receiptBackedOperation({ terminal });
      expect(reconcileCommittedSourceReceiptFixture(persisted, {
        namespaceFingerprint: persisted.namespaceFingerprint,
        generationId: persisted.generationId,
        operationId: persisted.operationId,
      }, 7)).toEqual({ ok: false, code: 'RECONCILIATION_TERMINAL_CONFLICT' });
    }
  });

  it('architecture fixture: missing receipt cannot be projected as source success', () => {
    const persisted = receiptBackedOperation({ receiptDigest: null, previousSourceRevision: null,
      committedSourceRevision: null });
    expect(reconcileCommittedSourceReceiptFixture(persisted, {
      namespaceFingerprint: persisted.namespaceFingerprint,
      generationId: persisted.generationId,
      operationId: persisted.operationId,
    }, 7)).toEqual({ ok: false, code: 'RECONCILIATION_RECEIPT_NOT_FOUND' });
  });

  it('architecture fixture: unknown operation and stale epoch fail reconciliation closed', () => {
    const persisted = receiptBackedOperation();
    expect(reconcileCommittedSourceReceiptFixture(persisted, {
      namespaceFingerprint: persisted.namespaceFingerprint,
      generationId: persisted.generationId,
      operationId: 'operation-unknown',
    }, 7)).toEqual({ ok: false, code: 'RECONCILIATION_OPERATION_NOT_ADMITTED' });
    expect(reconcileCommittedSourceReceiptFixture(persisted, {
      namespaceFingerprint: persisted.namespaceFingerprint,
      generationId: persisted.generationId,
      operationId: persisted.operationId,
    }, 8)).toEqual({ ok: false, code: 'RECONCILIATION_STALE_EPOCH' });
  });

  it('architecture fixture: revision-5 receipt remains valid after revision-6 changes the same entity', () => {
    const first = revisionEvidence('operation-a', '4', '5', 'bootstrap-chain', 'receipt-digest');
    const second = revisionEvidence('operation-b', '5', '6', first.chainDigest);
    const advancedAuthority = receiptBackedOperation({
      previousSourceRevision: '4',
      committedSourceRevision: '5',
      sourceAuthorityRevision: '6',
      sourceAuthorityChainDigest: second.chainDigest,
      receiptChain: Object.freeze([first, second]),
      currentEntitySourceRevision: '6',
      currentEntityDigestMatchesReceipt: false,
      outboxDeliveryStatus: 'acknowledged',
    });
    expect(reconcileCommittedSourceReceiptFixture(advancedAuthority, {
      namespaceFingerprint: advancedAuthority.namespaceFingerprint,
      generationId: advancedAuthority.generationId,
      operationId: advancedAuthority.operationId,
    }, 7)).toMatchObject({ ok: true });
  });

  it('architecture fixture: receipt lineage rejects gaps, duplicates, and broken links', () => {
    const first = revisionEvidence('operation-a', '40', '41', 'bootstrap-chain', 'receipt-digest');
    const validSecond = revisionEvidence('operation-b', '41', '42', first.chainDigest);
    const cases: readonly (readonly SourceRevisionEvidenceFixture[])[] = [
      [first, revisionEvidence('operation-b', '42', '43', first.chainDigest)],
      [first, Object.freeze({ ...validSecond, committedSourceRevision: '41' })],
      [first, revisionEvidence('operation-b', '41', '42', 'wrong-chain')],
    ];
    for (const receiptChain of cases) {
      const persisted = receiptBackedOperation({ sourceAuthorityRevision: '42', currentEntitySourceRevision: '42',
        sourceAuthorityChainDigest: validSecond.chainDigest, receiptChain: Object.freeze(receiptChain) });
      expect(reconcileCommittedSourceReceiptFixture(persisted, {
        namespaceFingerprint: persisted.namespaceFingerprint,
        generationId: persisted.generationId,
        operationId: persisted.operationId,
      }, 7)).toEqual({ ok: false, code: 'RECONCILIATION_SOURCE_REVISION_MISMATCH' });
    }
  });

  it('architecture fixture: later tombstone or resurrection remains valid only through the same lineage', () => {
    const first = revisionEvidence('operation-a', '40', '41', 'bootstrap-chain', 'receipt-digest');
    const second = revisionEvidence('operation-b', '41', '42', first.chainDigest);
    for (const currentEntityLifecycle of ['tombstoned', 'resurrected'] as const) {
      const persisted = receiptBackedOperation({ sourceAuthorityRevision: '42',
        currentEntitySourceRevision: '42', currentEntityLifecycle, currentEntityDigestMatchesReceipt: false,
        sourceAuthorityChainDigest: second.chainDigest, receiptChain: Object.freeze([first, second]) });
      expect(reconcileCommittedSourceReceiptFixture(persisted, {
        namespaceFingerprint: persisted.namespaceFingerprint,
        generationId: persisted.generationId,
        operationId: persisted.operationId,
      }, 7)).toMatchObject({ ok: true });
    }
  });

  it('architecture fixture: same-revision evidence is compared directly and immutable outbox intent is stable', () => {
    for (const overrides of [
      { currentEntityDigestMatchesReceipt: false },
      { immutableOutboxIntentMatches: false },
      { currentAuthorityDigestMatchesChain: false },
    ] satisfies Array<Partial<ReceiptBackedOperationFixture>>) {
      const persisted = receiptBackedOperation(overrides);
      const result = reconcileCommittedSourceReceiptFixture(persisted, {
        namespaceFingerprint: persisted.namespaceFingerprint,
        generationId: persisted.generationId,
        operationId: persisted.operationId,
      }, 7);
      expect(result).toMatchObject({ ok: false });
    }
    const deliveryAdvanced = receiptBackedOperation({ outboxDeliveryStatus: 'acknowledged' });
    expect(reconcileCommittedSourceReceiptFixture(deliveryAdvanced, {
      namespaceFingerprint: deliveryAdvanced.namespaceFingerprint,
      generationId: deliveryAdvanced.generationId,
      operationId: deliveryAdvanced.operationId,
    }, 7)).toMatchObject({ ok: true });
  });

  it('architecture fixture: source revisions are decoded strictly before bigint conversion', () => {
    for (const revision of ['0', '1', '41', '9999999999999999']) {
      expect(decodeSourceRevision(revision)).toMatchObject({ ok: true, canonical: revision });
    }
    const rejected: ReadonlyArray<readonly [unknown, DecodeSourceRevisionErrorCode]> = [
      [1, 'SOURCE_REVISION_NOT_STRING'], [null, 'SOURCE_REVISION_NOT_STRING'],
      [true, 'SOURCE_REVISION_NOT_STRING'], [{}, 'SOURCE_REVISION_NOT_STRING'],
      [[], 'SOURCE_REVISION_NOT_STRING'], [Object(1n), 'SOURCE_REVISION_NOT_STRING'],
      ['', 'SOURCE_REVISION_NON_CANONICAL'], [' ', 'SOURCE_REVISION_NON_CANONICAL'],
      [' 1', 'SOURCE_REVISION_NON_CANONICAL'], ['1 ', 'SOURCE_REVISION_NON_CANONICAL'],
      ['+1', 'SOURCE_REVISION_NON_CANONICAL'], ['-1', 'SOURCE_REVISION_NON_CANONICAL'],
      ['00', 'SOURCE_REVISION_NON_CANONICAL'], ['01', 'SOURCE_REVISION_NON_CANONICAL'],
      ['1.0', 'SOURCE_REVISION_NON_CANONICAL'], ['1e3', 'SOURCE_REVISION_NON_CANONICAL'],
      ['١', 'SOURCE_REVISION_NON_CANONICAL'], ['10000000000000000', 'SOURCE_REVISION_OUT_OF_RANGE'],
    ];
    for (const [revision, code] of rejected) {
      expect(() => decodeSourceRevision(revision)).not.toThrow();
      expect(decodeSourceRevision(revision)).toEqual({ ok: false, code });
    }
  });

  it('architecture fixture: malformed persisted revisions map to bounded reconciliation corruption', () => {
    for (const revision of ['01', '-1', '10000000000000000', 41, null, {}]) {
      const persisted = receiptBackedOperation({ sourceAuthorityRevision: revision });
      expect(reconcileCommittedSourceReceiptFixture(persisted, {
        namespaceFingerprint: persisted.namespaceFingerprint,
        generationId: persisted.generationId,
        operationId: persisted.operationId,
      }, 7)).toEqual({ ok: false, code: 'RECONCILIATION_CORRUPT_PERSISTED_STATE' });
    }
  });

  it('architecture fixture: drain closes new admissions but preserves exact pre-drain work', () => {
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: true, drainState: 'open', admissionEpoch: 7,
      currentEpoch: 7, terminal: false, receiptExists: false })).toBe('SOURCE_COMMIT_ALLOWED');
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: true, drainState: 'requested', admissionEpoch: 7,
      currentEpoch: 7, terminal: false, receiptExists: false })).toBe('SOURCE_COMMIT_ALLOWED');
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: true, drainState: 'closed', admissionEpoch: 7,
      currentEpoch: 7, terminal: false, receiptExists: true })).toBe('RECONCILE_ONLY');
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: false, drainState: 'requested', admissionEpoch: 7,
      currentEpoch: 7, terminal: false, receiptExists: false })).toBe('NEW_ADMISSION_CLOSED');
  });

  it('architecture fixture: only an epoch transition fences a previous admitted operation', () => {
    expect(evaluateDrainAwareAdmission({ admittedBeforeDrain: true, drainState: 'requested', admissionEpoch: 7,
      currentEpoch: 8, terminal: false, receiptExists: false })).toBe('STALE_EPOCH');
  });

  it('policy snapshot: attachment metadata is authority-bearing while blob bytes remain external', () => {
    expect(ATTACHMENT_METADATA_AUTHORITY_POLICY).toEqual({
      authorityBearing: ['attachmentId', 'generationId', 'canonicalReferenceIds', 'contentChecksum',
        'storageObjectIdentity', 'createdSourceRevision', 'lastMutatedSourceRevision',
        'deletedSourceRevision'],
      operationalProjection: ['localAvailability', 'remoteAvailability', 'syncState',
        'transferProgress', 'retryState', 'leaseState', 'lastErrorCode', 'cacheState',
        'observedAt', 'updatedAt'],
      excluded: ['blobBytes', 'externalProviderPayload', 'cacheBytes', 'authData'],
      ambiguousCurrentFieldsFailWith: 'ATTACHMENT_AUTHORITY_CLASSIFICATION_REQUIRED',
      attachmentBlobAtomicity: 'not_claimed',
    });
  });

  it('K-331D: attachment transfer progress and acknowledgement never alter authority digest', () => {
    const baseline = attachmentProjectionFixture();
    const baselineDigest = attachmentAuthorityDigestFixture(baseline);
    for (const changedOperational of [
      attachmentProjectionFixture({}, { syncState: 'uploading', retryCount: 4 }),
      attachmentProjectionFixture({}, { leaseOwner: 'writer-a', updatedAt: '2026-07-18T00:00:00.000Z' }),
      attachmentProjectionFixture({}, { remoteAvailability: 'present',
        remoteAcknowledgedAt: '2026-07-18T00:00:00.000Z' }),
    ]) expect(attachmentAuthorityDigestFixture(changedOperational)).toBe(baselineDigest);
    expect(attachmentAuthorityDigestFixture(attachmentProjectionFixture({
      canonicalReferenceIds: Object.freeze(['note-b']), lastMutatedSourceRevision: '2',
    }))).not.toBe(baselineDigest);
    expect(attachmentAuthorityDigestFixture(attachmentProjectionFixture({
      contentChecksum: 'sha256:content-b', lastMutatedSourceRevision: '2',
    }))).not.toBe(baselineDigest);
  });

  it('architecture fixture: restore chunks advance an ordered source-revision receipt chain', () => {
    const first = commitRestoreChunkFixture(restoreFixture(), 0, 'chunk-input-0');
    expect(first).toMatchObject({ ok: true, reused: false, receipt: {
      chunkIndex: 0, previousSourceRevision: '10', committedSourceRevision: '11',
      previousChunkReceiptDigest: 'restore-chain-root',
    } });
    if (!first.ok) throw new Error(first.code);
    const { chunkReceiptDigest: _digest, ...receiptPreimage } = first.receipt;
    expect(first.receipt.chunkReceiptDigest)
      .toBe(`sha256:${canonicalRestoreChunkReceiptPreimage(receiptPreimage)}`);
    expect(commitRestoreChunkFixture(first.state, 0, 'chunk-input-0'))
      .toMatchObject({ ok: true, reused: true, receipt: first.receipt });
    expect(commitRestoreChunkFixture(first.state, 0, 'changed-input'))
      .toEqual({ ok: false, code: 'RESTORE_CHUNK_CONFLICT' });
    const second = commitRestoreChunkFixture(first.state, 1, 'chunk-input-1');
    expect(second).toMatchObject({ ok: true, reused: false, receipt: {
      chunkIndex: 1, previousSourceRevision: '11', committedSourceRevision: '12',
      previousChunkReceiptDigest: first.receipt.chunkReceiptDigest,
    } });
  });

  it('architecture fixture: restore restart cursor is derived only from the durable ordered chain', () => {
    expect(restoreRestartCursor(restoreFixture())).toBe(0);
    expect(commitRestoreChunkFixture(restoreFixture(), 1, 'chunk-input-1'))
      .toEqual({ ok: false, code: 'RESTORE_CHUNK_SKIPPED' });
    const first = commitRestoreChunkFixture(restoreFixture(), 0, 'chunk-input-0');
    if (!first.ok) throw new Error(first.code);
    expect(restoreRestartCursor(first.state)).toBe(1);
    const corrupt = Object.freeze({ ...first.state, receipts: Object.freeze([
      Object.freeze({ ...first.receipt, previousChunkReceiptDigest: 'wrong-chain' }),
    ]) });
    expect(restoreRestartCursor(corrupt)).toBeNull();
  });

  it('policy snapshot: entity evidence is revision-scoped and restore eligibility requires finalization', () => {
    expect(PER_ENTITY_SOURCE_REVISION_POLICY).toEqual({
      selection: 'PER_ENTITY_SOURCE_REVISION_BINDING_REQUIRED',
      fields: ['createdSourceRevision', 'lastMutatedSourceRevision', 'deletedSourceRevision'],
      directDigestComparison: 'ONLY_WHEN_ENTITY_LAST_MUTATED_REVISION_EQUALS_RECEIPT_REVISION',
    });
    expect(restoreEligible(restoreFixture())).toBe(false);
  });

  it('policy snapshot: protocol evolution precedes the dormant source repository', () => {
    expect(K331B_FUTURE_TASK_ORDER.indexOf('K-333_PROTOCOL_AND_REPOSITORY_MODEL_EXTENSION'))
      .toBeLessThan(K331B_FUTURE_TASK_ORDER.indexOf('K-334_DORMANT_SOURCE_TRANSACTION_REPOSITORY'));
  });

  it('policy snapshot: the central mutation manifest audits admission but never routes mutations', () => {
    expect(CENTRAL_MUTATION_MANIFEST_POLICY).toEqual({
      role: 'AUDIT_AND_ADMISSION_INVENTORY',
      routesMutations: false,
      invokesFunctions: false,
      overridesCoordinationAuthority: false,
      wrapperReferenceCardinality: 'EXACTLY_ONE_ENTRY',
    });
  });

  it('K-331D: historical receipt membership stays inside fixed proof and raw-read ceilings', () => {
    const proof: ReceiptMembershipProofFixture = Object.freeze({
      proofVersion: 'receipt-membership-proof-v1', receiptRevision: '5', receiptDigest: 'receipt:5',
      segmentIndex: 0, segmentStartRevision: '1', segmentEndRevision: '64',
      segmentRootDigest: 'segment-root:0', accumulatorRootDigest: 'mmr-root:1000000',
      currentChainHeadDigest: 'chain-head:1000000', hashNodes: Object.freeze(Array(32).fill('node')),
      encodedBytes: 4096, rawReceiptReads: 0, sealed: true,
      compactedMembershipIndexPresent: true, proofAuthenticatesReceipt: true,
      checkpointPathValid: true, checkpointCoordinatesUnique: true,
    });
    expect(verifyBoundedReceiptMembership(proof, '5', 'receipt:5')).toBe('VERIFIED');
    expect(verifyBoundedReceiptMembership(null, '5', 'receipt:5'))
      .toBe('LINEAGE_MEMBERSHIP_PROOF_MISSING');
    expect(verifyBoundedReceiptMembership(Object.freeze({ ...proof,
      hashNodes: Object.freeze(Array(K331D_BOUNDS.membershipHashNodes + 1).fill('node')) }),
    '5', 'receipt:5')).toBe('RECEIPT_MEMBERSHIP_PROOF_BOUND_EXCEEDED');
    expect(verifyBoundedReceiptMembership(Object.freeze({ ...proof,
      rawReceiptReads: K331D_BOUNDS.rawReceiptReads + 1 }), '5', 'receipt:5'))
      .toBe('RECEIPT_MEMBERSHIP_PROOF_BOUND_EXCEEDED');
    expect(verifyBoundedReceiptMembership(Object.freeze({ ...proof,
      compactedMembershipIndexPresent: false }), '5', 'receipt:5'))
      .toBe('LINEAGE_MEMBERSHIP_PROOF_MISSING');
    expect(verifyBoundedReceiptMembership(Object.freeze({ ...proof,
      proofAuthenticatesReceipt: false }), '5', 'receipt:5'))
      .toBe('LINEAGE_MEMBERSHIP_PROOF_INVALID');
    expect(verifyBoundedReceiptMembership(Object.freeze({ ...proof,
      checkpointCoordinatesUnique: false }), '5', 'receipt:5'))
      .toBe('LINEAGE_SEGMENT_CHECKPOINT_CONFLICT');
    expect(verifyBoundedReceiptMembership(Object.freeze({ ...proof, sealed: false,
      compactedMembershipIndexPresent: false, rawReceiptReads: 64 }), '5', 'receipt:5'))
      .toBe('VERIFIED');
    expect(validReceiptLineage(5n, 5n, 'receipt:5',
      Object.freeze(Array(65).fill(revisionEvidence('operation-a', '4', '5', 'root', 'receipt:5'))),
      'head')).toBe(false);
  });

  it('K-331D: retention and compaction are evidence-only and never discard live proof', () => {
    expect(RECEIPT_RETENTION_POLICY).toEqual({
      sealedSegmentSize: 64, minimumLaterSealedSegmentsBeforeCompaction: 2,
      neverCompact: ['UNRESOLVED_OPERATION', 'PENDING_RECEIPT_RECONCILIATION',
        'ACTIVE_RESTORE_REFERENCE', 'ACTIVE_MIGRATION_REFERENCE', 'CORRUPTION_HOLD',
        'UNSEALED_SEGMENT'],
      compactionTransaction: ['write_immutable_compacted_membership_index',
        'write_purge_certificate_when_applicable', 'delete_raw_receipt'],
      sourceRevisionEffect: 'NONE_EVIDENCE_ONLY',
    });
    for (const input of [
      compactableReceipt({ unresolved: true }),
      compactableReceipt({ pendingReconciliation: true }),
      compactableReceipt({ activeRestoreReference: true }),
      compactableReceipt({ corruptionHold: true }),
    ]) expect(compactReceiptFixture(input)).toEqual({
      ok: false, code: 'LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE',
    });
    expect(compactReceiptFixture(compactableReceipt({ segmentSealed: false }))).toEqual({
      ok: false, code: 'LINEAGE_MEMBERSHIP_PROOF_MISSING',
    });
    const first = compactReceiptFixture(compactableReceipt());
    expect(first).toMatchObject({ ok: true, reused: false, rawReceiptPresent: false,
      index: { terminalReceiptDigest: 'receipt:41', membershipLocatorDigest: 'membership:41:receipt:41' } });
    if (!first.ok) throw new Error(first.code);
    expect(compactReceiptFixture(compactableReceipt({ existingIndex: first.index })))
      .toMatchObject({ ok: true, reused: true, index: first.index });
    expect(compactReceiptFixture(compactableReceipt({ existingIndex: Object.freeze({
      ...first.index, receiptDigest: 'conflict',
    }) }))).toEqual({ ok: false, code: 'LINEAGE_COMPACTION_CONFLICT' });
  });

  it('K-331D: quiescence is derived from the persisted coordination and maintenance graph', () => {
    expect(deriveDurableQuiescence(quiescentGraph())).toMatchObject({
      unresolvedOperationCount: 0, pendingReceiptReconciliationCount: 0,
      nonQuiescentWriterCount: 0, activeMaintenanceSessionCount: 0,
      epochTransitionInProgress: false, quiescent: true,
    });
    for (const graph of [
      quiescentGraph({ operations: Object.freeze([Object.freeze({
        admitted: true, terminal: 'absent', receiptPresent: false,
      })]) }),
      quiescentGraph({ operations: Object.freeze([Object.freeze({
        admitted: true, terminal: 'absent', receiptPresent: true,
      })]) }),
      quiescentGraph({ registrations: Object.freeze([Object.freeze({ lifecycle: 'draining' })]) }),
      quiescentGraph({ sessions: Object.freeze([Object.freeze({ kind: 'restore', status: 'active' })]) }),
      quiescentGraph({ authorityEpochTransition: 'prepared' }),
    ]) expect(deriveDurableQuiescence(graph).quiescent).toBe(false);
  });

  it('K-331D: bootstrap uses bounded staged evidence and derives its digest from the complete set', () => {
    const graph = bootstrapGraph();
    const staged = persistBootstrapSegmentFixture(null, graph.segments[0], graph.baselineDigest);
    expect(staged).toMatchObject({ ok: true, reused: false });
    if (!staged.ok) throw new Error(staged.code);
    expect(persistBootstrapSegmentFixture(staged.segment, graph.segments[0], graph.baselineDigest))
      .toMatchObject({ ok: true, reused: true });
    expect(persistBootstrapSegmentFixture(staged.segment, Object.freeze({ ...graph.segments[0],
      sessionId: 'other-session' }), graph.baselineDigest))
      .toEqual({ ok: false, code: 'BOOTSTRAP_SEGMENT_CONFLICT' });
    expect(persistBootstrapSegmentFixture(null, graph.segments[0], 'changed-baseline'))
      .toEqual({ ok: false, code: 'BOOTSTRAP_FINALIZATION_STATE_CHANGED' });
    const result = finalizeStagedBootstrap(graph);
    expect(result).toMatchObject({ ok: true, code: 'SOURCE_AUTHORITY_BOOTSTRAP_READY' });
    expect(result.evidenceDigest).toBe(`sha256:${canonicalBootstrapPreimage(graph)}`);
    expect(canonicalBootstrapPreimage(graph)).not.toContain('bootstrapEvidenceDigest');
    expect(finalizeStagedBootstrap(Object.freeze({ ...graph,
      currentBaselineDigest: 'changed-baseline' }))).toEqual({
      ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_BASELINE_CHANGED',
    });
    expect(finalizeStagedBootstrap(Object.freeze({ ...graph,
      segments: Object.freeze(graph.segments.slice(1)) }))).toEqual({
      ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_SEGMENT_SET_MISMATCH',
    });
  });

  it('K-331D: bootstrap rejects segment overrun, nonquiescence, and ambiguous attachment authority', () => {
    const graph = bootstrapGraph();
    expect(finalizeStagedBootstrap(Object.freeze({ ...graph, segments: Object.freeze([
      Object.freeze({ ...graph.segments[0], recordCount: K331D_BOUNDS.bootstrapRecordsPerSegment + 1 }),
      ...graph.segments.slice(1),
    ]) }))).toEqual({ ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_SEGMENT_BOUND_EXCEEDED' });
    expect(finalizeStagedBootstrap(Object.freeze({ ...graph,
      quiescenceGraph: quiescentGraph({ admissionOpen: true }) })))
      .toEqual({ ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_NOT_QUIESCENT' });
    expect(finalizeStagedBootstrap(Object.freeze({ ...graph, attachmentAuthorityClassified: false })))
      .toEqual({ ok: false, code: 'ATTACHMENT_AUTHORITY_CLASSIFICATION_REQUIRED' });
  });

  it('K-331D: entity lifecycle assigns exact revisions without inventing bootstrap chronology', () => {
    const created = transitionEntityRevision(null, 'create', '1');
    expect(created).toMatchObject({ lifecycle: 'active', createdSourceRevision: '1',
      lastMutatedSourceRevision: '1', deletedSourceRevision: null });
    if (typeof created === 'string') throw new Error(created);
    const updated = transitionEntityRevision(created, 'update', '2');
    expect(updated).toMatchObject({ createdSourceRevision: '1', lastMutatedSourceRevision: '2' });
    if (typeof updated === 'string') throw new Error(updated);
    const tombstoned = transitionEntityRevision(updated, 'tombstone', '3');
    expect(tombstoned).toMatchObject({ lifecycle: 'tombstoned', lastMutatedSourceRevision: '3',
      deletedSourceRevision: '3' });
    if (typeof tombstoned === 'string') throw new Error(tombstoned);
    const resurrected = transitionEntityRevision(tombstoned, 'resurrect', '4');
    expect(resurrected).toMatchObject({ lifecycle: 'active', createdSourceRevision: '1',
      lastMutatedSourceRevision: '4', deletedSourceRevision: null });
    const purged = transitionEntityRevision(tombstoned, 'purge', '4');
    expect(purged).toMatchObject({ lifecycle: 'purged', deletedSourceRevision: '3',
      purgeCertificateDigest: 'purge:4' });
    expect(ENTITY_REVISION_MODEL.revisionZeroActive.revisionZeroInitialization)
      .toBe('preexisting_state_not_historical_event');
    expect(ENTITY_REVISION_MODEL.revisionZeroTombstone.deletedSourceRevision).toBe('0');
  });

  it('K-331D: invalid entity transitions and malformed revision inputs fail closed', () => {
    const active = transitionEntityRevision(null, 'create', '1');
    if (typeof active === 'string') throw new Error(active);
    expect(transitionEntityRevision(active, 'create', '2')).toBe('INVALID_LIFECYCLE_TRANSITION');
    expect(transitionEntityRevision(active, 'resurrect', '2')).toBe('INVALID_LIFECYCLE_TRANSITION');
    expect(transitionEntityRevision(active, 'purge', '2')).toBe('INVALID_LIFECYCLE_TRANSITION');
    expect(transitionEntityRevision(active, 'update', '01')).toBe('INVALID_LIFECYCLE_TRANSITION');
    expect(ENTITY_REVISION_MODEL).toMatchObject({
      folders: 'FIRST_CLASS_ENTITY_ENVELOPE', relations: 'INDEPENDENT_REVISIONED_RELATION_RECORDS',
      boundedBulk: 'ALL_AFFECTED_RECORDS_SHARE_ONE_COMMITTED_SOURCE_REVISION',
    });
  });

  it('K-331D: restore finalization rereads the persisted graph and exact retry is immutable', () => {
    const first = commitRestoreChunkFixture(restoreFixture(), 0, 'chunk-input-0');
    if (!first.ok) throw new Error(first.code);
    const second = commitRestoreChunkFixture(first.state, 1, 'chunk-input-1');
    if (!second.ok) throw new Error(second.code);
    const graph: RestorePersistedGraphFixture = Object.freeze({
      lookup: Object.freeze({ namespaceFingerprint: second.state.namespaceFingerprint,
        generationId: second.state.generationId, restoreSessionId: second.state.restoreSessionId }),
      session: second.state, authorityRevision: '12', authorityDigest: 'authority:12',
      expectedAuthorityRevision: '12', expectedAuthorityDigest: 'authority:12',
      persistedPlanDigest: second.state.planDigest,
      authenticatedChunkChainHead: second.receipt.chunkReceiptDigest,
      quiescenceGraph: quiescentGraph(),
      existingManifest: null,
    });
    const finalized = finalizeRestoreFromPersistedGraph(graph);
    expect(finalized).toMatchObject({ ok: true, manifest: { finalCommittedSourceRevision: '12',
      completeAuthorityDigest: 'authority:12', evidenceOnly: true, sourceRevisionIncremented: false } });
    if (!finalized.ok) throw new Error(finalized.code);
    const { finalManifestDigest: _digest, ...manifestPreimage } = finalized.manifest;
    expect(finalized.manifest.finalManifestDigest)
      .toBe(`sha256:${canonicalRestoreFinalManifestPreimage(manifestPreimage)}`);
    expect(finalizeRestoreFromPersistedGraph(Object.freeze({ ...graph,
      existingManifest: finalized.manifest }))).toMatchObject({ ok: true, manifest: finalized.manifest });
  });

  it('K-331D: restore finalization rejects changed authority, broken chunks, and live writers', () => {
    const first = commitRestoreChunkFixture(restoreFixture(), 0, 'chunk-input-0');
    if (!first.ok) throw new Error(first.code);
    const second = commitRestoreChunkFixture(first.state, 1, 'chunk-input-1');
    if (!second.ok) throw new Error(second.code);
    const graph: RestorePersistedGraphFixture = Object.freeze({
      lookup: Object.freeze({ namespaceFingerprint: second.state.namespaceFingerprint,
        generationId: second.state.generationId, restoreSessionId: second.state.restoreSessionId }),
      session: second.state, authorityRevision: '12', authorityDigest: 'authority:12',
      expectedAuthorityRevision: '12', expectedAuthorityDigest: 'authority:12',
      persistedPlanDigest: second.state.planDigest,
      authenticatedChunkChainHead: second.receipt.chunkReceiptDigest,
      quiescenceGraph: quiescentGraph(),
      existingManifest: null,
    });
    for (const changed of [
      Object.freeze({ ...graph, authorityRevision: '13' }),
      Object.freeze({ ...graph, authorityDigest: 'changed' }),
      Object.freeze({ ...graph, authenticatedChunkChainHead: 'changed-chain-head' }),
      Object.freeze({ ...graph, persistedPlanDigest: 'changed-plan' }),
      Object.freeze({ ...graph, quiescenceGraph: quiescentGraph({ admissionOpen: true }) }),
    ]) expect(finalizeRestoreFromPersistedGraph(changed)).toEqual({
      ok: false, code: 'RESTORE_FINAL_DIGEST_MISMATCH',
    });
  });

  it('K-331D: every persisted revision boundary and future evidence store is explicit', () => {
    for (const boundary of PERSISTED_REVISION_BOUNDARIES) {
      expect(decodePersistedRevisionBoundary(boundary, '42')).toEqual({ ok: true, revision: '42' });
      expect(decodePersistedRevisionBoundary(boundary, '042')).toEqual({
        ok: false, code: 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE', context: boundary,
      });
    }
    expect(K331D_FUTURE_STORES).toHaveLength(12);
    expect(new Set(K331D_FUTURE_STORES).size).toBe(K331D_FUTURE_STORES.length);
    expect(K331D_STABLE_ERRORS).toHaveLength(16);
    expect(Object.keys(K331D_ERROR_CLASSIFICATION)).toEqual(K331D_STABLE_ERRORS);
  });
});
