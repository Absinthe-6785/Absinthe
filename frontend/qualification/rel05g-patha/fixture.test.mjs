import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, readdir, mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Fixture, DENIED_KEYS, PROTOCOL, assertOrigin, identifier, keyFor, lockFor,
  navigationPayload, stableJSON, storageFor } from './core.mjs';
import { artifacts, build, hash, root } from './build.mjs';
import { serverFor } from './serve.mjs';
import { Window } from 'happy-dom';
import http from 'node:http';

const sourceGitSha = 'a'.repeat(40); const buildId = 'b'.repeat(64);
const provenance = (role) => ({ sourceGitSha, buildId, role, protocolVersion: PROTOCOL,
  manifestSha256: 'c'.repeat(64), manifestPath: `/${buildId}/artifact-manifest.json`, authToken: 'SECRET' });
function environment(raw = new Map()) {
  const touched = []; let ticks = 0; let timer; let fail = false;
  const ports = { origin: 'http://127.0.0.1:4189', uuid: randomUUID,
    wall: () => 1000 + ticks, now: () => ++ticks, timeOrigin: 900,
    visibility: () => 'visible', secureContext: true, displayMode: 'browser-or-other',
    navigationType: 'navigate', setTimer: (fn) => { timer = fn; return 1; }, clearTimer: () => {},
    storage: {
      getItem: (key) => { touched.push(['get', key]); return raw.get(key) ?? null; },
      setItem: (key, value) => { touched.push(['set', key]); if (fail) throw new Error('DENIED'); raw.set(key, value); },
      removeItem: (key) => { touched.push(['remove', key]); raw.delete(key); },
      get length() { throw new Error('ENUMERATION_FORBIDDEN'); },
      key() { throw new Error('ENUMERATION_FORBIDDEN'); }, clear() { throw new Error('CLEAR_FORBIDDEN'); },
    },
  };
  return { ports, raw, touched, expire: () => timer(), failWrites: () => { fail = true; } };
}
const create = (role = 'CURRENT_FIXTURE', env = environment(), runId = 'r001') =>
  new Fixture({ runId, testId: 'A1', role, provenance: provenance(role) }, env.ports);
const turn = () => new Promise((resolve) => setImmediate(resolve));

