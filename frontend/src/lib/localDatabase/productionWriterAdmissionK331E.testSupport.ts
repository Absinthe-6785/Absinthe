import { createHash } from 'node:crypto';

export const K331E_LIMITS = Object.freeze({
  maxRevisionDigits: 16,
  maxSourceRevision: 9_999_999_999_999_999n,
  segmentSize: 64,
  maxSegments: 156_250_000_000_000,
  maxMmrHeight: 47,
  maxPeakCount: 47,
  maxProofNodes: 96,
  derivedWorstCaseProofNodes: 92,
  maxEncodedProofBytes: 32 * 1024,
  maxBootstrapRecordsPerSegment: 64,
  maxBootstrapSegmentBytes: 256 * 1024,
  maxBootstrapEvidenceBytes: 8 * 1024,
  maxRestoreChunksPerSegment: 64,
});

export const K331E_DOMAINS = Object.freeze({
  receipt: 'ABSINTHE_SOURCE_RECEIPT_LEAF_V1',
  receiptLeaf: 'ABSINTHE_SEGMENT_RECEIPT_LEAF_V1',
  segmentNode: 'ABSINTHE_SEGMENT_MERKLE_NODE_V1',
  segmentEmpty: 'ABSINTHE_SEGMENT_EMPTY_NODE_V1',
  segmentRoot: 'ABSINTHE_SEGMENT_ROOT_V1',
  segmentCheckpoint: 'ABSINTHE_SEGMENT_CHECKPOINT_V1',
  mmrLeaf: 'ABSINTHE_MMR_LEAF_V1',
  mmrNode: 'ABSINTHE_MMR_NODE_V1',
  mmrPeaks: 'ABSINTHE_MMR_BAGGED_PEAKS_V1',
  mmrState: 'ABSINTHE_MMR_STATE_V1',
  compactedIndex: 'ABSINTHE_COMPACTED_RECEIPT_INDEX_V1',
  purgeCertificate: 'ABSINTHE_PURGE_CERTIFICATE_V1',
  bootstrapRecord: 'ABSINTHE_BOOTSTRAP_RECORD_V1',
  bootstrapSegment: 'ABSINTHE_BOOTSTRAP_SEGMENT_V1',
  bootstrapCategory: 'ABSINTHE_BOOTSTRAP_CATEGORY_ACCUMULATOR_V1',
  bootstrapFinal: 'ABSINTHE_BOOTSTRAP_FINAL_AUTHORITY_V1',
  restoreChunk: 'ABSINTHE_RESTORE_CHUNK_RECEIPT_V1',
  restoreSegment: 'ABSINTHE_RESTORE_SEGMENT_CHECKPOINT_V1',
  restoreAccumulator: 'ABSINTHE_RESTORE_ACCUMULATOR_V1',
  restoreManifest: 'ABSINTHE_RESTORE_FINAL_MANIFEST_V1',
} as const);

type CanonicalValue = null | boolean | number | string | readonly CanonicalValue[];

function normalizeCanonical(value: CanonicalValue): CanonicalValue {
  if (typeof value === 'string') return value.normalize('NFC');
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new Error('NON_CANONICAL_INTEGER');
    return value;
  }
  if (Array.isArray(value)) return value.map(item => normalizeCanonical(item));
  return value;
}

export function canonicalBytes(domain: string, fields: readonly CanonicalValue[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify(normalizeCanonical([domain, 1, ...fields])));
}

