import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ModuleKind, createCompilerHost, createProgram, createSourceFile, getPreEmitDiagnostics, parseJsonConfigFileContent,
  readConfigFile, sys, transpileModule } from 'typescript';
import { fileURLToPath } from 'node:url';
import { HEALTH_RECOVERY_DATASETS, type HealthRecoveryDatasets } from '../../../../lib/healthRecoveryExport';
import { projectVerifiedSelectedDayLegacySnapshot } from './selectedDayLegacySnapshot';
import { createHealthWorkoutOperationAuthority } from './healthWorkoutOperationScope';
import { projectCompositeWorkoutRead, type CompositeWorkoutReadResult } from './compositeWorkoutReadProjection';
import { deriveWorkoutRange } from './verifiedWorkoutRangeSnapshot';
import { deriveHealthWorkoutParentAvailability as derive,
  type HealthWorkoutParentAvailabilityInput as Input, type HealthWorkoutParentScope,
  type ParentPublication, type RetryDisposition, type RetryOwner, type RetrySnapshot } from './healthWorkoutParentAvailability';

const date = '2026-10-15';
const canonicalScope = { accountId: 'A', deviceId: 'device-A', namespaceKey: 'namespace-A', generationId: 'generation-A' };
const scope = (): HealthWorkoutParentScope => ({
  ...createHealthWorkoutOperationAuthority({ accountId: 'A', generation: 1 }, date)!,
  routeLifetime: {}, shellLifetime: {},
});
const publication = (parent: HealthWorkoutParentScope): ParentPublication => ({
  scope: parent, ownerLifetime: {}, canonicalScope,
});
const proof = (p: ParentPublication) => ({ publication: p, currentPublication: p, currentOwnerLifetime: p.ownerLifetime });
const daily = { workouts: [], routines: [], inbody: { weight: null, smm: null, pbf: null, local_version: null } };

function result(legacy = true, canonical = true, records = true): CompositeWorkoutReadResult {
  return projectCompositeWorkoutRead({ context: canonicalScope,
    legacy: legacy ? { status: 'success', records: records ? [{ accountId: 'A', rowId: 'legacy-row',
      localDate: date, blockId: 'bench', sortOrder: 0,
      exerciseDisplay: { kind: 'historical_fallback', name: 'Bench' }, sets: [] }] : [] } : { status: 'error' },
    canonical: canonical ? { status: 'success', records: records ? [{ ...canonicalScope,
      entityId: '11111111-1111-4111-8111-111111111111', localRevision: 1,
      session: { version: 1, id: '11111111-1111-4111-8111-111111111111', localDate: date,
        entries: [{ id: '22222222-2222-4222-8222-222222222222',
          exercise: { id: 'bench', name: 'Bench', type: 'strength', tags: [], cardioMode: null },
          sets: [{ id: '33333333-3333-4333-8333-333333333333', ordinal: 1, done: true, kind: 'strength',
            loadKind: 'external_weight', weightKg: '10', sourceValue: '10', sourceUnit: 'kg', reps: 8, assistedReps: null, dropset: false }] }] } }] : [] }
      : { status: 'error' } });
}

function retry(parent: HealthWorkoutParentScope): RetrySnapshot {
  const ownerLifetime = {}, episode = {}, permit = {};
  return { scope: parent, ownerLifetime, currentOwnerLifetime: ownerLifetime, currentEpisode: episode,
    disposition: { state: 'TRANSIENT', episode, permit, currentPermit: permit } };
}

function input(): Input {
  const parent = scope(), day = publication(parent), range = publication(parent), history = publication(parent);
  const draftLifetime = {}, row = { id: '44444444-4444-4444-8444-444444444444', local_version: 'frozen-legacy-version' };
  const evidence = { blockId: 'bench', state: 'NO_MATCH' as const };
  const snapshot = { accountId: 'A', scope: canonicalScope, result: result() };
  return {
    gates: { selectedDay: true, range: true }, committedHealthRoute: true, authenticated: true,
    boundScope: parent, currentScope: parent,
    selectedDay: { ...proof(day), accountId: 'A', localDate: date, phase: 'settled', isolationError: false,
      result: result(), legacyDaily: daily },
    range: { ...proof(range), accountId: 'A', phase: 'settled', isolationError: false,
      previousBounds: { startDate: '2025-10-15', endDate: '2026-10-14' },
      monthBounds: { startDate: '2026-10-01', endDate: '2026-10-31' },
      previousView: deriveWorkoutRange(snapshot, '2025-10-15', '2026-10-14'),
      monthView: deriveWorkoutRange(snapshot, '2026-10-01', '2026-10-31') },
    history: { ...proof(history), rejected: false, authority: 'local', consumedBlockIds: ['bench'],
      entries: [{ evidence, currentEvidence: evidence }] },
    draft: { scope: parent, lifetime: draftLifetime, currentLifetime: draftLifetime, isDirty: false },
    workflow: { locked: false, saving: false, hasNonSeparatorWorkout: true,
      deleteTarget: { row, currentRow: row, workoutId: row.id, expectedVersion: row.local_version } },
    retry: { RANGE: retry(parent), B1: retry(parent), D: retry(parent) },
  };
}

function frozen<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(frozen); Object.freeze(value);
  }
  return value;
}

/** Real paired projection, including both set variants and nullable/optional data. */
function projectedInput(accountId = 'A'): Input {
  const datasets = Object.fromEntries(HEALTH_RECOVERY_DATASETS.map(name => [name, []])) as unknown as HealthRecoveryDatasets;
  datasets.exercise_blocks.push(
    { id: 'bench', user_id: accountId, name: 'Bench', type: 'strength', tags: ['UPPER'] },
    { id: 'run', user_id: accountId, name: 'Run', type: 'cardio', tags: ['CARDIO'], cardio_mode: 'both' },
  );
  datasets.workout_logs.push(
    { id: '44444444-4444-4444-8444-444444444444', user_id: accountId, date, block_id: 'bench', sort_order: 0,
      sets: [{ type: 'strength', set: 1, kg: '10', reps: 8, assisted_reps: 2, done: true,
        weight_source_value: 10, weight_source_unit: 'kg' }] },
    { id: '55555555-5555-4555-8555-555555555555', user_id: accountId, date, block_id: 'run', sort_order: 1,
      sets: [{ type: 'cardio', set: 1, time: '20:00', distance: '3', pace: '6:40', done: true }] },
  );
  datasets.inbody_logs.push({ id: 'inbody', user_id: accountId, date, weight: 74.5, smm: null, pbf: 18.4 });
  datasets.routines.push({ id: 'routine', user_id: accountId, text: 'Mobility', deleted_at: null, is_active: true });
  const pair = projectVerifiedSelectedDayLegacySnapshot(datasets, accountId, date);
  const i = input();
  const p: ParentPublication = accountId === 'A' ? i.selectedDay.publication! : {
    scope: { ...i.boundScope!, accountOperation: { accountId, generation: 1 } }, ownerLifetime: {},
    canonicalScope: { ...canonicalScope, accountId },
  };
  return { ...i, selectedDay: { ...i.selectedDay, ...proof(p), accountId, legacyDaily: pair.daily,
    result: projectCompositeWorkoutRead({ context: { ...canonicalScope, accountId },
      legacy: { status: 'success', records: pair.persistedRows }, canonical: { status: 'success', records: [] } }) } };
}

