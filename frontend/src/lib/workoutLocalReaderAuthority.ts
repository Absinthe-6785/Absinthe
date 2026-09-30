/** Shared local authority identifiers; importing this module performs no I/O. */
export const HEALTH_ROUTINE_DEVICE_ID_KEY = 'absinthe-health-routine-device-id:v1';
export const HEALTH_ROUTINE_PROJECT_REF = 'absinthe-health-routines';
export const HEALTH_ROUTINE_GENERATION_ID = 'health-routine-v1';

/** Preserve the existing Health/K323 read-or-create behavior for sync callers. */
export function readOrCreateDeviceId(storage: Storage): string {
  const existing = storage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY);
  if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
  const created = crypto.randomUUID();
  storage.setItem(HEALTH_ROUTINE_DEVICE_ID_KEY, created);
  return created;
}

/** Local readers never repair an existing malformed identity. */
export function readEstablishedWorkoutDeviceId(storage: Storage): string {
  const existing = storage.getItem(HEALTH_ROUTINE_DEVICE_ID_KEY);
  if (existing !== null) {
    if (!/^[0-9a-f-]{36}$/i.test(existing)) throw new Error('workout_selected_day_device_id_invalid');
    return existing;
  }
  return readOrCreateDeviceId(storage);
}
