// @vitest-environment happy-dom
import { createElement, StrictMode, Suspense, startTransition, useLayoutEffect } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useHealthWorkoutRangeSnapshot, type HealthWorkoutRangeReadModel, type HealthWorkoutRangeDependencies } from './useHealthWorkoutRangeSnapshot';
import { HealthExerciseComparisonPreview } from './HealthExerciseComparisonPreview';
import { CompositeWorkoutReadIsolationError } from './compositeWorkoutReadProjection';
import { getTranslator } from '../../../../lib/i18n';
import * as projection from '../../../../lib/workoutExerciseComparisonProjection';
import { HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED, isHealthExerciseComparisonPreviewEnabled } from './healthExerciseComparisonPreviewConfig';
import { HealthExerciseComparisonBorrower, type HealthExerciseComparisonEvidence } from './healthExerciseComparisonBorrower';
import { WorkoutExerciseComparisonOwner, type WorkoutExerciseComparisonPublication } from '../../../../lib/workoutExerciseComparisonOwner';
import { WorkoutReadSnapshotCoordinator } from './verifiedWorkoutRangeSnapshot';

const sources = vi.hoisted(() => ({
  legacy: vi.fn(), canonical: vi.fn(), verify: vi.fn(), closed: vi.fn(),
}));
vi.mock('../../../../lib/healthLocalRuntime', () => ({
  createLocalHealthRepository: async (account: string) => ({ readAll: () => sources.legacy(account) }),
}));
vi.mock('../../../../lib/workoutRangeReader', () => ({
  WorkoutRangeReader: { open: async (account: string) => ({
    scope: { accountId: account, namespaceKey: `ns-${account}`, generationId: 'g1' },
    readAllActive: () => sources.canonical(account),
    verifyCurrentScope: () => sources.verify(account), close: () => sources.closed(account),
  }) },
}));
vi.mock('../../../../store/useAppStore', () => ({ useAppStore: (select: (state: unknown) => unknown) => select({ appSettings: { language: 'en' } }) }));

const KEY = { id: 'bench', name: 'Bench', type: 'strength' } as const;
const OTHER = { id: 'squat', name: 'Squat', type: 'strength' } as const;
const uuid = (n: number) => `${String(n).padStart(8, '0')}-aaaa-4aaa-8aaa-aaaaaaaaaaaa`;
function legacy(account = 'a', key = KEY, kg = 20) {
  return { exercise_blocks: [{ id: key.id, name: key.name, type: key.type, user_id: account, tags: [] }],
    workout_logs: [{ id: uuid(11), block_id: key.id, date: '2026-09-25', user_id: account,
      sort_order: 0, sets: [{ type: 'strength', set: 1, kg, reps: 5, done: true }] }] };
}
function canonical(account = 'a', key: { id: string; name: string; type: 'strength' } = KEY, kg = '120') {
  return [{ accountId: account, namespaceKey: `ns-${account}`, generationId: 'g1', entityId: uuid(1), localRevision: 1,
    session: { version: 1, id: uuid(1), localDate: '2026-09-30', entries: [{ id: uuid(2),
      exercise: { ...key, tags: [], cardioMode: null }, sets: [{ id: uuid(3), ordinal: 1, kind: 'strength',
        loadKind: 'external_weight', weightKg: kg, sourceValue: kg, sourceUnit: 'kg', reps: 8,
        assistedReps: 2, dropset: false, done: true }] }] } }];
}
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>(done => { resolve = done; });
  return { promise, resolve };
}
let latest: HealthWorkoutRangeReadModel;
let host: HTMLDivElement;
let root: Root | null;
type Props = { account?: string; date?: string; parent?: boolean; child?: boolean; keys?: readonly typeof KEY[]; edit?: string };
function Harness({ account = 'a', date = '2026-10-02', parent = true, child = true, keys = [KEY], edit }: Props) {
  latest = useHealthWorkoutRangeSnapshot(parent, account,
    { startDate: '2025-10-01', endDate: '2026-10-01' }, { startDate: '2026-10-01', endDate: '2026-10-31' },
    undefined, undefined, { enabled: isHealthExerciseComparisonPreviewEnabled(parent, child), selectedDate: date });
  return createElement('div', { 'data-edit': edit }, ...keys.map(key => latest.exerciseComparison
    ? createElement(HealthExerciseComparisonPreview, { key: key.id, read: latest.exerciseComparison,
      exerciseId: key.id, exerciseName: key.name, exerciseType: key.type }) : null));
}
async function render(props: Props = {}) {
  await act(async () => { root ??= createRoot(host); root.render(createElement(Harness, props)); });
  await flush();
}
async function flush() {
  await act(async () => { for (let n = 0; n < 20; n++) await Promise.resolve(); });
}
const status = () => host.querySelector('[data-health-exercise-comparison]')?.getAttribute('data-excomp-status');
const text = () => host.textContent ?? '';
const lane = (source: string) => host.querySelector(`[data-excomp-source="${source}"]`)?.textContent ?? '';

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  localStorage.clear();
  sources.legacy.mockReset().mockImplementation(async account => legacy(account));
  sources.canonical.mockReset().mockImplementation(async account => canonical(account));
  sources.verify.mockReset().mockResolvedValue(undefined); sources.closed.mockClear();
  host = document.createElement('div'); document.body.appendChild(host); root = null;
});