function dataObjects(value: unknown, found = new Set<object>()): Set<object> {
  if (value !== null && typeof value === 'object' && !found.has(value)) {
    found.add(value); Object.values(value).forEach(child => dataObjects(child, found));
  }
  return found;
}

function publishedLegacy(i: Input) {
  const m = derive(i);
  if (m.editor.state !== 'EDITOR_INTERACTIVE' || !('legacyDaily' in m.selectedDay) || !m.selectedDay.legacyDaily) {
    throw Error('qualified legacy fixture was not published');
  }
  return { m, daily: m.editor.legacyDaily, day: m.selectedDay };
}

/** Real compiler + virtual adjacent source file; no disk writes or ts-expect-error comments. */
function compilePublicationProbe(lines: readonly string[]) {
  const root = fileURLToPath(new URL('../../../../../', import.meta.url));
  const configPath = fileURLToPath(new URL('../../../../../tsconfig.app.json', import.meta.url));
  const config = readConfigFile(configPath, sys.readFile);
  expect(config.error).toBeUndefined();
  const parsed = parseJsonConfigFileContent(config.config, sys, root);
  expect(parsed.errors).toEqual([]);
  const probe = fileURLToPath(new URL('./__r01_readonly_probe__.ts', import.meta.url));
  const text = lines.join('\n');
  const host = createCompilerHost(parsed.options);
  const read = host.readFile, exists = host.fileExists, source = host.getSourceFile;
  const isProbe = (path: string) => path.replace(/\\/g, '/') === probe.replace(/\\/g, '/');
  host.fileExists = path => isProbe(path) || exists(path);
  host.readFile = path => isProbe(path) ? text : read(path);
  host.getSourceFile = (path, language, onError, shouldCreate) => isProbe(path)
    ? createSourceFile(path, text, language, true) : source(path, language, onError, shouldCreate);
  const viteEnvironment = fileURLToPath(new URL('../../../../vite-env.d.ts', import.meta.url));
  const program = createProgram([viteEnvironment, probe], parsed.options, host);
  return getPreEmitDiagnostics(program).map(d => ({ file: d.file?.fileName, code: d.code,
    line: d.file && d.start !== undefined ? d.file.getLineAndCharacterOfPosition(d.start).line + 1 : null }));
}

