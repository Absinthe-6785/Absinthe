import { validateSafeIdentifier } from './localDatabase/namespace';
import { HEALTH_ROUTINE_DEVICE_ID_KEY } from './workoutLocalReaderAuthority';

/** Dormant Slice 1. No production reader/creator is routed through this module. */
export const WORKOUT_DEVICE_AUTHORITY_KEY = 'absinthe-workout-device-authority:v1';
export const WORKOUT_DEVICE_ADOPTION_KEY = 'absinthe-workout-device-adoption:v1';
export const WORKOUT_DEVICE_AUTHORITY_LOCK = WORKOUT_DEVICE_AUTHORITY_KEY;
export const WORKOUT_DEVICE_ADOPTION_VALUE = '{"format":1,"adoption":"started"}';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
// Preserve the existing creator's recovery trigger, not a new namespace-repair trigger.
const LEGACY_HELPER_FORMAT = /^[0-9a-f-]{36}$/i;
const SHA256 = /^[0-9a-f]{64}$/;

export type DeviceAuthorityUnavailableCode =
  | 'STORAGE_UNAVAILABLE' | 'INVALID_MARKER' | 'INVALID_AUTHORITY' | 'NOT_READY'
  | 'MIRROR_MISMATCH' | 'ADMISSION_REQUIRED' | 'INVALID_DEVICE' | 'INVALID_PREPARED_INTENT'
  | 'ENTROPY_UNAVAILABLE' | 'EVIDENCE_UNAVAILABLE' | 'LOCK_UNAVAILABLE' | 'LOCK_FAILED'
  | 'LOCK_CANCELLED' | 'INVALID_LOCK_BUDGET' | 'REVOKED' | 'CALLER_NOT_CURRENT'
  | 'ASYNC_CONSUMER' | 'NESTED_LOCK';

export class WorkoutDeviceAuthorityUnavailable extends Error {
  readonly kind = 'authority_unavailable';
  constructor(readonly code: DeviceAuthorityUnavailableCode) {
    super(`workout_device_authority_${code.toLowerCase()}`);
    this.name = 'WorkoutDeviceAuthorityUnavailable';
  }
}

export type ReadyDeviceAuthority = Readonly<{
  format: 1; phase: 'ready'; deviceId: string; lifetimeId: string;
}>;
export type PreparedDeviceAuthority = Readonly<{
  format: 1; phase: 'transitioning'; deviceId: string; lifetimeId: string;
  transitionKind: 'legacy-adoption' | 'fresh-create' | 'creator-recovery';
  previousLifetimeId: string | null;
  previousMirrorFingerprint: string | null;
}>;
export type DeviceAuthorityRecord = ReadyDeviceAuthority | PreparedDeviceAuthority;
export interface DeviceAuthorityStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export interface DeviceAuthorityLocks {
  request<T>(name: string, options: { mode: 'shared' | 'exclusive'; signal: AbortSignal },
    callback: (lock: Lock | null) => T | Promise<T>): Promise<T>;
}
export interface DeviceAuthorityPorts {
  getStorage: () => DeviceAuthorityStorage | null;
  locks: () => DeviceAuthorityLocks | null;
  randomUUID: () => string;
}
/** Acquisition budget is caller policy, required and finite; no UI timeout here. */
export type DeviceAuthorityLockBudget = Readonly<{ timeoutMs: number; signal?: AbortSignal }>;
/** Caller must establish compatible, quiesced creator contexts; this is not a rollout oracle. */
export type DeviceAuthorityAdmission = Readonly<{
  compatibleCreatorsQuiesced: true;
  role: 'legacy-reader' | 'creator';
}>;
export type DeviceAuthorityToken = Readonly<{
  deviceId: string; lifetimeId: string;
  /** Advisory only. Later publication MUST use withCurrentAuthority, never this boolean. */
  isCurrent: () => boolean;
}>;
type SyncResult<T> = T extends PromiseLike<unknown> ? never : T;

