import { createWorkerAuthenticator } from '../recipe-d1-local/core-worker-auth.mjs';
import { canonicalPayloadJson, hashCanonicalPayload } from '../../frontend/src/lib/localDatabase/canonicalPayload.ts';
import {
  canonicalWorkoutUuid, workoutRequestDigest, WORKOUT_DIGEST, WORKOUT_REMOTE_DOMAIN,
  WORKOUT_SAFE_SCOPE, WORKOUT_WIRE_UUID,
} from '../../frontend/src/lib/workoutRemoteContract.ts';
import { validateWorkoutSessionV1 } from '../../frontend/src/lib/workoutSessionV1.ts';

const origin = 'http://127.0.0.1:8789';
const project = 'health-worker-transport-fixture-v1';
const issuer = 'https://health-worker-transport-fixture.invalid/auth/v1';
const basePath = '/api/sync/v2';
const domain = WORKOUT_REMOTE_DOMAIN;
const maxBodyBytes = 256 * 1024;
// A short page advances by the last included sequence, not by the requested limit.
// At most 16 × 128 KiB of canonical workout JSON can be read per page.
const pageCap = 16;
const identityKeys = ['namespaceKey', 'generationId', 'deviceId'];
const bindingKeys = [...identityKeys, 'bindingId', 'authorityEpoch'];
const mutationKeys = [
  'protocolVersion', ...bindingKeys, 'domain', 'entityId', 'mutationId', 'idempotencyKey',
  'operation', 'remoteCasBaseRevision', 'localRevision', 'payload', 'payloadHash', 'requestDigest',
];
const routes = new Set(['GET /workouts/authority', 'POST /generations', 'POST /workouts/mutations', 'GET /workouts/changes']);

const json = (body, status = 200, results = []) => Response.json(body, {
  status, headers: {
    'cache-control': 'no-store',
    ...(results.length && { 'x-absinthe-qa-d1': JSON.stringify({
      statements: results.length,
      rowsRead: results.reduce((n, result) => n + result.meta.rows_read, 0),
      rowsWritten: results.reduce((n, result) => n + result.meta.rows_written, 0),
    }) }),
  },
});
const reject = (code, results, push = false, status = 409) => json({
  ...(push ? { outcome: 'rejected' } : { status: 'rejected' }), errorCode: code,
}, status, results);
const matches = (pattern, value) => typeof value === 'string' && pattern.test(value);
const exact = (value, required, optional = []) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && required.every(key => Object.hasOwn(value, key))
  && Object.keys(value).every(key => required.includes(key) || optional.includes(key));
const safe = (value, min) => Number.isSafeInteger(value) && value >= min && !Object.is(value, -0);
const queryInt = value => matches(/^(?:0|[1-9][0-9]*)$/, value) ? Number(value) : NaN;
function validCreatedAt(value) {
  if (typeof value !== 'string' || value.length > 40) return false;
  const parts = /^(\d{4})-(\d\d)-(\d\d)T([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/.exec(value);
  if (!parts) return false;
  const [year, month, day] = parts.slice(1, 4).map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  return year > 0 && month >= 1 && month <= 12 && day >= 1
    && day <= [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][month - 1];
}

async function body(request) {
  if (!request.body || request.headers.get('content-type')?.split(';', 1)[0].trim() !== 'application/json') {
    throw new Error('Invalid body');
  }
  const reader = request.body.getReader();
  const bytes = new Uint8Array(maxBodyBytes);
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (value.length > bytes.length - size) {
        await reader.cancel();
        throw new Error('Body too large');
      }
      bytes.set(value, size);
      size += value.length;
    }
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes.subarray(0, size)), (_key, value, context) => {
      // The server contract is strict integer JSON, not a coercion of fractional or exponent spellings.
      if (typeof value === 'number' && !/^(?:0|[1-9][0-9]*)$/.test(context?.source ?? '')) throw new Error('Invalid number');
      if (typeof value === 'string' && !value.isWellFormed()) throw new Error('Invalid Unicode');
      return value;
    });
  } finally { reader.releaseLock(); }
}

function query(url, required, optional = []) {
  const params = Object.fromEntries(url.searchParams);
  return exact(params, required, optional) && [...url.searchParams].length === Object.keys(params).length ? params : null;
}

function identity(owner, input, bound = false) {
  if (!input || !matches(WORKOUT_DIGEST, input.namespaceKey) || !matches(WORKOUT_SAFE_SCOPE, input.generationId)
    || !matches(WORKOUT_SAFE_SCOPE, input.deviceId)
    || bound && (!matches(WORKOUT_WIRE_UUID, input.bindingId) || !safe(input.authorityEpoch, 1))) return null;
  return [owner, project, input.namespaceKey, input.generationId, input.deviceId,
    ...(bound ? [input.bindingId, input.authorityEpoch] : [])];
}

