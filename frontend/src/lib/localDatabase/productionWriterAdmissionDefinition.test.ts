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
import * as k331e from './productionWriterAdmissionK331E.testSupport';

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
  return k331e.sha256Hex('ABSINTHE_ATTACHMENT_CANONICAL_AUTHORITY_V1', [canonical.attachmentId,
    canonical.generationId, [...canonical.canonicalReferenceIds].sort(), canonical.contentChecksum,
    canonical.storageObjectIdentity, canonical.createdSourceRevision,
    canonical.lastMutatedSourceRevision, canonical.deletedSourceRevision ?? null]);
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
    chunkReceiptDigest: k331e.sha256Hex(k331e.K331E_DOMAINS.restoreChunk,
      [canonicalRestoreChunkReceiptPreimage(receiptWithoutDigest)]) });
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

function k331eSegmentReceipts(segmentIndex: number): readonly k331e.SourceReceipt[] {
  const first = segmentIndex * k331e.K331E_LIMITS.segmentSize + 1;
  return Object.freeze(Array.from({ length: k331e.K331E_LIMITS.segmentSize }, (_, leafIndex) => {
    const revision = String(first + leafIndex);
    return k331e.createReceipt({ operationId: `operation-${revision}`,
      previousSourceRevision: String(first + leafIndex - 1), committedSourceRevision: revision,
      previousReceiptChainDigest: leafIndex === 0 ? null : `chain-${revision}` });
  }));
}

function k331eHistoricalProof(
  segmentCount = 3, targetSegment = 1, targetLeaf = 5,
): k331e.HistoricalReceiptProof {
  const receiptSegments = Array.from({ length: segmentCount }, (_, index) => k331eSegmentReceipts(index));
  const checkpoints: k331e.SegmentCheckpoint[] = [];
  for (const receipts of receiptSegments) {
    checkpoints.push(k331e.createSegmentCheckpoint(receipts,
      checkpoints[checkpoints.length - 1]?.checkpointDigest ?? null));
  }
  let mmrState = k331e.emptyMmrState();
  for (const checkpoint of checkpoints) mmrState = k331e.appendMmrCheckpoint(mmrState, checkpoint);
  const receipts = receiptSegments[targetSegment];
  const receipt = receipts[targetLeaf];
  return Object.freeze({ kind: 'absinthe_historical_receipt_proof', version: 1,
    receipt, segmentLeafCount: receipts.length,
    segmentPath: k331e.segmentMerkleProof(receipts.map(k331e.segmentReceiptLeaf), targetLeaf),
    checkpoint: checkpoints[targetSegment],
    mmrProofEncoded: k331e.encodeMmrProof(k331e.createMmrProof(checkpoints, targetSegment)),
    mmrState, sourceAuthorityMmrStateDigest: mmrState.stateDigest });
}

function k331eBootstrapSegment(
  category: string, segmentIndex = 0, previous: k331e.BootstrapSegment | null = null,
  endOfCategory = true,
): k331e.BootstrapSegment {
  const result = k331e.createBootstrapSegment({ sessionId: 'bootstrap-session-a', category,
    segmentIndex, previousSegmentDigest: previous?.segmentDigest ?? null,
    previousLastKey: previous?.lastKey ?? null,
    continuationStartDigest: previous?.continuationEndDigest ?? 'cursor:start',
    continuationEndDigest: endOfCategory ? 'cursor:end' : `cursor:${segmentIndex + 1}`,
    baselineDigest: k331e.sha256Hex('ABSINTHE_BOOTSTRAP_BASELINE_V1', ['generation-a']),
    records: Object.freeze([Object.freeze({ key: `${category}:${segmentIndex}:a`,
      valueDigest: k331e.sha256Hex('ABSINTHE_BOOTSTRAP_VALUE_V1', [category, segmentIndex]) })]),
    endOfCategory,
  });
  if (typeof result === 'string') throw new Error(result);
  return result;
}

