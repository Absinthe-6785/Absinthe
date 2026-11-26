import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { PGlite } from '@electric-sql/pglite';
import { alice, client, eve, openFixture } from './fixture.mjs';

// An executable SQL-path reference to backend/main.py, not FastAPI or PostgREST timing.
// The reviewed Repo migrations set up the PG active-list index and revision trigger.
const migrations = ['202608310001_recipe_soft_delete.sql', '20261125132129_recipe_edit_revision.sql'];
const listPg = 'SELECT * FROM recipes WHERE user_id=$1 AND deleted_at IS NULL ORDER BY created_at DESC';
const lookupPg = 'SELECT * FROM recipes WHERE id=$1 AND user_id=$2 AND deleted_at IS NULL';
const ids = i => `a2222222-2222-4222-8222-${String(i).padStart(12, '0')}`;
const indexes = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
const indexD1 = indexes.split(';').find(sql => sql.trimStart().startsWith('CREATE INDEX recipes_owner_active_order '));
const source = await readFile(new URL('./worker.mjs', import.meta.url));
const bytes = obj => Buffer.byteLength(JSON.stringify(obj));
const ms = start => Number((performance.now() - start).toFixed(3));
const signature = rows => rows.map(row => ({ ...row, created_at: new Date(row.created_at).toISOString() }));
const fixture = perAccount => Array.from({ length: 2 * perAccount }, (_, i) => [
  ids(i), i < perAccount ? alice : eve, `Synthetic recipe ${i}`, 'Other', 'One tomato',
  'Slice and serve', 'Synthetic '.repeat(6), Number(i % 3 === 0),
  new Date(Date.UTC(2024, 0, 1, 0, i)).toISOString(),
  i % 10 === 0 ? '2025-01-01T00:00:00.000Z' : null,
]);
const insertD1 = 'INSERT INTO recipes VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

async function seedPg(pg, data) {
  await pg.exec(`CREATE TABLE public.recipes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL,
    category text NOT NULL, ingredients text NOT NULL, steps text NOT NULL, memo text NOT NULL,
    starred boolean NOT NULL, created_at timestamptz NOT NULL
  )`);
  const first = new URL(`../../backend/migrations/${migrations[0]}`, import.meta.url);
  await pg.exec(await readFile(first, 'utf8'));
  // Seed the old schema, apply the exact migration, and use its generated UUIDs in both stores.
  for (let offset = 0; offset < data.length; offset += 100) {
    const batch = data.slice(offset, offset + 100).map(r => r.map((v, i) => i === 7 ? Boolean(v) : v));
    const parameters = batch.map((row, i) => `(${row.map((_, k) => '$' + (i * row.length + k + 1)).join(',')})`);
    await pg.query(`INSERT INTO recipes VALUES ${parameters.join(',')}`, batch.flat());
  }
  await pg.exec(await readFile(new URL(`../../backend/migrations/${migrations[1]}`, import.meta.url), 'utf8'));
  await pg.exec('ANALYZE recipes');
  return new Map((await pg.query('SELECT id, edit_revision FROM recipes')).rows.map(row => [row.id, row.edit_revision]));
}

function scanRows(plan) {
  const count = /Scan$/.test(plan['Node Type']) && plan['Relation Name']
    ? ((plan['Actual Rows'] || 0) + (plan['Rows Removed by Filter'] || 0) +
      (plan['Rows Removed by Index Recheck'] || 0)) * plan['Actual Loops'] : 0;
  return count + (plan.Plans || []).reduce((sum, child) => sum + scanRows(child), 0);
}

async function d1Measure(call, ...args) {
  const start = performance.now();
  const response = await call(...args);
  const raw = await response.text();
  return {
    body: JSON.parse(raw),
    sample: {
      status: response.status, apiRequests: 1,
      queries: Number(response.headers.get('x-fixture-queries')),
      rowsRead: Number(response.headers.get('x-fixture-rows-read')),
      rowsWritten: Number(response.headers.get('x-fixture-rows-written')),
      jsonBytes: Buffer.byteLength(raw), localMs: ms(start),
    },
  };
}

async function pgMeasure(pg, op) {
  let queries = 0;
  const query = async (sql, values) => {
    queries++;
    return (await pg.query(sql, values)).rows;
  };
  const start = performance.now();
  const { body, status } = await op(query);
  return { body, sample: { status, apiRequests: 1, queries, jsonBytes: bytes(body), sqlPathMs: ms(start) } };
}