// Trusted project and JWT owner are always parameters 2 and 1. The request
// cannot select either. Device, generation and binding lookups are exact.
const authorityJoin = `FROM workout_authority a LEFT JOIN workout_bindings b
  ON b.owner = a.owner AND b.project = a.project AND b.namespace = ?3
  AND b.generation = ?4 AND b.device = ?5 AND b.epoch = a.epoch AND b.is_active = 1`;
const authorityKey = 'WHERE a.owner = ?1 AND a.project = ?2';
const scope = `${authorityJoin} ${authorityKey}`;
const current = 'a.is_open = 1 AND a.epoch = ?7 AND b.binding = ?6';
const context = `SELECT a.epoch, a.server_epoch, a.is_open, b.binding ${scope}`;
// With no reset/rollover/pruning, the immutable first event anchors the
// entire stream. Its indexed head proves continuity without scanning a tail.
const continuous = `COALESCE((
  SELECT c.epoch = a.epoch AND c.server_epoch = a.server_epoch
    FROM workout_changes c
    WHERE c.owner = a.owner AND c.project = a.project ORDER BY c.sequence LIMIT 1
), 1)`;
const stmt = (db, sql, values) => db.prepare(sql).bind(...values);

function admission(row, requested) {
  if (!row || row.is_open !== 1) return 'CAPABILITY_DISABLED';
  if (requested && row.epoch !== requested.authorityEpoch) return 'STALE_AUTHORITY_EPOCH';
  if (!row.binding || requested && row.binding !== requested.bindingId) return 'STALE_GENERATION_BINDING';
  return null;
}

async function discover(db, owner, request, url, route) {
  const shared = route === 'POST /generations';
  let input;
  if (shared) {
    try { input = await body(request); } catch { /* Invalid generation below. */ }
    if (!exact(input, [...identityKeys, 'accountId', 'domains', 'protocolVersion']) || input.protocolVersion !== 2
      || !Array.isArray(input.domains) || input.domains.length !== 2
      || input.domains[0] !== 'health_routine_preset' || input.domains[1] !== 'health_routine_profile') input = null;
    if (input && input.accountId !== owner) return json({ detail: 'Unauthorized' }, 403);
  } else input = query(url, identityKeys);
  const values = identity(owner, input);
  if (!values) return json({ detail: 'INVALID_GENERATION' }, 400);
  const result = await stmt(db, context, values).all();
  const row = result.results[0];
  const denied = admission(row);
  if (denied) return reject(denied, [result]);
  // This use of the shared route only confirms an out-of-band seeded generation.
  // Neither control route can register a generation or grant authority.
  return json(shared ? {
    protocolVersion: 2, status: 'active', namespaceKey: input.namespaceKey,
    generationId: input.generationId, deviceId: input.deviceId, serverEpoch: row.server_epoch,
  } : {
    protocolVersion: 2, domain, projectScope: project, capability: 'FOUNDATION_READY', authorityState: 'OPEN',
    authorityEpoch: row.epoch, bindingState: 'bound', bindingId: row.binding, serverEpoch: row.server_epoch, errorCode: null,
  }, 200, [result]);
}

