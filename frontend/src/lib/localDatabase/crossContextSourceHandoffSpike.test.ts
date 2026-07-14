import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';

type AuthorityState =
  | 'writable'
  | 'handoff_pending'
  | 'snapshot_committed_pending_finalization'
  | 'read_only_handoff';

interface PhysicalSourceIdentity {
  origin: string;
  sourceFamily: 'legacy_notes';
  backend: 'legacy_indexeddb';
  databaseName: string;
  objectStoreName: string;
  physicalSourceVersion: 1;
}

interface LogicalAuthorityScope {
  userId: string;
  projectRef: string;
  namespaceId: string;
  deviceId: string;
}

interface DurableAuthority {
  physicalSourceDigest: string;
  ownerScopeDigest: string;
  state: AuthorityState;
  revision: number;
  snapshotRevision: number | null;
  snapshotDigest: string | null;
}

interface DurableSnapshot {
  physicalSourceDigest: string;
  ownerScopeDigest: string;
  sourceRevision: number;
  snapshotDigest: string;
  records: ReadonlyArray<readonly [string, string]>;
}

interface DurableModel {
  authority: DurableAuthority;
  source: Map<string, string>;
  snapshot: DurableSnapshot | null;
}

class ProtocolError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

class Deferred {
  readonly promise: Promise<void>;
  private resolvePromise!: () => void;

  constructor() {
    this.promise = new Promise(resolve => { this.resolvePromise = resolve; });
  }

  resolve(): void {
    this.resolvePromise();
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function exactKeys(value: object, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  return actual.length === expected.length
    && actual.every((key, index) => key === [...expected].sort()[index]);
}

function canonicalPhysicalSource(identity: PhysicalSourceIdentity): string {
  const expected = [
    'backend', 'databaseName', 'objectStoreName', 'origin', 'physicalSourceVersion', 'sourceFamily',
  ];
  if (!exactKeys(identity, expected)
    || identity.sourceFamily !== 'legacy_notes'
    || identity.backend !== 'legacy_indexeddb'
    || identity.physicalSourceVersion !== 1
    || !identity.databaseName || !identity.objectStoreName) {
    throw new ProtocolError('MALFORMED_PHYSICAL_SOURCE_IDENTITY');
  }
  let origin: string;
  try {
    const parsed = new URL(identity.origin);
    if (parsed.origin !== identity.origin) throw new Error('non-canonical origin');
    origin = parsed.origin;
  } catch {
    throw new ProtocolError('MALFORMED_PHYSICAL_SOURCE_IDENTITY');
  }
  // Fixed-position JSON array is delimiter-safe, locale-independent, and property-order-independent.
  return JSON.stringify([
    'absinthe_legacy_physical_source_v1',
    origin,
    identity.sourceFamily,
    identity.backend,
    identity.databaseName,
    identity.objectStoreName,
    identity.physicalSourceVersion,
  ]);
}

function physicalSourceDigest(identity: PhysicalSourceIdentity): string {
  return sha256(canonicalPhysicalSource(identity));
}

function derivePhysicalLockName(identity: PhysicalSourceIdentity): string {
  return `absinthe:legacy-source-handoff:v1:${physicalSourceDigest(identity)}`;
}

function logicalScopeDigest(scope: LogicalAuthorityScope): string {
  return sha256(JSON.stringify([
    'absinthe_legacy_logical_authority_v1',
    scope.userId,
    scope.projectRef,
    scope.namespaceId,
    scope.deviceId,
  ]));
}

function snapshotDigest(
  physicalDigest: string,
  ownerDigest: string,
  revision: number,
  records: ReadonlyArray<readonly [string, string]>,
): string {
  return sha256(JSON.stringify([
    'absinthe_legacy_handoff_snapshot_v1', physicalDigest, ownerDigest, revision, records,
  ]));
}

/** Deterministic stand-in for one same-origin, same-name exclusive Web Lock queue. */
class ExclusiveLockQueue {
  private tail: Promise<void> = Promise.resolve();

  run<T>(work: () => Promise<T>): Promise<T> {
    const predecessor = this.tail;
    let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; });
    return predecessor.then(work).finally(release);
  }
}

