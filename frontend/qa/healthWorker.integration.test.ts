// @vitest-environment happy-dom
import 'fake-indexeddb/auto';
import { IDBDatabase, IDBFactory } from 'fake-indexeddb';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { act, createElement, StrictMode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase, LocalDatabaseRepository,
} from '../src/lib/localDatabase';
import { hashCanonicalPayload } from '../src/lib/localDatabase/canonicalPayload';
import { HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_PROJECT_REF } from '../src/lib/workoutLocalReaderAuthority';
import { createWorkoutRemoteControlClient } from '../src/lib/workoutRemoteClient';
import { WORKOUT_REMOTE_DOMAIN, workoutRequestDigest } from '../src/lib/workoutRemoteContract';
import { runWorkoutPullIteration } from '../src/lib/workoutRemotePull';
import { runWorkoutPushIteration } from '../src/lib/workoutRemotePush';
import { WorkoutSelectedDayReader } from '../src/lib/workoutSelectedDayReader';
import { WORKOUT_SESSION_DOMAIN, WorkoutSessionRepository } from '../src/lib/workoutSessionRepository';
import type { WorkoutSessionV1 } from '../src/lib/workoutSessionV1';
import { HealthView } from '../src/components/views/HealthView';
import { openHealthCanonicalWorkerProduct } from '../src/components/views/features/health/healthCanonicalWorkerProduct';
import { HEALTH_WORKER_PRODUCT_PROJECT } from '../src/lib/workoutWorkerQaScope';
import { setRuntimeAccountSyncAccount } from '../src/lib/remoteBoundary';
import type { HealthProps } from '../src/types';
import vectors from '../../protocol/rel05g4a-workout-vectors.json';

