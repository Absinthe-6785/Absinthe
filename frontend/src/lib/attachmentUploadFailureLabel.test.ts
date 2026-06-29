import { describe, expect, it } from 'vitest';
import { formatUploadFailureForUi } from './attachmentUploadFailureLabel';
import type { SanitizedRemoteBlobProviderError } from './remoteBlobProvider';

function error(overrides: Partial<SanitizedRemoteBlobProviderError>): SanitizedRemoteBlobProviderError {
  return {
    message: 'Upload failed.',
    category: 'upload',
    retryable: false,
    ...overrides,
  };
}

describe('attachment upload failure labels', () => {
  it.each([
    {
      name: 'auth expired',
      input: error({ code: 'auth_expired', category: 'auth' }),
      title: 'Google Drive session expired',
      hint: 'Reconnect session',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'token unavailable',
      input: error({ code: 'token_unavailable', category: 'auth' }),
      title: 'Google Drive session expired',
      hint: 'Reconnect session',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'access denied',
      input: error({ code: 'authorization_failed', category: 'auth' }),
      title: 'Google Drive upload access denied',
      hint: 'Check permissions or reconnect',
      retryable: false,
      manualReview: false,
    },
    {
      name: 'rate limited',
      input: error({ code: 'rate_limited', retryable: true }),
      title: 'Google Drive is rate limiting uploads',
      hint: 'Try again later',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'provider unavailable',
      input: error({ code: 'provider_unavailable', retryable: true }),
      title: 'Google Drive is temporarily unavailable',
      hint: 'Try again later',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'network',
      input: error({ code: 'network_failed', category: 'network', retryable: true }),
      title: 'Google Drive is temporarily unavailable',
      hint: 'Try again later',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'local missing',
      input: error({ code: 'local_blob_missing' }),
      title: 'Local file missing',
      hint: 'Restore or recover the local file first',
      retryable: false,
      manualReview: false,
    },
    {
      name: 'local unreadable',
      input: error({ code: 'local_blob_unreadable', retryable: true }),
      title: 'Local file could not be read',
      hint: 'Check local storage and try again',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'generic upload',
      input: error({ code: 'upload_failed', retryable: true }),
      title: 'Upload failed',
      hint: 'Try again later or review diagnostics',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'invalid response',
      input: error({ code: 'invalid_response', retryable: true }),
      title: 'Upload response could not be verified',
      hint: 'Review diagnostics before retrying',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'missing remote id',
      input: error({ code: 'missing_remote_id' }),
      title: 'Upload response could not be verified',
      hint: 'Review diagnostics before retrying',
      retryable: false,
      manualReview: false,
    },
    {
      name: 'size mismatch',
      input: error({ code: 'size_mismatch' }),
      title: 'Uploaded file could not be verified',
      hint: 'Review diagnostics before retrying',
      retryable: false,
      manualReview: false,
    },
    {
      name: 'checksum mismatch',
      input: error({ code: 'checksum_mismatch' }),
      title: 'Uploaded file could not be verified',
      hint: 'Review diagnostics before retrying',
      retryable: false,
      manualReview: false,
    },
    {
      name: 'metadata update',
      input: error({ code: 'metadata_update_failed', retryable: true }),
      title: 'Upload needs manual review',
      hint: 'Review diagnostics before uploading again',
      retryable: false,
      manualReview: true,
    },
  ])('maps $name to a safe upload UI label', item => {
    const label = formatUploadFailureForUi({
      providerType: 'googleDrive',
      errorDetails: item.input,
    });

    expect(label).toMatchObject({
      title: item.title,
      actionHint: item.hint,
      retryable: item.retryable,
      manualReview: item.manualReview,
    });
  });

  it.each([
    {
      reasonCode: 'upload_in_progress',
      title: 'Upload already in progress',
      message: 'Wait for the current upload to finish before starting another upload.',
    },
    {
      reasonCode: 'another_upload_in_progress',
      title: 'Another upload is in progress',
      message: 'Absinthe allows one explicit Google Drive upload at a time in this panel.',
    },
  ])('maps $reasonCode to wait copy', item => {
    const label = formatUploadFailureForUi({ reasonCode: item.reasonCode });

    expect(label).toMatchObject({
      title: item.title,
      message: item.message,
      actionHint: item.reasonCode === 'upload_in_progress'
        ? 'Wait for upload to finish'
        : 'Wait for the current upload to finish',
      retryable: false,
      manualReview: false,
    });
  });

  it('marks metadata update failures as remote-object ambiguous manual review without normal retry copy', () => {
    const label = formatUploadFailureForUi({
      providerType: 'googleDrive',
      errorDetails: error({ code: 'metadata_update_failed', retryable: true }),
    });

    expect(label.manualReview).toBe(true);
    expect(label.remoteObjectAmbiguous).toBe(true);
    expect(label.retryable).toBe(false);
    expect(label.message).toContain('may have succeeded');
    expect(label.actionHint).toBe('Review diagnostics before uploading again');
    expect(JSON.stringify(label)).not.toContain('Try again later');
  });

  it('uses a fixed safe fallback label', () => {
    const label = formatUploadFailureForUi({
      providerType: 'googleDrive',
      errorDetails: error({ code: 'unknown_provider_error', retryable: false }),
    });

    expect(label).toMatchObject({
      title: 'Upload failed',
      message: 'This attachment could not be uploaded.',
      actionHint: 'Review diagnostics',
      retryable: false,
      manualReview: false,
    });
  });

  it('does not surface malicious raw provider payloads in labels', () => {
    const label = formatUploadFailureForUi({
      providerType: 'googleDrive',
      errorDetails: error({
        code: 'unknown_provider_error',
        message: `access_token=token-secret refresh_token=refresh-secret id_token=id-secret code=auth-secret code_verifier=verifier-secret codeVerifier=camel-secret codeVerifierRef=ref-secret Authorization: Bearer bearer-secret http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret <html>{"access_token":"json-secret"}</html> data:image/png;base64,AAA111`,
      }),
    });
    const serialized = JSON.stringify(label);

    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('refresh-secret');
    expect(serialized).not.toContain('id-secret');
    expect(serialized).not.toContain('auth-secret');
    expect(serialized).not.toContain('verifier-secret');
    expect(serialized).not.toContain('camel-secret');
    expect(serialized).not.toContain('ref-secret');
    expect(serialized).not.toContain('bearer-secret');
    expect(serialized).not.toContain('callback-secret');
    expect(serialized).not.toContain('session-secret');
    expect(serialized).not.toContain('/oauth/google-drive/callback?code=');
    expect(serialized).not.toContain('upload/drive/v3/files');
    expect(serialized).not.toContain('<html>');
    expect(serialized).not.toContain('json-secret');
    expect(serialized).not.toContain('AAA111');
  });
});
