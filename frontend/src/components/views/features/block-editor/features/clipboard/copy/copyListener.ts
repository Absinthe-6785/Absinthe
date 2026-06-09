/**
 * copyListener.ts — Production copy handler registration (UX-3A.3)
 *
 * Semantic copy runs in all builds. QA clipboard verification is dev-only.
 */
import { scheduleBrowserClipboardCapture } from './browserClipboardCapture';
import { handleEditorCopyEvent } from './blockCopy';
import { verifyCopyClipboardSync } from './copyClipboardVerification';
import type { CopyTraceReport } from './copyDiagnostics';
import { setLastCopyTraceReport } from './copyTraceStore';
import { isEditorQaEnabled } from '../../../../../editorQa';
import type { Block } from '../../../../../blockUtils';

export interface EditorCopyListenerOptions {
  getRootBlocks: () => Block[];
  getSelectedIds: () => Set<string>;
  onReport?: (report: CopyTraceReport | null) => void;
}

function runCopyQaHooks(e: ClipboardEvent, report: CopyTraceReport | null): void {
  if (!isEditorQaEnabled()) return;
  setLastCopyTraceReport(report);
  verifyCopyClipboardSync(e, report);
  scheduleBrowserClipboardCapture(e, report);
}

/** Root-level window copy listener — semantic copy always; QA hooks dev-only. */
export function installEditorCopyListener(opts: EditorCopyListenerOptions): () => void {
  const onCopy = (e: ClipboardEvent) => {
    const report = handleEditorCopyEvent(
      e,
      opts.getRootBlocks(),
      opts.getSelectedIds(),
    );
    runCopyQaHooks(e, report);
    opts.onReport?.(report);
  };

  window.addEventListener('copy', onCopy);
  return () => {
    window.removeEventListener('copy', onCopy);
    if (isEditorQaEnabled()) setLastCopyTraceReport(null);
  };
}