// No real Auth configuration or client can be loaded in this suite.
vi.mock('../src/lib/supabase', () => ({
  supabase: { auth: { getSession: async () => ({ data: { session: null } }) } },
  authFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

const { Miniflare } = createRequire(import.meta.url)('../../prototypes/recipe-d1-local/node_modules/miniflare');
const origin = 'http://127.0.0.1:8789';
const issuer = 'https://health-worker-transport-fixture.invalid/auth/v1';
const projectScope = 'health-worker-transport-fixture-v1';
const base = '/api/sync/v2';
const uuid = (n: number) => `aacc0000-1234-4567-89ab-${n.toString(16).padStart(12, '0')}`;
const alice = uuid(1), bob = uuid(2), unknown = uuid(3);
const serverEpoch = uuid(700), day = '2026-09-23';
type MiniflareInstance = import('../../prototypes/recipe-d1-local/node_modules/miniflare').Miniflare;
type DB = Awaited<ReturnType<MiniflareInstance['getD1Database']>>;
type Call = { path: string; body?: string; status: number; reply: any; bytes: number;
  metrics: { statements: number; rowsRead: number; rowsWritten: number } | null };
let script: string, schema: string[], jwks: string, bundleBytes: number, gzipBytes: number;
const tokens = new Map<string, string>();
const runners: MiniflareInstance[] = [];
const stores: LocalDatabaseRepository[] = [];
const enc = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');

beforeAll(async () => {
  const result = await build({ entryPoints: ['../prototypes/health-d1-local/worker.mjs'], bundle: true,
    minify: true, platform: 'browser', format: 'esm', target: 'es2024', write: false });
  script = result.outputFiles[0]!.text;
  bundleBytes = result.outputFiles[0]!.contents.length;
  gzipBytes = gzipSync(script).length;
  schema = (await readFile('../prototypes/health-d1-local/fixture-schema.sql', 'utf8')).split('-- fixture-statement');
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const key = await crypto.subtle.exportKey('jwk', pair.publicKey);
  jwks = JSON.stringify({ keys: [{ ...key, kid: 'synthetic-only', alg: 'ES256' }] });
  for (const [account, iss] of [[alice, issuer], [bob, issuer], [unknown, issuer], ['wrong-issuer', 'https://foreign.invalid/auth/v1']]) {
    const now = Math.floor(Date.now() / 1000);
    const unsigned = `${enc({ alg: 'ES256', kid: 'synthetic-only' })}.${enc({
      iss, aud: 'authenticated', role: 'authenticated', sub: account === 'wrong-issuer' ? alice : account, iat: now, exp: now + 3600,
    })}`;
    tokens.set(account!, `${unsigned}.${Buffer.from(await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' }, pair.privateKey, new TextEncoder().encode(unsigned))).toString('base64url')}`);
  }
}, 30_000);

afterEach(async () => {
  await unmountProduct();
  setRuntimeAccountSyncAccount(null);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  for (const store of stores.splice(0)) closeLocalDatabase(store);
  await Promise.all(runners.splice(0).map(runner => runner.dispose()));
});

async function harness(enabled = true) {
  const runner = new Miniflare({
    modules: true, script, compatibilityDate: '2026-07-30', host: '127.0.0.1',
    bindings: { ...(enabled && { HEALTH_TRANSPORT_MODE: 'synthetic-local' }), HEALTH_TRANSPORT_FIXTURE_JWKS: jwks },
    d1Databases: { HEALTH_TRANSPORT_DB: 'synthetic-health-only' }, d1Persist: false,
  });
  runners.push(runner);
  const db = await runner.getD1Database('HEALTH_TRANSPORT_DB');
  await db.batch(schema.map(sql => db.prepare(sql)));
  const calls: Call[] = [];
  let loseReply = false;
  const fetchImpl = (async (input: string, init?: RequestInit) => {
    const target = new URL(input);
    if (target.origin !== origin || !target.pathname.startsWith(base + '/')) throw new Error('Non-fixture target');
    const result = await runner.dispatchFetch(target.href, init);
    const reply = Buffer.from(await result.arrayBuffer());
    const metrics = result.headers.get('x-absinthe-qa-d1');
    const call = { path: target.pathname, body: typeof init?.body === 'string' ? init.body : undefined,
      status: result.status, reply: JSON.parse(reply.toString()), bytes: reply.length,
      metrics: metrics ? JSON.parse(metrics) : null };
    calls.push(call);
    if (loseReply && target.pathname.endsWith('/mutations') && result.ok) {
      loseReply = false;
      throw new TypeError('Synthetic response loss after D1 commit');
    }
    return new Response(reply, { status: result.status, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;
  return { db, calls, runner, fetchImpl, loseNextResponse: () => { loseReply = true; } };
}

const auth = (user: string) => ({ 'content-type': 'application/json', authorization: `Bearer ${tokens.get(user)}` });
const now = (seconds: number) => new Date(Date.UTC(2026, 8, 23, 0, 0, seconds)).toISOString();
type Harness = Awaited<ReturnType<typeof harness>>;
type Fixture = Awaited<ReturnType<typeof client>>;
async function client(h: Harness, accountId: string, n: number, seed = true, projectRef = HEALTH_ROUTINE_PROJECT_REF) {
  const factory = new IDBFactory();
  const deviceId = uuid(n), bindingId = uuid(n + 1000);
  // A separate IDBFactory, synthetic owner/device and a distinct trusted remote
  // project. This does not reuse or opt in the canonical local-save QA namespace.
  const database = await openLocalDatabase({ userId: accountId, deviceId, projectRef,
    generationId: HEALTH_ROUTINE_GENERATION_ID, schemaVersion: 1 }, {
    capability: createDormantLocalDatabaseCapability('test'), indexedDBFactory: factory,
  });
  stores.push(database);
  await database.initializeNamespace();
  const identity = { namespaceKey: database.namespaceKey, generationId: database.namespace.generationId, deviceId };
  if (seed) {
    await h.db.batch([
      h.db.prepare('INSERT INTO workout_authority VALUES (?, ?, 1, ?, 1) ON CONFLICT (owner, project) DO NOTHING')
        .bind(accountId, projectScope, serverEpoch),
      h.db.prepare('INSERT INTO workout_bindings VALUES (?, ?, ?, ?, ?, ?, 1, 1)')
        .bind(accountId, projectScope, identity.namespaceKey, identity.generationId, deviceId, bindingId),
    ]);
  }
  const opts = { baseUrl: origin, fetchImpl: h.fetchImpl, getSession: async () => ({ accountId, accessToken: tokens.get(accountId)! }),
    currentAccountId: () => accountId, currentDeviceId: () => deviceId };
  const discover = () => createWorkoutRemoteControlClient(opts).discoverAndPersist(database);
  return { factory, database, opts, discover, sessions: new WorkoutSessionRepository(database), accountId,
    wire: { ...identity, bindingId, authorityEpoch: 1 } };
}

function workout(n = 100): WorkoutSessionV1 {
  const sample = structuredClone(vectors.vectors[0]!.record) as WorkoutSessionV1;
  sample.id = uuid(n);
  sample.entries.push({ id: uuid(110), exercise: { id: null, name: 'Pull-up', type: 'bodyweight', tags: [], cardioMode: null },
    sets: [{ id: uuid(111), ordinal: 1, kind: 'bodyweight', loadKind: 'bodyweight', reps: 8, assistedReps: 2, dropset: true, done: false }] },
  { id: uuid(112).toUpperCase(), exercise: { id: 'synthetic-run', name: 'Run', type: 'cardio', tags: ['CARDIO'], cardioMode: 'both' },
    sets: [{ id: uuid(113), ordinal: 1, kind: 'cardio', durationSeconds: 630, distanceMeters: '2500.125', done: true }] });
  return sample;
}

function digest(f: Fixture, body: any) {
  return workoutRequestDigest({ ...body, authenticatedOwnerId: f.accountId, projectScope, generationBindingId: body.bindingId,
    wireEntityId: body.entityId });
}
function wire(f: Fixture, record = workout(), id = 100, remoteCasBaseRevision: number | null = null) {
  const payload = { kind: 'entity_snapshot', record };
  const request = { protocolVersion: 2, ...f.wire, domain: WORKOUT_REMOTE_DOMAIN, entityId: record.id.toLowerCase(),
    mutationId: 'mut.' + uuid(id), idempotencyKey: 'k322.' + id.toString(16).padStart(64, '0'), operation: 'upsert',
    remoteCasBaseRevision, localRevision: (remoteCasBaseRevision ?? 0) + 1, payload, payloadHash: hashCanonicalPayload(payload) };
  return { ...request, requestDigest: digest(f, request) };
}
const post = (h: Harness, f: Fixture, body: unknown) => h.fetchImpl(origin + base + '/workouts/mutations', {
  method: 'POST', headers: auth(f.accountId), body: JSON.stringify(body),
});
const get = (h: Harness, f: Fixture, overrides: Record<string, string> = {}) =>
  h.fetchImpl(origin + base + '/workouts/changes?' + new URLSearchParams({
    ...f.wire, authorityEpoch: String(f.wire.authorityEpoch), cursor: '0', ...overrides,
  }), { headers: auth(f.accountId) });

async function counts(db: DB) {
  return db.prepare(`SELECT (SELECT COUNT(*) FROM workout_entities) AS sessions,
    (SELECT COUNT(*) FROM workout_receipts) AS receipts, (SELECT COUNT(*) FROM workout_changes) AS events`).first();
}

function edited(record: WorkoutSessionV1, weight: string, reps: number, addSet = false) {
  const next = structuredClone(record);
  const strength = next.entries[0]!.sets[0]!;
  if (strength.kind !== 'strength') throw new Error('Expected a strength fixture');
  Object.assign(strength, { weightKg: weight, sourceValue: weight, sourceUnit: 'kg', reps });
  const bodyweight = next.entries[1]!.sets[0]!;
  bodyweight.done = true;
  if (addSet) next.entries[1]!.sets.push({ ...bodyweight, id: uuid(114), ordinal: 2, done: false });
  return next;
}

function bind(f: Fixture, mutationId: string, verificationId: string) {
  return f.database.bindWorkoutMutation({ mutationId, expectedVerificationId: verificationId,
    currentAuthenticatedAccount: f.opts.currentAccountId, currentDeviceId: f.opts.currentDeviceId });
}

const pushAt = (f: Fixture, seconds: number) => runWorkoutPushIteration(f.database, {
  ...f.opts, now: () => now(seconds), limit: 1, retryBaseDelayMs: 1, retryMaxDelayMs: 5,
});

type ProductClient = Awaited<ReturnType<typeof productClient>>;
let productRoot: Root | null = null;
let productHost: HTMLDivElement | null = null;
const exercises: HealthProps['healthBlocks'] = [
  { id: 'qa-press', name: 'Synthetic press', type: 'strength', tags: ['QA'] },
  { id: 'qa-pull', name: 'Synthetic pull-up', type: 'bodyweight', tags: ['QA'] },
];

async function productClient(h: Harness, device: number, accountId = alice, seed = true) {
  const f = await client(h, accountId, device, seed, HEALTH_WORKER_PRODUCT_PROJECT);
  const data = new Map<string, string>();
  const storage: Storage = {
    get length() { return data.size; }, clear: () => data.clear(), key: n => [...data.keys()][n] ?? null,
    getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); },
    removeItem: key => { data.delete(key); },
  };
  storage.setItem(HEALTH_ROUTINE_DEVICE_ID_KEY, f.wire.deviceId);
  let tail: Promise<unknown> = Promise.resolve();
  const locks = { request: (_: string, callback: () => unknown) => {
    const next = tail.then(callback);
    tail = next.catch(() => undefined);
    return next;
  } } as Pick<LockManager, 'request'>;
  const state = { offline: false, at: 1, afterFetch: null as null | ((target: URL) => Promise<void>) };
  let deviceOwner = new AbortController();
  const selectDevice = (id: string) => {
    const old = deviceOwner;
    deviceOwner = new AbortController();
    storage.setItem(HEALTH_ROUTINE_DEVICE_ID_KEY, id);
    old.abort();
  };
  const open: NonNullable<HealthProps['testOnlyOpenCanonicalWorkerProduct']> = (account, when, current) =>
    openHealthCanonicalWorkerProduct({
      storage, locks, indexedDBFactory: f.factory, now: () => now(state.at), deviceLifetime: deviceOwner.signal,
      getSession: f.opts.getSession,
      fetchImpl: async (...args) => {
        if (state.offline) throw new TypeError('Synthetic offline');
        const response = await h.fetchImpl(...args);
        await state.afterFetch?.(new URL(String(args[0])));
        return response;
      },
    }, account, when, current);
  return { ...f, storage, state, open, selectDevice };
}

function setupProduct() {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 375 });
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Non-fixture request denied'); }));
}

async function unmountProduct() {
  if (productRoot) await act(async () => productRoot?.unmount());
  productRoot = null;
  productHost?.remove();
  productHost = null;
}

async function mountProduct(client: ProductClient, date = day, replaceOwner = true) {
  if (replaceOwner) setRuntimeAccountSyncAccount(client.accountId, headers =>
    headers.set('Authorization', `Bearer ${tokens.get(client.accountId)}`));
  if (!productRoot) {
    productHost = document.createElement('div');
    document.body.append(productHost);
    productRoot = createRoot(productHost);
  }
  const dateValue = new Date(date + 'T12:00:00');
  const props: HealthProps = {
    now: {} as HealthProps['now'], currentDate: dateValue, selectedDate: dateValue,
    setCurrentDate: vi.fn(), setSelectedDate: vi.fn(),
    formatDate: value => value instanceof Date
      ? [value.getFullYear(), String(value.getMonth() + 1).padStart(2, '0'), String(value.getDate()).padStart(2, '0')].join('-')
      : date,
    isToday: () => true,
    showToast: vi.fn(), appSettings: { darkMode: false } as HealthProps['appSettings'], updateSetting: vi.fn(),
    theme: { card: 'card', input: 'input', border: 'border', text: 'text', textMuted: 'muted', hoverBg: 'hover' },
    THEME_COLORS: [], mutateDaily: vi.fn(), mutateStatic: vi.fn(), user: { id: client.accountId, name: 'Synthetic account' },
    schedules: [], weeklySchedules: [], workouts: [], healthBlocks: exercises, healthRoutines: [],
    inbody: {} as HealthProps['inbody'], testOnlyOpenCanonicalWorkerProduct: client.open,
  };
  await act(async () => productRoot!.render(createElement(StrictMode, null, createElement(HealthView, props))));
}

const element = <T extends HTMLElement = HTMLElement>(selector: string) => productHost?.querySelector<T>(selector);
const controls = (suffix: string) => `[data-health-canonical-${suffix}]`;
const visible = async (selector: string) => await vi.waitFor(async () => {
  await act(async () => {});
  expect(element(selector)).toBeTruthy();
});
async function click(selector: string, twice = false) {
  const node = element<HTMLButtonElement>(selector);
  expect(node?.disabled).toBe(false);
  await act(async () => { node!.click(); if (twice) node!.click(); });
}
async function openProduct() {
  await click(controls('open'));
  await visible(`${controls('sync')}:not(:disabled)`);
}
async function addExercise(index: number) {
  const select = `${controls('draft')} select[name="exercise"]`;
  element<HTMLSelectElement>(select)!.value = exercises[index]!.id;
  await click(`${controls('draft')} form:has(select[name="exercise"]) button[type="submit"]`);
  await vi.waitFor(async () => {
    await act(async () => {});
    expect(element(controls('draft'))?.querySelectorAll('h3')).toHaveLength(index + 1);
  });
}
async function enterSet(selector: string, values: Record<string, string>) {
  await click(selector);
  const form = `${controls('draft')} form:has(input[name="done"])`;
  for (const [name, value] of Object.entries(values)) element<HTMLInputElement>(`${form} [name="${name}"]`)!.value = value;
  element<HTMLInputElement>(`${form} [name="done"]`)!.checked = true;
  await click(`${form} button[type="submit"]`);
  await vi.waitFor(async () => { await act(async () => {}); expect(element(form)).toBeNull(); });
}
async function recordProductWorkout() {
  await visible(`${controls('new')}:not(:disabled)`);
  await click(controls('new'));
  await visible(`${controls('draft')} select[name="exercise"]`);
  await addExercise(0); await addExercise(1);
  await enterSet(`li:has(> h3):nth-child(1) > ${controls('add-set')}`, { weight: '40', reps: '8' });
  await enterSet(`li:has(> h3):nth-child(1) > ${controls('add-set')}`, { weight: '35', reps: '10' });
  await enterSet(`li:has(> h3):nth-child(2) > ${controls('add-set')}`, { reps: '6', assisted: '2' });
  await click(controls('save'), true);
  await visible('[data-health-canonical-state="not_synchronized"]');
}
async function syncProduct(state?: string, twice = false) {
  await visible(`${controls('sync')}:not(:disabled)`);
  await click(controls('sync'), twice);
  await visible(`${controls('sync')}:not(:disabled)`);
  if (state) await visible(`[data-health-canonical-state="${state}"]`);
}

it('mounts actual mobile Health Save, Sync, exact-ID readback and Edit across two isolated clients', async () => {
  const h = await harness();
  const a = await productClient(h, 201), b = await productClient(h, 202);
  setupProduct();
  const transactions = vi.spyOn(IDBDatabase.prototype, 'transaction');
  const observations: Array<{ action: string; requests: number; transactions: number; writes: number;
    d1Statements: number; d1RowsRead: number; d1RowsWritten: number }> = [];
  const measure = async (action: string, work: () => Promise<void>) => {
    const start = h.calls.length, transactionsStart = transactions.mock.calls.length;
    await work();
    const local = transactions.mock.calls.slice(transactionsStart);
    const requests = h.calls.slice(start), metrics = requests.flatMap(call => call.metrics ? [call.metrics] : []);
    observations.push({ action, requests: requests.length, transactions: local.length,
      writes: local.filter(([, mode]) => mode === 'readwrite').length,
      d1Statements: metrics.reduce((total, m) => total + m.statements, 0),
      d1RowsRead: metrics.reduce((total, m) => total + m.rowsRead, 0),
      d1RowsWritten: metrics.reduce((total, m) => total + m.rowsWritten, 0) });
  };

  await mountProduct(a); await openProduct();
  await measure('A record and Save', recordProductWorkout);
  expect(h.calls).toHaveLength(0);
  const [created] = await a.sessions.listWorkoutSessions();
  const id = created!.entityId;
  expect(created!.record.entries.map(e => e.sets.length)).toEqual([2, 1]);
  expect(await a.database.listOutboxMutations({ domain: WORKOUT_SESSION_DOMAIN, entityId: id, limit: 10 })).toHaveLength(1);
  await measure('A Sync create', () => syncProduct('acknowledged', true));
  expect(element('[data-health-canonical-state="acknowledged"]')?.textContent).toContain('revision 1');

  await unmountProduct();
  await mountProduct(b); await openProduct();
  await measure('B Sync receive', syncProduct);
  await visible(`[data-health-canonical-session="${id}"]`);
  expect(element(`[data-health-canonical-session="${id}"]`)?.textContent).toContain('40 kg');
  expect((await b.sessions.getWorkoutSession(id))?.record).toEqual(created!.record);
  await click(controls('reopen'));
  await visible(`${controls('draft')} h3`);
  await measure('B edit and Save', async () => {
    await enterSet(`li:has(> h3):nth-child(1) > ol > li:first-child ${controls('edit-set')}`, { weight: '45', reps: '9' });
    await enterSet(`li:has(> h3):nth-child(2) > ${controls('add-set')}`, { reps: '5' });
    await click(controls('save'), true);
    await visible('[data-health-canonical-state="not_synchronized"]');
  });
  const edited = (await b.sessions.getWorkoutSession(id))!.record;
  expect(edited).toMatchObject({ id, entries: [
    { id: created!.record.entries[0]!.id, sets: [
      { id: created!.record.entries[0]!.sets[0]!.id, sourceValue: '45', reps: 9 },
      created!.record.entries[0]!.sets[1],
    ] },
    { id: created!.record.entries[1]!.id, sets: [created!.record.entries[1]!.sets[0], { reps: 5 }] },
  ] });
  await measure('B Sync update', () => syncProduct('acknowledged', true));
  expect(element('[data-health-canonical-state="acknowledged"]')?.textContent).toContain('revision 2');
  await unmountProduct();
  await mountProduct(a); await openProduct();
  await visible('[data-health-canonical-state="acknowledged"]');
  await measure('A Sync readback', () => syncProduct('acknowledged'));
  expect(element(`[data-health-canonical-session="${id}"]`)?.textContent).toContain('45 kg');
  expect((await a.sessions.getWorkoutSession(id))?.record).toEqual(edited);
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 2, events: 2 });
  expect(observations.map(x => x.requests)).toEqual([0, 4, 3, 0, 2, 3]);
  expect(observations.filter(x => x.action.includes('and Save')).map(x => x.writes)).toEqual([1, 1]);
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
  console.info('mounted Health QA operation counts', JSON.stringify(observations));
}, 30_000);

it('keeps offline local Save and lost-response replay distinct from confirmed acknowledgement', async () => {
  const h = await harness();
  const a = await productClient(h, 203);
  setupProduct(); a.state.offline = true;
  await mountProduct(a); await openProduct(); await recordProductWorkout();
  await syncProduct('not_synchronized');
  await visible('[data-health-canonical-sync-issue="unavailable"]');
  expect(h.calls).toHaveLength(0);
  await unmountProduct();
  await mountProduct(a); await openProduct();
  await visible('[data-health-canonical-state="not_synchronized"]');
  a.state.offline = false;
  h.loseNextResponse();
  await syncProduct('uncertain', true);
  await visible('[data-health-canonical-sync-issue="uncertain"]');
  expect(element('[data-health-canonical-state="acknowledged"]')).toBeFalsy();
  await unmountProduct();
  await mountProduct(a); await openProduct();
  await visible('[data-health-canonical-state="uncertain"]');
  a.state.at += 5;
  await syncProduct('acknowledged', true);
  const payloads = h.calls.filter(call => call.path.endsWith('/mutations')).map(call => call.body);
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toBe(payloads[1]);
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 1, events: 1 });
  await unmountProduct();
  a.state.offline = true;
  await mountProduct(a); await openProduct(); await syncProduct('acknowledged');
  await visible('[data-health-canonical-sync-issue="unavailable"]');
  expect(h.calls.filter(call => call.path.endsWith('/mutations'))).toHaveLength(2);
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
}, 30_000);