/** Test-only LockManager analogue. Actors supply names, never queue instances. */
class NamedLockRegistry {
  private readonly queues = new Map<string, ExclusiveLockQueue>();

  run<T>(lockName: string, work: () => Promise<T>): Promise<T> {
    let queue = this.queues.get(lockName);
    if (!queue) {
      queue = new ExclusiveLockQueue();
      this.queues.set(lockName, queue);
    }
    return queue.run(work);
  }

  get size(): number {
    return this.queues.size;
  }
}

/** One and only one durable authority/source model is keyed by each physical source digest. */
class DurablePhysicalSourceRegistry {
  private readonly sources = new Map<string, DurableModel>();

  initialize(identity: PhysicalSourceIdentity, owner: LogicalAuthorityScope): DurableModel {
    const digest = physicalSourceDigest(identity);
    if (this.sources.has(digest)) throw new ProtocolError('AUTHORITY_ALREADY_EXISTS');
    const durable: DurableModel = {
      authority: {
        physicalSourceDigest: digest,
        ownerScopeDigest: logicalScopeDigest(owner),
        state: 'writable',
        revision: 0,
        snapshotRevision: null,
        snapshotDigest: null,
      },
      source: new Map(),
      snapshot: null,
    };
    this.sources.set(digest, durable);
    return durable;
  }

  read(identity: PhysicalSourceIdentity): DurableModel {
    const durable = this.sources.get(physicalSourceDigest(identity));
    if (!durable) throw new ProtocolError('AUTHORITY_NOT_FOUND');
    return durable;
  }

  get size(): number {
    return this.sources.size;
  }
}

function validateDurableModel(durable: DurableModel, expectedPhysicalDigest: string): void {
  const { authority, snapshot } = durable;
  const states: readonly AuthorityState[] = [
    'writable', 'handoff_pending', 'snapshot_committed_pending_finalization', 'read_only_handoff',
  ];
  if (!states.includes(authority.state)
    || authority.physicalSourceDigest !== expectedPhysicalDigest
    || !/^[a-f0-9]{64}$/.test(authority.ownerScopeDigest)
    || !Number.isSafeInteger(authority.revision) || authority.revision < 0) {
    throw new ProtocolError('CORRUPT_PERSISTED_RECORD');
  }
  const snapshotRequired = authority.state === 'snapshot_committed_pending_finalization'
    || authority.state === 'read_only_handoff';
  if (snapshotRequired !== Boolean(snapshot)
    || snapshotRequired !== (authority.snapshotRevision !== null)
    || snapshotRequired !== (authority.snapshotDigest !== null)) {
    throw new ProtocolError('CORRUPT_PERSISTED_RECORD');
  }
  if (snapshot && (snapshot.physicalSourceDigest !== expectedPhysicalDigest
    || snapshot.ownerScopeDigest !== authority.ownerScopeDigest
    || snapshot.sourceRevision !== authority.revision
    || snapshot.snapshotDigest !== authority.snapshotDigest)) {
    throw new ProtocolError('CORRUPT_PERSISTED_RECORD');
  }
}

interface WriteHooks {
  afterLockAcquired?: () => void;
  afterAuthorityRead?: () => Promise<void>;
  crashBeforeCommit?: boolean;
}

interface HandoffHooks {
  afterLockAcquired?: () => void;
  afterPendingCommit?: () => Promise<void>;
  crashAfterPending?: boolean;
  crashAfterSnapshotCommit?: boolean;
}

class HandoffContext {
  constructor(
    private readonly locks: NamedLockRegistry,
    private readonly sources: DurablePhysicalSourceRegistry,
    private readonly physicalIdentity: PhysicalSourceIdentity,
    private readonly logicalScope: LogicalAuthorityScope,
    private readonly coordinatorAvailable = true,
  ) {}

  get lockName(): string {
    return derivePhysicalLockName(this.physicalIdentity);
  }

  private assertSupported(): void {
    if (!this.coordinatorAvailable) throw new ProtocolError('COORDINATOR_UNAVAILABLE');
  }

