import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createProductionWorkoutDeviceLifetimeAuthority, createWorkoutDeviceLifetimeAuthority,
  parseWorkoutDeviceAdoption, parseWorkoutDeviceAuthority,
  WORKOUT_DEVICE_ADOPTION_KEY as MARKER, WORKOUT_DEVICE_ADOPTION_VALUE as MARKER_VALUE,
  WORKOUT_DEVICE_AUTHORITY_KEY as AUTHORITY, WORKOUT_DEVICE_AUTHORITY_LOCK as LOCK,
  type DeviceAuthorityAdmission, type DeviceAuthorityLocks, type DeviceAuthorityStorage,
  type DeviceAuthorityToken, type PreparedDeviceAuthority,
} from './workoutDeviceLifetimeAuthority';
import { namespaceFingerprint } from './localDatabase/namespace';
import { HEALTH_ROUTINE_DEVICE_ID_KEY as MIRROR } from './workoutLocalReaderAuthority';

const A = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA';
const B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const L1 = '11111111-1111-4111-8111-111111111111';
const L2 = '22222222-2222-4222-8222-222222222222';
const L3 = '33333333-3333-4333-8333-333333333333';
const BUDGET = { timeoutMs: 1000 };
const READER: DeviceAuthorityAdmission = { role: 'legacy-reader', compatibleCreatorsQuiesced: true };
const CREATOR: DeviceAuthorityAdmission = { role: 'creator', compatibleCreatorsQuiesced: true };
const ready = (deviceId = A, lifetimeId = L1) => JSON.stringify({ format: 1, phase: 'ready', deviceId, lifetimeId });
const code = (value: string) => expect.objectContaining({ kind: 'authority_unavailable', code: value });

class MemoryStorage implements DeviceAuthorityStorage {
  values = new Map<string, string>();
  writes: { key: string; value: string }[] = [];
  getFailure: string | null = null;
  beforeWrite?: (key: string, value: string) => void;
  afterWrite?: (key: string, value: string) => void;
  getItem(key: string) {
    if (key === this.getFailure) throw new Error('storage_read_denied');
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.beforeWrite?.(key, value);
    this.values.set(key, value);
    this.writes.push({ key, value });
    this.afterWrite?.(key, value);
  }
}

/** FIFO shared/exclusive test adapter, used by the exact production algorithm.
 * This models cooperating contexts, NOT physical browser/platform acceptance.
 */