// Real concurrent rendering, not an effect-skipping simulation. Retain the
// publication produced by the mounted preview; never supersede it with a probe derive.
type ConcurrentProps = Props & {
  suspend?: boolean;
  factory?: HealthWorkoutRangeDependencies['createCoordinator'];
  onRender?: (props: ConcurrentProps, read: HealthWorkoutRangeReadModel) => void;
  onCommit?: (read: HealthWorkoutRangeReadModel) => void;
  onChildLayout?: (read: HealthWorkoutRangeReadModel) => void;
};
const concurrentSources: WorkoutReadSnapshotCoordinator[] = [];
const concurrentFactory = (account: string, storage: Storage) => {
  const owner = new WorkoutReadSnapshotCoordinator(account, storage);
  concurrentSources.push(owner);
  return owner;
};
const alternateConcurrentFactory = (account: string, storage: Storage) => concurrentFactory(account, storage);
const neverSettles = new Promise<void>(() => undefined);
function SuspendBeforeCommit({ suspend }: { suspend?: boolean }) {
  if (suspend) throw neverSettles;
  return null;
}
function ChildLayoutProbe({ read, run }: { read: HealthWorkoutRangeReadModel; run?: ConcurrentProps['onChildLayout'] }) {
  useLayoutEffect(() => { run?.(read); });
  return null;
}
function ConcurrentHarness(props: ConcurrentProps) {
  const { account = 'a', date = '2026-10-02', parent = true, child = true, keys = [KEY], edit,
    factory = concurrentFactory } = props;
  const read = useHealthWorkoutRangeSnapshot(parent, account,
    { startDate: '2025-10-01', endDate: '2026-10-01' }, { startDate: '2026-10-01', endDate: '2026-10-31' },
    { createCoordinator: factory }, undefined, { enabled: child, selectedDate: date });
  props.onRender?.(props, read);
  useLayoutEffect(() => { props.onCommit?.(read); });
  return createElement('div', { 'data-committed-account': account, 'data-date': date, 'data-edit': edit },
    ...keys.map(key => read.exerciseComparison ? createElement(HealthExerciseComparisonPreview, {
      key: key.id, read: read.exerciseComparison, exerciseId: key.id, exerciseName: key.name, exerciseType: key.type,
    }) : null),
    createElement(ChildLayoutProbe, { read, run: props.onChildLayout }),
    createElement(SuspendBeforeCommit, { suspend: props.suspend }));
}
function concurrentTree(props: ConcurrentProps, strict = false) {
  const tree = createElement(Suspense, { fallback: createElement('span', { 'data-fallback': true }, 'suspended') },
    createElement(ConcurrentHarness, props));
  return strict ? createElement(StrictMode, null, tree) : tree;
}
async function concurrentRender(props: ConcurrentProps, strict = false) {
  await act(async () => { root ??= createRoot(host); root.render(concurrentTree(props, strict)); });
  await flush();
}
async function waitForComplete(count = 1) {
  for (let n = 0; n < 30; n++) {
    await flush();
    if (host.querySelectorAll('[data-excomp-status="complete"]').length === count) return;
  }
  expect(host.querySelectorAll('[data-excomp-status="complete"]')).toHaveLength(count);
}
function retainMountedPublications() {
  const publications: WorkoutExerciseComparisonPublication[] = [];
  const derive = WorkoutExerciseComparisonOwner.prototype.derive;
  vi.spyOn(WorkoutExerciseComparisonOwner.prototype, 'derive').mockImplementation(async function (key) {
    const publication = await derive.call(this, key);
    if (publication) publications.push(publication);
    return publication;
  });
  return publications;
}
type Transition = 'account' | 'date' | 'child' | 'parent';
function changedScope(change: Transition): ConcurrentProps {
  return change === 'account' ? { account: 'b' } : change === 'date' ? { date: '2026-09-28' }
    : change === 'child' ? { child: false } : { parent: false };
}