export function sha256HexBytes(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sha256Hex(domain: string, fields: readonly CanonicalValue[]): string {
  return sha256HexBytes(canonicalBytes(domain, fields));
}

export function isCanonicalDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

export type RevisionDecodeResult =
  | Readonly<{ ok: true; canonical: string; value: bigint }>
  | Readonly<{ ok: false; code: 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE' }>;

export function decodeRevision(value: unknown): RevisionDecodeResult {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]{0,15})$/.test(value)) {
    return { ok: false, code: 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE' };
  }
  const decoded = BigInt(value);
  return decoded <= K331E_LIMITS.maxSourceRevision
    ? { ok: true, canonical: value, value: decoded }
    : { ok: false, code: 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE' };
}

export type RevisionCoordinate = Readonly<{ revision: string; segmentIndex: number; leafIndex: number }>;

export function revisionCoordinate(revision: unknown): RevisionCoordinate | null {
  const decoded = decodeRevision(revision);
  if (!decoded.ok || decoded.value === 0n) return null;
  const ordinal = decoded.value - 1n;
  return Object.freeze({
    revision: decoded.canonical,
    segmentIndex: Number(ordinal / BigInt(K331E_LIMITS.segmentSize)),
    leafIndex: Number(ordinal % BigInt(K331E_LIMITS.segmentSize)),
  });
}

export type SourceReceipt = Readonly<{
  kind: 'absinthe_source_receipt';
  version: 1;
  namespaceFingerprint: string;
  generationId: string;
  operationId: string;
  writerSessionDigest: string;
  mutationKind: string;
  previousSourceRevision: string;
  committedSourceRevision: string;
  canonicalInputDigest: string;
  affectedRecordIdentityDigest: string;
  committedResultDigest: string;
  immutableOutboxIntentDigest: string;
  committedAuthorityDigest: string;
  previousReceiptChainDigest: string | null;
  receiptDigest: string;
}>;

type SourceReceiptInput = Omit<SourceReceipt, 'kind' | 'version' | 'receiptDigest'>;

function receiptFields(receipt: SourceReceiptInput): readonly CanonicalValue[] {
  return [receipt.namespaceFingerprint, receipt.generationId, receipt.operationId,
    receipt.writerSessionDigest, receipt.mutationKind, receipt.previousSourceRevision,
    receipt.committedSourceRevision, receipt.canonicalInputDigest,
    receipt.affectedRecordIdentityDigest, receipt.committedResultDigest,
    receipt.immutableOutboxIntentDigest, receipt.committedAuthorityDigest,
    receipt.previousReceiptChainDigest];
}

export function createReceipt(input: Partial<SourceReceiptInput> & Pick<SourceReceiptInput,
  'operationId' | 'previousSourceRevision' | 'committedSourceRevision'>): SourceReceipt {
  const complete: SourceReceiptInput = Object.freeze({
    namespaceFingerprint: 'namespace-fingerprint', generationId: 'generation-a',
    writerSessionDigest: sha256Hex('ABSINTHE_WRITER_SESSION_V1', ['writer-a']),
    mutationKind: 'NOTE_UPSERT', canonicalInputDigest: sha256Hex('ABSINTHE_INPUT_V1', ['input']),
    affectedRecordIdentityDigest: sha256Hex('ABSINTHE_IDENTITIES_V1', ['note-a']),
    committedResultDigest: sha256Hex('ABSINTHE_RESULT_V1', ['result']),
    immutableOutboxIntentDigest: sha256Hex('ABSINTHE_OUTBOX_INTENT_V1', ['outbox']),
    committedAuthorityDigest: sha256Hex('ABSINTHE_AUTHORITY_V1', [input.committedSourceRevision]),
    previousReceiptChainDigest: null, ...input,
  });
  const receiptDigest = sha256Hex(K331E_DOMAINS.receipt, receiptFields(complete));
  return Object.freeze({ kind: 'absinthe_source_receipt', version: 1, ...complete, receiptDigest });
}

export function verifyReceipt(receipt: SourceReceipt): boolean {
  if (receipt.kind !== 'absinthe_source_receipt' || receipt.version !== 1
    || !decodeRevision(receipt.previousSourceRevision).ok
    || !decodeRevision(receipt.committedSourceRevision).ok
    || !isCanonicalDigest(receipt.receiptDigest)) return false;
  const { kind: _kind, version: _version, receiptDigest, ...input } = receipt;
  return sha256Hex(K331E_DOMAINS.receipt, receiptFields(input)) === receiptDigest;
}

export function segmentReceiptLeaf(receipt: SourceReceipt): string {
  const coordinate = revisionCoordinate(receipt.committedSourceRevision);
  if (!coordinate || !verifyReceipt(receipt)) throw new Error('LINEAGE_RECEIPT_DIGEST_MISMATCH');
  return sha256Hex(K331E_DOMAINS.receiptLeaf,
    [coordinate.revision, receipt.receiptDigest, coordinate.segmentIndex, coordinate.leafIndex]);
}

type MerkleSibling = Readonly<{ side: 'left' | 'right'; digest: string }>;
export type MerkleProof = readonly MerkleSibling[];

function segmentEmptyDigest(level: number, nodeIndex: number): string {
  return sha256Hex(K331E_DOMAINS.segmentEmpty, [level, nodeIndex]);
}

function segmentNode(left: string, right: string, level: number): string {
  return sha256Hex(K331E_DOMAINS.segmentNode, [level, left, right]);
}

function buildMerkleLevels(leaves: readonly string[]): readonly (readonly string[])[] {
  if (leaves.length === 0 || leaves.length > K331E_LIMITS.segmentSize
    || leaves.some(leaf => !isCanonicalDigest(leaf))) throw new Error('LINEAGE_SEGMENT_PATH_INVALID');
  const levels: string[][] = [[...leaves]];
  let level = 0;
  while (levels[level].length > 1) {
    const current = levels[level];
    const next: string[] = [];
    for (let index = 0; index < current.length; index += 2) {
      next.push(segmentNode(current[index], current[index + 1] ?? segmentEmptyDigest(level, index + 1), level));
    }
    levels.push(next);
    level += 1;
  }
  return levels;
}

export function segmentMerkleRoot(leaves: readonly string[]): string {
  const levels = buildMerkleLevels(leaves);
  const root = levels[levels.length - 1]?.[0];
  if (!root) throw new Error('LINEAGE_SEGMENT_PATH_INVALID');
  return sha256Hex(K331E_DOMAINS.segmentRoot, [leaves.length, root]);
}

export function segmentMerkleProof(leaves: readonly string[], leafIndex: number): MerkleProof {
  const levels = buildMerkleLevels(leaves);
  if (!Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= leaves.length) {
    throw new Error('LINEAGE_COORDINATE_MISMATCH');
  }
  const proof: MerkleSibling[] = [];
  let index = leafIndex;
  for (let level = 0; level < levels.length - 1; level += 1) {
    const current = levels[level];
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(Object.freeze({
      side: index % 2 === 0 ? 'right' : 'left',
      digest: current[siblingIndex] ?? segmentEmptyDigest(level, siblingIndex),
    }));
    index = Math.floor(index / 2);
  }
  return Object.freeze(proof);
}

export function verifySegmentMerkleProof(
  leaf: string, leafIndex: number, leafCount: number, proof: MerkleProof, expectedRoot: string,
): boolean {
  if (!isCanonicalDigest(leaf) || !isCanonicalDigest(expectedRoot)
    || !Number.isInteger(leafIndex) || leafIndex < 0 || leafIndex >= leafCount
    || leafCount < 1 || leafCount > K331E_LIMITS.segmentSize || proof.length > 6) return false;
  let digest = leaf;
  let index = leafIndex;
  for (let level = 0; level < proof.length; level += 1) {
    const sibling = proof[level];
    if (!isCanonicalDigest(sibling.digest)
      || sibling.side !== (index % 2 === 0 ? 'right' : 'left')) return false;
    digest = sibling.side === 'right'
      ? segmentNode(digest, sibling.digest, level)
      : segmentNode(sibling.digest, digest, level);
    index = Math.floor(index / 2);
  }
  return sha256Hex(K331E_DOMAINS.segmentRoot, [leafCount, digest]) === expectedRoot;
}

export type SegmentCheckpoint = Readonly<{
  kind: 'absinthe_segment_checkpoint'; version: 1; namespaceFingerprint: string;
  generationId: string; segmentIndex: number; firstRevision: string; lastRevision: string;
  receiptCount: number; segmentRoot: string; endAuthorityDigest: string;
  previousCheckpointDigest: string | null; checkpointDigest: string;
}>;

function checkpointFields(checkpoint: Omit<SegmentCheckpoint, 'checkpointDigest'>): readonly CanonicalValue[] {
  return [checkpoint.namespaceFingerprint, checkpoint.generationId, checkpoint.segmentIndex,
    checkpoint.firstRevision, checkpoint.lastRevision, checkpoint.receiptCount,
    checkpoint.segmentRoot, checkpoint.endAuthorityDigest, checkpoint.previousCheckpointDigest];
}

export function createSegmentCheckpoint(
  receipts: readonly SourceReceipt[], previousCheckpointDigest: string | null = null,
): SegmentCheckpoint {
  if (receipts.length < 1 || receipts.length > K331E_LIMITS.segmentSize) throw new Error('LINEAGE_SEGMENT_PATH_INVALID');
  const coordinates = receipts.map(receipt => revisionCoordinate(receipt.committedSourceRevision));
  if (coordinates.some(coordinate => coordinate === null)) throw new Error('LINEAGE_COORDINATE_MISMATCH');
  const exact = coordinates as RevisionCoordinate[];
  const segmentIndex = exact[0].segmentIndex;
  for (let index = 0; index < exact.length; index += 1) {
    if (exact[index].segmentIndex !== segmentIndex || exact[index].leafIndex !== index
      || BigInt(exact[index].revision) !== BigInt(exact[0].revision) + BigInt(index)) {
      throw new Error('LINEAGE_COORDINATE_MISMATCH');
    }
  }
  const withoutDigest = Object.freeze({
    kind: 'absinthe_segment_checkpoint' as const, version: 1 as const,
    namespaceFingerprint: receipts[0].namespaceFingerprint, generationId: receipts[0].generationId,
    segmentIndex, firstRevision: exact[0].revision, lastRevision: exact[exact.length - 1].revision,
    receiptCount: receipts.length, segmentRoot: segmentMerkleRoot(receipts.map(segmentReceiptLeaf)),
    endAuthorityDigest: receipts[receipts.length - 1].committedAuthorityDigest, previousCheckpointDigest,
  });
  return Object.freeze({ ...withoutDigest,
    checkpointDigest: sha256Hex(K331E_DOMAINS.segmentCheckpoint, checkpointFields(withoutDigest)) });
}

function verifyCheckpoint(checkpoint: SegmentCheckpoint): boolean {
  const { checkpointDigest, ...withoutDigest } = checkpoint;
  const first = revisionCoordinate(checkpoint.firstRevision);
  const last = revisionCoordinate(checkpoint.lastRevision);
  return checkpoint.kind === 'absinthe_segment_checkpoint' && checkpoint.version === 1
    && first !== null && last !== null && first.segmentIndex === checkpoint.segmentIndex
    && last.segmentIndex === checkpoint.segmentIndex && first.leafIndex === 0
    && last.leafIndex === checkpoint.receiptCount - 1
    && isCanonicalDigest(checkpoint.segmentRoot) && isCanonicalDigest(checkpoint.endAuthorityDigest)
    && sha256Hex(K331E_DOMAINS.segmentCheckpoint, checkpointFields(withoutDigest)) === checkpointDigest;
}

type MmrPeak = Readonly<{ height: number; digest: string }>;
export type MmrState = Readonly<{
  kind: 'absinthe_mmr_state'; version: 1; leafCount: number; peaks: readonly MmrPeak[];
  root: string; lastSealedSegment: number; stateDigest: string;
}>;

function mmrLeaf(checkpoint: SegmentCheckpoint): string {
  if (!verifyCheckpoint(checkpoint)) throw new Error('LINEAGE_SEGMENT_CHECKPOINT_CONFLICT');
  return sha256Hex(K331E_DOMAINS.mmrLeaf, [checkpoint.segmentIndex, checkpoint.firstRevision,
    checkpoint.lastRevision, checkpoint.receiptCount, checkpoint.segmentRoot,
    checkpoint.endAuthorityDigest, checkpoint.previousCheckpointDigest, checkpoint.checkpointDigest]);
}

function mmrNode(height: number, left: string, right: string): string {
  return sha256Hex(K331E_DOMAINS.mmrNode, [height, left, right]);
}

function bagPeaks(leafCount: number, peaks: readonly MmrPeak[]): string {
  return sha256Hex(K331E_DOMAINS.mmrPeaks,
    [leafCount, peaks.map(peak => [peak.height, peak.digest])]);
}

function mmrStateDigest(state: Omit<MmrState, 'stateDigest'>): string {
  return sha256Hex(K331E_DOMAINS.mmrState,
    [state.leafCount, state.peaks.map(peak => [peak.height, peak.digest]), state.root,
      state.lastSealedSegment]);
}

export function emptyMmrState(): MmrState {
  const withoutDigest = Object.freeze({ kind: 'absinthe_mmr_state' as const, version: 1 as const,
    leafCount: 0, peaks: Object.freeze([]) as readonly MmrPeak[],
    root: bagPeaks(0, []), lastSealedSegment: -1 });
  return Object.freeze({ ...withoutDigest, stateDigest: mmrStateDigest(withoutDigest) });
}

export function appendMmrCheckpoint(state: MmrState, checkpoint: SegmentCheckpoint): MmrState {
  if (!verifyMmrState(state) || checkpoint.segmentIndex !== state.leafCount
    || checkpoint.segmentIndex !== state.lastSealedSegment + 1) throw new Error('LINEAGE_APPEND_SEAL_CONFLICT');
  const peaks: MmrPeak[] = [...state.peaks, Object.freeze({ height: 0, digest: mmrLeaf(checkpoint) })];
  while (peaks.length > 1
    && peaks[peaks.length - 1].height === peaks[peaks.length - 2].height) {
    const right = peaks.pop()!;
    const left = peaks.pop()!;
    peaks.push(Object.freeze({ height: left.height + 1,
      digest: mmrNode(left.height + 1, left.digest, right.digest) }));
  }
  const withoutDigest = Object.freeze({ kind: 'absinthe_mmr_state' as const, version: 1 as const,
    leafCount: state.leafCount + 1, peaks: Object.freeze(peaks),
    root: bagPeaks(state.leafCount + 1, peaks), lastSealedSegment: checkpoint.segmentIndex });
  return Object.freeze({ ...withoutDigest, stateDigest: mmrStateDigest(withoutDigest) });
}

export function verifyMmrState(state: MmrState): boolean {
  if (state.kind !== 'absinthe_mmr_state' || state.version !== 1 || state.leafCount < 0
    || state.peaks.length > K331E_LIMITS.maxPeakCount || !isCanonicalDigest(state.root)
    || !isCanonicalDigest(state.stateDigest)) return false;
  const heights: number[] = [];
  for (let bit = Math.floor(Math.log2(Math.max(1, state.leafCount))); bit >= 0; bit -= 1) {
    if ((BigInt(state.leafCount) & (1n << BigInt(bit))) !== 0n) heights.push(bit);
  }
  if (heights.length !== state.peaks.length
    || state.peaks.some((peak, index) => peak.height !== heights[index] || !isCanonicalDigest(peak.digest))) return false;
  const { stateDigest, ...withoutDigest } = state;
  return bagPeaks(state.leafCount, state.peaks) === state.root
    && mmrStateDigest(withoutDigest) === stateDigest;
}

export type MmrProof = Readonly<{
  kind: 'absinthe_mmr_proof'; version: 1; leafCount: number; leafIndex: number;
  targetPeakPosition: number; path: readonly MerkleSibling[]; otherPeaks: readonly MmrPeak[];
}>;

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
  let height = 1;
  while (layer.length > 1) {
    const siblingIndex = index % 2 === 0 ? index + 1 : index - 1;
    proof.push(Object.freeze({ side: index % 2 === 0 ? 'right' : 'left', digest: layer[siblingIndex] }));
    const next: string[] = [];
    for (let cursor = 0; cursor < layer.length; cursor += 2) {
      next.push(mmrNode(height, layer[cursor], layer[cursor + 1]));
    }
    layer = next;
    index = Math.floor(index / 2);
    height += 1;
  }
  return Object.freeze(proof);
}

