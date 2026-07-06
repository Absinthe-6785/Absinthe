import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MOCK_SUPABASE_ACCESS_TOKEN,
  DEFAULT_MOCK_SUPABASE_EMAIL,
  DEFAULT_MOCK_SUPABASE_EXPIRES_AT,
  DEFAULT_MOCK_SUPABASE_REFRESH_TOKEN,
  DEFAULT_MOCK_SUPABASE_USER_ID,
  createMockSupabaseAuthResponse,
  createMockSupabaseSession,
  createMockSupabaseSignOutResponse,
  createMockSupabaseUnauthenticatedAuthResponse,
  createMockSupabaseUser,
} from './mockSupabaseAuthSession';

describe('mock Supabase auth session test utility', () => {
  it('creates a deterministic fake authenticated session', () => {
    const session = createMockSupabaseSession();

    expect(session.user.id).toBe(DEFAULT_MOCK_SUPABASE_USER_ID);
    expect(session.user.email).toBe(DEFAULT_MOCK_SUPABASE_EMAIL);
    expect(session.access_token).toBe(DEFAULT_MOCK_SUPABASE_ACCESS_TOKEN);
    expect(session.refresh_token).toBe(DEFAULT_MOCK_SUPABASE_REFRESH_TOKEN);
    expect(session.expires_at).toBe(DEFAULT_MOCK_SUPABASE_EXPIRES_AT);
    expect(session.token_type).toBe('bearer');
  });

  it('accepts user, token, and expiry overrides', () => {
    const session = createMockSupabaseSession({
      userId: 'custom-user-id',
      email: 'custom-user@example.com',
      accessToken: 'fake-custom-access-token',
      expiresAt: 4_111_111_111,
    });

    expect(session.user.id).toBe('custom-user-id');
    expect(session.user.email).toBe('custom-user@example.com');
    expect(session.access_token).toBe('fake-custom-access-token');
    expect(session.expires_at).toBe(4_111_111_111);
  });

  it('creates the minimal fake user shape App auth tests need', () => {
    const user = createMockSupabaseUser();

    expect(user.id).toBe(DEFAULT_MOCK_SUPABASE_USER_ID);
    expect(user.email).toBe(DEFAULT_MOCK_SUPABASE_EMAIL);
    expect(user.aud).toBe('authenticated');
    expect(user.role).toBe('authenticated');
    expect(user.app_metadata.provider).toBe('email');
  });

  it('creates getSession-compatible authenticated and unauthenticated responses', () => {
    expect(createMockSupabaseAuthResponse().data.session?.user.email).toBe(DEFAULT_MOCK_SUPABASE_EMAIL);
    expect(createMockSupabaseUnauthenticatedAuthResponse()).toEqual({
      data: { session: null },
      error: null,
    });
  });

  it('creates a signOut-compatible success response', () => {
    expect(createMockSupabaseSignOutResponse()).toEqual({ error: null });
  });

  it('does not depend on environment variables, browser storage, or credential-like values', () => {
    const serialized = JSON.stringify(createMockSupabaseAuthResponse()).toLowerCase();

    expect(serialized).toContain('fake-access-token');
    expect(serialized).toContain('fake-refresh-token');
    expect(serialized).toContain('example.com');
    expect(serialized).not.toContain('service-role');
    expect(serialized).not.toContain('service_role');
    expect(serialized).not.toContain('storagestate');
    expect(serialized).not.toContain('supabase.co');
    expect(serialized).not.toContain('eyj');
  });
});
