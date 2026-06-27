import type { User } from '@supabase/supabase-js';
import { resolveNotesRuntimeSyncMode } from './syncMode';

export const LOCAL_AUTH_USER_ID = 'local-user';
export const LOCAL_AUTH_EMAIL = 'local@absinthe.dev';

export function isLocalOnlyRuntime(): boolean {
  return resolveNotesRuntimeSyncMode() === 'local';
}

export function createLocalAuthUser(): User {
  return {
    id: LOCAL_AUTH_USER_ID,
    aud: 'authenticated',
    role: 'authenticated',
    email: LOCAL_AUTH_EMAIL,
    app_metadata: { provider: 'local' },
    user_metadata: { displayName: 'Local User', mode: 'local' },
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  } as User;
}