export function createMmrProof(checkpoints: readonly SegmentCheckpoint[], leafIndex: number): MmrProof {
  if (leafIndex < 0 || leafIndex >= checkpoints.length) throw new Error('LINEAGE_COORDINATE_MISMATCH');
  const leaves = checkpoints.map(mmrLeaf);
  const ranges = mountainRanges(leaves.length);
  const targetPeakPosition = ranges.findIndex(range => leafIndex >= range.start && leafIndex < range.start + range.size);
  const target = ranges[targetPeakPosition];
  const peaks = ranges.map(range => {
    let layer = leaves.slice(range.start, range.start + range.size);
    let height = 1;
    while (layer.length > 1) {
      const next: string[] = [];
      for (let index = 0; index < layer.length; index += 2) next.push(mmrNode(height, layer[index], layer[index + 1]));
      layer = next;
      height += 1;
    }
    return Object.freeze({ height: range.height, digest: layer[0] });
  });
  return Object.freeze({ kind: 'absinthe_mmr_proof', version: 1, leafCount: leaves.length, leafIndex,
    targetPeakPosition, path: perfectPeakProof(leaves.slice(target.start, target.start + target.size), leafIndex - target.start),
    otherPeaks: Object.freeze(peaks.filter((_peak, index) => index !== targetPeakPosition)) });
}

export function encodeMmrProof(proof: MmrProof): string {
  return JSON.stringify([proof.kind, proof.version, proof.leafCount, proof.leafIndex,
    proof.targetPeakPosition, proof.path.map(node => [node.side, node.digest]),
    proof.otherPeaks.map(peak => [peak.height, peak.digest])]);
}

export type ProofDecodeResult = Readonly<{ ok: true; proof: MmrProof }>
  | Readonly<{ ok: false; code: 'LINEAGE_PROOF_TOO_LARGE' | 'LINEAGE_PROOF_NODE_LIMIT_EXCEEDED'
    | 'LINEAGE_PROOF_VERSION_UNSUPPORTED' | 'LINEAGE_MMR_PATH_INVALID' }>;

export function decodeMmrProof(encoded: string): ProofDecodeResult {
  if (typeof encoded !== 'string' || encoded.length > K331E_LIMITS.maxEncodedProofBytes
    || new TextEncoder().encode(encoded).byteLength > K331E_LIMITS.maxEncodedProofBytes) {
    return { ok: false, code: 'LINEAGE_PROOF_TOO_LARGE' };
  }
  let raw: unknown;
  try { raw = JSON.parse(encoded); } catch { return { ok: false, code: 'LINEAGE_MMR_PATH_INVALID' }; }
  if (!Array.isArray(raw) || raw.length !== 7 || raw[0] !== 'absinthe_mmr_proof') {
    return { ok: false, code: 'LINEAGE_MMR_PATH_INVALID' };
  }
  if (raw[1] !== 1) return { ok: false, code: 'LINEAGE_PROOF_VERSION_UNSUPPORTED' };
  if (!Array.isArray(raw[5]) || !Array.isArray(raw[6])
    || raw[5].length + raw[6].length > K331E_LIMITS.maxProofNodes
    || raw[5].length > K331E_LIMITS.maxMmrHeight || raw[6].length > K331E_LIMITS.maxPeakCount) {
    return { ok: false, code: 'LINEAGE_PROOF_NODE_LIMIT_EXCEEDED' };
  }
  const path: MerkleSibling[] = [];
  for (const entry of raw[5]) {
    if (!Array.isArray(entry) || entry.length !== 2 || (entry[0] !== 'left' && entry[0] !== 'right')
      || !isCanonicalDigest(entry[1])) return { ok: false, code: 'LINEAGE_MMR_PATH_INVALID' };
    path.push(Object.freeze({ side: entry[0], digest: entry[1] }));
  }
  const otherPeaks: MmrPeak[] = [];
  for (const entry of raw[6]) {
    if (!Array.isArray(entry) || entry.length !== 2 || !Number.isSafeInteger(entry[0])
      || !isCanonicalDigest(entry[1])) return { ok: false, code: 'LINEAGE_MMR_PATH_INVALID' };
    otherPeaks.push(Object.freeze({ height: entry[0], digest: entry[1] }));
  }
  if (![raw[2], raw[3], raw[4]].every(Number.isSafeInteger)) return { ok: false, code: 'LINEAGE_MMR_PATH_INVALID' };
  return { ok: true, proof: Object.freeze({ kind: 'absinthe_mmr_proof', version: 1,
    leafCount: raw[2], leafIndex: raw[3], targetPeakPosition: raw[4],
    path: Object.freeze(path), otherPeaks: Object.freeze(otherPeaks) }) };
}

export function verifyMmrProof(checkpoint: SegmentCheckpoint, encoded: string, authority: MmrState): boolean {
  if (!verifyMmrState(authority)) return false;
  const decoded = decodeMmrProof(encoded);
  if (!decoded.ok) return false;
  const proof = decoded.proof;
  if (proof.leafCount !== authority.leafCount || proof.leafIndex !== checkpoint.segmentIndex) return false;
  const ranges = mountainRanges(proof.leafCount);
  const target = ranges[proof.targetPeakPosition];
  if (!target || proof.leafIndex < target.start || proof.leafIndex >= target.start + target.size
    || proof.path.length !== target.height || proof.otherPeaks.length !== ranges.length - 1) return false;
  let digest = mmrLeaf(checkpoint);
  let localIndex = proof.leafIndex - target.start;
  for (let level = 0; level < proof.path.length; level += 1) {
    const node = proof.path[level];
    const expectedSide = localIndex % 2 === 0 ? 'right' : 'left';
    if (node.side !== expectedSide) return false;
    digest = node.side === 'right'
      ? mmrNode(level + 1, digest, node.digest)
      : mmrNode(level + 1, node.digest, digest);
    localIndex = Math.floor(localIndex / 2);
  }
  const peaks: MmrPeak[] = [];
  let otherIndex = 0;
  for (let index = 0; index < ranges.length; index += 1) {
    peaks.push(index === proof.targetPeakPosition
      ? Object.freeze({ height: target.height, digest })
      : proof.otherPeaks[otherIndex++]);
  }
  return peaks.every((peak, index) => peak.height === ranges[index].height)
    && bagPeaks(proof.leafCount, peaks) === authority.root;
}

