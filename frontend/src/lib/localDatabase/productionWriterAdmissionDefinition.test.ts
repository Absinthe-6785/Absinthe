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
  if (lineage.length === 0) return false;
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
  admissionOpen: false;
  admittedOperationCount: 0;
  unresolvedOperationCount: 0;
  inFlightSourceCommitCount: 0;
  pendingReceiptReconciliationCount: 0;
  allWritersQuiescent: true;
  coordinationQuiescent: true;
  epochTransitionInProgress: false;
  activeRestoreSession: false;
  activeMigrationSession: false;
  activeRecoverySession: false;
  conflictingMaintenanceOwner: false;
  bootstrapMethodVersion: string;
  bootstrapEvidenceDigest: string;
}>;

type BootstrapResult =
  | Readonly<{ ok: true; authority: BootstrapEvidenceFixture; reused: boolean }>
  | Readonly<{ ok: false; code:
      | 'SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT'
      | 'SOURCE_AUTHORITY_BOOTSTRAP_NOT_QUIESCENT'
      | 'SOURCE_AUTHORITY_BOOTSTRAP_SESSION_CONFLICT' }>;

type BootstrapCandidateFixture = Omit<BootstrapEvidenceFixture,
  'revision' | 'admissionOpen' | 'admittedOperationCount' | 'unresolvedOperationCount'
  | 'inFlightSourceCommitCount' | 'pendingReceiptReconciliationCount'
  | 'allWritersQuiescent' | 'coordinationQuiescent' | 'epochTransitionInProgress'
  | 'activeRestoreSession' | 'activeMigrationSession' | 'activeRecoverySession'
  | 'conflictingMaintenanceOwner'> & Readonly<{
    admittedOperationCount: number;
    unresolvedOperationCount: number;
    admissionOpen: boolean;
    inFlightSourceCommitCount: number;
    pendingReceiptReconciliationCount: number;
    allWritersQuiescent: boolean;
    coordinationQuiescent: boolean;
    epochTransitionInProgress: boolean;
    activeRestoreSession: boolean;
    activeMigrationSession: boolean;
    activeRecoverySession: boolean;
    conflictingMaintenanceOwner: boolean;
  }>;

const ATTACHMENT_METADATA_AUTHORITY_POLICY = Object.freeze({
  authorityBearing: Object.freeze([
    'attachmentId', 'referencedBy', 'localAvailability', 'remoteAvailability', 'checksumState',
    'syncState', 'storageLocatorReference', 'createdAt', 'updatedAt', 'generationId',
  ]),
  excluded: Object.freeze(['blobBytes', 'externalProviderPayload', 'cacheBytes']),
  attachmentBlobAtomicity: 'not_claimed',
});

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
    admissionOpen: false,
    admittedOperationCount: 0,
    unresolvedOperationCount: 0,
    inFlightSourceCommitCount: 0,
    pendingReceiptReconciliationCount: 0,
    allWritersQuiescent: true,
    coordinationQuiescent: true,
    epochTransitionInProgress: false,
    activeRestoreSession: false,
    activeMigrationSession: false,
    activeRecoverySession: false,
    conflictingMaintenanceOwner: false,
    bootstrapMethodVersion: 'bootstrap-v1',
    bootstrapEvidenceDigest: 'bootstrap-digest',
    ...overrides,
  });
}

