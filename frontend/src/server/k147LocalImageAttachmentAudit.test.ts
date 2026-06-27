import { describe, expect, it } from 'vitest';
import { runK147LocalImageAttachmentAudit } from './k147LocalImageAttachmentAudit';

describe('K-147 local image attachment prototype audit', () => {
  it('stores image blobs separately from note rows', () => {
    const audit = runK147LocalImageAttachmentAudit();

    expect(audit.localBlobStoreName).toBe('absinthe.attachments.blobs');
    expect(audit.localMetadataStoreName).toBe('absinthe.attachments.metadata');
    expect(audit.noteBodyReferenceOnly).toBe(true);
    expect(audit.notePayloadReferenceOnly).toBe(true);
  });

  it('wires the Notes prototype through the local attachment helper', () => {
    const audit = runK147LocalImageAttachmentAudit();

    expect(audit.noteUiHasAttachImagePrototype).toBe(true);
    expect(audit.noteUiUsesLocalAttachmentHelper).toBe(true);
    expect(audit.noDataUrlInsertionPaths).toBe(true);
  });

  it('preserves local-mode remote and metadata boundaries', () => {
    const audit = runK147LocalImageAttachmentAudit();

    expect(audit.noRemoteObjectStoreCalls).toBe(true);
    expect(audit.k146MetadataBoundaryStillIntact).toBe(true);
  });
});
