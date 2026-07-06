import type { Session, User } from '@supabase/supabase-js';

export type MockSupabaseAuthSessionOptions = {
  userId?: string;
  email?: string;
  accessToken?: string;
  expiresAt?: number;
};

export type MockSupabaseAuthResponse = {
  data: {
    session: Session | null;
  };
  error: null;
};

export type MockSupabaseSignOutResponse = {
  error: null;
};

export const DEFAULT_MOCK_SUPABASE_USER_ID = 'test-user-id';
export const DEFAULT_MOCK_SUPABASE_EMAIL = 'auth-test@example.com';
export const DEFAULT_MOCK_SUPABASE_ACCESS_TOKEN = 'fake-access-token';
export const DEFAULT_MOCK_SUPABASE_REFRESH_TOKEN = 'fake-refresh-token';
export const DEFAULT_MOCK_SUPABASE_EXPIRES_AT = 4_102_444_800;

export function createMockSupabaseUser(
  options: Pick<MockSupabaseAuthSessionOptions, 'userId' | 'email'> = {},
): User {
  const id = options.userId ?? DEFAULT_MOCK_SUPABASE_USER_ID;
  const email = options.email ?? DEFAULT_MOCK_SUPABASE_EMAIL;

  return {
    id,
    aud: 'authenticated',
    role: 'authenticated',
    email,
    app_metadata: { provider: 'email' },
    user_metadata: { source: 'vitest-auth-helper' },
    created_at: new Date(0).toISOString(),
    updated_at: new Date(0).toISOString(),
  } as User;
}

export function createMockSupabaseSession(
  options: MockSupabaseAuthSessionOptions = {},
): Session {
  const accessToken = options.accessToken ?? DEFAULT_MOCK_SUPABASE_ACCESS_TOKEN;
  const expiresAt = options.expiresAt ?? DEFAULT_MOCK_SUPABASE_EXPIRES_AT;

  return {
    access_token: accessToken,
    refresh_token: DEFAULT_MOCK_SUPABASE_REFRESH_TOKEN,
    expires_in: Math.max(0, expiresAt - Math.floor(Date.now() / 1000)),
    expires_at: expiresAt,
    token_type: 'bearer',
    user: createMockSupabaseUser(options),
  } as Session;
}

export function createMockSupabaseAuthResponse(
  options: MockSupabaseAuthSessionOptions = {},
): MockSupabaseAuthResponse {
  return {
    data: {
      session: createMockSupabaseSession(options),
    },
    error: null,
  };
}

export function createMockSupabaseUnauthenticatedAuthResponse(): MockSupabaseAuthResponse {
  return {
    data: {
      session: null,
    },
    error: null,
  };
}

export function createMockSupabaseSignOutResponse(): MockSupabaseSignOutResponse {
  return { error: null };
}