function unavailable(code: DeviceAuthorityUnavailableCode): never {
  throw new WorkoutDeviceAuthorityUnavailable(code);
}
function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length
    && keys.every(key => Object.prototype.hasOwnProperty.call(value, key));
}
function json(raw: string): unknown {
  try { return JSON.parse(raw); } catch { return null; }
}
function validDevice(value: unknown): value is string {
  if (typeof value !== 'string' || !UUID.test(value) || !LEGACY_HELPER_FORMAT.test(value)) return false;
  try { validateSafeIdentifier(value, 'workout_device_authority'); return true; } catch { return false; }
}
export function parseWorkoutDeviceAdoption(raw: string | null): Readonly<{ format: 1; adoption: 'started' }> {
  const value = raw === null ? null : json(raw);
  if (!object(value) || !exactKeys(value, ['format', 'adoption'])
    || value.format !== 1 || value.adoption !== 'started') unavailable('INVALID_MARKER');
  return Object.freeze({ format: 1, adoption: 'started' });
}
export function parseWorkoutDeviceAuthority(raw: string | null): DeviceAuthorityRecord {
  const value = raw === null ? null : json(raw);
  if (!object(value) || value.format !== 1 || !validDevice(value.deviceId)
    || typeof value.lifetimeId !== 'string' || !UUID_V4.test(value.lifetimeId)
    || value.deviceId.toLowerCase() === value.lifetimeId.toLowerCase()) unavailable('INVALID_AUTHORITY');
  const common = { format: 1 as const, deviceId: value.deviceId, lifetimeId: value.lifetimeId };
  if (value.phase === 'ready' && exactKeys(value, ['format', 'phase', 'deviceId', 'lifetimeId'])) {
    return Object.freeze({ ...common, phase: 'ready' });
  }
  if (value.phase !== 'transitioning' || !exactKeys(value, [
    'format', 'phase', 'deviceId', 'lifetimeId', 'transitionKind',
    'previousLifetimeId', 'previousMirrorFingerprint',
  ])) unavailable('INVALID_AUTHORITY');
  const previous = value.previousLifetimeId;
  const fingerprint = value.previousMirrorFingerprint;
  if ((previous !== null && (typeof previous !== 'string' || !UUID_V4.test(previous)
    || previous.toLowerCase() === common.lifetimeId.toLowerCase()))
    || (fingerprint !== null && (typeof fingerprint !== 'string' || !SHA256.test(fingerprint)))) {
    unavailable('INVALID_AUTHORITY');
  }
  const kind = value.transitionKind;
  if ((kind === 'legacy-adoption' && (previous !== null || fingerprint === null))
    || (kind === 'fresh-create' && (previous !== null || fingerprint !== null))
    || (kind === 'creator-recovery' && previous === null && fingerprint === null)
    || typeof kind !== 'string' || !['legacy-adoption', 'fresh-create', 'creator-recovery'].includes(kind)) {
    unavailable('INVALID_AUTHORITY');
  }
  return Object.freeze({ ...common, phase: 'transitioning',
    transitionKind: kind as PreparedDeviceAuthority['transitionKind'],
    previousLifetimeId: previous as string | null, previousMirrorFingerprint: fingerprint as string | null });
}
async function fingerprint(raw: string | null): Promise<string | null> {
  if (raw === null) return null;
  try {
    const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
  } catch { return unavailable('EVIDENCE_UNAVAILABLE'); }
}
function sameTuple(a: { deviceId: string; lifetimeId: string }, b: { deviceId: string; lifetimeId: string }) {
  return a.deviceId === b.deviceId && a.lifetimeId === b.lifetimeId;
}
function isThenable(value: unknown): boolean {
  return value !== null && (typeof value === 'object' || typeof value === 'function')
    && typeof (value as { then?: unknown }).then === 'function';
}
function rejectAsyncFunction(callback: Function): void {
  if (callback.constructor.name === 'AsyncFunction') unavailable('ASYNC_CONSUMER');
}

