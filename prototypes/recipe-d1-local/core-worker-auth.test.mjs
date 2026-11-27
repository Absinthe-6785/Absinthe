import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';
import { createWorkerAuthenticator } from './core-worker-auth.mjs';

const issuer = 'https://core-auth-fixture.invalid/auth/v1';
const endpoint = 'http://127.0.0.1:8788/qa/auth/account';
const account = '10000000-0000-4000-8000-000000000001';
const other = '20000000-0000-4000-8000-000000000002';
const lost = 'local-verification-error-not-for-client';
const jwks = (...keys) => Response.json({ keys });
const encode = object => Buffer.from(JSON.stringify(object)).toString('base64url');

async function signer(kid, alg = 'ES256') {
  const params = alg === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' } : {
    name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]),
  };
  const pair = await crypto.subtle.generateKey(params, true, ['sign', 'verify']);
  const jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid, alg, use: 'sig' };
  return {
    jwk,
    async token(claims = {}, head = {}) {
      const input = [
        encode({ alg, kid, ...head }),
        encode({ iss: issuer, aud: 'authenticated', role: 'authenticated', sub: account,
          exp: Math.floor(Date.now() / 1000) + 600, ...claims }),
      ].join('.');
      const sig = await crypto.subtle.sign(params, pair.privateKey, Buffer.from(input));
      return input + '.' + Buffer.from(sig).toString('base64url');
    },
  };
}

const old = await signer('first');
const next = await signer('next');
const rsa = await signer('rsa', 'RS256');
const request = (token, headers = {}) => new Request(endpoint, {
  headers: { ...(token && { authorization: 'Bearer ' + token }), ...headers },
});

test('100 signed operations verify every signature with one public-key fetch and no user lookup', async t => {
  const verify = t.mock.method(crypto.subtle, 'verify');
  const load = t.mock.fn(async (url, options) => {
    assert.equal(url, issuer + '/.well-known/jwks.json');
    assert.equal(options.redirect, 'manual');
    assert.equal(options.cache, 'no-store');
    assert.deepEqual(options.headers, { accept: 'application/json' });
    assert.ok(options.signal instanceof AbortSignal);
    return jwks(old.jwk);
  });
  const auth = createWorkerAuthenticator({ issuer, algorithm: 'ES256', fetchJwks: load });
  const token = await old.token({ aud: ['authenticated'], user_metadata: { accountId: other } });
  for (let i = 0; i < 100; i++) {
    assert.deepEqual(await auth(request(token, { 'X-Core-QA-Expected-Account': other })), { status: 200, accountId: account });
  }
  assert.equal(load.mock.callCount(), 1);
  assert.equal(verify.mock.callCount(), 100);
});

test('invalid signatures, forbidden signing modes and untrusted claims never establish identity', async () => {
  const auth = createWorkerAuthenticator({ issuer, algorithm: 'ES256', fetchJwks: () => jwks(old.jwk) });
  const time = Math.floor(Date.now() / 1000);
  const denied = [
    request(null), request('broken'), request('x'.repeat(8192)), request(await next.token({}, { kid: 'first' })),
    ...await Promise.all([
      [{ iss: 'https://other-auth.invalid/auth/v1' }], [{ aud: 'anon' }], [{ aud: ['authenticated', false] }],
      [{ role: 'service_role' }],
      [{ sub: 'not-a-uuid' }], [{ sub: undefined }], [{ exp: time }], [{ exp: undefined }],
      [{ nbf: time + 300 }], [{ iat: time + 300 }], [{}, { alg: 'HS256' }], [{}, { alg: 'none' }],
      [{}, { kid: undefined }], [{}, { crit: ['b64'], b64: false }],
      [{}, { jku: 'https://untrusted.invalid/keys' }],
    ].map(async ([claims, head]) => request(await old.token(claims, head)))),
  ];
  for (const candidate of denied) assert.deepEqual(await auth(candidate), { status: 401 });
  assert.throws(() => createWorkerAuthenticator({ issuer, algorithm: 'HS256' }), /Unsupported/);
  for (const url of ['http://auth.invalid/auth/v1', issuer + '?foo=bar', 'https://a@auth.invalid/auth/v1']) {
    assert.throws(() => createWorkerAuthenticator({ issuer: url, algorithm: 'ES256' }), /Unsupported/);
  }
  const otherIssuer = 'https://other-auth.invalid/auth/v1';
  const foreignAuth = createWorkerAuthenticator({ issuer: otherIssuer, algorithm: 'ES256',
    fetchJwks: url => { assert.equal(url, otherIssuer + '/.well-known/jwks.json'); return jwks(old.jwk); } });
  assert.deepEqual(await foreignAuth(request(await old.token())), { status: 401 });
});