test('qualification key exact generation, shared across test IDs', () => {
  assert.equal(keyFor('r001', 'scope-token'), 'rel05g-patha-qual:v1:r001:scope-token');
  assert.equal(keyFor('r001', `event-log:${randomUUID()}`).startsWith('rel05g-patha-qual:v1:r001:'), true);
});
test('qualification lock exact generation', () => assert.equal(lockFor('r001'), 'rel05g-patha-qual:v1:r001:scope-lock'));
test('production denylist and all nonallowlisted keys rejected before raw access', () => {
  const env = environment(); const store = storageFor(env.ports.storage, 'r001');
  for (const suffix of [...DENIED_KEYS, 'outbox', 'scope-lock', 'event-log:fake', '../scope-token', 'scope-token:extra']) {
    for (const call of [() => store.read(suffix), () => store.write(suffix, 'bad'), () => store.remove(suffix)]) {
      assert.throws(call, /KEY_NOT_ALLOWLISTED/);
    }
  }
  assert.equal(env.touched.length, 0);
});
test('malformed and colon-injected run IDs rejected', () => {
  for (const run of ['', 'a:b', '../x', 'x'.repeat(65), null]) assert.throws(() => identifier(run));
});
const deniedOrigins = [
  'https://rel05g-patha-qual-attacker.vercel.app',
  'https://rel05g-patha-qual-attacker-otherteam.vercel.app',
  'https://rel05g-patha-qual-abc-other-projects.vercel.app',
  'https://absinthe-beryl.vercel.app',
  'https://absinthe-git-anything-dhlee6785-9668s-projects.vercel.app',
  'http://localhost:5173', 'http://127.0.0.1:5173', 'http://192.168.1.1:4189',
  'https://rel05g-patha-qual.vercel.app.evil.example', 'https://other.vercel.app',
  'https://rel05g-patha-qual-1ct8gk4w7-other-projects.vercel.app',
  'https://rel05g-patha-qual-dhlee6785-9668s-projects-otherteam.vercel.app',
  'https://rel05g-patha-qual-extra-1ct8gk4w7-dhlee6785-9668s-projects.vercel.app',
  'https://rel05g-patha-qual-abc-dhlee6785-9668s-projects.vercel.app',
  'https://rel05g-patha-qual-1ct8gk4w77-dhlee6785-9668s-projects.vercel.app',
  'https://rel05g-patha-qual-1ct8-k4w7-dhlee6785-9668s-projects.vercel.app',
  'http://rel05g-patha-qual.vercel.app', 'https://rel05g-patha-qual.vercel.app:4189',
];
for (const origin of deniedOrigins) test(`origin firewall refuses ${origin} before Storage/locks`, () => {
  const env = environment(); let lockCalls = 0; env.ports.origin = origin;
  env.ports.locks = { request() { lockCalls++; } };
  assert.throws(() => assertOrigin(origin), /ORIGIN_NOT_ALLOWLISTED/);
  assert.throws(() => create('CURRENT_FIXTURE', env), /ORIGIN_NOT_ALLOWLISTED/);
  assert.equal(env.touched.length, 0); assert.equal(lockCalls, 0);
});
test('reserved loopback and dedicated HTTPS project deployment accepted', () => {
  for (const origin of ['http://127.0.0.1:4189', 'http://localhost:4189',
    'https://rel05g-patha-qual.vercel.app',
    'https://rel05g-patha-qual-dhlee6785-9668s-projects.vercel.app',
    'https://rel05g-patha-qual-1ct8gk4w7-dhlee6785-9668s-projects.vercel.app']) assert.equal(assertOrigin(origin), origin);
});
test('unsafe origin denied without even reading Storage', () => {
  const env = environment(); env.ports.origin = 'http://localhost:5173';
  assert.throws(() => create('CURRENT_FIXTURE', env)); assert.equal(env.touched.length, 0);
});
for (const flag of ['workerControlled', 'workerRegistered']) test(`${flag} refuses state access`, () => {
  const env = environment(); env.ports[flag] = true;
  assert.throws(() => create('CURRENT_FIXTURE', env), /WORKER_PRESENT/); assert.equal(env.touched.length, 0);
});
for (const role of ['OLD_FIXTURE', 'NEUTRAL_FIXTURE']) test(`${role} never requests a lock, including manual writes`, () => {
  const env = environment(); let calls = 0; env.ports.locks = { request() { calls++; } };
  const fixture = create(role, env); const token = fixture.writeToken('a001');
  assert.equal(fixture.readToken('a002'), token);
  assert.throws(() => fixture.requestLock('a003'), /ROLE_CANNOT_REQUEST_LOCK/); assert.equal(calls, 0);
});
test('CURRENT only requests test lock, confirmed acquisition then callback completion', async () => {
  const env = environment(); const calls = [];
  env.ports.locks = { async request(name, options, callback) { calls.push({ name, options }); await callback({ name }); } };
  const fixture = create('CURRENT_FIXTURE', env); const pending = fixture.requestLock('hold');
  await turn(); assert.equal(fixture.lockStatus, 'HELD');
  assert.equal(calls[0].name, lockFor('r001')); assert.equal(calls[0].options.mode, 'exclusive');
  assert.equal('steal' in calls[0].options, false);
  await fixture.releaseLock('release'); await pending;
  assert.equal(fixture.lockStatus, 'IDLE');
  assert.deepEqual(fixture.eventView().filter((e) => e.type.startsWith('LOCK')).map((e) => e.type),
    ['LOCK_REQUEST', 'LOCK_ACQUIRED', 'LOCK_RELEASED']);
});
test('CURRENT pending request cancellation remains explicit aborted trial, not different scope', async () => {
  const env = environment();
  env.ports.locks = { request(_name, { signal }) { return new Promise((_resolve, reject) => {
    if (signal.aborted) reject(new Error('ABORTED'));
    else signal.addEventListener('abort', () => reject(new Error('ABORTED')), { once: true });
  }); } };
  const fixture = create('CURRENT_FIXTURE', env); const pending = fixture.requestLock('request');
  await turn(); assert.equal(fixture.lockStatus, 'REQUESTED');
  await fixture.releaseLock('cancel'); await pending;
  assert.equal(fixture.eventView().some((e) => e.type === 'LOCK_ABORTED'), true);
  assert.equal(fixture.export('export').includes('DIFFERENT_SCOPE'), false);
});
test('60-second safety timer releases only test trial', async () => {
  const env = environment(); env.ports.locks = { async request(_name, _options, cb) { await cb(); } };
  const fixture = create('CURRENT_FIXTURE', env); const pending = fixture.requestLock('request');
  await turn(); env.expire(); await pending; assert.equal(fixture.lockStatus, 'IDLE');
});
test('missing API fails closed and no lock is requested', () => assert.throws(() => create().requestLock('a001'), /LOCK_UNAVAILABLE/));
test('new document IDs fresh; history is previous only', () => {
  const env = environment(); const first = create('OLD_FIXTURE', env); const second = create('OLD_FIXTURE', env);
  assert.notEqual(first.instanceId, second.instanceId); assert.deepEqual(second.previousInstances, [first.instanceId]);
});
test('BFCache persisted return keeps ID, pagehide never proves BFCache', () => {
  const fixture = create(); const id = fixture.instanceId;
  fixture.lifecycle('pagehide', true); fixture.lifecycle('pageshow', true, 'back_forward');
  assert.equal(fixture.instanceId, id);
  const exported = JSON.parse(fixture.export('export')); assert.equal(exported.restoreClass, 'UNKNOWN');
  assert.equal(exported.events.find((e) => e.type === 'pageshow').payload.persisted, true);
});
test('navigation normalized without guessed lifecycle class', () => {
  assert.deepEqual(navigationPayload('reload', false), { navigationType: 'reload', persisted: false });
  assert.deepEqual(navigationPayload('unknown'), { navigationType: 'UNKNOWN' });
});
test('instance event sequence strictly increases, raw clocks retained', () => {
  const fixture = create(); fixture.writeToken('a001'); fixture.lifecycle('visibilitychange');
  const events = JSON.parse(fixture.export('export')).events;
  assert.deepEqual(events.map((e) => e.sequence), events.map((_, i) => i + 1));
  assert.equal(events.every((e) => Number.isFinite(e.wallTimeMs) && Number.isFinite(e.monotonicMs) && e.timeOriginMs === 900), true);
});
test('Storage exact fresh token control and reverse-direction synthetic model', () => {
  const env = environment(); const old = create('OLD_FIXTURE', env); const current = create('CURRENT_FIXTURE', env);
  const a = old.writeToken('a001'); assert.equal(current.readToken('a002'), a);
  const b = current.writeToken('a003'); assert.notEqual(a, b); assert.equal(old.readToken('a004'), b);
});
test('event persistence only exact instance log slot and flush failure visible', () => {
  const env = environment(); const fixture = create('CURRENT_FIXTURE', env); env.failWrites();
  fixture.action('a001', 'OPERATOR_MARK'); assert.match(fixture.flushStatus, /^FAILED_AT_/);
  assert.equal(fixture.lastError, 'LOG_FLUSH_FAILED');
  assert.equal(env.touched.every(([, key]) => key.startsWith('rel05g-patha-qual:v1:r001:')), true);
});
test('export closed schema excludes secrets, unrelated Storage, cookie/auth ports', () => {
  const env = environment(new Map([['secret-key', 'SECRET'], [DENIED_KEYS[0], 'PRODUCT_ID']]));
  env.ports.authToken = 'SECRET'; env.ports.cookie = 'SECRET';
  const fixture = create('OLD_FIXTURE', env); fixture.writeToken('a001'); const bytes = fixture.export('export');
  for (const forbidden of ['SECRET', 'PRODUCT_ID', 'authToken', 'cookie', 'secret-key']) assert.equal(bytes.includes(forbidden), false);
  assert.match(JSON.parse(bytes).currentStorage.token, /^qual-/);
  assert.equal(JSON.parse(bytes).physicalResult, 'NOT_EXECUTED');
});
test('non-synthetic test-key content is not exported', () => {
  const env = environment(); const fixture = create('OLD_FIXTURE', env);
  env.raw.set(keyFor('r001', 'scope-token'), 'personal secret'); assert.throws(() => fixture.export('export'));
  assert.equal(JSON.stringify(fixture.eventView()).includes('personal secret'), false);
});
test('unknown payload fields and secret-like payloads rejected', () => {
  const fixture = create(); assert.throws(() => fixture.record('ACTION', { authToken: 'SECRET' }));
  assert.throws(() => fixture.record('STORAGE_READ', { token: 'SECRET' }));
});
test('cleanup only known exact current-run keys, no enumeration or clear', async () => {
  const env = environment(new Map([['unrelated', 'keep'], [DENIED_KEYS[0], 'keep'],
    [keyFor('another', 'scope-token'), 'keep']]));
  const first = create('OLD_FIXTURE', env); first.writeToken('a001');
  const second = create('CURRENT_FIXTURE', env); await second.cleanup('cleanup');
  assert.equal(env.raw.get('unrelated'), 'keep'); assert.equal(env.raw.get(DENIED_KEYS[0]), 'keep');
  assert.equal(env.raw.get(keyFor('another', 'scope-token')), 'keep');
  assert.equal(env.raw.has(keyFor('r001', 'launch-history')), false);
  assert.equal(env.raw.has(keyFor('r001', `event-log:${first.instanceId}`)), false);
  assert.throws(() => second.writeToken('a001'), /RUN_CLOSED/);
});
test('previous persisted logs retained as original bytes, not mixed into new timeline', () => {
  const env = environment(); const first = create('OLD_FIXTURE', env); first.writeToken('a001');
  const original = env.raw.get(keyFor('r001', `event-log:${first.instanceId}`));
  const second = create('CURRENT_FIXTURE', env); assert.equal(second.previousLog(first.instanceId), original);
  assert.throws(() => second.previousLog(randomUUID()));
});
test('retained raw log export rejects injected secret fields without rewriting original', () => {
  const env = environment(); const first = create('OLD_FIXTURE', env); const second = create('CURRENT_FIXTURE', env);
  const slot = keyFor('r001', `event-log:${first.instanceId}`);
  const raw = JSON.parse(env.raw.get(slot)); raw[0].authToken = 'SECRET';
  const corrupted = JSON.stringify(raw); env.raw.set(slot, corrupted);
  assert.throws(() => second.previousLog(first.instanceId), /INVALID_RETAINED_LOG/);
  assert.equal(env.raw.get(slot), corrupted);
});
test('OLD writes while mock CURRENT test lock is held without joining the lock path', async () => {
  const env = environment(); let calls = 0;
  env.ports.locks = { async request(_name, _options, cb) { calls++; await cb(); } };
  const old = create('OLD_FIXTURE', env); const current = create('CURRENT_FIXTURE', env);
  const pending = current.requestLock('hold'); await turn(); assert.equal(current.lockStatus, 'HELD');
  const token = old.writeToken('oldwrite'); assert.equal(current.readToken('peerread'), token);
  assert.equal(calls, 1); assert.equal(current.lockStatus, 'HELD');
  await current.releaseLock('release'); await pending;
});
test('corrupt launch history cannot be guessed or repaired', () => {
  const env = environment(new Map([[keyFor('r001', 'launch-history'), '{broken']]));
  assert.throws(() => create('OLD_FIXTURE', env)); assert.equal(env.raw.get(keyFor('r001', 'launch-history')), '{broken');
});
test('deterministic export serialization independent of object key order', () => assert.equal(stableJSON({ b: 1, a: 2 }), stableJSON({ a: 2, b: 1 })));
test('manifest deterministic, all actual asset byte sizes/hashes match', async () => {
  const a = await artifacts(sourceGitSha); const b = await artifacts(sourceGitSha);
  assert.equal(a.buildId, b.buildId); assert.equal(a.manifestSha256, b.manifestSha256);
  for (const asset of a.manifest.assets) {
    const data = a.files.get(asset.path); assert.equal(asset.size, data.length); assert.equal(asset.sha256, hash(data));
    assert.equal(asset.sourceGitSha, sourceGitSha); assert.equal(asset.protocolVersion, PROTOCOL);
  }
  assert.equal(hash(a.files.get(`/${a.buildId}/artifact-manifest.json`)), a.manifestSha256);
});
test('different source head changes immutable build ID', async () => assert.notEqual((await artifacts(sourceGitSha)).buildId, (await artifacts('d'.repeat(40))).buildId));
test('three immutable boot modules embed exact role/source/build; no latest identity fetch', async () => {
  const a = await artifacts(sourceGitSha);
  for (const role of ['old', 'current', 'neutral']) {
    const boot = a.files.get(`/${a.buildId}/${role}/boot.mjs`).toString();
    assert.equal(boot.includes(`${role.toUpperCase()}_FIXTURE`), true);
    assert.equal(boot.includes(sourceGitSha) && boot.includes(a.buildId), true);
  }
});
test('fixture assets have no product imports/backend/cookies/SW registration/membership', async () => {
  for (const name of ['core.mjs', 'ui.mjs']) {
    const text = await readFile(path.join(root, name), 'utf8');
    for (const forbidden of ['../src', 'workoutDeviceLifetimeAuthority', 'supabase', 'document.cookie',
      'BroadcastChannel', 'serviceWorker.register', 'beforeunload', "addEventListener('unload'"])
      assert.equal(text.includes(forbidden), false, `${name}: ${forbidden}`);
    for (const match of text.matchAll(/from ['"]([^'"]+)['"]/g)) assert.equal(match[1], './core.mjs');
  }
});
test('normal application source/public do not import or contain qualification assets', async () => {
  async function inspect(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const name = path.join(dir, entry.name);
      if (entry.isDirectory()) await inspect(name);
      else {
        const bytes = await readFile(name); assert.equal(bytes.includes(Buffer.from('rel05g-patha-qual')), false, name);
        assert.equal(bytes.includes(Buffer.from('qualification/rel05g-patha')), false, name);
      }
    }
  }
  await inspect(path.resolve(root, '../../src')); await inspect(path.resolve(root, '../../public'));
});
test('builder refuses overwriting changed immutable assets; server cannot serve source/app root', async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), 'rel05g-patha-build-'));
  const result = await build(temp, sourceGitSha); await build(temp, sourceGitSha);
  assert.equal(result.files.size, 15);
  const ignore = await readFile(path.join(temp, '.vercelignore'), 'utf8');
  for (const name of ['.env', '.env.*', '.vercel', '.git']) assert.equal(ignore.split('\n').includes(name), true);
  const asset = result.manifest.assets[0];
  await writeFile(path.join(temp, asset.path.slice(1)), 'tampered disposable test asset');
  await assert.rejects(build(temp, sourceGitSha), /IMMUTABLE_ASSET_ALREADY_EXISTS_DIFFERENT/);
  await assert.rejects(serverFor(path.resolve(root, '../..')), /NOT_A_FIXTURE_BUILD_ROOT/);
  // Test output kept as a disposable OS-temp artifact; no recursive delete in this task.
});
test('standalone server static delivery only: app/API/traversal/foreign Host refused (HTTP model)', async () => {
  const output = path.join(root, 'dist', hash(randomUUID()).slice(0, 40));
  const generated = await build(output, sourceGitSha);
  const server = await serverFor(output);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const get = (requestPath, host = '127.0.0.1:4189', method = 'GET') => new Promise((resolve, reject) => {
    const request = http.request({ hostname: '127.0.0.1', port: server.address().port,
      path: requestPath, method, headers: { Host: host } }, (response) => {
      const chunks = []; response.on('data', (data) => chunks.push(data));
      response.on('end', () => resolve({ status: response.statusCode, body: Buffer.concat(chunks).toString(), headers: response.headers }));
    }); request.on('error', reject); request.end();
  });
  try {
    const rootPage = await get('/'); assert.equal(rootPage.status, 200); assert.match(rootPage.body, /qualification only/);
    const asset = await get(`/${generated.buildId}/current/boot.mjs`); assert.equal(asset.status, 200);
    assert.equal(asset.headers['x-content-type-options'], 'nosniff');
    for (const name of ['/src/main.tsx', '/api/health', '/../package.json', '/%2e%2e%2fpackage.json', '/missing'])
      assert.equal((await get(name)).status, 404);
    assert.equal((await get('/', 'absinthe-beryl.vercel.app')).status, 404);
    assert.equal((await get('/', '127.0.0.1:4189', 'POST')).status, 405);
  } finally { await new Promise((resolve) => server.close(resolve)); }
});

