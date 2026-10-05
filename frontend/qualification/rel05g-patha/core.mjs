// Standalone synthetic qualification only. No product capabilities are accepted.
export const PROTOCOL = 'rel05g-patha-human-v1';
export const PREFIX = 'rel05g-patha-qual:v1:';
export const ROLES = Object.freeze(['OLD_FIXTURE', 'CURRENT_FIXTURE', 'NEUTRAL_FIXTURE']);
export const DENIED_KEYS = Object.freeze([
  'absinthe-health-routine-device-id:v1',
  'absinthe-workout-device-authority:v1',
  'absinthe-workout-device-adoption:v1',
]);
const ID = /^[a-zA-Z0-9_-]{1,64}$/;
const INSTANCE = /^[a-f0-9-]{36}$/;
const TOKEN = /^qual-[a-f0-9-]{36}$/;
const EVENTS = new Set(['START', 'ACTION', 'STORAGE_WRITE', 'STORAGE_READ', 'LOCK_REQUEST',
  'LOCK_ACQUIRED', 'LOCK_RELEASED', 'LOCK_ABORTED', 'visibilitychange', 'pagehide',
  'pageshow', 'NAVIGATION', 'EXPORT', 'ERROR', 'CLEANUP']);
const PAYLOAD = new Set(['operation', 'token', 'key', 'lock', 'persisted', 'navigationType',
  'code', 'reason', 'budgetMs', 'previousInstanceCount', 'status']);
function assertPayload(payload, runId) {
  if (!payload || Array.isArray(payload) || typeof payload !== 'object') throw new Error('PAYLOAD_NOT_ALLOWLISTED');
  for (const [key, value] of Object.entries(payload)) {
    if (!PAYLOAD.has(key) || (value !== null && !['string', 'number', 'boolean'].includes(typeof value))) {
      throw new Error('PAYLOAD_NOT_ALLOWLISTED');
    }
    if (key === 'token' && value !== null && !TOKEN.test(value)) throw new Error('NON_SYNTHETIC_PAYLOAD');
    if (['operation', 'code', 'reason', 'status'].includes(key) && !/^[A-Z0-9_]{1,80}$/.test(value)) {
      throw new Error('NON_SYNTHETIC_PAYLOAD');
    }
    if (key === 'key' && value !== keyFor(runId, 'scope-token')) throw new Error('NON_SYNTHETIC_PAYLOAD');
    if (key === 'lock' && value !== lockFor(runId)) throw new Error('NON_SYNTHETIC_PAYLOAD');
    if (key === 'navigationType' && !['navigate', 'reload', 'back_forward', 'UNKNOWN'].includes(value)) throw new Error('NON_SYNTHETIC_PAYLOAD');
    if (key === 'persisted' && typeof value !== 'boolean') throw new Error('NON_SYNTHETIC_PAYLOAD');
    if (['budgetMs', 'previousInstanceCount'].includes(key) && (!Number.isFinite(value) || value < 0)) throw new Error('NON_SYNTHETIC_PAYLOAD');
  }
}

export function identifier(value) {
  if (typeof value !== 'string' || !ID.test(value)) throw new Error('INVALID_SYNTHETIC_ID');
  return value;
}
export function keyFor(runId, suffix) {
  identifier(runId);
  if (!['scope-token', 'synthetic-identity', 'launch-history'].includes(suffix)
    && !/^event-log:[a-f0-9-]{36}$/.test(suffix)) throw new Error('KEY_NOT_ALLOWLISTED');
  return `${PREFIX}${runId}:${suffix}`;
}
export const lockFor = (runId) => `${PREFIX}${identifier(runId)}:scope-lock`;
export function assertOrigin(origin) {
  const url = new URL(origin);
  const local = url.origin === 'http://127.0.0.1:4189' || url.origin === 'http://localhost:4189';
  const hosted = url.protocol === 'https:' && url.port === ''
    && (url.hostname === 'rel05g-patha-qual.vercel.app'
      || url.hostname === 'rel05g-patha-qual-dhlee6785-9668s-projects.vercel.app'
      || /^rel05g-patha-qual-[a-z0-9]{9}-dhlee6785-9668s-projects\.vercel\.app$/.test(url.hostname));
  if (!local && !hosted) throw new Error('ORIGIN_NOT_ALLOWLISTED');
  return url.origin;
}

