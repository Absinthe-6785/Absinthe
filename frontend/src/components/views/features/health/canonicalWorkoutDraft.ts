import {
  deriveOutboxIdempotencyKey, deriveOutboxMutationId, hashCanonicalPayload, sha256Hex,
  type LocalDatabaseRepository,
} from '../../../../lib/localDatabase';
import { validTimestamp } from '../../../../lib/localDatabase/validation';
import { LocalDatabaseError } from '../../../../lib/localDatabase/errors';
import { canonicalWorkoutUuid, WORKOUT_WIRE_UUID } from '../../../../lib/workoutRemoteContract';
import { WORKOUT_SESSION_DOMAIN } from '../../../../lib/workoutSessionRepository';
import { WORKOUT_PULL_PROVIDER } from '../../../../lib/workoutRemotePullProtocol';
import { validateWorkoutSessionV1, type WorkoutSessionV1 } from '../../../../lib/workoutSessionV1';
import {
  hydrateWorkoutSessionEditor, projectWorkoutSessionEditor, snapshotWorkoutSessionEditorDraft, type WorkoutSessionEditor,
} from './workoutSessionEditorAdapter';

export type CanonicalWorkoutDraftScope = Readonly<{
  accountId: string;
  namespaceKey: string;
  generationId: string;
  localDate: string;
}>;

type Submission = Readonly<{ status: 'uncertain'; entityId: string; payloadHash: string; mutationId: string }>;
type Draft = {
  version: 1;
  changeId: string;
  scope: CanonicalWorkoutDraftScope;
  editor: WorkoutSessionEditor;
  submission: Submission | null;
};

type DraftSnapshot = { token: string; editor: WorkoutSessionEditor };
type DraftDelivery =
  | { kind: 'not_synchronized' | 'pending' | 'conflict' | 'uncertain' }
  | { kind: 'acknowledged'; serverRevision: number };
export type CanonicalWorkoutDraftResume =
  | { kind: 'missing' | 'unavailable' }
  | (DraftSnapshot & { kind: 'editing' })
  | (DraftSnapshot & { kind: 'uncertain'; submission: Submission })
  | (DraftSnapshot & {
    kind: 'committed_locally'; submission: Submission; localRevision: number; delivery: DraftDelivery;
  });

interface Options {
  storage: Pick<Storage, 'getItem' | 'setItem'>;
  /** Same-origin Web Locks for cooperating tabs; writes fail closed without them. */
  locks?: Pick<LockManager, 'request'>;
  scope: CanonicalWorkoutDraftScope;
  /** Captures the caller's account/date lifetime, not just the current account/date strings. */
  isCurrent: () => boolean;
}

function sameScope(a: CanonicalWorkoutDraftScope, b: CanonicalWorkoutDraftScope): boolean {
  return a.accountId === b.accountId && a.namespaceKey === b.namespaceKey
    && a.generationId === b.generationId && a.localDate === b.localDate;
}

export function canonicalWorkoutDraftKey(scope: CanonicalWorkoutDraftScope): string {
  // Intentionally outside the legacy healthDraft: prefix, which Vault collects and restores.
  return 'healthCanonicalDraft:' + JSON.stringify([scope.accountId, scope.namespaceKey, scope.generationId, scope.localDate]);
}

function submittedIdentity(
  scope: CanonicalWorkoutDraftScope, editor: WorkoutSessionEditor, record: WorkoutSessionV1, entityId: string,
) {
  const localRevision = (editor.expectedLocalRevision ?? 0) + 1;
  if (!Number.isSafeInteger(localRevision)) throw new Error('INVALID_CANONICAL_DRAFT_REVISION');
  const identity = {
    namespaceKey: scope.namespaceKey, generationId: scope.generationId, domain: WORKOUT_SESSION_DOMAIN,
    entityId, localRevision, operation: 'upsert' as const,
    payloadHash: hashCanonicalPayload({ kind: 'entity_snapshot', record }),
  };
  return { identity, mutationId: deriveOutboxMutationId(identity) };
}

function hasKeys(value: unknown, keys: readonly string[]): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === keys.length
    && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}