  private assertScope(durable: DurableModel): void {
    if (durable.authority.ownerScopeDigest !== logicalScopeDigest(this.logicalScope)) {
      throw new ProtocolError('SCOPE_MISMATCH');
    }
  }

  write(id: string, value: string, hooks: WriteHooks = {}): Promise<number> {
    this.assertSupported();
    return this.locks.run(this.lockName, async () => {
      hooks.afterLockAcquired?.();
      const durable = this.sources.read(this.physicalIdentity);
      validateDurableModel(durable, physicalSourceDigest(this.physicalIdentity));
      this.assertScope(durable);
      if (durable.authority.state !== 'writable') throw new ProtocolError('SOURCE_READ_ONLY');
      await hooks.afterAuthorityRead?.();
      if (hooks.crashBeforeCommit) throw new ProtocolError('CONTEXT_CRASHED');

      // Models authority validation, mutation, and revision committing in one short IDB transaction.
      durable.source.set(id, value);
      durable.authority.revision += 1;
      return durable.authority.revision;
    });
  }

  handoff(hooks: HandoffHooks = {}): Promise<DurableSnapshot> {
    this.assertSupported();
    return this.locks.run(this.lockName, async () => {
      hooks.afterLockAcquired?.();
      const durable = this.sources.read(this.physicalIdentity);
      const digest = physicalSourceDigest(this.physicalIdentity);
      validateDurableModel(durable, digest);
      this.assertScope(durable);

      if (durable.authority.state === 'read_only_handoff') {
        if (!durable.snapshot) throw new ProtocolError('CORRUPT_PERSISTED_RECORD');
        return durable.snapshot;
      }
      if (durable.authority.state === 'writable') {
        // WRITE_EXCLUSION_POINT: durable authority leaves writable under the common physical lock.
        durable.authority.state = 'handoff_pending';
      }
      if (durable.authority.state === 'handoff_pending') {
        await hooks.afterPendingCommit?.();
        if (hooks.crashAfterPending) throw new ProtocolError('CONTEXT_CRASHED');
        this.commitSnapshotCandidate(durable);
        if (hooks.crashAfterSnapshotCommit) throw new ProtocolError('CONTEXT_CRASHED');
      }
      return this.finalizeSnapshot(durable);
    });
  }

  cancelBeforeSnapshot(): Promise<void> {
    this.assertSupported();
    return this.locks.run(this.lockName, async () => {
      const durable = this.sources.read(this.physicalIdentity);
      validateDurableModel(durable, physicalSourceDigest(this.physicalIdentity));
      this.assertScope(durable);
      if (durable.authority.state !== 'handoff_pending' || durable.snapshot) {
        throw new ProtocolError('CANCELLATION_NOT_ALLOWED');
      }
      durable.authority.state = 'writable';
    });
  }

  private commitSnapshotCandidate(durable: DurableModel): void {
    if (durable.authority.state !== 'handoff_pending' || durable.snapshot) {
      throw new ProtocolError('INVALID_AUTHORITY_STATE');
    }
    const records = Object.freeze(
      [...durable.source.entries()]
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(entry => Object.freeze(entry) as readonly [string, string]),
    );
    const candidateDigest = snapshotDigest(
      durable.authority.physicalSourceDigest,
      durable.authority.ownerScopeDigest,
      durable.authority.revision,
      records,
    );
    durable.snapshot = Object.freeze({
      physicalSourceDigest: durable.authority.physicalSourceDigest,
      ownerScopeDigest: durable.authority.ownerScopeDigest,
      sourceRevision: durable.authority.revision,
      snapshotDigest: candidateDigest,
      records,
    });
    durable.authority.snapshotRevision = durable.authority.revision;
    durable.authority.snapshotDigest = candidateDigest;
    durable.authority.state = 'snapshot_committed_pending_finalization';
  }

