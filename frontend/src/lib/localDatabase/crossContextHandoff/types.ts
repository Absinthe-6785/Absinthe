export const HANDOFF_SCHEMA_VERSION = 1 as const;
export const HANDOFF_COORDINATOR_VERSION = 1 as const;

export const HANDOFF_LIMITS = Object.freeze({
  authorityPayloadBytes: 4_096,
  candidatePayloadBytes: 504_000,
  demonstratedCandidateHighWaterBytes: 503_794,
  transactionWriteBytes: 509_000,
  applicationReserveBytes: 3_904,
  aggregateSourceTupleBytes: 499_000,
  sourceRecordCount: 4_096,
  sourceRecordBytes: 131_072,
  sourceRecordIdBytes: 256,
  sourceRecordValueBytes: 20_000,
  jsonDepth: 64,
} as const);

export type HandoffErrorCode =
  | 'MALFORMED_PHYSICAL_SOURCE_IDENTITY'
  | 'UNSUPPORTED_PHYSICAL_SOURCE'
  | 'MALFORMED_LOGICAL_SCOPE'
  | 'WEB_LOCKS_UNSUPPORTED'
  | 'LOCK_ABORTED'
  | 'LOCK_ACQUISITION_FAILED'
  | 'LOCK_OPERATION_FAILED'
  | 'SOURCE_READ_FAILED'
  | 'SOURCE_MALFORMED'
  | 'SOURCE_RESOURCE_BOUND_EXCEEDED'
  | 'DATABASE_OPEN_FAILED'
  | 'DATABASE_OPEN_BLOCKED'
  | 'DATABASE_UPGRADE_FAILED'
  | 'DATABASE_SCHEMA_INVALID'
  | 'CANDIDATE_CORRUPT'
  | 'AUTHORITY_CORRUPT'
  | 'CANDIDATE_KEY_COLLISION'
  | 'PERSISTED_EVIDENCE_MISMATCH'
  | 'AUTHORITY_CAS_CONFLICT'
  | 'TRANSACTION_ABORTED'
  | 'TRANSACTION_FAILED'
  | 'RESTART_VALIDATION_FAILED'
  | 'RESOURCE_BOUND_EXCEEDED'
  | 'NONCANONICAL_PERSISTED_BYTES';

export class CrossContextHandoffError extends Error {
  readonly code: HandoffErrorCode;
  readonly operation: string;

  constructor(code: HandoffErrorCode, operation: string) {
    super(`${code}:${operation}`);
    this.name = 'CrossContextHandoffError';
    this.code = code;
    this.operation = operation;
  }
}
export interface PhysicalSourceIdentityV1 {
  readonly schemaVersion: 1;
  readonly origin: string;
  readonly sourceFamily: 'legacy_notes';
  readonly backend: 'combined_localstorage_indexeddb';
  readonly databaseName: 'absinthe-notes-v1';
  readonly objectStoreName: 'notes';
  readonly physicalSourceVersion: 1;
}

export interface DerivedPhysicalSourceIdentityV1 {
  readonly identity: PhysicalSourceIdentityV1;
  readonly canonicalBytes: string;
  readonly digest: string;
  readonly lockName: string;
}

export interface LogicalAuthorityScopeV1 {
  readonly schemaVersion: 1;
  readonly userId: string;
  readonly projectRef: string;
  readonly namespaceId: string;
  readonly deviceId: string;
}

export type AuthorityState =
  | 'writable'
  | 'handoff_pending'
  | 'snapshot_committed_pending_finalization'
  | 'read_only_handoff';

export interface PersistedHandoffAuthorityV1 {
  readonly recordType: 'absinthe_handoff_authority';
  readonly schemaVersion: 1;
  readonly coordinatorVersion: 1;
  readonly physicalSourceDigest: string;
  readonly logicalScope: LogicalAuthorityScopeV1;
  readonly logicalScopeDigest: string;
  readonly state: AuthorityState;
  readonly sourceRevision: number;
  readonly handoffSessionId: string | null;
  readonly snapshotCandidateId: string | null;
  readonly snapshotDigest: string | null;
  readonly rootDigest: string | null;
  readonly manifestDigest: string | null;
}

export type SourceEntry = readonly [id: string, value: string];

export interface PersistedSnapshotCandidateV1 {
  readonly recordType: 'absinthe_handoff_snapshot_candidate';
  readonly schemaVersion: 1;
  readonly coordinatorVersion: 1;
  readonly candidateId: string;
  readonly handoffSessionId: string;
  readonly physicalSourceDigest: string;
  readonly logicalScopeDigest: string;
  readonly sourceRevision: number;
  readonly snapshotDigest: string;
  readonly rootDigest: string;
  readonly manifestDigest: string;
  readonly entityCount: number;
  readonly records: readonly SourceEntry[];
}

export interface ReadOnlyHandoffSourceAdapter {
  readonly adapter: string;
  readonly isolatedForHandoff: true;
  readSnapshot(): Promise<{ readonly revision: number; readonly records: unknown }>;
}

export type HandoffEffect =
  | 'lock_request'
  | 'lock_acquired'
  | 'source_read'
  | 'database_open'
  | 'persistence_read'
  | 'transaction_start'
  | 'candidate_create_request'
  | 'candidate_committed_write'
  | 'authority_committed_write'
  | 'transaction_abort'
  | 'coordinator_attempt'
  | 'finalization_attempt'
  | 'digest_operation';

export interface HandoffObserver {
  onEffect?(effect: HandoffEffect): void;
}

export interface ValidatedHandoffEvidence {
  readonly authority: PersistedHandoffAuthorityV1;
  readonly candidate: PersistedSnapshotCandidateV1;
  readonly authorityBytes: Uint8Array;
  readonly candidateBytes: Uint8Array;
}
