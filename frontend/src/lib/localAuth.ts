import type { User } from '@supabase/supabase-js';

export const LOCAL_AUTH_USER_ID = 'local-user';
export const LOCAL_AUTH_EMAIL = 'local@absinthe.dev';
export const LOCAL_AUTH_RUNTIME_ENV = 'VITE_ABSINTHE_LOCAL_AUTH';

/** Local authentication is an explicit runtime capability, not a Notes mode. */
export function isLocalOnlyRuntime(): boolean {
  const configured = import.meta.env.VITE_ABSINTHE_LOCAL_AUTH;
  return configured === true || configured === 'true' || configured === '1';
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
