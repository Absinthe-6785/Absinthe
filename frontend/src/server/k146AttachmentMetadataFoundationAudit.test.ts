import { describe, expect, it } from 'vitest';
import { runK146AttachmentMetadataFoundationAudit } from './k146AttachmentMetadataFoundationAudit';

describe('K-146 attachment metadata foundation audit', () => {
  it('keeps attachment metadata in a local IndexedDB foundation', () => {
    const audit = runK146AttachmentMetadataFoundationAudit();

    expect(audit.localMetadataStoreName).toBe('absinthe.attachments.metadata');
    expect(audit.repositoryHasLocalIndexedDbDriver).toBe(true);
    expect(audit.repositoryHasRequiredMethods).toBe(true);
    expect(audit.repositoryRejectsRawMetadataPayloads).toBe(true);
  });

  it('preserves lightweight note references while excluding raw blob payloads', () => {
    const audit = runK146AttachmentMetadataFoundationAudit();

    expect(audit.notePayloadKeepsAttachmentReference).toBe(true);
    expect(audit.notePayloadRemovesRawBlobPayload).toBe(true);
    expect(audit.k145BoundaryStillIntact).toBe(true);
  });
});
