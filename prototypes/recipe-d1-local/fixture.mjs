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
  return initialize(mf);
}

export async function openSignedFixture({ enabled = true, withDatabase = true, port } = {}) {
  const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const publicJwk = { ...await crypto.subtle.exportKey('jwk', keys.publicKey), kid: 'recipe-local-test' };
  const mf = new Miniflare({
    modules: true,
    scriptPath: fileURLToPath(new URL('./integration-worker.mjs', import.meta.url)),
    modulesRoot: fileURLToPath(new URL('.', import.meta.url)),
    compatibilityDate: '2026-07-30',
    host: '127.0.0.1',
    port,
    cf: false,
    ...(withDatabase && { d1Databases: { DB: 'synthetic-recipe-integration' } }),
    bindings: {
      ...(enabled && { RECIPE_WORKER_MODE: 'synthetic-local' }),
      RECIPE_QA_PUBLIC_JWK: JSON.stringify(publicJwk),
    },
  });
  async function token(subject, claims = {}, header = {}, signingKey = keys.privateKey) {
    const encode = obj => Buffer.from(JSON.stringify(obj)).toString('base64url');
    const message = `${encode({ alg: 'ES256', kid: publicJwk.kid, ...header })}.${encode({
      iss: 'https://recipe-auth.invalid/auth/v1',
      aud: 'authenticated', role: 'authenticated', sub: subject,
      exp: Math.floor(Date.now() / 1000) + 600, ...claims,
    })}`;
    const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, signingKey, new TextEncoder().encode(message));
    return `${message}.${Buffer.from(signature).toString('base64url')}`;
  }
  const start = withDatabase ? await initialize(mf) : { mf };
  return { ...start, token };
}

export const signedClient = (mf, token, accountId = alice, origin = 'http://127.0.0.1:8787') =>
  (method, path = '/api/recipes', body) => mf.dispatchFetch(`${origin}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${token}`,
      'X-Recipe-QA-Expected-Account': accountId,
      ...(body !== undefined && { 'content-type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

async function initialize(mf) {
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