export type HistoricalReceiptProof = Readonly<{
  kind: 'absinthe_historical_receipt_proof'; version: 1; receipt: SourceReceipt;
  segmentLeafCount: number; segmentPath: MerkleProof; checkpoint: SegmentCheckpoint;
  mmrProofEncoded: string; mmrState: MmrState; sourceAuthorityMmrStateDigest: string;
}>;

export function verifyHistoricalReceiptProof(proof: HistoricalReceiptProof): string {
  if (proof.kind !== 'absinthe_historical_receipt_proof' || proof.version !== 1) return 'PROTOCOL_VERSION_UNSUPPORTED';
  const coordinate = revisionCoordinate(proof.receipt.committedSourceRevision);
  if (!coordinate || coordinate.segmentIndex !== proof.checkpoint.segmentIndex
    || coordinate.leafIndex >= proof.segmentLeafCount) return 'LINEAGE_COORDINATE_MISMATCH';
  if (!verifyReceipt(proof.receipt)) return 'LINEAGE_RECEIPT_DIGEST_MISMATCH';
  if (!verifyCheckpoint(proof.checkpoint)) return 'LINEAGE_SEGMENT_CHECKPOINT_CONFLICT';
  if (!verifySegmentMerkleProof(segmentReceiptLeaf(proof.receipt), coordinate.leafIndex,
    proof.segmentLeafCount, proof.segmentPath, proof.checkpoint.segmentRoot)) return 'LINEAGE_SEGMENT_PATH_INVALID';
  if (proof.sourceAuthorityMmrStateDigest !== proof.mmrState.stateDigest) return 'LINEAGE_MMR_AUTHORITY_MISMATCH';
  const decoded = decodeMmrProof(proof.mmrProofEncoded);
  if (!decoded.ok) return decoded.code;
  return verifyMmrProof(proof.checkpoint, proof.mmrProofEncoded, proof.mmrState)
    ? 'VERIFIED' : 'LINEAGE_MMR_PATH_INVALID';
}

export type OpenSegmentMetadata = Readonly<{
  kind: 'absinthe_open_segment'; version: 1; segmentIndex: number;
  receiptCount: number; partialRoot: string; lastRevision: string;
}>;

export function verifyUnsealedSegment(
  receipts: readonly SourceReceipt[], metadata: OpenSegmentMetadata, sourceAuthorityRevision: string,
): Readonly<{ ok: true; rawReceiptReads: number }> | Readonly<{ ok: false; code: string }> {
  if (metadata.kind !== 'absinthe_open_segment' || metadata.version !== 1
    || receipts.length < 1 || receipts.length > K331E_LIMITS.segmentSize
    || receipts.length !== metadata.receiptCount) return { ok: false, code: 'LINEAGE_SEGMENT_PATH_INVALID' };
  const coordinates = receipts.map(receipt => revisionCoordinate(receipt.committedSourceRevision));
  if (coordinates.some(coordinate => coordinate === null)) return { ok: false, code: 'LINEAGE_COORDINATE_MISMATCH' };
  const exact = coordinates as RevisionCoordinate[];
  for (let index = 0; index < receipts.length; index += 1) {
    if (!verifyReceipt(receipts[index]) || exact[index].segmentIndex !== metadata.segmentIndex
      || exact[index].leafIndex !== index
      || index > 0 && BigInt(exact[index].revision) !== BigInt(exact[index - 1].revision) + 1n) {
      return { ok: false, code: 'LINEAGE_COORDINATE_MISMATCH' };
    }
  }
  if (metadata.lastRevision !== exact[exact.length - 1].revision
    || sourceAuthorityRevision !== metadata.lastRevision
    || segmentMerkleRoot(receipts.map(segmentReceiptLeaf)) !== metadata.partialRoot) {
    return { ok: false, code: 'LINEAGE_SEGMENT_PATH_INVALID' };
  }
  return { ok: true, rawReceiptReads: receipts.length };
}

export type AppendState = Readonly<{
  revision: string; receipts: Readonly<Record<string, SourceReceipt>>; openSegmentIndex: number;
  openReceipts: readonly SourceReceipt[]; checkpoints: readonly SegmentCheckpoint[];
  mmrState: MmrState; sourceAuthorityMmrStateDigest: string;
}>;

export function emptyAppendState(): AppendState {
  const mmrState = emptyMmrState();
  return Object.freeze({ revision: '0', receipts: Object.freeze({}), openSegmentIndex: 0,
    openReceipts: Object.freeze([]), checkpoints: Object.freeze([]), mmrState,
    sourceAuthorityMmrStateDigest: mmrState.stateDigest });
}

export function appendReceiptTransaction(
  state: AppendState, operationId: string, inputDigest: string,
): Readonly<{ ok: true; state: AppendState; receipt: SourceReceipt; reused: boolean; sealed: boolean }>
  | Readonly<{ ok: false; code: 'LINEAGE_APPEND_SEAL_CONFLICT' | 'OPERATION_IDENTITY_MISMATCH' }> {
  if (!verifyMmrState(state.mmrState) || state.sourceAuthorityMmrStateDigest !== state.mmrState.stateDigest
    || state.openSegmentIndex !== state.mmrState.leafCount) return { ok: false, code: 'LINEAGE_APPEND_SEAL_CONFLICT' };
  const existing = state.receipts[operationId];
  if (existing) return existing.canonicalInputDigest === inputDigest
    ? { ok: true, state, receipt: existing, reused: true,
      sealed: state.checkpoints.some(checkpoint => checkpoint.segmentIndex === revisionCoordinate(existing.committedSourceRevision)?.segmentIndex) }
    : { ok: false, code: 'OPERATION_IDENTITY_MISMATCH' };
  const current = decodeRevision(state.revision);
  if (!current.ok) return { ok: false, code: 'LINEAGE_APPEND_SEAL_CONFLICT' };
  const next = (current.value + 1n).toString(10);
  const coordinate = revisionCoordinate(next);
  if (!coordinate || coordinate.segmentIndex !== state.openSegmentIndex
    || coordinate.leafIndex !== state.openReceipts.length) return { ok: false, code: 'LINEAGE_APPEND_SEAL_CONFLICT' };
  const receipt = createReceipt({ operationId, previousSourceRevision: state.revision,
    committedSourceRevision: next, canonicalInputDigest: inputDigest,
    previousReceiptChainDigest: state.openReceipts[state.openReceipts.length - 1]?.receiptDigest
      ?? state.checkpoints[state.checkpoints.length - 1]?.checkpointDigest ?? null });
  const receipts = Object.freeze({ ...state.receipts, [operationId]: receipt });
  const appended = Object.freeze([...state.openReceipts, receipt]);
  if (appended.length < K331E_LIMITS.segmentSize) return { ok: true, receipt, reused: false, sealed: false,
    state: Object.freeze({ ...state, revision: next, receipts, openReceipts: appended }) };
  const checkpoint = createSegmentCheckpoint(appended,
    state.checkpoints[state.checkpoints.length - 1]?.checkpointDigest ?? null);
  const mmrState = appendMmrCheckpoint(state.mmrState, checkpoint);
  return { ok: true, receipt, reused: false, sealed: true, state: Object.freeze({ revision: next, receipts,
    openSegmentIndex: state.openSegmentIndex + 1, openReceipts: Object.freeze([]),
    checkpoints: Object.freeze([...state.checkpoints, checkpoint]), mmrState,
    sourceAuthorityMmrStateDigest: mmrState.stateDigest }) };
}

export type CompactedReceiptIndex = Readonly<{
  kind: 'absinthe_compacted_receipt_index'; version: 1; namespaceFingerprint: string;
  generationId: string; operationId: string; committedSourceRevision: string; receiptDigest: string;
  segmentIndex: number; leafIndex: number; segmentCheckpointDigest: string; segmentMerkleRoot: string;
  mmrLeafIndex: number; mmrStateDigest: string; terminalReceiptDigest: string;
  immutableOutboxIntentDigest: string; classification: 'terminal_authenticated'; indexDigest: string;
}>;

function compactedIndexFields(index: Omit<CompactedReceiptIndex, 'indexDigest'>): readonly CanonicalValue[] {
  return [index.namespaceFingerprint, index.generationId, index.operationId, index.committedSourceRevision,
    index.receiptDigest, index.segmentIndex, index.leafIndex, index.segmentCheckpointDigest,
    index.segmentMerkleRoot, index.mmrLeafIndex, index.mmrStateDigest,
    index.terminalReceiptDigest, index.immutableOutboxIntentDigest, index.classification];
}