test('bounded unknown-key refresh, overlapping rotation then removal, expiry and outage', async t => {
  let clock = Date.now(), keys = [old.jwk], failed = false;
  const load = t.mock.fn(() => { if (failed) throw new Error(lost); return jwks(...keys); });
  const auth = createWorkerAuthenticator({ issuer, algorithm: 'ES256', now: () => clock, fetchJwks: load });
  const [first, standby, unknown] = await Promise.all([
    old.token().then(request), next.token().then(request), next.token({}, { kid: 'unknown' }).then(request),
  ]);
  assert.equal((await auth(first)).status, 200);
  assert.equal((await auth(unknown)).status, 401);
  assert.equal((await auth(standby)).status, 401);
  assert.equal(load.mock.callCount(), 1);
  keys = [old.jwk, next.jwk];
  clock += 5_000;
  assert.equal((await auth(standby)).status, 200);
  assert.equal((await auth(first)).status, 200);
  assert.equal(load.mock.callCount(), 2);
  keys = [next.jwk];
  clock += 60_000;
  assert.equal((await auth(first)).status, 401);
  assert.equal((await auth(standby)).status, 200);
  assert.equal(load.mock.callCount(), 3);
  clock += 60_000;
  failed = true;
  assert.deepEqual(await auth(standby), { status: 503 });
  assert.deepEqual(await auth(standby), { status: 503 });
  assert.equal(load.mock.callCount(), 4);
  clock += 5_000;
  failed = false;
  assert.equal((await auth(standby)).status, 200);
  assert.equal(load.mock.callCount(), 5);
});

test('concurrent cold misses share no cross-request pending I/O and fail closed until the refresh finishes', async t => {
  let resolve;
  const load = t.mock.fn(() => new Promise(res => { resolve = res; }));
  const auth = createWorkerAuthenticator({ issuer, algorithm: 'ES256', fetchJwks: load });
  const req = request(await old.token());
  const pending = auth(req);
  assert.deepEqual(await auth(req), { status: 503 });
  assert.equal(load.mock.callCount(), 1);
  resolve(jwks(old.jwk));
  assert.equal((await pending).status, 200);
  assert.equal((await auth(req)).status, 200);
});

test('an abandoned request cannot hold refresh indefinitely or publish a late key set', async t => {
  let clock = Date.now(), finishAbandoned;
  const load = t.mock.fn();
  load.mock.mockImplementationOnce(() => new Promise(resolve => { finishAbandoned = resolve; }));
  load.mock.mockImplementation(() => jwks(next.jwk));
  const auth = createWorkerAuthenticator({ issuer, algorithm: 'ES256', now: () => clock, fetchJwks: load });
  const [first, rotated] = await Promise.all([old.token().then(request), next.token().then(request)]);
  // Model a disconnected request whose I/O continuation hasn't been resumed.
  const abandoned = auth(first);
  assert.equal((await auth(rotated)).status, 503);
  assert.equal(load.mock.callCount(), 1);
  clock += 5_000;
  assert.equal((await auth(rotated)).status, 200);
  assert.equal(load.mock.callCount(), 2);
  finishAbandoned(jwks(old.jwk));
  assert.equal((await abandoned).status, 401);
  assert.equal((await auth(first)).status, 401);
  assert.equal((await auth(rotated)).status, 200);
  assert.equal(load.mock.callCount(), 2);
});

test('a signature completing after a replacement JWKS cannot publish the previous key authority', async t => {
  let clock = Date.now(), keys = [old.jwk];
  const auth = createWorkerAuthenticator({ issuer, algorithm: 'ES256', now: () => clock, fetchJwks: () => jwks(...keys) });
  const [first, rotated] = await Promise.all([old.token().then(request), next.token().then(request)]);
  assert.equal((await auth(first)).status, 200);
  let release;
  const original = crypto.subtle.verify.bind(crypto.subtle);
  t.mock.method(crypto.subtle, 'verify', async (...args) => {
    if (!release) await new Promise(resolve => { release = resolve; });
    return original(...args);
  });
  const pending = auth(first);
  assert.ok(release);
  clock += 5_000;
  keys = [next.jwk];
  assert.equal((await auth(rotated)).status, 200);
  release();
  assert.deepEqual(await pending, { status: 503 });
});

