import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Miniflare } from 'miniflare';

export const alice = '10000000-0000-4000-8000-000000000001';
export const eve = '20000000-0000-4000-8000-000000000002';
const actors = { 'alice-device-a': alice, 'alice-device-b': alice, 'eve-device': eve };

export async function openFixture(fixturesEnabled = true) {
  const mf = new Miniflare({
    modules: true,
    scriptPath: fileURLToPath(new URL('./worker.mjs', import.meta.url)),
    compatibilityDate: '2026-07-30',
    host: '127.0.0.1',
    cf: false,
    d1Databases: { DB: 'synthetic-recipe-only' },
    bindings: { ...(fixturesEnabled && { RECIPE_FIXTURE_ONLY: 'miniflare' }), ACTORS: actors },
  });
  try {
    const db = await mf.getD1Database('DB');
    const schema = await readFile(new URL('./schema.sql', import.meta.url), 'utf8');
    await db.batch(schema.split(';').map(sql => sql.trim()).filter(Boolean).map(sql => db.prepare(sql)));
    return { mf, db };
  } catch (error) {
    await mf.dispose();
    throw error;
  }
}

export function client(mf, token = 'alice-device-a', host = 'recipe-fixture.invalid') {
  return (method, path = '/api/recipes', body) => mf.dispatchFetch(`https://${host}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body !== undefined && { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}
