import { describe, expect, it } from 'vitest';

type AuthorityState = 'writable' | 'handoff_pending' | 'read_only_handoff';

interface DurableAuthority {
  scopeDigest: string;
  state: AuthorityState;
  revision: number;
  snapshotRevision: number | null;
}

interface DurableSnapshot {
  scopeDigest: string;
  sourceRevision: number;
  records: ReadonlyArray<readonly [string, string]>;
}

class ProtocolError extends Error {
  constructor(readonly code: string) {
    super(code);
  }
}

class Deferred {
  promise: Promise<void>;
  private resolvePromise!: () => void;

  constructor() {
    this.promise = new Promise(resolve => { this.resolvePromise = resolve; });
  }

  resolve(): void {
    this.resolvePromise();
  }
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

interface DurableModel {
  authority: DurableAuthority;
  source: Map<string, string>;
  snapshot: DurableSnapshot | null;
}

class HandoffContext {
  constructor(
    private readonly lock: ExclusiveLockQueue,
    private readonly durable: DurableModel,
    private readonly scopeDigest: string,
    private readonly coordinatorAvailable = true,
  ) {}

  private assertSupported(): void {
    if (!this.coordinatorAvailable) throw new ProtocolError('COORDINATOR_UNAVAILABLE');
  }

  private assertScope(): void {
    if (this.durable.authority.scopeDigest !== this.scopeDigest) {
      throw new ProtocolError('SCOPE_MISMATCH');
    }
  }

  write(
    id: string,
    value: string,
    hooks: { afterAuthorityRead?: () => Promise<void>; crashBeforeCommit?: boolean } = {},
  ): Promise<number> {
    this.assertSupported();
    return this.lock.run(async () => {
      this.assertScope();
      if (this.durable.authority.state !== 'writable') {
        throw new ProtocolError('SOURCE_READ_ONLY');
      }
      await hooks.afterAuthorityRead?.();
      if (hooks.crashBeforeCommit) throw new ProtocolError('CONTEXT_CRASHED');

      // Models source mutation and monotonic revision committing in one short IDB transaction.
      this.durable.source.set(id, value);
      this.durable.authority.revision += 1;
      return this.durable.authority.revision;
    });
  }

  handoff(
    hooks: { afterPendingCommit?: () => Promise<void>; crashAfterPending?: boolean } = {},
  ): Promise<DurableSnapshot> {
    this.assertSupported();
    return this.lock.run(async () => {
      this.assertScope();
      if (this.durable.authority.state === 'read_only_handoff') {
        if (!this.durable.snapshot) throw new ProtocolError('CORRUPT_PERSISTED_RECORD');
        return this.durable.snapshot;
      }
      if (this.durable.authority.state === 'writable') {
        // The commit of this durable transition is the proposed handoff linearization point.
        this.durable.authority.state = 'handoff_pending';
      }
      await hooks.afterPendingCommit?.();
      if (hooks.crashAfterPending) throw new ProtocolError('CONTEXT_CRASHED');
      return this.commitSnapshot();
    });
  }

  cancelBeforeSnapshot(): Promise<void> {
    this.assertSupported();
    return this.lock.run(async () => {
      this.assertScope();
      if (this.durable.authority.state !== 'handoff_pending' || this.durable.snapshot) {
        throw new ProtocolError('CANCELLATION_NOT_ALLOWED');
      }
      this.durable.authority.state = 'writable';
    });
  }

