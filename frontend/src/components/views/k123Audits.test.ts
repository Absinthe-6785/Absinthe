import { describe, expect, it } from 'vitest';
import { auditEditorCenterRc } from './k123EditorCenterAudit';
import { auditBlockGutterRc } from './k123BlockGutterAudit';
import { auditToolbarRc } from './k123ToolbarAudit';
import { auditWidthRc } from './k123WidthAudit';
import { auditHandleRc } from './k123HandleAudit';
import { auditFindPanelRc } from './k123FindPanelAudit';
import { auditResponsiveRc } from './k123ResponsiveAudit';

describe('k123 editor layout recovery audits', () => {
  it('A — editor content centering', () => {
    expect(auditEditorCenterRc()).toBe(true);
  });

  it('B — block interaction gutter', () => {
    expect(auditBlockGutterRc()).toBe(true);
  });

  it('C — toolbar positioning', () => {
    expect(auditToolbarRc()).toBe(true);
  });

  it('D — wide document column width', () => {
    expect(auditWidthRc()).toBe(true);
  });

  it('E — block handles', () => {
    expect(auditHandleRc()).toBe(true);
  });

  it('F — find-in-note placement', () => {
    expect(auditFindPanelRc()).toBe(true);
  });

  it('G — responsive layout', () => {
    expect(auditResponsiveRc()).toBe(true);
  });
});