async function editPress(value: string) {
  await click(controls('reopen'));
  const edit = `li:has(> h3):nth-child(1) > ol > li:first-child ${controls('edit-set')}`;
  await visible(`${edit}:not(:disabled)`);
  await enterSet(edit, { weight: value, reps: '9' });
  await visible('[data-health-canonical-state="draft"]');
}

it('preserves the losing locally saved edit and does not turn a stale CAS into a second write', async () => {
  const h = await harness();
  const a = await productClient(h, 204), b = await productClient(h, 205);
  setupProduct();
  await mountProduct(a); await openProduct(); await recordProductWorkout(); await syncProduct('acknowledged');
  const [created] = await a.sessions.listWorkoutSessions();
  await unmountProduct();
  await mountProduct(b); await openProduct(); await syncProduct(); await editPress('42');
  await click(controls('save')); await visible('[data-health-canonical-state="not_synchronized"]');
  await unmountProduct();
  await mountProduct(a); await openProduct(); await editPress('55');
  await click(controls('save')); await visible('[data-health-canonical-state="not_synchronized"]');
  await syncProduct('acknowledged');
  await unmountProduct();
  await mountProduct(b); await openProduct(); await syncProduct('conflict');
  const losing = (await b.sessions.getWorkoutSession(created!.entityId))!;
  expect(losing.record.entries[0]!.sets[0]).toMatchObject({ sourceValue: '42', reps: 9 });
  expect(losing.pendingMutationId).not.toBeNull();
  const remoteWrites = h.calls.filter(c => c.path.endsWith('/mutations'));
  expect(remoteWrites.map(c => c.status)).toEqual([200, 200, 409]);
  await syncProduct('conflict');
  expect(h.calls.filter(c => c.path.endsWith('/mutations'))).toHaveLength(remoteWrites.length);
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 2, events: 2 });
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
}, 30_000);