export type CompactionGraph = Readonly<{
  proof: HistoricalReceiptProof; terminal: 'committed' | 'failed' | 'absent';
  terminalReceiptDigest: string | null; pendingReconciliation: boolean;
  activeRestoreReference: boolean; activeMigrationReference: boolean; corruptionHold: boolean;
  existingIndex: CompactedReceiptIndex | null; rawReceiptPresent: boolean;
}>;

export function compactReceiptTransaction(graph: CompactionGraph):
  Readonly<{ ok: true; reused: boolean; index: CompactedReceiptIndex; rawReceiptPresent: false }>
  | Readonly<{ ok: false; code: string }> {
  if (!graph.rawReceiptPresent && graph.existingIndex === null) return { ok: false, code: 'LINEAGE_COMPACTION_INDEX_CONFLICT' };
  if (graph.activeRestoreReference || graph.activeMigrationReference) return { ok: false, code: 'LINEAGE_COMPACTION_REFERENCE_ACTIVE' };
  if (graph.corruptionHold || graph.pendingReconciliation || graph.terminal !== 'committed'
    || graph.terminalReceiptDigest !== graph.proof.receipt.receiptDigest) {
    return { ok: false, code: 'LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE' };
  }
  const verification = verifyHistoricalReceiptProof(graph.proof);
  if (verification !== 'VERIFIED') return { ok: false, code: verification };
  const coordinate = revisionCoordinate(graph.proof.receipt.committedSourceRevision)!;
  const withoutDigest = Object.freeze({ kind: 'absinthe_compacted_receipt_index' as const, version: 1 as const,
    namespaceFingerprint: graph.proof.receipt.namespaceFingerprint,
    generationId: graph.proof.receipt.generationId, operationId: graph.proof.receipt.operationId,
    committedSourceRevision: graph.proof.receipt.committedSourceRevision,
    receiptDigest: graph.proof.receipt.receiptDigest, segmentIndex: coordinate.segmentIndex,
    leafIndex: coordinate.leafIndex, segmentCheckpointDigest: graph.proof.checkpoint.checkpointDigest,
    segmentMerkleRoot: graph.proof.checkpoint.segmentRoot, mmrLeafIndex: coordinate.segmentIndex,
    mmrStateDigest: graph.proof.mmrState.stateDigest,
    terminalReceiptDigest: graph.terminalReceiptDigest,
    immutableOutboxIntentDigest: graph.proof.receipt.immutableOutboxIntentDigest,
    classification: 'terminal_authenticated' as const });
  const index = Object.freeze({ ...withoutDigest,
    indexDigest: sha256Hex(K331E_DOMAINS.compactedIndex, compactedIndexFields(withoutDigest)) });
  if (graph.existingIndex) return JSON.stringify(graph.existingIndex) === JSON.stringify(index)
    ? { ok: true, reused: true, index: graph.existingIndex, rawReceiptPresent: false }
    : { ok: false, code: 'LINEAGE_COMPACTION_INDEX_CONFLICT' };
  return { ok: true, reused: false, index, rawReceiptPresent: false };
}

export type EntityRevisionEnvelope = Readonly<{
  lifecycle: 'active' | 'tombstoned' | 'purged'; createdSourceRevision: string;
  lastMutatedSourceRevision: string; deletedSourceRevision: string | null;
  revisionZeroInitialization: 'native' | 'preexisting_state_not_historical_event';
}>;

export function transitionEntityExact(
  currentGlobalRevision: string, committedRevision: string, current: EntityRevisionEnvelope | null,
  action: 'create' | 'update' | 'tombstone' | 'resurrect' | 'purge',
): EntityRevisionEnvelope | 'SOURCE_REVISION_TRANSITION_INVALID' {
  const global = decodeRevision(currentGlobalRevision);
  const committed = decodeRevision(committedRevision);
  if (!global.ok || !committed.ok || committed.value !== global.value + 1n) return 'SOURCE_REVISION_TRANSITION_INVALID';
  if (action === 'create') return current === null ? Object.freeze({ lifecycle: 'active' as const,
    createdSourceRevision: committed.canonical, lastMutatedSourceRevision: committed.canonical,
    deletedSourceRevision: null, revisionZeroInitialization: 'native' as const }) : 'SOURCE_REVISION_TRANSITION_INVALID';
  if (!current || current.lifecycle === 'purged') return 'SOURCE_REVISION_TRANSITION_INVALID';
  if (action === 'update' && current.lifecycle === 'active') return Object.freeze({ ...current,
    lastMutatedSourceRevision: committed.canonical });
  if (action === 'tombstone' && current.lifecycle === 'active') return Object.freeze({ ...current,
    lifecycle: 'tombstoned', lastMutatedSourceRevision: committed.canonical,
    deletedSourceRevision: committed.canonical });
  if (action === 'resurrect' && current.lifecycle === 'tombstoned') return Object.freeze({ ...current,
    lifecycle: 'active', lastMutatedSourceRevision: committed.canonical, deletedSourceRevision: null });
  if (action === 'purge' && current.lifecycle === 'tombstoned') return Object.freeze({ ...current,
    lifecycle: 'purged', lastMutatedSourceRevision: committed.canonical });
  return 'SOURCE_REVISION_TRANSITION_INVALID';
}

export type PurgeCertificate = Readonly<{
  kind: 'absinthe_purge_certificate'; version: 1; namespaceFingerprint: string; generationId: string;
  entityType: string; entityIdDigest: string; priorTombstoneRevision: string;
  priorTombstoneReceiptDigest: string; purgeOperationId: string; previousSourceRevision: string;
  committedPurgeRevision: string; resultingAuthorityDigest: string; sourceLineageReceiptDigest: string;
  certificateDigest: string;
}>;

export function createPurgeCertificate(input: Omit<PurgeCertificate, 'kind' | 'version' | 'certificateDigest'>): PurgeCertificate {
  const prior = decodeRevision(input.priorTombstoneRevision);
  const previous = decodeRevision(input.previousSourceRevision);
  const committed = decodeRevision(input.committedPurgeRevision);
  if (!prior.ok || !previous.ok || !committed.ok || committed.value !== previous.value + 1n
    || ![input.entityIdDigest, input.priorTombstoneReceiptDigest, input.resultingAuthorityDigest,
      input.sourceLineageReceiptDigest].every(isCanonicalDigest)) throw new Error('SOURCE_REVISION_TRANSITION_INVALID');
  const fields: readonly CanonicalValue[] = [input.namespaceFingerprint, input.generationId, input.entityType,
    input.entityIdDigest, input.priorTombstoneRevision, input.priorTombstoneReceiptDigest,
    input.purgeOperationId, input.previousSourceRevision, input.committedPurgeRevision,
    input.resultingAuthorityDigest, input.sourceLineageReceiptDigest];
  return Object.freeze({ kind: 'absinthe_purge_certificate', version: 1, ...input,
    certificateDigest: sha256Hex(K331E_DOMAINS.purgeCertificate, fields) });
}

export function verifyPurgeCertificate(certificate: PurgeCertificate): boolean {
  if (certificate.kind !== 'absinthe_purge_certificate' || certificate.version !== 1) return false;
  const { kind: _kind, version: _version, certificateDigest, ...input } = certificate;
  try {
    return createPurgeCertificate(input).certificateDigest === certificateDigest;
  } catch {
    return false;
  }
}

export const ATTACHMENT_FIELD_CLASSIFICATION = Object.freeze({
  canonical: Object.freeze(['id', 'namespaceFingerprint', 'generationId', 'canonicalReferenceIds',
    'verifiedChecksum', 'verifiedByteSize', 'verifiedMimeType', 'tombstone',
    'createdSourceRevision', 'lastMutatedSourceRevision', 'deletedSourceRevision']),
  promotedCanonical: Object.freeze(['localBlobKey', 'remoteBlobKey', 'remoteProvider', 'remoteFileId']),
  operational: Object.freeze(['remoteVerification', 'remoteSyncedAt', 'remoteUpdatedAt', 'syncStatus',
    'remoteSyncStatus', 'transferStatus', 'retryCount', 'lease', 'cacheState', 'operationalUpdatedAt']),
  derivedObservation: Object.freeze(['localAvailability', 'remoteAvailability']),
  transientSecret: Object.freeze(['resumableUploadUri', 'signedUrl', 'accessToken']),
  prohibited: Object.freeze(['temporaryUploadLocator', 'temporaryDownloadLocator', 'providerCredential']),
});