function bootstrapSourceAuthorityFixture(
  existing: BootstrapEvidenceFixture | null,
  candidate: BootstrapCandidateFixture,
): BootstrapResult {
  if (candidate.admissionOpen || candidate.admittedOperationCount !== 0
    || candidate.unresolvedOperationCount !== 0 || candidate.inFlightSourceCommitCount !== 0
    || candidate.pendingReceiptReconciliationCount !== 0 || !candidate.allWritersQuiescent
    || !candidate.coordinationQuiescent || candidate.epochTransitionInProgress) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_NOT_QUIESCENT' };
  }
  if (candidate.activeRestoreSession || candidate.activeMigrationSession || candidate.activeRecoverySession
    || candidate.conflictingMaintenanceOwner) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_SESSION_CONFLICT' };
  }
  const authority = Object.freeze({ ...candidate, revision: '0' as const,
    admissionOpen: false as const,
    admittedOperationCount: 0 as const, unresolvedOperationCount: 0 as const,
    inFlightSourceCommitCount: 0 as const, pendingReceiptReconciliationCount: 0 as const,
    allWritersQuiescent: true as const, coordinationQuiescent: true as const,
    epochTransitionInProgress: false as const, activeRestoreSession: false as const,
    activeMigrationSession: false as const, activeRecoverySession: false as const,
    conflictingMaintenanceOwner: false as const });
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
    value.coordinationEpoch, value.coordinationStateDigest,
    value.admissionOpen, value.admittedOperationCount, value.unresolvedOperationCount,
    value.inFlightSourceCommitCount, value.pendingReceiptReconciliationCount,
    value.allWritersQuiescent, value.coordinationQuiescent, value.epochTransitionInProgress,
    value.activeRestoreSession, value.activeMigrationSession, value.activeRecoverySession,
    value.conflictingMaintenanceOwner, value.bootstrapMethodVersion, value.bootstrapEvidenceDigest,
  ]);
  const existingCanonical = canonical(existing);
  const candidateCanonical = canonical(authority);
  if (existingCanonical !== candidateCanonical) {
    return { ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT' };
  }
  return { ok: true, authority: existing, reused: true };
}

type RestoreChunkReceiptFixture = Readonly<{
  restoreSessionId: string;
  chunkIndex: number;
  previousChunkReceiptDigest: string;
  previousSourceRevision: string;
  committedSourceRevision: string;
  chunkInputDigest: string;
  chunkResultDigest: string;
  affectedEntityDigest: string;
  affectedEntityCount: number;
  attachmentMetadataDigest: string;
  attachmentMetadataCount: number;
  immutableOutboxIntentDigest: string;
  immutableOutboxIntentCount: number;
  checkpointEffectDigest: string;
  chunkReceiptDigest: string;
}>;

type RestoreFinalManifestFixture = Readonly<{
  restoreSessionId: string;
  baseSourceRevision: string;
  finalCommittedSourceRevision: string;
  orderedChunkChainDigest: string;
  completeAuthorityDigest: string;
  finalEntityCount: number;
  finalEntityDigest: string;
  finalAttachmentMetadataCount: number;
  finalAttachmentMetadataDigest: string;
  finalOutboxCount: number;
  finalOutboxIntentDigest: string;
  finalCheckpointDigest: string;
  protocolVersion: string;
  completionState: 'complete';
  evidenceOnly: true;
  sourceRevisionIncremented: false;
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
  const receipt = Object.freeze({
    restoreSessionId: state.restoreSessionId,
    chunkIndex,
    previousChunkReceiptDigest,
    previousSourceRevision: previousRevision,
    committedSourceRevision,
    chunkInputDigest,
    chunkResultDigest: `chunk-result:${chunkIndex}`,
    affectedEntityDigest: `entities:${chunkIndex}`,
    affectedEntityCount: 54,
    attachmentMetadataDigest: `attachments:${chunkIndex}`,
    attachmentMetadataCount: 2,
    immutableOutboxIntentDigest: `outbox-intent:${chunkIndex}`,
    immutableOutboxIntentCount: 54,
    checkpointEffectDigest: `checkpoint:${chunkIndex}`,
    chunkReceiptDigest: `chunk-receipt:${previousChunkReceiptDigest}:${chunkIndex}:${committedSourceRevision}`,
  });
  return { ok: true, receipt, reused: false, state: Object.freeze({
    ...state, receipts: Object.freeze([...state.receipts, receipt]), recordedCursor: chunkIndex + 1,
  }) };
}