async function push(db, owner, request) {
  let input, values, computed;
  try {
    input = await body(request);
    if (!exact(input, mutationKeys, ['createdAt']) || input.protocolVersion !== 2 || input.domain !== domain
      || input.createdAt != null && !validCreatedAt(input.createdAt)
      || typeof input.mutationId !== 'string' || typeof input.idempotencyKey !== 'string'
      || !(values = identity(owner, input, true))) throw new Error('Invalid request');
    if (input.operation !== 'upsert') {
      return reject('UNSUPPORTED_OPERATION', [], true, 400);
    }
    if (!exact(input.payload, ['kind', 'record']) || input.payload.kind !== 'entity_snapshot') throw new Error('Invalid payload');
    validateWorkoutSessionV1(input.payload.record);
    if (canonicalWorkoutUuid(input.payload.record.id) !== input.entityId
      || !matches(WORKOUT_DIGEST, input.requestDigest)
      || input.payloadHash !== hashCanonicalPayload(input.payload)) throw new Error('Invalid payload');
    computed = workoutRequestDigest({
      ...input, authenticatedOwnerId: owner, projectScope: project,
      generationBindingId: input.bindingId, wireEntityId: input.entityId,
    });
  } catch { return json({ detail: 'INVALID_PAYLOAD' }, 400); }
  if (computed !== input.requestDigest) return reject('REQUEST_DIGEST_MISMATCH', [], true, 400);
  const ref = crypto.randomUUID();
  const base = input.remoteCasBaseRevision;
  // D1 serializes the guarded append and its trigger with receipt readback in
  // one batch. A replay never reaches the append, even if its CAS is now stale.
  const dbResults = await db.batch([
    stmt(db, `INSERT INTO workout_changes
      (owner, project, entity, mutation, idempotency, payload_hash, digest, record, content_hash, remote_ref, committed_at,
        epoch, server_epoch, binding, revision, sequence)
      SELECT ?1, ?2, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?7, a.server_epoch, ?6,
        COALESCE(head.revision, 0) + 1,
        COALESCE((SELECT MAX(sequence) FROM workout_changes WHERE owner = ?1 AND project = ?2), 0) + 1
      ${authorityJoin} LEFT JOIN workout_entities head
        ON head.owner = a.owner AND head.project = a.project AND head.entity = ?8
      ${authorityKey} AND ${current}
      AND ${continuous}
      AND NOT EXISTS (SELECT 1 FROM workout_receipts WHERE owner = ?1 AND project = ?2 AND mutation = ?9)
      AND NOT EXISTS (SELECT 1 FROM workout_receipts WHERE owner = ?1 AND project = ?2 AND idempotency = ?10)
      AND head.revision IS ?17 AND (?17 IS NULL OR ?17 < 9007199254740991)`,
    [...values, input.entityId, input.mutationId, input.idempotencyKey, input.payloadHash, computed,
      canonicalPayloadJson(input.payload.record), hashCanonicalPayload(input.payload.record), ref, new Date().toISOString(), base]),
    stmt(db, `SELECT a.epoch, a.server_epoch, a.is_open, b.binding, r.idempotency, r.sequence,
      CASE WHEN ${current} THEN ${continuous} ELSE 0 END AS stream_current,
      e.entity, e.remote_ref, e.committed_at, e.revision, e.content_hash, e.payload_hash, e.digest,
      e.epoch AS receipt_epoch, e.server_epoch AS receipt_server_epoch, e.binding AS receipt_binding, i.mutation AS idem_hit,
      head.revision AS existing_revision, existing.content_hash AS existing_hash, existing.remote_ref AS existing_ref
      ${authorityJoin}
      LEFT JOIN workout_receipts r ON r.owner = a.owner AND r.project = a.project AND r.mutation = ?9 AND ${current}
      LEFT JOIN workout_changes e ON e.owner = r.owner AND e.project = r.project AND e.sequence = r.sequence
      LEFT JOIN workout_receipts i ON i.owner = a.owner AND i.project = a.project AND i.idempotency = ?10 AND ${current}
      LEFT JOIN workout_entities head ON head.owner = a.owner AND head.project = a.project
        AND head.entity = ?8 AND ${current} AND r.sequence IS NULL AND i.mutation IS NULL
      LEFT JOIN workout_changes existing ON existing.owner = head.owner AND existing.project = head.project
        AND existing.sequence = head.sequence
      ${authorityKey}`, [...values, input.entityId, input.mutationId, input.idempotencyKey]),
  ]);
  const row = dbResults[1].results[0];
  const denied = admission(row, input);
  if (denied) return reject(denied, dbResults, true);
  if (row.stream_current !== 1) return reject('AUTHORITY_EVIDENCE_MISSING', dbResults, true);
  if (row.sequence != null) {
    if (row.receipt_server_epoch !== row.server_epoch) return reject('AUTHORITY_EVIDENCE_MISSING', dbResults, true);
    if (row.entity !== input.entityId || row.digest !== computed || row.idempotency !== input.idempotencyKey
      || row.payload_hash !== input.payloadHash || row.receipt_binding !== input.bindingId || row.receipt_epoch !== input.authorityEpoch) {
      return reject('MUTATION_ID_CONFLICT', dbResults, true);
    }
    return json({
      protocolVersion: 2, outcome: row.remote_ref === ref ? 'success' : 'exact_replay', errorCode: null,
      domain, operation: 'upsert', entityId: row.entity, mutationId: input.mutationId, idempotencyKey: row.idempotency,
      payloadHash: row.payload_hash, contentHash: row.content_hash, authorityEpoch: row.receipt_epoch, bindingId: row.receipt_binding,
      remoteMutationRef: row.remote_ref, serverCommittedAt: row.committed_at, serverRevision: row.revision, changeSequence: row.sequence,
    }, 200, dbResults);
  }
  if (row.idem_hit != null) return reject('IDEMPOTENCY_CONFLICT', dbResults, true);
  if (row.existing_ref != null) return json({
    outcome: 'rejected', errorCode: base === null ? 'ENTITY_ALREADY_EXISTS' : 'CAS_CONFLICT', currentIsDeleted: false,
    currentServerRevision: row.existing_revision, currentContentHash: row.existing_hash, currentRemoteMutationRef: row.existing_ref,
  }, 409, dbResults);
  if (base !== null && row.existing_revision === null) return reject('NOT_FOUND', dbResults, true);
  throw new Error('Unproven commit');
}