describe('REL05G-EXCOMP-MOUNT-001 committed-tree lifetime', () => {
  it.each(['account', 'date', 'child', 'parent'] as const)('aborted %s render preserves the actual committed publication and source', async change => {
    concurrentSources.length = 0;
    sources.canonical.mockImplementation(async account => canonical(account, KEY, account === 'b' ? '777' : '120'));
    const publications = retainMountedPublications();
    const commits: HealthWorkoutRangeReadModel[] = [];
    const renders: Array<{ suspend: boolean; read: HealthWorkoutRangeReadModel }> = [];
    const callbacks: ConcurrentProps = {
      onCommit: read => { commits.push(read); },
      onRender: (props, read) => { renders.push({ suspend: !!props.suspend, read }); },
    };
    const initial = concurrentTree(callbacks);
    await act(async () => { root = createRoot(host); root.render(initial); });
    await waitForComplete();
    const committed = commits.at(-1)!;
    const publication = publications.at(-1)!;
    const source = concurrentSources.at(-1)!.captureCurrentSnapshot()!;
    const commitCount = commits.length;
    expect(publication.isCurrent()).toBe(true);
    expect(source.isCurrent()).toBe(true);
    await act(async () => { startTransition(() => root!.render(concurrentTree({ ...callbacks, ...changedScope(change), suspend: true }))); });
    await flush();
    expect(renders.some(value => value.suspend)).toBe(true);
    expect(renders.filter(value => value.suspend).every(value => value.read.exerciseComparison === undefined)).toBe(true);
    expect(commits).toHaveLength(commitCount);
    expect(commits.at(-1)).toBe(committed);
    expect(host.querySelector('[data-committed-account]')?.getAttribute('data-committed-account')).toBe('a');
    expect(host.querySelector('[data-fallback]')).toBeNull();
    expect(text()).not.toContain('777 kg');
    expect(source.isCurrent()).toBe(true);
    expect(publication.isCurrent()).toBe(true);
    const consume = vi.fn();
    expect(await publication.publish(consume)).toBe(true);
    expect(consume).toHaveBeenCalledWith(expect.objectContaining({ scope: expect.objectContaining({ accountId: 'a', selectedDate: '2026-10-02' }) }));
    // Cancel with the exact already-committed React element (a valid bailout).
    await act(async () => root!.render(initial));
    await flush();
    expect(publication.isCurrent()).toBe(true);
    expect(await publication.publish(vi.fn())).toBe(true);
    expect(source.isCurrent()).toBe(true);
    expect(concurrentSources).toHaveLength(1);
    expect(sources.legacy).toHaveBeenCalledTimes(1);
    expect(sources.canonical).toHaveBeenCalledTimes(1);
  });
  it.each(['account', 'date', 'child', 'parent'] as const)('committed %s transition fences descendant layout publication and never revives old A', async change => {
    concurrentSources.length = 0;
    const publications = retainMountedPublications();
    await concurrentRender({}); await waitForComplete();
    const publication = publications.at(-1)!;
    const source = concurrentSources.at(-1)!.captureCurrentSnapshot()!;
    const childReads: HealthWorkoutRangeReadModel[] = [];
    const attempts: Promise<boolean>[] = [];
    const consume = vi.fn();
    await concurrentRender({ ...changedScope(change), onChildLayout: read => {
      childReads.push(read);
      // Descendant layout effects run BEFORE the parent's reconciliation. An
      // isCurrent() precheck alone is not authorization; publish must fence its continuation.
      attempts.push(publication.publish(consume));
    } });
    expect(childReads[0]!.exerciseComparison).toBeUndefined();
    expect(await Promise.all(attempts)).not.toContain(true);
    expect(consume).not.toHaveBeenCalled();
    expect(publication.isCurrent()).toBe(false);
    expect(source.isCurrent()).toBe(change === 'date' || change === 'child');
    if (change === 'child' || change === 'parent') expect(host.querySelector('[data-health-exercise-comparison]')).toBeNull();
    else await waitForComplete();
    await concurrentRender({}); await waitForComplete();
    expect(publications.at(-1)).not.toBe(publication);
    expect(await publication.publish(vi.fn())).toBe(false);
    const expectedLoads = change === 'account' ? 3 : change === 'parent' ? 2 : 1;
    expect(sources.legacy).toHaveBeenCalledTimes(expectedLoads);
    expect(sources.canonical).toHaveBeenCalledTimes(expectedLoads);
  });
  it('an aborted source-factory replacement does not promote a borrower or start another source', async () => {
    concurrentSources.length = 0;
    const publications = retainMountedPublications();
    const initial = concurrentTree({});
    await act(async () => { root = createRoot(host); root.render(initial); }); await waitForComplete();
    const publication = publications.at(-1)!;
    await act(async () => { startTransition(() => root!.render(concurrentTree({ factory: alternateConcurrentFactory, suspend: true }))); });
    await flush();
    expect(await publication.publish(vi.fn())).toBe(true);
    await act(async () => root!.render(initial)); await flush();
    expect(await publication.publish(vi.fn())).toBe(true);
    expect(concurrentSources).toHaveLength(1);
    expect(sources.legacy).toHaveBeenCalledTimes(1); expect(sources.canonical).toHaveBeenCalledTimes(1);
  });
  it('a committed source-factory replacement borrows only the new committed source and loads it once', async () => {
    concurrentSources.length = 0;
    const publications = retainMountedPublications();
    await concurrentRender({}); await waitForComplete();
    const old = publications.at(-1)!;
    await concurrentRender({ factory: alternateConcurrentFactory }); await waitForComplete();
    expect(await old.publish(vi.fn())).toBe(false);
    expect(concurrentSources).toHaveLength(2);
    expect(sources.legacy).toHaveBeenCalledTimes(2); expect(sources.canonical).toHaveBeenCalledTimes(2);
    expect(await publications.at(-1)!.publish(vi.fn())).toBe(true);
  });
  it('durable/source invalidation still fences immediately while a parent-disable render is suspended', async () => {
    concurrentSources.length = 0;
    const publications = retainMountedPublications();
    let committed!: HealthWorkoutRangeReadModel;
    const initial = concurrentTree({ onCommit: read => { committed = read; } });
    await act(async () => { root = createRoot(host); root.render(initial); }); await waitForComplete();
    const publication = publications.at(-1)!;
    await act(async () => { startTransition(() => root!.render(concurrentTree({ parent: false, suspend: true }))); });
    await flush(); expect(publication.isCurrent()).toBe(true);
    await act(async () => { committed.invalidateAndReload(); expect(publication.isCurrent()).toBe(false); });
    expect(await publication.publish(vi.fn())).toBe(false);
    await act(async () => root!.render(initial)); await waitForComplete();
    expect(sources.legacy).toHaveBeenCalledTimes(2); expect(sources.canonical).toHaveBeenCalledTimes(2);
  });
  it('StrictMode card reorder/remove/add/key change settles with no source reload, listener leak or close loop', async () => {
    concurrentSources.length = 0;
    const publications = retainMountedPublications();
    const derive = vi.spyOn(projection, 'projectWorkoutExerciseComparison');
    const closeSource = vi.spyOn(WorkoutReadSnapshotCoordinator.prototype, 'close');
    const closeBorrower = vi.spyOn(HealthExerciseComparisonBorrower.prototype, 'close');
    const borrowers = new Set<HealthExerciseComparisonBorrower>();
    const setContext = HealthExerciseComparisonBorrower.prototype.setContext;
    vi.spyOn(HealthExerciseComparisonBorrower.prototype, 'setContext').mockImplementation(function (context) {
      borrowers.add(this); return setContext.call(this, context);
    });
    const third = { id: 'press', name: 'Press', type: 'strength' } as typeof KEY;
    const keys = [KEY, OTHER as typeof KEY, third];
    await concurrentRender({ keys }, true); await waitForComplete(3);
    for (let n = 0; n < 4; n++) await flush();
    const initialDerives = derive.mock.calls.length;
    const reads = [sources.legacy.mock.calls.length, sources.canonical.mock.calls.length];
    const ownerCount = concurrentSources.length;
    const borrowerCount = borrowers.size;
    expect(borrowerCount).toBeGreaterThan(0);
    expect(borrowerCount).toBeLessThanOrEqual(ownerCount + 1);
    for (let n = 0; n < 4; n++) await concurrentRender({ keys, edit: String(n) }, true);
    expect(derive).toHaveBeenCalledTimes(initialDerives);
    for (let n = 0; n < 3; n++) {
      await concurrentRender({ keys: [third, KEY, OTHER as typeof KEY] }, true); await waitForComplete(3);
      await concurrentRender({ keys: [third, KEY] }, true); await waitForComplete(2);
      await concurrentRender({ keys }, true); await waitForComplete(3);
    }
    await concurrentRender({ keys: [{ ...KEY, name: 'Renamed' } as typeof KEY, OTHER as typeof KEY, third] }, true);
    await waitForComplete(3);
    const settledDerives = derive.mock.calls.length;
    for (let n = 0; n < 6; n++) await flush();
    expect(derive).toHaveBeenCalledTimes(settledDerives);
    expect(settledDerives - initialDerives).toBeLessThanOrEqual(30);
    expect(concurrentSources).toHaveLength(ownerCount);
    expect(borrowers.size).toBe(borrowerCount);
    expect([sources.legacy.mock.calls.length, sources.canonical.mock.calls.length]).toEqual(reads);
    await act(async () => { root!.unmount(); root = null; });
    expect(await Promise.all(publications.map(publication => publication.publish(vi.fn())))).not.toContain(true);
    // Each shared source is owned/closed by the range hook, not by borrowers.
    expect(closeSource.mock.contexts).toHaveLength(ownerCount);
    expect(new Set(closeSource.mock.contexts).size).toBe(ownerCount);
    expect(closeBorrower.mock.contexts).toHaveLength(borrowerCount);
    expect(new Set(closeBorrower.mock.contexts).size).toBe(borrowerCount);
    for (const borrower of borrowers) expect((borrower as unknown as { listeners: Set<() => void> }).listeners.size).toBe(0);
  });
  it('double capture cannot publish empty metadata from an older real snapshot with new populated evidence', async () => {
    sources.legacy.mockResolvedValue({ exercise_blocks: [], workout_logs: [] }); sources.canonical.mockResolvedValue([]);
    const coordinator = new WorkoutReadSnapshotCoordinator('a', localStorage);
    await coordinator.load(); const empty = coordinator.captureCurrentSnapshot()!;
    sources.legacy.mockImplementation(async account => legacy(account)); sources.canonical.mockImplementation(async account => canonical(account));
    await coordinator.load(); const populated = coordinator.captureCurrentSnapshot()!;
    let capture = 0;
    const borrower = new HealthExerciseComparisonBorrower({ captureCurrentSnapshot: () => capture++ === 0 ? empty : populated }, () => true);
    const publication = await borrower.setContext({ enabled: true, selectedDate: '2026-10-02' }).derive(KEY);
    expect(empty.snapshot).not.toBe(populated.snapshot); expect(empty.isCurrent()).toBe(false); expect(populated.isCurrent()).toBe(true);
    const consume = vi.fn(); expect(await publication!.publish(consume)).toBe(false); expect(consume).not.toHaveBeenCalled();
    borrower.close(); coordinator.close();
  });
  it('invalidate between the explicit source capture and owner capture never becomes verified empty', async () => {
    const coordinator = new WorkoutReadSnapshotCoordinator('a', localStorage); await coordinator.load();
    let first = true;
    const borrower = new HealthExerciseComparisonBorrower({ captureCurrentSnapshot: () => {
      const publication = coordinator.captureCurrentSnapshot();
      if (first) { first = false; coordinator.invalidate(); }
      return publication;
    } }, () => true);
    expect(await borrower.setContext({ enabled: true, selectedDate: '2026-10-02' }).derive(KEY)).toBeNull();
    borrower.close(); coordinator.close();
  });
});
afterEach(() => { if (root) act(() => root?.unmount()); root = null; host.remove(); vi.restoreAllMocks(); });

