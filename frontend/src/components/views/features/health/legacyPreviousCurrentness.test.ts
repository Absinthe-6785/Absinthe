import { describe, expect, it, vi } from 'vitest';
import { LegacyPreviousCurrentness, type PreviousScope } from './legacyPreviousCurrentness';
import type { PrevWorkoutPayload } from './prevWorkoutFetch';
import { CompositeWorkoutReadIsolationError } from './compositeWorkoutReadProjection';

const scope = (accountId = 'A', beforeDate = '2026-10-12'): PreviousScope => ({
  accountId, beforeDate, authority: 'local', parentIdentity: null, rejected: false,
});
const payload: PrevWorkoutPayload = { prev_date: '2026-10-01', pr_kg: 40,
  prev_sets: [{ type: 'strength', set: 1, kg: 40, reps: 8, done: true }] };
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: Error) => void;
  return { promise: new Promise<T>((yes, no) => { resolve = yes; reject = no; }), resolve, reject };
}
const tick = async () => { for (let n = 0; n < 6; n++) await Promise.resolve(); };

describe('D independent legacy previous evidence', () => {
  it.each([true, false])('C01 account ABA rejects old positive/no-match (%s)', async positive => {
    const old = deferred<Record<string, PrevWorkoutPayload>>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ bench: payload });
    const owner = new LegacyPreviousCurrentness(load);
    owner.configure(scope()); const first = owner.ensure(['bench']); await tick();
    owner.configure(scope('B')); owner.configure(scope());
    const [fresh] = await owner.ensure(['bench']);
    old.resolve(positive ? { bench: payload } : {}); await first; await tick();
    expect(owner.evidence('bench')).toBe(fresh); expect(owner.qualified(fresh)).toBe(true);
    expect(load).toHaveBeenCalledTimes(2);
  });
  it.each([true, false])('C02 overlapping cutoff ABA rejects old positive/no-match (%s)', async positive => {
    const old = deferred<Record<string, PrevWorkoutPayload>>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ bench: payload });
    const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const first = owner.ensure(['bench']); await tick();
    owner.configure(scope('A', '2026-10-02')); void owner.ensure(['bench']); await tick();
    owner.configure(scope()); const [fresh] = await owner.ensure(['bench']);
    old.resolve(positive ? { bench: payload } : {}); await first; await tick();
    expect(owner.evidence('bench')).toBe(fresh); expect(load).toHaveBeenCalledTimes(3);
  });
  it('C03 replacement failure withholds late positive; C09 explicit recovery can prove no-match', async () => {
    const old = deferred<Record<string, PrevWorkoutPayload>>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockRejectedValueOnce(new Error('local failed')).mockResolvedValue({});
    const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const first = owner.ensure(['bench']); await tick(); owner.invalidate(); await tick();
    old.resolve({ bench: payload }); await first; await tick();
    expect(owner.evidence('bench').state).toBe('UNAVAILABLE'); expect(owner.payloads()).toEqual({});
    await owner.ensure(['bench']); expect(load).toHaveBeenCalledTimes(2); // no automatic retry
    owner.invalidate(); await tick(); expect(owner.evidence('bench').state).toBe('NO_MATCH');
    expect(owner.qualified(owner.evidence('bench'))).toBe(true);
  });
  it('C04 reversed equal results never revive the older proof', async () => {
    const a = deferred<Record<string, PrevWorkoutPayload>>(), b = deferred<Record<string, PrevWorkoutPayload>>();
    const load = vi.fn().mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const old = owner.ensure(['bench']); await tick(); owner.invalidate(); await tick();
    b.resolve({ bench: payload }); await tick(); const fresh = owner.evidence('bench');
    a.resolve({ bench: payload }); const [rejected] = await old; await tick();
    expect(owner.qualified(rejected)).toBe(false); expect(owner.evidence('bench')).toBe(fresh);
  });
  it.each(['save', 'delete'])('C05 %s crosses the flight; no read until the write settles', async () => {
    const old = deferred<Record<string, PrevWorkoutPayload>>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ bench: { ...payload, pr_kg: 20 } });
    const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const first = owner.ensure(['bench']); await tick(); const token = {};
    owner.beginMutation(token, 'unknown'); old.resolve({ bench: payload }); await first; await tick();
    expect(owner.evidence('bench').state).toBe('STALE_OR_SUPPRESSED');
    await owner.ensure(['bench']); expect(load).toHaveBeenCalledTimes(1);
    owner.endMutation(token); await tick(); expect(owner.evidence('bench').payload?.pr_kg).toBe(20);
  });
  it('C05 proven disjoint block and cutoff changes retain positive AND negative qualification', async () => {
    const load = vi.fn(async () => ({ bench: payload })); const owner = new LegacyPreviousCurrentness(load);
    owner.configure(scope()); const [yes, no] = await owner.ensure(['bench', 'empty']);
    owner.invalidate([{ blockId: 'other', date: '2026-01-01' }]);
    owner.invalidate([{ blockId: 'bench', date: '2026-10-12' }]); await tick();
    expect(owner.qualified(yes)).toBe(true); expect(owner.qualified(no)).toBe(true); expect(load).toHaveBeenCalledTimes(1);
  });
  it.each([1, 20, 100])('C06 %s consumers/routine dependencies share one read; warm no-match costs zero', async count => {
    const load = vi.fn(async () => ({})); const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const ids = Array.from({ length: count }, (_, n) => `b${n}`);
    await Promise.all(ids.map(id => owner.ensure([id]))); expect(load).toHaveBeenCalledTimes(1);
    await owner.ensure(ids); expect(load).toHaveBeenCalledTimes(1);
    for (let n = 0; n < 20; n++) owner.invalidate(); await tick();
    expect(load).toHaveBeenCalledTimes(2); expect(load.mock.calls[1]).toBeDefined();
  });
  it('C06 twenty rapid retries during a held read produce exactly one replacement batch', async () => {
    const old = deferred<Record<string, PrevWorkoutPayload>>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ bench: payload });
    const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const first = owner.ensure(['bench']); await tick();
    for (let n = 0; n < 20; n++) owner.invalidate(); await tick();
    expect(load).toHaveBeenCalledTimes(2); const fresh = owner.evidence('bench');
    old.resolve({ bench: payload }); await first; await tick(); expect(owner.evidence('bench')).toBe(fresh);
  });
  it('C07 closed mount cannot seed a new owner; C08 identity transitions revoke old tokens', async () => {
    const owner = new LegacyPreviousCurrentness(async () => ({ bench: payload })); owner.configure(scope());
    const [old] = await owner.ensure(['bench']); const isCurrent = owner.captureOperation();
    owner.close(); owner.configure(scope()); expect(isCurrent()).toBe(false); expect(owner.qualified(old)).toBe(false);
    for (const parentIdentity of ['device1/ns/g1', 'device2/ns/g1', 'device2/ns/g2']) {
      owner.configure({ ...scope(), parentIdentity }); const [value] = await owner.ensure(['bench']);
      owner.configure({ ...scope(), parentIdentity: parentIdentity + '-next' }); expect(owner.qualified(value)).toBe(false);
    }
  });
  it('C10 isolation synchronously suppresses all facts/no-match; no read/repair until admitted', async () => {
    const load = vi.fn(async () => ({ bench: payload })); const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const values = await owner.ensure(['bench', 'empty']); owner.configure({ ...scope(), rejected: true });
    expect(values.every(value => !owner.qualified(value))).toBe(true); expect(owner.payloads()).toEqual({});
    expect((await owner.ensure(['bench']))[0].state).toBe('STALE_OR_SUPPRESSED'); expect(load).toHaveBeenCalledTimes(1);
  });
  it('C11 canonical ordinary failure/retry cannot qualify or revoke independent legacy evidence', async () => {
    const load = vi.fn(async () => ({ bench: payload })); const owner = new LegacyPreviousCurrentness(load);
    owner.configure({ ...scope(), parentIdentity: 'ns/g1' }); const [value] = await owner.ensure(['bench']);
    owner.configure(scope()); expect(owner.qualified(value)).toBe(true); expect(load).toHaveBeenCalledTimes(1);
    owner.invalidate('unknown', false); owner.configure(scope()); expect(owner.qualified(value)).toBe(false);
  });
  it('typed legacy owner rejection revokes other already-current blocks and cannot turn into no-match', async () => {
    const load = vi.fn().mockResolvedValueOnce({ bench: payload }).mockRejectedValueOnce(new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH'));
    const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const [old] = await owner.ensure(['bench']); await owner.ensure(['new-block']);
    expect(owner.isRejected()).toBe(true); expect(owner.qualified(old)).toBe(false); expect(owner.payloads()).toEqual({});
    owner.invalidate(); await tick(); expect(load).toHaveBeenCalledTimes(2);
    expect(owner.evidence('new-block').state).toBe('STALE_OR_SUPPRESSED');
  });
  it('superseded typed failure cannot reject the replacement owner publication', async () => {
    const old = deferred<Record<string, PrevWorkoutPayload>>();
    const load = vi.fn().mockReturnValueOnce(old.promise).mockResolvedValue({ bench: payload });
    const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const first = owner.ensure(['bench']); await tick(); owner.invalidate(); await tick();
    const fresh = owner.evidence('bench'); old.reject(new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH'));
    await first; await tick(); expect(owner.isRejected()).toBe(false); expect(owner.evidence('bench')).toBe(fresh);
  });
  it('active A write survives date/account ABA but never blocks B history', async () => {
    const load = vi.fn(async () => ({})); const owner = new LegacyPreviousCurrentness(load); owner.configure(scope());
    const token = {}; owner.beginMutation(token, 'unknown'); owner.configure(scope('B'));
    await owner.ensure(['bench']); expect(load).toHaveBeenCalledTimes(1);
    owner.configure(scope()); expect((await owner.ensure(['bench']))[0].state).toBe('STALE_OR_SUPPRESSED');
    owner.endMutation(token); await tick(); expect(load).toHaveBeenCalledTimes(2);
  });
  it('unsupported authority and sign-out cannot manufacture successful omitted no-match', async () => {
    const load = vi.fn(async () => ({})); const owner = new LegacyPreviousCurrentness(load);
    owner.configure({ ...scope(), authority: 'unsupported' });
    expect((await owner.ensure(['bench']))[0].state).toBe('STALE_OR_SUPPRESSED');
    owner.configure(scope('')); expect((await owner.ensure(['bench']))[0].state).toBe('STALE_OR_SUPPRESSED');
    expect(load).not.toHaveBeenCalled();
  });
});