  private finalizeSnapshot(durable: DurableModel): DurableSnapshot {
    validateDurableModel(durable, physicalSourceDigest(this.physicalIdentity));
    if (durable.authority.state !== 'snapshot_committed_pending_finalization' || !durable.snapshot) {
      throw new ProtocolError('INVALID_AUTHORITY_STATE');
    }
    const expectedDigest = snapshotDigest(
      durable.snapshot.physicalSourceDigest,
      durable.snapshot.ownerScopeDigest,
      durable.snapshot.sourceRevision,
      durable.snapshot.records,
    );
    if (expectedDigest !== durable.snapshot.snapshotDigest
      || durable.authority.revision !== durable.snapshot.sourceRevision) {
      throw new ProtocolError('CORRUPT_PERSISTED_RECORD');
    }
    // HANDOFF_LINEARIZATION_POINT: append-only candidate is bound by terminal read-only authority.
    durable.authority.state = 'read_only_handoff';
    return durable.snapshot;
  }
}

const rootA: PhysicalSourceIdentity = {
  origin: 'https://app.example.test',
  sourceFamily: 'legacy_notes',
  backend: 'legacy_indexeddb',
  databaseName: 'absinthe-notes-v1',
  objectStoreName: 'notes',
  physicalSourceVersion: 1,
};
const rootB: PhysicalSourceIdentity = { ...rootA, databaseName: 'absinthe-notes-v1-other-root' };
const userA: LogicalAuthorityScope = {
  userId: 'user-a', projectRef: 'project-a', namespaceId: 'namespace-a', deviceId: 'device-a',
};
const userB: LogicalAuthorityScope = { ...userA, userId: 'user-b' };

function environment(): {
  locks: NamedLockRegistry;
  sources: DurablePhysicalSourceRegistry;
  context: (
    physical?: PhysicalSourceIdentity,
    scope?: LogicalAuthorityScope,
    coordinatorAvailable?: boolean,
  ) => HandoffContext;
} {
  const locks = new NamedLockRegistry();
  const sources = new DurablePhysicalSourceRegistry();
  return {
    locks,
    sources,
    context: (physical = rootA, scope = userA, available = true) => (
      new HandoffContext(locks, sources, physical, scope, available)
    ),
  };
}

describe('K-327A physical source identity', () => {
  it('derives one lock from physical identity regardless of user, project, namespace, or device', () => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    const base = env.context(rootA, userA).lockName;
    expect(env.context(rootA, userB).lockName).toBe(base);
    expect(env.context(rootA, { ...userA, projectRef: 'project-b' }).lockName).toBe(base);
    expect(env.context(rootA, { ...userA, namespaceId: 'namespace-b' }).lockName).toBe(base);
    expect(env.context(rootA, { ...userA, deviceId: 'device-b' }).lockName).toBe(base);
    expect(env.context(rootB, userA).lockName).not.toBe(base);
    expect(base).toMatch(/^absinthe:legacy-source-handoff:v1:[a-f0-9]{64}$/);
  });

  it('canonicalizes fixed fields independent of insertion order and rejects malformed identity', () => {
    const reordered = {
      objectStoreName: 'notes', physicalSourceVersion: 1, databaseName: 'absinthe-notes-v1',
      backend: 'legacy_indexeddb', sourceFamily: 'legacy_notes', origin: 'https://app.example.test',
    } as PhysicalSourceIdentity;
    expect(derivePhysicalLockName(reordered)).toBe(derivePhysicalLockName(rootA));
    expect(() => derivePhysicalLockName({ ...rootA, databaseName: '' }))
      .toThrowError(expect.objectContaining({ code: 'MALFORMED_PHYSICAL_SOURCE_IDENTITY' }));
    expect(() => derivePhysicalLockName({ ...rootA, extra: 'unknown' } as PhysicalSourceIdentity))
      .toThrowError(expect.objectContaining({ code: 'MALFORMED_PHYSICAL_SOURCE_IDENTITY' }));
  });
});

