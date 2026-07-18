import { createHash } from 'node:crypto';

export const K331F_LIMITS = Object.freeze({
  maxRevisionDigits: 16,
  maxSourceRevision: 9_999_999_999_999_999n,
  segmentSize: 64,
  maxSegments: 156_250_000_000_000,
  maxMmrHeight: 47,
  maxPeakCount: 47,
  maxSegmentMerklePathNodes: 6,
  maxMmrComponentNodes: 92,
  maxCompleteHistoricalProofNodes: 98,
  maxHistoricalProofNodes: 104,
  maxEncodedProofBytes: 32 * 1024,
  maxBootstrapRecordsPerSegment: 64,
  maxBootstrapSegmentBytes: 256 * 1024,
  maxRestoreChunksPerSegment: 64,
  maxIdentifierBytes: 256,
});

export const K331F_DOMAINS = Object.freeze({
  receipt: 'ABSINTHE_SOURCE_RECEIPT_V1',
  receiptLeaf: 'ABSINTHE_SEGMENT_RECEIPT_LEAF_V1',
  segmentNode: 'ABSINTHE_SEGMENT_MERKLE_NODE_V1',
  segmentEmpty: 'ABSINTHE_SEGMENT_EMPTY_NODE_V1',
  segmentRoot: 'ABSINTHE_SEGMENT_ROOT_V1',
  segmentCheckpoint: 'ABSINTHE_SEGMENT_CHECKPOINT_V1',
  mmrLeaf: 'ABSINTHE_MMR_LEAF_V1',
  mmrNode: 'ABSINTHE_MMR_NODE_V1',
  mmrPeaks: 'ABSINTHE_MMR_BAGGED_PEAKS_V1',
  mmrState: 'ABSINTHE_MMR_STATE_V1',
  sourceAuthority: 'ABSINTHE_SOURCE_AUTHORITY_V1',
  compactedIndex: 'ABSINTHE_COMPACTED_RECEIPT_INDEX_V1',
  purgeCertificate: 'ABSINTHE_PURGE_CERTIFICATE_V1',
  bootstrapObservation: 'ABSINTHE_BOOTSTRAP_ITERATOR_OBSERVATION_V1',
  bootstrapRecord: 'ABSINTHE_BOOTSTRAP_RECORD_V1',
  bootstrapSegment: 'ABSINTHE_BOOTSTRAP_SEGMENT_V1',
  bootstrapCategory: 'ABSINTHE_BOOTSTRAP_CATEGORY_ACCUMULATOR_V1',
  bootstrapTerminal: 'ABSINTHE_BOOTSTRAP_TERMINAL_EVIDENCE_V1',
  bootstrapFinal: 'ABSINTHE_BOOTSTRAP_FINAL_AUTHORITY_V1',
  restoreChunk: 'ABSINTHE_RESTORE_CHUNK_RECEIPT_V1',
  restoreSegment: 'ABSINTHE_RESTORE_SEGMENT_CHECKPOINT_V1',
  restoreAccumulator: 'ABSINTHE_RESTORE_ACCUMULATOR_V1',
  restoreCombinedRoot: 'ABSINTHE_RESTORE_COMBINED_ROOT_V1',
  restoreManifest: 'ABSINTHE_RESTORE_FINAL_MANIFEST_V1',
} as const);

export const K331F_STABLE_ERRORS = Object.freeze({
  CANONICAL_VALUE_INVALID: 'CORRUPTION',
  CANONICAL_REQUIRED_FIELD_MISSING: 'CORRUPTION',
  LINEAGE_STALE_AUTHORITY_PROOF: 'RESTART_REQUIRED',
  LINEAGE_AUTHORITY_POINTER_MISMATCH: 'OWNER_INTERVENTION',
  LINEAGE_MMR_STATE_MISSING: 'OWNER_INTERVENTION',
  LINEAGE_RECORD_DECODE_FAILED: 'CORRUPTION',
  LINEAGE_DIGEST_INVALID: 'CORRUPTION',
  LINEAGE_NAMESPACE_GENERATION_MISMATCH: 'OWNER_INTERVENTION',
  LINEAGE_COORDINATE_MISMATCH: 'CORRUPTION',
  LINEAGE_RECEIPT_DIGEST_MISMATCH: 'CORRUPTION',
  LINEAGE_SEGMENT_PATH_INVALID: 'CORRUPTION',
  LINEAGE_SEGMENT_CHECKPOINT_CONFLICT: 'OWNER_INTERVENTION',
  LINEAGE_MMR_PATH_INVALID: 'CORRUPTION',
  LINEAGE_PROOF_TOO_LARGE: 'NON_RETRYABLE',
  LINEAGE_PROOF_NODE_LIMIT_EXCEEDED: 'NON_RETRYABLE',
  LINEAGE_PROOF_VERSION_UNSUPPORTED: 'OWNER_INTERVENTION',
  LINEAGE_APPEND_SEAL_CONFLICT: 'RESTART_REQUIRED',
  LINEAGE_COMPACTED_INDEX_INCOMPLETE: 'OWNER_INTERVENTION',
  LINEAGE_COMPACTION_REFERENCE_ACTIVE: 'RETRYABLE',
  LINEAGE_COMPACTION_INDEX_CONFLICT: 'OWNER_INTERVENTION',
  LINEAGE_POST_COMPACTION_AUTHORITY_MISSING: 'OWNER_INTERVENTION',
  LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE: 'RETRYABLE',
  SOURCE_REVISION_TRANSITION_INVALID: 'CORRUPTION',
  OPERATION_IDENTITY_MISMATCH: 'OWNER_INTERVENTION',
  PURGE_TOMBSTONE_PROOF_INVALID: 'OWNER_INTERVENTION',
  PURGE_TOMBSTONE_NOT_LATEST: 'OWNER_INTERVENTION',
  ATTACHMENT_AUTHORITY_CLASSIFICATION_MISMATCH: 'OWNER_INTERVENTION',
  ATTACHMENT_PROMOTION_EVIDENCE_INVALID: 'OWNER_INTERVENTION',
  BOOTSTRAP_RECORD_TOO_LARGE: 'OWNER_INTERVENTION',
  BOOTSTRAP_BASELINE_MISMATCH: 'RESTART_REQUIRED',
  BOOTSTRAP_ACCUMULATOR_INVALID: 'OWNER_INTERVENTION',
  BOOTSTRAP_KEY_ORDER_INVALID: 'CORRUPTION',
  BOOTSTRAP_DUPLICATE_NORMALIZED_KEY: 'CORRUPTION',
  BOOTSTRAP_TERMINAL_EVIDENCE_INVALID: 'OWNER_INTERVENTION',
  BOOTSTRAP_SEGMENT_PATH_INVALID: 'CORRUPTION',
  BOOTSTRAP_SEGMENT_RANGE_GAP: 'RESTART_REQUIRED',
  BOOTSTRAP_SEGMENT_RANGE_OVERLAP: 'CORRUPTION',
  BOOTSTRAP_NOT_QUIESCENT: 'RETRYABLE',
  BOOTSTRAP_SOURCE_AUTHORITY_CONFLICT: 'RESTART_REQUIRED',
  RESTORE_RECORD_DECODE_FAILED: 'CORRUPTION',
  RESTORE_OPEN_SEGMENT_INVALID: 'OWNER_INTERVENTION',
  RESTORE_MMR_STATE_INVALID: 'OWNER_INTERVENTION',
  RESTORE_ACCUMULATOR_INVALID: 'OWNER_INTERVENTION',
  RESTORE_CURSOR_INVALID: 'CORRUPTION',
  RESTORE_NOT_QUIESCENT: 'RETRYABLE',
  RESTORE_FINALIZATION_AUTHORITY_MISMATCH: 'OWNER_INTERVENTION',
  PROTOCOL_VERSION_UNSUPPORTED: 'OWNER_INTERVENTION',
  MIXED_PROTOCOL_VERSION_EVIDENCE: 'OWNER_INTERVENTION',
  SOURCE_REVISION_CORRUPT_PERSISTED_STATE: 'OWNER_INTERVENTION',
} as const);

export type StableErrorCode = keyof typeof K331F_STABLE_ERRORS;
export type ProtocolResult<T> = Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; code: StableErrorCode }>;

const ok = <T>(value: T): ProtocolResult<T> => Object.freeze({ ok: true, value });
const fail = <T = never>(code: StableErrorCode): ProtocolResult<T> => Object.freeze({ ok: false, code });

type CanonicalValue = null | boolean | number | string | readonly CanonicalValue[];

function normalizeCanonicalUnknown(value: unknown): ProtocolResult<CanonicalValue> {
  if (value === null || typeof value === 'boolean') return ok(value);
  if (typeof value === 'string') return ok(value.normalize('NFC'));
  if (typeof value === 'number') return Number.isSafeInteger(value)
    ? ok(value) : fail('CANONICAL_VALUE_INVALID');
  if (!Array.isArray(value)) return fail(value === undefined
    ? 'CANONICAL_REQUIRED_FIELD_MISSING' : 'CANONICAL_VALUE_INVALID');
  const normalized: CanonicalValue[] = [];
  for (const item of value) {
    const decoded = normalizeCanonicalUnknown(item);
    if (!decoded.ok) return decoded;
    normalized.push(decoded.value);
  }
  return ok(Object.freeze(normalized));
}

export function canonicalBytes(domain: unknown, fields: unknown): ProtocolResult<Uint8Array> {
  if (typeof domain !== 'string' || !Array.isArray(fields)) return fail('CANONICAL_VALUE_INVALID');
  const normalized = normalizeCanonicalUnknown([domain, 1, ...fields]);
  if (!normalized.ok) return normalized;
  return ok(new TextEncoder().encode(JSON.stringify(normalized.value)));
}

export function canonicalDigest(domain: unknown, fields: unknown): ProtocolResult<string> {
  const bytes = canonicalBytes(domain, fields);
  return bytes.ok ? ok(createHash('sha256').update(bytes.value).digest('hex')) : bytes;
}

export function sha256Hex(domain: string, fields: readonly CanonicalValue[]): string {
  const normalized = normalizeCanonicalUnknown([domain, 1, ...fields]);
  return createHash('sha256').update(new TextEncoder().encode(JSON.stringify(
    normalized.ok ? normalized.value : ['ABSINTHE_INVALID_INTERNAL_CANONICAL_VALUE'],
  ))).digest('hex');
}

export const optionalAbsent = Object.freeze(['absent'] as const);
export const optionalPresent = (value: CanonicalValue) => Object.freeze(['present', value] as const);
export const explicitNull = Object.freeze(['null'] as const);

export function decodeDigest(value: unknown): ProtocolResult<string> {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value)
    ? ok(value) : fail('LINEAGE_DIGEST_INVALID');
}

export function decodeRevision(value: unknown): ProtocolResult<Readonly<{ canonical: string; value: bigint }>> {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(value)) {
    return fail('SOURCE_REVISION_CORRUPT_PERSISTED_STATE');
  }
  const decoded = BigInt(value);
  return decoded <= K331F_LIMITS.maxSourceRevision
    ? ok(Object.freeze({ canonical: value, value: decoded }))
    : fail('SOURCE_REVISION_CORRUPT_PERSISTED_STATE');
}

export type RevisionCoordinate = Readonly<{ revision: string; segmentIndex: number; leafIndex: number }>;

