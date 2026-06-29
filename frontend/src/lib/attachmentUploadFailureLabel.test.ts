import { describe, expect, it } from 'vitest';
import {
  formatUploadFailureForUi,
  getUploadManualReviewDiagnostics,
} from './attachmentUploadFailureLabel';
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
      name: 'invalid remote response',
      input: error({ code: 'invalid_remote_response', retryable: true }),
      title: 'Upload response could not be verified',
      hint: 'Review diagnostics before retrying',
      retryable: true,
      manualReview: false,
    },
    {
      name: 'remote conflict',
      input: error({ code: 'remote_conflict', retryable: true }),
      title: 'Upload conflict needs review',
      hint: 'Review remote state',
      retryable: false,
      manualReview: true,
    },
    {
      name: 'remote file missing',
      input: error({ code: 'remote_file_missing' }),
      title: 'Upload target is unavailable',
      hint: 'Review provider state',
      retryable: false,
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

  it.each([
    {
      name: 'metadata update',
      code: 'metadata_update_failed',
      title: 'Upload needs manual review',
      summary: 'The remote upload may have succeeded, but local metadata was not updated safely.',
      checklist: [
        'Do not upload this attachment again until diagnostics are reviewed.',
        'Local file is still preserved.',
        'A remote object may exist in Google Drive.',
        'No automatic cleanup was performed.',
        'Upload was not marked synced.',
      ],
      actionHint: 'Review diagnostics before retrying',
      manualReview: true,
      remoteObjectAmbiguous: true,
    },
    {
      name: 'verification mismatch',
      code: 'size_mismatch',
      title: 'Uploaded file could not be verified',
      summary: 'The upload result did not match the local attachment, so Absinthe did not mark it synced.',
      checklist: [
        'Local file is still preserved.',
        'Upload was not marked synced.',
        'Review the remote result before retrying.',
      ],
      actionHint: 'Review diagnostics',
      manualReview: false,
      remoteObjectAmbiguous: true,
    },
    {
      name: 'remote conflict',
      code: 'remote_conflict',
      title: 'Upload conflict needs review',
      summary: 'The upload target appears to conflict with existing remote state.',
      checklist: [
        'No overwrite was performed.',
        'No remote file was deleted.',
        'Review before uploading again.',
      ],
      actionHint: 'Review remote state',
      manualReview: true,
      remoteObjectAmbiguous: true,
    },
    {
      name: 'invalid response',
      code: 'invalid_remote_response',
      title: 'Upload response could not be verified',
      summary: 'Google Drive responded, but Absinthe could not verify the uploaded file id or metadata.',
      checklist: [
        'Upload was not marked synced.',
        'Local file is still preserved.',
        'Review diagnostics before retrying.',
      ],
      actionHint: 'Review diagnostics',
      manualReview: false,
      remoteObjectAmbiguous: true,
    },
    {
      name: 'remote file missing',
      code: 'remote_file_missing',
      title: 'Upload target is unavailable',
      summary: 'The upload target or session context was unavailable.',
      checklist: [
        'No local file was deleted.',
        'No upload was marked synced.',
        'Reconnect or review provider state before retrying.',
      ],
      actionHint: 'Review provider state',
      manualReview: false,
      remoteObjectAmbiguous: false,
    },
  ])('builds safe manual-review diagnostics for $name', item => {
    const diagnostics = getUploadManualReviewDiagnostics({
      providerType: 'googleDrive',
      errorDetails: error({
        code: item.code,
        retryable: true,
        message: 'raw provider body access_token=secret <html>bad</html>',
      }),
    });

    expect(diagnostics).toMatchObject({
      isManualReview: true,
      title: item.title,
      summary: item.summary,
      actionHint: item.actionHint,
      reasonCode: item.code,
      safeTechnicalDetails: {
        reasonCode: item.code,
        manualReview: item.manualReview,
        remoteObjectAmbiguous: item.remoteObjectAmbiguous,
        providerType: 'googleDrive',
      },
    });
    expect(diagnostics.checklist).toEqual(item.checklist);
    expect(JSON.stringify(diagnostics)).not.toContain('access_token=secret');
    expect(JSON.stringify(diagnostics)).not.toContain('<html>');
  });

  it('keeps manual-review technical details structured and safe', () => {
    const diagnostics = getUploadManualReviewDiagnostics({
      providerType: 'googleDrive',
      errorDetails: error({
        code: 'metadata_update_failed',
        category: 'upload',
        retryable: true,
        message: 'metadata failed Authorization: Bearer bearer-secret data:image/png;base64,AAA111',
      }),
    });

    expect(diagnostics.safeTechnicalDetails).toEqual({
      category: 'upload',
      reasonCode: 'metadata_update_failed',
      retryable: false,
      manualReview: true,
      remoteObjectAmbiguous: true,
      providerType: 'googleDrive',
    });
    expect(JSON.stringify(diagnostics)).not.toContain('bearer-secret');
    expect(JSON.stringify(diagnostics)).not.toContain('AAA111');
  });
});
