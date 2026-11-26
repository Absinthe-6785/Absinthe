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
  assert.equal((await a('POST', path + '/restore')).status, 409);
  assert.equal((await a('DELETE', path + '/restore')).status, 404);
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
  assert.equal((await a('DELETE', collection + '/' + active.id + '/permanent')).status, 404);
  assert.equal((await a('POST', path + '/restore')).status, 404);
  assert.equal((await a('DELETE', path)).status, 404);
  assert.deepEqual(await (await a('GET', path)).json(), owned);
  assert.deepEqual(await (await a('GET')).json(), [active]);
});

const lifecycleFields = {
  title: 'Soup', category: 'Dinner', ingredients: 'Beans', steps: 'Simmer', memo: 'Serve hot', starred: true,
};
const trashPath = collection + '/trash';

test('individual lifecycle retains one exact row, rotates both revisions and rejects unauthorized or invalid transitions', async t => {
  const { mf, db, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice));
  const other = signedClient(mf, await token(eve), eve);
  const forgedAccount = signedClient(mf, await token(eve), alice);
  const original = await (await a('POST', collection, lifecycleFields)).json();
  const path = collection + '/' + original.id;
  const read = async (client, route) => {
    const res = await client('GET', route);
    assert.equal(res.status, 200);
    return res.json();
  };
  assert.equal((await a('POST', path + '/restore')).status, 409);
  assert.equal((await other('DELETE', path)).status, 404);
  assert.equal((await forgedAccount('DELETE', path)).status, 401);
  assert.equal((await a('DELETE', collection + '/' + eve)).status, 404);
  assert.equal((await a('POST', collection + '/' + eve + '/restore')).status, 404);
  assert.deepEqual(await read(a, path), original);
  const deletion = await a('DELETE', path, { user_id: eve, memo: 'ignore' });
  assert.equal(deletion.status, 200);
  const receipt = await deletion.json();
  const [deleted] = await read(a, trashPath);
  assert.equal(new Date(deleted.deleted_at).toISOString(), deleted.deleted_at);
  assert.notEqual(deleted.edit_revision, original.edit_revision);
  assert.deepEqual(deleted, { ...original, deleted_at: deleted.deleted_at, edit_revision: deleted.edit_revision });
  assert.deepEqual(receipt, { deleted: true, recipe_id: original.id, account_id: alice, deleted_at: deleted.deleted_at });
  assert.equal((await a('GET', path)).status, 404);
  assert.deepEqual(await read(a, collection), []);
  assert.deepEqual(await read(other, trashPath), []);
  assert.equal((await a('DELETE', path)).status, 404);
  assert.equal((await other('POST', path + '/restore')).status, 404);
  assert.equal((await forgedAccount('POST', path + '/restore')).status, 401);
  assert.equal((await a('PATCH', path, { ...lifecycleFields, expected_revision: original.edit_revision })).status, 404);
  assert.deepEqual(await read(a, trashPath), [deleted]);
  const restoration = await a('POST', path + '/restore', { ...lifecycleFields, starred: false, id: eve });
  assert.equal(restoration.status, 200);
  const restored = await restoration.json();
  assert.equal(new Set([original.edit_revision, deleted.edit_revision, restored.edit_revision]).size, 3);
  assert.deepEqual(restored, { ...original, edit_revision: restored.edit_revision });
  assert.deepEqual(await read(a, path), restored);
  assert.deepEqual(await read(a, collection), [restored]);
  assert.deepEqual(await read(a, trashPath), []);
  assert.equal((await a('POST', path + '/restore')).status, 409);
  for (const expected_revision of [original.edit_revision, deleted.edit_revision]) {
    const r = await a('PATCH', path, { ...lifecycleFields, title: 'stale', expected_revision });
    assert.equal(r.status, 409);
    assert.equal((await r.json()).detail.code, 'RECIPE_EDIT_CONFLICT');
  }
  assert.deepEqual(await read(a, collection), [restored]);
  assert.equal((await db.prepare('SELECT COUNT(*) AS n FROM recipes').first()).n, 1);
});

test('parallel state transitions admit one write per state; racing edits and favorites never overwrite tombstones', async t => {
  const { mf, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice, { session_id: 'device-a' }));
  const b = signedClient(mf, await token(alice, { session_id: 'device-b' }));
  const seed = async () => (await a('POST', collection, lifecycleFields)).json();
  const trashRow = async id => (await (await a('GET', trashPath)).json()).find(row => row.id === id);
  const original = await seed();
  const path = collection + '/' + original.id;
  assert.deepEqual((await Promise.all([a('DELETE', path), b('DELETE', path)])).map(r => r.status).sort(), [200, 404]);
  const deleted = await trashRow(original.id);
  const restores = await Promise.all([a('POST', path + '/restore'), b('POST', path + '/restore')]);
  assert.deepEqual(restores.map(r => r.status).sort(), [200, 409]);
  const restored = await restores.find(r => r.status === 200).json();
  assert.notEqual(restored.edit_revision, deleted.edit_revision);
  assert.deepEqual(await (await a('GET', path)).json(), restored);
  for (const kind of ['PATCH', 'PUT']) {
    const before = await seed();
    const key = collection + '/' + before.id;
    const update = kind === 'PATCH'
      ? b(kind, key, { ...lifecycleFields, title: 'Edited first', expected_revision: before.edit_revision })
      : b(kind, key + '/star', { starred: false });
    const [mutation, deletion] = await Promise.all([update, a('DELETE', key)]);
    assert.equal(deletion.status, 200);
    assert.ok([200, 404].includes(mutation.status));
    const prior = mutation.status === 200 ? await mutation.json() : before;
    const row = await trashRow(before.id);
    assert.notEqual(row.edit_revision, prior.edit_revision);
    assert.deepEqual(row, { ...prior, edit_revision: row.edit_revision, deleted_at: (await deletion.json()).deleted_at });
    assert.equal((await a('GET', key)).status, 404);
  }
});