export function revisionCoordinate(value: unknown): ProtocolResult<RevisionCoordinate> {
  const decoded = decodeRevision(value);
  if (!decoded.ok || decoded.value.value === 0n) return fail('LINEAGE_COORDINATE_MISMATCH');
  const ordinal = decoded.value.value - 1n;
  return ok(Object.freeze({ revision: decoded.value.canonical,
    segmentIndex: Number(ordinal / BigInt(K331F_LIMITS.segmentSize)),
    leafIndex: Number(ordinal % BigInt(K331F_LIMITS.segmentSize)) }));
}

function exactObject(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const actual = Object.keys(value as Record<string, unknown>).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length && actual.every((key, index) => key === expected[index])
    && actual.every(key => (value as Record<string, unknown>)[key] !== undefined);
}

function boundedText(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
    && new TextEncoder().encode(value).byteLength <= K331F_LIMITS.maxIdentifierBytes;
}

const RECEIPT_KEYS = Object.freeze(['kind', 'version', 'namespaceFingerprint', 'generationId',
  'operationId', 'writerSessionDigest', 'admissionDigest', 'mutationKind', 'previousSourceRevision',
  'committedSourceRevision', 'segmentIndex', 'leafIndex', 'canonicalInputDigest',
  'affectedRecordIdentityDigest', 'committedResultDigest', 'immutableOutboxIntentDigest',
  'committedAuthorityDigest', 'previousReceiptChainDigest', 'receiptDigest']);

export type MutationKind = 'NOTE_UPSERT' | 'NOTE_TOMBSTONE' | 'NOTE_RESURRECT' | 'NOTE_PURGE';
const MUTATION_KINDS = new Set<unknown>(['NOTE_UPSERT', 'NOTE_TOMBSTONE', 'NOTE_RESURRECT', 'NOTE_PURGE']);

export type SourceReceipt = Readonly<{
  kind: 'absinthe_source_receipt'; version: 1; namespaceFingerprint: string; generationId: string;
  operationId: string; writerSessionDigest: string; admissionDigest: string; mutationKind: MutationKind;
  previousSourceRevision: string; committedSourceRevision: string; segmentIndex: number; leafIndex: number;
  canonicalInputDigest: string; affectedRecordIdentityDigest: string; committedResultDigest: string;
  immutableOutboxIntentDigest: string; committedAuthorityDigest: string;
  previousReceiptChainDigest: string | null; receiptDigest: string;
}>;

function receiptFields(receipt: Omit<SourceReceipt, 'kind' | 'version' | 'receiptDigest'>): readonly CanonicalValue[] {
  return [receipt.namespaceFingerprint, receipt.generationId, receipt.operationId,
    receipt.writerSessionDigest, receipt.admissionDigest, receipt.mutationKind,
    receipt.previousSourceRevision, receipt.committedSourceRevision, receipt.segmentIndex,
    receipt.leafIndex, receipt.canonicalInputDigest, receipt.affectedRecordIdentityDigest,
    receipt.committedResultDigest, receipt.immutableOutboxIntentDigest,
    receipt.committedAuthorityDigest, receipt.previousReceiptChainDigest];
}

export function decodeSourceReceipt(value: unknown): ProtocolResult<SourceReceipt> {
  if (!exactObject(value, RECEIPT_KEYS) || value.kind !== 'absinthe_source_receipt') {
    return fail('LINEAGE_RECORD_DECODE_FAILED');
  }
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!boundedText(value.namespaceFingerprint) || !boundedText(value.generationId)
    || !boundedText(value.operationId) || !MUTATION_KINDS.has(value.mutationKind)) {
    return fail('LINEAGE_RECORD_DECODE_FAILED');
  }
  const previous = decodeRevision(value.previousSourceRevision);
  const committed = decodeRevision(value.committedSourceRevision);
  const coordinate = revisionCoordinate(value.committedSourceRevision);
  if (!previous.ok || !committed.ok || !coordinate.ok
    || committed.value.value !== previous.value.value + 1n
    || value.segmentIndex !== coordinate.value.segmentIndex || value.leafIndex !== coordinate.value.leafIndex) {
    return fail('LINEAGE_COORDINATE_MISMATCH');
  }
  const digests = [value.writerSessionDigest, value.admissionDigest, value.canonicalInputDigest,
    value.affectedRecordIdentityDigest, value.committedResultDigest, value.immutableOutboxIntentDigest,
    value.committedAuthorityDigest, value.receiptDigest];
  if (digests.some(digest => !decodeDigest(digest).ok)
    || value.previousReceiptChainDigest !== null && !decodeDigest(value.previousReceiptChainDigest).ok) {
    return fail('LINEAGE_DIGEST_INVALID');
  }
  const receipt = value as unknown as SourceReceipt;
  const { kind: _kind, version: _version, receiptDigest, ...withoutDigest } = receipt;
  return sha256Hex(K331F_DOMAINS.receipt, receiptFields(withoutDigest)) === receiptDigest
    ? ok(Object.freeze(receipt)) : fail('LINEAGE_RECEIPT_DIGEST_MISMATCH');
}

export function createSourceReceipt(input: Readonly<{
  namespaceFingerprint?: string; generationId?: string; operationId: string;
  writerSessionDigest?: string; admissionDigest?: string; mutationKind?: MutationKind;
  previousSourceRevision: string; committedSourceRevision: string;
  canonicalInputDigest?: string; affectedRecordIdentityDigest?: string; committedResultDigest?: string;
  immutableOutboxIntentDigest?: string; committedAuthorityDigest?: string;
  previousReceiptChainDigest?: string | null;
}>): ProtocolResult<SourceReceipt> {
  const coordinate = revisionCoordinate(input.committedSourceRevision);
  if (!coordinate.ok) return coordinate;
  const withoutDigest = Object.freeze({ namespaceFingerprint: input.namespaceFingerprint ?? 'namespace-a',
    generationId: input.generationId ?? 'generation-a', operationId: input.operationId,
    writerSessionDigest: input.writerSessionDigest ?? sha256Hex('ABSINTHE_WRITER_SESSION_V1', ['writer-a']),
    admissionDigest: input.admissionDigest ?? sha256Hex('ABSINTHE_ADMISSION_V1', [input.operationId]),
    mutationKind: input.mutationKind ?? 'NOTE_UPSERT', previousSourceRevision: input.previousSourceRevision,
    committedSourceRevision: input.committedSourceRevision, segmentIndex: coordinate.value.segmentIndex,
    leafIndex: coordinate.value.leafIndex,
    canonicalInputDigest: input.canonicalInputDigest ?? sha256Hex('ABSINTHE_INPUT_V1', [input.operationId]),
    affectedRecordIdentityDigest: input.affectedRecordIdentityDigest
      ?? sha256Hex('ABSINTHE_IDENTITY_V1', ['note-a']),
    committedResultDigest: input.committedResultDigest ?? sha256Hex('ABSINTHE_RESULT_V1', [input.operationId]),
    immutableOutboxIntentDigest: input.immutableOutboxIntentDigest
      ?? sha256Hex('ABSINTHE_OUTBOX_INTENT_V1', [input.operationId]),
    committedAuthorityDigest: input.committedAuthorityDigest
      ?? sha256Hex('ABSINTHE_AUTHORITY_V1', [input.committedSourceRevision]),
    previousReceiptChainDigest: input.previousReceiptChainDigest ?? null });
  const candidate = Object.freeze({ kind: 'absinthe_source_receipt' as const, version: 1 as const,
    ...withoutDigest, receiptDigest: sha256Hex(K331F_DOMAINS.receipt, receiptFields(withoutDigest)) });
  return decodeSourceReceipt(candidate);
}

type MerkleSibling = Readonly<{ side: 'left' | 'right'; digest: string }>;
export type MerkleProof = readonly MerkleSibling[];

function segmentLeaf(receipt: SourceReceipt): ProtocolResult<string> {
  const decoded = decodeSourceReceipt(receipt);
  if (!decoded.ok) return decoded;
  return ok(sha256Hex(K331F_DOMAINS.receiptLeaf, [receipt.committedSourceRevision,
    receipt.receiptDigest, receipt.segmentIndex, receipt.leafIndex]));
}

function segmentEmpty(level: number, index: number): string {
  return sha256Hex(K331F_DOMAINS.segmentEmpty, [level, index]);
}

function segmentNode(level: number, left: string, right: string): string {
  return sha256Hex(K331F_DOMAINS.segmentNode, [level, left, right]);
}

function merkleLevels(leaves: readonly string[]): ProtocolResult<readonly (readonly string[])[]> {
  if (leaves.length < 1 || leaves.length > K331F_LIMITS.segmentSize
    || leaves.some(leaf => !decodeDigest(leaf).ok)) return fail('LINEAGE_SEGMENT_PATH_INVALID');
  const levels: string[][] = [[...leaves]];
  for (let level = 0; levels[level].length > 1; level += 1) {
    const current = levels[level];
    const next: string[] = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(segmentNode(level, current[index], current[index + 1] ?? segmentEmpty(level, index + 1)));
    }
    levels.push(next);
  }
  return ok(Object.freeze(levels.map(level => Object.freeze(level))));
}

export function segmentMerkleRoot(leaves: readonly string[]): ProtocolResult<string> {
  const levels = merkleLevels(leaves);
  if (!levels.ok) return levels;
  return ok(sha256Hex(K331F_DOMAINS.segmentRoot, [leaves.length,
    levels.value[levels.value.length - 1][0]]));
}

export function segmentMerkleProof(leaves: readonly string[], leafIndex: number): ProtocolResult<MerkleProof> {
  const levels = merkleLevels(leaves);
  if (!levels.ok || !Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= leaves.length) {
    return fail('LINEAGE_COORDINATE_MISMATCH');
  }
  const proof: MerkleSibling[] = [];
  let index = leafIndex;
  for (let level = 0; level < levels.value.length - 1; level += 1) {
    const current = levels.value[level];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(Object.freeze({ side: index % 2 === 0 ? 'right' : 'left',
      digest: current[siblingIndex] ?? segmentEmpty(level, siblingIndex) }));
    index = Math.floor(index / 2);
  }
  return ok(Object.freeze(proof));
}

export function verifySegmentMerkleProof(input: Readonly<{
  leaf: string; leafIndex: number; leafCount: number; proof: MerkleProof; expectedRoot: string;
}>): ProtocolResult<true> {
  if (!decodeDigest(input.leaf).ok || !decodeDigest(input.expectedRoot).ok
    || !Number.isInteger(input.leafIndex) || input.leafIndex < 0 || input.leafIndex >= input.leafCount
    || input.leafCount < 1 || input.leafCount > K331F_LIMITS.segmentSize
    || input.proof.length > K331F_LIMITS.maxSegmentMerklePathNodes) return fail('LINEAGE_SEGMENT_PATH_INVALID');
  const expectedDepth = Math.ceil(Math.log2(input.leafCount));
  if (input.proof.length !== expectedDepth) return fail('LINEAGE_SEGMENT_PATH_INVALID');
  let digest = input.leaf;
  let index = input.leafIndex;
  for (let level = 0; level < input.proof.length; level += 1) {
    const sibling = input.proof[level];
    const side = index % 2 === 0 ? 'right' : 'left';
    if (sibling.side !== side || !decodeDigest(sibling.digest).ok) return fail('LINEAGE_SEGMENT_PATH_INVALID');
    digest = side === 'right' ? segmentNode(level, digest, sibling.digest)
      : segmentNode(level, sibling.digest, digest);
    index = Math.floor(index / 2);
  }
  return sha256Hex(K331F_DOMAINS.segmentRoot, [input.leafCount, digest]) === input.expectedRoot
    ? ok(true) : fail('LINEAGE_SEGMENT_PATH_INVALID');
}