export function assertManifest(manifest, loadedArtifact) {
  const closed = (value, fields) => value !== null && typeof value === 'object' && !Array.isArray(value)
    && Object.keys(value).length === fields.length && fields.every((key) => Object.hasOwn(value, key));
  const sha256 = (value) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
  const { buildId, sourceGitSha, protocolVersion, role, manifestPath } = loadedArtifact;
  if (!sha256(buildId) || typeof sourceGitSha !== 'string' || !/^[a-f0-9]{40}$/.test(sourceGitSha)
    || protocolVersion !== PROTOCOL || !ROLES.includes(role)
    || manifestPath !== `/${buildId}/artifact-manifest.json`
    || !closed(manifest, ['schemaVersion', 'buildId', 'sourceGitSha', 'protocolVersion', 'qualificationOnly', 'roles', 'assets'])
    || manifest.schemaVersion !== 'rel05g-patha-artifacts-v1' || manifest.qualificationOnly !== true
    || manifest.buildId !== buildId || manifest.sourceGitSha !== sourceGitSha || manifest.protocolVersion !== PROTOCOL
    || !Array.isArray(manifest.roles) || manifest.roles.length !== ROLES.length
    || !ROLES.every((value, index) => manifest.roles[index] === value)) throw new Error('MANIFEST_MISMATCH');
  // Independent closed inventory, not inferred from untrusted manifest.assets.
  // Exact spelling rejects traversal, encoding, query and other path aliases.
  const expected = new Map(['core.mjs', 'ui.mjs', 'style.css', 'icon.svg']
    .map((name) => [`/${buildId}/${name}`, 'SHARED']));
  for (const name of ['old', 'current', 'neutral']) {
    for (const file of ['boot.mjs', 'index.html', 'manifest.webmanifest']) {
      expected.set(`/${buildId}/${name}/${file}`, name.toUpperCase());
    }
  }
  if (!Array.isArray(manifest.assets) || manifest.assets.length !== expected.size) throw new Error('INVALID_ASSET_INVENTORY');
  const seen = new Set();
  for (const asset of manifest.assets) {
    if (!closed(asset, ['path', 'size', 'sha256', 'buildId', 'sourceGitSha', 'protocolVersion', 'role'])
      || typeof asset.path !== 'string' || !expected.has(asset.path) || seen.has(asset.path)
      || !Number.isSafeInteger(asset.size) || asset.size <= 0 || !sha256(asset.sha256)
      || asset.buildId !== buildId || asset.sourceGitSha !== sourceGitSha || asset.protocolVersion !== PROTOCOL
      || asset.role !== expected.get(asset.path)) throw new Error('INVALID_ASSET_INVENTORY');
    seen.add(asset.path);
  }
}
export function storageFor(raw, runId) {
  // No arbitrary full-key entry point, key enumeration, or clear API.
  return Object.freeze({
    read: (suffix) => raw.getItem(keyFor(runId, suffix)),
    write: (suffix, value) => raw.setItem(keyFor(runId, suffix), value),
    remove: (suffix) => raw.removeItem(keyFor(runId, suffix)),
  });
}
export function navigationPayload(type, persisted = null) {
  return { navigationType: ['navigate', 'reload', 'back_forward'].includes(type) ? type : 'UNKNOWN',
    ...(typeof persisted === 'boolean' ? { persisted } : {}) };
}
export const stableJSON = (value) => JSON.stringify(value, function (_key, entry) {
  if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
    return Object.fromEntries(Object.keys(entry).sort().map((key) => [key, entry[key]]));
  }
  return entry;
}, 2);