describe('PR776-R01 protected published payload boundary', () => {
  it('R01-C01/C08 derives unchanged values without freezing/mutating borrowed input or identity tokens', () => {
    const i = projectedInput(), owner = i.selectedDay.legacyDaily!;
    const before = structuredClone(owner), objects = [...dataObjects(i)], flags = objects.map(Object.isFrozen);
    const { m, daily, day } = publishedLegacy(i);
    expect(daily).toEqual(before); expect(daily).not.toBe(owner);
    expect(day.legacyDaily).toBe(daily); expect(day.result).toEqual(i.selectedDay.result);
    expect(m.selectedDay.state).toBe('COMPLETE'); expect(m.actions.save.state).toBe('PREREQUISITES_SATISFIED');
    expect(m.scope).toBe(i.boundScope); expect(day.publication).toBe(i.selectedDay.publication);
    expect(m.editor.state === 'EDITOR_INTERACTIVE' && m.editor.publication).toBe(i.selectedDay.publication);
    expect(i.selectedDay.legacyDaily).toBe(owner); expect(owner).toEqual(before);
    expect(objects.map(Object.isFrozen)).toEqual(flags);
    const ownerObjects = dataObjects(owner);
    expect([...dataObjects(daily)].every(object => !ownerObjects.has(object))).toBe(true);
    expect([...dataObjects(daily)].every(Object.isFrozen)).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(daily.workouts[0]!.exercise_blocks, 'cardio_mode')).toBe(true);
    expect(daily.workouts[0]!.exercise_blocks).toHaveProperty('cardio_mode', undefined);
  });

  it('R01-C02/C04/C05 rejects nested consumer mutations, preserves owner and both paired representations', () => {
    const i = projectedInput(), owner = i.selectedDay.legacyDaily!, before = structuredClone(owner);
    const { m, daily, day } = publishedLegacy(i);
    expect(Reflect.set(daily.workouts[0]!.sets[0]!, 'reps', 42)).toBe(false);
    expect(Reflect.set(daily.workouts[1]!.sets[0]!, 'distance', '999')).toBe(false);
    expect(Reflect.set(daily.workouts[0]!.exercise_blocks, 'name', 'Changed')).toBe(false);
    expect(Reflect.set(daily.inbody, 'weight', 0)).toBe(false);
    expect(Reflect.set(daily.routines[0]!, 'done', true)).toBe(false);
    const persisted = day.result.records.find(record => record.source === 'legacy')!;
    if (persisted.source !== 'legacy') throw Error('legacy record missing');
    expect(Reflect.set(persisted.legacy.sets[0]!, 'reps', 42)).toBe(false);
    expect(daily).toEqual(before); expect(owner).toEqual(before);
    expect(day.legacyDaily).toBe(daily); expect(day.result).toEqual(i.selectedDay.result);
    expect(persisted.legacy.sets[0]).toMatchObject({ reps: 8 });
    expect(m.draft.sameScopeDirty).toBe(false); expect(m.selectedDay.state).toBe('COMPLETE');
  });

  it.each(['workouts', 'sets', 'tags', 'routines'] as const)('R01-C03 array splice rejects %s removal and cannot alter input', key => {
    const i = projectedInput(), owner = i.selectedDay.legacyDaily!, before = structuredClone(owner);
    const { daily } = publishedLegacy(i);
    const array = key === 'workouts' ? daily.workouts : key === 'sets' ? daily.workouts[0]!.sets
      : key === 'tags' ? daily.workouts[0]!.exercise_blocks.tags! : daily.routines;
    expect(() => Reflect.apply(Array.prototype.splice, array, [0, 1])).toThrow(TypeError);
    expect(daily).toEqual(before); expect(owner).toEqual(before);
  });

  it('R01-C05 also detaches and protects selected-day result and published range view data, not their identity tokens', () => {
    const i = projectedInput(), { m, day } = publishedLegacy(i);
    expect(day.result).not.toBe(i.selectedDay.result);
    expect([...dataObjects(day.result)].every(o => !dataObjects(i.selectedDay.result).has(o))).toBe(true);
    expect([...dataObjects(day.result)].every(Object.isFrozen)).toBe(true);
    if (!('previousView' in m.range)) throw Error('range fixture missing');
    expect(m.range.publication).toBe(i.range.publication);
    expect(m.range.previousView).toEqual(i.range.previousView); expect(m.range.previousView).not.toBe(i.range.previousView);
    expect(m.range.monthView).toEqual(i.range.monthView); expect(m.range.monthView).not.toBe(i.range.monthView);
    const borrowed = dataObjects([i.range.previousView, i.range.monthView]);
    expect([...dataObjects([m.range.previousView, m.range.monthView])].every(o => !borrowed.has(o))).toBe(true);
    expect([...dataObjects(m.range.monthView)].every(Object.isFrozen)).toBe(true);
    const month = m.range.monthView;
    expect(() => Reflect.apply(Array.prototype.splice, month.result.records, [0, 1])).toThrow(TypeError);
    const ownerSet = i.selectedDay.legacyDaily!.workouts[0]!.sets[0]!;
    expect(Reflect.set(ownerSet, 'reps', 21)).toBe(true);
    expect(day.legacyDaily!.workouts[0]!.sets[0]).toMatchObject({ reps: 8 });
  });

  it('R01-C06/C07 real TypeScript compiler rejects nested writes and array mutators on the published API', () => {
    const lines = [
      "import type { HealthWorkoutParentAvailability } from './healthWorkoutParentAvailability';",
      'declare const model: HealthWorkoutParentAvailability;',
      "if (model.editor.state === 'EDITOR_INTERACTIVE') {",
      ' const daily = model.editor.legacyDaily;',
      ' const set = daily.workouts[0]!.sets[0]!;',
      " const validRead = set.type !== 'cardio' ? set.reps : null;",
    ];
    const mutations: [string, number][] = [
      [" if (set.type !== 'cardio') set.reps = 42;", 2540],
      [" daily.workouts[0]!.block_id = 'changed';", 2540],
      [' daily.inbody.weight = 0;', 2540],
      [' daily.routines[0]!.done = true;', 2540],
      [' daily.workouts.splice(0, 1);', 2551],
      [' daily.workouts[0]!.sets.push(set);', 2339],
      [" daily.workouts[0]!.exercise_blocks.tags!.push('changed');", 2339],
      [' daily.routines.pop();', 2339],
    ];
    const expected = mutations.map(([statement, code]) => { lines.push(statement); return { code, line: lines.length }; });
    lines.push('}', "if ('legacyDaily' in model.selectedDay && model.selectedDay.legacyDaily) {",
      ' model.selectedDay.legacyDaily.workouts.length = 0;', '}');
    expected.push({ code: 2540, line: lines.length - 1 });
    const diagnostics = compilePublicationProbe(lines);
    expect(diagnostics.map(({ code, line }) => ({ code, line }))).toEqual(expected);
    expect(compilePublicationProbe([
      "import type { HealthWorkoutParentAvailability } from './healthWorkoutParentAvailability';",
      'declare const model: HealthWorkoutParentAvailability;',
      "if (model.editor.state === 'EDITOR_INTERACTIVE') {",
      ' const rows = model.editor.legacyDaily.workouts.map(row => row.sets.length);',
      '}',
    ])).toEqual([]);
  }, 60000);

  it.each(['loading', 'partial-canonical', 'unavailable', 'isolation', 'gate-off', 'missing-daily'] as const)(
    'R01-C09/C10 does not clone absent/unqualified daily payload: %s', state => {
      const i = projectedInput();
      const daily = { get workouts(): never { throw Error('unqualified legacy payload accessed'); },
        inbody: i.selectedDay.legacyDaily!.inbody, routines: [] };
      const candidate: Input = { ...i, gates: state === 'gate-off' ? { selectedDay: false, range: false } : i.gates,
        selectedDay: { ...i.selectedDay, legacyDaily: state === 'missing-daily' ? null : daily,
          phase: state === 'loading' ? 'loading' : 'settled', isolationError: state === 'isolation',
          result: state === 'partial-canonical' ? result(false, true) : state === 'unavailable' ? null : i.selectedDay.result } };
      const clone = vi.spyOn(globalThis, 'structuredClone');
      try {
        const model = derive(candidate);
        expect(model.editor.state).toBe('EDITOR_HIDDEN');
        expect(clone.mock.calls.filter(([value]) => value && typeof value === 'object' && 'legacyDaily' in value && value.legacyDaily !== null)).toHaveLength(0);
      } finally { clone.mockRestore(); }
    });

  it('R01-C10 makes exactly one daily data snapshot shared by day/editor; classification does not duplicate it', () => {
    const i = projectedInput(), clone = vi.spyOn(globalThis, 'structuredClone');
    try {
      const { daily, day } = publishedLegacy(i);
      expect(day.legacyDaily).toBe(daily);
      expect(clone.mock.calls.filter(([value]) => value && typeof value === 'object' && 'legacyDaily' in value && value.legacyDaily !== null)).toHaveLength(1);
    } finally { clone.mockRestore(); }
  });
});