test('lifecycle faults before execution, after commit and contradictory results fail closed without retries', async t => {
  const { mf, db, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice));
  const faults = [
    ['before', null],
    ['lost acknowledgement', () => { throw new Error('Lost acknowledgement'); }],
    ['invalid mutation metadata', r => ({ ...r, meta: { ...r.meta, rows_written: 0 } })],
    ['wrong result owner', row => ({ ...row, user_id: eve }), true],
    ['wrong result ID', row => ({ ...row, id: eve }), true],
    ['wrong result state', row => ({ ...row, deleted_at: row.deleted_at === null ? 'wrong' : null }), true],
    ['wrong result revision', row => ({ ...row, edit_revision: alice }), true],
    ['incomplete result', row => ({ ...row, ingredients: undefined }), true],
  ];
  for (const restore of [false, true]) {
    for (const [label, corrupt, rowFault] of faults) {
      const original = await (await a('POST', collection, lifecycleFields)).json();
      const path = collection + '/' + original.id;
      if (restore) assert.equal((await a('DELETE', path)).status, 200);
      const raw = () => db.prepare('SELECT * FROM recipes WHERE id=?').bind(original.id).first();
      const before = await raw();
      let calls = 0;
      const faultDb = { prepare(sql) {
        calls++;
        assert.match(sql, /^UPDATE recipes SET deleted_at=\?, edit_revision=\?/);
        return { bind: (...values) => ({ all: async () => {
          if (!corrupt) throw new Error('Database failed before execution');
          const result = await db.prepare(sql).bind(...values).all();
          return rowFault ? { ...result, results: result.results.map(corrupt) } : corrupt(result);
        } }) };
      } };
      const response = await handleRecipeRequest(new Request('http://127.0.0.1:8787' + path + (restore ? '/restore' : ''),
        { method: restore ? 'POST' : 'DELETE' }), { DB: faultDb }, alice);
      assert.equal(response.status, 503, label);
      assert.deepEqual(await response.json(), { detail: 'Recipe operation not confirmed' });
      assert.equal(calls, 1, label);
      const actual = await raw();
      if (!corrupt) {
        assert.deepEqual(actual, before);
      } else {
        assert.notEqual(actual.edit_revision, before.edit_revision);
        assert.equal(actual.deleted_at === null, restore);
        assert.deepEqual(actual, { ...before, deleted_at: actual.deleted_at, edit_revision: actual.edit_revision });
      }
    }
  }
});

test('a real SQLite abort rolls back both lifecycle fields and leaves the original row intact', async t => {
  const { mf, db, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice));
  const active = await (await a('POST', collection, lifecycleFields)).json();
  const toRestore = await (await a('POST', collection, lifecycleFields)).json();
  const path = id => collection + '/' + id;
  assert.equal((await a('DELETE', path(toRestore.id))).status, 200);
  const trashBefore = await (await a('GET', trashPath)).json();
  await db.prepare(`CREATE TRIGGER reject_lifecycle BEFORE UPDATE OF deleted_at ON recipes
    BEGIN SELECT RAISE(ABORT, 'Synthetic lifecycle failure'); END`).run();
  assert.equal((await a('DELETE', path(active.id))).status, 503);
  assert.equal((await a('POST', path(toRestore.id) + '/restore')).status, 503);
  assert.deepEqual(await (await a('GET', path(active.id))).json(), active);
  assert.deepEqual(await (await a('GET', trashPath)).json(), trashBefore);
});

test('a lifecycle request delayed before database execution is not fenced by an earlier state generation', async t => {
  const { mf, db, token } = await openSignedFixture();
  t.after(() => mf.dispose());
  const a = signedClient(mf, await token(alice));
  const row = await (await a('POST', collection, lifecycleFields)).json();
  const path = collection + '/' + row.id;
  for (const restore of [false, true]) {
    if (restore) assert.equal((await a('DELETE', path)).status, 200);
    const method = restore ? 'POST' : 'DELETE';
    const endpoint = path + (restore ? '/restore' : '');
    const { promise: entered, resolve: reached } = Promise.withResolvers();
    const { promise: held, resolve: release } = Promise.withResolvers();
    const delayedDb = { prepare(sql) {
      return { bind: (...values) => ({ all: async () => {
        reached();
        await held;
        return db.prepare(sql).bind(...values).all();
      } }) };
    } };
    const pending = handleRecipeRequest(new Request('http://127.0.0.1:8787' + endpoint, { method }), { DB: delayedDb }, alice);
    try {
      await Promise.race([entered, pending.then(() => { throw new Error('Did not reach held SQL'); })]);
      assert.equal((await a(method, endpoint)).status, 200);
      assert.equal((await a(restore ? 'DELETE' : 'POST', path + (restore ? '' : '/restore'))).status, 200);
    } finally {
      release();
    }
    assert.equal((await pending).status, 200);
    assert.equal((await a('GET', path)).status, restore ? 200 : 404);
    if (!restore) assert.equal((await a('POST', path + '/restore')).status, 200);
  }
});

test('without the local mode binding even a signed fixture token is denied', async t => {
  const { mf, token } = await openSignedFixture({ enabled: false, withDatabase: false });
  t.after(() => mf.dispose());
  assert.equal((await signedClient(mf, await token(alice))('GET')).status, 404);
});