it('keeps a durable unsaved editor across pull and fences selected-date and A→B→A completion', async () => {
  const h = await harness();
  const a = await productClient(h, 206), b = await productClient(h, 207), foreign = await productClient(h, 208, bob);
  setupProduct();
  await mountProduct(a); await openProduct(); await recordProductWorkout(); await syncProduct('acknowledged');
  const [created] = await a.sessions.listWorkoutSessions();
  await unmountProduct();
  await mountProduct(b); await openProduct(); await syncProduct(); await editPress('42');
  const bytes = b.storage.getItem(b.storage.key(1)!);
  expect(bytes).toContain('"sourceValue":"42"');
  await unmountProduct();
  await mountProduct(a); await openProduct(); await editPress('55');
  await click(controls('save')); await visible('[data-health-canonical-state="not_synchronized"]');
  await syncProduct('acknowledged');
  await unmountProduct();
  await mountProduct(b); await openProduct(); await syncProduct('draft');
  expect(b.storage.getItem(b.storage.key(1)!)).toBe(bytes);
  expect(element(`[data-health-canonical-session="${created!.entityId}"]`)?.textContent).toContain('55 kg');
  await click(controls('save')); await visible(`${controls('sync')}:not(:disabled)`);
  await visible('[data-health-canonical-state="draft"]');
  expect(b.storage.getItem(b.storage.key(1)!)).toBe(bytes);
  expect(await b.database.listOutboxMutations({ domain: WORKOUT_SESSION_DOMAIN, entityId: created!.entityId, limit: 10 })).toHaveLength(0);

  let reached!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { reached = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  b.state.afterFetch = async () => { reached(); await held; };
  try {
    await click(controls('sync'));
    await started;
    await mountProduct(b, '2026-09-24', false);
    expect(element(controls('draft'))).toBeNull();
    await mountProduct(foreign);
    await openProduct();
    expect(element(controls('session'))).toBeNull();
    await mountProduct(b);
    expect(element(controls('draft'))).toBeNull();
  } finally {
    b.state.afterFetch = null;
    await act(async () => { release(); await held; });
  }
  await openProduct();
  await visible('[data-health-canonical-state="draft"]');
  expect(b.storage.getItem(b.storage.key(1)!)).toBe(bytes);
  expect(element('[data-health-canonical-sync-issue]')).toBeNull();
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
}, 30_000);

it('keeps a staged edit editable after an atomic local CAS rejection, not uncertain', async () => {
  const h = await harness(), a = await productClient(h, 209);
  setupProduct();
  await mountProduct(a); await openProduct(); await recordProductWorkout(); await syncProduct('acknowledged');
  const [created] = await a.sessions.listWorkoutSessions();
  const id = created!.entityId;
  await editPress('42');
  const key = a.storage.key(1)!;
  const bytes = a.storage.getItem(key);
  const winner = structuredClone(created!.record);
  Object.assign(winner.entries[0]!.sets[0]!, { weightKg: '54', sourceValue: '54' });
  const commit = LocalDatabaseRepository.prototype.commitLocalMutation;
  vi.spyOn(LocalDatabaseRepository.prototype, 'commitLocalMutation').mockImplementationOnce(async function (this: LocalDatabaseRepository, input) {
    // A competing device-local commit lands after the Save stages the draft
    // marker but before its actual revision-checked transaction opens.
    expect(a.storage.getItem(key)).toContain('"status":"uncertain"');
    await a.sessions.updateWorkoutSession(id, 1, winner);
    return commit.call(this, input);
  });
  await click(controls('save'));
  await visible(`${controls('sync')}:not(:disabled)`);
  await visible('[data-health-canonical-state="draft"]');
  expect(a.storage.getItem(key)).toBe(bytes);
  expect((await a.sessions.getWorkoutSession(id))?.record).toEqual(winner);
  expect(await a.database.listOutboxMutations({ domain: WORKOUT_SESSION_DOMAIN, entityId: id, limit: 10 })).toHaveLength(2);
  await unmountProduct();
  await mountProduct(a); await openProduct();
  await visible('[data-health-canonical-state="draft"]');
  expect(a.storage.getItem(key)).toBe(bytes);
}, 30_000);

it('revokes same-owner device changes and replays the exact unsettled claim after device A→B→A', async () => {
  const h = await harness(), a = await productClient(h, 210), b = await productClient(h, 211);
  setupProduct();
  await mountProduct(a); await openProduct(); await recordProductWorkout();
  let reached!: () => void, release!: () => void;
  const started = new Promise<void>(resolve => { reached = resolve; });
  const held = new Promise<void>(resolve => { release = resolve; });
  a.state.afterFetch = async target => {
    if (target.pathname.endsWith('/mutations')) { reached(); await held; }
  };
  try {
    await click(controls('sync'));
    await started;
    expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 1, events: 1 });
    await act(async () => {
      a.selectDevice(b.wire.deviceId);
      a.selectDevice(a.wire.deviceId);
    });
    expect(element(controls('sync'))).toBeTruthy();
    expect(element<HTMLButtonElement>(controls('sync'))?.disabled).toBe(true);
    await mountProduct(b, day, false);
    expect(element(controls('draft'))).toBeNull();
    await openProduct();
    expect(element(controls('session'))).toBeNull();
    await mountProduct(a, day, false);
    expect(element(controls('draft'))).toBeNull();
  } finally {
    a.state.afterFetch = null;
    await act(async () => { release(); await held; });
  }
  await openProduct();
  await visible('[data-health-canonical-state="uncertain"]');
  const claimed = await a.database.listOutboxMutations({ limit: 10 });
  expect(claimed).toHaveLength(1);
  expect(claimed[0]?.status).toBe('claimed');
  a.state.at += 35;
  await syncProduct('acknowledged', true);
  const payloads = h.calls.filter(call => call.path.endsWith('/mutations')).map(call => call.body);
  expect(payloads).toHaveLength(2);
  expect(payloads[0]).toBe(payloads[1]);
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 1, events: 1 });
  expect(vi.mocked(fetch)).not.toHaveBeenCalled();
}, 30_000);