const CHECKPOINT_KEYS = Object.freeze(['kind', 'version', 'namespaceFingerprint', 'generationId',
  'segmentIndex', 'firstRevision', 'lastRevision', 'receiptCount', 'segmentRoot',
  'endAuthorityDigest', 'previousCheckpointDigest', 'mmrVersion', 'checkpointDigest']);

export type SegmentCheckpoint = Readonly<{
  kind: 'absinthe_segment_checkpoint'; version: 1; namespaceFingerprint: string; generationId: string;
  segmentIndex: number; firstRevision: string; lastRevision: string; receiptCount: number;
  segmentRoot: string; endAuthorityDigest: string; previousCheckpointDigest: string | null;
  mmrVersion: 1; checkpointDigest: string;
}>;

function checkpointFields(value: Omit<SegmentCheckpoint, 'kind' | 'version' | 'checkpointDigest'>): readonly CanonicalValue[] {
  return [value.namespaceFingerprint, value.generationId, value.segmentIndex, value.firstRevision,
    value.lastRevision, value.receiptCount, value.segmentRoot, value.endAuthorityDigest,
    value.previousCheckpointDigest, value.mmrVersion];
}

export function decodeSegmentCheckpoint(value: unknown): ProtocolResult<SegmentCheckpoint> {
  if (!exactObject(value, CHECKPOINT_KEYS) || value.kind !== 'absinthe_segment_checkpoint') {
    return fail('LINEAGE_RECORD_DECODE_FAILED');
  }
  if (value.version !== 1 || value.mmrVersion !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!boundedText(value.namespaceFingerprint) || !boundedText(value.generationId)
    || !Number.isSafeInteger(value.segmentIndex) || (value.segmentIndex as number) < 0
    || !Number.isSafeInteger(value.receiptCount) || (value.receiptCount as number) < 1
    || (value.receiptCount as number) > K331F_LIMITS.segmentSize) return fail('LINEAGE_RECORD_DECODE_FAILED');
  const first = revisionCoordinate(value.firstRevision);
  const last = revisionCoordinate(value.lastRevision);
  if (!first.ok || !last.ok || first.value.segmentIndex !== value.segmentIndex
    || last.value.segmentIndex !== value.segmentIndex || first.value.leafIndex !== 0
    || last.value.leafIndex !== (value.receiptCount as number) - 1
    || BigInt(last.value.revision) !== BigInt(first.value.revision) + BigInt((value.receiptCount as number) - 1)) {
    return fail('LINEAGE_COORDINATE_MISMATCH');
  }
  if (![value.segmentRoot, value.endAuthorityDigest, value.checkpointDigest].every(item => decodeDigest(item).ok)
    || value.previousCheckpointDigest !== null && !decodeDigest(value.previousCheckpointDigest).ok) {
    return fail('LINEAGE_DIGEST_INVALID');
  }
  const checkpoint = value as unknown as SegmentCheckpoint;
  const { kind: _kind, version: _version, checkpointDigest, ...withoutDigest } = checkpoint;
  return sha256Hex(K331F_DOMAINS.segmentCheckpoint, checkpointFields(withoutDigest)) === checkpointDigest
    ? ok(Object.freeze(checkpoint)) : fail('LINEAGE_SEGMENT_CHECKPOINT_CONFLICT');
}

export function createSegmentCheckpoint(receipts: readonly unknown[], previous: string | null): ProtocolResult<SegmentCheckpoint> {
  if (receipts.length < 1 || receipts.length > K331F_LIMITS.segmentSize
    || previous !== null && !decodeDigest(previous).ok) return fail('LINEAGE_SEGMENT_PATH_INVALID');
  const decoded: SourceReceipt[] = [];
  for (const candidate of receipts) {
    const receipt = decodeSourceReceipt(candidate);
    if (!receipt.ok) return receipt;
    decoded.push(receipt.value);
  }
  const namespace = decoded[0].namespaceFingerprint;
  const generation = decoded[0].generationId;
  const segmentIndex = decoded[0].segmentIndex;
  for (let index = 0; index < decoded.length; index += 1) {
    const receipt = decoded[index];
    if (receipt.namespaceFingerprint !== namespace || receipt.generationId !== generation) {
      return fail('LINEAGE_NAMESPACE_GENERATION_MISMATCH');
    }
    if (receipt.segmentIndex !== segmentIndex || receipt.leafIndex !== index
      || BigInt(receipt.committedSourceRevision) !== BigInt(decoded[0].committedSourceRevision) + BigInt(index)
      || index > 0 && receipt.previousReceiptChainDigest !== decoded[index - 1].receiptDigest) {
      return fail('LINEAGE_COORDINATE_MISMATCH');
    }
  }
  const leaves: string[] = [];
  for (const receipt of decoded) {
    const leaf = segmentLeaf(receipt);
    if (!leaf.ok) return leaf;
    leaves.push(leaf.value);
  }
  const root = segmentMerkleRoot(leaves);
  if (!root.ok) return root;
  const withoutDigest = Object.freeze({ namespaceFingerprint: namespace, generationId: generation,
    segmentIndex, firstRevision: decoded[0].committedSourceRevision,
    lastRevision: decoded[decoded.length - 1].committedSourceRevision,
    receiptCount: decoded.length, segmentRoot: root.value,
    endAuthorityDigest: decoded[decoded.length - 1].committedAuthorityDigest,
    previousCheckpointDigest: previous, mmrVersion: 1 as const });
  return decodeSegmentCheckpoint(Object.freeze({ kind: 'absinthe_segment_checkpoint', version: 1,
    ...withoutDigest, checkpointDigest: sha256Hex(K331F_DOMAINS.segmentCheckpoint,
      checkpointFields(withoutDigest)) }));
}

export type MmrPeak = Readonly<{ height: number; digest: string }>;
export type MmrState = Readonly<{
  kind: 'absinthe_mmr_state'; version: 1; namespaceFingerprint: string; generationId: string;
  recordId: string; leafCount: number; peaks: readonly MmrPeak[]; root: string;
  lastSealedSegment: number; lastCheckpointDigest: string | null; stateDigest: string;
}>;

function mmrLeaf(checkpoint: SegmentCheckpoint): string {
  return sha256Hex(K331F_DOMAINS.mmrLeaf, [checkpoint.namespaceFingerprint, checkpoint.generationId,
    checkpoint.segmentIndex, checkpoint.firstRevision, checkpoint.lastRevision, checkpoint.receiptCount,
    checkpoint.segmentRoot, checkpoint.endAuthorityDigest, checkpoint.previousCheckpointDigest,
    checkpoint.checkpointDigest]);
}

function mmrNode(height: number, left: string, right: string): string {
  return sha256Hex(K331F_DOMAINS.mmrNode, [height, left, right]);
}

function bagPeaks(leafCount: number, peaks: readonly MmrPeak[]): string {
  return sha256Hex(K331F_DOMAINS.mmrPeaks, [leafCount, peaks.map(peak => [peak.height, peak.digest])]);
}

function mmrStateDigest(state: Omit<MmrState, 'kind' | 'version' | 'stateDigest'>): string {
  return sha256Hex(K331F_DOMAINS.mmrState, [state.namespaceFingerprint, state.generationId,
    state.recordId, state.leafCount, state.peaks.map(peak => [peak.height, peak.digest]), state.root,
    state.lastSealedSegment, state.lastCheckpointDigest]);
}

export function emptyMmrState(namespaceFingerprint = 'namespace-a', generationId = 'generation-a',
  recordId = 'mmr-state-a'): MmrState {
  const withoutDigest = Object.freeze({ namespaceFingerprint, generationId, recordId, leafCount: 0,
    peaks: Object.freeze([]) as readonly MmrPeak[], root: bagPeaks(0, []), lastSealedSegment: -1,
    lastCheckpointDigest: null });
  return Object.freeze({ kind: 'absinthe_mmr_state', version: 1, ...withoutDigest,
    stateDigest: mmrStateDigest(withoutDigest) });
}

export function decodeMmrState(value: unknown): ProtocolResult<MmrState> {
  const keys = ['kind', 'version', 'namespaceFingerprint', 'generationId', 'recordId', 'leafCount',
    'peaks', 'root', 'lastSealedSegment', 'lastCheckpointDigest', 'stateDigest'];
  if (!exactObject(value, keys) || value.kind !== 'absinthe_mmr_state') return fail('LINEAGE_RECORD_DECODE_FAILED');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!boundedText(value.namespaceFingerprint) || !boundedText(value.generationId) || !boundedText(value.recordId)
    || !Number.isSafeInteger(value.leafCount) || (value.leafCount as number) < 0
    || (value.leafCount as number) > K331F_LIMITS.maxSegments || !Array.isArray(value.peaks)
    || value.peaks.length > K331F_LIMITS.maxPeakCount
    || !Number.isSafeInteger(value.lastSealedSegment)) return fail('LINEAGE_RECORD_DECODE_FAILED');
  const peaks: MmrPeak[] = [];
  for (const peak of value.peaks) {
    if (!exactObject(peak, ['height', 'digest']) || !Number.isSafeInteger(peak.height)
      || (peak.height as number) < 0 || (peak.height as number) > K331F_LIMITS.maxMmrHeight
      || !decodeDigest(peak.digest).ok) return fail('LINEAGE_RECORD_DECODE_FAILED');
    peaks.push(Object.freeze({ height: peak.height as number, digest: peak.digest as string }));
  }
  if (![value.root, value.stateDigest].every(item => decodeDigest(item).ok)
    || value.lastCheckpointDigest !== null && !decodeDigest(value.lastCheckpointDigest).ok) {
    return fail('LINEAGE_DIGEST_INVALID');
  }
  const leafCount = value.leafCount as number;
  const heights: number[] = [];
  for (let bit = Math.floor(Math.log2(Math.max(1, leafCount))); bit >= 0; bit -= 1) {
    if ((BigInt(leafCount) & (1n << BigInt(bit))) !== 0n) heights.push(bit);
  }
  if (peaks.length !== heights.length || peaks.some((peak, index) => peak.height !== heights[index])
    || value.lastSealedSegment !== (leafCount === 0 ? -1 : leafCount - 1)) return fail('LINEAGE_MMR_PATH_INVALID');
  const state = Object.freeze({ kind: 'absinthe_mmr_state' as const, version: 1 as const,
    namespaceFingerprint: value.namespaceFingerprint as string, generationId: value.generationId as string,
    recordId: value.recordId as string, leafCount, peaks: Object.freeze(peaks), root: value.root as string,
    lastSealedSegment: value.lastSealedSegment as number,
    lastCheckpointDigest: value.lastCheckpointDigest as string | null, stateDigest: value.stateDigest as string });
  const { kind: _kind, version: _version, stateDigest, ...withoutDigest } = state;
  return bagPeaks(leafCount, peaks) === state.root && mmrStateDigest(withoutDigest) === stateDigest
    ? ok(state) : fail('LINEAGE_MMR_PATH_INVALID');
}