test('redirects, malformed, ambiguous, private or oversized key evidence is unusable', async () => {
  const req = request(await old.token());
  const unusable = [
    () => Response.redirect('https://redirect.invalid/keys'), () => new Response(lost, { status: 503 }),
    () => new Response(lost), () => jwks(old.jwk, old.jwk), () => jwks({ ...old.jwk, d: 'private' }),
    () => jwks({ ...old.jwk, key_ops: ['sign'] }), () => new Response(' '.repeat(65_537)),
  ];
  for (const fetchJwks of unusable) {
    const auth = createWorkerAuthenticator({ issuer, algorithm: 'ES256', fetchJwks });
    assert.deepEqual(await auth(req), { status: 503 });
  }
});

test('RS256 rejects all RSA private JWK fields before importing any key', async t => {
  const importer = t.mock.method(crypto.subtle, 'importKey');
  const req = request(await rsa.token());
  for (const field of ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth']) {
    const auth = createWorkerAuthenticator({ issuer, algorithm: 'RS256',
      fetchJwks: () => jwks({ ...rsa.jwk, [field]: 'not-public' }) });
    assert.deepEqual(await auth(req), { status: 503 });
  }
  assert.equal(importer.mock.callCount(), 0);
});

for (const key of [old, rsa]) {
  test('read-only Workerd fixture verifies exact identity and rejects mismatch: ' + key.jwk.alg, async () => {
    const mf = new Miniflare({
      modules: true, compatibilityDate: '2026-07-30', host: '127.0.0.1', cf: false,
      scriptPath: fileURLToPath(new URL('./core-auth-fixture-worker.mjs', import.meta.url)),
      modulesRoot: fileURLToPath(new URL('.', import.meta.url)),
      bindings: { CORE_AUTH_MODE: 'synthetic-local', CORE_AUTH_ALGORITHM: key.jwk.alg,
        CORE_AUTH_FIXTURE_JWKS: JSON.stringify({ keys: [key.jwk] }) },
    });
    try {
      const token = await key.token();
      const headers = { authorization: 'Bearer ' + token, 'X-Core-QA-Expected-Account': account };
      const ok = await mf.dispatchFetch(endpoint, { headers });
      assert.equal(ok.status, 200);
      assert.equal(ok.headers.get('cache-control'), 'no-store');
      assert.deepEqual(await ok.json(), { accountId: account });
      const mismatch = await mf.dispatchFetch(endpoint, { headers: { ...headers, 'X-Core-QA-Expected-Account': other } });
      assert.equal(mismatch.status, 401);
      assert.deepEqual(await mismatch.json(), { detail: 'Unauthorized' });
      const wrongAlgorithm = await (key === old ? rsa : old).token();
      const wrong = await mf.dispatchFetch(endpoint, { headers: { ...headers, authorization: 'Bearer ' + wrongAlgorithm } });
      assert.equal(wrong.status, 401);
      assert.deepEqual(await wrong.json(), { detail: 'Unauthorized' });
      assert.equal((await mf.dispatchFetch(endpoint, { headers, method: 'POST', body: JSON.stringify({ account }) })).status, 404);
      assert.equal((await mf.dispatchFetch('https://hosted-fixture.invalid/qa/auth/account', { headers })).status, 404);
    } finally { await mf.dispose(); }
  });
}

test('Workerd fixture is default-off and returns only a generic outage for unusable signing evidence', async () => {
  for (const mode of ['disabled', 'synthetic-local']) {
    const mf = new Miniflare({
      modules: true, compatibilityDate: '2026-07-30', host: '127.0.0.1', cf: false,
      scriptPath: fileURLToPath(new URL('./core-auth-fixture-worker.mjs', import.meta.url)),
      modulesRoot: fileURLToPath(new URL('.', import.meta.url)),
      bindings: { CORE_AUTH_MODE: mode, CORE_AUTH_ALGORITHM: 'ES256', CORE_AUTH_FIXTURE_JWKS: lost },
    });
    try {
      const response = await mf.dispatchFetch(endpoint, { headers: request(await old.token()).headers });
      assert.equal(response.status, mode === 'disabled' ? 404 : 503);
      assert.deepEqual(await response.json(), { detail: mode === 'disabled' ? 'Not found' : 'Verification unavailable' });
      assert.equal(response.headers.get('cache-control'), 'no-store');
    } finally { await mf.dispose(); }
  }
});