export type BootstrapRecord = Readonly<{ key: string; valueDigest: string }>;
export type BootstrapSegment = Readonly<{
  kind: 'absinthe_bootstrap_segment'; version: 1; sessionId: string; category: string;
  segmentIndex: number; previousSegmentDigest: string | null; previousLastKey: string | null;
  firstKey: string; lastKey: string; recordCount: number; canonicalByteCount: number;
  recordRoot: string; continuationStartDigest: string; continuationEndDigest: string;
  baselineDigest: string; endOfCategory: boolean; segmentDigest: string;
}>;

function bootstrapSegmentDigest(segment: Omit<BootstrapSegment, 'segmentDigest'>): string {
  return sha256Hex(K331E_DOMAINS.bootstrapSegment, [segment.sessionId, segment.category,
    segment.segmentIndex, segment.previousSegmentDigest, segment.previousLastKey,
    segment.firstKey, segment.lastKey, segment.recordCount, segment.canonicalByteCount,
    segment.recordRoot, segment.continuationStartDigest, segment.continuationEndDigest,
    segment.baselineDigest, segment.endOfCategory]);
}

export function createBootstrapSegment(input: Readonly<{
  sessionId: string; category: string; segmentIndex: number; previousSegmentDigest: string | null;
  previousLastKey: string | null; continuationStartDigest: string; continuationEndDigest: string;
  baselineDigest: string; records: readonly BootstrapRecord[]; endOfCategory: boolean;
}>): BootstrapSegment | 'BOOTSTRAP_RECORD_TOO_LARGE' | 'BOOTSTRAP_SEGMENT_PATH_INVALID' {
  if (input.records.length < 1 || input.records.length > K331E_LIMITS.maxBootstrapRecordsPerSegment) {
    return 'BOOTSTRAP_SEGMENT_PATH_INVALID';
  }
  const ordered = [...input.records].sort((left, right) => left.key < right.key ? -1 : left.key > right.key ? 1 : 0);
  if (ordered.some((record, index) => record.key !== input.records[index].key
    || index > 0 && record.key === ordered[index - 1].key
    || !isCanonicalDigest(record.valueDigest))) return 'BOOTSTRAP_SEGMENT_PATH_INVALID';
  const recordBytes = ordered.map(record => canonicalBytes(K331E_DOMAINS.bootstrapRecord,
    [record.key, record.valueDigest]).byteLength);
  if (recordBytes.some(bytes => bytes > K331E_LIMITS.maxBootstrapSegmentBytes)
    || recordBytes.reduce((sum, bytes) => sum + bytes, 0) > K331E_LIMITS.maxBootstrapSegmentBytes) {
    return 'BOOTSTRAP_RECORD_TOO_LARGE';
  }
  const leaves = ordered.map(record => sha256Hex(K331E_DOMAINS.bootstrapRecord, [record.key, record.valueDigest]));
  const withoutDigest = Object.freeze({ kind: 'absinthe_bootstrap_segment' as const, version: 1 as const,
    sessionId: input.sessionId, category: input.category, segmentIndex: input.segmentIndex,
    previousSegmentDigest: input.previousSegmentDigest, previousLastKey: input.previousLastKey,
    firstKey: ordered[0].key, lastKey: ordered[ordered.length - 1].key, recordCount: ordered.length,
    canonicalByteCount: recordBytes.reduce((sum, bytes) => sum + bytes, 0),
    recordRoot: segmentMerkleRoot(leaves), continuationStartDigest: input.continuationStartDigest,
    continuationEndDigest: input.continuationEndDigest, baselineDigest: input.baselineDigest,
    endOfCategory: input.endOfCategory });
  return Object.freeze({ ...withoutDigest, segmentDigest: bootstrapSegmentDigest(withoutDigest) });
}

export type BootstrapCategoryAccumulator = Readonly<{
  kind: 'absinthe_bootstrap_category_accumulator'; version: 1; sessionId: string; category: string;
  segmentCount: number; totalRecordCount: number; totalCanonicalBytes: number;
  firstKey: string | null; lastKey: string | null; lastSegmentDigest: string | null;
  continuationEndDigest: string; categoryMmr: MmrState; endOfCategory: boolean; accumulatorDigest: string;
}>;

function categoryAccumulatorDigest(state: Omit<BootstrapCategoryAccumulator, 'accumulatorDigest'>): string {
  return sha256Hex(K331E_DOMAINS.bootstrapCategory, [state.sessionId, state.category,
    state.segmentCount, state.totalRecordCount, state.totalCanonicalBytes, state.firstKey,
    state.lastKey, state.lastSegmentDigest, state.continuationEndDigest,
    state.categoryMmr.stateDigest, state.endOfCategory]);
}

export function emptyBootstrapCategory(sessionId: string, category: string, startDigest: string): BootstrapCategoryAccumulator {
  const withoutDigest = Object.freeze({ kind: 'absinthe_bootstrap_category_accumulator' as const,
    version: 1 as const, sessionId, category, segmentCount: 0, totalRecordCount: 0,
    totalCanonicalBytes: 0, firstKey: null, lastKey: null, lastSegmentDigest: null,
    continuationEndDigest: startDigest, categoryMmr: emptyMmrState(), endOfCategory: false });
  return Object.freeze({ ...withoutDigest, accumulatorDigest: categoryAccumulatorDigest(withoutDigest) });
}

function syntheticCheckpointForDigest(index: number, digest: string, previous: string | null): SegmentCheckpoint {
  const withoutDigest = Object.freeze({ kind: 'absinthe_segment_checkpoint' as const, version: 1 as const,
    namespaceFingerprint: 'accumulator', generationId: 'accumulator', segmentIndex: index,
    firstRevision: String(index * 64 + 1), lastRevision: String(index * 64 + 1), receiptCount: 1,
    segmentRoot: digest, endAuthorityDigest: digest, previousCheckpointDigest: previous });
  return Object.freeze({ ...withoutDigest,
    checkpointDigest: sha256Hex(K331E_DOMAINS.segmentCheckpoint, checkpointFields(withoutDigest)) });
}

export function appendBootstrapSegment(
  state: BootstrapCategoryAccumulator, segment: BootstrapSegment,
): BootstrapCategoryAccumulator | 'BOOTSTRAP_SEGMENT_PATH_INVALID' | 'BOOTSTRAP_SEGMENT_RANGE_GAP'
  | 'BOOTSTRAP_SEGMENT_RANGE_OVERLAP' | 'BOOTSTRAP_CATEGORY_ACCUMULATOR_MISMATCH' {
  if (state.endOfCategory || segment.sessionId !== state.sessionId || segment.category !== state.category
    || segment.segmentIndex !== state.segmentCount || segment.previousSegmentDigest !== state.lastSegmentDigest
    || segment.segmentDigest !== bootstrapSegmentDigest(({ ...segment,
      segmentDigest: undefined } as unknown) as Omit<BootstrapSegment, 'segmentDigest'>)) {
    return 'BOOTSTRAP_SEGMENT_PATH_INVALID';
  }
  if (segment.continuationStartDigest !== state.continuationEndDigest) return 'BOOTSTRAP_SEGMENT_RANGE_GAP';
  if (state.lastKey !== null && segment.previousLastKey !== state.lastKey) return 'BOOTSTRAP_SEGMENT_RANGE_GAP';
  if (state.lastKey !== null && segment.firstKey <= state.lastKey) return 'BOOTSTRAP_SEGMENT_RANGE_OVERLAP';
  const categoryMmr = appendMmrCheckpoint(state.categoryMmr,
    syntheticCheckpointForDigest(segment.segmentIndex, segment.segmentDigest, state.lastSegmentDigest));
  const withoutDigest = Object.freeze({ ...state, segmentCount: state.segmentCount + 1,
    totalRecordCount: state.totalRecordCount + segment.recordCount,
    totalCanonicalBytes: state.totalCanonicalBytes + segment.canonicalByteCount,
    firstKey: state.firstKey ?? segment.firstKey, lastKey: segment.lastKey,
    lastSegmentDigest: segment.segmentDigest, continuationEndDigest: segment.continuationEndDigest,
    categoryMmr, endOfCategory: segment.endOfCategory });
  return Object.freeze({ ...withoutDigest, accumulatorDigest: categoryAccumulatorDigest(withoutDigest) });
}

