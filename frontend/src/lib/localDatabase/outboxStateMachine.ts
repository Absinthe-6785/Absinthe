import { LocalDatabaseError } from './errors';
import type { OutboxRecord } from './types';

function timestamp(value: string, operation: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
  return parsed;
}

function requireClaimOwner(record: OutboxRecord, ownerId: string, operation: string): void {
  if (record.status !== 'claimed') throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
  if (record.leaseOwner !== ownerId) throw new LocalDatabaseError('LEASE_OWNER_MISMATCH', operation);
}

export function calculateRetryAvailableAt(input: {
  now: string;
  attemptCount: number;
  baseDelayMs: number;
  maxDelayMs: number;
}): string {
  const operation = 'calculate_retry';
  if (!Number.isSafeInteger(input.attemptCount) || input.attemptCount < 1
    || !Number.isSafeInteger(input.baseDelayMs) || input.baseDelayMs < 1
    || !Number.isSafeInteger(input.maxDelayMs) || input.maxDelayMs < input.baseDelayMs
    || input.maxDelayMs > 2_592_000_000) {
    throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', operation);
  }
  const exponent = Math.min(input.attemptCount - 1, 52);
  return new Date(timestamp(input.now, operation) + Math.min(input.maxDelayMs, input.baseDelayMs * (2 ** exponent))).toISOString();
}

export function claimOutboxRecord(record: OutboxRecord, input: {
  ownerId: string;
  now: string;
  leaseDurationMs: number;
  allowExpiredClaim?: boolean;
}): OutboxRecord {
  const at = timestamp(input.now, 'claim_outbox');
  if (!Number.isSafeInteger(input.leaseDurationMs) || input.leaseDurationMs < 1 || input.leaseDurationMs > 86_400_000) {
    throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'claim_outbox');
  }
  const available = (record.status === 'pending' || record.status === 'retry_wait') && timestamp(record.availableAt, 'claim_outbox') <= at;
  const expired = input.allowExpiredClaim === true && record.status === 'claimed'
    && record.leaseExpiresAt !== null && timestamp(record.leaseExpiresAt, 'claim_outbox') <= at;
  if (!available && !expired) throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'claim_outbox');
  return {
    ...record,
    status: 'claimed',
    updatedAt: input.now,
    attemptCount: record.attemptCount + 1,
    lastAttemptAt: input.now,
    lastErrorCode: null,
    leaseOwner: input.ownerId,
    leaseExpiresAt: new Date(at + input.leaseDurationMs).toISOString(),
  };
}

export function scheduleOutboxRetry(record: OutboxRecord, input: {
  ownerId: string;
  now: string;
  errorCode: string;
  baseDelayMs: number;
  maxDelayMs: number;
}): OutboxRecord {
  requireClaimOwner(record, input.ownerId, 'retry_outbox');
  return {
    ...record,
    status: 'retry_wait',
    updatedAt: input.now,
    availableAt: calculateRetryAvailableAt({ ...input, attemptCount: record.attemptCount }),
    lastErrorCode: input.errorCode,
    leaseOwner: null,
    leaseExpiresAt: null,
  };
}

export function acknowledgeOutboxRecord(record: OutboxRecord, input: {
  ownerId: string;
  now: string;
  remoteMutationRef: string | null;
  acknowledgedRevision: number | null;
  serverCommittedAt: string | null;
}): OutboxRecord {
  requireClaimOwner(record, input.ownerId, 'acknowledge_outbox');
  const acknowledgementMetadata = record.accountId === undefined ? {} : {
    acknowledgedRevision: input.acknowledgedRevision,
    serverCommittedAt: input.serverCommittedAt,
  };
  return {
    ...record,
    status: 'acknowledged',
    updatedAt: input.now,
    acknowledgedAt: input.now,
    acknowledgedBy: input.ownerId,
    remoteMutationRef: input.remoteMutationRef,
    ...acknowledgementMetadata,
    lastErrorCode: null,
    leaseOwner: null,
    leaseExpiresAt: null,
  };
}

export function conflictOutboxRecord(record: OutboxRecord, input: {
  ownerId: string;
  now: string;
  errorCode: string;
}): OutboxRecord {
  requireClaimOwner(record, input.ownerId, 'conflict_outbox');
  return { ...record, status: 'conflict', updatedAt: input.now, lastErrorCode: input.errorCode, leaseOwner: null, leaseExpiresAt: null };
}

export function permanentlyFailOutboxRecord(record: OutboxRecord, input: {
  ownerId: string;
  now: string;
  errorCode: string;
}): OutboxRecord {
  requireClaimOwner(record, input.ownerId, 'fail_outbox');
  return { ...record, status: 'permanent_failure', updatedAt: input.now, lastErrorCode: input.errorCode, leaseOwner: null, leaseExpiresAt: null };
}

export function canSupersedeOutboxRecord(older: OutboxRecord, newer: OutboxRecord): boolean {
  return older.namespaceKey === newer.namespaceKey
    && older.generationId === newer.generationId
    && older.domain === newer.domain
    && older.entityId === newer.entityId
    && older.status === 'pending'
    && newer.status === 'pending'
    && older.attemptCount === 0
    && newer.attemptCount === 0
    && newer.localRevision > older.localRevision;
}

export function supersedeOutboxRecord(older: OutboxRecord, newer: OutboxRecord, now: string): OutboxRecord {
  if (!canSupersedeOutboxRecord(older, newer)) {
    throw new LocalDatabaseError('INVALID_OUTBOX_TRANSITION', 'supersede_outbox');
  }
  return { ...older, status: 'superseded', updatedAt: now, supersededByMutationId: newer.mutationId };
}
