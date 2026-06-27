export const NOTES_RUNTIME_SYNC_MODE_KEY = 'absinthe-notes-sync-mode';

export type NotesRuntimeSyncMode = 'local' | 'remote' | 'hybrid';

export function isNotesRuntimeSyncMode(value: unknown): value is NotesRuntimeSyncMode {
  return value === 'local' || value === 'remote' || value === 'hybrid';
}

export function resolveNotesRuntimeSyncMode(): NotesRuntimeSyncMode {
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
