import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { HealthWorkoutAdoptionCapture } from './healthLocalRepository';
const mocks = vi.hoisted(() => ({ getSession: vi.fn(), onAuthStateChange: vi.fn(), from: vi.fn(), select: vi.fn(), eq: vi.fn(), order: vi.fn(), limit: vi.fn(), driver: vi.fn(), capture: vi.fn(), close: vi.fn(), unsubscribe: vi.fn() }));
vi.mock('./supabase', () => ({ supabase: { auth: { getSession: mocks.getSession, onAuthStateChange: mocks.onAuthStateChange }, from: mocks.from } }));
vi.mock('./healthLocalRepository', () => ({ createLocalHealthDriver: mocks.driver }));
import { compareWorkoutSnapshots, createWorkoutCloudComparison, workoutRowsFromCapture, WORKOUT_COMPARISON_LIMIT } from './healthWorkoutCloudComparison';
import { HEALTH_RECOVERY_DATASETS, validateHealthRecoveryDatasets, validateHealthWorkoutRecord, type HealthRecoveryDatasets } from './healthRecoveryExport';
const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const ID = '11111111-1111-4111-8111-111111111111', OTHER = '22222222-2222-4222-8222-222222222222';
const row = (id = ID) => ({ id, user_id: A, date: '2026-10-30', block_id: OTHER, sort_order: 0, sets: [{ type: 'strength', set: 1, kg: 50, reps: 5, done: true }] });
const capture = (): HealthWorkoutAdoptionCapture => ({ accountId: A, sourceSchemaVersion: 1, importState: { accountId: A, status: 'VERIFIED_IMPORT_COMPLETE', datasetCounts: { workout_logs: 1 } }, workouts: [{ accountId: A, storageKey: `${A}:workout_logs:${ID}`, record: row() }], exerciseBlocks: [] } as unknown as HealthWorkoutAdoptionCapture);
const session = () => ({ data: { session: { user: { id: A }, access_token: 'test-token', expires_at: Math.floor(Date.now() / 1000) + 600 } }, error: null });
let authChanged: (event: string, session: unknown) => void;
beforeEach(() => {
  vi.resetAllMocks();
  mocks.getSession.mockResolvedValue(session());
  mocks.onAuthStateChange.mockImplementation(callback => { authChanged = callback; return { data: { subscription: { unsubscribe: mocks.unsubscribe } } }; });
  mocks.driver.mockResolvedValue({ captureWorkoutAdoptionSource: mocks.capture, close: mocks.close });
  mocks.capture.mockResolvedValue(capture());
  mocks.from.mockReturnValue({ select: mocks.select }); mocks.select.mockReturnValue({ eq: mocks.eq }); mocks.eq.mockReturnValue({ order: mocks.order }); mocks.order.mockReturnValue({ limit: mocks.limit });
  mocks.limit.mockResolvedValue({ data: [row()], count: 1, error: null });
});

