export const NOTES_RUNTIME_SYNC_MODE_KEY = 'absinthe-notes-sync-mode';
export const RETURN_TO_USE_LOCAL_LOCK_ENV = 'VITE_ABSINTHE_RETURN_TO_USE_LOCAL_LOCK';

export type NotesRuntimeSyncMode = 'local' | 'remote' | 'hybrid';

export function isNotesRuntimeSyncMode(value: unknown): value is NotesRuntimeSyncMode {
  return value === 'local' || value === 'remote' || value === 'hybrid';
}

function isReturnToUseLocalLockEnabled(): boolean {
  const configured = import.meta.env.VITE_ABSINTHE_RETURN_TO_USE_LOCAL_LOCK;
  return configured === true || configured === 'true' || configured === '1';
}

export function resolveNotesRuntimeSyncMode(): NotesRuntimeSyncMode {
  // The return-to-use lock is an explicit safety boundary and outranks stale browser state.
  if (isReturnToUseLocalLockEnabled()) return 'local';

  // Local is the runtime source of truth; remote/hybrid are explicit future sync modes.
  try {
    const stored = localStorage.getItem(NOTES_RUNTIME_SYNC_MODE_KEY);
    if (isNotesRuntimeSyncMode(stored)) return stored;
  } catch { /* ignore */ }

  const envMode = import.meta.env.VITE_ABSINTHE_SYNC_MODE;
  if (isNotesRuntimeSyncMode(envMode)) return envMode;

  return 'local';
}

export function isNotesCloudSyncEnabled(): boolean {
  return resolveNotesRuntimeSyncMode() !== 'local';
}