describe('mounted default-OFF comparison on the REAL shared coordinator/owner/projection', () => {
  it('ships literal OFF; invalid parent-OFF/child-ON does not mount, construct or read', async () => {
    expect(HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED).toBe(false);
    expect(isHealthExerciseComparisonPreviewEnabled(true)).toBe(false);
    for (const child of [false, true]) {
      await render({ parent: false, child });
      expect(latest.exerciseComparison).toBeUndefined(); expect(text()).toBe('');
    }
    expect(sources.legacy).not.toHaveBeenCalled(); expect(sources.canonical).not.toHaveBeenCalled();
  });
  it('parent-ON/child-OFF leaves existing range views and read budget unchanged', async () => {
    await render({ child: false });
    expect(latest.phase).toBe('settled'); expect(latest.exerciseComparison).toBeUndefined();
    expect(sources.legacy).toHaveBeenCalledTimes(1); expect(sources.canonical).toHaveBeenCalledTimes(1);
  });
  it('renders both source dates/facts separately, without winner or planning controls', async () => {
    await render();
    expect(status()).toBe('complete');
    expect(lane('legacy')).toContain('2026-09-25'); expect(lane('legacy')).toContain('20 kg');
    expect(lane('canonical')).toContain('2026-09-30'); expect(lane('canonical')).toContain('120 kg');
    expect(lane('canonical')).toContain('assisted 2; unassisted 6');
    expect(text()).toContain('legacy-only and unchanged'); expect(text()).toContain('No combined PR or source winner');
    expect(host.querySelectorAll('[data-health-exercise-comparison] input')).toHaveLength(0);
    expect(host.querySelectorAll('[data-health-exercise-comparison] button')).toHaveLength(1);
    expect(host.querySelector('[data-health-exercise-comparison]')?.getAttribute('aria-label')).toContain('read-only QA');
  });
  it.each(['legacy', 'canonical'] as const)('valid %s-only evidence is not failure/partial', async source => {
    if (source === 'legacy') sources.canonical.mockResolvedValue([]);
    else sources.legacy.mockResolvedValue({ exercise_blocks: [], workout_logs: [] });
    await render(); expect(status()).toBe('complete');
    expect(lane(source)).toContain('kg');
    expect(lane(source === 'legacy' ? 'canonical' : 'legacy')).toContain('No eligible exercise match');
    expect(host.querySelector('[data-excomp-partial]')).toBeNull();
  });
  it.each(['legacy', 'canonical'] as const)('ordinary %s error retains only qualified incomplete surviving evidence', async failed => {
    sources[failed].mockRejectedValue(new Error('PRIVATE_FAILED_SOURCE_PAYLOAD'));
    await render(); expect(status()).toBe('partial_data');
    expect(lane(failed)).toContain('absence is not verified');
    expect(lane(failed)).not.toContain('No eligible');
    expect(lane(failed === 'legacy' ? 'canonical' : 'legacy')).toContain('kg');
    expect(text()).toContain('Incomplete evidence'); expect(text()).not.toContain('PRIVATE');
    expect(host.querySelector('[data-excomp-verified-empty]')).toBeNull();
  });
  it('canonical typed isolation suppresses BOTH lanes and reveals no payload', async () => {
    sources.canonical.mockRejectedValue(new CompositeWorkoutReadIsolationError('ACCOUNT_MISMATCH'));
    await render(); expect(status()).toBe('isolation_error');
    expect(host.querySelector('[data-excomp-source]')).toBeNull();
    expect(text()).toContain('Neither source is published');
  });
  it('both ordinary failures are unavailable, never empty or no-match', async () => {
    sources.canonical.mockRejectedValue(new Error('private')); sources.legacy.mockRejectedValue(new Error('private'));
    await render(); expect(status()).toBe('unavailable');
    expect(text()).toContain('empty history is not verified'); expect(text()).not.toContain('No eligible');
  });
  it('verified both-source storage empty is distinct from successful no eligible match', async () => {
    sources.canonical.mockResolvedValue([]); sources.legacy.mockResolvedValue({ exercise_blocks: [], workout_logs: [] });
    await render(); expect(host.querySelector('[data-excomp-verified-empty]')).not.toBeNull();
    sources.canonical.mockImplementation(async account => canonical(account, OTHER));
    await act(async () => latest.invalidateAndReload()); await flush();
    expect(status()).toBe('complete'); expect(host.querySelector('[data-excomp-verified-empty]')).toBeNull();
    expect(host.querySelectorAll('[data-excomp-no-match]')).toHaveLength(2);
  });
  it('loading does not claim unavailable or empty', async () => {
    const gate = deferred(); sources.legacy.mockImplementation(async account => { await gate.promise; return legacy(account); });
    await render(); expect(status()).toBe('loading'); expect(text()).toContain('Loading comparison');
    expect(host.querySelector('[data-excomp-source]')).toBeNull(); gate.resolve(); await flush(); expect(status()).toBe('complete');
  });
  it('C26 account A→B→A rejects old A port and B payload while borrowing one load per lifetime', async () => {
    await render(); const old = latest.exerciseComparison!.port;
    const publication = await old.derive(KEY);
    sources.canonical.mockImplementation(async account => canonical(account, KEY, account === 'b' ? '999' : '120'));
    await render({ account: 'b' }); expect(lane('canonical')).toContain('999 kg');
    await render(); expect(lane('canonical')).toContain('120 kg'); expect(text()).not.toContain('999');
    const consume = vi.fn(); expect(await publication!.publish(consume)).toBe(false); expect(consume).not.toHaveBeenCalled();
    expect(await old.derive(KEY)).toBeNull();
    expect(sources.legacy).toHaveBeenCalledTimes(3); expect(sources.canonical).toHaveBeenCalledTimes(3);
  });
  it('C27 selectedDate ABA revokes previous A without another source scan', async () => {
    await render(); const old = await latest.exerciseComparison!.port.derive(KEY);
    await render({ date: '2026-09-29' }); expect(lane('canonical')).toContain('No eligible');
    await render(); expect(lane('canonical')).toContain('120 kg');
    expect(await old!.publish(vi.fn())).toBe(false); expect(sources.canonical).toHaveBeenCalledTimes(1);
  });
  it('C27 same-key out-of-order final verification cannot publish older request', async () => {
    await render(); const port = latest.exerciseComparison!.port;
    const gate = deferred(); sources.verify.mockImplementationOnce(() => gate.promise);
    const older = port.derive(KEY); const newer = await port.derive(KEY);
    let accepted: HealthExerciseComparisonEvidence | undefined;
    expect(await newer!.publish(value => { accepted = value; })).toBe(true);
    gate.resolve(); expect(await older).toBeNull();
    expect(accepted?.comparison.status).toBe('complete');
    expect(sources.legacy).toHaveBeenCalledTimes(1); expect(sources.canonical).toHaveBeenCalledTimes(1);
  });
  it('C27 different visible keys publish independently and removed/re-added cards cannot revive a request', async () => {
    await render({ keys: [KEY, OTHER as typeof KEY] });
    expect(host.querySelectorAll('[data-excomp-status="complete"]')).toHaveLength(2);
    const port = latest.exerciseComparison!.port;
    const first = await port.derive(KEY); const second = await port.derive(OTHER);
    expect(await first!.publish(vi.fn())).toBe(true); expect(await second!.publish(vi.fn())).toBe(true);
    await render({ keys: [OTHER as typeof KEY] });
    expect(await first!.publish(vi.fn())).toBe(false);
    await render({ keys: [KEY, OTHER as typeof KEY] });
    expect(await first!.publish(vi.fn())).toBe(false);
    expect(sources.canonical).toHaveBeenCalledTimes(1);
  });
  it('C28 enable ABA closes only borrower, not shared source or current range views', async () => {
    await render(); const old = await latest.exerciseComparison!.port.derive(KEY);
    const closes = sources.closed.mock.calls.length;
    await render({ child: false }); expect(latest.exerciseComparison).toBeUndefined(); expect(latest.previousView).not.toBeNull();
    expect(sources.closed).toHaveBeenCalledTimes(closes);
    await render(); expect(await old!.publish(vi.fn())).toBe(false); expect(status()).toBe('complete');
    expect(sources.canonical).toHaveBeenCalledTimes(1);
  });
  it('C28 generation loss between derive and publish withholds all evidence', async () => {
    await render(); const old = await latest.exerciseComparison!.port.derive(KEY);
    sources.verify.mockRejectedValue(new Error('generation changed'));
    const consume = vi.fn(); expect(await old!.publish(consume)).toBe(false); expect(consume).not.toHaveBeenCalled();
    await render({ edit: 'rerender' }); expect(host.querySelector('[data-excomp-source]')).toBeNull();
  });
  it('C28 source invalidation during derive, device change and recovery fence old continuations', async () => {
    await render(); const gate = deferred(); sources.verify.mockImplementationOnce(() => gate.promise);
    const old = latest.exerciseComparison!.port.derive(KEY);
    await act(async () => latest.invalidateAndReload()); await flush(); gate.resolve(); expect(await old).toBeNull();
    const fresh = await latest.exerciseComparison!.port.derive(KEY);
    const { HEALTH_ROUTINE_DEVICE_ID_KEY } = await import('../../../../lib/workoutLocalReaderAuthority');
    localStorage.setItem(HEALTH_ROUTINE_DEVICE_ID_KEY, 'changed');
    expect(await fresh!.publish(vi.fn())).toBe(false);
    await act(async () => latest.invalidateAndReload()); await flush(); expect(status()).toBe('complete');
  });
  it('C28 unmount/owner close rejects a late mounted continuation', async () => {
    await render(); const port = latest.exerciseComparison!.port;
    const gate = deferred(); sources.verify.mockImplementationOnce(() => gate.promise);
    const late = port.derive(KEY);
    act(() => root!.unmount()); root = null; gate.resolve();
    expect(await late).toBeNull(); expect(await port.derive(KEY)).toBeNull(); expect(text()).toBe('');
  });
  it('renders stale suppression distinctly when final scope verification fails during a mounted request', async () => {
    await render(); sources.verify.mockRejectedValue(new Error('scope no longer current'));
    await act(async () => latest.exerciseComparison!.port.release()); await flush();
    expect(status()).toBe('stale'); expect(text()).toContain('Stale comparison suppressed');
    expect(host.querySelector('[data-excomp-source]')).toBeNull();
  });
  it('never normalizes analytical key name/type/case in the mounted consumer', async () => {
    await render({ keys: [{ ...KEY, name: 'bench' } as typeof KEY] });
    expect(lane('legacy')).toContain('20 kg'); expect(lane('canonical')).toContain('No eligible exercise match');
    await render({ keys: [{ ...KEY, id: 'Bench' } as typeof KEY] });
    expect(host.querySelectorAll('[data-excomp-no-match]')).toHaveLength(2);
    expect(sources.canonical).toHaveBeenCalledTimes(1);
  });
  it('adds zero full source reads on derive, set edits, date changes or card churn', async () => {
    const derive = vi.spyOn(projection, 'projectWorkoutExerciseComparison');
    await render(); const count = derive.mock.calls.length;
    await render({ edit: 'kg keystroke' }); await render({ edit: 'reps keystroke' });
    expect(derive).toHaveBeenCalledTimes(count);
    for (let n = 0; n < 15; n++) await latest.exerciseComparison!.port.derive(KEY);
    await render({ date: '2026-10-03' }); await render({ keys: [] }); await render();
    expect(sources.legacy).toHaveBeenCalledTimes(1); expect(sources.canonical).toHaveBeenCalledTimes(1);
    expect(Object.keys(latest.exerciseComparison!)).toEqual(['port', 'retry', 'phase']);
    expect(Object.keys(latest.exerciseComparison!.port)).not.toContain('currentSnapshot');
  });
  it('preview scope/partial/no-match copy is localized with the same accessible semantics', () => {
    for (const lang of ['en', 'ko', 'ja'] as const) {
      const t = getTranslator(lang);
      for (const key of ['exerciseComparisonScope', 'exerciseComparisonPartial', 'exerciseComparisonNoMatch',
        'exerciseComparisonIsolation', 'exerciseComparisonUnavailable', 'exerciseComparisonCompatibility'] as const)
        expect(t(key)).not.toBe(key);
    }
  });
});