describe('post-R01 N01–N12 independent-review scenario regressions', () => {
  const cases: [string, (i: Input) => Input, object][] = [
    ['N01 stale B1 publication', i => ({ ...i, selectedDay: { ...i.selectedDay,
      currentPublication: { ...i.selectedDay.currentPublication! } } }),
    { selectedDay: { state: 'UNAVAILABLE' }, editor: { state: 'EDITOR_HIDDEN' } }],
    ['N02 same-value date retired lifetime', i => ({ ...i, currentScope: { ...i.currentScope!, dateLifetime: scope().dateLifetime } }),
    { shell: 'DISABLED', actions: { save: { state: 'FENCED' } } }],
    ['N03 coherent foreign account success', i => ({ ...i, selectedDay: projectedInput('B').selectedDay }),
    { selectedDay: { state: 'ISOLATION' }, actions: { editDraft: { state: 'FENCED' } } }],
    ['N04 canonical-only success', i => ({ ...i, selectedDay: { ...i.selectedDay, result: result(false, true), legacyDaily: null } }),
    { selectedDay: { state: 'PARTIAL_CANONICAL' }, editor: { state: 'EDITOR_HIDDEN' } }],
    ['N05 clean hydration loading', i => ({ ...i, selectedDay: { ...i.selectedDay, phase: 'loading' } }),
    { selectedDay: { state: 'LOADING' }, editor: { state: 'EDITOR_HIDDEN' } }],
    ['N06 typed isolation while loading with dirty draft', i => ({ ...i, draft: { ...i.draft, isDirty: true },
      selectedDay: { ...i.selectedDay, phase: 'loading', isolationError: true } }),
    { selectedDay: { state: 'ISOLATION' }, history: 'REJECTED', editor: { state: 'EDITOR_NONINTERACTIVE_DRAFT_PREVIEW' },
      actions: { save: { state: 'FENCED' }, editDraft: { state: 'FENCED' } } }],
    ['N07 both ordinary errors', i => ({ ...i, selectedDay: { ...i.selectedDay, result: result(false, false), legacyDaily: null } }),
    { selectedDay: { state: 'UNAVAILABLE' } }],
    ['N08 every owner retry UNKNOWN', i => ({ ...i, retry: {
      RANGE: { ...i.retry.RANGE, disposition: { state: 'UNKNOWN' } },
      B1: { ...i.retry.B1, disposition: { state: 'UNKNOWN' } }, D: { ...i.retry.D, disposition: { state: 'UNKNOWN' } },
    } }), { retry: { localParent: { state: 'FENCED', eligibleOwners: [] } } }],
    ['N09 effective D rejection with healthy B1', i => ({ ...i, history: { ...i.history, rejected: true } }),
    { selectedDay: { state: 'ISOLATION' }, history: 'REJECTED', retry: { owners: { D: { reason: 'WAITING_FOR_PARENT' } } } }],
    ...(['locked', 'saving'] as const).map(flag => [
      `N10 workflow ${flag}`, (i: Input) => ({ ...i, workflow: { ...i.workflow, [flag]: true } }),
      { actions: { editDraft: { state: 'FENCED', reason: flag === 'locked' ? 'LOCKED' : 'SAVING' },
        save: { state: 'FENCED' }, deletePersisted: { state: 'FENCED' }, useHistoricalPlanning: { state: 'FENCED' } } },
    ] as [string, (i: Input) => Input, object]),
    ['N11 stale populated range', i => ({ ...i, range: { ...i.range, currentPublication: { ...i.range.currentPublication! } } }),
    { range: { state: 'UNAVAILABLE' }, selectedDay: { state: 'COMPLETE' } }],
    ['N12 disabled candidate with dirty draft', i => ({ ...i, gates: { selectedDay: false, range: false }, draft: { ...i.draft, isDirty: true } }),
    { shell: 'DISABLED', editor: { state: 'EDITOR_HIDDEN' }, selectedDay: { state: 'DISABLED' },
      actions: { save: { state: 'FENCED' } }, retry: { localParent: { state: 'FENCED' } } }],
  ];
  it.each(cases)('%s', (_, change, expected) => {
    const model = derive(change(projectedInput()));
    expect(model).toMatchObject(expected);
    if (!('result' in model.selectedDay)) expect(model.selectedDay).not.toHaveProperty('legacyDaily');
    if (model.range.state === 'UNAVAILABLE') {
      expect(model.range).not.toHaveProperty('previousView'); expect(model.range).not.toHaveProperty('monthView');
    }
  });
});