export function appendMmrCheckpoint(stateValue: unknown, checkpointValue: unknown): ProtocolResult<MmrState> {
  const state = decodeMmrState(stateValue);
  const checkpoint = decodeSegmentCheckpoint(checkpointValue);
  if (!state.ok) return state;
  if (!checkpoint.ok) return checkpoint;
  if (state.value.namespaceFingerprint !== checkpoint.value.namespaceFingerprint
    || state.value.generationId !== checkpoint.value.generationId) return fail('LINEAGE_NAMESPACE_GENERATION_MISMATCH');
  if (checkpoint.value.segmentIndex !== state.value.leafCount
    || checkpoint.value.previousCheckpointDigest !== state.value.lastCheckpointDigest) {
    return fail('LINEAGE_APPEND_SEAL_CONFLICT');
  }
  const peaks: MmrPeak[] = [...state.value.peaks,
    Object.freeze({ height: 0, digest: mmrLeaf(checkpoint.value) })];
  while (peaks.length > 1 && peaks[peaks.length - 1].height === peaks[peaks.length - 2].height) {
    const right = peaks.pop()!;
    const left = peaks.pop()!;
    peaks.push(Object.freeze({ height: left.height + 1,
      digest: mmrNode(left.height + 1, left.digest, right.digest) }));
  }
  const withoutDigest = Object.freeze({ namespaceFingerprint: state.value.namespaceFingerprint,
    generationId: state.value.generationId, recordId: state.value.recordId,
    leafCount: state.value.leafCount + 1, peaks: Object.freeze(peaks),
    root: bagPeaks(state.value.leafCount + 1, peaks), lastSealedSegment: checkpoint.value.segmentIndex,
    lastCheckpointDigest: checkpoint.value.checkpointDigest });
  return decodeMmrState(Object.freeze({ kind: 'absinthe_mmr_state', version: 1, ...withoutDigest,
    stateDigest: mmrStateDigest(withoutDigest) }));
}

export type SourceAuthority = Readonly<{
  kind: 'absinthe_source_authority'; version: 1; namespaceFingerprint: string; generationId: string;
  sourceRevision: string; sourceStateDigest: string; mmrStateRecordId: string;
  mmrStateDigest: string; mmrVersion: 1; sealedSegmentCount: number; authorityDigest: string;
}>;

function authorityFields(value: Omit<SourceAuthority, 'kind' | 'version' | 'authorityDigest'>): readonly CanonicalValue[] {
  return [value.namespaceFingerprint, value.generationId, value.sourceRevision, value.sourceStateDigest,
    value.mmrStateRecordId, value.mmrStateDigest, value.mmrVersion, value.sealedSegmentCount];
}

export function createSourceAuthority(sourceRevision: string, sourceStateDigest: string,
  mmrStateValue: unknown): ProtocolResult<SourceAuthority> {
  const state = decodeMmrState(mmrStateValue);
  if (!state.ok) return state;
  if (!decodeRevision(sourceRevision).ok || !decodeDigest(sourceStateDigest).ok) {
    return fail('LINEAGE_RECORD_DECODE_FAILED');
  }
  const withoutDigest = Object.freeze({ namespaceFingerprint: state.value.namespaceFingerprint,
    generationId: state.value.generationId, sourceRevision, sourceStateDigest,
    mmrStateRecordId: state.value.recordId, mmrStateDigest: state.value.stateDigest,
    mmrVersion: 1 as const, sealedSegmentCount: state.value.leafCount });
  return ok(Object.freeze({ kind: 'absinthe_source_authority', version: 1, ...withoutDigest,
    authorityDigest: sha256Hex(K331F_DOMAINS.sourceAuthority, authorityFields(withoutDigest)) }));
}

export function decodeSourceAuthority(value: unknown): ProtocolResult<SourceAuthority> {
  const keys = ['kind', 'version', 'namespaceFingerprint', 'generationId', 'sourceRevision',
    'sourceStateDigest', 'mmrStateRecordId', 'mmrStateDigest', 'mmrVersion', 'sealedSegmentCount',
    'authorityDigest'];
  if (!exactObject(value, keys) || value.kind !== 'absinthe_source_authority') {
    return fail('LINEAGE_RECORD_DECODE_FAILED');
  }
  if (value.version !== 1 || value.mmrVersion !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!boundedText(value.namespaceFingerprint) || !boundedText(value.generationId)
    || !boundedText(value.mmrStateRecordId) || !decodeRevision(value.sourceRevision).ok
    || !Number.isSafeInteger(value.sealedSegmentCount) || (value.sealedSegmentCount as number) < 0
    || ![value.sourceStateDigest, value.mmrStateDigest, value.authorityDigest].every(item => decodeDigest(item).ok)) {
    return fail('LINEAGE_RECORD_DECODE_FAILED');
  }
  const authority = value as unknown as SourceAuthority;
  const { kind: _kind, version: _version, authorityDigest, ...withoutDigest } = authority;
  return sha256Hex(K331F_DOMAINS.sourceAuthority, authorityFields(withoutDigest)) === authorityDigest
    ? ok(Object.freeze(authority)) : fail('LINEAGE_AUTHORITY_POINTER_MISMATCH');
}

export type MmrProof = Readonly<{ kind: 'absinthe_mmr_proof'; version: 1; leafCount: number;
  leafIndex: number; targetPeakPosition: number; path: readonly MerkleSibling[];
  otherPeaks: readonly MmrPeak[] }>;

function mountainRanges(leafCount: number): readonly Readonly<{ start: number; size: number; height: number }>[] {
  const ranges: Array<Readonly<{ start: number; size: number; height: number }>> = [];
  let start = 0;
  for (let height = Math.floor(Math.log2(Math.max(1, leafCount))); height >= 0; height -= 1) {
    const size = 2 ** height;
    if ((BigInt(leafCount) & (1n << BigInt(height))) !== 0n) {
      ranges.push(Object.freeze({ start, size, height }));
      start += size;
    }
  }
  return Object.freeze(ranges);
}

function perfectPeakProof(leaves: readonly string[], localIndex: number): MerkleProof {
  let layer = [...leaves];
  let index = localIndex;
  const proof: MerkleSibling[] = [];
  for (let height = 1; layer.length > 1; height += 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(Object.freeze({ side: index % 2 === 0 ? 'right' : 'left', digest: layer[siblingIndex] }));
    const next: string[] = [];
    for (let cursor = 0; cursor < layer.length; cursor += 2) {
      next.push(mmrNode(height, layer[cursor], layer[cursor + 1]));
    }
    layer = next;
    index = Math.floor(index / 2);
  }
  return Object.freeze(proof);
}

export function createMmrProof(checkpoints: readonly SegmentCheckpoint[], leafIndex: number): ProtocolResult<MmrProof> {
  if (!Number.isSafeInteger(leafIndex) || leafIndex < 0 || leafIndex >= checkpoints.length) {
    return fail('LINEAGE_COORDINATE_MISMATCH');
  }
  const decoded: SegmentCheckpoint[] = [];
  for (const checkpoint of checkpoints) {
    const checked = decodeSegmentCheckpoint(checkpoint);
    if (!checked.ok) return checked;
    decoded.push(checked.value);
  }
  const leaves = decoded.map(mmrLeaf);
  const ranges = mountainRanges(leaves.length);
  const targetPeakPosition = ranges.findIndex(range => leafIndex >= range.start && leafIndex < range.start + range.size);
  const target = ranges[targetPeakPosition];
  const peaks = ranges.map(range => {
    let layer = leaves.slice(range.start, range.start + range.size);
    for (let height = 1; layer.length > 1; height += 1) {
      const next: string[] = [];
      for (let index = 0; index < layer.length; index += 2) next.push(mmrNode(height, layer[index], layer[index + 1]));
      layer = next;
    }
    return Object.freeze({ height: range.height, digest: layer[0] });
  });
  return ok(Object.freeze({ kind: 'absinthe_mmr_proof', version: 1, leafCount: leaves.length,
    leafIndex, targetPeakPosition,
    path: perfectPeakProof(leaves.slice(target.start, target.start + target.size), leafIndex - target.start),
    otherPeaks: Object.freeze(peaks.filter((_peak, index) => index !== targetPeakPosition)) }));
}

export function encodeMmrProof(proof: MmrProof): string {
  return JSON.stringify([proof.kind, proof.version, proof.leafCount, proof.leafIndex,
    proof.targetPeakPosition, proof.path.map(node => [node.side, node.digest]),
    proof.otherPeaks.map(peak => [peak.height, peak.digest])]);
}

export function decodeMmrProof(encoded: unknown): ProtocolResult<MmrProof> {
  if (typeof encoded !== 'string' || encoded.length > K331F_LIMITS.maxEncodedProofBytes
    || new TextEncoder().encode(encoded).byteLength > K331F_LIMITS.maxEncodedProofBytes) {
    return fail('LINEAGE_PROOF_TOO_LARGE');
  }
  let raw: unknown;
  try { raw = JSON.parse(encoded); } catch { return fail('LINEAGE_MMR_PATH_INVALID'); }
  if (!Array.isArray(raw) || raw.length !== 7 || raw[0] !== 'absinthe_mmr_proof') {
    return fail('LINEAGE_MMR_PATH_INVALID');
  }
  if (raw[1] !== 1) return fail('LINEAGE_PROOF_VERSION_UNSUPPORTED');
  if (!Array.isArray(raw[5]) || !Array.isArray(raw[6])
    || raw[5].length + raw[6].length > K331F_LIMITS.maxMmrComponentNodes
    || raw[5].length > K331F_LIMITS.maxMmrHeight || raw[6].length > K331F_LIMITS.maxPeakCount) {
    return fail('LINEAGE_PROOF_NODE_LIMIT_EXCEEDED');
  }
  if (![raw[2], raw[3], raw[4]].every(Number.isSafeInteger)
    || raw[2] < 1 || raw[2] > K331F_LIMITS.maxSegments || raw[3] < 0 || raw[3] >= raw[2]) {
    return fail('LINEAGE_MMR_PATH_INVALID');
  }
  const path: MerkleSibling[] = [];
  for (const item of raw[5]) {
    if (!Array.isArray(item) || item.length !== 2 || !['left', 'right'].includes(item[0])
      || !decodeDigest(item[1]).ok) return fail('LINEAGE_MMR_PATH_INVALID');
    path.push(Object.freeze({ side: item[0] as 'left' | 'right', digest: item[1] as string }));
  }
  const otherPeaks: MmrPeak[] = [];
  for (const item of raw[6]) {
    if (!Array.isArray(item) || item.length !== 2 || !Number.isSafeInteger(item[0])
      || item[0] < 0 || item[0] > K331F_LIMITS.maxMmrHeight || !decodeDigest(item[1]).ok) {
      return fail('LINEAGE_MMR_PATH_INVALID');
    }
    otherPeaks.push(Object.freeze({ height: item[0], digest: item[1] }));
  }
  return ok(Object.freeze({ kind: 'absinthe_mmr_proof', version: 1, leafCount: raw[2], leafIndex: raw[3],
    targetPeakPosition: raw[4], path: Object.freeze(path), otherPeaks: Object.freeze(otherPeaks) }));
}

