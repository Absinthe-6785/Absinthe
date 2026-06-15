import { useCallback, useSyncExternalStore } from 'react';
import {
  clearNoteReturnTab,
  getNoteReturnTab,
  returnFromNote,
  subscribeNoteReturnTab,
} from '../lib/noteNavigation';
import type { TabId } from '../components/common/Sidebar';

function getSnapshot(): TabId | null {
  return getNoteReturnTab();
}

export function useNoteReturnTab() {
  const returnTab = useSyncExternalStore(subscribeNoteReturnTab, getSnapshot, getSnapshot);

  const goReturn = useCallback(() => returnFromNote(), []);
  const clearReturn = useCallback(() => clearNoteReturnTab(), []);

  return { returnTab, goReturn, clearReturn };
}