function k331eSourceAuthority(accumulator: k331e.RestoreAccumulator): k331e.SourceAuthorityProjection {
  const withoutDigest = Object.freeze({ revision: accumulator.finalRevision,
    restoreAuthorityDigest: accumulator.authorityDigest,
    entityCount: 108, entityRoot: k331e.sha256Hex('ABSINTHE_ENTITY_ROOT_V1', [108]),
    attachmentCount: 4, attachmentRoot: k331e.sha256Hex('ABSINTHE_ATTACHMENT_ROOT_V1', [4]),
    outboxCount: 108, outboxRoot: k331e.sha256Hex('ABSINTHE_OUTBOX_ROOT_V1', [108]),
    checkpointCount: 1, checkpointRoot: k331e.sha256Hex('ABSINTHE_CHECKPOINT_ROOT_V1', [1]),
    coordinationEpoch: 7, quiescenceDigest: k331e.sha256Hex('ABSINTHE_QUIESCENCE_V1', [7]),
    protocolVersion: 1 as const, implementationId: 'local-first-source-v1' });
  return Object.freeze({ ...withoutDigest,
    completeAuthorityDigest: k331e.sourceAuthorityProjectionDigest(withoutDigest) });
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
      .toBe(k331e.sha256Hex(k331e.K331E_DOMAINS.restoreChunk,
        [canonicalRestoreChunkReceiptPreimage(receiptPreimage)]));
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

  it('K-331E: revision coordinates are unique and revision zero has no receipt leaf', () => {
    expect(k331e.revisionCoordinate('1')).toEqual({ revision: '1', segmentIndex: 0, leafIndex: 0 });
    expect(k331e.revisionCoordinate('64')).toEqual({ revision: '64', segmentIndex: 0, leafIndex: 63 });
    expect(k331e.revisionCoordinate('65')).toEqual({ revision: '65', segmentIndex: 1, leafIndex: 0 });
    expect(k331e.revisionCoordinate('0')).toBeNull();
    expect(k331e.revisionCoordinate('01')).toBeNull();
  });

  it('K-331E: canonical digests use real SHA-256 and domain separation', () => {
    const receipt = k331e.createReceipt({ operationId: 'operation-a', previousSourceRevision: '0',
      committedSourceRevision: '1' });
    const repeated = k331e.createReceipt({ operationId: 'operation-a', previousSourceRevision: '0',
      committedSourceRevision: '1' });
    const changed = k331e.createReceipt({ operationId: 'operation-b', previousSourceRevision: '0',
      committedSourceRevision: '1' });
    expect(receipt.receiptDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(repeated.receiptDigest).toBe(receipt.receiptDigest);
    expect(changed.receiptDigest).not.toBe(receipt.receiptDigest);
    expect(k331e.sha256Hex(k331e.K331E_DOMAINS.receiptLeaf, ['same']))
      .not.toBe(k331e.sha256Hex(k331e.K331E_DOMAINS.segmentNode, ['same']));
  });

  it('K-331E: segment Merkle verification recomputes paths and rejects tampering', () => {
    const receipts = k331eSegmentReceipts(0).slice(0, 13);
    const leaves = receipts.map(k331e.segmentReceiptLeaf);
    const root = k331e.segmentMerkleRoot(leaves);
    const proof = k331e.segmentMerkleProof(leaves, 5);
    expect(k331e.verifySegmentMerkleProof(leaves[5], 5, leaves.length, proof, root)).toBe(true);
    expect(k331e.verifySegmentMerkleProof(leaves[5], 4, leaves.length, proof, root)).toBe(false);
    expect(k331e.verifySegmentMerkleProof(leaves[5], 5, leaves.length,
      Object.freeze([Object.freeze({ ...proof[0], digest: k331e.sha256Hex('TAMPER', ['x']) }),
        ...proof.slice(1)]), root)).toBe(false);
    expect(k331e.verifySegmentMerkleProof(leaves[5], 5, leaves.length,
      Object.freeze([Object.freeze({ ...proof[0], side: proof[0].side === 'left' ? 'right' : 'left' }),
        ...proof.slice(1)]), root)).toBe(false);
  });

  it('K-331E: segment checkpoints reject duplicate, sparse, and cross-segment coordinates', () => {
    const valid = k331eSegmentReceipts(0);
    expect(k331e.createSegmentCheckpoint(valid)).toMatchObject({ segmentIndex: 0,
      firstRevision: '1', lastRevision: '64', receiptCount: 64 });
    expect(() => k331e.createSegmentCheckpoint(Object.freeze([valid[0], valid[0]])))
      .toThrow('LINEAGE_COORDINATE_MISMATCH');
    expect(() => k331e.createSegmentCheckpoint(Object.freeze([valid[0], valid[2]])))
      .toThrow('LINEAGE_COORDINATE_MISMATCH');
    expect(() => k331e.createSegmentCheckpoint(Object.freeze([valid[63], k331eSegmentReceipts(1)[0]])))
      .toThrow('LINEAGE_COORDINATE_MISMATCH');
  });

  it('K-331E: unsealed membership recomputes a bounded atomic partial root', () => {
    const receipts = Object.freeze(k331eSegmentReceipts(0).slice(0, 13));
    const metadata: k331e.OpenSegmentMetadata = Object.freeze({ kind: 'absinthe_open_segment',
      version: 1, segmentIndex: 0, receiptCount: receipts.length,
      partialRoot: k331e.segmentMerkleRoot(receipts.map(k331e.segmentReceiptLeaf)),
      lastRevision: '13' });
    expect(k331e.verifyUnsealedSegment(receipts, metadata, '13'))
      .toEqual({ ok: true, rawReceiptReads: 13 });
    expect(k331e.verifyUnsealedSegment(receipts, Object.freeze({ ...metadata,
      partialRoot: k331e.sha256Hex('TAMPER', ['partial']) }), '13'))
      .toEqual({ ok: false, code: 'LINEAGE_SEGMENT_PATH_INVALID' });
    expect(k331e.verifyUnsealedSegment(Object.freeze(Array.from({ length: 65 }, (_value, index) =>
      k331e.createReceipt({ operationId: `overflow-${index}`, previousSourceRevision: String(index),
        committedSourceRevision: String(index + 1) }))), Object.freeze({ ...metadata,
      receiptCount: 65 }), '65')).toEqual({ ok: false, code: 'LINEAGE_SEGMENT_PATH_INVALID' });
  });

  it('K-331E: historical membership authenticates receipt, segment, MMR, and authority pointer', () => {
    const proof = k331eHistoricalProof();
    expect(k331e.verifyHistoricalReceiptProof(proof)).toBe('VERIFIED');
    expect(k331e.verifyHistoricalReceiptProof(Object.freeze({ ...proof,
      sourceAuthorityMmrStateDigest: k331e.sha256Hex('TAMPER', ['authority']) })))
      .toBe('LINEAGE_MMR_AUTHORITY_MISMATCH');
    const changedReceipt = Object.freeze({ ...proof.receipt, mutationKind: 'NOTE_DELETE' });
    expect(k331e.verifyHistoricalReceiptProof(Object.freeze({ ...proof, receipt: changedReceipt })))
      .toBe('LINEAGE_RECEIPT_DIGEST_MISMATCH');
    const changedPath = Object.freeze([Object.freeze({ ...proof.segmentPath[0],
      digest: k331e.sha256Hex('TAMPER', ['sibling']) }), ...proof.segmentPath.slice(1)]);
    expect(k331e.verifyHistoricalReceiptProof(Object.freeze({ ...proof, segmentPath: changedPath })))
      .toBe('LINEAGE_SEGMENT_PATH_INVALID');
  });

  it('K-331E: MMR peak construction and proof verification reject peak and root tampering', () => {
    const proof = k331eHistoricalProof(7, 2, 5);
    expect(proof.mmrState.peaks.map(peak => peak.height)).toEqual([2, 1, 0]);
    expect(k331e.verifyHistoricalReceiptProof(proof)).toBe('VERIFIED');
    const decoded = k331e.decodeMmrProof(proof.mmrProofEncoded);
    if (!decoded.ok) throw new Error(decoded.code);
    const reordered = Object.freeze({ ...decoded.proof,
      otherPeaks: Object.freeze([...decoded.proof.otherPeaks].reverse()) });
    expect(k331e.verifyHistoricalReceiptProof(Object.freeze({ ...proof,
      mmrProofEncoded: k331e.encodeMmrProof(reordered) }))).toBe('LINEAGE_MMR_PATH_INVALID');
    expect(k331e.verifyHistoricalReceiptProof(Object.freeze({ ...proof,
      mmrState: Object.freeze({ ...proof.mmrState, root: k331e.sha256Hex('TAMPER', ['root']) }) })))
      .toBe('LINEAGE_MMR_PATH_INVALID');
  });

  it('K-331E: full revision-domain proof bounds are derived and checked before parsing', () => {
    expect(k331e.K331E_LIMITS.maxSegments).toBe(156_250_000_000_000);
    expect(k331e.K331E_LIMITS.maxMmrHeight).toBe(47);
    expect(k331e.K331E_LIMITS.maxPeakCount).toBe(47);
    expect(k331e.K331E_LIMITS.derivedWorstCaseProofNodes).toBe(92);
    expect(k331e.K331E_LIMITS.maxProofNodes).toBeGreaterThanOrEqual(92);
    expect(k331e.decodeMmrProof('x'.repeat(k331e.K331E_LIMITS.maxEncodedProofBytes + 1)))
      .toEqual({ ok: false, code: 'LINEAGE_PROOF_TOO_LARGE' });
    const tooManyNodes = JSON.stringify(['absinthe_mmr_proof', 1, 1, 0, 0,
      Array.from({ length: 97 }, () => ['right', '0'.repeat(64)]), []]);
    expect(k331e.decodeMmrProof(tooManyNodes)).toEqual({
      ok: false, code: 'LINEAGE_PROOF_NODE_LIMIT_EXCEEDED',
    });
  });

  it('K-331E: the 64th append seals atomically and the 65th opens the next segment', () => {
    let state = k331e.emptyAppendState();
    for (let index = 1; index <= 63; index += 1) {
      const result = k331e.appendReceiptTransaction(state, `operation-${index}`,
        k331e.sha256Hex('ABSINTHE_INPUT_V1', [index]));
      if (!result.ok) throw new Error(result.code);
      state = result.state;
      expect(result.sealed).toBe(false);
    }
    const sixtyFourth = k331e.appendReceiptTransaction(state, 'operation-64',
      k331e.sha256Hex('ABSINTHE_INPUT_V1', [64]));
    if (!sixtyFourth.ok) throw new Error(sixtyFourth.code);
    expect(sixtyFourth).toMatchObject({ sealed: true, state: { revision: '64', openSegmentIndex: 1,
      openReceipts: [], mmrState: { leafCount: 1, lastSealedSegment: 0 } } });
    expect(k331e.appendReceiptTransaction(sixtyFourth.state, 'operation-64',
      k331e.sha256Hex('ABSINTHE_INPUT_V1', [64])))
      .toMatchObject({ ok: true, reused: true, state: sixtyFourth.state });
    const sixtyFifth = k331e.appendReceiptTransaction(sixtyFourth.state, 'operation-65',
      k331e.sha256Hex('ABSINTHE_INPUT_V1', [65]));
    if (!sixtyFifth.ok) throw new Error(sixtyFifth.code);
    expect(sixtyFifth).toMatchObject({ sealed: false, state: { revision: '65', openSegmentIndex: 1 } });
    expect(sixtyFifth.state.openReceipts).toHaveLength(1);
  });

  it('K-331E: append retry is exact and an MMR pointer mismatch fails closed', () => {
    const input = k331e.sha256Hex('ABSINTHE_INPUT_V1', ['a']);
    const first = k331e.appendReceiptTransaction(k331e.emptyAppendState(), 'operation-a', input);
    if (!first.ok) throw new Error(first.code);
    expect(k331e.appendReceiptTransaction(first.state, 'operation-a', input))
      .toMatchObject({ ok: true, reused: true, state: first.state, receipt: first.receipt });
    expect(k331e.appendReceiptTransaction(first.state, 'operation-a',
      k331e.sha256Hex('ABSINTHE_INPUT_V1', ['changed'])))
      .toEqual({ ok: false, code: 'OPERATION_IDENTITY_MISMATCH' });
    expect(k331e.appendReceiptTransaction(Object.freeze({ ...first.state,
      sourceAuthorityMmrStateDigest: k331e.sha256Hex('TAMPER', ['pointer']) }), 'operation-b', input))
      .toEqual({ ok: false, code: 'LINEAGE_APPEND_SEAL_CONFLICT' });
  });

  it('K-331E: compaction derives a complete authenticated index and exact retry', () => {
    const proof = k331eHistoricalProof();
    const graph: k331e.CompactionGraph = Object.freeze({ proof, terminal: 'committed',
      terminalReceiptDigest: proof.receipt.receiptDigest, pendingReconciliation: false,
      activeRestoreReference: false, activeMigrationReference: false, corruptionHold: false,
      existingIndex: null, rawReceiptPresent: true });
    const first = k331e.compactReceiptTransaction(graph);
    expect(first).toMatchObject({ ok: true, reused: false, rawReceiptPresent: false,
      index: { namespaceFingerprint: proof.receipt.namespaceFingerprint,
        committedSourceRevision: proof.receipt.committedSourceRevision } });
    if (!first.ok) throw new Error(first.code);
    expect(first.index.indexDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(k331e.compactReceiptTransaction(Object.freeze({ ...graph, existingIndex: first.index })))
      .toMatchObject({ ok: true, reused: true, index: first.index });
    expect(k331e.compactReceiptTransaction(Object.freeze({ ...graph, existingIndex: Object.freeze({
      ...first.index, operationId: 'conflict',
    }) }))).toEqual({ ok: false, code: 'LINEAGE_COMPACTION_INDEX_CONFLICT' });
  });

  it('K-331E: every durable hold and terminal mismatch prevents compaction', () => {
    const proof = k331eHistoricalProof();
    const base: k331e.CompactionGraph = Object.freeze({ proof, terminal: 'committed',
      terminalReceiptDigest: proof.receipt.receiptDigest, pendingReconciliation: false,
      activeRestoreReference: false, activeMigrationReference: false, corruptionHold: false,
      existingIndex: null, rawReceiptPresent: true });
    for (const override of [
      { terminal: 'absent' as const }, { terminal: 'failed' as const }, { pendingReconciliation: true },
      { corruptionHold: true }, { terminalReceiptDigest: null },
    ]) expect(k331e.compactReceiptTransaction(Object.freeze({ ...base, ...override })))
      .toMatchObject({ ok: false, code: 'LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE' });
    for (const override of [{ activeRestoreReference: true }, { activeMigrationReference: true }]) {
      expect(k331e.compactReceiptTransaction(Object.freeze({ ...base, ...override })))
        .toEqual({ ok: false, code: 'LINEAGE_COMPACTION_REFERENCE_ACTIVE' });
    }
    expect(k331e.compactReceiptTransaction(Object.freeze({ ...base, proof: Object.freeze({ ...proof,
      sourceAuthorityMmrStateDigest: k331e.sha256Hex('TAMPER', ['proof']) }) })))
      .toEqual({ ok: false, code: 'LINEAGE_MMR_AUTHORITY_MISMATCH' });
  });

  it('K-331E: quiescence remains derived from persisted coordination and maintenance graphs', () => {
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

  it('K-331E: exact entity lifecycle rejects repeated, decreasing, and skipped revisions', () => {
    const created = k331e.transitionEntityExact('0', '1', null, 'create');
    expect(created).toMatchObject({ lifecycle: 'active', createdSourceRevision: '1',
      lastMutatedSourceRevision: '1', deletedSourceRevision: null });
    if (typeof created === 'string') throw new Error(created);
    const updated = k331e.transitionEntityExact('1', '2', created, 'update');
    expect(updated).toMatchObject({ createdSourceRevision: '1', lastMutatedSourceRevision: '2' });
    if (typeof updated === 'string') throw new Error(updated);
    const tombstoned = k331e.transitionEntityExact('2', '3', updated, 'tombstone');
    expect(tombstoned).toMatchObject({ lifecycle: 'tombstoned', lastMutatedSourceRevision: '3',
      deletedSourceRevision: '3' });
    if (typeof tombstoned === 'string') throw new Error(tombstoned);
    const resurrected = k331e.transitionEntityExact('3', '4', tombstoned, 'resurrect');
    expect(resurrected).toMatchObject({ lifecycle: 'active', createdSourceRevision: '1',
      lastMutatedSourceRevision: '4', deletedSourceRevision: null });
    expect(k331e.transitionEntityExact('2', '2', updated, 'update'))
      .toBe('SOURCE_REVISION_TRANSITION_INVALID');
    expect(k331e.transitionEntityExact('2', '1', updated, 'update'))
      .toBe('SOURCE_REVISION_TRANSITION_INVALID');
    expect(k331e.transitionEntityExact('2', '4', updated, 'update'))
      .toBe('SOURCE_REVISION_TRANSITION_INVALID');
  });

  it('K-331E: purge certificates authenticate prior tombstone and exact purge revision', () => {
    let digestIndex = 0;
    const digest = () => k331e.sha256Hex('ABSINTHE_TEST_DIGEST_V1', [digestIndex++]);
    const certificate = k331e.createPurgeCertificate({ namespaceFingerprint: 'namespace',
      generationId: 'generation', entityType: 'note', entityIdDigest: digest(),
      priorTombstoneRevision: '3', priorTombstoneReceiptDigest: digest(), purgeOperationId: 'purge-a',
      previousSourceRevision: '3', committedPurgeRevision: '4', resultingAuthorityDigest: digest(),
      sourceLineageReceiptDigest: digest() });
    expect(certificate.certificateDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(k331e.verifyPurgeCertificate(certificate)).toBe(true);
    expect(k331e.verifyPurgeCertificate(Object.freeze({ ...certificate,
      priorTombstoneReceiptDigest: digest() }))).toBe(false);
    expect(() => k331e.createPurgeCertificate({ ...certificate, priorTombstoneRevision: '03',
      certificateDigest: undefined } as never)).toThrow('SOURCE_REVISION_TRANSITION_INVALID');
  });

  it('K-331E: attachment locator classes prohibit transient authority and preserve operational invariance', () => {
    expect(k331e.ATTACHMENT_FIELD_CLASSIFICATION.promotedCanonical)
      .toEqual(['localBlobKey', 'remoteBlobKey', 'remoteProvider', 'remoteFileId']);
    expect(k331e.ATTACHMENT_FIELD_CLASSIFICATION.transientSecret)
      .toEqual(['resumableUploadUri', 'signedUrl', 'accessToken']);
    expect(k331e.ATTACHMENT_FIELD_CLASSIFICATION.prohibited)
      .toContain('temporaryUploadLocator');
    const baseline = attachmentProjectionFixture();
    const changed = Object.freeze({ ...baseline, operational: Object.freeze({ ...baseline.operational,
      retryCount: 99, progress: 0.9, leaseOwner: 'lease-b', updatedAt: '2026-07-18T00:00:00.000Z' }) });
    expect(attachmentAuthorityDigestFixture(changed)).toBe(attachmentAuthorityDigestFixture(baseline));
    expect(k331e.transitionEntityExact('1', '2', Object.freeze({ lifecycle: 'active',
      createdSourceRevision: '1', lastMutatedSourceRevision: '1', deletedSourceRevision: null,
      revisionZeroInitialization: 'native' }), 'update')).toMatchObject({ lastMutatedSourceRevision: '2' });
  });

  it('K-331E: bootstrap segments compute roots and reject oversized records', () => {
    const segment = k331eBootstrapSegment('entities');
    expect(segment.segmentDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(segment.recordRoot).toMatch(/^[0-9a-f]{64}$/);
    const oversized = k331e.createBootstrapSegment({ sessionId: 'bootstrap-session-a',
      category: 'entities', segmentIndex: 0, previousSegmentDigest: null, previousLastKey: null,
      continuationStartDigest: 'start', continuationEndDigest: 'end', baselineDigest: 'baseline',
      records: Object.freeze([Object.freeze({ key: 'x'.repeat(k331e.K331E_LIMITS.maxBootstrapSegmentBytes),
        valueDigest: k331e.sha256Hex('VALUE', ['x']) })]), endOfCategory: true });
    expect(oversized).toBe('BOOTSTRAP_RECORD_TOO_LARGE');
  });

  it('K-331E: bootstrap category accumulators authenticate predecessor and keyspace continuity', () => {
    const first = k331eBootstrapSegment('entities', 0, null, false);
    const initial = k331e.emptyBootstrapCategory('bootstrap-session-a', 'entities', 'cursor:start');
    const afterFirst = k331e.appendBootstrapSegment(initial, first);
    if (typeof afterFirst === 'string') throw new Error(afterFirst);
    const second = k331eBootstrapSegment('entities', 1, first, true);
    const complete = k331e.appendBootstrapSegment(afterFirst, second);
    expect(complete).toMatchObject({ segmentCount: 2, totalRecordCount: 2, endOfCategory: true });
    expect(k331e.appendBootstrapSegment(initial, Object.freeze({ ...first,
      continuationStartDigest: 'wrong' }))).toBe('BOOTSTRAP_SEGMENT_PATH_INVALID');
    const segmentInput = (key: string, continuationStartDigest: string) => k331e.createBootstrapSegment({
      sessionId: 'bootstrap-session-a', category: 'entities', segmentIndex: 1,
      previousSegmentDigest: first.segmentDigest, previousLastKey: first.lastKey,
      continuationStartDigest, continuationEndDigest: 'cursor:end',
      baselineDigest: first.baselineDigest, records: Object.freeze([Object.freeze({ key,
        valueDigest: k331e.sha256Hex('ABSINTHE_BOOTSTRAP_VALUE_V1', [key]) })]), endOfCategory: true });
    const gap = segmentInput('entities:1:z', 'wrong-cursor');
    if (typeof gap === 'string') throw new Error(gap);
    expect(k331e.appendBootstrapSegment(afterFirst, gap)).toBe('BOOTSTRAP_SEGMENT_RANGE_GAP');
    const overlap = segmentInput(first.lastKey, first.continuationEndDigest);
    if (typeof overlap === 'string') throw new Error(overlap);
    expect(k331e.appendBootstrapSegment(afterFirst, overlap)).toBe('BOOTSTRAP_SEGMENT_RANGE_OVERLAP');
    expect(k331e.appendBootstrapSegment(initial, Object.freeze({ ...first,
      sessionId: 'other-session' }))).toBe('BOOTSTRAP_SEGMENT_PATH_INVALID');
  });

  it('K-331E: revision-zero finalization reads only fixed category accumulator states', () => {
    const categories = ['attachments', 'checkpoints', 'entities', 'outbox', 'relations'].map(category => {
      const initial = k331e.emptyBootstrapCategory('bootstrap-session-a', category, 'cursor:start');
      const complete = k331e.appendBootstrapSegment(initial, k331eBootstrapSegment(category));
      if (typeof complete === 'string') throw new Error(complete);
      return complete;
    });
    const result = k331e.finalizeBootstrapFromAccumulators({ sessionId: 'bootstrap-session-a',
      namespaceFingerprint: 'namespace', generationId: 'generation', baselineDigest: 'baseline',
      sourceAuthorityAbsent: true, quiescent: true, categories });
    expect(result).toMatchObject({ ok: true, revision: '0', accumulatorReads: 5 });
    expect(k331e.finalizeBootstrapFromAccumulators({ sessionId: 'bootstrap-session-a',
      namespaceFingerprint: 'namespace', generationId: 'generation', baselineDigest: 'baseline',
      sourceAuthorityAbsent: true, quiescent: true, categories: categories.slice(1) }))
      .toEqual({ ok: false, code: 'BOOTSTRAP_CATEGORY_ACCUMULATOR_MISMATCH' });
    expect(k331e.finalizeBootstrapFromAccumulators({ sessionId: 'bootstrap-session-a',
      namespaceFingerprint: 'namespace', generationId: 'generation', baselineDigest: 'baseline',
      sourceAuthorityAbsent: true, quiescent: true, categories: Object.freeze([
        Object.freeze({ ...categories[0], totalRecordCount: 99 }), ...categories.slice(1),
      ]) })).toEqual({ ok: false, code: 'BOOTSTRAP_CATEGORY_ACCUMULATOR_MISMATCH' });
  });

  it('K-331E: restore accumulator derives cursor without traversing historical chunks', () => {
    let accumulator = k331e.emptyRestoreAccumulator('restore-a',
      k331e.sha256Hex('RESTORE_PLAN', ['a']), '10', k331e.sha256Hex('AUTHORITY', ['10']));
    for (let index = 0; index < 130; index += 1) {
      const next = k331e.appendRestoreChunk(accumulator, index, k331e.sha256Hex('CHUNK', [index]));
      if (typeof next === 'string') throw new Error(next);
      accumulator = next;
    }
    expect(accumulator).toMatchObject({ committedChunkCount: 130, lastChunkIndex: 129,
      finalRevision: '140', segmentMmr: { leafCount: 2 }, openChunkDigests: { length: 2 } });
    expect(k331e.appendRestoreChunk(accumulator, 131, k331e.sha256Hex('CHUNK', [131])))
      .toBe('RESTORE_CHUNK_PROOF_INVALID');
  });

  it('K-331E: restore finalization derives every field from persisted authority and is exact-retry stable', () => {
    let accumulator = k331e.emptyRestoreAccumulator('restore-a',
      k331e.sha256Hex('RESTORE_PLAN', ['a']), '10', k331e.sha256Hex('AUTHORITY', ['10']));
    for (let index = 0; index < 2; index += 1) {
      const next = k331e.appendRestoreChunk(accumulator, index, k331e.sha256Hex('CHUNK', [index]));
      if (typeof next === 'string') throw new Error(next);
      accumulator = next;
    }
    const sourceAuthority = k331eSourceAuthority(accumulator);
    const first = k331e.finalizeRestoreBounded({ sessionId: 'restore-a', planDigest: accumulator.planDigest,
      accumulator, sourceAuthority, quiescent: true, existingManifest: null });
    expect(first).toMatchObject({ ok: true, accumulatorReads: 1, reused: false,
      manifest: { finalRevision: accumulator.finalRevision, entityCount: 108, attachmentCount: 4 } });
    if (!first.ok) throw new Error(first.code);
    expect(first.manifest.manifestDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(k331e.finalizeRestoreBounded({ sessionId: 'restore-a', planDigest: accumulator.planDigest,
      accumulator, sourceAuthority, quiescent: true, existingManifest: first.manifest }))
      .toMatchObject({ ok: true, reused: true, manifest: first.manifest });
    expect(k331e.finalizeRestoreBounded({ sessionId: 'restore-a', planDigest: accumulator.planDigest,
      accumulator, sourceAuthority: Object.freeze({ ...sourceAuthority,
        entityRoot: k331e.sha256Hex('TAMPER', ['entity']) }), quiescent: true,
      existingManifest: null })).toEqual({
      ok: false, code: 'RESTORE_FINALIZATION_AUTHORITY_MISMATCH',
    });
    expect(k331e.finalizeRestoreBounded({ sessionId: 'restore-a', planDigest: accumulator.planDigest,
      accumulator, sourceAuthority, quiescent: false, existingManifest: null }))
      .toEqual({ ok: false, code: 'RESTORE_FINALIZATION_NOT_QUIESCENT' });
  });

  it('K-331E: every revision-bearing record decoder invokes total decoding', () => {
    for (const [kind, fields] of Object.entries(k331e.PERSISTED_REVISION_RECORDS)) {
      const valid = Object.fromEntries(fields.map(field => [field, field === 'deletedSourceRevision' ? null : '42']));
      expect(k331e.decodePersistedRevisionRecord(kind as keyof typeof k331e.PERSISTED_REVISION_RECORDS,
        1, valid)).toMatchObject({ ok: true });
      const corrupt = { ...valid, [fields[0]]: '042' };
      expect(k331e.decodePersistedRevisionRecord(kind as keyof typeof k331e.PERSISTED_REVISION_RECORDS,
        1, corrupt)).toEqual({ ok: false, code: 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE' });
    }
    expect(Object.keys(k331e.PERSISTED_REVISION_RECORDS)).toContain('mmr_accumulator');
    expect(Object.keys(k331e.PERSISTED_REVISION_RECORDS)).toContain('purge_certificate');
  });

  it('K-331E: mixed versions and stable error classes fail closed', () => {
    expect(k331e.versionsCompatible({ receipt: 1, segment: 1, mmr: 1, restore: 1 })).toBe(true);
    expect(k331e.versionsCompatible({ receipt: 1, segment: 2, mmr: 1 })).toBe(false);
    expect(k331e.decodePersistedRevisionRecord('mmr_accumulator', 2,
      { lastCommittedRevision: '42' })).toEqual({ ok: false, code: 'PROTOCOL_VERSION_UNSUPPORTED' });
    const proof = k331eHistoricalProof();
    const decoded = JSON.parse(proof.mmrProofEncoded) as unknown[];
    decoded[1] = 2;
    expect(k331e.decodeMmrProof(JSON.stringify(decoded)))
      .toEqual({ ok: false, code: 'LINEAGE_PROOF_VERSION_UNSUPPORTED' });
    expect(Object.keys(k331e.K331E_STABLE_ERRORS)).toHaveLength(26);
    expect(new Set(Object.values(k331e.K331E_STABLE_ERRORS)))
      .toEqual(new Set(['NON_RETRYABLE', 'OWNER_INTERVENTION', 'CORRUPTION', 'RESTART_REQUIRED', 'RETRYABLE']));
  });
});