class QueuedLocks implements DeviceAuthorityLocks {
  requests: { name: string; options: { mode: 'shared' | 'exclusive'; signal: AbortSignal } }[] = [];
  active: ('shared' | 'exclusive')[] = [];
  blocked = false;
  private queue: { mode: 'shared' | 'exclusive'; run: () => void; cancel: () => void }[] = [];
  request<T>(name: string, options: { mode: 'shared' | 'exclusive'; signal: AbortSignal },
    callback: (lock: Lock | null) => T | Promise<T>): Promise<T> {
    this.requests.push({ name, options });
    return new Promise((resolve, reject) => {
      const abort = () => {
        this.queue = this.queue.filter(candidate => candidate !== entry);
        reject(new DOMException('cancelled', 'AbortError'));
        this.pump();
      };
      const entry = { mode: options.mode, cancel: abort, run: () => {
        options.signal.removeEventListener('abort', abort);
        this.active.push(options.mode);
        Promise.resolve().then(() => callback({ name, mode: options.mode } as Lock)).then(resolve, reject).finally(() => {
          this.active.splice(this.active.indexOf(options.mode), 1);
          this.pump();
        });
      } };
      if (options.signal.aborted) { abort(); return; }
      options.signal.addEventListener('abort', abort, { once: true });
      this.queue.push(entry);
      this.pump();
    });
  }
  pump() {
    if (this.blocked || this.active.includes('exclusive')) return;
    while (this.queue.length) {
      const next = this.queue[0];
      if (next.mode === 'exclusive' && this.active.length) return;
      this.queue.shift();
      next.run();
      if (next.mode === 'exclusive') return;
    }
  }
}
function fixture(mirror: string | null = A, ids = [L1, B, L2, A, L3]) {
  const store = new MemoryStorage();
  if (mirror !== null) store.values.set(MIRROR, mirror);
  const locks = new QueuedLocks();
  const randomUUID = vi.fn(() => {
    const next = ids.shift();
    if (!next) throw new Error('unexpected_entropy_request');
    return next;
  });
  const ports = { getStorage: () => store, locks: () => locks, randomUUID };
  return { store, locks, randomUUID, ports, owner: createWorkoutDeviceLifetimeAuthority(ports) };
}
async function initialized() {
  const f = fixture();
  const token = await f.owner.acquire(READER, BUDGET);
  f.store.writes = [];
  return { ...f, token };
}
async function creatorTransition(f: ReturnType<typeof fixture>) {
  // Simulate the CURRENT approved missing-ID recovery trigger, not an arbitrary replacement API.
  f.store.values.delete(MIRROR);
  return f.owner.acquire(CREATOR, BUDGET);
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('dormant Workout device lifetime foundation: admission and reuse', () => {
  it('import and both constructors perform no Storage/locks/entropy I/O', async () => {
    vi.resetModules();
    const unexpected = vi.fn(() => { throw new Error('import_io'); });
    vi.stubGlobal('localStorage', { getItem: unexpected, setItem: unexpected });
    vi.stubGlobal('navigator', { get locks() { unexpected(); return null; } });
    const module = await import('./workoutDeviceLifetimeAuthority');
    module.createProductionWorkoutDeviceLifetimeAuthority();
    module.createWorkoutDeviceLifetimeAuthority({ getStorage: unexpected, locks: unexpected, randomUUID: unexpected });
    expect(unexpected).not.toHaveBeenCalled();
  });
  it('valid legacy first adoption preserves exact case; marker precedes prepared then READY', async () => {
    const f = fixture();
    const token = await f.owner.acquire(READER, BUDGET);
    expect(token.deviceId).toBe(A);
    expect(token.lifetimeId).toBe(L1);
    expect(f.store.getItem(MIRROR)).toBe(A);
    expect(f.store.writes.map(w => w.key)).toEqual([MARKER, AUTHORITY, AUTHORITY]);
    expect(f.store.writes[0].value).toBe(MARKER_VALUE);
    const prepared = JSON.parse(f.store.writes[1].value);
    expect(prepared).toMatchObject({ phase: 'transitioning', transitionKind: 'legacy-adoption', previousLifetimeId: null });
    expect(prepared.previousMirrorFingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.parse(f.store.writes[2].value).phase).toBe('ready');
  });
  it('concurrent cooperating owners converge to one lifetime', async () => {
    const f = fixture();
    const other = createWorkoutDeviceLifetimeAuthority(f.ports);
    const tokens = await Promise.all([f.owner.acquire(READER, BUDGET), other.acquire(READER, BUDGET)]);
    expect(tokens.map(t => t.lifetimeId)).toEqual([L1, L1]);
    expect(f.randomUUID).toHaveBeenCalledTimes(1);
    expect(f.store.writes.filter(w => w.key === MARKER)).toHaveLength(1);
  });
  it('all-absent admitted creator initializes fresh device/lifetime with READY last', async () => {
    const f = fixture(null, [B, L2]);
    const token = await f.owner.acquire(CREATOR, BUDGET);
    expect(token).toMatchObject({ deviceId: B, lifetimeId: L2 });
    expect(f.store.writes.map(w => w.key)).toEqual([MARKER, AUTHORITY, MIRROR, AUTHORITY]);
    expect(JSON.parse(f.store.writes[1].value)).toMatchObject({ transitionKind: 'fresh-create', previousMirrorFingerprint: null });
    expect(f.randomUUID).toHaveBeenCalledTimes(2);
  });
  it('capture, repeated acquire and reload-equivalent owner reuse READY without writes/rotation', async () => {
    const f = await initialized();
    const reload = createWorkoutDeviceLifetimeAuthority(f.ports);
    for (const token of [await f.owner.capture(BUDGET), await f.owner.acquire(CREATOR, BUDGET), await reload.capture(BUDGET)]) {
      expect(token).toMatchObject({ deviceId: A, lifetimeId: L1 });
    }
    expect(f.store.writes).toEqual([]);
    expect(f.randomUUID).toHaveBeenCalledTimes(1);
  });
  it('mirror alone never publishes and non-admitted acquisition never bootstraps', async () => {
    const f = fixture();
    await expect(f.owner.capture(BUDGET)).rejects.toEqual(code('INVALID_AUTHORITY'));
    await expect(f.owner.acquire({ role: 'legacy-reader', compatibleCreatorsQuiesced: false } as never, BUDGET))
      .rejects.toEqual(code('ADMISSION_REQUIRED'));
    expect(f.store.writes).toEqual([]);
  });
  it.each([A, null])('marker retained + no authority (%s) denies every bootstrap/restart retry', async mirror => {
    const f = fixture(mirror);
    f.store.values.set(MARKER, MARKER_VALUE);
    for (const owner of [f.owner, createWorkoutDeviceLifetimeAuthority(f.ports)]) {
      await expect(owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('NOT_READY'));
      await expect(owner.capture(BUDGET)).rejects.toEqual(code('INVALID_AUTHORITY'));
    }
    expect(f.store.writes).toEqual([]);
    expect(f.randomUUID).not.toHaveBeenCalled();
  });
  it('marker write that persisted then threw leaves marker-only crash unavailable, not guessed recovery', async () => {
    const f = fixture();
    f.store.afterWrite = key => { if (key === MARKER) throw new Error('crash_after_marker'); };
    await expect(f.owner.acquire(READER, BUDGET)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    f.store.afterWrite = undefined;
    await expect(f.owner.acquire(READER, BUDGET)).rejects.toEqual(code('NOT_READY'));
    expect(f.store.getItem(AUTHORITY)).toBeNull();
  });
  it('does not claim history after unobserved joint marker/authority loss in a new process', async () => {
    const f = await initialized();
    f.store.values.delete(MARKER);
    f.store.values.delete(AUTHORITY);
    f.randomUUID.mockReturnValueOnce(L2);
    const restarted = createWorkoutDeviceLifetimeAuthority(f.ports);
    const adopted = await restarted.acquire(READER, BUDGET);
    expect(adopted).toMatchObject({ deviceId: A, lifetimeId: L2 });
    // This indistinguishable pre-adoption state is an explicit unsupported destruction limit.
  });
  it('never makes a helper-accepted but UUID-invalid value newly recovery-eligible', async () => {
    const f = fixture('-'.repeat(36));
    await expect(f.owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('INVALID_DEVICE'));
    expect(f.store.writes).toEqual([]);
  });
  it('admits existing format-invalid creator recovery only, preserving its exact prior fingerprint', async () => {
    const f = fixture('invalid', [B, L2]);
    await expect(f.owner.acquire(READER, BUDGET)).rejects.toEqual(code('ADMISSION_REQUIRED'));
    const token = await f.owner.acquire(CREATOR, BUDGET);
    expect(token.deviceId).toBe(B);
    expect(JSON.parse(f.store.writes[1].value)).toMatchObject({ transitionKind: 'creator-recovery', previousLifetimeId: null });
  });
});

describe('strict closed record parsing and unavailable states', () => {
  it.each(['{', 'null', '[]', '{}', '{"format":2,"adoption":"started"}',
    '{"format":1,"adoption":"ready"}', '{"format":1,"adoption":"started","deviceId":"x"}'])
  ('rejects malformed/future/unsupported marker %s', async raw => {
    expect(() => parseWorkoutDeviceAdoption(raw)).toThrow();
    const f = fixture();
    f.store.values.set(MARKER, raw);
    await expect(f.owner.acquire(READER, BUDGET)).rejects.toEqual(code('INVALID_MARKER'));
    expect(f.store.writes).toEqual([]);
  });
  it.each(['{', 'null', '[]', '{}', ready().replace('"format":1', '"format":2'),
    ready().replace(L1, A), ready().replace(A, 'invalid'),
    JSON.stringify({ ...JSON.parse(ready()), accountId: 'forbidden' }),
    JSON.stringify({ ...JSON.parse(ready()), phase: 'transitioning' })])
  ('rejects malformed/future/impossible authority %s', async raw => {
    expect(() => parseWorkoutDeviceAuthority(raw)).toThrow();
    const f = fixture();
    f.store.values.set(MARKER, MARKER_VALUE);
    f.store.values.set(AUTHORITY, raw);
    await expect(f.owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('INVALID_AUTHORITY'));
    expect(f.store.writes).toEqual([]);
  });
  it('READY/mirror valid-value mismatch is never silently repaired by a creator', async () => {
    const f = await initialized();
    f.store.values.set(MIRROR, B);
    await expect(f.owner.capture(BUDGET)).rejects.toEqual(code('MIRROR_MISMATCH'));
    await expect(f.owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('MIRROR_MISMATCH'));
    expect(f.store.writes).toEqual([]);
  });
  it('authority without marker fails capture/acquire, never synthesizes a marker', async () => {
    const f = fixture();
    f.store.values.set(AUTHORITY, ready());
    await expect(f.owner.capture(BUDGET)).rejects.toEqual(code('INVALID_MARKER'));
    await expect(f.owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('INVALID_MARKER'));
    expect(f.store.writes).toEqual([]);
  });
  it.each([AUTHORITY, MIRROR, MARKER])('every Storage get failure (%s) fails closed', async key => {
    const f = await initialized();
    f.store.getFailure = key;
    await expect(f.owner.capture(BUDGET)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    expect(f.token.isCurrent()).toBe(false);
    f.store.getFailure = null;
    expect(f.token.isCurrent()).toBe(false);
  });
  it('unavailable Storage adapter never falls back to memory', async () => {
    const f = fixture();
    const owner = createWorkoutDeviceLifetimeAuthority({ ...f.ports, getStorage: () => null });
    await expect(owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    expect(f.store.writes).toEqual([]);
  });
});

describe('production supported creator transition and exact durable resume', () => {
  it('TRANSITIONING precedes mirror and READY; previous lifetime is nonpublishable at preparation', async () => {
    const f = await initialized();
    let revokedAtPreparation = false;
    f.store.afterWrite = (key, value) => {
      if (key === AUTHORITY && JSON.parse(value).phase === 'transitioning') {
        revokedAtPreparation = !f.token.isCurrent();
        expect(f.store.getItem(MIRROR)).toBeNull();
      }
    };
    const next = await creatorTransition(f);
    expect(revokedAtPreparation).toBe(true);
    expect(next).toMatchObject({ deviceId: B, lifetimeId: L2 });
    expect(f.store.writes.map(w => w.key)).toEqual([AUTHORITY, MIRROR, AUTHORITY]);
    expect(JSON.parse(f.store.writes[0].value)).toMatchObject({ transitionKind: 'creator-recovery', previousLifetimeId: L1 });
    expect(JSON.parse(f.store.writes[2].value).phase).toBe('ready');
  });
  it('real admitted recovery A1 -> B -> A2 rejects unobserved A1 without string-equality proof', async () => {
    const f = await initialized();
    const b = await creatorTransition(f);
    const a2 = await creatorTransition(f);
    expect(b).toMatchObject({ deviceId: B, lifetimeId: L2 });
    expect(a2).toMatchObject({ deviceId: A, lifetimeId: L3 });
    expect(a2.lifetimeId).not.toBe(f.token.lifetimeId);
    const consume = vi.fn();
    await expect(f.owner.withCurrentAuthority(f.token, BUDGET, consume)).rejects.toEqual(code('REVOKED'));
    expect(consume).not.toHaveBeenCalled();
  });
  it('same-ID recovery rotates lifetime but not namespace or any writer record', async () => {
    const f = await initialized();
    f.randomUUID.mockReturnValueOnce(A).mockReturnValueOnce(L2);
    const namespace = { userId: 'account', projectRef: 'project', deviceId: A, schemaVersion: 1, generationId: 'g1' };
    const before = await namespaceFingerprint(namespace);
    f.store.values.set('untouched-writer-record', '{"binding":"frozen","requestDigest":"frozen"}');
    const pending = f.store.getItem('untouched-writer-record');
    const next = await creatorTransition(f);
    expect(next).toMatchObject({ deviceId: A, lifetimeId: L2 });
    expect(await namespaceFingerprint({ ...namespace, deviceId: next.deviceId })).toBe(before);
    expect(f.store.getItem('untouched-writer-record')).toBe(pending);
    expect(f.store.writes.every(w => [AUTHORITY, MIRROR].includes(w.key))).toBe(true);
  });
  it.each(['before-mirror', 'after-mirror', 'after-prepare-readback'])
  ('crash %s leaves exact prepared target; retries do not allocate competing lifetimes', async point => {
    const f = await initialized();
    if (point === 'before-mirror') f.store.beforeWrite = key => { if (key === MIRROR) throw new Error('crash'); };
    else f.store.afterWrite = (key, value) => {
      if (point === 'after-mirror' && key === MIRROR) throw new Error('crash');
      if (point === 'after-prepare-readback' && key === AUTHORITY && JSON.parse(value).phase === 'transitioning') {
        throw new Error('crash');
      }
    };
    await expect(creatorTransition(f)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    const prepared = parseWorkoutDeviceAuthority(f.store.getItem(AUTHORITY)) as PreparedDeviceAuthority;
    expect(prepared).toMatchObject({ phase: 'transitioning', deviceId: B, lifetimeId: L2 });
    expect(f.token.isCurrent()).toBe(false);
    await expect(f.owner.capture(BUDGET)).rejects.toEqual(code('NOT_READY'));
    f.store.beforeWrite = undefined;
    f.store.afterWrite = undefined;
    const calls = f.randomUUID.mock.calls.length;
    const resumed = await createWorkoutDeviceLifetimeAuthority(f.ports).resumePrepared(BUDGET);
    expect(resumed).toMatchObject({ deviceId: B, lifetimeId: prepared.lifetimeId });
    const retry = await f.owner.acquire(CREATOR, BUDGET);
    expect(retry.lifetimeId).toBe(prepared.lifetimeId);
    expect(f.randomUUID).toHaveBeenCalledTimes(calls);
    expect(f.token.isCurrent()).toBe(false);
  });
  it('fresh/legacy prepared first-adoption retry resumes exact lifetime', async () => {
    for (const mirror of [A, null]) {
      const f = fixture(mirror, mirror ? [L1] : [B, L2]);
      f.store.afterWrite = (key, value) => {
        if (key === AUTHORITY && JSON.parse(value).phase === 'transitioning') throw new Error('crash');
      };
      await expect(f.owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
      const prepared = JSON.parse(f.store.getItem(AUTHORITY)!);
      f.store.afterWrite = undefined;
      const token = await f.owner.acquire(CREATOR, BUDGET);
      expect(token.lifetimeId).toBe(prepared.lifetimeId);
      expect(f.store.writes.filter(w => w.key === MARKER)).toHaveLength(1);
    }
  });
  it('unexpected prepared mirror bytes never commit or mint a competing target', async () => {
    const f = await initialized();
    f.store.beforeWrite = key => { if (key === MIRROR) throw new Error('crash'); };
    await expect(creatorTransition(f)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    const prepared = f.store.getItem(AUTHORITY);
    f.store.beforeWrite = undefined;
    f.store.values.set(MIRROR, 'unexpected');
    await expect(f.owner.resumePrepared(BUDGET)).rejects.toEqual(code('INVALID_PREPARED_INTENT'));
    expect(f.store.getItem(AUTHORITY)).toBe(prepared);
    expect(f.randomUUID).toHaveBeenCalledTimes(3);
  });
  it('preparation set failure does not overwrite old READY; no availability rollback after revocation', async () => {
    const f = await initialized();
    const old = f.store.getItem(AUTHORITY);
    f.store.values.delete(MIRROR);
    f.store.beforeWrite = key => { if (key === AUTHORITY) throw new Error('quota'); };
    await expect(f.owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    expect(f.store.getItem(AUTHORITY)).toBe(old);
    // Only the test restores the previous mirror; implementation never rolls back.
    f.store.values.set(MIRROR, A);
    expect(f.token.isCurrent()).toBe(true);
    expect(f.store.writes).toEqual([]);
  });
  it('failed first marker write before persistence leaves never-admitted bytes untouched', async () => {
    const f = fixture();
    f.store.beforeWrite = () => { throw new Error('quota'); };
    await expect(f.owner.acquire(READER, BUDGET)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    expect(f.store.getItem(MARKER)).toBeNull();
    expect(f.store.getItem(AUTHORITY)).toBeNull();
    expect(f.store.getItem(MIRROR)).toBe(A);
  });
  it('entropy collisions/failure are bounded and do not revoke an unchanged authority', async () => {
    const f = await initialized();
    f.randomUUID.mockReturnValueOnce(B).mockReturnValueOnce(L1);
    f.store.values.delete(MIRROR);
    await expect(f.owner.acquire(CREATOR, BUDGET)).rejects.toEqual(code('ENTROPY_UNAVAILABLE'));
    expect(f.store.getItem(AUTHORITY)).toBe(ready());
    expect(f.store.writes).toEqual([]);
  });
});

describe('prepared intent failure boundaries', () => {
  it('READY write persisted then threw rejects attempt; retry reuses the committed target', async () => {
    const f = await initialized();
    f.store.afterWrite = (key, value) => {
      if (key === AUTHORITY && JSON.parse(value).phase === 'ready') throw new Error('crash_after_ready');
    };
    await expect(creatorTransition(f)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    expect(JSON.parse(f.store.getItem(AUTHORITY)!)).toMatchObject({ phase: 'ready', lifetimeId: L2 });
    f.store.afterWrite = undefined;
    const writes = f.store.writes.length;
    expect((await f.owner.acquire(CREATOR, BUDGET)).lifetimeId).toBe(L2);
    expect(f.store.writes).toHaveLength(writes);
    expect(f.randomUUID).toHaveBeenCalledTimes(3);
  });
  it('read-back failure after preparation does not restore the retired READY proof', async () => {
    const f = await initialized();
    f.store.afterWrite = (key, value) => {
      if (key === AUTHORITY && JSON.parse(value).phase === 'transitioning') f.store.getFailure = AUTHORITY;
    };
    await expect(creatorTransition(f)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    f.store.getFailure = null;
    expect(JSON.parse(f.store.getItem(AUTHORITY)!)).toMatchObject({ phase: 'transitioning' });
    expect(f.token.isCurrent()).toBe(false);
    f.store.afterWrite = undefined;
    expect((await f.owner.resumePrepared(BUDGET)).lifetimeId).toBe(L2);
  });
  it.each([
    { transitionKind: 'replacement' }, { transitionKind: 'reset' }, { transitionKind: 'clone' },
    { transitionKind: ['creator-recovery'] },
    { previousLifetimeId: L2 }, { previousMirrorFingerprint: 'not-a-fingerprint' },
    { previousLifetimeId: undefined }, { transitionKind: 'fresh-create' }, { unexpected: true },
  ])('rejects impossible or unsupported prepared evidence %j without overwriting', async override => {
    const f = await initialized();
    f.store.beforeWrite = key => { if (key === MIRROR) throw new Error('crash'); };
    await expect(creatorTransition(f)).rejects.toEqual(code('STORAGE_UNAVAILABLE'));
    f.store.beforeWrite = undefined;
    const raw = JSON.stringify({ ...JSON.parse(f.store.getItem(AUTHORITY)!), ...override });
    f.store.values.set(AUTHORITY, raw);
    await expect(f.owner.resumePrepared(BUDGET)).rejects.toEqual(code('INVALID_AUTHORITY'));
    expect(f.store.getItem(AUTHORITY)).toBe(raw);
    expect(f.randomUUID).toHaveBeenCalledTimes(3);
  });
});

describe('lock-protected synchronous final use, cancellation and revocation', () => {
  it('sync consumer and synchronous caller fence run under shared fixed-name lock', async () => {
    const f = await initialized();
    const result = await f.owner.withCurrentAuthority(f.token, BUDGET, current => {
      expect(f.locks.active).toEqual(['shared']);
      expect(Object.isFrozen(current)).toBe(true);
      return current.deviceId;
    }, () => { expect(f.locks.active).toEqual(['shared']); return true; });
    expect(result).toBe(A);
    expect(f.locks.requests.every(r => r.name === LOCK && !('steal' in r.options))).toBe(true);
    expect(f.store.writes).toEqual([]);
  });
  it('shared consumption precedes a queued other-owner transition', async () => {
    const f = await initialized();
    const other = createWorkoutDeviceLifetimeAuthority(f.ports);
    const order: string[] = [];
    let transition: Promise<DeviceAuthorityToken> | undefined;
    await f.owner.withCurrentAuthority(f.token, BUDGET, () => {
      // A compatible second context requests recovery; lock grant is after consumption.
      transition = other.acquire(CREATOR, BUDGET).then(t => { order.push('transition'); return t; });
      order.push('consume');
      expect(f.store.getItem(AUTHORITY)).toBe(ready());
      // Creator missing-ID trigger is introduced only after this synchronous consumer ends.
      queueMicrotask(() => f.store.values.delete(MIRROR));
    });
    await transition;
    expect(order).toEqual(['consume', 'transition']);
    expect(parseWorkoutDeviceAuthority(f.store.getItem(AUTHORITY)).lifetimeId).toBe(L2);
  });
  it('transition completed in async pre-final gap rejects an earlier advisory true', async () => {
    const f = await initialized();
    const verification = f.token.isCurrent();
    expect(verification).toBe(true);
    await creatorTransition(f);
    const consume = vi.fn();
    await expect(f.owner.withCurrentAuthority(f.token, BUDGET, consume)).rejects.toEqual(code('REVOKED'));
    expect(verification).toBe(true); // Retained true is not a capability.
    expect(consume).not.toHaveBeenCalled();
  });
  it('observed invalid metadata permanently revokes a token even after exact old bytes return', async () => {
    for (const key of [AUTHORITY, MARKER, MIRROR]) {
      const f = await initialized();
      const old = f.store.getItem(key)!;
      f.store.values.delete(key);
      expect(f.token.isCurrent()).toBe(false);
      f.store.values.set(key, old);
      expect(f.token.isCurrent()).toBe(false);
      await expect(f.owner.withCurrentAuthority(f.token, BUDGET, () => 'no')).rejects.toEqual(code('REVOKED'));
      expect((await f.owner.capture(BUDGET)).isCurrent()).toBe(true);
    }
  });
  it('caller not current and forged/other-owner tokens cannot publish', async () => {
    const f = await initialized();
    const consume = vi.fn();
    await expect(f.owner.withCurrentAuthority(f.token, BUDGET, consume, () => false)).rejects.toEqual(code('CALLER_NOT_CURRENT'));
    await expect(f.owner.withCurrentAuthority({ ...f.token }, BUDGET, consume)).rejects.toEqual(code('REVOKED'));
    await expect(createWorkoutDeviceLifetimeAuthority(f.ports).withCurrentAuthority(f.token, BUDGET, consume))
      .rejects.toEqual(code('REVOKED'));
    expect(consume).not.toHaveBeenCalled();
  });
  it('abort or authority invalidation during synchronous caller check prevents final consumption', async () => {
    const f = await initialized();
    const abort = new AbortController();
    const consume = vi.fn();
    await expect(f.owner.withCurrentAuthority(f.token, { ...BUDGET, signal: abort.signal }, consume,
      () => { abort.abort(); return true; })).rejects.toEqual(code('LOCK_CANCELLED'));
    await expect(f.owner.withCurrentAuthority(f.token, BUDGET, consume,
      () => { f.store.values.delete(MARKER); return true; })).rejects.toEqual(code('INVALID_MARKER'));
    f.store.values.set(MARKER, MARKER_VALUE);
    expect(f.token.isCurrent()).toBe(false);
    expect(consume).not.toHaveBeenCalled();
  });
  it('async callbacks rejected before invocation; disguised thenables rejected without awaiting', async () => {
    const f = await initialized();
    const invoked = vi.fn();
    const asyncConsumer = async () => { invoked(); return 1; };
    // @ts-expect-error A Promise-returning consumer is forbidden by the API.
    await expect(f.owner.withCurrentAuthority(f.token, BUDGET, asyncConsumer)).rejects.toEqual(code('ASYNC_CONSUMER'));
    expect(invoked).not.toHaveBeenCalled();
    const disguised = () => Promise.resolve(1);
    // @ts-expect-error Even a non-async function returning a promise is forbidden.
    await expect(f.owner.withCurrentAuthority(f.token, BUDGET, disguised)).rejects.toEqual(code('ASYNC_CONSUMER'));
  });
  it('nested authority acquisition fails instead of awaiting its own shared lock', async () => {
    const f = await initialized();
    let nested: Promise<DeviceAuthorityToken> | undefined;
    await f.owner.withCurrentAuthority(f.token, BUDGET, () => {
      nested = f.owner.capture(BUDGET);
      void nested.catch(() => undefined);
    });
    await expect(nested).rejects.toEqual(code('NESTED_LOCK'));
  });
  it('missing Web Locks and insecure production context fail closed', async () => {
    const f = fixture();
    await expect(createWorkoutDeviceLifetimeAuthority({ ...f.ports, locks: () => null }).capture(BUDGET))
      .rejects.toEqual(code('LOCK_UNAVAILABLE'));
    vi.stubGlobal('localStorage', f.store);
    vi.stubGlobal('navigator', { locks: f.locks });
    vi.stubGlobal('isSecureContext', false);
    await expect(createProductionWorkoutDeviceLifetimeAuthority().capture(BUDGET)).rejects.toEqual(code('LOCK_UNAVAILABLE'));
  });
  it('production adapter actually calls the browser lock and Storage ports', async () => {
    const f = await initialized();
    vi.stubGlobal('localStorage', f.store);
    vi.stubGlobal('navigator', { locks: f.locks });
    vi.stubGlobal('isSecureContext', true);
    const owner = createProductionWorkoutDeviceLifetimeAuthority();
    const token = await owner.capture(BUDGET);
    expect(await owner.withCurrentAuthority(token, BUDGET, () => 'consumed')).toBe('consumed');
    expect(f.locks.requests.slice(-2).map(r => r.options.mode)).toEqual(['shared', 'shared']);
  });
  it('already cancelled and queued-cancelled lock operations write nothing', async () => {
    const f = fixture();
    const abort = new AbortController();
    abort.abort();
    await expect(f.owner.acquire(READER, { ...BUDGET, signal: abort.signal })).rejects.toEqual(code('LOCK_CANCELLED'));
    f.locks.blocked = true;
    const queuedAbort = new AbortController();
    const queued = f.owner.acquire(READER, { ...BUDGET, signal: queuedAbort.signal });
    queuedAbort.abort();
    await expect(queued).rejects.toEqual(code('LOCK_CANCELLED'));
    expect(f.store.writes).toEqual([]);
  });
  it('finite acquisition deadline aborts queued lock and never steals it', async () => {
    vi.useFakeTimers();
    const f = fixture();
    f.locks.blocked = true;
    const pending = f.owner.acquire(READER, { timeoutMs: 50 });
    const rejected = expect(pending).rejects.toEqual(code('LOCK_CANCELLED'));
    await vi.advanceTimersByTimeAsync(50);
    await rejected;
    f.locks.blocked = false;
    f.locks.pump();
    expect(f.store.writes).toEqual([]);
    expect(f.locks.requests[0].options.signal.aborted).toBe(true);
    expect(Object.keys(f.locks.requests[0].options).sort()).toEqual(['mode', 'signal']);
  });
  it('lock adapter failure/null grant never executes or fabricates authority', async () => {
    const f = fixture();
    const nullGrant: DeviceAuthorityLocks = { request: async (_name, _options, callback) => callback(null) };
    await expect(createWorkoutDeviceLifetimeAuthority({ ...f.ports, locks: () => nullGrant }).acquire(READER, BUDGET))
      .rejects.toEqual(code('LOCK_FAILED'));
    const failed: DeviceAuthorityLocks = { request: async () => { throw new Error('lock_service_failure'); } };
    await expect(createWorkoutDeviceLifetimeAuthority({ ...f.ports, locks: () => failed }).acquire(READER, BUDGET))
      .rejects.toEqual(code('LOCK_FAILED'));
    expect(f.store.writes).toEqual([]);
  });
  it.each([0, -1, Infinity, NaN, 1.5, 2_147_483_648])('invalid unbounded budget %s rejects before lock request', async timeoutMs => {
    const f = fixture();
    await expect(f.owner.capture({ timeoutMs })).rejects.toEqual(code('INVALID_LOCK_BUDGET'));
    expect(f.locks.requests).toEqual([]);
  });
  it('static firewall: no consumer adoption/UI/writer/backend/reset imports or mutations', () => {
    const source = readFileSync(new URL('./workoutDeviceLifetimeAuthority.ts', import.meta.url), 'utf8');
    const imports = source.match(/^import .* from .*;$/gm);
    expect(imports).toEqual([
      "import { validateSafeIdentifier } from './localDatabase/namespace';",
      "import { HEALTH_ROUTINE_DEVICE_ID_KEY } from './workoutLocalReaderAuthority';",
    ]);
    for (const forbidden of ['react', 'fetch(', 'indexedDB', 'removeItem(', 'deliveryBinding', 'requestDigest', 'authorityEpoch']) {
      expect(source).not.toContain(forbidden);
    }
  });
});