function parseDraft(raw: string, scope: CanonicalWorkoutDraftScope): Draft {
  const value = JSON.parse(raw) as Partial<Draft> | null;
  if (!value || !hasKeys(value, ['version', 'changeId', 'scope', 'editor', 'submission']) || value.version !== 1
    || typeof value.changeId !== 'string' || canonicalWorkoutUuid(value.changeId) !== value.changeId
    || !value.scope || !hasKeys(value.scope, ['accountId', 'namespaceKey', 'generationId', 'localDate'])
    || !sameScope(value.scope, scope) || value.submission === undefined) {
    throw new Error('INVALID_CANONICAL_DRAFT');
  }
  const editor = snapshotWorkoutSessionEditorDraft(value.editor);
  if (editor.localDate !== scope.localDate) throw new Error('INVALID_CANONICAL_DRAFT_SCOPE');
  if (value.submission !== null) {
    const submission = value.submission;
    if (!hasKeys(submission, ['status', 'entityId', 'payloadHash', 'mutationId']) || submission.status !== 'uncertain'
      || canonicalWorkoutUuid(submission.entityId) !== canonicalWorkoutUuid(editor.sessionId)
      || (editor.expectedLocalRevision === null && submission.entityId !== editor.sessionId)) {
      throw new Error('INVALID_CANONICAL_DRAFT_SUBMISSION');
    }
    const { identity, mutationId } = submittedIdentity(scope, editor, projectWorkoutSessionEditor(editor), submission.entityId);
    if (submission.payloadHash !== identity.payloadHash || submission.mutationId !== mutationId) {
      throw new Error('INVALID_CANONICAL_DRAFT_SUBMISSION');
    }
    return { version: 1, changeId: value.changeId, scope, editor, submission };
  }
  return { version: 1, changeId: value.changeId, scope, editor, submission: null };
}

/**
 * One canonical draft slot per account/namespace/generation/day. Staging marks
 * completion uncertain before dispatch; reopening never modifies the marker or
 * retries a write. Only callers with an existing delivery owner observe settlement.
 */