// A Storage-port getter marks the constructor expression boundary: new Fixture
// cannot be evaluated without this port. No getter access proves it was not reached.
async function withUI(a, role, inspect, { manifest = a.manifest,
  origin = 'http://127.0.0.1:4189', corruptAsset = null, receiverTimers = false, pendingLock = false } = {}) {
  const globals = ['window', 'document', 'location', 'navigator', 'localStorage', 'isSecureContext', 'matchMedia', 'fetch',
    ...(receiverTimers ? ['setTimeout', 'clearTimeout'] : [])];
  const descriptors = new Map(globals.map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const name = role.replace('_FIXTURE', '').toLowerCase();
  const dom = new Window({ url: `${origin}/${a.buildId}/${name}/?run=ui001&test=${receiverTimers ? 'QA_TIMER' : 'A1'}` });
  const env = environment(); const fetched = []; let storagePortAccesses = 0; let lockCalls = 0;
  const timers = { scheduled: [], cleared: [] };
  try {
    Object.defineProperty(dom.navigator, 'serviceWorker', { value: undefined, configurable: true });
    Object.defineProperty(dom.navigator, 'locks', { value: { async request(_name, { signal }, callback) {
      lockCalls++;
      if (!receiverTimers) return;
      if (!pendingLock) return callback();
      return new Promise((_resolve, reject) => {
        if (signal.aborted) reject(new Error('ABORTED'));
        else signal.addEventListener('abort', () => reject(new Error('ABORTED')), { once: true });
      });
    } }, configurable: true });
    if (receiverTimers) {
      // Native-style receiver checks, not Happy DOM's permissive bound timers.
      // Bare global calls are legal; ports-object method calls are not.
      const validReceiver = (receiver) => receiver === dom || receiver === undefined || receiver === globalThis;
      dom.setTimeout = function (fn, ms) {
        if (!validReceiver(this)) throw new TypeError('Illegal invocation');
        timers.scheduled.push({ fn, ms }); return 903;
      };
      dom.clearTimeout = function (id) {
        if (!validReceiver(this)) throw new TypeError('Illegal invocation');
        timers.cleared.push(id);
      };
    }
    const manifestPath = `/${a.buildId}/artifact-manifest.json`;
    const values = { window: dom, document: dom.document, location: dom.location, navigator: dom.navigator,
      isSecureContext: true, matchMedia: dom.matchMedia.bind(dom),
      setTimeout: dom.setTimeout, clearTimeout: dom.clearTimeout,
      fetch: async (url, options) => {
        fetched.push(url); assert.equal(options.credentials, 'omit'); assert.equal(options.cache, 'no-store');
        const bytes = url === manifestPath ? Buffer.from(stableJSON(manifest) + '\n')
          : url === corruptAsset ? Buffer.from(a.files.get(url)).fill(0, 0, 1) : a.files.get(url);
        return new Response(bytes, { status: bytes ? 200 : 404 });
      } };
    for (const key of globals) Object.defineProperty(globalThis, key, key === 'localStorage'
      ? { get() { storagePortAccesses++; return env.ports.storage; }, configurable: true }
      : { value: values[key], configurable: true });
    const { boot } = await import(`./ui.mjs?dom=${randomUUID()}`);
    await boot({ role, buildId: a.buildId, sourceGitSha, protocolVersion: PROTOCOL, manifestPath });
    await inspect({ dom, env, fetched, timers, storagePortAccesses: () => storagePortAccesses, lockCalls: () => lockCalls });
  } finally {
    await dom.happyDOM.abort();
    for (const key of globals) {
      const descriptor = descriptors.get(key);
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  }
}

const invalidManifests = [
  ['empty assets', (m) => { m.assets = []; }],
  ['missing assets', (m) => { delete m.assets; }],
  ['non-array assets', (m) => { m.assets = {}; }],
  ['missing required asset', (m) => { m.assets.pop(); }],
  ['duplicate required path', (m) => { m.assets[1] = structuredClone(m.assets[0]); }],
  ['extra inventory entry', (m) => { m.assets.push(structuredClone(m.assets[0])); }],
  ['outside build path', (m) => { m.assets[0].path = '/another/core.mjs'; }],
  ['traversal alias', (m) => { m.assets[0].path = `/${m.buildId}/old/../core.mjs`; }],
  ['encoded alias', (m) => { m.assets[0].path = `/${m.buildId}/%63ore.mjs`; }],
  ['query alias', (m) => { m.assets[0].path += '?alias=1'; }],
  ['invalid SHA format', (m) => { m.assets[0].sha256 = 'not-a-hash'; }],
  ['numeric SHA', (m) => { m.assets[0].sha256 = 1; }],
  ['negative size', (m) => { m.assets[0].size = -1; }],
  ['zero size', (m) => { m.assets[0].size = 0; }],
  ['fractional size', (m) => { m.assets[0].size = 1.5; }],
  ['string size', (m) => { m.assets[0].size = '12'; }],
  ['unsafe integer size', (m) => { m.assets[0].size = Number.MAX_SAFE_INTEGER + 1; }],
  ['asset source mismatch', (m) => { m.assets[0].sourceGitSha = 'd'.repeat(40); }],
  ['asset build mismatch', (m) => { m.assets[0].buildId = 'd'.repeat(64); }],
  ['asset protocol mismatch', (m) => { m.assets[0].protocolVersion = 'another-protocol'; }],
  ['asset role mismatch', (m) => { m.assets[0].role = 'OLD_FIXTURE'; }],
  ['valid role on wrong path', (m) => { m.assets.find((asset) => asset.role === 'OLD').role = 'CURRENT'; }],
  ['missing asset field', (m) => { delete m.assets[0].role; }],
  ['extra asset field', (m) => { m.assets[0].unexpected = true; }],
  ['null asset', (m) => { m.assets[0] = null; }],
  ['wrong manifest schema', (m) => { m.schemaVersion = 'another-schema'; }],
  ['wrong manifest build', (m) => { m.buildId = 'd'.repeat(64); }],
  ['wrong manifest source', (m) => { m.sourceGitSha = 'd'.repeat(40); }],
  ['wrong manifest protocol', (m) => { m.protocolVersion = 'another-protocol'; }],
  ['qualification false', (m) => { m.qualificationOnly = false; }],
  ['roles duplicated', (m) => { m.roles[1] = m.roles[0]; }],
  ['non-array roles', (m) => { m.roles = {}; }],
  ['missing roles', (m) => { delete m.roles; }],
  ['extra manifest field', (m) => { m.unexpected = true; }],
  ['null manifest', () => null],
];
for (const [name, corrupt] of invalidManifests) test(`invalid manifest ${name} stops before Start/constructor/Storage/locks (DOM model)`, async () => {
  const a = await artifacts(sourceGitSha); const copy = structuredClone(a.manifest);
  const result = corrupt(copy); const manifest = result === null ? null : copy;
  await withUI(a, 'CURRENT_FIXTURE', async ({ dom, env, fetched, storagePortAccesses, lockCalls }) => {
    assert.equal(dom.document.body.textContent.includes('Preflight OK'), false);
    assert.match(dom.document.body.textContent, /STOP:/);
    const start = [...dom.document.querySelectorAll('button')].find((b) => b.textContent === 'Start synthetic run');
    assert.equal(start, undefined, 'failed preflight exposes no constructor trigger');
    assert.equal(fetched.length, 1, 'inventory rejected before asset fetch loop');
    assert.equal(storagePortAccesses(), 0, 'constructor expression never reached');
    assert.equal(env.touched.length, 0); assert.equal(lockCalls(), 0);
  }, { manifest });
});

test('unauthorized attacker origin fails UI preflight before manifest GET or state access (DOM model)', async () => {
  const a = await artifacts(sourceGitSha);
  await withUI(a, 'CURRENT_FIXTURE', async ({ dom, env, fetched, storagePortAccesses, lockCalls }) => {
    assert.match(dom.document.body.textContent, /STOP:/); assert.equal(dom.document.querySelector('button'), null);
    assert.equal(fetched.length, 0); assert.equal(storagePortAccesses(), 0);
    assert.equal(env.touched.length, 0); assert.equal(lockCalls(), 0);
  }, { origin: deniedOrigins[0] });
});

test('same-size tampered asset cannot bypass delivered hash verification (DOM model)', async () => {
  const a = await artifacts(sourceGitSha);
  await withUI(a, 'CURRENT_FIXTURE', async ({ dom, env, storagePortAccesses, lockCalls }) => {
    assert.match(dom.document.body.textContent, /STOP:/); assert.equal(dom.document.querySelector('button'), null);
    assert.equal(storagePortAccesses(), 0); assert.equal(env.touched.length, 0); assert.equal(lockCalls(), 0);
  }, { corruptAsset: a.manifest.assets[0].path });
});

for (const field of ['size', 'sha256']) test(`valid-format wrong ${field} still fails delivered-byte verification before state (DOM model)`, async () => {
  const a = await artifacts(sourceGitSha); const manifest = structuredClone(a.manifest);
  if (field === 'size') manifest.assets[0].size++;
  else manifest.assets[0].sha256 = 'd'.repeat(64);
  await withUI(a, 'CURRENT_FIXTURE', async ({ dom, env, fetched, storagePortAccesses, lockCalls }) => {
    assert.match(dom.document.body.textContent, /STOP:/); assert.equal(dom.document.querySelector('button'), null);
    assert.equal(fetched.length, 2, 'canonical inventory passed; actual bytes did not');
    assert.equal(storagePortAccesses(), 0); assert.equal(env.touched.length, 0); assert.equal(lockCalls(), 0);
  }, { manifest });
});

test('ordinary UI renders all roles, controls/log viewer, verified artifact and start is explicit (DOM model only)', async () => {
  const a = await artifacts(sourceGitSha);
  for (const role of ['OLD_FIXTURE', 'CURRENT_FIXTURE', 'NEUTRAL_FIXTURE']) {
    await withUI(a, role, async ({ dom, env, fetched, storagePortAccesses, lockCalls }) => {
      assert.equal(dom.document.body.textContent.includes('Preflight OK'), true);
      assert.equal(fetched.length, 14, 'manifest + every one of the 13 required assets');
      assert.deepEqual(fetched.slice(1).sort(), a.manifest.assets.map((asset) => asset.path).sort());
      assert.equal(storagePortAccesses(), 0); assert.equal(env.touched.length, 0);
      assert.equal(lockCalls(), 0, 'no synthetic run starts automatically');
      const buttons = [...dom.document.querySelectorAll('button')];
      const lock = buttons.find((b) => b.textContent.startsWith('Request exclusive'));
      assert.equal(Boolean(lock), role === 'CURRENT_FIXTURE');
      buttons.find((b) => b.textContent === 'Start synthetic run').click(); await turn(); await turn();
      assert.equal(storagePortAccesses(), 1); assert.equal(env.touched.length > 0, true);
      assert.equal(dom.document.body.textContent.includes('FLUSHED_THROUGH_2'), true);
      buttons.find((b) => /raw token write|Write fresh token/.test(b.textContent)).click(); await turn();
      assert.equal(dom.document.body.textContent.includes('qual-'), true);
      assert.equal(dom.document.body.textContent.includes('STORAGE_WRITE'), true);
    });
  }
});

for (const pendingLock of [false, true]) test(`UI browser-native receiver regression: ${pendingLock ? 'pending cancel' : 'acquire and manual release'} (QA model, not physical qualification)`, async () => {
  const a = await artifacts(sourceGitSha);
  await withUI(a, 'CURRENT_FIXTURE', async ({ dom, env, timers, lockCalls }) => {
    const rawPorts = { setTimer: dom.setTimeout, clearTimer: dom.clearTimeout };
    assert.throws(() => rawPorts.setTimer(() => {}, 60000), /Illegal invocation/);
    assert.throws(() => rawPorts.clearTimer(903), /Illegal invocation/);
    assert.deepEqual(timers, { scheduled: [], cleared: [] }, 'negative controls reject the invalid receiver');
    const button = (prefix) => [...dom.document.querySelectorAll('button')].find((node) => node.textContent.startsWith(prefix));
    const events = () => JSON.parse([...env.raw.entries()].find(([key]) => key.includes(':event-log:'))[1]);
    button('Start synthetic run').click(); await turn(); await turn();
    button('Request exclusive').click(); await turn(); await turn();
    assert.equal(lockCalls(), 1, 'native timer binding must not prevent locks.request');
    assert.equal(timers.scheduled.length, 1); assert.equal(timers.scheduled[0].ms, 60000);
    assert.deepEqual(events().map((event) => event.type), pendingLock
      ? ['START', 'NAVIGATION', 'ACTION', 'LOCK_REQUEST']
      : ['START', 'NAVIGATION', 'ACTION', 'LOCK_REQUEST', 'LOCK_ACQUIRED']);
    assert.equal(events()[2].payload.operation, 'REQUEST_TEST_LOCK');
    assert.equal(events()[3].payload.budgetMs, 60000);
    button('Release / cancel').click(); await turn(); await turn();
    assert.deepEqual(events().filter((event) => event.type.startsWith('LOCK')).map((event) => event.type),
      pendingLock ? ['LOCK_REQUEST', 'LOCK_ABORTED'] : ['LOCK_REQUEST', 'LOCK_ACQUIRED', 'LOCK_RELEASED']);
    assert.deepEqual(timers.cleared, [903], 'native clearTimeout receives the same timer ID');
    assert.equal(events().some((event) => event.type === 'ERROR'), false);
    assert.equal(dom.document.body.textContent.includes('"lockStatus": "IDLE"'), true);
    assert.equal(/DIFFERENT_SCOPE|SAFE|RETIRED|QUIESCED|ADMITTED/.test(JSON.stringify(events())), false);
  }, { receiverTimers: true, pendingLock });
});