describe('Slice A dormant Option C pure prerequisites (not integrated PA acceptance)', () => {
  // PA-C01/06 model evidence: four source outcomes, populated AND no surviving records.
  it.each([true, false].flatMap(l => [true, false].flatMap(c => [true, false].map(rows => [l, c, rows] as const))))(
    'source matrix legacy=%s canonical=%s records=%s', (l, c, rows) => {
      const i = input(), r = result(l, c, rows);
      const model = derive({ ...i, selectedDay: { ...i.selectedDay, result: r, legacyDaily: l ? daily : null } });
      expect(model.shell).toBe('ADMITTED');
      expect(model.selectedDay.state).toBe(l && c ? rows ? 'COMPLETE' : 'VERIFIED_EMPTY'
        : l ? 'PARTIAL_LEGACY' : c ? 'PARTIAL_CANONICAL' : 'UNAVAILABLE');
      expect(model.editor.state).toBe(l ? 'EDITOR_INTERACTIVE' : 'EDITOR_HIDDEN');
      if ('result' in model.selectedDay) {
        expect(model.selectedDay.result).toEqual(r);
        expect(model.selectedDay.result).not.toBe(r);
        expect(model.selectedDay.result.records.every(row => row.source === 'legacy' ? l : c)).toBe(true);
      } else expect(model.selectedDay).not.toHaveProperty('result');
    });

  it.each(['selectedDay', 'range'] as const)('gate %s OFF disables every candidate output/action/retry', gate => {
    const i = input(); const m = derive({ ...i, gates: { ...i.gates, [gate]: false }, draft: { ...i.draft, isDirty: true } });
    expect(m.shell).toBe('DISABLED'); expect(m.scope).toBeNull();
    expect(m.selectedDay.state).toBe('DISABLED'); expect(m.range.state).toBe('DISABLED');
    expect(m.editor.state).toBe('EDITOR_HIDDEN'); expect(m.draft.sameScopeDirty).toBe(false);
    expect(Object.values(m.actions).every(a => a.state === 'FENCED' && a.reason === 'SHELL_DISABLED')).toBe(true);
    expect(m.retry.localParent.eligibleOwners).toEqual([]);
  });

  const deniedParents: [string, (i: Input) => Input][] = [
    ['route retired', i => ({ ...i, committedHealthRoute: false })],
    ['signed out', i => ({ ...i, authenticated: false })],
    ['missing bound', i => ({ ...i, boundScope: null })],
    ['unmounted current', i => ({ ...i, currentScope: null })],
    ['account mismatch', i => ({ ...i, currentScope: { ...i.currentScope!, accountOperation: { accountId: 'B', generation: 1 } } })],
    ['account ABA', i => ({ ...i, currentScope: { ...i.currentScope!, accountOperation: { accountId: 'A', generation: 3 } } })],
    ['date mismatch', i => ({ ...i, currentScope: { ...i.currentScope!, dateKey: '2026-10-16' } })],
    ...(['dateLifetime', 'routeLifetime', 'shellLifetime'] as const).map(key => [
      `${key} same-value return`, (i: Input) => ({ ...i, currentScope: { ...i.currentScope!, [key]: {} } as HealthWorkoutParentScope }),
    ] as [string, (i: Input) => Input]),
    ...['', ' ', '2026-02-30', '2026-13-01', '2026-1-01'].map(bad => [
      `invalid context ${bad}`, (i: Input) => {
        const p = bad.trim() ? { ...i.boundScope!, dateKey: bad }
          : { ...i.boundScope!, accountOperation: { accountId: bad, generation: 1 } };
        return { ...i, boundScope: p, currentScope: p };
      },
    ] as [string, (i: Input) => Input]),
  ];
  it.each(deniedParents)('structural admission rejects %s despite healthy children', (_, change) => {
    const m = derive(change(input())); expect(m.shell).toBe('DISABLED');
    expect(m.selectedDay).not.toHaveProperty('result'); expect(m.range).not.toHaveProperty('previousView');
  });

  it('requires no remote bootstrap/network status and no source success to admit the shell', () => {
    const i = input(); const m = derive({ ...i, selectedDay: { ...i.selectedDay, result: null },
      range: { ...i.range, previousView: null, monthView: null } });
    expect(m.shell).toBe('ADMITTED'); expect(m.selectedDay.state).toBe('UNAVAILABLE');
  });

  it.each(['publication', 'currentPublication', 'currentOwnerLifetime'] as const)('B1 missing %s never publishes cached facts', key => {
    const i = input(); const m = derive({ ...i, selectedDay: { ...i.selectedDay, [key]: null } });
    expect(m.selectedDay.state).toBe('UNAVAILABLE'); expect(m.selectedDay).not.toHaveProperty('result');
    expect(m.editor.state).toBe('EDITOR_HIDDEN'); expect(m.range.state).toBe('COMPLETE');
  });
  it.each(['accountId', 'localDate', 'publication', 'currentOwnerLifetime'] as const)('B1 mismatched %s fails closed', key => {
    const i = input(); const value = key === 'accountId' ? 'B' : key === 'localDate' ? '2026-10-16'
      : key === 'publication' ? publication(i.boundScope!) : {};
    const m = derive({ ...i, selectedDay: { ...i.selectedDay, [key]: value } as Input['selectedDay'] });
    expect(['ISOLATION', 'UNAVAILABLE']).toContain(m.selectedDay.state);
    expect(m.selectedDay).not.toHaveProperty('result'); expect(m.actions.save.state).toBe('FENCED');
  });
  it('rejects an equal-value old publication scope after date ABA', () => {
    const i = input(); const p = publication(scope());
    const m = derive({ ...i, selectedDay: { ...i.selectedDay, ...proof(p) } });
    expect(m.selectedDay.state).toBe('UNAVAILABLE'); expect(m.editor.state).toBe('EDITOR_HIDDEN');
  });
  it.each(['accountId', 'namespaceKey', 'generationId'] as const)('preserves canonical %s proof instead of salvaging a rejected pair', key => {
    const i = input(); const p = { ...i.selectedDay.publication!, canonicalScope: { ...canonicalScope, [key]: 'foreign' } };
    const m = derive({ ...i, selectedDay: { ...i.selectedDay, ...proof(p) } });
    expect(m.selectedDay.state).toBe('ISOLATION'); expect(m.selectedDay).not.toHaveProperty('result');
    expect(m.actions.save.state).toBe('FENCED');
  });
  it('ordinary canonical failure can retain qualified legacy with no canonical scope', () => {
    const i = input(); const p = { ...i.selectedDay.publication!, canonicalScope: null };
    const m = derive({ ...i, selectedDay: { ...i.selectedDay, ...proof(p), result: result(true, false) } });
    expect(m.selectedDay.state).toBe('PARTIAL_LEGACY'); expect(m.editor.state).toBe('EDITOR_INTERACTIVE');
  });
  it('complete-empty requires affirmative canonical proof, not just an empty array', () => {
    const i = input(); const p = { ...i.selectedDay.publication!, canonicalScope: null };
    expect(derive({ ...i, selectedDay: { ...i.selectedDay, ...proof(p), result: result(true, true, false) } }).selectedDay.state).toBe('ISOLATION');
  });

  it.each(['B1', 'RANGE', 'D'] as const)('%s rejection suppresses selected pair/editor; independent range survives B1/D', owner => {
    const i = input(); const m = derive({ ...i,
      selectedDay: { ...i.selectedDay, isolationError: owner === 'B1' },
      range: { ...i.range, isolationError: owner === 'RANGE' },
      history: { ...i.history, rejected: owner === 'D' } });
    expect(m.selectedDay.state).toBe('ISOLATION'); expect(m.selectedDay).not.toHaveProperty('legacyDaily');
    expect(m.editor.state).toBe('EDITOR_HIDDEN'); expect(m.history).toBe('REJECTED');
    expect(m.range.state).toBe(owner === 'RANGE' ? 'ISOLATION' : 'COMPLETE');
    expect(Object.values(m.actions).every(a => a.state === 'FENCED' && a.reason === 'SOURCE_ISOLATION')).toBe(true);
    expect(m.retry.owners.D).toMatchObject({ state: 'TEMPORARILY_INELIGIBLE', reason: 'WAITING_FOR_PARENT' });
  });

  it.each([false, true])('loading drops all stale payload, dirty=%s', dirty => {
    const i = input(); const m = derive({ ...i, selectedDay: { ...i.selectedDay, phase: 'loading' },
      range: { ...i.range, phase: 'loading' }, draft: { ...i.draft, isDirty: dirty } });
    expect(m.selectedDay).toEqual({ state: 'LOADING', reason: 'NO_OLD_PUBLICATION' });
    expect(m.range).not.toHaveProperty('monthView');
    expect(m.editor.state).toBe(dirty ? 'EDITOR_NONINTERACTIVE_DRAFT_PREVIEW' : 'EDITOR_HIDDEN');
  });
  it('effective rejection remains isolation during loading and cannot be cleared by D-only success', () => {
    const i = input(); const m = derive({ ...i, history: { ...i.history, rejected: true },
      selectedDay: { ...i.selectedDay, phase: 'loading' } });
    expect(m.selectedDay.state).toBe('ISOLATION'); expect(m.history).toBe('REJECTED');
  });

  it.each(['missing', 'canonical-only', 'loading', 'isolation'] as const)('same-scope dirty preview after %s grants no actions/hydration/persisted proof', failure => {
    const i = input(); const m = derive({ ...i, draft: { ...i.draft, isDirty: true }, selectedDay: { ...i.selectedDay,
      result: failure === 'missing' ? null : failure === 'canonical-only' ? result(false, true) : result(),
      phase: failure === 'loading' ? 'loading' : 'settled', isolationError: failure === 'isolation' } });
    expect(m.editor.state).toBe('EDITOR_NONINTERACTIVE_DRAFT_PREVIEW');
    expect(m.editor).not.toHaveProperty('legacyDaily'); expect(m.editor).not.toHaveProperty('hydration');
    expect(m.draft).toEqual({ sameScopeDirty: true, isPersistedEvidence: false });
    expect(Object.values(m.actions).every(a => a.state === 'FENCED')).toBe(true);
  });
  it.each(['scope', 'lifetime', 'currentLifetime'] as const)('foreign/retired dirty draft %s is never previewed', key => {
    const i = input(); const m = derive({ ...i, draft: { ...i.draft, isDirty: true, [key]: key === 'scope' ? scope() : null },
      selectedDay: { ...i.selectedDay, result: null } });
    expect(m.editor.state).toBe('EDITOR_HIDDEN'); expect(m.draft.sameScopeDirty).toBe(false);
  });
  it('recovery changes preview to interactive but explicitly preserves dirty draft', () => {
    const i = input(); const dirty = { ...i, draft: { ...i.draft, isDirty: true } };
    expect(derive({ ...dirty, selectedDay: { ...i.selectedDay, phase: 'loading' } }).editor.state).toBe('EDITOR_NONINTERACTIVE_DRAFT_PREVIEW');
    expect(derive(dirty).editor).toMatchObject({ state: 'EDITOR_INTERACTIVE', hydration: 'PRESERVE_DIRTY_DRAFT' });
    expect(derive(i).editor).toMatchObject({ state: 'EDITOR_INTERACTIVE', hydration: 'CLEAN_DRAFT_ONLY' });
  });
  it('verified persisted empty remains distinct from same-scope dirty draft', () => {
    const i = input(); const m = derive({ ...i, draft: { ...i.draft, isDirty: true },
      selectedDay: { ...i.selectedDay, result: result(true, true, false) } });
    expect(m.selectedDay.state).toBe('VERIFIED_EMPTY'); expect(m.draft.sameScopeDirty).toBe(true);
    expect(m.editor).toMatchObject({ hydration: 'PRESERVE_DIRTY_DRAFT' });
  });
  it('qualified legacy records without paired legacyDaily never enable editor', () => {
    const i = input(); const m = derive({ ...i, selectedDay: { ...i.selectedDay, legacyDaily: null } });
    expect(m.selectedDay.state).toBe('COMPLETE'); expect(m.editor.state).toBe('EDITOR_HIDDEN');
    expect(m.actions.editDraft).toEqual({ state: 'FENCED', reason: 'LEGACY_UNQUALIFIED' });
  });

  it.each(['locked', 'saving'] as const)('%s is a separate workflow prerequisite', flag => {
    const i = input(); const m = derive({ ...i, workflow: { ...i.workflow, [flag]: true } });
    expect(m.editor.state).toBe('EDITOR_INTERACTIVE');
    expect(Object.values(m.actions).every(a => a.state === 'FENCED' && a.reason === (flag === 'locked' ? 'LOCKED' : 'SAVING'))).toBe(true);
  });
  it('a stale draft cannot borrow current legacy or canonical writer prerequisites', () => {
    const i = input(); const m = derive({ ...i, draft: { ...i.draft, currentLifetime: {} } });
    expect(Object.values(m.actions).every(a => a.state === 'FENCED' && a.reason === 'DRAFT_SCOPE_STALE')).toBe(true);
    expect(m.editor).toMatchObject({ hydration: 'FENCED_DRAFT_SCOPE' });
  });
  it('empty Save payload and absent persisted row are independently denied', () => {
    const i = input(); const m = derive({ ...i, workflow: { ...i.workflow, hasNonSeparatorWorkout: false, deleteTarget: null } });
    expect(m.actions.save).toEqual({ state: 'FENCED', reason: 'EMPTY_PAYLOAD' });
    expect(m.actions.deletePersisted).toEqual({ state: 'FENCED', reason: 'ROW_NOT_CURRENT' });
    expect(m.actions.editDraft.state).toBe('PREREQUISITES_SATISFIED');
  });
  it.each([
    ['row', { id: 'other', local_version: null }], ['currentRow', null], ['workoutId', ''], ['workoutId', 'temp-row'],
    ['expectedVersion', null], ['expectedVersion', ''], ['expectedVersion', ' '], ['expectedVersion', 'another-version'],
  ] as const)('Delete requires exact current row/ID/version: %s=%s', (key, value) => {
    const i = input(); const target = { ...i.workflow.deleteTarget!, [key]: value };
    const m = derive({ ...i, workflow: { ...i.workflow, deleteTarget: target } });
    expect(m.actions.deletePersisted).toEqual({ state: 'FENCED', reason: key.toLowerCase().includes('version') ? 'VERSION_NOT_CURRENT' : 'ROW_NOT_CURRENT' });
  });
  it('positive prerequisites never mint an executable callback-time/writer permit', () => {
    const m = derive(input());
    for (const a of Object.values(m.actions)) expect(a).toEqual({ state: 'PREREQUISITES_SATISFIED', requiredNext: 'EVENT_BOUNDARY_CAPTURE_AND_PREDISPATCH_RECHECK' });
    expect(Object.values(m.actions).some(a => Object.values(a).some(v => typeof v === 'function'))).toBe(false);
  });
  it('canonical-only persisted records with verified legacy empty never substitute for legacy hydration/planning', () => {
    const i = input(); const mixed = result();
    const canonicalOnly = { ...mixed, records: mixed.records.filter(row => row.source === 'canonical') } as CompositeWorkoutReadResult;
    const m = derive({ ...i, selectedDay: { ...i.selectedDay, result: canonicalOnly },
      workflow: { ...i.workflow, hasNonSeparatorWorkout: false, deleteTarget: null },
      history: { ...i.history, entries: [] } });
    expect(m.editor).toMatchObject({ state: 'EDITOR_INTERACTIVE', legacyDaily: daily });
    expect(m.actions.save).toEqual({ state: 'FENCED', reason: 'EMPTY_PAYLOAD' });
    expect(m.actions.deletePersisted.state).toBe('FENCED'); expect(m.actions.useHistoricalPlanning.state).toBe('FENCED');
  });

  it.each(['CURRENT', 'NO_MATCH', 'REFRESHING', 'UNAVAILABLE', 'STALE_OR_SUPPRESSED'] as const)('D %s independently qualifies history, not editor/range', state => {
    const i = input(); const evidence = { blockId: 'bench', state };
    const m = derive({ ...i, history: { ...i.history, entries: [{ evidence, currentEvidence: evidence }] } });
    expect(m.editor.state).toBe('EDITOR_INTERACTIVE'); expect(m.range.state).toBe('COMPLETE');
    expect(m.actions.useHistoricalPlanning.state).toBe(state === 'CURRENT' || state === 'NO_MATCH' ? 'PREREQUISITES_SATISFIED' : 'FENCED');
    expect(m.actions.editDraft.state).toBe('PREREQUISITES_SATISFIED');
  });
  it.each(['no-dependencies', 'wrong-block', 'old-evidence', 'old-publication', 'unsupported'] as const)('healthy siblings cannot replace D proof: %s', problem => {
    const i = input(); const h = { ...i.history,
      consumedBlockIds: problem === 'no-dependencies' ? [] : problem === 'wrong-block' ? ['squat'] : ['bench'],
      currentPublication: problem === 'old-publication' ? null : i.history.currentPublication,
      authority: problem === 'unsupported' ? 'unsupported' as const : 'local' as const,
      entries: problem === 'old-evidence' ? [{ evidence: i.history.entries[0]!.evidence, currentEvidence: null }] : i.history.entries };
    expect(derive({ ...i, history: h }).actions.useHistoricalPlanning.state).toBe('FENCED');
  });

  it.each(['loading', 'error', 'partial-legacy', 'partial-canonical', 'isolation', 'stale', 'bounds'] as const)('range %s remains independent with fail-closed own proof', problem => {
    const i = input(); const r = problem === 'error' ? result(false, false) : result(problem !== 'partial-canonical', problem !== 'partial-legacy');
    const snap = { accountId: 'A', scope: canonicalScope, result: r };
    const range = { ...i.range, phase: problem === 'loading' ? 'loading' as const : 'settled' as const,
      isolationError: problem === 'isolation', currentPublication: problem === 'stale' ? null : i.range.currentPublication,
      previousView: deriveWorkoutRange(snap, '2025-10-15', '2026-10-14'), monthView: deriveWorkoutRange(snap, '2026-10-01', '2026-10-31'),
      monthBounds: problem === 'bounds' ? { startDate: '2026-10-02', endDate: '2026-10-31' } : i.range.monthBounds };
    const m = derive({ ...i, range });
    const expected = { loading: 'LOADING', error: 'UNAVAILABLE', 'partial-legacy': 'PARTIAL_LEGACY', 'partial-canonical': 'PARTIAL_CANONICAL', isolation: 'ISOLATION', stale: 'UNAVAILABLE', bounds: 'ISOLATION' }[problem];
    expect(m.range.state).toBe(expected);
    expect(m.selectedDay.state).toBe(expected === 'ISOLATION' ? 'ISOLATION' : 'COMPLETE');
    if (expected === 'LOADING' || expected === 'UNAVAILABLE' || expected === 'ISOLATION') expect(m.range).not.toHaveProperty('monthView');
  });

  it.each<RetryOwner>(['RANGE', 'B1', 'D'])('retry %s requires its own episode/permit; unknown stays fenced', owner => {
    const i = input(), old = i.retry[owner], episode = old.currentEpisode!;
    const dispositions: [RetryDisposition, string][] = [
      [{ state: 'UNKNOWN' }, 'UNSUPPORTED_CLASSIFICATION'],
      [{ state: 'RECOVERED' }, 'TEMPORARILY_INELIGIBLE'],
      [{ state: 'BLOCKED', reasonCode: 'IDENTITY_REQUIRES_EXTERNAL_CORRECTION' }, 'DETERMINISTICALLY_BLOCKED'],
      [{ state: 'IN_FLIGHT', episode }, 'ALREADY_IN_FLIGHT'],
      [{ state: 'TRANSIENT', episode, permit: null, currentPermit: null }, 'TEMPORARILY_INELIGIBLE'],
      [{ state: 'TRANSIENT', episode: {}, permit: {}, currentPermit: {} }, 'UNSUPPORTED_CLASSIFICATION'],
    ];
    expect(derive(i).retry.owners[owner].state).toBe('ELIGIBLE');
    for (const [disposition, state] of dispositions) expect(derive({ ...i, retry: { ...i.retry, [owner]: { ...old, disposition } } }).retry.owners[owner].state).toBe(state);
    expect(derive({ ...i, retry: { ...i.retry, [owner]: { ...old, scope: scope() } } }).retry.owners[owner].state).toBe('UNSUPPORTED_CLASSIFICATION');
  });
  it('retry targets disclose exact deduplicated raw owner sets and never remote/bootstrap', () => {
    const m = derive(input());
    expect(m.retry.localParent.eligibleOwners).toEqual(['RANGE', 'B1', 'D']);
    expect(m.retry.localPairedReaders.eligibleOwners).toEqual(['RANGE', 'B1']);
    expect(m.retry.legacyCurrentness.eligibleOwners).toEqual(['D']);
    expect(m.retry.localParent.skipped).toEqual([]);
  });
  it('reports skipped unknown/blocked owners without granting lane-only recovery or repairing them', () => {
    const i = input(); const m = derive({ ...i, retry: { ...i.retry,
      B1: { ...i.retry.B1, disposition: { state: 'UNKNOWN' } },
      D: { ...i.retry.D, disposition: { state: 'BLOCKED', reasonCode: 'DETERMINISTIC' } } } });
    expect(m.retry.localParent.eligibleOwners).toEqual(['RANGE']);
    expect(m.retry.localParent.skipped.map(s => s.owner)).toEqual(['B1', 'D']);
    expect(m.retry.legacyCurrentness.state).toBe('FENCED');
  });
  it.each<RetryOwner>(['B1', 'RANGE'])('%s active flight coalesces semantically and never exposes a second eligible request', owner => {
    const i = input(), r = i.retry[owner];
    const m = derive({ ...i, retry: { ...i.retry, [owner]: { ...r,
      disposition: { state: 'IN_FLIGHT', episode: r.currentEpisode! } } } });
    expect(m.retry.owners[owner].state).toBe('ALREADY_IN_FLIGHT');
    expect(m.retry.localParent.eligibleOwners).not.toContain(owner);
  });
  it('D retry with no consumed dependencies is fenced even with a transient permit', () => {
    const i = input(); expect(derive({ ...i, history: { ...i.history, consumedBlockIds: [] } }).retry.owners.D)
      .toMatchObject({ state: 'TEMPORARILY_INELIGIBLE', reason: 'NO_DEPENDENCIES' });
  });
  it('does not infer finite retry admission from a source error, loading, or healthy sibling', () => {
    const i = input(); const m = derive({ ...i, selectedDay: { ...i.selectedDay, phase: 'loading' },
      retry: { ...i.retry, B1: { ...i.retry.B1, disposition: { state: 'UNKNOWN' } } } });
    expect(m.retry.owners.B1.state).toBe('UNSUPPORTED_CLASSIFICATION');
    expect(m.retry.owners.RANGE.state).toBe('ELIGIBLE');
  });

  it('is deterministic, does not mutate/freeze borrowed inputs, read clocks, perform IO or invoke callbacks', () => {
    const i = input(); const p = i.boundScope!;
    expect(Object.isFrozen(p)).toBe(false);
    const before = JSON.stringify(i), now = vi.spyOn(Date, 'now').mockImplementation(() => { throw Error('clock'); });
    const fetch = vi.fn(() => { throw Error('network'); }); vi.stubGlobal('fetch', fetch);
    try {
      const first = derive(i); expect(derive(i)).toEqual(first);
      expect(JSON.stringify(i)).toBe(before); expect(Object.isFrozen(p)).toBe(false);
      expect(first.scope).toBe(p); expect(Object.isFrozen(first)).toBe(true);
      expect(derive(frozen(i))).toEqual(first); expect(now).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
    } finally { now.mockRestore(); vi.unstubAllGlobals(); }
  });
  it('has type-only dependencies and no runtime side-effect/authority machinery', () => {
    const source = readFileSync(new URL('./healthWorkoutParentAvailability.ts', import.meta.url), 'utf8');
    expect(source.match(/^import /gm)?.length).toBe(source.match(/^import type /gm)?.length);
    expect(source).not.toMatch(/\b(?:useEffect|useState|fetch|localStorage|sessionStorage|indexedDB|Date|WeakSet|setTimeout)\s*[.(]/);
  });
  it('negative controls: the same state oracles catch isolation-as-empty, canonical editor and date-ABA faults', () => {
    const source = readFileSync(new URL('./healthWorkoutParentAvailability.ts', import.meta.url), 'utf8');
    const compileFault = (needle: string, replacement: string): typeof derive => {
      expect(source.split(needle)).toHaveLength(2);
      const code = transpileModule(source.replace(needle, replacement), { compilerOptions: { module: ModuleKind.CommonJS } }).outputText;
      const exports: Record<string, unknown> = {};
      // In-memory test-only perturbation: no production edit/module/cache replacement.
      new Function('exports', code)(exports);
      return exports.deriveHealthWorkoutParentAvailability as typeof derive;
    };
    const isolated = input();
    const isolationInput = { ...isolated, selectedDay: { ...isolated.selectedDay, isolationError: true } };
    const isolationOracle = (f: typeof derive) => expect(f(isolationInput).selectedDay.state).toBe('ISOLATION');
    isolationOracle(derive);
    expect(() => isolationOracle(compileFault("state: 'ISOLATION', reason: 'EFFECTIVE_REJECTION_OR_SCOPE_MISMATCH'",
      "state: 'VERIFIED_EMPTY', reason: 'EFFECTIVE_REJECTION_OR_SCOPE_MISMATCH'"))).toThrow(/ISOLATION/);
    const canonical = input();
    const canonicalInput = { ...canonical, selectedDay: { ...canonical.selectedDay, result: result(false, true), legacyDaily: null } };
    const editorOracle = (f: typeof derive) => expect(f(canonicalInput).editor.state).toBe('EDITOR_HIDDEN');
    editorOracle(derive);
    expect(() => editorOracle(compileFault("'legacyDaily' in selectedDay && selectedDay.legacyDaily", "'legacyDaily' in selectedDay"))).toThrow(/EDITOR_HIDDEN/);
    const old = input();
    const abaInput = { ...old, currentScope: { ...old.currentScope!, dateLifetime: scope().dateLifetime } };
    const abaOracle = (f: typeof derive) => expect(f(abaInput).shell).toBe('DISABLED');
    abaOracle(derive);
    expect(() => abaOracle(compileFault('a.dateLifetime === b.dateLifetime && ', ''))).toThrow(/DISABLED/);
  });
  it('does not change any literal production gate', () => {
    for (const [file, name] of [
      ['healthSelectedDayCompositeConfig.ts', 'HEALTH_SELECTED_DAY_COMPOSITE_READER_ENABLED'],
      ['healthWorkoutRangeCompositeConfig.ts', 'HEALTH_WORKOUT_RANGE_COMPOSITE_READER_ENABLED'],
      ['healthExerciseComparisonPreviewConfig.ts', 'HEALTH_EXERCISE_COMPARISON_PREVIEW_ENABLED'],
      ['../home/homeWorkoutCompositeConfig.ts', 'HOME_WORKOUT_COMPOSITE_READER_ENABLED'],
      ['../search/searchWorkoutCompositeConfig.ts', 'SEARCH_WORKOUT_COMPOSITE_READER_ENABLED'],
    ]) expect(readFileSync(new URL(file!, import.meta.url), 'utf8')).toContain(`export const ${name} = false;`);
  });
});