export function createCanonicalWorkoutDraftStore(options: Options) {
  const scope = { ...options.scope };
  const { storage, locks, isCurrent } = options;
  const key = canonicalWorkoutDraftKey(scope);

  function current() {
    if (!isCurrent()) throw new Error('STALE_CANONICAL_DRAFT_SCOPE');
  }

  function read() {
    current();
    const raw = storage.getItem(key);
    return raw === null ? null : { raw, token: sha256Hex(raw), draft: parseDraft(raw, scope) };
  }

  function write(draft: Omit<Draft, 'changeId'>): DraftSnapshot {
    // An edit followed by reverting its content must not restore an older tab's token.
    const raw = JSON.stringify({ ...draft, changeId: crypto.randomUUID() });
    storage.setItem(key, raw);
    return { token: sha256Hex(raw), editor: draft.editor };
  }

  function change<T>(operation: () => T | Promise<T>): Promise<T> {
    if (!locks) return Promise.reject(new Error('CANONICAL_DRAFT_LOCK_UNAVAILABLE'));
    return locks.request(key, () => {
      current();
      return operation();
    });
  }

  function inRepositoryScope(database: LocalDatabaseRepository): boolean {
    return database.namespace.userId === scope.accountId && database.namespaceKey === scope.namespaceKey
      && database.namespace.generationId === scope.generationId;
  }

  async function saveEditor(input: WorkoutSessionEditor, expectedToken: string | null): Promise<DraftSnapshot> {
    const editor = snapshotWorkoutSessionEditorDraft(input);
    if (editor.localDate !== scope.localDate) throw new Error('INVALID_CANONICAL_DRAFT_SCOPE');
    return change(() => {
      const prior = read();
      if ((prior?.token ?? null) !== expectedToken) throw new Error('STALE_CANONICAL_DRAFT');
      if (prior?.draft.submission) throw new Error('CANONICAL_DRAFT_SUBMISSION_UNCERTAIN');
      if (prior && (prior.draft.editor.sessionId !== editor.sessionId
        || prior.draft.editor.expectedLocalRevision !== editor.expectedLocalRevision)) {
        throw new Error('CANONICAL_DRAFT_IDENTITY_CHANGED');
      }
      return write({ version: 1, scope, editor, submission: null });
    });
  }

  function pendingDraft(expectedToken: string) {
    const prior = read();
    if (!prior || prior.token !== expectedToken) throw new Error('STALE_CANONICAL_DRAFT');
    if (prior.draft.submission) throw new Error('CANONICAL_DRAFT_SUBMISSION_UNCERTAIN');
    return prior;
  }

  function markSubmission(draft: Draft, record: WorkoutSessionV1, entityId: string) {
    const { identity, mutationId } = submittedIdentity(scope, draft.editor, record, entityId);
    const submission = { status: 'uncertain' as const, entityId, mutationId, payloadHash: identity.payloadHash };
    write({ ...draft, submission });
    return { ...submission, record };
  }

  // Only the isolated worker editor may reopen canonical, committed pull evidence.
  // The local-only submit path below remains create-only.
  async function readWorkerEditBase(database: LocalDatabaseRepository, id: string, revision: number, exact: boolean) {
    if (!inRepositoryScope(database)) throw new Error('CANONICAL_DRAFT_EDIT_BASE_UNAVAILABLE');
    const { entity } = await database.readWorkoutDraftEvidence(id, { kind: 'edit_base' });
    current();
    const canonicalSource = entity?.source?.kind === 'local' && entity.source.reference === 'workout_session_v1'
      || entity?.source?.kind === 'remote' && entity.source.reference === WORKOUT_PULL_PROVIDER;
    if (!entity || entity.isDeleted || entity.deletionState !== 'active' || entity.deletedAt !== null
      || entity.accountId !== scope.accountId || entity.ownerId !== scope.accountId
      || entity.namespaceKey !== scope.namespaceKey || entity.generationId !== scope.generationId
      || entity.domain !== WORKOUT_SESSION_DOMAIN || (exact ? entity.entityId !== id
        : canonicalWorkoutUuid(entity.entityId) !== canonicalWorkoutUuid(id))
      || entity.revision !== revision || entity.localRevision !== revision || entity.pendingMutationId !== null
      || entity.remoteState !== 'active' || !entity.serverRevision || !canonicalSource
      || entity.migrationProvenance || entity.restoreProvenance) {
      throw new Error('CANONICAL_DRAFT_EDIT_BASE_UNAVAILABLE');
    }
    validateWorkoutSessionV1(entity.record);
    if (entity.record.localDate !== scope.localDate || canonicalWorkoutUuid(entity.record.id) !== canonicalWorkoutUuid(id)) {
      throw new Error('CANONICAL_DRAFT_EDIT_BASE_UNAVAILABLE');
    }
    return { record: entity.record, entityId: entity.entityId };
  }

  function reopenWorkerSession(database: LocalDatabaseRepository, entityId: string, revision: number, expectedToken: string | null) {
    return change(async () => {
      const prior = read();
      if ((prior?.token ?? null) !== expectedToken) throw new Error('STALE_CANONICAL_DRAFT');
      if (prior) {
        const previous = await resume(database, { observeDelivery: true, observeWorkerDeliveryHistory: true });
        if (previous.kind !== 'committed_locally' || previous.delivery.kind !== 'acknowledged'
          || previous.submission.entityId !== entityId || previous.token !== prior.token) {
          throw new Error('CANONICAL_DRAFT_STILL_OWNED');
        }
      }
      const base = await readWorkerEditBase(database, entityId, revision, true);
      if ((read()?.raw ?? null) !== (prior?.raw ?? null)) throw new Error('STALE_CANONICAL_DRAFT');
      return write({ version: 1, scope, editor: hydrateWorkoutSessionEditor(base.record, revision), submission: null });
    });
  }

  function submitWorkerEdit(
    expectedToken: string,
    database: LocalDatabaseRepository,
    dispatch: (record: WorkoutSessionV1, entityId: string, expectedRevision: number) => Promise<unknown>,
  ) {
    return change(async () => {
      const prior = pendingDraft(expectedToken);
      const { editor } = prior.draft;
      const revision = editor.expectedLocalRevision;
      if (revision === null) throw new Error('CANONICAL_DRAFT_EDIT_BASE_UNAVAILABLE');
      const record = projectWorkoutSessionEditor(editor);
      const base = await readWorkerEditBase(database, editor.sessionId, revision, false);
      if (base.record.id !== editor.sessionId || storage.getItem(key) !== prior.raw) throw new Error('STALE_CANONICAL_DRAFT');
      markSubmission(prior.draft, record, base.entityId);
      const marked = storage.getItem(key);
      try {
        return await dispatch(record, base.entityId, revision);
      } catch (error) {
        // This exact repository error is issued before either atomic write.
        // Restore the editable bytes, not a rebased draft; every ambiguous
        // failure retains the marker and cannot cause an automatic retry.
        if (error instanceof LocalDatabaseError && error.code === 'STALE_REVISION'
          && error.operation === 'commit_local_mutation' && isCurrent() && storage.getItem(key) === marked) {
          storage.setItem(key, prior.raw);
        }
        throw error;
      }
    });
  }

  function stageSubmission(expectedToken: string, database?: LocalDatabaseRepository): Promise<Submission & { record: WorkoutSessionV1 }> {
    return change(async () => {
      const prior = pendingDraft(expectedToken);
      const { editor } = prior.draft;
      const record = projectWorkoutSessionEditor(editor);
      let entityId = editor.sessionId;
      if (editor.expectedLocalRevision !== null) {
        if (!database || !inRepositoryScope(database)) throw new Error('CANONICAL_DRAFT_EDIT_BASE_UNAVAILABLE');
        const { entity: base } = await database.readWorkoutDraftEvidence(editor.sessionId, { kind: 'edit_base' });
        current();
        if (storage.getItem(key) !== prior.raw) throw new Error('STALE_CANONICAL_DRAFT');
        if (!base || base.isDeleted || base.ownerId !== scope.accountId || base.accountId !== scope.accountId
          || base.namespaceKey !== scope.namespaceKey || base.generationId !== scope.generationId
          || base.source?.kind !== 'local' || base.source.reference !== 'workout_session_v1'
          || base.revision !== editor.expectedLocalRevision || base.localRevision !== base.revision) {
          throw new Error('CANONICAL_DRAFT_EDIT_BASE_UNAVAILABLE');
        }
        validateWorkoutSessionV1(base.record);
        if (base.record.localDate !== scope.localDate
          || canonicalWorkoutUuid(base.record.id) !== canonicalWorkoutUuid(editor.sessionId)
          || canonicalWorkoutUuid(base.entityId) !== canonicalWorkoutUuid(editor.sessionId)) {
          throw new Error('CANONICAL_DRAFT_EDIT_BASE_UNAVAILABLE');
        }
        entityId = base.entityId;
      }
      return markSubmission(prior.draft, record, entityId);
    });
  }

  function submitNewSession(
    expectedToken: string,
    verifyBeforeDispatch: () => Promise<void>,
    dispatch: (record: WorkoutSessionV1) => Promise<unknown>,
  ): Promise<unknown> {
    return change(async () => {
      const prior = pendingDraft(expectedToken);
      const { editor } = prior.draft;
      if (editor.expectedLocalRevision !== null) throw new Error('CANONICAL_LOCAL_SAVE_NOT_NEW');
      const record = projectWorkoutSessionEditor(editor);
      // Finish every asynchronous safety check before persisting the marker.
      await verifyBeforeDispatch();
      current();
      if (storage.getItem(key) !== prior.raw) throw new Error('STALE_CANONICAL_DRAFT');
      markSubmission(prior.draft, record, editor.sessionId);
      // No yield between the marker and dispatch; never clear the marker after this point.
      return dispatch(record);
    });
  }

  async function resume(database?: LocalDatabaseRepository,
    { observeDelivery = false, observeWorkerDeliveryHistory = false }: {
      observeDelivery?: boolean; observeWorkerDeliveryHistory?: boolean;
    } = {}): Promise<CanonicalWorkoutDraftResume> {
    try {
      const saved = read();
      if (!saved) return { kind: 'missing' };
      const { editor, submission } = saved.draft;
      const snapshot = { token: saved.token, editor };
      if (!submission) return { kind: 'editing', ...snapshot };
      const uncertain = { kind: 'uncertain' as const, ...snapshot, submission };
      if (!database || !inRepositoryScope(database)) return uncertain;

      const record = projectWorkoutSessionEditor(editor);
      const { identity } = submittedIdentity(scope, editor, record, submission.entityId);
      try {
        const { entity, outbox, deliveryAuthorityCurrent, deliveryAuthorityMatchesBinding,
          historicalCreateUnambiguous } = await database.readWorkoutDraftEvidence(submission.entityId, {
          kind: 'submission', mutationId: submission.mutationId, observeDelivery,
        });
        if (!isCurrent() || storage.getItem(key) !== saved.raw) return { kind: 'unavailable' };
        const inScope = (value: typeof entity | typeof outbox) => value
          && value.accountId === scope.accountId && value.namespaceKey === scope.namespaceKey
          && value.generationId === scope.generationId && value.domain === identity.domain
          && value.entityId === identity.entityId;
        if (!entity || !outbox || !inScope(entity) || !inScope(outbox) || entity.ownerId !== scope.accountId
          || entity.localRevision === undefined || entity.localRevision < identity.localRevision
          || outbox.localRevision !== identity.localRevision
          || outbox.mutationId !== submission.mutationId || outbox.deviceId !== database.namespace.deviceId
          || outbox.operation !== identity.operation || outbox.baseRevision !== editor.expectedLocalRevision
          || outbox.generationBoundary != null
          || outbox.idempotencyKey !== deriveOutboxIdempotencyKey(identity)
          || outbox.payloadHash !== submission.payloadHash || outbox.payload.kind !== 'entity_snapshot'
          || hashCanonicalPayload(outbox.payload) !== submission.payloadHash) return uncertain;
        const unbound = outbox.deliveryBinding?.state === 'unbound' && outbox.status === 'pending'
          && outbox.attemptCount === 0 && outbox.lastAttemptAt === null;
        const isLatest = entity.localRevision === identity.localRevision;
        if (!observeDelivery && (!isLatest || !unbound)) return uncertain;
        if (outbox.baseRevision === null && (entity.migrationProvenance || entity.restoreProvenance
          || !isLatest && historicalCreateUnambiguous !== true)) return uncertain;
        if (isLatest) {
          if (entity.revision !== identity.localRevision || entity.isDeleted || entity.deletionState !== 'active'
            || entity.deletedAt !== null || entity.source?.kind !== 'local'
            || entity.source.reference !== 'workout_session_v1'
            || (outbox.status === 'acknowledged' ? entity.pendingMutationId !== null
              : entity.pendingMutationId !== submission.mutationId)) return uncertain;
          validateWorkoutSessionV1(entity.record);
          const contentHash = hashCanonicalPayload(record);
          if (entity.contentHash !== contentHash || hashCanonicalPayload(entity.record) !== contentHash) return uncertain;
        }

        // The immutable payload on the exact prior mutation, not M2's mutable current
        // content, is evidence for M1. Resume only reads; it never settles or clears M2.
        let delivery: DraftDelivery = { kind: unbound && outbox.deliveryBlockCode == null ? 'not_synchronized' : 'uncertain' };
        const binding = outbox.deliveryBinding;
        if (observeDelivery && binding?.state === 'bound' && outbox.deliveryBlockCode == null) {
          if (observeWorkerDeliveryHistory && (outbox.status === 'claimed' || outbox.status === 'retry_wait')) {
            delivery = { kind: 'uncertain' };
          } else if (deliveryAuthorityCurrent && (outbox.status === 'pending' || outbox.status === 'claimed' || outbox.status === 'retry_wait')) {
            delivery = { kind: 'pending' };
          } else if (outbox.status === 'conflict' && (deliveryAuthorityCurrent
            || observeWorkerDeliveryHistory && deliveryAuthorityMatchesBinding)) {
            delivery = { kind: 'conflict' };
          } else if (outbox.status === 'acknowledged' && outbox.acknowledgedRevision != null
            && (deliveryAuthorityCurrent || observeWorkerDeliveryHistory && deliveryAuthorityMatchesBinding)
            && outbox.acknowledgedRevision === (binding.remoteCasBaseRevision ?? 0) + 1
            && outbox.remoteMutationRef !== null && WORKOUT_WIRE_UUID.test(outbox.remoteMutationRef)
            && validTimestamp(outbox.serverCommittedAt) && /T.+(?:Z|[+-]\d{2}:\d{2})$/.test(outbox.serverCommittedAt)
            && (!isLatest || (entity.serverRevision === outbox.acknowledgedRevision
              && entity.lastRemoteMutationRef === outbox.remoteMutationRef && entity.remoteState === 'active'))) {
            delivery = { kind: 'acknowledged', serverRevision: outbox.acknowledgedRevision };
          }
        }
        return { ...snapshot, kind: 'committed_locally', submission, localRevision: identity.localRevision, delivery };
      } catch {
        return isCurrent() && storage.getItem(key) === saved.raw ? uncertain : { kind: 'unavailable' };
      }
    } catch {
      // Bad/missing authority is never a reason to delete, replace or resubmit a stored draft.
      return { kind: 'unavailable' };
    }
  }

  return { saveEditor, stageSubmission, submitNewSession, resume, reopenWorkerSession, submitWorkerEdit };
}
