import { useCallback, useSyncExternalStore } from 'react';
import {
  getNoteNavigationSnapshot,
  goBackNote,
  goForwardNote,
  subscribeNoteNavigationStack,
} from '../lib/noteNavigationStack';

export function useNoteNavigationStack() {
  const { canBack, canForward } = useSyncExternalStore(
    subscribeNoteNavigationStack,
    getNoteNavigationSnapshot,
    getNoteNavigationSnapshot,
  );

  const goBack = useCallback(() => goBackNote(), []);
  const goForward = useCallback(() => goForwardNote(), []);

  return { canBack, canForward, goBack, goForward };
}