describe('exact saved-workout comparison', () => {
  it('classifies every identity without mutation, date/name matching, or deletion inference', () => {
    const source = [row(), row(OTHER)], remote = [row(), { ...row('33333333-3333-4333-8333-333333333333'), date: row().date }];
    const before = structuredClone([source, remote]);
    const report = compareWorkoutSnapshots(A, source, remote);
    expect(report.counts).toEqual({ localOnly: 1, remoteOnly: 1, matching: 1, divergent: 0, unverifiable: 0 });
    expect(report.details.localOnly[0].id).toBe(OTHER);
    expect([source, remote]).toEqual(before);
    expect('deleted' in report.counts).toBe(false);
  });
  it.each(['date', 'sets', 'block_id', 'sort_order'] as const)('detects changed %s for the same ID', field => {
    const changed = { ...row(), [field]: field === 'sets' ? [{ ...row().sets[0], kg: 60 }] : field === 'date' ? '2026-10-29' : field === 'block_id' ? ID : 1 };
    expect(compareWorkoutSnapshots(A, [row()], [changed]).counts.divergent).toBe(1);
  });
  it('ignores object-key order but preserves set order and numeric representation', () => {
    expect(compareWorkoutSnapshots(A, [row()], [{ ...row(), sets: [{ done: true, kg: 50, reps: 5, set: 1, type: 'strength' }] }]).counts.matching).toBe(1);
    expect(compareWorkoutSnapshots(A, [row()], [{ ...row(), sets: [{ ...row().sets[0], kg: '50' }] }]).counts.divergent).toBe(1);
  });
  it.each([{ extra: 'unknown' }, { sets: 'invalid' }, { date: '2026-02-30' }, { block_id: 'bad' }, { sets: [{ ...row().sets[0], is_dropset: NaN }] }])('does not claim equality for unsupported or malformed content', change => {
    expect(compareWorkoutSnapshots(A, [{ ...row(), ...change }], [row()]).counts.unverifiable).toBe(1);
  });
  it.each([[row(), row()], [{ ...row(), id: '' }], [{ ...row(), user_id: B }]])('rejects ambiguous identity and ownership', rows => {
    expect(() => compareWorkoutSnapshots(A, rows, [])).toThrow();
  });
  it('rejects a source beyond the complete-comparison limit', () => {
    expect(() => compareWorkoutSnapshots(A, Array.from({ length: WORKOUT_COMPARISON_LIMIT + 1 }, () => row()), [])).toThrow('limit');
  });
  it('keeps two empty verified sources empty, not synchronized', () => {
    expect(compareWorkoutSnapshots(A, [], []).counts).toEqual({ localOnly: 0, remoteOnly: 0, matching: 0, divergent: 0, unverifiable: 0 });
  });
  it('compares valid assisted repetitions without pretending to have an exercise catalog', () => {
    const assisted = { ...row(), sets: [{ ...row().sets[0], assisted_reps: 1 }] };
    expect(compareWorkoutSnapshots(A, [assisted], [structuredClone(assisted)]).counts.matching).toBe(1);
    expect(compareWorkoutSnapshots(A, [assisted], [{ ...assisted, sets: [{ ...assisted.sets[0], assisted_reps: 2 }] }]).counts.divergent).toBe(1);
    const bodyweight = { ...assisted, sets: [{ ...assisted.sets[0], type: 'bodyweight' }] };
    expect(compareWorkoutSnapshots(A, [bodyweight], [structuredClone(bodyweight)]).counts.matching).toBe(1);
  });
  it.each([0, 6, -1, 1.5, '1', null])('keeps invalid assisted repetitions unverifiable: %s', assisted_reps => {
    const invalid = { ...row(), sets: [{ ...row().sets[0], assisted_reps }] };
    expect(compareWorkoutSnapshots(A, [invalid], [invalid]).counts.unverifiable).toBe(1);
  });
  it('rejects assisted repetitions on cardio sets', () => {
    const invalid = { ...row(), sets: [{ type: 'cardio', set: 1, time: '10:00', distance: 1, pace: '', done: true, assisted_reps: 1 }] };
    expect(compareWorkoutSnapshots(A, [invalid], [invalid]).counts.unverifiable).toBe(1);
  });
  it('preserves the full recovery validator catalog and ownership checks', () => {
    const assisted = { ...row(), sets: [{ ...row().sets[0], assisted_reps: 1 }] };
    expect(validateHealthWorkoutRecord(assisted, A)).toEqual([]);
    const datasets = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(key => [key, key === 'workout_logs' ? [assisted] : []])) as HealthRecoveryDatasets;
    expect(validateHealthRecoveryDatasets(datasets, A).map(issue => issue.code)).toContain('assisted_reps_not_allowed_for_exercise_type');
    datasets.exercise_blocks = [{ id: OTHER, user_id: A, name: 'Squat', type: 'strength', tags: [], cardio_mode: null }];
    expect(validateHealthRecoveryDatasets(datasets, A)).toEqual([]);
    datasets.exercise_blocks[0].type = 'cardio';
    expect(validateHealthRecoveryDatasets(datasets, A).map(issue => issue.code)).toContain('assisted_reps_not_allowed_for_exercise_type');
    expect(validateHealthWorkoutRecord({ ...assisted, user_id: B }, A).map(issue => issue.code)).toContain('source_owner_mismatch');
  });
  it.each(['account', 'pending', 'count', 'wrapper'] as const)('rejects unavailable local authority: %s', reason => {
    const source = capture() as { -readonly [K in keyof HealthWorkoutAdoptionCapture]: HealthWorkoutAdoptionCapture[K] };
    if (reason === 'account') source.accountId = B;
    if (reason === 'pending') (source.importState as { status: string }).status = 'IMPORT_COMMITTED_PENDING_READBACK';
    if (reason === 'count') source.importState.datasetCounts.workout_logs = 0;
    if (reason === 'wrapper') source.workouts[0].accountId = B;
    expect(() => workoutRowsFromCapture(A, source)).toThrow();
  });
});

