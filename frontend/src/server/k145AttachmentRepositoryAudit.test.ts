import { describe, expect, it } from 'vitest';
import { runK145AttachmentRepositoryAudit } from './k145AttachmentRepositoryAudit';

describe('K-145 attachment repository / blob adapter design audit', () => {
  it('formalizes attachment references without raw note-row blob payloads', () => {
    const audit = runK145AttachmentRepositoryAudit();

    expect(audit.attachmentReferenceExample).toBe('attachment://att-audit');
    expect(audit.noteSyncPayloadPreservesAttachmentReference).toBe(true);
    expect(audit.noteSyncPayloadStripsRawBlobData).toBe(true);
    expect(audit.notesModelHasAttachmentIdsOnly).toBe(true);
  });

  it('keeps attachment metadata and blob bytes behind separate contracts', () => {
    const audit = runK145AttachmentRepositoryAudit();

    expect(audit.attachmentBoundaryHasRepositoryContract).toBe(true);
    expect(audit.attachmentBoundaryHasBlobAdapterContract).toBe(true);
    expect(audit.metadataBoundaryIsLightweight).toBe(true);
  });

  it('does not introduce remote object-store egress while documenting local entry points', () => {
    const audit = runK145AttachmentRepositoryAudit();

    expect(audit.noRemoteObjectStoreCalls).toBe(true);
    expect(audit.currentLocalBlobEntryPoints).toEqual([]);
  });
});
