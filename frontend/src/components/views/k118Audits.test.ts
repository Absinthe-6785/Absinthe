import { describe, expect, it } from 'vitest';
import { auditImageRc } from './k118ImageAudit';
import { auditGalleryRc } from './k118GalleryAudit';
import { auditFileRc } from './k118FileAudit';
import { auditEmbedRc } from './k118EmbedAudit';
import { auditMobileEditorRc } from './k118MobileEditorAudit';
import { auditMobileLayoutRc, K118_MOBILE_WIDTHS } from './k118MobileLayoutAudit';
import { auditClipboardRc } from './k118ClipboardAudit';
import { auditPreviewRc } from './k118PreviewAudit';

describe('k118 mobile media refinement audits', () => {
  it('A — image experience', () => {
    expect(auditImageRc()).toBe(true);
  });

  it('A — image gallery', () => {
    expect(auditGalleryRc()).toBe(true);
  });

  it('B — file previews', () => {
    expect(auditFileRc()).toBe(true);
  });

  it('C — embed previews', () => {
    expect(auditEmbedRc()).toBe(true);
  });

  it('D — mobile editor', () => {
    expect(auditMobileEditorRc()).toBe(true);
  });

  it('E — mobile layouts', () => {
    expect(auditMobileLayoutRc()).toBe(true);
    expect(K118_MOBILE_WIDTHS).toEqual([320, 375, 768, 1440]);
  });

  it('F — media clipboard', () => {
    expect(auditClipboardRc()).toBe(true);
  });

  it('G — preview density', () => {
    expect(auditPreviewRc()).toBe(true);
  });
});
