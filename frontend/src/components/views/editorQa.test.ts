// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { makeBlock } from './blockUtils';

describe('editorQa production gating (UX-4E)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('skips clipboard verification hooks when DEV is false', async () => {
    vi.stubEnv('DEV', false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { verifyCopyClipboardSync } = await import('./copyClipboardVerification');
    const { scheduleBrowserClipboardCapture } = await import('./browserClipboardCapture');

    const e = { clipboardData: { getData: () => '' } } as ClipboardEvent;
    expect(verifyCopyClipboardSync(e, null)).toBeNull();
    scheduleBrowserClipboardCapture(e, null);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('skips paste pipeline trace when DEV is false', async () => {
    vi.stubEnv('DEV', false);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { beginPastePipelineTrace, finishPastePipelineTrace, isPasteTraceActive } =
      await import('./pastePipelineTrace');

    beginPastePipelineTrace('test');
    expect(isPasteTraceActive()).toBe(false);
    expect(finishPastePipelineTrace()).toBeNull();
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('copy listener performs semantic copy without QA console output when DEV is false', async () => {
    vi.stubEnv('DEV', false);
    vi.resetModules();
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { installEditorCopyListener } = await import('./copyListener');
    const toggle = makeBlock('toggle', {
      id: 't1',
      content: 'Grammar Module',
      children: [makeBlock('paragraph', { content: 'child' })],
    });

    const uninstall = installEditorCopyListener({
      getRootBlocks: () => [toggle],
      getSelectedIds: () => new Set(['t1']),
    });

    const clipboard = new DataTransfer();
    window.dispatchEvent(new ClipboardEvent('copy', {
      clipboardData: clipboard,
      bubbles: true,
      cancelable: true,
    }));

    await Promise.resolve();
    expect(clipboard.getData('text/html')).toContain('<details');
    const qaWarns = warnSpy.mock.calls.filter(([msg]) =>
      String(msg).includes('[UX-3A copy:'),
    );
    expect(qaWarns).toHaveLength(0);

    uninstall();
    warnSpy.mockRestore();
  });
});