export function finalizeBootstrapFromAccumulators(input: Readonly<{
  sessionId: string; namespaceFingerprint: string; generationId: string; baselineDigest: string;
  sourceAuthorityAbsent: boolean; quiescent: boolean; categories: readonly BootstrapCategoryAccumulator[];
}>): Readonly<{ ok: true; revision: '0'; authorityDigest: string; accumulatorReads: number }>
  | Readonly<{ ok: false; code: string }> {
  if (!input.sourceAuthorityAbsent) return { ok: false, code: 'BOOTSTRAP_FINALIZATION_STATE_CHANGED' };
  if (!input.quiescent) return { ok: false, code: 'BOOTSTRAP_NOT_QUIESCENT' };
  const required = ['attachments', 'checkpoints', 'entities', 'outbox', 'relations'];
  const ordered = [...input.categories].sort((left, right) => left.category < right.category ? -1 : 1);
  if (ordered.length !== required.length || ordered.some((category, index) => category.category !== required[index]
    || category.sessionId !== input.sessionId || !category.endOfCategory
    || category.accumulatorDigest !== categoryAccumulatorDigest(({ ...category, accumulatorDigest: undefined } as unknown) as Omit<BootstrapCategoryAccumulator, 'accumulatorDigest'>))) {
    return { ok: false, code: 'BOOTSTRAP_CATEGORY_ACCUMULATOR_MISMATCH' };
  }
  const authorityDigest = sha256Hex(K331E_DOMAINS.bootstrapFinal,
    [input.sessionId, input.namespaceFingerprint, input.generationId, input.baselineDigest,
      ordered.map(category => [category.category, category.accumulatorDigest, category.segmentCount,
        category.totalRecordCount, category.totalCanonicalBytes])]);
  return { ok: true, revision: '0', authorityDigest, accumulatorReads: ordered.length };
}

export type SourceAuthorityProjection = Readonly<{
  revision: string; restoreAuthorityDigest: string; completeAuthorityDigest: string;
  entityCount: number; entityRoot: string;
  attachmentCount: number; attachmentRoot: string; outboxCount: number; outboxRoot: string;
  checkpointCount: number; checkpointRoot: string; coordinationEpoch: number;
  quiescenceDigest: string; protocolVersion: 1; implementationId: string;
}>;

export function sourceAuthorityProjectionDigest(
  authority: Omit<SourceAuthorityProjection, 'completeAuthorityDigest'>,
): string {
  return sha256Hex('ABSINTHE_COMPLETE_SOURCE_AUTHORITY_V1', [authority.revision,
    authority.restoreAuthorityDigest, authority.entityCount, authority.entityRoot,
    authority.attachmentCount, authority.attachmentRoot, authority.outboxCount,
    authority.outboxRoot, authority.checkpointCount, authority.checkpointRoot,
    authority.coordinationEpoch, authority.quiescenceDigest, authority.protocolVersion,
    authority.implementationId]);
}

export type RestoreAccumulator = Readonly<{
  kind: 'absinthe_restore_accumulator'; version: 1; sessionId: string; planDigest: string;
  committedChunkCount: number; lastChunkIndex: number; baseRevision: string; finalRevision: string;
  authorityDigest: string; segmentMmr: MmrState; openChunkDigests: readonly string[];
  openSegmentRoot: string | null; lastSealedSegmentDigest: string | null;
  lastChunkDigest: string | null; accumulatorDigest: string;
}>;

function restoreAccumulatorDigest(state: Omit<RestoreAccumulator, 'accumulatorDigest'>): string {
  return sha256Hex(K331E_DOMAINS.restoreAccumulator, [state.sessionId, state.planDigest,
    state.committedChunkCount, state.lastChunkIndex, state.baseRevision, state.finalRevision,
    state.authorityDigest, state.segmentMmr.stateDigest, state.openChunkDigests.length,
    state.openSegmentRoot, state.lastSealedSegmentDigest, state.lastChunkDigest]);
}

export function emptyRestoreAccumulator(
  sessionId: string, planDigest: string, baseRevision: string, authorityDigest: string,
): RestoreAccumulator {
  const withoutDigest = Object.freeze({ kind: 'absinthe_restore_accumulator' as const, version: 1 as const,
    sessionId, planDigest, committedChunkCount: 0, lastChunkIndex: -1, baseRevision,
    finalRevision: baseRevision, authorityDigest, segmentMmr: emptyMmrState(),
    openChunkDigests: Object.freeze([]), openSegmentRoot: null,
    lastSealedSegmentDigest: null, lastChunkDigest: null });
  return Object.freeze({ ...withoutDigest, accumulatorDigest: restoreAccumulatorDigest(withoutDigest) });
}

export function appendRestoreChunk(
  state: RestoreAccumulator, chunkIndex: number, inputDigest: string,
): RestoreAccumulator | 'RESTORE_ACCUMULATOR_MISMATCH' | 'RESTORE_CHUNK_PROOF_INVALID' {
  const previous = decodeRevision(state.finalRevision);
  if (!previous.ok || state.accumulatorDigest !== restoreAccumulatorDigest(({ ...state,
    accumulatorDigest: undefined } as unknown) as Omit<RestoreAccumulator, 'accumulatorDigest'>)) {
    return 'RESTORE_ACCUMULATOR_MISMATCH';
  }
  if (chunkIndex !== state.committedChunkCount) return 'RESTORE_CHUNK_PROOF_INVALID';
  const revision = (previous.value + 1n).toString(10);
  const chunkDigest = sha256Hex(K331E_DOMAINS.restoreChunk,
    [state.sessionId, state.planDigest, chunkIndex, state.lastChunkDigest, state.finalRevision,
      revision, inputDigest, state.authorityDigest]);
  const appendedOpen = Object.freeze([...state.openChunkDigests, chunkDigest]);
  if (appendedOpen.length > K331E_LIMITS.maxRestoreChunksPerSegment) {
    return 'RESTORE_ACCUMULATOR_MISMATCH';
  }
  const openSegmentRoot = segmentMerkleRoot(appendedOpen);
  let segmentMmr = state.segmentMmr;
  let openChunkDigests: readonly string[] = appendedOpen;
  let nextOpenSegmentRoot: string | null = openSegmentRoot;
  let lastSealedSegmentDigest = state.lastSealedSegmentDigest;
  if (appendedOpen.length === K331E_LIMITS.maxRestoreChunksPerSegment) {
    const restoreSegmentDigest = sha256Hex(K331E_DOMAINS.restoreSegment,
      [state.sessionId, state.planDigest, state.segmentMmr.leafCount,
        K331E_LIMITS.maxRestoreChunksPerSegment, openSegmentRoot, state.lastSealedSegmentDigest]);
    const checkpoint = syntheticCheckpointForDigest(state.segmentMmr.leafCount, restoreSegmentDigest,
      state.lastSealedSegmentDigest);
    segmentMmr = appendMmrCheckpoint(state.segmentMmr, checkpoint);
    lastSealedSegmentDigest = checkpoint.checkpointDigest;
    openChunkDigests = Object.freeze([]);
    nextOpenSegmentRoot = null;
  }
  const authorityDigest = sha256Hex('ABSINTHE_RESTORE_AUTHORITY_AFTER_CHUNK_V1',
    [state.authorityDigest, revision, chunkDigest]);
  const withoutDigest = Object.freeze({ ...state, committedChunkCount: state.committedChunkCount + 1,
    lastChunkIndex: chunkIndex, finalRevision: revision, authorityDigest, segmentMmr,
    openChunkDigests, openSegmentRoot: nextOpenSegmentRoot, lastSealedSegmentDigest,
    lastChunkDigest: chunkDigest });
  return Object.freeze({ ...withoutDigest, accumulatorDigest: restoreAccumulatorDigest(withoutDigest) });
}

export type RestoreFinalManifest = Readonly<{
  kind: 'absinthe_restore_final_manifest'; version: 1; sessionId: string; planDigest: string;
  committedChunkCount: number; finalRevision: string; restoreAccumulatorDigest: string;
  restoreMmrRoot: string; completeAuthorityDigest: string; entityCount: number; entityRoot: string;
  attachmentCount: number; attachmentRoot: string; outboxCount: number; outboxRoot: string;
  checkpointCount: number; checkpointRoot: string; coordinationEpoch: number;
  quiescenceDigest: string; protocolVersion: 1; implementationId: string; manifestDigest: string;
}>;

function restoreManifestFields(manifest: Omit<RestoreFinalManifest, 'manifestDigest'>): readonly CanonicalValue[] {
  return [manifest.sessionId, manifest.planDigest, manifest.committedChunkCount, manifest.finalRevision,
    manifest.restoreAccumulatorDigest, manifest.restoreMmrRoot, manifest.completeAuthorityDigest,
    manifest.entityCount, manifest.entityRoot, manifest.attachmentCount, manifest.attachmentRoot,
    manifest.outboxCount, manifest.outboxRoot, manifest.checkpointCount, manifest.checkpointRoot,
    manifest.coordinationEpoch, manifest.quiescenceDigest, manifest.protocolVersion,
    manifest.implementationId];
}