it('delivers one multi-exercise canonical create, loses its receipt, pulls without acknowledging, then replays and reads the same session on a second client', async () => {
  const h = await harness();
  const producer = await client(h, alice, 10);
  const reader = await client(h, alice, 11);
  const proof = await producer.discover();
  await reader.discover();
  const record = workout();
  const saved = await producer.sessions.createWorkoutSession(record, { now: now(0) });
  expect(proof.projectScope).toBe(projectScope);
  expect(h.calls).toHaveLength(4); // discovery only; local save does not transmit
  const bound = await producer.database.bindWorkoutMutation({
    mutationId: saved.outbox.mutationId, expectedVerificationId: proof.verificationId,
    currentAuthenticatedAccount: producer.opts.currentAccountId, currentDeviceId: producer.opts.currentDeviceId,
  });
  expect(bound.deliveryBinding).toMatchObject({ state: 'bound', remoteCasBaseRevision: null });
  let clock = now(1);
  const push = { ...producer.opts, now: () => clock, limit: 1, retryBaseDelayMs: 1, retryMaxDelayMs: 5 };
  h.loseNextResponse();
  expect(await runWorkoutPushIteration(producer.database, push)).toMatchObject({ retryable: 1, success: 0 });
  const first = h.calls.at(-1)!;
  expect(first.reply).toMatchObject({
    outcome: 'success', mutationId: saved.outbox.mutationId, entityId: record.id,
    changeSequence: 1, serverRevision: 1, bindingId: proof.generationBindingId,
    contentHash: hashCanonicalPayload(record), payloadHash: saved.outbox.payloadHash,
  });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 1, events: 1 });
  const pending = await producer.database.getOutboxRecord(saved.outbox.mutationId);
  expect(pending?.status).toBe('retry_wait');
  expect(await runWorkoutPullIteration(producer.database, producer.opts)).toMatchObject({ kind: 'applied', nextCursor: 1 });
  expect(await producer.database.getOutboxRecord(saved.outbox.mutationId)).toEqual(pending);
  clock = now(3);
  expect(await runWorkoutPushIteration(producer.database, push)).toMatchObject({ success: 0, exactReplay: 1 });
  const replay = h.calls.at(-1)!;
  expect(replay.body).toBe(first.body);
  expect(replay.reply).toEqual({ ...first.reply, outcome: 'exact_replay' });
  expect(await producer.database.getOutboxRecord(saved.outbox.mutationId)).toMatchObject({
    status: 'acknowledged', acknowledgedRevision: 1, remoteMutationRef: first.reply.remoteMutationRef,
    serverCommittedAt: first.reply.serverCommittedAt,
  });
  expect(await runWorkoutPushIteration(producer.database, push)).toMatchObject({ claimed: 0 });
  expect(await runWorkoutPullIteration(reader.database, reader.opts)).toEqual({
    kind: 'applied', applied: 1, conflicts: 0, ownEchoes: 0, nextCursor: 1,
  });
  const page = h.calls.at(-1)!;
  expect(page.reply.changes[0]).toMatchObject({ record, contentHash: first.reply.contentHash, sequence: first.reply.changeSequence,
    remoteMutationRef: first.reply.remoteMutationRef, serverCommittedAt: first.reply.serverCommittedAt, serverRevision: 1 });
  expect(await runWorkoutPullIteration(reader.database, reader.opts)).toEqual({ kind: 'empty', nextCursor: 1 });
  const empty = h.calls.at(-1)!;
  expect(await reader.database.getOutboxRecord(saved.outbox.mutationId)).toBeNull();
  vi.stubGlobal('indexedDB', reader.factory);
  const canonicalReader = await WorkoutSelectedDayReader.open(alice, {
    getItem: (key: string) => key === HEALTH_ROUTINE_DEVICE_ID_KEY ? reader.wire.deviceId : null,
  } as Storage);
  try { expect(await canonicalReader.read(day)).toEqual([{
    accountId: alice, namespaceKey: reader.wire.namespaceKey, generationId: reader.wire.generationId,
    entityId: record.id, localRevision: 1, session: record,
  }]); } finally { canonicalReader.close(); }
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 1, events: 1 });
  expect(h.calls).toHaveLength(9);
  for (const call of [first, replay, page, empty]) expect(call.metrics?.statements).toBe(2);
  expect(replay.metrics?.rowsWritten).toBe(0);
  expect(page.metrics?.rowsWritten).toBe(0);
  console.info('health-worker-local-measurement', JSON.stringify({
    requests: h.calls.length, discovery: 4, mutationRequests: 2, pullRequests: 3,
    bundleBytes, gzipBytes, requestBytes: Buffer.byteLength(first.body!),
    create: { ...first.metrics, responseBytes: first.bytes }, replay: { ...replay.metrics, responseBytes: replay.bytes },
    pull: { ...page.metrics, responseBytes: page.bytes }, empty: { ...empty.metrics, responseBytes: empty.bytes },
  }));
});

it('serializes concurrent identical deliveries and rejects conflicting mutation, idempotency and entity identities', async () => {
  const h = await harness(), f = await client(h, alice, 10);
  await f.discover(); // Warm synthetic JWKS so both requests reach the database.
  const candidate = wire(f);
  const [a, b] = await Promise.all([post(h, f, candidate), post(h, f, candidate)]);
  const replies = [await a.json(), await b.json()].sort((x, y) => x.outcome.localeCompare(y.outcome));
  expect(replies[0]).toEqual({ ...replies[1], outcome: 'exact_replay' });
  expect(replies[1]).toMatchObject({ outcome: 'success', changeSequence: 1 });
  const different = workout();
  different.entries[0]!.exercise.name += ' changed';
  expect(await (await post(h, f, wire(f, different))).json()).toMatchObject({ errorCode: 'MUTATION_ID_CONFLICT' });
  const reuse = { ...wire(f, workout(101), 101), idempotencyKey: candidate.idempotencyKey };
  expect(await (await post(h, f, { ...reuse, requestDigest: digest(f, reuse) })).json()).toMatchObject({ errorCode: 'IDEMPOTENCY_CONFLICT' });
  expect(await (await post(h, f, wire(f, workout(), 102))).json()).toMatchObject({ errorCode: 'ENTITY_ALREADY_EXISTS',
    currentServerRevision: 1, currentContentHash: replies[1].contentHash, currentRemoteMutationRef: replies[1].remoteMutationRef });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 1, events: 1 });
});

