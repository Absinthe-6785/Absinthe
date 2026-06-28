import { describe, expect, it } from 'vitest';
import { formatRecoveryFailureForUi } from './attachmentRecoveryFailureLabel';
import type { SanitizedRemoteBlobProviderError } from './remoteBlobProvider';

function error(overrides: Partial<SanitizedRemoteBlobProviderError>): SanitizedRemoteBlobProviderError {
  return {
    message: 'Recovery failed.',
    category: 'provider',
    retryable: false,
    ...overrides,
  };
}

describe('attachment recovery failure labels', () => {
  it.each([
    {
      name: 'auth expired',
      input: error({ code: 'auth_expired', category: 'auth' }),
      title: 'Google Drive session expired',
      hint: 'Reconnect session',
      retryable: true,
    },
    {
      name: 'forbidden',
      input: error({ code: 'authorization_failed', category: 'auth' }),
      title: 'Google Drive access denied',
      hint: 'Check permission or reconnect',
      retryable: false,
    },
    {
      name: 'remote file missing',
      input: error({ code: 'remote_file_missing' }),
      title: 'Remote file not found',
      hint: 'Check the remote file or restore from another backup',
      retryable: false,
    },
    {
      name: 'rate limited',
      input: error({ code: 'rate_limited', retryable: true }),
      title: 'Google Drive is rate limiting requests',
      hint: 'Try again later',
      retryable: true,
    },
    {
      name: 'provider unavailable',
      input: error({ code: 'provider_unavailable', retryable: true }),
      title: 'Google Drive is temporarily unavailable',
      hint: 'Try again later',
      retryable: true,
    },
    {
      name: 'network',
      input: error({ code: 'download_failed', category: 'network', retryable: true }),
      title: 'Google Drive is temporarily unavailable',
      hint: 'Try again later',
      retryable: true,
    },
    {
      name: 'invalid remote response',
      input: error({ code: 'invalid_remote_response', retryable: true }),
      title: 'Downloaded file could not be verified',
      hint: 'Try again or check the remote file',
      retryable: true,
    },
    {
      name: 'empty body',
      input: error({ message: 'Google Drive download returned an empty response body.', retryable: true }),
      title: 'Downloaded file could not be verified',
      hint: 'Try again or check the remote file',
      retryable: true,
    },
    {
      name: 'verification failed',
      input: error({ code: 'verification_failed' }),
      title: 'Downloaded file could not be verified',
      hint: 'Try again or check the remote file',
      retryable: false,
    },
    {
      name: 'local blob write',
      input: error({ code: 'local_blob_write_failed' }),
      title: 'Local save failed',
      hint: 'Check local storage and try again',
      retryable: true,
    },
    {
      name: 'metadata update',
      input: error({ code: 'metadata_update_failed' }),
      title: 'Recovery status update failed',
      hint: 'Review diagnostics before retrying',
      retryable: false,
    },
  ])('maps $name to a safe UI label', item => {
    const label = formatRecoveryFailureForUi({
      errorDetails: item.input,
      providerType: 'googleDrive',
    });

    expect(label).toMatchObject({
      title: item.title,
      actionHint: item.hint,
      retryable: item.retryable,
    });
  });

  it('keeps rate_limited specific and retryable instead of collapsing to generic download failure', () => {
    const label = formatRecoveryFailureForUi({
      providerType: 'googleDrive',
      errorDetails: error({
        code: 'rate_limited',
        category: 'provider',
        retryable: true,
        message: 'Google Drive rate limit blocked recovery.',
      }),
    });

    expect(label.title).toBe('Google Drive is rate limiting requests');
    expect(label.retryable).toBe(true);
    expect(label.actionHint).toBe('Try again later');
  });

  it('uses a fixed safe fallback label', () => {
    const label = formatRecoveryFailureForUi({
      errorDetails: error({ code: 'unknown_provider_error', retryable: false }),
      providerType: 'googleDrive',
    });

    expect(label).toMatchObject({
      title: 'Recovery failed',
      message: 'This attachment could not be recovered.',
      actionHint: 'Review diagnostics',
      retryable: false,
    });
  });

  it('does not surface malicious raw provider payloads in labels', () => {
    const label = formatRecoveryFailureForUi({
      providerType: 'googleDrive',
      errorDetails: error({
        code: 'unknown_provider_error',
        message: `access_token=token-secret refresh_token=refresh-secret code=auth-secret codeVerifier=verifier-secret codeVerifierRef=ref-secret Authorization: Bearer bearer-secret http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret <html>{"access_token":"json-secret"}</html>`,
      }),
    });
    const serialized = JSON.stringify(label);

    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('refresh-secret');
    expect(serialized).not.toContain('auth-secret');
    expect(serialized).not.toContain('verifier-secret');
    expect(serialized).not.toContain('ref-secret');
    expect(serialized).not.toContain('bearer-secret');
    expect(serialized).not.toContain('/oauth/google-drive/callback?code=');
    expect(serialized).not.toContain('<html>');
    expect(serialized).not.toContain('json-secret');
  });
});