export function finalizeRestoreBounded(input: Readonly<{
  sessionId: string; planDigest: string; accumulator: RestoreAccumulator;
  sourceAuthority: SourceAuthorityProjection; quiescent: boolean;
  existingManifest: RestoreFinalManifest | null;
}>): Readonly<{ ok: true; manifest: RestoreFinalManifest; accumulatorReads: 1; reused: boolean }>
  | Readonly<{ ok: false; code: string }> {
  const accumulator = input.accumulator;
  if (accumulator.sessionId !== input.sessionId || accumulator.planDigest !== input.planDigest
    || accumulator.accumulatorDigest !== restoreAccumulatorDigest(({ ...accumulator,
      accumulatorDigest: undefined } as unknown) as Omit<RestoreAccumulator, 'accumulatorDigest'>)) {
    return { ok: false, code: 'RESTORE_ACCUMULATOR_MISMATCH' };
  }
  if (!input.quiescent) return { ok: false, code: 'RESTORE_FINALIZATION_NOT_QUIESCENT' };
  if (input.sourceAuthority.revision !== accumulator.finalRevision
    || input.sourceAuthority.restoreAuthorityDigest !== accumulator.authorityDigest
    || input.sourceAuthority.completeAuthorityDigest !== sourceAuthorityProjectionDigest(
      ({ ...input.sourceAuthority,
        completeAuthorityDigest: undefined } as unknown) as Omit<SourceAuthorityProjection, 'completeAuthorityDigest'>)) {
    return { ok: false, code: 'RESTORE_FINALIZATION_AUTHORITY_MISMATCH' };
  }
  const withoutDigest = Object.freeze({ kind: 'absinthe_restore_final_manifest' as const, version: 1 as const,
    sessionId: input.sessionId, planDigest: input.planDigest,
    committedChunkCount: accumulator.committedChunkCount, finalRevision: accumulator.finalRevision,
    restoreAccumulatorDigest: accumulator.accumulatorDigest,
    restoreMmrRoot: sha256Hex(K331E_DOMAINS.restoreSegment,
      [accumulator.segmentMmr.root, accumulator.openChunkDigests.length, accumulator.openSegmentRoot]),
    completeAuthorityDigest: input.sourceAuthority.completeAuthorityDigest,
    entityCount: input.sourceAuthority.entityCount, entityRoot: input.sourceAuthority.entityRoot,
    attachmentCount: input.sourceAuthority.attachmentCount,
    attachmentRoot: input.sourceAuthority.attachmentRoot,
    outboxCount: input.sourceAuthority.outboxCount, outboxRoot: input.sourceAuthority.outboxRoot,
    checkpointCount: input.sourceAuthority.checkpointCount,
    checkpointRoot: input.sourceAuthority.checkpointRoot,
    coordinationEpoch: input.sourceAuthority.coordinationEpoch,
    quiescenceDigest: input.sourceAuthority.quiescenceDigest,
    protocolVersion: input.sourceAuthority.protocolVersion,
    implementationId: input.sourceAuthority.implementationId });
  const manifest = Object.freeze({ ...withoutDigest,
    manifestDigest: sha256Hex(K331E_DOMAINS.restoreManifest, restoreManifestFields(withoutDigest)) });
  if (input.existingManifest) return JSON.stringify(input.existingManifest) === JSON.stringify(manifest)
    ? { ok: true, manifest: input.existingManifest, accumulatorReads: 1, reused: true }
    : { ok: false, code: 'RESTORE_FINALIZATION_AUTHORITY_MISMATCH' };
  return { ok: true, manifest, accumulatorReads: 1, reused: false };
}

export const PERSISTED_REVISION_RECORDS = Object.freeze({
  source_authority: ['revision'], raw_source_receipt: ['previousSourceRevision', 'committedSourceRevision'],
  open_segment_metadata: ['firstRevision', 'lastRevision'],
  segment_checkpoint: ['firstRevision', 'lastRevision'], mmr_accumulator: ['lastCommittedRevision'],
  compacted_receipt_index: ['committedSourceRevision'],
  purge_certificate: ['priorTombstoneRevision', 'previousSourceRevision', 'committedPurgeRevision'],
  entity_revision_envelope: ['createdSourceRevision', 'lastMutatedSourceRevision', 'deletedSourceRevision'],
  folder_revision_envelope: ['createdSourceRevision', 'lastMutatedSourceRevision', 'deletedSourceRevision'],
  relation_revision_envelope: ['createdSourceRevision', 'lastMutatedSourceRevision', 'deletedSourceRevision'],
  attachment_revision_envelope: ['createdSourceRevision', 'lastMutatedSourceRevision', 'deletedSourceRevision'],
  bootstrap_session: ['baselineRevision'], bootstrap_segment: ['baselineRevision'],
  bootstrap_category_accumulator: ['baselineRevision'], restore_session: ['baseRevision', 'finalRevision'],
  restore_chunk_receipt: ['previousRevision', 'committedRevision'],
  restore_segment_checkpoint: ['firstRevision', 'lastRevision'],
  restore_accumulator: ['baseRevision', 'finalRevision'], restore_final_manifest: ['finalRevision'],
} as const);

export function decodePersistedRevisionRecord(
  kind: keyof typeof PERSISTED_REVISION_RECORDS, version: unknown, record: Readonly<Record<string, unknown>>,
): Readonly<{ ok: true; revisions: Readonly<Record<string, string>> }>
  | Readonly<{ ok: false; code: 'PROTOCOL_VERSION_UNSUPPORTED' | 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE' }> {
  if (version !== 1) return { ok: false, code: 'PROTOCOL_VERSION_UNSUPPORTED' };
  const revisions: Record<string, string> = {};
  for (const field of PERSISTED_REVISION_RECORDS[kind]) {
    if (record[field] === null && field === 'deletedSourceRevision') continue;
    const decoded = decodeRevision(record[field]);
    if (!decoded.ok) return { ok: false, code: 'SOURCE_REVISION_CORRUPT_PERSISTED_STATE' };
    revisions[field] = decoded.canonical;
  }
  return { ok: true, revisions: Object.freeze(revisions) };
}

export function versionsCompatible(versions: Readonly<Record<string, unknown>>): boolean {
  return Object.values(versions).every(version => version === 1);
}

export const K331E_STABLE_ERRORS = Object.freeze({
  LINEAGE_PROOF_TOO_LARGE: 'NON_RETRYABLE', LINEAGE_PROOF_NODE_LIMIT_EXCEEDED: 'NON_RETRYABLE',
  LINEAGE_PROOF_VERSION_UNSUPPORTED: 'OWNER_INTERVENTION', LINEAGE_COORDINATE_MISMATCH: 'CORRUPTION',
  LINEAGE_RECEIPT_DIGEST_MISMATCH: 'CORRUPTION', LINEAGE_SEGMENT_PATH_INVALID: 'CORRUPTION',
  LINEAGE_SEGMENT_CHECKPOINT_CONFLICT: 'OWNER_INTERVENTION', LINEAGE_MMR_PATH_INVALID: 'CORRUPTION',
  LINEAGE_MMR_AUTHORITY_MISMATCH: 'OWNER_INTERVENTION', LINEAGE_APPEND_SEAL_CONFLICT: 'RESTART_REQUIRED',
  LINEAGE_COMPACTION_REFERENCE_ACTIVE: 'RETRYABLE', LINEAGE_COMPACTION_INDEX_CONFLICT: 'OWNER_INTERVENTION',
  LINEAGE_UNRESOLVED_RECEIPT_NOT_COMPACTABLE: 'RETRYABLE',
  BOOTSTRAP_RECORD_TOO_LARGE: 'OWNER_INTERVENTION', BOOTSTRAP_SEGMENT_PATH_INVALID: 'CORRUPTION',
  BOOTSTRAP_SEGMENT_RANGE_GAP: 'RESTART_REQUIRED', BOOTSTRAP_SEGMENT_RANGE_OVERLAP: 'CORRUPTION',
  BOOTSTRAP_CATEGORY_ACCUMULATOR_MISMATCH: 'OWNER_INTERVENTION',
  BOOTSTRAP_FINALIZATION_STATE_CHANGED: 'RESTART_REQUIRED', RESTORE_CHUNK_PROOF_INVALID: 'CORRUPTION',
  RESTORE_ACCUMULATOR_MISMATCH: 'OWNER_INTERVENTION',
  RESTORE_FINALIZATION_AUTHORITY_MISMATCH: 'OWNER_INTERVENTION',
  RESTORE_FINALIZATION_NOT_QUIESCENT: 'RETRYABLE',
  SOURCE_REVISION_CORRUPT_PERSISTED_STATE: 'OWNER_INTERVENTION',
  PROTOCOL_VERSION_UNSUPPORTED: 'OWNER_INTERVENTION', MIXED_PROTOCOL_VERSION_EVIDENCE: 'OWNER_INTERVENTION',
});