it('synchronizes real repository updates both ways and preserves earlier events and receipts', async () => {
  const h = await harness(), a = await client(h, alice, 10), b = await client(h, alice, 11);
  const ax = await a.discover(), bx = await b.discover();
  const record = workout(), v2 = edited(record, '77.5', 9, true), v3 = edited(v2, '80', 10);
  const m1 = await a.sessions.createWorkoutSession(record, { now: now(0) });
  await bind(a, m1.outbox.mutationId, ax.verificationId);
  expect(await pushAt(a, 1)).toMatchObject({ success: 1 });
  const create = h.calls.at(-1)!;
  expect(await runWorkoutPullIteration(b.database, b.opts)).toMatchObject({ applied: 1, nextCursor: 1 });
  const event1 = h.calls.at(-1)!.reply.changes[0];
  const m2 = await b.sessions.updateWorkoutSession(record.id, 1, v2, { now: now(2) });
  expect((await bind(b, m2.outbox.mutationId, bx.verificationId)).deliveryBinding)
    .toMatchObject({ remoteCasBaseRevision: 1 });
  expect(await pushAt(b, 3)).toMatchObject({ success: 1 });
  const update = h.calls.at(-1)!;
  expect(update.reply).toMatchObject({ serverRevision: 2, changeSequence: 2, contentHash: hashCanonicalPayload(v2),
    bindingId: b.wire.bindingId, authorityEpoch: 1, payloadHash: m2.outbox.payloadHash });
  expect(await b.database.getOutboxRecord(m2.outbox.mutationId)).toMatchObject({
    status: 'acknowledged', acknowledgedRevision: 2, remoteMutationRef: update.reply.remoteMutationRef,
  });
  expect(await (await post(h, a, JSON.parse(create.body!))).json()).toEqual({ ...create.reply, outcome: 'exact_replay' });
  expect(await runWorkoutPullIteration(a.database, a.opts)).toEqual({
    kind: 'applied', applied: 1, conflicts: 0, ownEchoes: 1, nextCursor: 2,
  });
  const page = h.calls.at(-1)!;
  expect(page.reply.changes).toEqual([event1, { ...event1, record: v2, contentHash: update.reply.contentHash,
    sequence: 2, serverRevision: 2, remoteMutationRef: update.reply.remoteMutationRef,
    serverCommittedAt: update.reply.serverCommittedAt }]);
  expect(await a.sessions.getWorkoutSession(record.id)).toMatchObject({ record: v2, serverRevision: 2 });

  const m3 = await a.sessions.updateWorkoutSession(record.id, 2, v3, { now: now(4) });
  expect((await bind(a, m3.outbox.mutationId, ax.verificationId)).deliveryBinding)
    .toMatchObject({ remoteCasBaseRevision: 2 });
  expect(await pushAt(a, 5)).toMatchObject({ success: 1 });
  expect(h.calls.at(-1)!.reply).toMatchObject({ serverRevision: 3, changeSequence: 3 });
  expect(await runWorkoutPullIteration(b.database, b.opts)).toMatchObject({ applied: 1, ownEchoes: 1, nextCursor: 3 });
  expect(await b.sessions.getWorkoutSession(record.id)).toMatchObject({ record: v3, serverRevision: 3 });
  expect(await (await post(h, b, JSON.parse(update.body!))).json()).toEqual({ ...update.reply, outcome: 'exact_replay' });
  const replay = h.calls.at(-1)!;
  expect(replay.metrics).toMatchObject({ statements: 2, rowsWritten: 0 });
  expect(await (await get(h, b, { limit: '2' })).json()).toMatchObject({ changes: page.reply.changes, nextCursor: 2 });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 3, events: 3 });
  const snapshots = await h.db.prepare(`SELECT revision, length(CAST(record AS BLOB)) AS recordBytes
    FROM workout_changes ORDER BY sequence`).all();
  const measure = (call: Call) => ({ ...call.metrics, requestBytes: call.body ? Buffer.byteLength(call.body) : null,
    responseBytes: call.bytes });
  console.info('health-worker-update-measurement', JSON.stringify({
    create: measure(create), update: measure(update), replay: measure(replay), twoRevisionPull: measure(page),
    storedSnapshots: snapshots.results,
  }));
});

it('admits one concurrent CAS winner and preserves the losing repository edit and conflict evidence', async () => {
  const h = await harness(), a = await client(h, alice, 10), b = await client(h, alice, 11);
  const ax = await a.discover(), bx = await b.discover(), record = workout();
  expect((await post(h, a, wire(a))).status).toBe(200);
  for (const f of [a, b]) await runWorkoutPullIteration(f.database, f.opts);
  const attempts = await Promise.all([
    { f: a, proof: ax, value: edited(record, '76', 8) },
    { f: b, proof: bx, value: edited(record, '79', 9) },
  ].map(async ({ f, proof, value }) => {
      const change = await f.sessions.updateWorkoutSession(record.id, 1, value, { now: now(2) });
      expect((await bind(f, change.outbox.mutationId, proof.verificationId)).deliveryBinding)
        .toMatchObject({ remoteCasBaseRevision: 1 });
      return { f, value, mutation: change.outbox.mutationId };
    }));
  const results = await Promise.all(attempts.map(({ f }) => pushAt(f, 3)));
  expect(results.map(x => x.success).sort()).toEqual([0, 1]);
  expect(results.map(x => x.conflict).sort()).toEqual([0, 1]);
  const winner = attempts[results.findIndex(x => x.success === 1)]!;
  const loser = attempts.find(x => x !== winner)!;
  const win = h.calls.find(x => x.reply.serverRevision === 2)!.reply;
  const conflict = h.calls.find(x => x.reply.errorCode === 'CAS_CONFLICT')!;
  expect(conflict.status).toBe(409);
  expect(conflict.metrics).toMatchObject({ statements: 2, rowsWritten: 0 });
  expect(conflict.reply).toEqual({ outcome: 'rejected', errorCode: 'CAS_CONFLICT', currentIsDeleted: false,
    currentServerRevision: 2, currentContentHash: hashCanonicalPayload(winner.value), currentRemoteMutationRef: win.remoteMutationRef });
  expect(await loser.f.database.getOutboxRecord(loser.mutation)).toMatchObject({ status: 'conflict', lastErrorCode: 'CAS_CONFLICT' });
  expect(await runWorkoutPullIteration(loser.f.database, loser.f.opts)).toMatchObject({ applied: 0, conflicts: 1, nextCursor: 2 });
  expect(await loser.f.sessions.getWorkoutSession(record.id)).toMatchObject({
    record: loser.value, serverRevision: 1, pendingMutationId: loser.mutation,
  });
  expect(await winner.f.sessions.getWorkoutSession(record.id)).toMatchObject({ record: winner.value, serverRevision: 2 });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 2, events: 2 });
});

it('replays a lost update response without replacing a newer pending edit or acknowledging it from pull', async () => {
  const h = await harness(), f = await client(h, alice, 10);
  const proof = await f.discover(), record = workout();
  expect((await post(h, f, wire(f))).status).toBe(200);
  await runWorkoutPullIteration(f.database, f.opts);
  const updated = edited(record, '77.5', 9), newer = edited(updated, '78.5', 11, true);
  const prev = await f.sessions.updateWorkoutSession(record.id, 1, updated, { now: now(2) });
  await bind(f, prev.outbox.mutationId, proof.verificationId);
  h.loseNextResponse();
  expect(await pushAt(f, 3)).toMatchObject({ retryable: 1, success: 0 });
  const committed = h.calls.at(-1)!;
  expect(committed.reply).toMatchObject({ outcome: 'success', serverRevision: 2, changeSequence: 2 });
  const next = await f.sessions.updateWorkoutSession(record.id, 2, newer, { now: now(4) });
  const pending = await f.database.getOutboxRecord(next.outbox.mutationId);
  const retry = await f.database.getOutboxRecord(prev.outbox.mutationId);
  expect(retry?.status).toBe('retry_wait');
  expect(await runWorkoutPullIteration(f.database, f.opts)).toMatchObject({ applied: 0, conflicts: 1, nextCursor: 2 });
  expect(await f.database.getOutboxRecord(prev.outbox.mutationId)).toEqual(retry);
  expect(await pushAt(f, 5)).toMatchObject({ exactReplay: 1 });
  expect(h.calls.at(-1)).toMatchObject({ body: committed.body, reply: { ...committed.reply, outcome: 'exact_replay' } });
  expect(await f.database.getOutboxRecord(prev.outbox.mutationId)).toMatchObject({ status: 'acknowledged', acknowledgedRevision: 2 });
  expect(await f.database.getOutboxRecord(next.outbox.mutationId)).toEqual(pending);
  expect(await f.sessions.getWorkoutSession(record.id)).toMatchObject({ record: newer, localRevision: 3,
    pendingMutationId: next.outbox.mutationId, serverRevision: 1 });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 2, events: 2 });
});

it.each(['workout_changes', 'workout_receipts'])('rolls the entire create back when %s fails, then admits the exact first create', async table => {
  const h = await harness(), f = await client(h, alice, 10);
  await h.db.prepare(`CREATE TRIGGER abort_fixture BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'synthetic rollback'); END`).run();
  const candidate = wire(f);
  expect((await post(h, f, candidate)).status).toBe(503);
  expect(await counts(h.db)).toEqual({ sessions: 0, receipts: 0, events: 0 });
  expect(await (await get(h, f)).json()).toMatchObject({ status: 'changes', changes: [], nextCursor: 0 });
  await h.db.prepare('DROP TRIGGER abort_fixture').run();
  expect(await (await post(h, f, candidate)).json()).toMatchObject({ outcome: 'success', changeSequence: 1 });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 1, events: 1 });
});

