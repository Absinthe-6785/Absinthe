import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { build, version } from '../../frontend/node_modules/esbuild/lib/main.js';
import { alice, client, eve, openFixture } from './fixture.mjs';

// Same synthetic D1 driver and data for both sides. The two-statement
// comparator models the backend's ownership pre-read, not PG performance.
const root = fileURLToPath(new URL('../../', import.meta.url)).replaceAll('\\', '/').replace(/\/$/, '');
const base = '69052a07adc330f9dc451451ef40131764dd02e2';
const lifecycleBase = '5588810dafe050d2129ef36ba0dca5632d403c68';
const baseline = sha => execFileSync('git', ['-c', `safe.directory=${root}`, '-C', root, 'show',
  `${sha}:prototypes/recipe-d1-local/worker.mjs`], { encoding: 'utf8' });
const entry = fileURLToPath(new URL('./integration-worker.mjs', import.meta.url));
async function bundle(original) {
  const { outputFiles: [{ contents }] } = await build({
    entryPoints: [entry], bundle: true, minify: true, format: 'esm', write: false,
    plugins: original ? [{ name: 'base-worker', setup({ onLoad }) {
      onLoad({ filter: /[\\/]worker\.mjs$/ }, () => ({ contents: original }));
    } }] : [],
  });
  return { bytes: contents.length, gzipBytes: gzipSync(contents).length };
}
console.log(JSON.stringify({ bundle: {
  esbuild: version, compatibilityBase: { sha: base, ...await bundle(baseline(base)) },
  lifecycleBase: { sha: lifecycleBase, ...await bundle(baseline(lifecycleBase)) }, candidate: await bundle(),
} }));

const revision = '10000000-0000-4000-8000-000000000010';
const idOf = i => `30000000-0000-4000-8000-${String(i).padStart(12, '0')}`;
const iso = i => new Date(Date.UTC(2025, 0, 1, 0, i)).toISOString();
const trashPath = '/api/recipes/trash';
const prepareTrash = 'SELECT * FROM recipes WHERE user_id=? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id';
const prepareActive = 'SELECT * FROM recipes WHERE user_id=? AND deleted_at IS NULL ORDER BY created_at DESC, id';

async function measured(response) {
  const json = await response.text();
  assert.equal(response.status, 200, json);
  const number = name => {
    assert.ok(response.headers.has('x-fixture-' + name));
    return Number(response.headers.get('x-fixture-' + name));
  };
  return {
    body: JSON.parse(json), queries: number('queries'), reads: number('rows-read'),
    writes: number('rows-written'), bytes: Buffer.byteLength(json),
  };
}

