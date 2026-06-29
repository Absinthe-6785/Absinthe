import { describe, expect, it, vi } from 'vitest';
import type { AttachmentUploadDiagnosticsItem } from './attachmentSyncDiagnostics';
import { buildManualUploadQueueReview } from './attachmentUploadQueueReview';

function item(overrides: Partial<AttachmentUploadDiagnosticsItem> = {}): AttachmentUploadDiagnosticsItem {
  return {
    attachmentId: 'att-ready',
    localBlobKey: 'local-attachment/ready',
    remoteProvider: undefined,
    remoteFileId: undefined,
    remoteSyncStatus: 'local_only',
    eligible: true,
    reason: 'Ready for explicit upload',
    localBlobPresent: true,
    localSize: 10,
    ...overrides,
  };
}

describe('manual upload queue review', () => {
  it('groups eligible, blocked, manual-review, and already-synced items without executing work', () => {
    const upload = vi.fn();
    const readBlob = vi.fn();
    const review = buildManualUploadQueueReview({
      items: [
        item({ attachmentId: 'att-ready', localSize: 100 }),
        item({ attachmentId: 'att-unknown-size', localSize: undefined }),
        item({
          attachmentId: 'att-provider-blocked',
          eligible: false,
          reason: 'Provider unavailable',
        }),
        item({
          attachmentId: 'att-missing-local',
          localBlobKey: 'local-attachment/missing',
          localBlobPresent: false,
          localSize: undefined,
          eligible: false,
          reason: 'Local blob missing',
        }),
        item({
          attachmentId: 'att-manual',
          remoteSyncStatus: 'failed',
          eligible: false,
          reason: 'Upload state requires review metadata_update_failed',
        }),
        item({
          attachmentId: 'att-verify',
          remoteSyncStatus: 'failed',
          eligible: false,
          reason: 'Remote upload size verification failed.',
        }),
        item({
          attachmentId: 'att-conflict',
          remoteSyncStatus: 'failed',
          eligible: false,
          reason: 'remote_conflict requires review',
        }),
        item({
          attachmentId: 'att-invalid',
          remoteSyncStatus: 'failed',
          eligible: false,
          reason: 'invalid_remote_response',
        }),
        item({
          attachmentId: 'att-synced',
          remoteProvider: 'googleDrive',
          remoteFileId: 'drive-file-1',
          remoteSyncStatus: 'synced',
          eligible: false,
          reason: 'Already synced',
          localSize: 15,
        }),
      ],
      getAvailability: candidate => {
        if (candidate.attachmentId === 'att-provider-blocked') {
          return { canUpload: false, reasonCode: 'provider_unavailable', reasonLabel: 'Provider unavailable' };
        }
        if (candidate.attachmentId === 'att-missing-local') {
          return { canUpload: false, reasonCode: 'local_blob_missing', reasonLabel: 'Local blob missing' };
        }
        if (candidate.attachmentId === 'att-ready' || candidate.attachmentId === 'att-unknown-size') {
          return { canUpload: true, reasonLabel: 'Ready for explicit upload' };
        }
        return { canUpload: false, reasonCode: 'manual_review_required', reasonLabel: 'Manual review required' };
      },
    });

    expect(upload).not.toHaveBeenCalled();
    expect(readBlob).not.toHaveBeenCalled();
    expect(review.summary).toMatchObject({
      totalItems: 9,
      eligibleCount: 2,
      blockedCount: 2,
      manualReviewCount: 4,
      alreadySyncedCount: 1,
      missingLocalCount: 1,
      estimatedEligibleBytes: 100,
      unknownEligibleSizeCount: 1,
    });
    expect(review.groups.eligible.map(candidate => candidate.attachmentId)).toEqual(['att-ready', 'att-unknown-size']);
    expect(review.groups.blocked.map(candidate => candidate.attachmentId)).toEqual(['att-provider-blocked', 'att-missing-local']);
    expect(review.groups.manualReview.map(candidate => candidate.attachmentId)).toEqual(['att-manual', 'att-verify', 'att-conflict', 'att-invalid']);
    expect(review.groups.alreadySynced.map(candidate => candidate.attachmentId)).toEqual(['att-synced']);
    expect(review.summary.providerCounts).toMatchObject({
      none: 8,
      googleDrive: 1,
    });
  });

  it('keeps unsafe reasons out of queue review labels', () => {
    const review = buildManualUploadQueueReview({
      items: [
        item({
          attachmentId: 'att-malicious',
          eligible: false,
          reason: 'Provider failed access_token=token-secret refresh_token=refresh-secret id_token=id-secret code=auth-secret codeVerifier=verifier-secret Authorization: Bearer bearer-secret http://127.0.0.1:5173/oauth/google-drive/callback?code=callback-secret https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&upload_id=session-secret <html>{"access_token":"json-secret"}</html> data:image/png;base64,AAA111',
        }),
      ],
      getAvailability: () => ({
        canUpload: false,
        reasonCode: 'provider_unavailable',
        reasonLabel: 'Provider failed access_token=token-secret Authorization: Bearer bearer-secret data:image/png;base64,AAA111',
      }),
    });
    const serialized = JSON.stringify(review);

    expect(serialized).not.toContain('token-secret');
    expect(serialized).not.toContain('refresh-secret');
    expect(serialized).not.toContain('id-secret');
    expect(serialized).not.toContain('auth-secret');
    expect(serialized).not.toContain('verifier-secret');
    expect(serialized).not.toContain('bearer-secret');
    expect(serialized).not.toContain('callback-secret');
    expect(serialized).not.toContain('session-secret');
    expect(serialized).not.toContain('/oauth/google-drive/callback?code=');
    expect(serialized).not.toContain('upload/drive/v3/files');
    expect(serialized).not.toContain('<html>');
    expect(serialized).not.toContain('json-secret');
    expect(serialized).not.toContain('AAA111');
  });

  it('does not move failed manual-review items into eligible candidates', () => {
    const review = buildManualUploadQueueReview({
      items: [
        item({
          attachmentId: 'att-failed',
          remoteSyncStatus: 'failed',
          eligible: true,
          reason: 'Upload state requires review',
        }),
      ],
      getAvailability: () => ({ canUpload: true, reasonLabel: 'Ready for explicit upload' }),
    });

    expect(review.groups.eligible).toHaveLength(0);
    expect(review.groups.manualReview).toHaveLength(1);
    expect(review.groups.manualReview[0]).toMatchObject({
      attachmentId: 'att-failed',
      manualReview: true,
    });
  });

  it('requires the current upload gate before an item is ready', () => {
    const upload = vi.fn();
    const readBlob = vi.fn();
    const createAdapter = vi.fn();
    const review = buildManualUploadQueueReview({
      items: [
        item({ attachmentId: 'att-no-availability', localSize: 500 }),
        item({ attachmentId: 'att-disabled', localSize: 400 }),
        item({ attachmentId: 'att-provider-unavailable', localSize: 300 }),
        item({ attachmentId: 'att-session-expired', localSize: 200 }),
        item({ attachmentId: 'att-token-unavailable', localSize: 100 }),
        item({ attachmentId: 'att-provider-mismatch', remoteProvider: 'supabase', localSize: 90 }),
        item({ attachmentId: 'att-missing-local', localBlobPresent: false, localSize: 80 }),
        item({ attachmentId: 'att-blocked-state', remoteSyncStatus: 'paused_offline', localSize: 70 }),
        item({ attachmentId: 'att-ready', localSize: 60 }),
        item({ attachmentId: 'att-ready-unknown', localSize: undefined }),
      ],
      getAvailability: candidate => {
        if (candidate.attachmentId === 'att-ready' || candidate.attachmentId === 'att-ready-unknown') {
          return { canUpload: true, reasonLabel: 'Ready for explicit upload' };
        }
        if (candidate.attachmentId === 'att-disabled') {
          return { canUpload: false, reasonCode: 'upload_gate_unavailable', reasonLabel: 'Needs connection or upload availability before it can be considered ready' };
        }
        if (candidate.attachmentId === 'att-provider-unavailable') {
          return { canUpload: false, reasonCode: 'provider_unavailable', reasonLabel: 'Provider unavailable' };
        }
        if (candidate.attachmentId === 'att-session-expired') {
          return { canUpload: false, reasonCode: 'session_expired', reasonLabel: 'Session expired' };
        }
        if (candidate.attachmentId === 'att-token-unavailable') {
          return { canUpload: false, reasonCode: 'token_provider_unavailable', reasonLabel: 'Token provider unavailable' };
        }
        if (candidate.attachmentId === 'att-provider-mismatch') {
          return { canUpload: false, reasonCode: 'provider_mismatch', reasonLabel: 'Provider mismatch' };
        }
        if (candidate.attachmentId === 'att-missing-local') {
          return { canUpload: false, reasonCode: 'local_blob_missing', reasonLabel: 'Local blob missing' };
        }
        if (candidate.attachmentId === 'att-blocked-state') {
          return { canUpload: false, reasonCode: 'blocked_sync_state', reasonLabel: 'Sync state blocks upload' };
        }
        return undefined;
      },
    });

    expect(upload).not.toHaveBeenCalled();
    expect(readBlob).not.toHaveBeenCalled();
    expect(createAdapter).not.toHaveBeenCalled();
    expect(review.groups.eligible.map(candidate => candidate.attachmentId)).toEqual(['att-ready', 'att-ready-unknown']);
    expect(review.groups.blocked.map(candidate => candidate.attachmentId)).toEqual([
      'att-no-availability',
      'att-disabled',
      'att-provider-unavailable',
      'att-session-expired',
      'att-token-unavailable',
      'att-provider-mismatch',
      'att-missing-local',
      'att-blocked-state',
    ]);
    expect(review.summary.estimatedEligibleBytes).toBe(60);
    expect(review.summary.unknownEligibleSizeCount).toBe(1);
    expect(JSON.stringify(review.groups.blocked)).toContain('upload_gate_unavailable');
  });

  it('preserves specific manual-review reason codes instead of collapsing failed states', () => {
    const review = buildManualUploadQueueReview({
      items: [
        item({ attachmentId: 'att-metadata', remoteSyncStatus: 'failed', reason: 'metadata_update_failed' }),
        item({ attachmentId: 'att-conflict', remoteSyncStatus: 'failed', reason: 'remote_conflict requires review' }),
        item({ attachmentId: 'att-missing-remote', remoteSyncStatus: 'failed', reason: 'remote_file_missing' }),
        item({ attachmentId: 'att-invalid', remoteSyncStatus: 'failed', reason: 'invalid_remote_response' }),
        item({ attachmentId: 'att-verification', remoteSyncStatus: 'failed', reason: 'verification failed size_mismatch' }),
        item({ attachmentId: 'att-checksum', remoteSyncStatus: 'failed', reason: 'checksum mismatch' }),
      ],
      getAvailability: () => ({ canUpload: true, reasonLabel: 'Ready for explicit upload' }),
    });

    expect(review.groups.eligible).toHaveLength(0);
    expect(review.groups.manualReview.map(candidate => [candidate.attachmentId, candidate.reasonCode, candidate.label])).toEqual([
      ['att-metadata', 'metadata_update_failed', 'Upload needs manual review'],
      ['att-conflict', 'remote_conflict', 'Upload conflict needs review'],
      ['att-missing-remote', 'remote_file_missing', 'Upload target is unavailable'],
      ['att-invalid', 'invalid_remote_response', 'Upload response could not be verified'],
      ['att-verification', 'verification_failed', 'Uploaded file could not be verified'],
      ['att-checksum', 'checksum_mismatch', 'Uploaded file could not be verified'],
    ]);
  });

  it('keeps already-synced classification conservative', () => {
    const review = buildManualUploadQueueReview({
      items: [
        item({
          attachmentId: 'att-synced-safe',
          remoteProvider: 'googleDrive',
          remoteFileId: 'drive-file-1',
          remoteSyncStatus: 'synced',
          eligible: false,
          reason: 'Already synced',
        }),
        item({
          attachmentId: 'att-synced-missing-remote-id',
          remoteProvider: 'googleDrive',
          remoteFileId: undefined,
          remoteSyncStatus: 'synced',
          eligible: false,
          reason: 'Synced but remote file id missing',
        }),
      ],
      getAvailability: candidate => candidate.attachmentId === 'att-synced-safe'
        ? { canUpload: false, reasonCode: 'already_synced', reasonLabel: 'Already synced' }
        : { canUpload: false, reasonCode: 'remote_file_missing', reasonLabel: 'Upload target is unavailable' },
    });

    expect(review.groups.alreadySynced.map(candidate => candidate.attachmentId)).toEqual(['att-synced-safe']);
    expect(review.groups.eligible).toHaveLength(0);
    expect(review.groups.manualReview.map(candidate => candidate.attachmentId)).toEqual(['att-synced-missing-remote-id']);
    expect(review.groups.manualReview[0]).toMatchObject({
      reasonCode: 'remote_file_missing',
      label: 'Upload target is unavailable',
    });
  });
});