function verifyMmrMembership(checkpoint: SegmentCheckpoint, encoded: string, state: MmrState): ProtocolResult<true> {
  const proof = decodeMmrProof(encoded);
  if (!proof.ok) return proof;
  if (proof.value.leafCount !== state.leafCount || proof.value.leafIndex !== checkpoint.segmentIndex) {
    return fail('LINEAGE_STALE_AUTHORITY_PROOF');
  }
  const ranges = mountainRanges(proof.value.leafCount);
  const target = ranges[proof.value.targetPeakPosition];
  if (!target || proof.value.path.length !== target.height
    || proof.value.otherPeaks.length !== ranges.length - 1) return fail('LINEAGE_MMR_PATH_INVALID');
  let digest = mmrLeaf(checkpoint);
  let localIndex = proof.value.leafIndex - target.start;
  for (let level = 0; level < proof.value.path.length; level += 1) {
    const node = proof.value.path[level];
    const side = localIndex % 2 === 0 ? 'right' : 'left';
    if (node.side !== side) return fail('LINEAGE_MMR_PATH_INVALID');
    digest = side === 'right' ? mmrNode(level + 1, digest, node.digest)
      : mmrNode(level + 1, node.digest, digest);
    localIndex = Math.floor(localIndex / 2);
  }
  const peaks: MmrPeak[] = [];
  let other = 0;
  for (let index = 0; index < ranges.length; index += 1) {
    peaks.push(index === proof.value.targetPeakPosition
      ? Object.freeze({ height: target.height, digest }) : proof.value.otherPeaks[other++]);
  }
  return peaks.every((peak, index) => peak.height === ranges[index].height)
    && bagPeaks(proof.value.leafCount, peaks) === state.root ? ok(true) : fail('LINEAGE_MMR_PATH_INVALID');
}

export type HistoricalProofMaterial = Readonly<{ kind: 'absinthe_historical_proof'; version: 1;
  receipt: unknown; segmentLeafCount: number; segmentPath: MerkleProof; checkpoint: unknown;
  mmrProofEncoded: string }>;

export type IndependentlyReadCurrentAuthority = Readonly<{
  sourceAuthorityRecord: unknown; referencedMmrStateRecord: unknown | null;
}>;