async function referencePatch(query, id, owner, edit, expected) {
  const [before] = await query('SELECT user_id, deleted_at FROM recipes WHERE id=$1', [id]);
  assert.equal(before.user_id, owner);
  assert.equal(before.deleted_at, null);
  const [updated] = await query(`UPDATE recipes SET title=$1, category=$2, ingredients=$3, steps=$4, memo=$5, starred=$6
    WHERE id=$7 AND user_id=$8 AND deleted_at IS NULL AND edit_revision=$9 RETURNING *`,
  [edit.title, edit.category, edit.ingredients, edit.steps, edit.memo, edit.starred, id, owner, expected]);
  if (updated) return { body: updated, status: 200 };
  const [current] = await query(lookupPg, [id, owner]);
  return { body: { detail: { code: 'RECIPE_EDIT_CONFLICT', current } }, status: 409 };
}

function comparable(result) {
  const record = result.detail ? result.detail.current : result;
  const { edit_revision, ...rest } = record;
  assert.match(edit_revision, /^[0-9a-f-]{36}$/);
  return { code: result.detail?.code, record: signature([rest])[0] };
}

for (const perAccount of [50, 250]) {
  const { mf, db } = await openFixture();
  const pg = new PGlite();
  try {
    const data = fixture(perAccount);
    const revisions = await seedPg(pg, data);
    for (let offset = 0; offset < data.length; offset += 100) {
      await db.batch(data.slice(offset, offset + 100).map(r => db.prepare(insertD1).bind(...r, revisions.get(r[0]))));
    }
    const a = client(mf);
    const list = query => query(listPg, [alice]).then(body => ({ body, status: 200 }));
    await d1Measure(a, 'GET');
    await pgMeasure(pg, list);
    const pgList = await pgMeasure(pg, list);
    const [explained] = (await pg.query(`EXPLAIN (ANALYZE, FORMAT JSON) ${listPg}`, [alice])).rows;
    const plan = explained['QUERY PLAN'][0].Plan;
    pgList.sample.executorRows = scanRows(plan);
    const d1Indexed = await d1Measure(a, 'GET');
    await db.prepare('DROP INDEX recipes_owner_active_order').run();
    const d1Unindexed = await d1Measure(a, 'GET');
    await db.prepare(indexD1).run();
    assert.deepEqual(d1Unindexed.body, d1Indexed.body);
    assert.deepEqual(d1Indexed.body, signature(pgList.body));
    assert.equal(d1Indexed.body.length, perAccount * 0.9);
    assert.ok(d1Indexed.sample.rowsRead < d1Unindexed.sample.rowsRead);

    const id = ids(1);
    const revision = revisions.get(id);
    const path = '/api/recipes/' + id;
    const patches = [];
    let winner;
    const saved = { title: 'Saved title', category: 'Dinner', ingredients: 'Rice', steps: 'Simmer', memo: 'Keep warm', starred: true };
    for (const [form, status] of [[saved, 200], [{ ...saved, title: 'Stale title', starred: false }, 409]]) {
      const d1 = await d1Measure(a, 'PATCH', path, { ...form, expected_revision: revision });
      const p = await pgMeasure(pg, query => referencePatch(query, id, alice, form, revision));
      assert.deepEqual(comparable(d1.body), comparable(p.body));
      assert.equal(d1.sample.status, status);
      assert.equal(p.sample.status, status);
      assert.equal(d1.sample.queries + 1, p.sample.queries);
      if (status === 200) {
        assert.notEqual(p.body.edit_revision, revision);
        assert.notEqual(d1.body.edit_revision, revision);
        for (const [field, value] of Object.entries(saved)) assert.equal(d1.body[field], value);
        winner = { pg: p.body, d1: d1.body };
      } else {
        assert.deepEqual(p.body.detail.current, winner.pg);
        assert.deepEqual(d1.body.detail.current, winner.d1);
      }
      patches.push({ pg: p.sample, d1: d1.sample });
    }
    console.log(JSON.stringify({
      fixtureRows: data.length, visibleRows: d1Indexed.body.length,
      list: { pg: pgList.sample, d1WithoutIndex: d1Unindexed.sample, d1Indexed: d1Indexed.sample },
      patches,
      workerModuleBytes: source.length, workerModuleGzipBytes: gzipSync(source).length,
    }));
  } finally {
    await pg.close();
    await mf.dispose();
  }
}
