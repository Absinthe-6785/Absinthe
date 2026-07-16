import {
  openHandoffDatabase,
  persistEvidenceAtomic,
  persistAuthorityCas,
  readHandoffAuthority,
  readValidatedHandoffEvidence,
  type HandoffDatabaseOptions,
} from './database';
import { derivePhysicalSourceIdentity, validateLogicalScope } from './identity';
import { observe } from './observability';
import {
  buildPendingAuthority,
  buildTerminalEvidence,
  encodeAuthority,
  logicalScopeEquals,
  withAuthorityState,
} from './records';
import {
  CrossContextHandoffError,
  type HandoffObserver,
  type LogicalAuthorityScopeV1,
  type PhysicalSourceIdentityV1,
  type ReadOnlyHandoffSourceAdapter,
  type ValidatedHandoffEvidence,
} from './types';
import { withPhysicalSourceLock, type ExclusiveLockAdapter } from './webLocks';

export interface RunCrossContextReadOnlyHandoffInput {
  physicalSource: PhysicalSourceIdentityV1;
  logicalScope: LogicalAuthorityScopeV1;
  source: ReadOnlyHandoffSourceAdapter;
  locks?: ExclusiveLockAdapter | null;
  indexedDB?: IDBFactory;
  databaseName?: string;
  signal?: AbortSignal;
  observer?: HandoffObserver;
}

export interface ReadOnlyHandoffResult {
  readonly status: 'created' | 'existing_identical';
  readonly physicalSourceDigest: string;
  readonly candidateId: string;
  readonly sessionId: string;
  readonly sourceRevision: number;
  readonly entityCount: number;
}

function databaseOptions(input: Pick<RunCrossContextReadOnlyHandoffInput, 'indexedDB' | 'databaseName' | 'observer'>): HandoffDatabaseOptions {
  return {
    ...(input.indexedDB ? { indexedDB: input.indexedDB } : {}),
    ...(input.databaseName ? { databaseName: input.databaseName } : {}),
    ...(input.observer ? { observer: input.observer } : {}),
  };
}