export function verifyHistoricalReceipt(proof: HistoricalProofMaterial,
  current: IndependentlyReadCurrentAuthority): ProtocolResult<Readonly<{ receipt: SourceReceipt;
    checkpoint: SegmentCheckpoint }>> {
  if (!exactObject(proof, ['kind', 'version', 'receipt', 'segmentLeafCount', 'segmentPath',
    'checkpoint', 'mmrProofEncoded']) || proof.kind !== 'absinthe_historical_proof') {
    return fail('LINEAGE_RECORD_DECODE_FAILED');
  }
  if (proof.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  const authority = decodeSourceAuthority(current.sourceAuthorityRecord);
  if (!authority.ok) return authority;
  if (current.referencedMmrStateRecord === null) return fail('LINEAGE_MMR_STATE_MISSING');
  const state = decodeMmrState(current.referencedMmrStateRecord);
  if (!state.ok) return state;
  if (authority.value.namespaceFingerprint !== state.value.namespaceFingerprint
    || authority.value.generationId !== state.value.generationId) return fail('LINEAGE_NAMESPACE_GENERATION_MISMATCH');
  if (authority.value.mmrStateRecordId !== state.value.recordId
    || authority.value.mmrStateDigest !== state.value.stateDigest
    || authority.value.mmrVersion !== state.value.version
    || authority.value.sealedSegmentCount !== state.value.leafCount) {
    return fail('LINEAGE_AUTHORITY_POINTER_MISMATCH');
  }
  const receipt = decodeSourceReceipt(proof.receipt);
  const checkpoint = decodeSegmentCheckpoint(proof.checkpoint);
  if (!receipt.ok) return receipt;
  if (!checkpoint.ok) return checkpoint;
  if (receipt.value.namespaceFingerprint !== authority.value.namespaceFingerprint
    || receipt.value.generationId !== authority.value.generationId
    || checkpoint.value.namespaceFingerprint !== authority.value.namespaceFingerprint
    || checkpoint.value.generationId !== authority.value.generationId) {
    return fail('LINEAGE_NAMESPACE_GENERATION_MISMATCH');
  }
  if (receipt.value.segmentIndex !== checkpoint.value.segmentIndex
    || receipt.value.leafIndex >= proof.segmentLeafCount
    || checkpoint.value.receiptCount !== proof.segmentLeafCount) return fail('LINEAGE_COORDINATE_MISMATCH');
  const leaf = segmentLeaf(receipt.value);
  if (!leaf.ok) return leaf;
  const segment = verifySegmentMerkleProof({ leaf: leaf.value, leafIndex: receipt.value.leafIndex,
    leafCount: proof.segmentLeafCount, proof: proof.segmentPath, expectedRoot: checkpoint.value.segmentRoot });
  if (!segment.ok) return segment;
  const mmr = verifyMmrMembership(checkpoint.value, proof.mmrProofEncoded, state.value);
  return mmr.ok ? ok(Object.freeze({ receipt: receipt.value, checkpoint: checkpoint.value })) : mmr;
}

type OperationEvidence = Readonly<{ operationId: string; writerSessionDigest: string;
  admissionDigest: string; canonicalInputDigest: string; terminalReceiptDigest: string;
  resultDigest: string; immutableOutboxIntentDigest: string }>;

export type CompactedReceiptIndex = Readonly<{
  kind: 'absinthe_compacted_receipt_index'; version: 1;
  receiptEvidence: Omit<SourceReceipt, 'kind' | 'version'>;
  segmentLeafCount: number; segmentPath: MerkleProof; checkpoint: SegmentCheckpoint;
  mmrProofEncoded: string; operationEvidence: OperationEvidence; indexDigest: string;
}>;

function compactedIndexFields(value: Omit<CompactedReceiptIndex, 'kind' | 'version' | 'indexDigest'>): readonly CanonicalValue[] {
  return [value.receiptEvidence.namespaceFingerprint, value.receiptEvidence.generationId,
    value.receiptEvidence.operationId, value.receiptEvidence.writerSessionDigest,
    value.receiptEvidence.admissionDigest, value.receiptEvidence.mutationKind,
    value.receiptEvidence.previousSourceRevision, value.receiptEvidence.committedSourceRevision,
    value.receiptEvidence.segmentIndex, value.receiptEvidence.leafIndex,
    value.receiptEvidence.canonicalInputDigest, value.receiptEvidence.affectedRecordIdentityDigest,
    value.receiptEvidence.committedResultDigest, value.receiptEvidence.immutableOutboxIntentDigest,
    value.receiptEvidence.committedAuthorityDigest, value.receiptEvidence.previousReceiptChainDigest,
    value.receiptEvidence.receiptDigest, value.segmentLeafCount,
    value.segmentPath.map(node => [node.side, node.digest]), value.checkpoint.checkpointDigest,
    value.mmrProofEncoded, value.operationEvidence.operationId,
    value.operationEvidence.writerSessionDigest, value.operationEvidence.admissionDigest,
    value.operationEvidence.canonicalInputDigest, value.operationEvidence.terminalReceiptDigest,
    value.operationEvidence.resultDigest, value.operationEvidence.immutableOutboxIntentDigest];
}

export function decodeCompactedReceiptIndex(value: unknown): ProtocolResult<CompactedReceiptIndex> {
  if (!exactObject(value, ['kind', 'version', 'receiptEvidence', 'segmentLeafCount', 'segmentPath',
    'checkpoint', 'mmrProofEncoded', 'operationEvidence', 'indexDigest'])
    || value.kind !== 'absinthe_compacted_receipt_index') return fail('LINEAGE_COMPACTED_INDEX_INCOMPLETE');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (typeof value.receiptEvidence !== 'object' || value.receiptEvidence === null) {
    return fail('LINEAGE_COMPACTED_INDEX_INCOMPLETE');
  }
  const receipt = decodeSourceReceipt(Object.freeze({ kind: 'absinthe_source_receipt', version: 1,
    ...(value.receiptEvidence as Record<string, unknown>) }));
  const checkpoint = decodeSegmentCheckpoint(value.checkpoint);
  if (!receipt.ok || !checkpoint.ok || !Number.isSafeInteger(value.segmentLeafCount)
    || !Array.isArray(value.segmentPath) || typeof value.mmrProofEncoded !== 'string'
    || !exactObject(value.operationEvidence, ['operationId', 'writerSessionDigest', 'admissionDigest',
      'canonicalInputDigest', 'terminalReceiptDigest', 'resultDigest', 'immutableOutboxIntentDigest'])) {
    return fail('LINEAGE_COMPACTED_INDEX_INCOMPLETE');
  }
  const operation = value.operationEvidence;
  if (!boundedText(operation.operationId) || [operation.writerSessionDigest, operation.admissionDigest,
    operation.canonicalInputDigest, operation.terminalReceiptDigest, operation.resultDigest,
    operation.immutableOutboxIntentDigest, value.indexDigest].some(item => !decodeDigest(item).ok)) {
    return fail('LINEAGE_COMPACTED_INDEX_INCOMPLETE');
  }
  const retainedEvidence = Object.freeze({ ...(value.receiptEvidence as Record<string, unknown>) });
  const index = Object.freeze({ kind: 'absinthe_compacted_receipt_index' as const, version: 1 as const,
    receiptEvidence: retainedEvidence as Omit<SourceReceipt, 'kind' | 'version'>,
    segmentLeafCount: value.segmentLeafCount as number,
    segmentPath: Object.freeze(value.segmentPath) as MerkleProof, checkpoint: checkpoint.value,
    mmrProofEncoded: value.mmrProofEncoded,
    operationEvidence: Object.freeze(operation as unknown as OperationEvidence),
    indexDigest: value.indexDigest as string });
  return sha256Hex(K331F_DOMAINS.compactedIndex, compactedIndexFields(index)) === index.indexDigest
    ? ok(index) : fail('LINEAGE_COMPACTION_INDEX_CONFLICT');
}

export function createCompactedReceiptIndex(proof: HistoricalProofMaterial,
  current: IndependentlyReadCurrentAuthority): ProtocolResult<CompactedReceiptIndex> {
  const verified = verifyHistoricalReceipt(proof, current);
  if (!verified.ok) return verified;
  const receipt = verified.value.receipt;
  const operationEvidence = Object.freeze({ operationId: receipt.operationId,
    writerSessionDigest: receipt.writerSessionDigest, admissionDigest: receipt.admissionDigest,
    canonicalInputDigest: receipt.canonicalInputDigest, terminalReceiptDigest: receipt.receiptDigest,
    resultDigest: receipt.committedResultDigest,
    immutableOutboxIntentDigest: receipt.immutableOutboxIntentDigest });
  const { kind: _kind, version: _version, ...receiptEvidence } = receipt;
  const withoutDigest = Object.freeze({ receiptEvidence: Object.freeze(receiptEvidence),
    segmentLeafCount: proof.segmentLeafCount,
    segmentPath: proof.segmentPath, checkpoint: verified.value.checkpoint,
    mmrProofEncoded: proof.mmrProofEncoded, operationEvidence });
  return decodeCompactedReceiptIndex(Object.freeze({ kind: 'absinthe_compacted_receipt_index',
    version: 1, ...withoutDigest,
    indexDigest: sha256Hex(K331F_DOMAINS.compactedIndex, compactedIndexFields(withoutDigest)) }));
}

export type PostCompactionAuthority = IndependentlyReadCurrentAuthority & Readonly<{
  k330OperationRecord: unknown; terminalRecord: unknown; immutableOutboxEvidence: unknown;
}>;

export function postCompactionAuthority(current: IndependentlyReadCurrentAuthority,
  receipt: SourceReceipt): PostCompactionAuthority {
  return Object.freeze({ ...current,
    k330OperationRecord: Object.freeze({ operationId: receipt.operationId,
      writerSessionDigest: receipt.writerSessionDigest, admissionDigest: receipt.admissionDigest,
      canonicalInputDigest: receipt.canonicalInputDigest }),
    terminalRecord: Object.freeze({ operationId: receipt.operationId, status: 'committed',
      receiptDigest: receipt.receiptDigest, resultDigest: receipt.committedResultDigest }),
    immutableOutboxEvidence: Object.freeze({ operationId: receipt.operationId,
      immutableOutboxIntentDigest: receipt.immutableOutboxIntentDigest }) });
}

function verifyIndependentOperationEvidence(receipt: SourceReceipt,
  current: PostCompactionAuthority): ProtocolResult<true> {
  if (!exactObject(current.k330OperationRecord,
    ['operationId', 'writerSessionDigest', 'admissionDigest', 'canonicalInputDigest'])
    || !exactObject(current.terminalRecord, ['operationId', 'status', 'receiptDigest', 'resultDigest'])
    || !exactObject(current.immutableOutboxEvidence, ['operationId', 'immutableOutboxIntentDigest'])) {
    return fail('OPERATION_IDENTITY_MISMATCH');
  }
  const operation = current.k330OperationRecord;
  const terminal = current.terminalRecord;
  const outbox = current.immutableOutboxEvidence;
  return operation.operationId === receipt.operationId
    && operation.writerSessionDigest === receipt.writerSessionDigest
    && operation.admissionDigest === receipt.admissionDigest
    && operation.canonicalInputDigest === receipt.canonicalInputDigest
    && terminal.operationId === receipt.operationId && terminal.status === 'committed'
    && terminal.receiptDigest === receipt.receiptDigest
    && terminal.resultDigest === receipt.committedResultDigest
    && outbox.operationId === receipt.operationId
    && outbox.immutableOutboxIntentDigest === receipt.immutableOutboxIntentDigest
    ? ok(true) : fail('OPERATION_IDENTITY_MISMATCH');
}

export function verifyCompactedReceipt(indexValue: unknown,
  current: PostCompactionAuthority): ProtocolResult<SourceReceipt> {
  const index = decodeCompactedReceiptIndex(indexValue);
  if (!index.ok) return index;
  const receipt = decodeSourceReceipt(Object.freeze({ kind: 'absinthe_source_receipt', version: 1,
    ...index.value.receiptEvidence }));
  if (!receipt.ok) return receipt;
  const operation = index.value.operationEvidence;
  if (operation.operationId !== receipt.value.operationId
    || operation.writerSessionDigest !== receipt.value.writerSessionDigest
    || operation.admissionDigest !== receipt.value.admissionDigest
    || operation.canonicalInputDigest !== receipt.value.canonicalInputDigest
    || operation.terminalReceiptDigest !== receipt.value.receiptDigest
    || operation.resultDigest !== receipt.value.committedResultDigest
    || operation.immutableOutboxIntentDigest !== receipt.value.immutableOutboxIntentDigest) {
    return fail('OPERATION_IDENTITY_MISMATCH');
  }
  const independent = verifyIndependentOperationEvidence(receipt.value, current);
  if (!independent.ok) return independent;
  const verified = verifyHistoricalReceipt(Object.freeze({ kind: 'absinthe_historical_proof', version: 1,
    receipt: receipt.value, segmentLeafCount: index.value.segmentLeafCount, segmentPath: index.value.segmentPath,
    checkpoint: index.value.checkpoint, mmrProofEncoded: index.value.mmrProofEncoded }), current);
  return verified.ok ? ok(receipt.value) : verified;
}

export type CompactionState = Readonly<{ retentionState: 'RAW_ONLY'; proof: HistoricalProofMaterial }>
  | Readonly<{ retentionState: 'INDEX_ONLY'; index: CompactedReceiptIndex }>;

export function compactReceipt(state: CompactionState,
  current: PostCompactionAuthority): ProtocolResult<CompactionState> {
  if (state.retentionState === 'INDEX_ONLY') {
    const verified = verifyCompactedReceipt(state.index, current);
    return verified.ok ? ok(state) : verified;
  }
  const index = createCompactedReceiptIndex(state.proof, current);
  return index.ok ? ok(Object.freeze({ retentionState: 'INDEX_ONLY', index: index.value })) : index;
}

export type TombstoneLifecycle = Readonly<{ entityIdentityDigest: string; lifecycle: 'tombstoned';
  latestRevision: string; latestCompactedIndexDigest: string; purgeOperationId: string;
  expectedPurgeRevision: string; resultingAuthorityDigest: string }>;

export type PurgeCertificate = Readonly<{ kind: 'absinthe_purge_certificate'; version: 1;
  entityIdentityDigest: string; tombstoneRevision: string; compactedIndexDigest: string;
  purgeOperationId: string; purgeRevision: string; resultingAuthorityDigest: string;
  sourceAuthorityDigest: string; certificateDigest: string }>;

export function createPurgeCertificate(indexValue: unknown, current: IndependentlyReadCurrentAuthority,
  lifecycle: TombstoneLifecycle): ProtocolResult<PurgeCertificate> {
  const index = decodeCompactedReceiptIndex(indexValue);
  if (!index.ok) return fail('PURGE_TOMBSTONE_PROOF_INVALID');
  const decodedReceipt = decodeSourceReceipt(Object.freeze({ kind: 'absinthe_source_receipt', version: 1,
    ...index.value.receiptEvidence }));
  if (!decodedReceipt.ok) return fail('PURGE_TOMBSTONE_PROOF_INVALID');
  const receipt = verifyCompactedReceipt(indexValue, postCompactionAuthority(current, decodedReceipt.value));
  const authority = decodeSourceAuthority(current.sourceAuthorityRecord);
  if (!receipt.ok || !index.ok || !authority.ok) return fail('PURGE_TOMBSTONE_PROOF_INVALID');
  if (receipt.value.mutationKind !== 'NOTE_TOMBSTONE'
    || receipt.value.affectedRecordIdentityDigest !== lifecycle.entityIdentityDigest
    || receipt.value.committedSourceRevision !== lifecycle.latestRevision
    || index.value.indexDigest !== lifecycle.latestCompactedIndexDigest) {
    return fail('PURGE_TOMBSTONE_NOT_LATEST');
  }
  const tombstoneRevision = decodeRevision(lifecycle.latestRevision);
  const purgeRevision = decodeRevision(lifecycle.expectedPurgeRevision);
  if (!tombstoneRevision.ok || !purgeRevision.ok
    || purgeRevision.value.value !== tombstoneRevision.value.value + 1n
    || !boundedText(lifecycle.purgeOperationId)
    || !decodeDigest(lifecycle.resultingAuthorityDigest).ok) {
    return fail('SOURCE_REVISION_TRANSITION_INVALID');
  }
  const fields: readonly CanonicalValue[] = [lifecycle.entityIdentityDigest, lifecycle.latestRevision,
    index.value.indexDigest, lifecycle.purgeOperationId, lifecycle.expectedPurgeRevision,
    lifecycle.resultingAuthorityDigest, authority.value.authorityDigest];
  return ok(Object.freeze({ kind: 'absinthe_purge_certificate', version: 1,
    entityIdentityDigest: lifecycle.entityIdentityDigest, tombstoneRevision: lifecycle.latestRevision,
    compactedIndexDigest: index.value.indexDigest, purgeOperationId: lifecycle.purgeOperationId,
    purgeRevision: lifecycle.expectedPurgeRevision,
    resultingAuthorityDigest: lifecycle.resultingAuthorityDigest,
    sourceAuthorityDigest: authority.value.authorityDigest,
    certificateDigest: sha256Hex(K331F_DOMAINS.purgeCertificate, fields) }));
}

export type AttachmentFieldClass = 'canonical_source_changing' | 'derived_verified'
  | 'local_observation' | 'remote_observation' | 'transient_secret';

export const ATTACHMENT_FIELD_CLASSIFICATION: Readonly<Record<string, AttachmentFieldClass>> = Object.freeze({
  id: 'canonical_source_changing', noteId: 'canonical_source_changing', fileName: 'canonical_source_changing',
  mimeType: 'canonical_source_changing', size: 'canonical_source_changing', checksum: 'derived_verified',
  localBlobKey: 'local_observation', remoteBlobKey: 'remote_observation', remoteProvider: 'remote_observation',
  remoteFileId: 'remote_observation', remoteChecksum: 'derived_verified', remoteSize: 'derived_verified',
  remoteMimeType: 'derived_verified', remoteSyncedAt: 'remote_observation', remoteUpdatedAt: 'remote_observation',
  remoteError: 'remote_observation', remoteSyncStatus: 'remote_observation', remoteVerification: 'derived_verified',
  lastRemoteSyncAttemptAt: 'remote_observation', remoteSyncAttemptCount: 'remote_observation',
  lastRemoteRecoveryAt: 'remote_observation', keepOffline: 'canonical_source_changing',
  lastAccessedAt: 'local_observation', lastOpenedAt: 'local_observation', lastPreviewedAt: 'local_observation',
  title: 'canonical_source_changing', alt: 'canonical_source_changing', caption: 'canonical_source_changing',
  thumbnailKey: 'local_observation', pageCount: 'derived_verified', source: 'canonical_source_changing',
  createdAt: 'canonical_source_changing', updatedAt: 'canonical_source_changing',
  deletedAt: 'canonical_source_changing', syncStatus: 'remote_observation',
  namespaceFingerprint: 'canonical_source_changing', generationId: 'canonical_source_changing',
  localAvailability: 'local_observation', remoteAvailability: 'remote_observation',
  resumableUploadUri: 'transient_secret', signedUrl: 'transient_secret', accessToken: 'transient_secret',
  lease: 'transient_secret',
});

export function validateAttachmentClassification(fields: readonly string[]): ProtocolResult<true> {
  const expected = Object.keys(ATTACHMENT_FIELD_CLASSIFICATION).sort();
  const actual = [...fields].sort();
  return actual.length === expected.length && new Set(actual).size === expected.length
    && actual.every((field, index) => field === expected[index])
    ? ok(true) : fail('ATTACHMENT_AUTHORITY_CLASSIFICATION_MISMATCH');
}

export type AttachmentPromotionEvidence = Readonly<{ kind: 'absinthe_attachment_promotion'; version: 1;
  attachmentIdentityDigest: string; previousSourceRevision: string; committedSourceRevision: string;
  verifiedRecoveryIdentityDigest: string; verificationDigest: string; providerMigrationDigest: string | null;
  promotionDigest: string }>;

export function createAttachmentPromotion(input: Omit<AttachmentPromotionEvidence,
  'kind' | 'version' | 'promotionDigest'>): ProtocolResult<AttachmentPromotionEvidence> {
  const previous = decodeRevision(input.previousSourceRevision);
  const committed = decodeRevision(input.committedSourceRevision);
  if (!previous.ok || !committed.ok || committed.value.value !== previous.value.value + 1n
    || !decodeDigest(input.attachmentIdentityDigest).ok
    || !decodeDigest(input.verifiedRecoveryIdentityDigest).ok
    || !decodeDigest(input.verificationDigest).ok
    || input.providerMigrationDigest !== null && !decodeDigest(input.providerMigrationDigest).ok) {
    return fail('ATTACHMENT_PROMOTION_EVIDENCE_INVALID');
  }
  const fields: readonly CanonicalValue[] = [input.attachmentIdentityDigest, input.previousSourceRevision,
    input.committedSourceRevision, input.verifiedRecoveryIdentityDigest, input.verificationDigest,
    input.providerMigrationDigest];
  return ok(Object.freeze({ kind: 'absinthe_attachment_promotion', version: 1, ...input,
    promotionDigest: sha256Hex('ABSINTHE_ATTACHMENT_PROMOTION_V1', fields) }));
}

export type BootstrapScope = Readonly<{ namespaceFingerprint: string; generationId: string;
  sessionId: string; baselineDigest: string; manifestDigest: string; schemaVersion: 1;
  protocolVersion: 1; attachmentClassificationDigest: string; categoryDefinitionVersion: 1 }>;

export function compareCanonicalKeys(left: string, right: string): number {
  const encoder = new TextEncoder();
  const a = encoder.encode(left.normalize('NFC'));
  const b = encoder.encode(right.normalize('NFC'));
  for (let index = 0; index < Math.min(a.length, b.length); index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return a.length - b.length;
}

export type IteratorObservation = Readonly<{ kind: 'absinthe_bootstrap_iterator_observation'; version: 1;
  scopeDigest: string; category: string; keys: readonly string[]; continuationDigest: string | null;
  exhausted: boolean; observationDigest: string }>;

function bootstrapScopeDigest(scope: BootstrapScope): string {
  return sha256Hex('ABSINTHE_BOOTSTRAP_SCOPE_V1', [scope.namespaceFingerprint, scope.generationId,
    scope.sessionId, scope.baselineDigest, scope.manifestDigest, scope.schemaVersion,
    scope.protocolVersion, scope.attachmentClassificationDigest, scope.categoryDefinitionVersion]);
}

export function createIteratorObservation(scope: BootstrapScope, category: string,
  keys: readonly string[], continuationDigest: string | null): ProtocolResult<IteratorObservation> {
  if (!boundedText(category) || keys.length > K331F_LIMITS.maxBootstrapRecordsPerSegment
    || keys.some(key => !boundedText(key))) return fail('BOOTSTRAP_RECORD_TOO_LARGE');
  const normalized = keys.map(key => key.normalize('NFC'));
  if (new Set(normalized).size !== normalized.length) return fail('BOOTSTRAP_DUPLICATE_NORMALIZED_KEY');
  if (normalized.some((key, index) => index > 0 && compareCanonicalKeys(normalized[index - 1], key) >= 0)) {
    return fail('BOOTSTRAP_KEY_ORDER_INVALID');
  }
  if (continuationDigest !== null && !decodeDigest(continuationDigest).ok) return fail('BOOTSTRAP_TERMINAL_EVIDENCE_INVALID');
  const scopeDigest = bootstrapScopeDigest(scope);
  const exhausted = continuationDigest === null;
  const fields: readonly CanonicalValue[] = [scopeDigest, category, normalized, continuationDigest, exhausted];
  return ok(Object.freeze({ kind: 'absinthe_bootstrap_iterator_observation', version: 1,
    scopeDigest, category, keys: Object.freeze(normalized), continuationDigest, exhausted,
    observationDigest: sha256Hex(K331F_DOMAINS.bootstrapObservation, fields) }));
}

export type BootstrapAccumulator = Readonly<{ kind: 'absinthe_bootstrap_category_accumulator'; version: 1;
  scopeDigest: string; category: string; segmentCount: number; recordCount: number;
  lastKey: string | null; lastObservationDigest: string | null; accumulatorDigest: string }>;

export function emptyBootstrapAccumulator(scope: BootstrapScope, category: string): BootstrapAccumulator {
  const scopeDigest = bootstrapScopeDigest(scope);
  const fields: readonly CanonicalValue[] = [scopeDigest, category, 0, 0, null, null];
  return Object.freeze({ kind: 'absinthe_bootstrap_category_accumulator', version: 1, scopeDigest,
    category, segmentCount: 0, recordCount: 0, lastKey: null, lastObservationDigest: null,
    accumulatorDigest: sha256Hex(K331F_DOMAINS.bootstrapCategory, fields) });
}

export function appendBootstrapObservation(scope: BootstrapScope, accumulator: BootstrapAccumulator,
  observation: IteratorObservation, expectedAccumulatorDigest: string): ProtocolResult<BootstrapAccumulator> {
  const scopeDigest = bootstrapScopeDigest(scope);
  if (accumulator.accumulatorDigest !== expectedAccumulatorDigest
    || accumulator.scopeDigest !== scopeDigest || observation.scopeDigest !== scopeDigest
    || observation.category !== accumulator.category) return fail('BOOTSTRAP_BASELINE_MISMATCH');
  if (accumulator.lastKey !== null && observation.keys.length > 0
    && compareCanonicalKeys(accumulator.lastKey, observation.keys[0]) >= 0) return fail('BOOTSTRAP_SEGMENT_RANGE_OVERLAP');
  const next = { scopeDigest, category: accumulator.category, segmentCount: accumulator.segmentCount + 1,
    recordCount: accumulator.recordCount + observation.keys.length,
    lastKey: observation.keys.length > 0
      ? observation.keys[observation.keys.length - 1] : accumulator.lastKey,
    lastObservationDigest: observation.observationDigest };
  return ok(Object.freeze({ kind: 'absinthe_bootstrap_category_accumulator', version: 1, ...next,
    accumulatorDigest: sha256Hex(K331F_DOMAINS.bootstrapCategory, [next.scopeDigest, next.category,
      next.segmentCount, next.recordCount, next.lastKey, next.lastObservationDigest]) }));
}

export type BootstrapFinalizationGraph = Readonly<{ scope: BootstrapScope;
  accumulators: readonly BootstrapAccumulator[]; terminalObservations: readonly TerminalIteratorEvidence[];
  k330RegistryDigest: string; quiescenceEvidenceDigest: string; currentSourceAuthority: unknown | null }>;

export type TerminalIteratorEvidence = Readonly<{ kind: 'absinthe_bootstrap_terminal_evidence'; version: 1;
  scopeDigest: string; category: string; finalKey: string | null; totalRecords: number; totalBytes: number;
  totalSegments: number; snapshotTokenDigest: string; observationDigest: string; exhausted: true;
  terminalDigest: string }>;

export function createTerminalIteratorEvidence(scope: BootstrapScope, accumulator: BootstrapAccumulator,
  observation: IteratorObservation, totalBytes: number, snapshotTokenDigest: string):
  ProtocolResult<TerminalIteratorEvidence> {
  const scopeDigest = bootstrapScopeDigest(scope);
  if (!observation.exhausted || observation.scopeDigest !== scopeDigest
    || accumulator.scopeDigest !== scopeDigest || accumulator.category !== observation.category
    || accumulator.lastObservationDigest !== observation.observationDigest
    || !Number.isSafeInteger(totalBytes) || totalBytes < 0 || !decodeDigest(snapshotTokenDigest).ok) {
    return fail('BOOTSTRAP_TERMINAL_EVIDENCE_INVALID');
  }
  const fields: readonly CanonicalValue[] = [scopeDigest, accumulator.category, accumulator.lastKey,
    accumulator.recordCount, totalBytes, accumulator.segmentCount, snapshotTokenDigest,
    observation.observationDigest, true];
  return ok(Object.freeze({ kind: 'absinthe_bootstrap_terminal_evidence', version: 1, scopeDigest,
    category: accumulator.category, finalKey: accumulator.lastKey, totalRecords: accumulator.recordCount,
    totalBytes, totalSegments: accumulator.segmentCount, snapshotTokenDigest,
    observationDigest: observation.observationDigest, exhausted: true,
    terminalDigest: sha256Hex(K331F_DOMAINS.bootstrapTerminal, fields) }));
}

export function finalizeBootstrapGraph(graph: BootstrapFinalizationGraph): ProtocolResult<string> {
  const scopeDigest = bootstrapScopeDigest(graph.scope);
  if (!decodeDigest(graph.k330RegistryDigest).ok || !decodeDigest(graph.quiescenceEvidenceDigest).ok) {
    return fail('BOOTSTRAP_NOT_QUIESCENT');
  }
  for (const accumulator of graph.accumulators) {
    const terminal = graph.terminalObservations.find(value => value.category === accumulator.category);
    if (accumulator.scopeDigest !== scopeDigest || !terminal || !terminal.exhausted
      || terminal.scopeDigest !== scopeDigest || terminal.observationDigest !== accumulator.lastObservationDigest
      || terminal.finalKey !== accumulator.lastKey || terminal.totalRecords !== accumulator.recordCount
      || terminal.totalSegments !== accumulator.segmentCount) {
      return fail('BOOTSTRAP_TERMINAL_EVIDENCE_INVALID');
    }
  }
  if (graph.currentSourceAuthority !== null) return fail('BOOTSTRAP_SOURCE_AUTHORITY_CONFLICT');
  return ok(sha256Hex(K331F_DOMAINS.bootstrapFinal, [scopeDigest,
    graph.accumulators.map(value => value.accumulatorDigest), graph.k330RegistryDigest,
    graph.quiescenceEvidenceDigest, optionalAbsent]));
}

export type RestoreScope = Readonly<{ namespaceFingerprint: string; generationId: string;
  sessionId: string; packageDigest: string; orderedChunkDigests: readonly string[] }>;
export type RestoreAccumulator = Readonly<{ kind: 'absinthe_restore_accumulator'; version: 1;
  scopeDigest: string; nextChunkIndex: number; openChunkDigests: readonly string[];
  sealedCheckpointDigests: readonly string[]; restoreMmrStateRecordId: string;
  restoreMmrStateDigest: string; mmrRoot: string; accumulatorDigest: string }>;

export type RestoreMmrState = Readonly<{ kind: 'absinthe_restore_mmr_state'; version: 1;
  scopeDigest: string; recordId: string; segmentCount: number; segmentRoots: readonly string[];
  root: string; stateDigest: string }>;

function restoreScopeDigest(scope: RestoreScope): ProtocolResult<string> {
  if (!boundedText(scope.namespaceFingerprint) || !boundedText(scope.generationId) || !boundedText(scope.sessionId)
    || !decodeDigest(scope.packageDigest).ok || scope.orderedChunkDigests.some(digest => !decodeDigest(digest).ok)) {
    return fail('RESTORE_RECORD_DECODE_FAILED');
  }
  return ok(sha256Hex('ABSINTHE_RESTORE_SCOPE_V1', [scope.namespaceFingerprint, scope.generationId,
    scope.sessionId, scope.packageDigest, scope.orderedChunkDigests]));
}

function restoreRoot(digests: readonly string[]): string {
  return sha256Hex(K331F_DOMAINS.restoreCombinedRoot, [digests]);
}

export function restoreMmrStateFor(scopeDigest: string,
  sealedCheckpointDigests: readonly string[]): RestoreMmrState {
  const recordId = `restore-mmr:${scopeDigest}`;
  const root = restoreRoot(sealedCheckpointDigests);
  const fields: readonly CanonicalValue[] = [scopeDigest, recordId, sealedCheckpointDigests.length,
    sealedCheckpointDigests, root];
  return Object.freeze({ kind: 'absinthe_restore_mmr_state', version: 1, scopeDigest, recordId,
    segmentCount: sealedCheckpointDigests.length, segmentRoots: Object.freeze([...sealedCheckpointDigests]),
    root, stateDigest: sha256Hex('ABSINTHE_RESTORE_MMR_STATE_V1', fields) });
}

export function decodeRestoreMmrState(value: unknown): ProtocolResult<RestoreMmrState> {
  if (!exactObject(value, ['kind', 'version', 'scopeDigest', 'recordId', 'segmentCount',
    'segmentRoots', 'root', 'stateDigest']) || value.kind !== 'absinthe_restore_mmr_state') {
    return fail('RESTORE_MMR_STATE_INVALID');
  }
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!decodeDigest(value.scopeDigest).ok || !boundedText(value.recordId)
    || !Number.isSafeInteger(value.segmentCount) || (value.segmentCount as number) < 0
    || !Array.isArray(value.segmentRoots) || value.segmentRoots.length !== value.segmentCount
    || value.segmentRoots.some(digest => !decodeDigest(digest).ok)
    || !decodeDigest(value.root).ok || !decodeDigest(value.stateDigest).ok) {
    return fail('RESTORE_MMR_STATE_INVALID');
  }
  const recomputed = restoreMmrStateFor(value.scopeDigest as string, value.segmentRoots as string[]);
  return recomputed.recordId === value.recordId && recomputed.root === value.root
    && recomputed.stateDigest === value.stateDigest ? ok(Object.freeze(value as unknown as RestoreMmrState))
    : fail('RESTORE_MMR_STATE_INVALID');
}

function computedRestoreAccumulatorDigest(accumulator: Omit<RestoreAccumulator,
  'kind' | 'version' | 'accumulatorDigest'>): string {
  return sha256Hex(K331F_DOMAINS.restoreAccumulator, [accumulator.scopeDigest,
    accumulator.nextChunkIndex, accumulator.openChunkDigests,
    accumulator.sealedCheckpointDigests, accumulator.restoreMmrStateRecordId,
    accumulator.restoreMmrStateDigest, accumulator.mmrRoot]);
}

export function emptyRestoreAccumulator(scope: RestoreScope): ProtocolResult<RestoreAccumulator> {
  const digest = restoreScopeDigest(scope);
  if (!digest.ok) return digest;
  const mmrState = restoreMmrStateFor(digest.value, []);
  const next = { scopeDigest: digest.value, nextChunkIndex: 0, openChunkDigests: Object.freeze([]) as readonly string[],
    sealedCheckpointDigests: Object.freeze([]) as readonly string[],
    restoreMmrStateRecordId: mmrState.recordId, restoreMmrStateDigest: mmrState.stateDigest,
    mmrRoot: restoreRoot([]) };
  return ok(Object.freeze({ kind: 'absinthe_restore_accumulator', version: 1, ...next,
    accumulatorDigest: computedRestoreAccumulatorDigest(next) }));
}

export function appendRestoreChunk(scope: RestoreScope, accumulator: RestoreAccumulator,
  chunkDigest: string, expectedAccumulatorDigest: string): ProtocolResult<RestoreAccumulator> {
  const scopeDigest = restoreScopeDigest(scope);
  if (!scopeDigest.ok || accumulator.scopeDigest !== scopeDigest.value
    || accumulator.accumulatorDigest !== expectedAccumulatorDigest
    || accumulator.accumulatorDigest !== computedRestoreAccumulatorDigest(accumulator)
    || accumulator.mmrRoot !== restoreRoot([
      ...accumulator.sealedCheckpointDigests, ...accumulator.openChunkDigests])
    || accumulator.openChunkDigests.some(digest => !decodeDigest(digest).ok)
    || accumulator.sealedCheckpointDigests.some(digest => !decodeDigest(digest).ok)
    || accumulator.restoreMmrStateRecordId !== restoreMmrStateFor(accumulator.scopeDigest,
      accumulator.sealedCheckpointDigests).recordId
    || accumulator.restoreMmrStateDigest !== restoreMmrStateFor(accumulator.scopeDigest,
      accumulator.sealedCheckpointDigests).stateDigest
    || accumulator.nextChunkIndex >= scope.orderedChunkDigests.length
    || scope.orderedChunkDigests[accumulator.nextChunkIndex] !== chunkDigest) return fail('RESTORE_CURSOR_INVALID');
  const open = Object.freeze([...accumulator.openChunkDigests, chunkDigest]);
  const sealed = open.length === K331F_LIMITS.maxRestoreChunksPerSegment
    ? Object.freeze([...accumulator.sealedCheckpointDigests, restoreRoot(open)])
    : accumulator.sealedCheckpointDigests;
  const retainedOpen = open.length === K331F_LIMITS.maxRestoreChunksPerSegment ? Object.freeze([]) : open;
  const mmrState = restoreMmrStateFor(scopeDigest.value, sealed);
  const next = { scopeDigest: scopeDigest.value, nextChunkIndex: accumulator.nextChunkIndex + 1,
    openChunkDigests: retainedOpen, sealedCheckpointDigests: sealed,
    restoreMmrStateRecordId: mmrState.recordId, restoreMmrStateDigest: mmrState.stateDigest,
    mmrRoot: restoreRoot([...sealed, ...retainedOpen]) };
  return ok(Object.freeze({ kind: 'absinthe_restore_accumulator', version: 1, ...next,
    accumulatorDigest: computedRestoreAccumulatorDigest(next) }));
}

export type RestoreFinalizationGraph = Readonly<{ scope: RestoreScope; accumulator: RestoreAccumulator;
  sessionAccumulatorDigest: string; k330RegistryDigest: string; quiescenceEvidenceDigest: string;
  sessionMmrStateRecordId: string; sessionMmrStateDigest: string;
  independentlyReadMmrState: unknown; currentSourceAuthority: unknown }>;

export function finalizeRestoreGraph(graph: RestoreFinalizationGraph): ProtocolResult<string> {
  const scopeDigest = restoreScopeDigest(graph.scope);
  const mmrState = decodeRestoreMmrState(graph.independentlyReadMmrState);
  if (!scopeDigest.ok || graph.accumulator.scopeDigest !== scopeDigest.value
    || graph.accumulator.accumulatorDigest !== graph.sessionAccumulatorDigest
    || graph.accumulator.accumulatorDigest !== computedRestoreAccumulatorDigest(graph.accumulator)
    || graph.accumulator.mmrRoot !== restoreRoot([
      ...graph.accumulator.sealedCheckpointDigests, ...graph.accumulator.openChunkDigests])
    || !mmrState.ok || graph.sessionMmrStateRecordId !== mmrState.value.recordId
    || graph.sessionMmrStateDigest !== mmrState.value.stateDigest
    || graph.accumulator.restoreMmrStateRecordId !== mmrState.value.recordId
    || graph.accumulator.restoreMmrStateDigest !== mmrState.value.stateDigest
    || mmrState.value.scopeDigest !== scopeDigest.value
    || mmrState.value.segmentCount !== graph.accumulator.sealedCheckpointDigests.length
    || graph.accumulator.nextChunkIndex !== graph.scope.orderedChunkDigests.length) {
    return fail('RESTORE_ACCUMULATOR_INVALID');
  }
  if (!decodeDigest(graph.k330RegistryDigest).ok || !decodeDigest(graph.quiescenceEvidenceDigest).ok) {
    return fail('RESTORE_NOT_QUIESCENT');
  }
  const authority = decodeSourceAuthority(graph.currentSourceAuthority);
  if (!authority.ok || authority.value.namespaceFingerprint !== graph.scope.namespaceFingerprint
    || authority.value.generationId !== graph.scope.generationId) {
    return fail('RESTORE_FINALIZATION_AUTHORITY_MISMATCH');
  }
  return ok(sha256Hex(K331F_DOMAINS.restoreManifest, [scopeDigest.value,
    graph.accumulator.accumulatorDigest, graph.accumulator.mmrRoot, authority.value.authorityDigest,
    graph.k330RegistryDigest, graph.quiescenceEvidenceDigest]));
}

export const PERSISTED_RECORD_CLASSES = Object.freeze([
  'source_authority', 'raw_source_receipt', 'open_segment_metadata', 'segment_checkpoint', 'mmr_state',
  'historical_proof', 'compacted_receipt_index', 'purge_certificate', 'note_revision_envelope',
  'folder_revision_envelope', 'relation_revision_envelope', 'attachment_canonical_envelope',
  'bootstrap_session', 'bootstrap_segment', 'bootstrap_category_accumulator', 'bootstrap_terminal_iterator',
  'restore_session', 'restore_chunk_receipt', 'restore_open_segment', 'restore_segment_checkpoint',
  'restore_mmr_state', 'restore_accumulator', 'restore_final_manifest',
] as const);
export type PersistedRecordClass = typeof PERSISTED_RECORD_CLASSES[number];

const GENERIC_RECORD_KEYS = Object.freeze(['kind', 'version', 'namespaceFingerprint', 'generationId',
  'recordId', 'recordDigest', 'revision', 'entries']);

export function makeStrictCodecFixture(recordClass: PersistedRecordClass): Readonly<Record<string, unknown>> {
  const withoutDigest = Object.freeze({ kind: `absinthe_${recordClass}`, version: 1,
    namespaceFingerprint: 'namespace-a', generationId: 'generation-a', recordId: `${recordClass}-a`,
    revision: '1', entries: Object.freeze([]) });
  return Object.freeze({ ...withoutDigest, recordDigest: sha256Hex(`ABSINTHE_${recordClass.toUpperCase()}_V1`,
    [withoutDigest.namespaceFingerprint, withoutDigest.generationId, withoutDigest.recordId,
      withoutDigest.revision, withoutDigest.entries]) });
}

export function decodePersistedRecord(recordClass: PersistedRecordClass, value: unknown): ProtocolResult<true> {
  if (!PERSISTED_RECORD_CLASSES.includes(recordClass) || !exactObject(value, GENERIC_RECORD_KEYS)
    || value.kind !== `absinthe_${recordClass}`) return fail('LINEAGE_RECORD_DECODE_FAILED');
  if (value.version !== 1) return fail('PROTOCOL_VERSION_UNSUPPORTED');
  if (!boundedText(value.namespaceFingerprint) || !boundedText(value.generationId) || !boundedText(value.recordId)
    || !decodeRevision(value.revision).ok || !Array.isArray(value.entries) || value.entries.length > 64
    || !decodeDigest(value.recordDigest).ok) return fail('LINEAGE_RECORD_DECODE_FAILED');
  const expected = sha256Hex(`ABSINTHE_${recordClass.toUpperCase()}_V1`, [value.namespaceFingerprint as string,
    value.generationId as string, value.recordId as string, value.revision as string,
    value.entries as readonly CanonicalValue[]]);
  return expected === value.recordDigest ? ok(true) : fail('LINEAGE_DIGEST_INVALID');
}

export const RELATIONSHIP_VERSION_MATRICES = Object.freeze({
  source_lineage: Object.freeze({ receipt: 1, checkpoint: 1, mmr: 1, authority: 1 }),
  compacted_lineage: Object.freeze({ index: 1, receipt: 1, proof: 1, authority: 1 }),
  bootstrap_graph: Object.freeze({ session: 1, accumulator: 1, terminal: 1, registry: 1 }),
  restore_graph: Object.freeze({ session: 1, accumulator: 1, authority: 1, registry: 1 }),
  attachment_bootstrap: Object.freeze({ canonical: 1, classification: 1, accumulator: 1 }),
});

export function validateRelationshipVersions(name: keyof typeof RELATIONSHIP_VERSION_MATRICES,
  versions: unknown): ProtocolResult<true> {
  const expected = RELATIONSHIP_VERSION_MATRICES[name];
  if (!exactObject(versions, Object.keys(expected))) return fail('MIXED_PROTOCOL_VERSION_EVIDENCE');
  return Object.entries(expected).every(([key, version]) => versions[key] === version)
    ? ok(true) : fail('MIXED_PROTOCOL_VERSION_EVIDENCE');
}