it.each(['workout_changes', 'workout_receipts'])('rolls back the update and leaves historical evidence intact when %s fails', async table => {
  const h = await harness(), f = await client(h, alice, 10), first = wire(f);
  const created = await (await post(h, f, first)).json();
  const initialPage = await (await get(h, f)).json();
  await h.db.prepare(`CREATE TRIGGER abort_fixture BEFORE INSERT ON ${table} BEGIN SELECT RAISE(ABORT, 'synthetic rollback'); END`).run();
  const second = wire(f, edited(workout(), '78', 9), 101, 1);
  expect((await post(h, f, second)).status).toBe(503);
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 1, events: 1 });
  expect(await h.db.prepare('SELECT revision, sequence FROM workout_entities').first()).toEqual({ revision: 1, sequence: 1 });
  expect(await (await get(h, f)).json()).toEqual(initialPage);
  expect(await (await post(h, f, first)).json()).toEqual({ ...created, outcome: 'exact_replay' });
  await h.db.prepare('DROP TRIGGER abort_fixture').run();
  expect(await (await post(h, f, second)).json()).toMatchObject({ outcome: 'success', serverRevision: 2, changeSequence: 2 });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 2, events: 2 });
});

it('isolates update authority, rejects missing identities and preserves history on mutation and idempotency reuse', async () => {
  const h = await harness(), a = await client(h, alice, 10), b = await client(h, bob, 11);
  const original = wire(a), second = wire(a, edited(workout(), '78', 9), 101, 1);
  expect(await (await post(h, a, second)).json()).toEqual({ outcome: 'rejected', errorCode: 'NOT_FOUND' });
  expect((await post(h, a, original)).status).toBe(200);
  expect(await (await post(h, b, wire(b, workout(), 101, 1))).json()).toEqual({ outcome: 'rejected', errorCode: 'NOT_FOUND' });
  const denied = async (overrides: Partial<typeof second>, actor = a, code = 'STALE_GENERATION_BINDING') => {
    const input = { ...second, ...overrides };
    expect(await (await post(h, actor, { ...input, requestDigest: digest(actor, input) })).json()).toMatchObject({ errorCode: code });
  };
  await denied({}, b);
  await denied({ deviceId: b.wire.deviceId });
  await denied({ bindingId: b.wire.bindingId });
  const applied = await (await post(h, a, second)).json();
  expect(applied).toMatchObject({ outcome: 'success', serverRevision: 2 });
  const changed = wire(a, edited(workout(), '79', 9), 101, 2);
  expect(await (await post(h, a, changed)).json()).toMatchObject({ errorCode: 'MUTATION_ID_CONFLICT' });
  const reused = { ...wire(a, edited(workout(), '79', 9), 102, 2), idempotencyKey: second.idempotencyKey };
  expect(await (await post(h, a, { ...reused, requestDigest: digest(a, reused) })).json())
    .toMatchObject({ errorCode: 'IDEMPOTENCY_CONFLICT' });
  expect(await (await post(h, a, second)).json()).toEqual({ ...applied, outcome: 'exact_replay' });
  await h.db.prepare('UPDATE workout_bindings SET is_active = 0 WHERE binding = ?').bind(a.wire.bindingId).run();
  await denied({});
  await h.db.prepare('UPDATE workout_authority SET epoch = 2 WHERE owner = ? AND project = ?').bind(alice, projectScope).run();
  await denied({}, a, 'STALE_AUTHORITY_EPOCH');
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 2, events: 2 });
});

it.each(['server', 'authority'])('denies a fresh exact-base update after a stream %s epoch change', async kind => {
  const h = await harness(), a = await client(h, alice, 10);
  expect((await post(h, a, wire(a))).status).toBe(200);
  const second = wire(a, edited(workout(), '78', 9), 101, 1);
  expect((await post(h, a, second)).status).toBe(200);
  const head = () => h.db.prepare('SELECT revision, sequence FROM workout_entities').first();
  expect(await head()).toEqual({ revision: 2, sequence: 2 });
  if (kind === 'server') {
    await h.db.prepare('UPDATE workout_authority SET server_epoch = ? WHERE owner = ?').bind(uuid(701), alice).run();
  } else {
    await h.db.batch([
      h.db.prepare('UPDATE workout_authority SET epoch = 2 WHERE owner = ?').bind(alice),
      h.db.prepare('UPDATE workout_bindings SET binding = ?, epoch = 2 WHERE binding = ?').bind(uuid(703), a.wire.bindingId),
    ]);
    a.wire.bindingId = uuid(703);
    a.wire.authorityEpoch = 2;
  }
  const candidate = wire(a, edited(workout(), '79', 10), 102, 2);
  const reply = await post(h, a, candidate);
  expect(reply.status).toBe(409);
  expect(await reply.json()).toEqual({ outcome: 'rejected', errorCode: 'AUTHORITY_EVIDENCE_MISSING' });
  expect(h.calls.at(-1)!.metrics).toMatchObject({ statements: 2, rowsWritten: 0 });
  expect(await head()).toEqual({ revision: 2, sequence: 2 });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 2, events: 2 });
});

it('paginates through revisions of the same entity without rescanning its history for a write', async () => {
  const h = await harness(), a = await client(h, alice, 10), b = await client(h, alice, 11), record = workout();
  await b.discover();
  expect((await post(h, a, wire(a))).status).toBe(200);
  const versions = [record];
  const reads: number[] = [];
  for (let revision = 2; revision <= 17; revision++) {
    const updated = edited(record, '78', revision);
    versions.push(updated);
    expect(await (await post(h, a, wire(a, updated, 100 + revision, revision - 1))).json())
      .toMatchObject({ outcome: 'success', serverRevision: revision, changeSequence: revision });
    const metrics = h.calls.at(-1)!.metrics!;
    expect(metrics.statements).toBe(2);
    reads.push(metrics.rowsRead);
  }
  expect(new Set(reads).size).toBe(1);
  expect(await runWorkoutPullIteration(b.database, b.opts)).toMatchObject({ applied: 16, conflicts: 0, nextCursor: 16 });
  expect(h.calls.at(-1)!.reply.changes.map((change: { record: WorkoutSessionV1 }) => change.record)).toEqual(versions.slice(0, 16));
  expect(await b.sessions.getWorkoutSession(record.id)).toMatchObject({ serverRevision: 16, record: versions[15] });
  expect(await runWorkoutPullIteration(b.database, b.opts)).toMatchObject({ applied: 1, conflicts: 0, nextCursor: 17 });
  expect(await b.sessions.getWorkoutSession(record.id)).toMatchObject({ serverRevision: 17, record: versions[16] });
  expect(await runWorkoutPullIteration(b.database, b.opts)).toEqual({ kind: 'empty', nextCursor: 17 });
  expect(await counts(h.db)).toEqual({ sessions: 1, receipts: 17, events: 17 });
});

it('keeps authority and the stream scoped to the verified account and rejects stale authority before replay', async () => {
  const h = await harness(), a = await client(h, alice, 10), b = await client(h, bob, 11), missing = await client(h, unknown, 12, false);
  const candidate = wire(a);
  expect((await post(h, a, candidate)).status).toBe(200);
  expect(await (await get(h, b)).json()).toMatchObject({ changes: [], nextCursor: 0 });
  expect(await (await get(h, b, { ...a.wire, authorityEpoch: '1' })).json()).toMatchObject({ errorCode: 'STALE_GENERATION_BINDING' });
  const stolen = { ...candidate, requestDigest: digest(b, candidate) };
  expect(await (await post(h, b, stolen)).json()).toMatchObject({ errorCode: 'STALE_GENERATION_BINDING' });
  expect(await (await post(h, missing, wire(missing))).json()).toMatchObject({ errorCode: 'CAPABILITY_DISABLED' });
  await expect(missing.discover()).rejects.toMatchObject({ code: 'SHARED_GENERATION_UNPROVEN' });
  expect(await (await post(h, b, wire(b))).json()).toMatchObject({ outcome: 'success', changeSequence: 1 });
  await h.db.prepare('UPDATE workout_bindings SET is_active = 0 WHERE binding = ?').bind(a.wire.bindingId).run();
  expect(await (await post(h, a, candidate)).json()).toMatchObject({ errorCode: 'STALE_GENERATION_BINDING' });
  expect(await (await get(h, a)).json()).toMatchObject({ errorCode: 'STALE_GENERATION_BINDING' });
  await h.db.prepare('UPDATE workout_authority SET epoch = 2 WHERE owner = ? AND project = ?').bind(alice, projectScope).run();
  expect(await (await post(h, a, candidate)).json()).toMatchObject({ errorCode: 'STALE_AUTHORITY_EPOCH' });
  expect(await counts(h.db)).toEqual({ sessions: 2, receipts: 2, events: 2 });
});

