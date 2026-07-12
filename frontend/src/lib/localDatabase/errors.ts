export type LocalDatabaseErrorCode =
  | 'CAPABILITY_REQUIRED' | 'INVALID_NAMESPACE' | 'UNSAFE_NAMESPACE'
  | 'OPEN_FAILED' | 'OPEN_BLOCKED' | 'UNSUPPORTED_SCHEMA_VERSION'
  | 'DATABASE_CLOSED' | 'STALE_CONNECTION' | 'MALFORMED_METADATA'
  | 'NAMESPACE_MISMATCH' | 'GENERATION_NOT_FOUND' | 'GENERATION_NOT_ACTIVE'
  | 'STALE_GENERATION' | 'INVALID_GENERATION_TRANSITION'
  | 'ENTITY_NOT_FOUND' | 'ENTITY_ALREADY_EXISTS' | 'EXPECTED_REVISION_REQUIRED'
  | 'STALE_REVISION' | 'TOMBSTONE_REACTIVATION_BLOCKED' | 'CORRUPT_PERSISTED_RECORD'
  | 'INVALID_ENTITY' | 'INVALID_OUTBOX' | 'INVALID_RESERVED_RECORD'
  | 'OUTBOX_NOT_FOUND' | 'INVALID_OUTBOX_TRANSITION' | 'LEASE_OWNER_MISMATCH'
  | 'INVALID_OUTBOX_QUERY' | 'OUTBOX_SEQUENCE_GAP' | 'OUTBOX_IDEMPOTENCY_MISMATCH'
  | 'TRANSACTION_ABORTED' | 'TRANSACTION_FAILED';

export class LocalDatabaseError extends Error {
  readonly code: LocalDatabaseErrorCode;
  readonly operation: string;

  constructor(code: LocalDatabaseErrorCode, operation: string) {
    super(`${code}:${operation}`);
    this.name = 'LocalDatabaseError';
    this.code = code;
    this.operation = operation;
  }
}

export function localDatabaseError(error: unknown, operation: string): LocalDatabaseError {
  if (error instanceof LocalDatabaseError) return error;
  if (error instanceof DOMException && error.name === 'VersionError') {
    return new LocalDatabaseError('UNSUPPORTED_SCHEMA_VERSION', operation);
  }
  return new LocalDatabaseError('TRANSACTION_FAILED', operation);
}