async function pull(db, owner, url) {
  const input = query(url, bindingKeys, ['cursor', 'limit', 'serverEpoch']);
  if (!input) return json({ detail: 'INVALID_PULL' }, 400);
  input.authorityEpoch = queryInt(input.authorityEpoch);
  const values = identity(owner, input, true);
  const cursor = queryInt(input.cursor ?? '0');
  const limit = queryInt(input.limit ?? '100');
  if (!values || !safe(cursor, 0) || !safe(limit, 1) || limit > 500
    || input.serverEpoch !== undefined && !matches(WORKOUT_WIRE_UUID, input.serverEpoch)) {
    return json({ detail: 'INVALID_PULL' }, 400);
  }
  const dbResults = await db.batch([
    stmt(db, `SELECT a.epoch, a.server_epoch, a.is_open, b.binding,
      CASE WHEN ${current} AND (?8 IS NULL OR a.server_epoch = ?8) THEN ${continuous} ELSE 0 END AS stream_current
      ${scope}`, [...values, input.serverEpoch ?? null]),
    // Evaluate admission once as the lower bound of the indexed range. Denial
    // seeks beyond every representable sequence instead of filtering its rows.
    stmt(db, `SELECT c.sequence, c.entity, c.revision, c.record, c.content_hash, c.remote_ref, c.committed_at,
      c.epoch, c.server_epoch
      FROM workout_changes c
      WHERE c.owner = ?1 AND c.project = ?2 AND c.sequence > CASE WHEN EXISTS
        (SELECT 1 ${scope} AND ${current} AND (?10 IS NULL OR a.server_epoch = ?10) AND ${continuous})
        THEN ?8 ELSE 9007199254740991 END
      ORDER BY c.sequence LIMIT ?9`, [...values, cursor, Math.min(limit, pageCap), input.serverEpoch ?? null]),
  ]);
  const row = dbResults[0].results[0];
  const denied = admission(row, input);
  if (denied) return reject(denied, dbResults);
  const serverEpoch = row.server_epoch;
  if (input.serverEpoch != null && input.serverEpoch !== serverEpoch) return json({
    protocolVersion: 2, status: 'full_resync_required', errorCode: 'SERVER_EPOCH_MISMATCH',
    serverEpoch, retentionFloor: 0, nextCursor: 0, changes: [],
  }, 200, dbResults);
  // This fixture has no reset or stream rollover implementation. A read must
  // never relabel an older event into the current authority lifetime.
  if (row.stream_current !== 1 || dbResults[1].results.some(event => event.epoch !== row.epoch || event.server_epoch !== serverEpoch)) {
    return reject('AUTHORITY_EVIDENCE_MISSING', dbResults);
  }
  const changes = dbResults[1].results.map(event => ({
    sequence: event.sequence, domain, entityId: event.entity, operation: 'upsert', serverRevision: event.revision,
    record: JSON.parse(event.record), contentHash: event.content_hash, remoteMutationRef: event.remote_ref,
    serverCommittedAt: event.committed_at, isDeleted: false, deletedAt: null, authorityEpoch: row.epoch, serverEpoch,
  }));
  return json({
    protocolVersion: 2, status: 'changes', domain, authorityEpoch: row.epoch, serverEpoch, retentionFloor: 0,
    nextCursor: changes.at(-1)?.sequence ?? cursor, changes, errorCode: null,
  }, 200, dbResults);
}

// No production binding, hosted route, or outbound JWKS fetch. Credentials and
// authority are independently supplied by the isolated fixture, not the request.
let authenticator;
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname.slice(basePath.length);
    const route = request.method + ' ' + path;
    if (env.HEALTH_TRANSPORT_MODE !== 'synthetic-local' || url.origin !== origin
      || !url.pathname.startsWith(basePath + '/') || !routes.has(route)) return json({ detail: 'Not found' }, 404);
    try {
      if (!authenticator) {
        const fixtureKeys = env.HEALTH_TRANSPORT_FIXTURE_JWKS;
        authenticator = createWorkerAuthenticator({ issuer, algorithm: 'ES256', fetchJwks: () => new Response(fixtureKeys) });
      }
      const auth = await authenticator(request);
      if (auth.status !== 200) return json({ detail: auth.status === 401 ? 'Unauthorized' : 'Verification unavailable' }, auth.status);
      if (path === '/workouts/mutations') return await push(env.HEALTH_TRANSPORT_DB, auth.accountId, request);
      if (path === '/workouts/changes') return await pull(env.HEALTH_TRANSPORT_DB, auth.accountId, url);
      return await discover(env.HEALTH_TRANSPORT_DB, auth.accountId, request, url, route);
    } catch { return json({ detail: 'Workout transport unavailable' }, 503); }
  },
};
