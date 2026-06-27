import { describe, expect, it } from 'vitest';
import { runK144BlobAttachmentEgressAudit } from './k144BlobAttachmentEgressAudit';

describe('K-144 blob / attachment egress audit', () => {
  it('keeps Notes sync payload lightweight and sanitized', () => {
    const audit = runK144BlobAttachmentEgressAudit();

    expect(audit.noteSyncPayloadFields).toEqual([
      'id',
      'title',
      'body',
      'updated_at',
      'folder_id',
      'deleted_at',
      'starred',
      'properties',
      'relations',
    ]);
    expect(audit.noteSyncPayloadSanitizesBlobData).toBe(true);
    expect(audit.noteModelHasRawAttachmentField).toBe(false);
  });

  it('does not auto-wire Supabase Storage or signed URL calls into boot surfaces', () => {
    const audit = runK144BlobAttachmentEgressAudit();

    expect(audit.supabaseStorageCallSites).toEqual([]);
    expect(audit.localModeDefault).toBe(true);
  });

  it('documents current local-only image data entry points without remote storage fetches', () => {
    const audit = runK144BlobAttachmentEgressAudit();

    expect(audit.userGeneratedBlobEntryPoints).toEqual([
      'ImageBlock file/drop/paste stores local data URLs',
      'Note editor drag-drop image import stores local data URLs',
      'Note editor paste image import stores local data URLs',
    ]);
  });

  it('keeps graph and discovery away from raw blob hydration APIs', () => {
    const audit = runK144BlobAttachmentEgressAudit();

    expect(audit.knowledgeRawBlobHydrationRisks).toEqual([]);
  });

  it('limits Blob object URLs to explicit export/download paths', () => {
    const audit = runK144BlobAttachmentEgressAudit();

    expect(audit.explicitExportBlobPaths).toEqual([
      'vaultBackupZip explicit download',
      'exportVaultBackup explicit download',
      'csvExport explicit download',
    ]);
  });
});
