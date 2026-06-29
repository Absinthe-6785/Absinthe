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
});