  private commitSnapshot(): DurableSnapshot {
    if (this.durable.authority.state !== 'handoff_pending') {
      throw new ProtocolError('INVALID_AUTHORITY_STATE');
    }
    const snapshot: DurableSnapshot = Object.freeze({
      scopeDigest: this.scopeDigest,
      sourceRevision: this.durable.authority.revision,
      records: Object.freeze(
        [...this.durable.source.entries()]
          .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
          .map(entry => Object.freeze(entry) as readonly [string, string]),
      ),
    });
    this.durable.snapshot = snapshot;
    this.durable.authority.snapshotRevision = snapshot.sourceRevision;
    this.durable.authority.state = 'read_only_handoff';
    return snapshot;
  }
}

function model(scopeDigest = 'scope-digest-a'): {
  lock: ExclusiveLockQueue;
  durable: DurableModel;
  context: () => HandoffContext;
} {
  const lock = new ExclusiveLockQueue();
  const durable: DurableModel = {
    authority: { scopeDigest, state: 'writable', revision: 0, snapshotRevision: null },
    source: new Map(),
    snapshot: null,
  };
  return { lock, durable, context: () => new HandoffContext(lock, durable, scopeDigest) };
}

describe('K-327 deterministic two-context handoff model', () => {
  it('drains a writer that acquired authority before handoff and captures its commit', async () => {
    const { durable, context } = model();
    const writerMayCommit = new Deferred();
    const writer = context().write('note-a', 'v1', { afterAuthorityRead: () => writerMayCommit.promise });
    const handoff = context().handoff();

    await Promise.resolve();
    expect(durable.authority.state).toBe('writable');
    writerMayCommit.resolve();

    await expect(writer).resolves.toBe(1);
    await expect(handoff).resolves.toMatchObject({ sourceRevision: 1, records: [['note-a', 'v1']] });
    expect(durable.authority.state).toBe('read_only_handoff');
  });

  it('rejects a writer queued after the handoff pending transition', async () => {
    const { durable, context } = model();
    const handoffMaySnapshot = new Deferred();
    const handoff = context().handoff({ afterPendingCommit: () => handoffMaySnapshot.promise });
    await Promise.resolve();
    expect(durable.authority.state).toBe('handoff_pending');

    const lateWriter = context().write('note-late', 'not-committed');
    handoffMaySnapshot.resolve();

    await expect(handoff).resolves.toMatchObject({ sourceRevision: 0, records: [] });
    await expect(lateWriter).rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });
    expect(durable.source.has('note-late')).toBe(false);
  });

  it('orders concurrent writer, handoff, and late writer without silent loss', async () => {
    const { durable, context } = model();
    const firstWriterMayCommit = new Deferred();
    const first = context().write('note-first', 'committed', {
      afterAuthorityRead: () => firstWriterMayCommit.promise,
    });
    const handoff = context().handoff();
    const second = context().write('note-second', 'rejected');
    firstWriterMayCommit.resolve();

    await expect(first).resolves.toBe(1);
    await expect(handoff).resolves.toMatchObject({ records: [['note-first', 'committed']] });
    await expect(second).rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });
    expect([...durable.source.keys()]).toEqual(['note-first']);
  });

  it('releases coordination after a writer crash without committing a partial write', async () => {
    const { durable, context } = model();
    await expect(context().write('note-a', 'partial', { crashBeforeCommit: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    await expect(context().handoff()).resolves.toMatchObject({ sourceRevision: 0, records: [] });
    expect(durable.source.size).toBe(0);
  });

  it('keeps a crash-after-pending restart fail-closed and resumes to the same snapshot', async () => {
    const { durable, context } = model();
    await context().write('note-a', 'v1');
    await expect(context().handoff({ crashAfterPending: true }))
      .rejects.toMatchObject({ code: 'CONTEXT_CRASHED' });
    expect(durable.authority.state).toBe('handoff_pending');

    await expect(context().write('note-b', 'late')).rejects.toMatchObject({ code: 'SOURCE_READ_ONLY' });
    const resumed = await context().handoff();
    expect(resumed).toMatchObject({ sourceRevision: 1, records: [['note-a', 'v1']] });
    expect(durable.authority.state).toBe('read_only_handoff');
  });

  it('allows explicit pre-snapshot cancellation but never terminal handoff cancellation', async () => {
    const { durable, context } = model();
    await expect(context().handoff({ crashAfterPending: true })).rejects.toBeInstanceOf(ProtocolError);
    await context().cancelBeforeSnapshot();
    await expect(context().write('note-a', 'after-cancel')).resolves.toBe(1);
    await context().handoff();
    await expect(context().cancelBeforeSnapshot()).rejects.toMatchObject({ code: 'CANCELLATION_NOT_ALLOWED' });
    expect(durable.authority.state).toBe('read_only_handoff');
  });

  it('rejects stale-account scope and unsupported-coordinator contexts before mutation', async () => {
    const { lock, durable } = model();
    const staleAccount = new HandoffContext(lock, durable, 'scope-digest-b');
    const unsupported = new HandoffContext(lock, durable, 'scope-digest-a', false);

    await expect(staleAccount.write('note-a', 'wrong-account'))
      .rejects.toMatchObject({ code: 'SCOPE_MISMATCH' });
    expect(() => unsupported.handoff()).toThrowError(expect.objectContaining({ code: 'COORDINATOR_UNAVAILABLE' }));
    expect(durable).toMatchObject({
      authority: { state: 'writable', revision: 0, snapshotRevision: null },
      snapshot: null,
    });
    expect(durable.source.size).toBe(0);
  });
});
