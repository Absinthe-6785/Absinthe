import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { gzipSync } from 'node:zlib';
import { build } from 'esbuild';
import { afterEach, beforeAll, expect, it, vi } from 'vitest';
import {
  closeLocalDatabase, createDormantLocalDatabaseCapability, openLocalDatabase, type LocalDatabaseRepository,
} from '../src/lib/localDatabase';
import { hashCanonicalPayload } from '../src/lib/localDatabase/canonicalPayload';
import { HEALTH_ROUTINE_DEVICE_ID_KEY, HEALTH_ROUTINE_GENERATION_ID, HEALTH_ROUTINE_PROJECT_REF } from '../src/lib/workoutLocalReaderAuthority';
import { createWorkoutRemoteControlClient } from '../src/lib/workoutRemoteClient';
import { WORKOUT_REMOTE_DOMAIN, workoutRequestDigest } from '../src/lib/workoutRemoteContract';
import { runWorkoutPullIteration } from '../src/lib/workoutRemotePull';
import { runWorkoutPushIteration } from '../src/lib/workoutRemotePush';
import { WorkoutSelectedDayReader } from '../src/lib/workoutSelectedDayReader';
import { WorkoutSessionRepository } from '../src/lib/workoutSessionRepository';
import type { WorkoutSessionV1 } from '../src/lib/workoutSessionV1';
import vectors from '../../protocol/rel05g4a-workout-vectors.json';

// No real Auth configuration or client can be loaded in this suite.
vi.mock('../src/lib/supabase', () => ({ supabase: {} }));

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
async function client(h: Harness, accountId: string, n: number, seed = true) {
  const factory = new IDBFactory();
  const deviceId = uuid(n), bindingId = uuid(n + 1000);
  // A separate IDBFactory, synthetic owner/device and a distinct trusted remote
  // project. This does not reuse or opt in the canonical local-save QA namespace.
  const database = await openLocalDatabase({ userId: accountId, deviceId, projectRef: HEALTH_ROUTINE_PROJECT_REF,
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
function wire(f: Fixture, record = workout(), id = 100) {
  const payload = { kind: 'entity_snapshot', record };
  const request = { protocolVersion: 2, ...f.wire, domain: WORKOUT_REMOTE_DOMAIN, entityId: record.id.toLowerCase(),
    mutationId: 'mut.' + uuid(id), idempotencyKey: 'k322.' + id.toString(16).padStart(64, '0'), operation: 'upsert',
    remoteCasBaseRevision: null, localRevision: 1, payload, payloadHash: hashCanonicalPayload(payload) };
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
    { ...input, createdAt: '2026-02-30T00:00:00Z' }]) {
    expect(await (await post(h, f, candidate)).json()).toEqual({ detail: 'INVALID_PAYLOAD' });
  }
  expect(await (await post(h, f, { ...input, requestDigest: '0'.repeat(64) })).json()).toMatchObject({ errorCode: 'REQUEST_DIGEST_MISMATCH' });
  for (const candidate of [{ ...input, operation: 'tombstone' }, { ...input, operation: 'restore' },
    { ...input, remoteCasBaseRevision: 1 }]) {
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