describe('K-327A deterministic named-lock handoff model', () => {
  it('drains a writer that acquired the physical lock before handoff and captures its commit', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userA);
    const writerMayCommit = new Deferred();
    const writer = env.context().write('note-a', 'v1', { afterAuthorityRead: () => writerMayCommit.promise });
    const handoff = env.context().handoff();

    await Promise.resolve();
    expect(durable.authority.state).toBe('writable');
    writerMayCommit.resolve();

    await expect(writer).resolves.toBe(1);
    await expect(handoff).resolves.toMatchObject({ sourceRevision: 1, records: [['note-a', 'v1']] });
    expect(durable.authority.state).toBe('read_only_handoff');
  });

  it('makes same-root different-account actors contend before rejecting scope mismatch', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userA);
    const writerMayCommit = new Deferred();
    let mismatchedHandoffAcquired = false;
    const writer = env.context(rootA, userA).write('note-a', 'committed', {
      afterAuthorityRead: () => writerMayCommit.promise,
    });
    const mismatchedHandoff = env.context(rootA, userB).handoff({
      afterLockAcquired: () => { mismatchedHandoffAcquired = true; },
    });

    await Promise.resolve();
    expect(env.context(rootA, userA).lockName).toBe(env.context(rootA, userB).lockName);
    expect(mismatchedHandoffAcquired).toBe(false);
    writerMayCommit.resolve();

    await expect(writer).resolves.toBe(1);
    await expect(mismatchedHandoff).rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    expect(mismatchedHandoffAcquired).toBe(true);
    expect(durable).toMatchObject({ authority: { state: 'writable', revision: 1 }, snapshot: null });
    expect(env.sources.size).toBe(1);
  });

  it('rejects project, namespace, and device mismatch only after common lock acquisition', async () => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    const mismatches = [
      { ...userA, projectRef: 'project-b' },
      { ...userA, namespaceId: 'namespace-b' },
      { ...userA, deviceId: 'device-b' },
    ];
    for (const mismatch of mismatches) {
      let acquired = false;
      const actor = env.context(rootA, mismatch);
      expect(actor.lockName).toBe(env.context(rootA, userA).lockName);
      await expect(actor.handoff({ afterLockAcquired: () => { acquired = true; } }))
        .rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
      expect(acquired).toBe(true);
    }
    expect(env.locks.size).toBe(1);
  });

  it('keeps different physical roots independent and permits concurrent progress', async () => {
    const env = environment();
    env.sources.initialize(rootA, userA);
    env.sources.initialize(rootB, userA);
    const release = new Deferred();
    const enteredA = new Deferred();
    const enteredB = new Deferred();
    const writeA = env.context(rootA).write('note-a', 'root-a', {
      afterAuthorityRead: () => { enteredA.resolve(); return release.promise; },
    });
    const writeB = env.context(rootB).write('note-b', 'root-b', {
      afterAuthorityRead: () => { enteredB.resolve(); return release.promise; },
    });

    await Promise.all([enteredA.promise, enteredB.promise]);
    expect(env.context(rootA).lockName).not.toBe(env.context(rootB).lockName);
    expect(env.locks.size).toBe(2);
    release.resolve();
    await expect(Promise.all([writeA, writeB])).resolves.toEqual([1, 1]);
  });

  it('rejects a writer queued after the write-exclusion point', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userA);
    const handoffMaySnapshot = new Deferred();
    const handoff = env.context().handoff({ afterPendingCommit: () => handoffMaySnapshot.promise });
    await Promise.resolve();
    expect(durable.authority.state).toBe('handoff_pending');

    const lateWriter = env.context().write('note-late', 'not-committed');
    handoffMaySnapshot.resolve();

    await expect(handoff).resolves.toMatchObject({ sourceRevision: 0, records: [] });
    await expect(lateWriter).rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });
    expect(durable.source.has('note-late')).toBe(false);
  });

  it('prevents a stale-account tab from bypassing a current-owner read-only handoff', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userB);
    const staleTab = env.context(rootA, userA);
    const currentTab = env.context(rootA, userB);
    expect(staleTab.lockName).toBe(currentTab.lockName);

    await currentTab.handoff();
    await expect(staleTab.write('note-stale', 'must-not-commit'))
      .rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    expect(durable.authority.state).toBe('read_only_handoff');
    expect(durable.source.has('note-stale')).toBe(false);
    expect(env.sources.size).toBe(1);
  });

  it('orders writer, handoff, and late writer without silent loss', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userA);
    const firstWriterMayCommit = new Deferred();
    const first = env.context().write('note-first', 'committed', {
      afterAuthorityRead: () => firstWriterMayCommit.promise,
    });
    const handoff = env.context().handoff();
    const second = env.context().write('note-second', 'rejected');
    firstWriterMayCommit.resolve();

    await expect(first).resolves.toBe(1);
    await expect(handoff).resolves.toMatchObject({ records: [['note-first', 'committed']] });
    await expect(second).rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });
    expect([...durable.source.keys()]).toEqual(['note-first']);
  });

  it('releases coordination after a writer crash without a partial mutation', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userA);
    await expect(env.context().write('note-a', 'partial', { crashBeforeCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    await expect(env.context().handoff()).resolves.toMatchObject({ sourceRevision: 0, records: [] });
    expect(durable.source.size).toBe(0);
  });

  it('keeps crash-after-pending restart fail-closed and resumable', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userA);
    await env.context().write('note-a', 'v1');
    await expect(env.context().handoff({ crashAfterPending: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    expect(durable.authority.state).toBe('handoff_pending');

    await expect(env.context().write('note-b', 'late')).rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });
    const resumed = await env.context().handoff();
    expect(resumed).toMatchObject({ sourceRevision: 1, records: [['note-a', 'v1']] });
    expect(durable.authority.state).toBe('read_only_handoff');
  });

  it('keeps an append-only snapshot candidate ineligible and finalizes it idempotently after restart', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userA);
    await env.context().write('note-a', 'v1');
    await expect(env.context().handoff({ crashAfterSnapshotCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    expect(durable).toMatchObject({
      authority: { state: 'snapshot_committed_pending_finalization', revision: 1, snapshotRevision: 1 },
      snapshot: { sourceRevision: 1, records: [['note-a', 'v1']] },
    });
    await expect(env.context().write('note-b', 'late')).rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });

    const candidate = durable.snapshot;
    const finalized = await env.context().handoff();
    expect(finalized).toBe(candidate);
    expect(durable.authority.state).toBe('read_only_handoff');
    await expect(env.context().handoff()).resolves.toBe(candidate);
  });

  it('allows explicit pre-snapshot cancellation but never candidate or terminal cancellation', async () => {
    const env = environment();
    const durable = env.sources.initialize(rootA, userA);
    await expect(env.context().handoff({ crashAfterPending: true })).rejects.toBeInstanceOf(ProtocolError);
    await env.context().cancelBeforeSnapshot();
    await expect(env.context().write('note-a', 'after-cancel')).resolves.toBe(1);
    await expect(env.context().handoff({ crashAfterSnapshotCommit: true })).rejects.toBeInstanceOf(ProtocolError);
    await expect(env.context().cancelBeforeSnapshot()).rejects.toMatchObject({ code: 'CANCELLATION_NOT_ALLOWED' });
    await env.context().handoff();
    await expect(env.context().cancelBeforeSnapshot()).rejects.toMatchObject({ code: 'CANCELLATION_NOT_ALLOWED' });
    expect(durable.authority.state).toBe('read_only_handoff');
  });

  it('rejects absent, malformed, and unsupported authority paths before mutation', async () => {
    const env = environment();
    await expect(env.context().write('note-a', 'absent')).rejects.toMatchObject({ code: 'AUTHORITY_NOT_FOUND' });
    const durable = env.sources.initialize(rootA, userA);
    durable.authority.state = 'invalid' as AuthorityState;
    await expect(env.context().write('note-a', 'corrupt'))
      .rejects.toMatchObject({ code: 'CORRUPT_PERSISTED_RECORD' });
    const unsupported = env.context(rootA, userA, false);
    expect(() => unsupported.handoff())
      .toThrowError(expect.objectContaining({ code: 'COORDINATOR_UNAVAILABLE' }));
    expect(durable.source.size).toBe(0);
  });
});