/** Constructors/imports do no I/O. Metadata only; no IDB, writer, transport, React or events. */
export function createWorkoutDeviceLifetimeAuthority(ports: DeviceAuthorityPorts) {
  const tokens = new WeakMap<DeviceAuthorityToken, { revoked: boolean }>();
  let consuming = false;

  function storage(): DeviceAuthorityStorage {
    try { return ports.getStorage() ?? unavailable('STORAGE_UNAVAILABLE'); }
    catch { return unavailable('STORAGE_UNAVAILABLE'); }
  }
  function read(store: DeviceAuthorityStorage, key: string): string | null {
    try { return store.getItem(key); } catch { return unavailable('STORAGE_UNAVAILABLE'); }
  }
  function write(store: DeviceAuthorityStorage, key: string, value: string): void {
    try { store.setItem(key, value); } catch { unavailable('STORAGE_UNAVAILABLE'); }
    // Read-back is mandatory, including the marker and the revocation write.
    if (read(store, key) !== value) unavailable('STORAGE_UNAVAILABLE');
  }
  function coherent(store: DeviceAuthorityStorage): ReadyDeviceAuthority {
    const before = read(store, WORKOUT_DEVICE_AUTHORITY_KEY);
    const record = parseWorkoutDeviceAuthority(before);
    const mirror = read(store, HEALTH_ROUTINE_DEVICE_ID_KEY);
    parseWorkoutDeviceAdoption(read(store, WORKOUT_DEVICE_ADOPTION_KEY));
    if (read(store, WORKOUT_DEVICE_AUTHORITY_KEY) !== before) unavailable('NOT_READY');
    if (record.phase !== 'ready') unavailable('NOT_READY');
    if (record.deviceId !== mirror) unavailable('MIRROR_MISMATCH');
    return record;
  }
  async function locked<T>(mode: 'shared' | 'exclusive', budget: DeviceAuthorityLockBudget,
    operation: (signal: AbortSignal) => T | Promise<T>): Promise<T> {
    if (consuming) unavailable('NESTED_LOCK');
    if (!budget || !Number.isSafeInteger(budget.timeoutMs) || budget.timeoutMs <= 0
      || budget.timeoutMs > 2_147_483_647) unavailable('INVALID_LOCK_BUDGET');
    let locks: DeviceAuthorityLocks | null;
    try { locks = ports.locks(); } catch { return unavailable('LOCK_UNAVAILABLE'); }
    if (!locks) unavailable('LOCK_UNAVAILABLE');
    const controller = new AbortController();
    const cancel = () => controller.abort();
    budget.signal?.addEventListener('abort', cancel, { once: true });
    if (budget.signal?.aborted) cancel();
    const timeout = setTimeout(cancel, budget.timeoutMs);
    let entered = false;
    try {
      if (controller.signal.aborted) unavailable('LOCK_CANCELLED');
      const result = await locks.request(WORKOUT_DEVICE_AUTHORITY_LOCK, { mode, signal: controller.signal }, lock => {
        clearTimeout(timeout); // The bound is acquisition, not permission for async consumers.
        if (entered || lock === null) unavailable('LOCK_FAILED');
        entered = true;
        if (controller.signal.aborted) unavailable('LOCK_CANCELLED');
        return operation(controller.signal);
      });
      if (!entered) unavailable('LOCK_FAILED');
      return result;
    } catch (error) {
      if (error instanceof WorkoutDeviceAuthorityUnavailable) throw error;
      if (controller.signal.aborted) return unavailable('LOCK_CANCELLED');
      return unavailable('LOCK_FAILED');
    } finally {
      clearTimeout(timeout);
      budget.signal?.removeEventListener('abort', cancel);
    }
  }
  function checkCancelled(signal: AbortSignal): void {
    if (signal.aborted) unavailable('LOCK_CANCELLED');
  }
  function tokenFor(record: ReadyDeviceAuthority): DeviceAuthorityToken {
    const state = { revoked: false };
    const token: DeviceAuthorityToken = Object.freeze({
      deviceId: record.deviceId, lifetimeId: record.lifetimeId,
      isCurrent: () => {
        if (state.revoked) return false;
        try {
          if (!sameTuple(coherent(storage()), token)) state.revoked = true;
        } catch { state.revoked = true; }
        return !state.revoked;
      },
    });
    tokens.set(token, state);
    return token;
  }
  function requireCurrent(token: DeviceAuthorityToken): ReadyDeviceAuthority {
    const state = tokens.get(token);
    if (!state || state.revoked) unavailable('REVOKED');
    try {
      const record = coherent(storage());
      if (!sameTuple(record, token)) unavailable('REVOKED');
      return record;
    } catch (error) { state.revoked = true; throw error; }
  }
  function freshUuid(excluded: readonly string[]): string {
    let value: string;
    try { value = ports.randomUUID(); } catch { return unavailable('ENTROPY_UNAVAILABLE'); }
    if (typeof value !== 'string' || !UUID_V4.test(value)
      || excluded.some(id => id.toLowerCase() === value.toLowerCase())) unavailable('ENTROPY_UNAVAILABLE');
    return value;
  }
  function assertAdmission(admission: DeviceAuthorityAdmission): void {
    if (!admission || admission.compatibleCreatorsQuiesced !== true
      || !['creator', 'legacy-reader'].includes(admission.role)) unavailable('ADMISSION_REQUIRED');
  }
  async function finishPrepared(store: DeviceAuthorityStorage, raw: string,
    prepared: PreparedDeviceAuthority, signal: AbortSignal): Promise<ReadyDeviceAuthority> {
    const mirror = read(store, HEALTH_ROUTINE_DEVICE_ID_KEY);
    const previousMatches = await fingerprint(mirror) === prepared.previousMirrorFingerprint;
    checkCancelled(signal);
    // Awaited hashing is not permission to consume a changed intent or mirror.
    if (read(store, WORKOUT_DEVICE_AUTHORITY_KEY) !== raw
      || read(store, HEALTH_ROUTINE_DEVICE_ID_KEY) !== mirror) unavailable('INVALID_PREPARED_INTENT');
    parseWorkoutDeviceAdoption(read(store, WORKOUT_DEVICE_ADOPTION_KEY));
    if (mirror !== prepared.deviceId && !previousMatches) unavailable('INVALID_PREPARED_INTENT');
    if (prepared.transitionKind === 'legacy-adoption') {
      if (mirror !== prepared.deviceId
        || await fingerprint(prepared.deviceId) !== prepared.previousMirrorFingerprint) {
        unavailable('INVALID_PREPARED_INTENT');
      }
    } else if (mirror !== prepared.deviceId && mirror !== null && LEGACY_HELPER_FORMAT.test(mirror)) {
      unavailable('INVALID_PREPARED_INTENT');
    }
    checkCancelled(signal);
    if (read(store, WORKOUT_DEVICE_AUTHORITY_KEY) !== raw
      || read(store, HEALTH_ROUTINE_DEVICE_ID_KEY) !== mirror) unavailable('INVALID_PREPARED_INTENT');
    parseWorkoutDeviceAdoption(read(store, WORKOUT_DEVICE_ADOPTION_KEY));
    if (mirror !== prepared.deviceId) write(store, HEALTH_ROUTINE_DEVICE_ID_KEY, prepared.deviceId);
    checkCancelled(signal);
    const ready: ReadyDeviceAuthority = Object.freeze({ format: 1, phase: 'ready',
      deviceId: prepared.deviceId, lifetimeId: prepared.lifetimeId });
    write(store, WORKOUT_DEVICE_AUTHORITY_KEY, JSON.stringify(ready));
    const result = coherent(store);
    if (!sameTuple(result, ready)) unavailable('NOT_READY');
    checkCancelled(signal);
    return result;
  }

  return Object.freeze({
    capture: (budget: DeviceAuthorityLockBudget): Promise<DeviceAuthorityToken> =>
      locked('shared', budget, signal => {
        const record = coherent(storage());
        checkCancelled(signal);
        return tokenFor(record);
      }),

    /** Explicit acquisition only. No replacement/reset/restore/clone target API is exposed.
     * Creator recovery is restricted to the existing helper's missing/format-invalid trigger.
     * Repeated coherent acquisition does not rotate; a persisted prepared intent resumes as-is.
     */
    acquire: (admission: DeviceAuthorityAdmission, budget: DeviceAuthorityLockBudget): Promise<DeviceAuthorityToken> =>
      locked('exclusive', budget, async signal => {
        assertAdmission(admission);
        const store = storage();
        const raw = read(store, WORKOUT_DEVICE_AUTHORITY_KEY);
        const marker = read(store, WORKOUT_DEVICE_ADOPTION_KEY);
        const mirror = read(store, HEALTH_ROUTINE_DEVICE_ID_KEY);
        const record = raw === null ? null : parseWorkoutDeviceAuthority(raw);
        if (marker !== null) parseWorkoutDeviceAdoption(marker);
        if (record && marker === null) unavailable('INVALID_MARKER');
        if (!record && marker !== null) unavailable('NOT_READY'); // Includes marker-only crash.
        if (record?.phase === 'transitioning') {
          return tokenFor(await finishPrepared(store, raw!, record, signal));
        }
        if (record?.phase === 'ready' && mirror === record.deviceId) {
          const current = coherent(store);
          checkCancelled(signal);
          return tokenFor(current);
        }
        const recoveryTrigger = mirror === null || !LEGACY_HELPER_FORMAT.test(mirror);
        if (record && !(admission.role === 'creator' && recoveryTrigger)) unavailable('MIRROR_MISMATCH');
        if (!record && !recoveryTrigger && !validDevice(mirror)) unavailable('INVALID_DEVICE');
        if (recoveryTrigger && admission.role !== 'creator') unavailable('ADMISSION_REQUIRED');
        const previousMirrorFingerprint = await fingerprint(mirror);
        checkCancelled(signal);
        if (read(store, WORKOUT_DEVICE_AUTHORITY_KEY) !== raw
          || read(store, WORKOUT_DEVICE_ADOPTION_KEY) !== marker
          || read(store, HEALTH_ROUTINE_DEVICE_ID_KEY) !== mirror) unavailable('NOT_READY');
        const deviceId = recoveryTrigger ? freshUuid([]) : mirror!;
        const lifetimeId = freshUuid([deviceId, ...(record ? [record.lifetimeId] : [])]);
        const prepared: PreparedDeviceAuthority = Object.freeze({ format: 1, phase: 'transitioning',
          deviceId, lifetimeId, transitionKind: record || (mirror !== null && recoveryTrigger)
            ? 'creator-recovery' : mirror === null ? 'fresh-create' : 'legacy-adoption',
          previousLifetimeId: record?.lifetimeId ?? null, previousMirrorFingerprint });
        if (marker === null) write(store, WORKOUT_DEVICE_ADOPTION_KEY, WORKOUT_DEVICE_ADOPTION_VALUE);
        checkCancelled(signal);
        const preparedRaw = JSON.stringify(prepared);
        write(store, WORKOUT_DEVICE_AUTHORITY_KEY, preparedRaw); // Revocation boundary.
        return tokenFor(await finishPrepared(store, preparedRaw, prepared, signal));
      }),

    /** Bounded resume only. Never invents a target, creates a marker or repairs ambiguous loss. */
    resumePrepared: (budget: DeviceAuthorityLockBudget): Promise<DeviceAuthorityToken> =>
      locked('exclusive', budget, async signal => {
        const store = storage();
        parseWorkoutDeviceAdoption(read(store, WORKOUT_DEVICE_ADOPTION_KEY));
        const raw = read(store, WORKOUT_DEVICE_AUTHORITY_KEY);
        const record = parseWorkoutDeviceAuthority(raw);
        if (record.phase !== 'transitioning') unavailable('INVALID_PREPARED_INTENT');
        return tokenFor(await finishPrepared(store, raw!, record, signal));
      }),

    /** Only this operation authorizes consumption. It returns the consumer's value, NOT
     * a transferable verification capability. A later use must repeat this operation.
     * No awaited consumer, retained boolean, nested authority lock, scan or network work.
     */
    withCurrentAuthority: <T>(token: DeviceAuthorityToken, budget: DeviceAuthorityLockBudget,
      consume: (authority: ReadyDeviceAuthority) => T & SyncResult<T>,
      callerIsCurrent: () => boolean = () => true): Promise<T> =>
      locked('shared', budget, signal => {
        rejectAsyncFunction(consume);
        rejectAsyncFunction(callerIsCurrent);
        requireCurrent(token);
        consuming = true;
        try {
          const current = callerIsCurrent();
          if (isThenable(current)) unavailable('ASYNC_CONSUMER');
          if (current !== true) unavailable('CALLER_NOT_CURRENT');
          checkCancelled(signal);
          const record = requireCurrent(token); // Immediately before synchronous consumption.
          const result = consume(record);
          if (isThenable(result)) {
            // A disguised thenable is a programming error, never awaited as authorized work.
            void Promise.resolve(result).catch(() => undefined);
            unavailable('ASYNC_CONSUMER');
          }
          return result;
        } finally { consuming = false; }
      }),
  });
}

/** Lazy real-browser adapter. No fallback and no I/O until an explicit operation. */
export function createProductionWorkoutDeviceLifetimeAuthority() {
  return createWorkoutDeviceLifetimeAuthority({
    getStorage: () => typeof localStorage === 'undefined' ? null : localStorage,
    locks: () => typeof navigator === 'undefined' || !('locks' in navigator)
      || (typeof isSecureContext === 'boolean' && !isSecureContext) ? null : navigator.locks,
    randomUUID: () => crypto.randomUUID(),
  });
}
