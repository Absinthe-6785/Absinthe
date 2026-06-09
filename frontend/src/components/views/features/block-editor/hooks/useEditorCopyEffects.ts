import { useEffect } from 'react';
import type { Block } from '../../../blockUtils';
import { installCopyDiagnostics } from '../../../copyDiagnostics';
import { installEditorCopyListener } from '../../../copyListener';

export interface UseEditorCopyEffectsOptions {
  readOnly: boolean;
  depth: number;
  getRootBlocks: () => Block[];
  getSelectedIds: () => Set<string>;
}

export function useEditorCopyEffects({
  readOnly,
  depth,
  getRootBlocks,
  getSelectedIds,
}: UseEditorCopyEffectsOptions): void {
  useEffect(() => {
    if (depth !== 0) return;

    const uninstallCopy = installEditorCopyListener({
      getRootBlocks,
      getSelectedIds,
    });

    const uninstallDiag = installCopyDiagnostics({
      readOnly,
      depth,
      getRootBlocks,
      getSelectedIds,
    });

    return () => {
      uninstallCopy();
      uninstallDiag();
    };
  }, [readOnly, depth, getRootBlocks]);
}
