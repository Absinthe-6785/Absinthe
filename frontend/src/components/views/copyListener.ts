/**
 * copyListener.ts — Production copy handler registration (UX-3A.3)
 *
 * Semantic copy must run in all builds. Dev diagnostics are separate.
 */
import { handleEditorCopyEvent } from './blockCopy';
import type { CopyTraceReport } from './copyDiagnostics';
import { setLastCopyTraceReport } from './copyTraceStore';
import type { Block } from './blockUtils';

export interface EditorCopyListenerOptions {
  getRootBlocks: () => Block[];
  getSelectedIds: () => Set<string>;
  onReport?: (report: CopyTraceReport | null) => void;
}

/** Root-level window copy listener — always registered (not DEV-gated). */
export function installEditorCopyListener(opts: EditorCopyListenerOptions): () => void {
  const onCopy = (e: ClipboardEvent) => {
    const report = handleEditorCopyEvent(
      e,
      opts.getRootBlocks(),
      opts.getSelectedIds(),
    );
    setLastCopyTraceReport(report);
    opts.onReport?.(report);
  };

  window.addEventListener('copy', onCopy);
  return () => {
    window.removeEventListener('copy', onCopy);
    setLastCopyTraceReport(null);
  };
}
