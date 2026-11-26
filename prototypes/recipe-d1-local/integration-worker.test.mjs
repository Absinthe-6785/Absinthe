import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alice, eve, openSignedFixture, signedClient } from './fixture.mjs';
import { handleRecipeRequest } from './worker.mjs';

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
  assert.deepEqual(await (await a('GET', collection + '/trash')).json(), []);
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
  assert.equal((await signedClient(mf, valid)('GET', collection + '/trash')).status, 503);
  assert.equal((await signedClient(mf, valid)('POST', collection, { title: 'unavailable' })).status, 503);
});

test('favorite is owner- and active-only, validates the boolean and rotates revisions on every admitted PUT', async t => {
  const { mf, db, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice));
  const b = signedClient(mf, await token(eve), eve);
  const original = await (await a('POST', collection, {
    title: 'Soup', category: 'Dinner', ingredients: 'Beans', steps: 'Simmer', memo: 'Serve hot',
  })).json();
  const path = collection + '/' + original.id;
  const star = path + '/star';
  for (const body of [null, {}, { starred: 'true' }, { starred: 1 }, { starred: null }]) {
    assert.equal((await a('PUT', star, body)).status, 422);
  }
  assert.equal((await b('PUT', star, { starred: true, user_id: alice })).status, 404);
  assert.deepEqual(await (await a('GET', path)).json(), original);
  let prior = original;
  for (const starred of [true, true, false]) {
    const response = await a('PUT', star, { starred, title: 'Ignored', user_id: eve });
    assert.equal(response.status, 200);
    const updated = await response.json();
    assert.notEqual(updated.edit_revision, prior.edit_revision);
    assert.deepEqual(updated, { ...prior, starred, edit_revision: updated.edit_revision });
    assert.deepEqual(await (await a('GET', path)).json(), updated);
    prior = updated;
  }
  const stale = await a('PATCH', path, { title: 'Stale draft', expected_revision: original.edit_revision });
  assert.equal(stale.status, 409);
  assert.deepEqual((await stale.json()).detail.current, prior);
  const deletedAt = '2025-01-05T00:00:00.000Z';
  await db.prepare('UPDATE recipes SET deleted_at=? WHERE id=?').bind(deletedAt, original.id).run();
  assert.equal((await a('PUT', star, { starred: true })).status, 404);
  assert.deepEqual(await (await a('GET', collection + '/trash')).json(), [{ ...prior, deleted_at: deletedAt }]);
});

test('concurrent favorite and conditional content writes preserve the winner and prevent stale overwrite', async t => {
  const { mf, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice, { session_id: 'favorite' }));
  const b = signedClient(mf, await token(alice, { session_id: 'edit' }));
  const original = await (await a('POST', collection, { title: 'Original' })).json();
  const path = collection + '/' + original.id;
  const [star, edit] = await Promise.all([
    a('PUT', path + '/star', { starred: true }),
    b('PATCH', path, { title: 'Concurrent edit', expected_revision: original.edit_revision }),
  ]);
  assert.equal(star.status, 200);
  const saved = await star.json();
  const final = await (await b('GET', path)).json();
  assert.deepEqual(final, saved);
  assert.equal(final.starred, true);
  if (edit.status === 200) {
    const edited = await edit.json();
    assert.notEqual(final.edit_revision, edited.edit_revision);
    assert.deepEqual(final, { ...edited, starred: true, edit_revision: final.edit_revision });
    assert.equal(final.title, 'Concurrent edit');
  } else {
    assert.equal(edit.status, 409);
    assert.deepEqual((await edit.json()).detail.current, final);
    assert.deepEqual(final, { ...original, starred: true, edit_revision: final.edit_revision });
  }
});

test('ambiguous and contradictory favorite acknowledgements never succeed or repeat the write', async t => {
  const { mf, db, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice));
  for (const corrupt of [
    () => { throw new Error('response lost after execution'); },
    result => ({ ...result, results: [] }),
    result => ({ ...result, meta: { ...result.meta, changed_db: false } }),
    result => ({ ...result, meta: { ...result.meta, rows_written: 0 } }),
    result => ({ ...result, meta: { ...result.meta, rows_written: undefined } }),
    result => ({ ...result, results: [], meta: { ...result.meta, changes: 0, changed_db: false, rows_written: 1 } }),
    result => ({ ...result, results: [{ ...result.results[0], user_id: eve }] }),
    result => ({ ...result, results: [{ ...result.results[0], starred: 0 }] }),
    result => ({ ...result, results: [{ ...result.results[0], edit_revision: alice }] }),
    result => ({ ...result, results: [{ ...result.results[0], memo: undefined }] }),
  ]) {
    const original = await (await a('POST', collection, { title: 'Synthetic uncertain' })).json();
    const path = collection + '/' + original.id;
    let calls = 0;
    const dbWithFault = {
      prepare(sql) {
        calls++;
        return { bind: (...values) => ({ all: async () => corrupt(await db.prepare(sql).bind(...values).all()) }) };
      },
    };
    const response = await handleRecipeRequest(new Request('http://127.0.0.1:8787' + path + '/star', {
      method: 'PUT', body: JSON.stringify({ starred: true }),
    }), { DB: dbWithFault }, alice);
    assert.equal(response.status, 503);
    assert.equal(calls, 1);
    const actual = await (await a('GET', path)).json();
    assert.notEqual(actual.edit_revision, original.edit_revision);
    assert.deepEqual(actual, { ...original, starred: true, edit_revision: actual.edit_revision });
  }
});

test('trash returns exact recoverable rows ordered by deletion time, with no write or foreign exposure', async t => {
  const { mf, db, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice));
  const b = signedClient(mf, await token(eve), eve);
  const path = collection + '/trash';
  const empty = await a('GET', path);
  assert.equal(empty.status, 200);
  assert.deepEqual(await empty.json(), []);
  const seed = async (client, title, deletedAt) => {
    const row = await (await client('POST', collection, { title, starred: true, memo: 'Retained' })).json();
    if (deletedAt) await db.prepare('UPDATE recipes SET deleted_at=? WHERE id=?').bind(deletedAt, row.id).run();
    return { ...row, deleted_at: deletedAt };
  };
  const latest = '2026-04-02T00:00:00.000Z';
  const newer = await seed(a, 'Newer deletion', latest);
  const older = await seed(a, 'Older deletion', '2026-04-01T00:00:00.000Z');
  const tied = await seed(a, 'Same deletion time', latest);
  const active = await seed(a, 'Active only', null);
  const foreign = await seed(b, 'Foreign deleted', latest);
  const owned = [...[newer, tied].sort((x, y) => x.id < y.id ? -1 : 1), older];
  assert.deepEqual(await (await a('GET', path)).json(), owned);
  assert.deepEqual(await (await b('GET', path)).json(), [foreign]);
  assert.deepEqual(await (await a('GET')).json(), [active]);
  assert.equal((await a('DELETE', collection + '/' + active.id)).status, 405);
  assert.equal((await a('POST', collection + '/' + older.id + '/restore')).status, 404);
  assert.equal((await a('DELETE', path)).status, 404);
  assert.deepEqual(await (await a('GET', path)).json(), owned);
  assert.deepEqual(await (await a('GET')).json(), [active]);
});

test('without the local mode binding even a signed fixture token is denied', async t => {
  const { mf, token } = await openSignedFixture({ enabled: false, withDatabase: false });
  t.after(() => mf.dispose());
  assert.equal((await signedClient(mf, await token(alice))('GET')).status, 404);
});