it('rejects invalid hashes, request digests, Workout fields, coercions and unsupported writes without D1 writes', async () => {
  const h = await harness(), f = await client(h, alice, 10), input = wire(f);
  const invalid = workout();
  invalid.entries[0]!.sets[0]!.ordinal = 2;
  const mutationAsArray = { ...input, mutationId: [input.mutationId] };
  const idempotencyAsArray = { ...input, idempotencyKey: [input.idempotencyKey] };
  for (const candidate of [{ ...input, payloadHash: '0'.repeat(64) }, wire(f, invalid),
    { ...mutationAsArray, requestDigest: digest(f, mutationAsArray) },
    { ...idempotencyAsArray, requestDigest: digest(f, idempotencyAsArray) },
    { ...input, createdAt: '2026-02-30T00:00:00Z' },
    { ...input, remoteCasBaseRevision: 0 }, { ...input, remoteCasBaseRevision: '1' }]) {
    expect(await (await post(h, f, candidate)).json()).toEqual({ detail: 'INVALID_PAYLOAD' });
  }
  expect(await (await post(h, f, { ...input, requestDigest: '0'.repeat(64) })).json()).toMatchObject({ errorCode: 'REQUEST_DIGEST_MISMATCH' });
  for (const candidate of [{ ...input, operation: 'tombstone' }, { ...input, operation: 'restore' }]) {
    expect(await (await post(h, f, candidate)).json()).toMatchObject({ errorCode: 'UNSUPPORTED_OPERATION' });
  }
  const path = origin + base + '/workouts/mutations';
  for (const raw of [JSON.stringify(input).replace('"version":1', '"version":1.0'),
    JSON.stringify(input).replace('Pull-up', '\\ud800'), ' '.repeat(262145)]) {
    expect((await h.fetchImpl(path, { method: 'POST', headers: auth(alice), body: raw })).status).toBe(400);
  }
  for (const path of ['/workouts/reset', '/workouts/generations', '/workouts/snapshots']) {
    expect((await h.fetchImpl(origin + base + path, { method: 'POST', headers: auth(alice) })).status).toBe(404);
  }
  expect(h.calls.every(call => call.metrics === null)).toBe(true);
  expect(await counts(h.db)).toEqual({ sessions: 0, receipts: 0, events: 0 });
});

it('uses the shared cross-language hashes and keeps exact UTF-8 content on the wire', async () => {
  const v = vectors.vectors[0]!;
  expect(workoutRequestDigest({ authenticatedOwnerId: vectors.ownerId, projectScope: vectors.projectScope,
    namespaceKey: vectors.namespaceKey, generationId: vectors.generationId, deviceId: vectors.deviceId,
    generationBindingId: vectors.bindingId, authorityEpoch: vectors.authorityEpoch,
    mutationId: v.mutationId, idempotencyKey: v.idempotencyKey, wireEntityId: v.record!.id.toLowerCase(),
    operation: 'upsert', remoteCasBaseRevision: null, localRevision: v.localRevision, payloadHash: v.expectedPayloadHash,
  })).toBe(v.expectedRequestDigest);
  const h = await harness(), f = await client(h, alice, 10);
  const candidate = wire(f, v.record as WorkoutSessionV1);
  expect(candidate.payloadHash).toBe(v.expectedPayloadHash);
  expect(await (await post(h, f, { ...candidate, createdAt: '2026-09-23T00:00:00Z' })).json()).toMatchObject({
    outcome: 'success', payloadHash: v.expectedPayloadHash, contentHash: v.expectedContentHash,
  });
  expect(await (await get(h, f)).json()).toMatchObject({ changes: [{ record: v.record }] });
});

it('bounds pages, preserves cursor on malformed duplicate and empty delivery, and fails closed on a changed server epoch', async () => {
  const h = await harness(), f = await client(h, alice, 10), r = await client(h, alice, 11);
  await r.discover();
  expect((await post(h, f, wire(f, workout(200), 200))).status).toBe(200);
  const rejectionReads = async () => {
    expect(await (await get(h, r, { limit: '1', serverEpoch: uuid(701) })).json())
      .toMatchObject({ status: 'full_resync_required', errorCode: 'SERVER_EPOCH_MISMATCH', changes: [] });
    const epochReads = h.calls.at(-1)!.metrics!.rowsRead;
    expect(await (await get(h, r, { limit: '1', bindingId: uuid(702) })).json())
      .toMatchObject({ status: 'rejected', errorCode: 'STALE_GENERATION_BINDING' });
    return [epochReads, h.calls.at(-1)!.metrics!.rowsRead];
  };
  const shortRejections = await rejectionReads();
  for (let n = 201; n < 217; n++) expect((await post(h, f, wire(f, workout(n), n))).status).toBe(200);
  expect(await rejectionReads()).toEqual(shortRejections);
  const first = await runWorkoutPullIteration(r.database, r.opts);
  expect(first).toMatchObject({ applied: 16, nextCursor: 16 });
  const replay = await get(h, r);
  const checkpoint = () => r.database.getSyncCheckpoint('workout_g4a', WORKOUT_REMOTE_DOMAIN);
  await expect(runWorkoutPullIteration(r.database, { ...r.opts, fetchImpl: async () => replay }))
    .rejects.toMatchObject({ code: 'MALFORMED_RESPONSE' });
  expect(await checkpoint()).toMatchObject({ sequence: 16 });
  expect(await runWorkoutPullIteration(r.database, r.opts)).toMatchObject({ applied: 1, nextCursor: 17 });
  expect(await runWorkoutPullIteration(r.database, r.opts)).toEqual({ kind: 'empty', nextCursor: 17 });
  await h.db.prepare('UPDATE workout_authority SET server_epoch = ? WHERE owner = ?').bind(uuid(701), alice).run();
  expect(await runWorkoutPullIteration(r.database, r.opts)).toEqual({ kind: 'full_resync_required', code: 'SERVER_EPOCH_MISMATCH' });
  expect(await checkpoint()).toMatchObject({ sequence: 17, serverEpoch });
  expect(await (await get(h, r)).json()).toMatchObject({ status: 'rejected', errorCode: 'AUTHORITY_EVIDENCE_MISSING' });
  expect(await (await post(h, f, wire(f, workout(200), 200))).json()).toMatchObject({ errorCode: 'AUTHORITY_EVIDENCE_MISSING' });
  expect(await (await post(h, f, wire(f, workout(217), 217))).json()).toMatchObject({ errorCode: 'AUTHORITY_EVIDENCE_MISSING' });
  expect(await counts(h.db)).toEqual({ sessions: 17, receipts: 17, events: 17 });
});

it('is default off, rejects a non-loopback route and rejects a wrong issuer even on loopback', async () => {
  const off = await harness(false), f = await client(off, alice, 10);
  expect((await post(off, f, wire(f))).status).toBe(404);
  expect(await counts(off.db)).toEqual({ sessions: 0, receipts: 0, events: 0 });
  const h = await harness(), a = await client(h, alice, 10);
  const path = base + '/workouts/mutations';
  const send = (url: string, actor: string) => h.runner.dispatchFetch(url + path, {
    method: 'POST', headers: auth(actor), body: JSON.stringify(wire(a)),
  });
  expect((await send('https://health-example.invalid', alice)).status).toBe(404);
  expect((await send(origin, 'wrong-issuer')).status).toBe(401);
  expect(await counts(h.db)).toEqual({ sessions: 0, receipts: 0, events: 0 });
});
