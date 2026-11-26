import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alice, eve, openSignedFixture, signedClient } from './fixture.mjs';

const collection = '/api/recipes';

test('signed same-account clients use exact IDs, ownership and concurrent conditional edits', async t => {
  const { mf, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice, { session_id: 'device-a' }));
  const b = signedClient(mf, await token(alice, { session_id: 'device-b' }));
  const stranger = signedClient(mf, await token(eve), eve);
  const created = await a('POST', collection, { title: 'Synthetic', user_id: eve, id: eve });
  assert.equal(created.status, 200);
  assert.equal(created.headers.has('x-fixture-queries'), false);
  const initial = await created.json();
  assert.equal(initial.user_id, alice);
  assert.notEqual(initial.id, eve);
  const path = collection + '/' + initial.id;
  assert.deepEqual(await (await b('GET')).json(), [initial]);
  assert.deepEqual(await (await b('GET', path)).json(), initial);
  assert.deepEqual(await (await stranger('GET')).json(), []);
  assert.equal((await stranger('GET', path)).status, 404);
  assert.equal((await stranger('PATCH', path, { title: 'stranger', expected_revision: initial.edit_revision })).status, 404);
  const edits = await Promise.all([a, b].map((client, i) =>
    client('PATCH', path, { title: 'Edit ' + i, expected_revision: initial.edit_revision })));
  assert.deepEqual(edits.map(r => r.status).sort(), [200, 409]);
  const winner = await edits.find(r => r.status === 200).json();
  assert.equal(winner.id, initial.id);
  assert.notEqual(winner.edit_revision, initial.edit_revision);
  assert.deepEqual((await edits.find(r => r.status === 409).json()).detail.current, winner);
  assert.equal((await a('DELETE', path)).status, 405);
  assert.equal((await a('POST', path + '/restore')).status, 404);
  assert.equal((await a('POST', path + '/star')).status, 404);
  assert.equal((await a('GET', collection + '/trash')).status, 404);
  assert.deepEqual(await (await a('GET', path)).json(), winner);
});

test('wrong signatures and claims cannot reach D1 or authenticate on a hosted origin', async t => {
  // No D1: 401 proves rejection before attempted reads or writes.
  const { mf, token } = await openSignedFixture({ withDatabase: false });
  t.after(() => mf.dispose());
  const untrusted = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  const invalid = await Promise.all([
    token(alice, {}, {}, untrusted.privateKey),
    token(alice, {}, { alg: 'none' }),
    token(alice, {}, { kid: 'wrong' }),
    token(alice, { exp: 1 }),
    token(alice, { nbf: Math.floor(Date.now() / 1000) + 60 }),
    token(alice, { iss: 'https://not-trusted.invalid/auth/v1' }),
    token(alice, { aud: 'anon' }),
    token(alice, { role: 'service_role' }),
    token(''),
    token(undefined),
  ]);
  for (const credential of [...invalid, 'malformed']) {
    assert.equal((await signedClient(mf, credential)('POST', collection, { title: 'denied' })).status, 401);
  }
  const valid = await token(alice);
  assert.equal((await signedClient(mf, valid, eve)('POST', collection, { title: 'mismatched account' })).status, 401);
  assert.equal((await signedClient(mf, valid, alice, 'https://candidate.invalid')('GET')).status, 404);
  assert.equal((await signedClient(mf, valid)('GET')).status, 503);
  assert.equal((await signedClient(mf, valid)('POST', collection, { title: 'unavailable' })).status, 503);
});

test('without the local mode binding even a signed fixture token is denied', async t => {
  const { mf, token } = await openSignedFixture({ enabled: false, withDatabase: false });
  t.after(() => mf.dispose());
  assert.equal((await signedClient(mf, await token(alice))('GET')).status, 404);
});