for (const total of [100, 500]) {
  const { mf, db } = await openFixture();
  try {
    const seed = db.prepare('INSERT INTO recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
    for (let start = 0; start < total; start += 50) {
      await db.batch(Array.from({ length: 50 }, (_, n) => {
        const i = start + n;
        return seed.bind(idOf(i), i < total / 2 ? alice : eve, 'Synthetic recipe ' + i, 'Other',
          'Rice', 'Simmer', 'Local fixture only', i % 2, iso(i), i % 10 === 0 ? iso(i + total) : null, revision);
      }));
    }
    const call = client(mf);
    // Distinct statement text avoids reusing the plan cached before DDL.
    const indexPlan = async label => (await db.prepare(`EXPLAIN QUERY PLAN ${prepareTrash} /* ${label} */`).bind(alice).all())
      .results.map(row => row.detail);
    const indexedPlan = await indexPlan('with index');
    const { body: trash, ...indexed } = await measured(await call('GET', trashPath));
    await db.prepare('DROP INDEX recipes_owner_trash_order').run();
    const scanPlan = await indexPlan('without index');
    const { body: trashScan, ...scan } = await measured(await call('GET', trashPath));
    assert.deepEqual(trashScan, trash);
    assert.equal(trash.length, total / 20);
    assert.ok(indexedPlan.some(item => item.includes('recipes_owner_trash_order')));
    assert.ok(scanPlan.some(item => item.startsWith('SCAN recipes')));
    assert.ok(indexed.reads < scan.reads);
    // Recreate the exact candidate index before the matched favorite probes.
    await db.prepare(`CREATE INDEX recipes_owner_trash_order ON recipes (user_id, deleted_at DESC, id)
      WHERE deleted_at IS NOT NULL`).run();

    const id = idOf(2);
    const before = await db.prepare('SELECT user_id, deleted_at FROM recipes WHERE id=?').bind(id).all();
    assert.deepEqual(before.results, [{ user_id: alice, deleted_at: null }]);
    const updated = await db.prepare(`UPDATE recipes SET starred=?, edit_revision=?
      WHERE id=? AND user_id=? AND deleted_at IS NULL RETURNING *`).bind(1, crypto.randomUUID(), id, alice).all();
    assert.equal(updated.meta.changes, 1);
    const baselineRow = { ...updated.results[0], starred: true };
    const twoStatements = {
      queries: 2, reads: before.meta.rows_read + updated.meta.rows_read,
      writes: before.meta.rows_written + updated.meta.rows_written,
      bytes: Buffer.byteLength(JSON.stringify(baselineRow)),
    };
    // Reset fixture outside the timed/counted path; run identical transition.
    await db.prepare('UPDATE recipes SET starred=0, edit_revision=? WHERE id=?').bind(revision, id).run();
    const { body: favorite, ...singleStatement } = await measured(await call('PUT', '/api/recipes/' + id + '/star', { starred: true }));
    assert.deepEqual(favorite, { ...baselineRow, edit_revision: favorite.edit_revision });
    assert.notEqual(favorite.edit_revision, revision);
    assert.equal(singleStatement.bytes, twoStatements.bytes);
    assert.equal(singleStatement.queries, 1);
    assert.equal(singleStatement.writes, twoStatements.writes);
    console.log(JSON.stringify({ fixtureRows: total, trashRows: trash.length,
      trash: { scan, scanPlan, indexed, indexedPlan }, favorite: { twoStatements, singleStatement } }));

    // Same exact row and indexes before each matched transition. This models
    // the existing API's pre-read plus UPDATE in D1, not a PostgreSQL benchmark.
    const path = '/api/recipes/' + id;
    const startDeletedAt = iso(total + 1);
    const restorePath = path + '/restore';
    const reset = db.prepare('UPDATE recipes SET deleted_at=?, edit_revision=? WHERE id=?');
    const membership = async () => {
      const [active, trash] = await Promise.all([
        measured(await call('GET', '/api/recipes')), measured(await call('GET', trashPath)),
      ]);
      return [active, trash].map(({ body, reads }) => [body.length, reads, body.some(row => row.id === id)]);
    };
    const activePlan = (await db.prepare(`EXPLAIN QUERY PLAN ${prepareActive}`).bind(alice).all()).results.map(row => row.detail);
    assert.ok(activePlan.some(item => item.includes('recipes_owner_active_order')));
    for (const restoring of [false, true]) {
      const oldState = restoring ? startDeletedAt : null;
      const newState = restoring ? null : iso(total + 2);
      await reset.bind(oldState, revision, id).run();
      const membershipBefore = await membership();
      const ownerCheck = await db.prepare('SELECT user_id, deleted_at FROM recipes WHERE id=?').bind(id).all();
      assert.deepEqual(ownerCheck.results, [{ user_id: alice, deleted_at: oldState }]);
      const mutation = await db.prepare(`UPDATE recipes SET deleted_at=?, edit_revision=?
        WHERE id=? AND user_id=? AND deleted_at IS ${restoring ? 'NOT NULL' : 'NULL'} RETURNING *`)
        .bind(newState, crypto.randomUUID(), id, alice).all();
      assert.equal(mutation.meta.changes, 1);
      const baselineRow = { ...mutation.results[0], starred: true };
      const response = restoring ? baselineRow : { deleted: true, recipe_id: id, account_id: alice, deleted_at: newState };
      const before = { modeledApiRequests: 1, queries: 2, reads: ownerCheck.meta.rows_read + mutation.meta.rows_read,
        writes: mutation.meta.rows_written, bytes: Buffer.byteLength(JSON.stringify(response)) };
      await reset.bind(oldState, revision, id).run();
      const { body, ...cost } = await measured(await call(restoring ? 'POST' : 'DELETE', restoring ? restorePath : path));
      if (restoring) {
        assert.deepEqual(body, { ...response, edit_revision: body.edit_revision });
        assert.notEqual(body.edit_revision, revision);
      } else {
        assert.equal(new Date(body.deleted_at).toISOString(), body.deleted_at);
        assert.deepEqual(body, { ...response, deleted_at: body.deleted_at });
      }
      assert.equal(cost.queries, 1);
      assert.equal(cost.bytes, before.bytes);
      assert.equal(cost.writes, before.writes);
      assert.ok(cost.reads < before.reads);
      const membershipAfter = await membership();
      assert.deepEqual(membershipBefore.map(item => item[2]), [!restoring, restoring]);
      assert.deepEqual(membershipAfter.map(item => item[2]), [restoring, !restoring]);
      assert.deepEqual(membershipAfter.map(([count], n) => count - membershipBefore[n][0]),
        restoring ? [1, -1] : [-1, 1]);
      console.log(JSON.stringify({ fixtureRows: total, operation: restoring ? 'restore' : 'soft-delete',
        before, after: { apiRequests: 1, ...cost }, activePlan, trashPlan: indexedPlan,
        indexedLists: { fields: ['count', 'rowsRead', 'containsID'], before: membershipBefore, after: membershipAfter } }));
    }
  } finally {
    await mf.dispose();
  }
}