export class Fixture {
  #ports; #storage; #events = []; #sequence = 0; #closed = false; #request = null;
  #release = null; #controller = null; #timer = null; #history = [];
  constructor({ runId, testId, role, provenance }, ports) {
    this.runId = identifier(runId); this.testId = identifier(testId);
    if (!ROLES.includes(role)) throw new Error('INVALID_ROLE');
    this.role = role; this.origin = assertOrigin(ports.origin);
    if (ports.workerControlled || ports.workerRegistered) throw new Error('WORKER_PRESENT');
    this.instanceId = ports.documentInstanceId ?? ports.uuid();
    if (!INSTANCE.test(this.instanceId)) throw new Error('INVALID_INSTANCE');
    if (provenance.protocolVersion !== PROTOCOL || provenance.role !== role
      || !/^[a-f0-9]{40}$/.test(provenance.sourceGitSha)
      || !/^[a-f0-9]{64}$/.test(provenance.buildId)
      || !/^[a-f0-9]{64}$/.test(provenance.manifestSha256)
      || provenance.manifestPath !== `/${provenance.buildId}/artifact-manifest.json`) throw new Error('INVALID_PROVENANCE');
    // Closed shape: caller-supplied secret fields cannot become exported provenance.
    this.provenance = Object.freeze(Object.fromEntries(['protocolVersion', 'role', 'sourceGitSha',
      'buildId', 'manifestSha256', 'manifestPath'].map((key) => [key, provenance[key]])));
    this.#ports = ports; this.#storage = storageFor(ports.storage, runId);
    this.lockStatus = 'IDLE'; this.flushStatus = 'NOT_FLUSHED'; this.lastError = null;
    this.capabilities = Object.freeze({ secureContext: ports.secureContext === true,
      webLocks: ports.locksAvailable === true || typeof ports.locks?.request === 'function', indexedDB: 'OMITTED_OPTIONAL',
      workerControlled: false, workerRegistered: false, displayMode:
        ports.displayMode === 'standalone-observed' ? 'standalone-observed' : 'browser-or-other' });
    try {
      const previous = this.#storage.read('launch-history');
      this.#history = previous === null ? [] : JSON.parse(previous);
      if (!Array.isArray(this.#history) || this.#history.length >= 500
        || this.#history.some((id) => typeof id !== 'string' || !INSTANCE.test(id))) {
        throw new Error('INVALID_HISTORY');
      }
      if (this.#history.includes(this.instanceId)) throw new Error('INSTANCE_REUSED');
      this.previousInstances = [...this.#history];
      this.#history.push(this.instanceId);
      this.#storage.write('launch-history', JSON.stringify(this.#history));
    } catch { throw new Error('HISTORY_UNAVAILABLE_OR_INVALID'); }
    this.record('START', { previousInstanceCount: this.previousInstances.length });
    this.record('NAVIGATION', navigationPayload(ports.navigationType));
  }
  record(type, payload = {}, actionId = 'system') {
    if (this.#closed) return;
    if (!EVENTS.has(type)) throw new Error('EVENT_NOT_ALLOWLISTED');
    identifier(actionId);
    assertPayload(payload, this.runId);
    this.#events.push({ schemaVersion: 1, runId: this.runId, testId: this.testId, actionId,
      role: this.role, buildId: this.provenance.buildId, instanceId: this.instanceId,
      protocolVersion: PROTOCOL, sequence: ++this.#sequence, wallTimeMs: this.#ports.wall(),
      timeOriginMs: this.#ports.timeOrigin, monotonicMs: this.#ports.now(),
      visibility: this.#ports.visibility(), type, payload: { ...payload } });
    try {
      this.#storage.write(`event-log:${this.instanceId}`, JSON.stringify(this.#events));
      this.flushStatus = `FLUSHED_THROUGH_${this.#sequence}`;
    } catch {
      // Keep the failed event in memory; no recursive logging on Storage failure.
      this.flushStatus = `FAILED_AT_${this.#sequence}`; this.lastError = 'LOG_FLUSH_FAILED';
    }
    this.#ports.changed?.();
  }
  action(actionId, operation) { this.record('ACTION', { operation }, identifier(actionId)); }
  error(code, actionId = 'system') {
    this.lastError = code; this.record('ERROR', { code }, actionId);
  }
  writeToken(actionId) {
    if (this.#closed) throw new Error('RUN_CLOSED');
    this.action(actionId, this.role === 'OLD_FIXTURE' ? 'NONCOOPERATING_RAW_WRITE' : 'WRITE_TOKEN');
    const token = `qual-${this.#ports.uuid()}`;
    if (!TOKEN.test(token)) throw new Error('INVALID_TOKEN');
    try {
      this.#storage.write('scope-token', token);
      this.record('STORAGE_WRITE', { key: keyFor(this.runId, 'scope-token'), token }, actionId);
      const ownRead = this.readToken(actionId);
      if (ownRead !== token) { this.error('OWN_READ_MISMATCH', actionId); throw new Error('OWN_READ_MISMATCH'); }
      return token;
    } catch { this.error('TOKEN_WRITE_OR_CONTROL_FAILED', actionId); throw new Error('TOKEN_WRITE_OR_CONTROL_FAILED'); }
  }
  readToken(actionId) {
    if (this.#closed) throw new Error('RUN_CLOSED');
    this.action(actionId, 'READ_TOKEN');
    try {
      const token = this.#storage.read('scope-token');
      // Refuse to log arbitrary/personal injected contents even on the test key.
      if (token !== null && !TOKEN.test(token)) throw new Error('NON_SYNTHETIC_TOKEN');
      this.record('STORAGE_READ', { key: keyFor(this.runId, 'scope-token'), token }, actionId);
      return token;
    } catch { this.error('TOKEN_READ_FAILED', actionId); throw new Error('TOKEN_READ_FAILED'); }
  }
  clearToken(actionId) {
    if (this.#closed) throw new Error('RUN_CLOSED');
    this.action(actionId, 'REMOVE_EXACT_TOKEN');
    this.#storage.remove('scope-token');
  }
  requestLock(actionId) {
    if (this.role !== 'CURRENT_FIXTURE') throw new Error('ROLE_CANNOT_REQUEST_LOCK');
    if (this.#closed || this.#request) throw new Error('LOCK_TRIAL_NOT_IDLE');
    if (!this.capabilities.secureContext || typeof this.#ports.locks?.request !== 'function') throw new Error('LOCK_UNAVAILABLE');
    this.action(actionId, 'REQUEST_TEST_LOCK');
    this.#controller = new AbortController(); this.lockStatus = 'REQUESTED';
    this.record('LOCK_REQUEST', { lock: lockFor(this.runId), budgetMs: 60000 }, actionId);
    this.#timer = this.#ports.setTimer(() => this.releaseLock('timer', 'SAFETY_TIMER_TRIAL_END'), 60000);
    this.#request = Promise.resolve().then(() => this.#ports.locks.request(lockFor(this.runId),
      { mode: 'exclusive', signal: this.#controller.signal }, async () => {
        this.lockStatus = 'HELD';
        const held = new Promise((resolve) => { this.#release = resolve; });
        this.record('LOCK_ACQUIRED', { lock: lockFor(this.runId) }, actionId);
        await held;
      })).then(() => {
        this.lockStatus = 'IDLE';
        this.record('LOCK_RELEASED', { lock: lockFor(this.runId), status: 'CALLBACK_COMPLETED' }, actionId);
      }, () => {
        this.lockStatus = 'IDLE';
        this.record('LOCK_ABORTED', { lock: lockFor(this.runId), reason: 'ABORT_OR_API_ERROR' }, actionId);
      }).finally(() => {
        this.#ports.clearTimer(this.#timer); this.#timer = null; this.#request = null;
        this.#controller = null; this.#release = null;
      });
    return this.#request;
  }
  releaseLock(actionId, reason = 'MANUAL_RELEASE_OR_CANCEL') {
    this.action(actionId, reason);
    if (this.#release) { this.lockStatus = 'RELEASING'; this.#release(); }
    else if (this.#controller) this.#controller.abort();
    return this.#request ?? Promise.resolve();
  }
  lifecycle(type, persisted, navigationType) {
    if (!['visibilitychange', 'pagehide', 'pageshow'].includes(type)) throw new Error('INVALID_LIFECYCLE');
    // No new ID on BFCache return and no inference from pagehide eligibility.
    this.record(type, navigationPayload(navigationType, persisted));
  }
  export(actionId) {
    const token = this.#closed ? null : this.readToken(actionId);
    this.action(actionId, 'EXPORT_OWN_INSTANCE'); this.record('EXPORT', {}, actionId);
    return stableJSON({ schemaVersion: 'rel05g-patha-fixture-export-v1', qualificationOnly: true,
      protocolVersion: PROTOCOL, runId: this.runId, testId: this.testId, role: this.role,
      instanceId: this.instanceId, origin: this.origin, artifact: this.provenance,
      capabilities: this.capabilities, previousInstances: this.previousInstances,
      flushStatus: this.flushStatus, lockStatus: this.lockStatus, currentStorage: { token }, error: this.lastError,
      events: this.#events, limits: ['CURRENT_REALM_PROVENANCE_NOT_ATTESTATION',
        'MISSING_OR_UNFLUSHED_TAIL_UNKNOWN', 'LOGGER_CAN_AFFECT_BFCACHE',
        'NO_CROSS_INSTANCE_CLOCK_CAUSALITY', 'NO_RETIREMENT_OR_ADMISSION_CLAIM'],
      physicalResult: 'NOT_EXECUTED', restoreClass: 'UNKNOWN' });
  }
  eventView() { return JSON.parse(JSON.stringify(this.#events)); }
  previousLog(instanceId) {
    if (!this.previousInstances.includes(instanceId)) throw new Error('UNKNOWN_PREVIOUS_INSTANCE');
    // Download retained raw bytes, not parsed into the current instance event stream.
    const raw = this.#storage.read(`event-log:${instanceId}`);
    if (raw === null) return null;
    const events = JSON.parse(raw);
    const fields = ['schemaVersion', 'runId', 'testId', 'actionId', 'role', 'buildId', 'instanceId',
      'protocolVersion', 'sequence', 'wallTimeMs', 'timeOriginMs', 'monotonicMs', 'visibility', 'type', 'payload'];
    if (!Array.isArray(events) || !events.length) throw new Error('INVALID_RETAINED_LOG');
    for (const [index, event] of events.entries()) {
      if (!event || Object.keys(event).length !== fields.length || fields.some((key) => !(key in event))
        || event.schemaVersion !== 1 || event.runId !== this.runId || event.instanceId !== instanceId
        || event.protocolVersion !== PROTOCOL || event.sequence !== index + 1
        || !ROLES.includes(event.role) || !/^[a-f0-9]{64}$/.test(event.buildId)
        || !EVENTS.has(event.type) || !['visible', 'hidden'].includes(event.visibility)
        || ['wallTimeMs', 'timeOriginMs', 'monotonicMs'].some((key) => !Number.isFinite(event[key]))) {
        throw new Error('INVALID_RETAINED_LOG');
      }
      identifier(event.testId); identifier(event.actionId); assertPayload(event.payload, this.runId);
    }
    return raw;
  }
  async cleanup(actionId) {
    await this.releaseLock(actionId, 'CLEANUP_RELEASE');
    this.record('CLEANUP', { operation: 'REMOVE_KNOWN_EXACT_RUN_KEYS' }, actionId);
    for (const id of this.#history) this.#storage.remove(`event-log:${id}`);
    for (const suffix of ['scope-token', 'synthetic-identity', 'launch-history']) this.#storage.remove(suffix);
    this.#closed = true; this.flushStatus = 'RUN_CLOSED_AFTER_EXACT_CLEANUP';
    this.#ports.changed?.();
  }
}