export async function runCrossContextReadOnlyHandoff(
  input: RunCrossContextReadOnlyHandoffInput,
): Promise<ReadOnlyHandoffResult> {
  if (!input.source || input.source.isolatedForHandoff !== true
    || typeof input.source.readSnapshot !== 'function'
    || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(input.source.adapter)) {
    throw new CrossContextHandoffError('SOURCE_MALFORMED', 'validate_source_adapter');
  }
  const physicalSource = await derivePhysicalSourceIdentity(input.physicalSource);
  const logicalScope = validateLogicalScope(input.logicalScope);
  const outcome = await withPhysicalSourceLock({
    physicalSource,
    locks: input.locks,
    signal: input.signal,
    observer: input.observer,
    operation: async () => {
      const db = await openHandoffDatabase(databaseOptions(input));
      try {
        let current = await readHandoffAuthority(db, physicalSource.digest, input.observer);
        if (current?.authority.state === 'read_only_handoff') {
          const existing = await readValidatedHandoffEvidence(db, physicalSource.digest, input.observer);
          if (existing === null || !logicalScopeEquals(existing.authority.logicalScope, logicalScope)) {
            throw new CrossContextHandoffError('AUTHORITY_CAS_CONFLICT', 'terminal_authority_scope');
          }
          return Object.freeze({
            status: 'existing_identical' as const,
            physicalSourceDigest: physicalSource.digest,
            candidateId: existing.candidate.candidateId,
            sessionId: existing.candidate.handoffSessionId,
            sourceRevision: existing.candidate.sourceRevision,
            entityCount: existing.candidate.entityCount,
          });
        }
        if (current?.authority.state === 'snapshot_committed_pending_finalization') {
          const existing = await readValidatedHandoffEvidence(db, physicalSource.digest, input.observer);
          if (existing === null || !logicalScopeEquals(existing.authority.logicalScope, logicalScope)) {
            throw new CrossContextHandoffError('AUTHORITY_CAS_CONFLICT', 'pending_finalization_scope');
          }
          const terminal = withAuthorityState(existing.authority, 'read_only_handoff');
          observe(input.observer, 'finalization_attempt');
          await persistAuthorityCas({
            db, authority: terminal, expectedAuthorityBytes: current.bytes, observer: input.observer,
          });
          return Object.freeze({
            status: 'created' as const,
            physicalSourceDigest: physicalSource.digest,
            candidateId: existing.candidate.candidateId,
            sessionId: existing.candidate.handoffSessionId,
            sourceRevision: existing.candidate.sourceRevision,
            entityCount: existing.candidate.entityCount,
          });
        }
        if (current?.authority.state === 'writable') {
          throw new CrossContextHandoffError('RESTART_VALIDATION_FAILED', 'unsupported_writable_authority');
        }

        const readSource = async (): Promise<{ readonly revision: number; readonly records: unknown }> => {
          observe(input.observer, 'source_read');
          try { return await input.source.readSnapshot(); } catch (error) {
            if (error instanceof CrossContextHandoffError) throw error;
            throw new CrossContextHandoffError('SOURCE_READ_FAILED', 'read_source_snapshot');
          }
        };

        if (current === null) {
          const preflight = await readSource();
          observe(input.observer, 'digest_operation');
          const pending = await buildPendingAuthority({
            physicalSourceDigest: physicalSource.digest,
            logicalScope,
            sourceRevision: preflight.revision,
          });
          await persistAuthorityCas({ db, authority: pending, expectedAuthorityBytes: null, observer: input.observer });
          current = { authority: pending, bytes: encodeAuthority(pending) };
        } else if (!logicalScopeEquals(current.authority.logicalScope, logicalScope)) {
          throw new CrossContextHandoffError('AUTHORITY_CAS_CONFLICT', 'pending_authority_scope');
        }

        const snapshot = await readSource();
        if (snapshot.revision !== current.authority.sourceRevision) {
          throw new CrossContextHandoffError('SOURCE_READ_FAILED', 'source_revision_changed');
        }
        observe(input.observer, 'digest_operation');
        const graph = await buildTerminalEvidence({
          physicalSourceDigest: physicalSource.digest,
          logicalScope,
          sourceRevision: snapshot.revision,
          records: snapshot.records,
        });
        const snapshotAuthority = withAuthorityState(
          graph.authority,
          'snapshot_committed_pending_finalization',
        );
        observe(input.observer, 'finalization_attempt');
        const status = await persistEvidenceAtomic({
          db,
          authority: snapshotAuthority,
          candidate: graph.candidate,
          expectedAuthorityBytes: current.bytes,
          observer: input.observer,
        });
        await persistAuthorityCas({
          db,
          authority: graph.authority,
          expectedAuthorityBytes: encodeAuthority(snapshotAuthority),
          observer: input.observer,
        });
        return Object.freeze({
          status,
          physicalSourceDigest: physicalSource.digest,
          candidateId: graph.candidate.candidateId,
          sessionId: graph.candidate.handoffSessionId,
          sourceRevision: graph.candidate.sourceRevision,
          entityCount: graph.candidate.entityCount,
        });
      } finally {
        db.close();
      }
    },
  });
  if (outcome.status === 'acquired') return outcome.value;
  if (outcome.status === 'unsupported') {
    throw new CrossContextHandoffError('WEB_LOCKS_UNSUPPORTED', 'run_read_only_handoff');
  }
  if (outcome.status === 'aborted') {
    throw new CrossContextHandoffError('LOCK_ABORTED', 'run_read_only_handoff');
  }
  if (outcome.status === 'lock_failed') {
    throw new CrossContextHandoffError('LOCK_ACQUISITION_FAILED', 'run_read_only_handoff');
  }
  throw outcome.error;
}

export async function validateCrossContextHandoffRestart(input: {
  physicalSource: PhysicalSourceIdentityV1;
  indexedDB?: IDBFactory;
  databaseName?: string;
  observer?: HandoffObserver;
}): Promise<ValidatedHandoffEvidence> {
  const physicalSource = await derivePhysicalSourceIdentity(input.physicalSource);
  const db = await openHandoffDatabase(databaseOptions(input));
  try {
    const evidence = await readValidatedHandoffEvidence(db, physicalSource.digest, input.observer);
    if (evidence === null) {
      throw new CrossContextHandoffError('RESTART_VALIDATION_FAILED', 'missing_authority');
    }
    return evidence;
  } finally {
    db.close();
  }
}