describe('manual read-only observation lifetime', () => {
  it('offers only a cloned exact local-only intent while its comparison owner remains current', async () => {
    mocks.limit.mockResolvedValue({ data: [], count: 0, error: null });
    const owner = createWorkoutCloudComparison(A, () => true, vi.fn());
    expect(owner.localOnlyRecord(ID)).toBeNull();
    await owner.compare();
    const intent = owner.localOnlyRecord(ID)!;
    intent.sort_order = 99;
    expect(owner.localOnlyRecord(ID)).toEqual(row());
    expect(owner.localOnlyRecord(OTHER)).toBeNull();
    owner.cancel(); expect(() => owner.localOnlyRecord(ID)).toThrow('stale');
  });
  it('reads the owner capture and one complete authenticated SELECT; has no write/apply path', async () => {
    const owner = createWorkoutCloudComparison(A, () => true, vi.fn());
    expect((await owner.compare()).counts.matching).toBe(1);
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('workout_logs');
    expect(mocks.select).toHaveBeenCalledExactlyOnceWith('*', { count: 'exact' });
    expect(mocks.eq).toHaveBeenCalledExactlyOnceWith('user_id', A);
    expect(mocks.limit).toHaveBeenCalledExactlyOnceWith(WORKOUT_COMPARISON_LIMIT);
    expect(mocks.capture).toHaveBeenCalledExactlyOnceWith(A);
    expect(mocks.driver).toHaveBeenCalledExactlyOnceWith({ existingOnly: true });
    expect(mocks.close).toHaveBeenCalledOnce();
    owner.cancel(); expect(mocks.unsubscribe).toHaveBeenCalledOnce();
  });
  it.each([{ data: [], count: 1 }, { data: [row()], count: null }, { data: [row()], count: 501 }, { data: null, count: 0 }, { data: [], count: 0, error: { code: '401' } }])('rejects truncation/pagination failures instead of treating them as empty', async result => {
    mocks.limit.mockResolvedValue({ error: null, ...result });
    await expect(createWorkoutCloudComparison(A, () => true, vi.fn()).compare()).rejects.toThrow('incomplete');
  });
  it.each(['expired', 'missing', 'foreign'] as const)('does not read sources with %s authentication', async reason => {
    const current = session();
    if (reason === 'expired') current.data.session.expires_at = 1;
    if (reason === 'missing') current.data.session.access_token = '';
    if (reason === 'foreign') current.data.session.user.id = B;
    mocks.getSession.mockResolvedValue(current);
    await expect(createWorkoutCloudComparison(A, () => true, vi.fn()).compare()).rejects.toThrow('auth');
    expect(mocks.capture).not.toHaveBeenCalled(); expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects offline and unavailable local authority without a cloud read', async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await expect(createWorkoutCloudComparison(A, () => true, vi.fn()).compare()).rejects.toThrow('offline');
    vi.unstubAllGlobals();
    mocks.capture.mockRejectedValue(new Error('health_adoption_source_unstable'));
    await expect(createWorkoutCloudComparison(A, () => true, vi.fn()).compare()).rejects.toThrow('unstable');
    expect(mocks.from).not.toHaveBeenCalled();
  });
  it('rejects A/B/A and a late remote completion, and invalidates an already visible result', async () => {
    let resolve!: (value: unknown) => void;
    mocks.limit.mockReturnValue(new Promise(done => { resolve = done; }));
    const invalidated = vi.fn();
    const owner = createWorkoutCloudComparison(A, () => true, invalidated);
    const pending = owner.compare();
    await vi.waitFor(() => expect(mocks.limit).toHaveBeenCalled());
    authChanged('SIGNED_IN', { user: { id: B } }); authChanged('SIGNED_IN', { user: { id: A } });
    resolve({ data: [row()], count: 1, error: null });
    await expect(pending).rejects.toThrow('stale');
    expect(owner.isCurrent()).toBe(false); expect(invalidated).toHaveBeenCalledOnce();
  });
  it('rejects currentness lost while opening the local driver before capture', async () => {
    let current = true;
    mocks.driver.mockImplementation(async () => { current = false; return { captureWorkoutAdoptionSource: mocks.capture, close: mocks.close }; });
    await expect(createWorkoutCloudComparison(A, () => current, vi.fn()).compare()).rejects.toThrow('stale');
    expect(mocks.capture).not.toHaveBeenCalled(); expect(mocks.close).toHaveBeenCalledOnce();
  });
  it('rejects auth changed at final verification without an auth event', async () => {
    mocks.getSession.mockResolvedValueOnce(session()).mockResolvedValueOnce({ data: { session: null }, error: null });
    await expect(createWorkoutCloudComparison(A, () => true, vi.fn()).compare()).rejects.toThrow('auth');
  });
  it('supports another explicit comparison but never automatically retries a failed read', async () => {
    mocks.limit.mockRejectedValueOnce(new Error('offline'));
    const owner = createWorkoutCloudComparison(A, () => true, vi.fn());
    await expect(owner.compare()).rejects.toThrow('offline');
    await expect(owner.compare()).rejects.toThrow('started'); owner.cancel();
    expect((await createWorkoutCloudComparison(A, () => true, vi.fn()).compare()).counts.matching).toBe(1);
    expect(mocks.limit).toHaveBeenCalledTimes(2);
  });
});