type RestoreFinalizeResult =
  | Readonly<{ ok: true; state: ChunkedRestoreFixture; manifest: RestoreFinalManifestFixture }>
  | Readonly<{ ok: false; code: 'RESTORE_FINALIZATION_INCOMPLETE' | 'RESTORE_FINAL_DIGEST_MISMATCH' }>;

function finalizeRestoreFixture(
  state: ChunkedRestoreFixture,
  completeAuthorityDigestMatches: boolean,
): RestoreFinalizeResult {
  if (state.receipts.length !== state.plannedChunkDigests.length) {
    return { ok: false, code: 'RESTORE_FINALIZATION_INCOMPLETE' };
  }
  if (!completeAuthorityDigestMatches) return { ok: false, code: 'RESTORE_FINAL_DIGEST_MISMATCH' };
  const last = state.receipts.at(-1)!;
  const manifest = Object.freeze({
    restoreSessionId: state.restoreSessionId,
    baseSourceRevision: state.baseSourceRevision,
    finalCommittedSourceRevision: last.committedSourceRevision,
    orderedChunkChainDigest: last.chunkReceiptDigest,
    completeAuthorityDigest: 'restored-authority-digest',
    finalEntityCount: 108,
    finalEntityDigest: 'final-entity-digest',
    finalAttachmentMetadataCount: 4,
    finalAttachmentMetadataDigest: 'final-attachment-digest',
    finalOutboxCount: 108,
    finalOutboxIntentDigest: 'final-outbox-intent-digest',
    finalCheckpointDigest: 'final-checkpoint-digest',
    protocolVersion: state.protocolVersion,
    completionState: 'complete' as const,
    evidenceOnly: true as const,
    sourceRevisionIncremented: false as const,
  });
  return { ok: true, manifest, state: Object.freeze({ ...state, status: 'finalized', finalManifest: manifest }) };
}

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

  it('architecture fixture: source authority bootstrap binds revision zero to the verified snapshot', () => {
    const result = bootstrapSourceAuthorityFixture(null, bootstrapCandidate());
    expect(result).toMatchObject({ ok: true, reused: false, authority: {
      authorityRecordVersion: 'source-authority-bootstrap-v1', revision: '0',
      databaseName: 'absinthe-local-v2', aggregateEntityDigest: 'entity-digest',
      noteCount: 103, folderCount: 5, tombstoneCount: 2, relationshipCount: 108,
      relationshipDigest: 'relationship-digest', attachmentMetadataDigest: 'attachment-metadata-digest',
      checkpointCount: 1, checkpointVersion: 'checkpoint-v1',
      generationManifestDigest: 'manifest-digest', admittedOperationCount: 0, unresolvedOperationCount: 0,
      admissionOpen: false, inFlightSourceCommitCount: 0, pendingReceiptReconciliationCount: 0,
      allWritersQuiescent: true, coordinationQuiescent: true, epochTransitionInProgress: false,
    } });
  });

  it('architecture fixture: exact bootstrap retry is idempotent and creates no mutation receipt', () => {
    const candidate = bootstrapCandidate();
    const first = bootstrapSourceAuthorityFixture(null, candidate);
    if (!first.ok) throw new Error(first.code);
    const retry = bootstrapSourceAuthorityFixture(first.authority, candidate);
    expect(retry).toEqual({ ok: true, authority: first.authority, reused: true });
    expect(Object.keys(first.authority)).not.toContain('operationId');
    expect(Object.keys(first.authority)).not.toContain('receiptDigest');
  });

  it('architecture fixture: conflicting bootstrap evidence fails closed', () => {
    const first = bootstrapSourceAuthorityFixture(null, bootstrapCandidate());
    if (!first.ok) throw new Error(first.code);
    for (const candidate of [
      bootstrapCandidate({ aggregateEntityDigest: 'changed-entity-digest' }),
      bootstrapCandidate({ attachmentMetadataDigest: 'changed-attachment-digest' }),
      bootstrapCandidate({ generationId: 'generation-b' }),
    ]) {
      expect(bootstrapSourceAuthorityFixture(first.authority, candidate))
        .toEqual({ ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_CONFLICT' });
    }
  });

  it('architecture fixture: revision-zero bootstrap requires an exclusive quiescent boundary', () => {
    for (const candidate of [
      bootstrapCandidate({ admissionOpen: true }),
      bootstrapCandidate({ admittedOperationCount: 1 }),
      bootstrapCandidate({ unresolvedOperationCount: 1 }),
      bootstrapCandidate({ inFlightSourceCommitCount: 1 }),
      bootstrapCandidate({ pendingReceiptReconciliationCount: 1 }),
      bootstrapCandidate({ allWritersQuiescent: false }),
      bootstrapCandidate({ coordinationQuiescent: false }),
      bootstrapCandidate({ epochTransitionInProgress: true }),
    ]) {
      expect(bootstrapSourceAuthorityFixture(null, candidate))
        .toEqual({ ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_NOT_QUIESCENT' });
    }
    for (const candidate of [
      bootstrapCandidate({ activeRestoreSession: true }),
      bootstrapCandidate({ activeMigrationSession: true }),
      bootstrapCandidate({ activeRecoverySession: true }),
      bootstrapCandidate({ conflictingMaintenanceOwner: true }),
    ]) {
      expect(bootstrapSourceAuthorityFixture(null, candidate))
        .toEqual({ ok: false, code: 'SOURCE_AUTHORITY_BOOTSTRAP_SESSION_CONFLICT' });
    }
  });

  it('policy snapshot: attachment metadata is authority-bearing while blob bytes remain external', () => {
    expect(ATTACHMENT_METADATA_AUTHORITY_POLICY).toEqual({
      authorityBearing: ['attachmentId', 'referencedBy', 'localAvailability', 'remoteAvailability',
        'checksumState', 'syncState', 'storageLocatorReference', 'createdAt', 'updatedAt', 'generationId'],
      excluded: ['blobBytes', 'externalProviderPayload', 'cacheBytes'],
      attachmentBlobAtomicity: 'not_claimed',
    });
  });

  it('architecture fixture: restore chunks advance an ordered source-revision receipt chain', () => {
    const first = commitRestoreChunkFixture(restoreFixture(), 0, 'chunk-input-0');
    expect(first).toMatchObject({ ok: true, reused: false, receipt: {
      chunkIndex: 0, previousSourceRevision: '10', committedSourceRevision: '11',
      previousChunkReceiptDigest: 'restore-chain-root',
    } });
    if (!first.ok) throw new Error(first.code);
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

  it('architecture fixture: final restore manifest is evidence-only and does not increment revision', () => {
    expect(finalizeRestoreFixture(restoreFixture(), true))
      .toEqual({ ok: false, code: 'RESTORE_FINALIZATION_INCOMPLETE' });
    const first = commitRestoreChunkFixture(restoreFixture(), 0, 'chunk-input-0');
    if (!first.ok) throw new Error(first.code);
    const second = commitRestoreChunkFixture(first.state, 1, 'chunk-input-1');
    if (!second.ok) throw new Error(second.code);
    expect(finalizeRestoreFixture(second.state, false))
      .toEqual({ ok: false, code: 'RESTORE_FINAL_DIGEST_MISMATCH' });
    const finalized = finalizeRestoreFixture(second.state, true);
    expect(finalized).toMatchObject({ ok: true, manifest: {
      baseSourceRevision: '10', finalCommittedSourceRevision: '12', evidenceOnly: true,
      sourceRevisionIncremented: false,
    } });
    if (!finalized.ok) throw new Error('restore finalization failed');
    expect(finalized.state.status).toBe('finalized');
    expect(restoreEligible(finalized.state)).toBe(true);
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
});
