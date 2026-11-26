import assert from 'node:assert/strict';
import { test } from 'node:test';
import { alice, client, openFixture } from './fixture.mjs';
import worker from './worker.mjs';

const collection = '/api/recipes';
const key = row => `${collection}/${row.id}`;
const rows = async response => {
  assert.equal(response.status, 200);
  return response.json();
};
const edit = (client, row, title) => client('PATCH', key(row), { title, expected_revision: row.edit_revision });
const create = (client, title = 'Synthetic recipe') => client('POST', collection, { title }).then(rows);
const inFixture = (name, scenario, enabled = true) => test(name, async t => {
  const { mf, db } = await openFixture(enabled);
  t.after(() => mf.dispose());
  await scenario(client(mf), client(mf, 'alice-device-b'), client(mf, 'eve-device'), db, mf);
});

inFixture('two devices see the same original ID, conflict, local draft, and latest cloud record', async (a, b) => {
  const original = await create(a);
  assert.equal(original.user_id, alice);
  assert.deepEqual(await rows(await b('GET')), [original]);
  assert.deepEqual(await rows(await b('GET', key(original))), original);
  const newer = await rows(await edit(b, original, 'Device B saved'));
  assert.equal(newer.id, original.id);
  assert.equal(newer.created_at, original.created_at);
  assert.notEqual(newer.edit_revision, original.edit_revision);
  const aDraft = { title: 'Device A retained draft', expected_revision: original.edit_revision };
  const stale = await a('PATCH', key(original), aDraft);
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { detail: { code: 'RECIPE_EDIT_CONFLICT', current: newer } });
  assert.equal(aDraft.title, 'Device A retained draft');
  assert.deepEqual(await rows(await a('GET', key(original))), newer);
});

inFixture('scope is server-selected; strangers cannot list, read, patch or learn the conflict row', async (a, _b, eve, db) => {
  const original = await create(a);
  assert.deepEqual(await rows(await eve('GET')), []);
  assert.equal((await eve('GET', key(original))).status, 404);
  const other = await eve('PATCH', key(original), {
    title: 'not saved', expected_revision: original.edit_revision, user_id: alice,
  });
  assert.equal(other.status, 404);
  assert.deepEqual(await other.json(), { detail: 'Not found' });
  const own = await rows(await eve('POST', collection, { title: 'own', user_id: alice, id: original.id }));
  assert.notEqual(own.user_id, alice);
  assert.notEqual(own.id, original.id);
  await db.prepare('UPDATE recipes SET deleted_at=? WHERE id=?').bind('2026-01-01T00:00:00.000Z', own.id).run();
  assert.deepEqual(await rows(await eve('GET')), []);
  assert.equal((await eve('GET', key(own))).status, 404);
  assert.equal((await edit(eve, own, 'no resurrection')).status, 404);
  assert.equal((await a('PUT', key(original), { title: 'legacy' })).status, 428);
  assert.equal((await a('PATCH', key(original), { title: 'no revision' })).status, 422);
  assert.deepEqual(await rows(await a('GET', key(original))), original);
});

inFixture('fixture credentials cannot work for a real host or unknown actor', async (_a, _b, _eve, _db, mf) => {
  assert.equal((await client(mf, 'alice-device-a', 'example.com')('GET')).status, 404);
  assert.equal((await client(mf, 'unknown-fixture-token')('GET')).status, 401);
});

inFixture('runtime fails closed without the synthetic-only binding', async a => {
  const response = await a('POST', collection, { title: 'not saved' });
  assert.equal(response.status, 404);
  assert.equal(response.headers.get('x-fixture-queries'), '0');
}, false);

inFixture('two concurrent CAS writes can acknowledge at most one edit', async (a, b) => {
  const original = await create(a);
  const replies = await Promise.all([edit(a, original, 'A'), edit(b, original, 'B')]);
  assert.deepEqual(replies.map(reply => reply.status).sort(), [200, 409]);
  const winner = await replies.find(reply => reply.status === 200).json();
  const conflict = await replies.find(reply => reply.status === 409).json();
  assert.deepEqual(winner, conflict.detail.current);
  assert.deepEqual(await rows(await b('GET', key(original))), winner);
});

inFixture('a committed update with lost client response is indeterminate and read back, not retried', async (a, b) => {
  const original = await create(a);
  const draft = { title: 'unacknowledged client draft', expected_revision: original.edit_revision };
  let writes = 0;
  const disconnect = async () => {
    writes++;
    const reply = await b('PATCH', key(original), draft);
    assert.equal(reply.status, 200);
    await reply.arrayBuffer();
    throw new Error('synthetic response loss after commit');
  };
  await assert.rejects(disconnect, /response loss/);
  assert.equal(writes, 1);
  const current = await rows(await a('GET', key(original)));
  assert.equal(current.id, original.id);
  assert.equal(current.title, draft.title);
  assert.notEqual(current.edit_revision, draft.expected_revision);
});

inFixture('real SQLite write failure cannot acknowledge a save or partly change content and revision', async (a, b, _eve, db) => {
  const original = await create(a);
  await db.prepare(`CREATE TRIGGER fixture_reject AFTER UPDATE ON recipes
    WHEN new.title = 'synthetic failure'
    BEGIN SELECT RAISE(ABORT, 'fixture rollback'); END`).run();
  const failed = await edit(b, original, 'synthetic failure');
  assert.equal(failed.status, 503);
  assert.deepEqual(await failed.json(), { detail: 'Recipe operation not confirmed' });
  assert.deepEqual(await rows(await a('GET', key(original))), original);
  const saved = await rows(await edit(a, original, 'separate save after readback'));
  assert.equal(saved.title, 'separate save after readback');
});

test('contradictory D1 acknowledgements are indeterminate, never a success or a conflict', async () => {
  const id = '22222222-2222-4222-8222-222222222222';
  const revision = '33333333-3333-4333-8333-333333333333';
  // Intentionally mock only the adapter reply; real D1 cases above use Miniflare.
  for (const [method, returnsRow] of [['PATCH', true], ['PATCH', false], ['POST', true]]) {
    let statements = 0;
    const DB = {
      prepare(sql) {
        statements++;
        assert.match(sql, /RETURNING/);
        return { bind(...args) {
          const [title, category, ingredients, steps, memo, starred] = method === 'PATCH' ? args : args.slice(2);
          const row = {
            id: method === 'PATCH' ? args[7] : args[0], user_id: alice, deleted_at: null,
            edit_revision: method === 'PATCH' ? args[6] : args[9],
            title, category, ingredients, steps, memo, starred,
          };
          return { all: async () => ({
            success: true, results: returnsRow ? [row] : [],
            meta: { changes: returnsRow ? 0 : 1, rows_read: 0, rows_written: 0 },
          }) };
        } };
      },
    };
    const path = method === 'PATCH' ? `${collection}/${id}` : collection;
    const response = await worker.fetch(new Request(`https://recipe-fixture.invalid${path}`, {
      method, headers: { authorization: 'Bearer injected-test' },
      body: JSON.stringify({ title: 'Test draft', expected_revision: revision }),
    }), { DB, RECIPE_FIXTURE_ONLY: 'miniflare', ACTORS: { 'injected-test': alice } });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { detail: 'Recipe operation not confirmed' });
    assert.equal(statements, 1, 'contradiction must not trigger a retry or be treated as a CAS miss');
  }
});
