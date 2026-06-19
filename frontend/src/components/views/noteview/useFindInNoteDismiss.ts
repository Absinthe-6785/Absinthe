import { useEffect, type RefObject } from 'react';
import { EDITOR_DOCUMENT_SEARCH_ATTR } from '../searchFocusIsolation';

export interface UseFindInNoteDismissOptions {
  open: boolean;
  panelRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
}

/** K-122 — dismiss find-in-note on outside pointer down. */
export function useFindInNoteDismiss({ open, panelRef, onDismiss }: UseFindInNoteDismissOptions): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (target instanceof HTMLElement && target.closest(`[${EDITOR_DOCUMENT_SEARCH_ATTR}]`)) return;
      onDismiss();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open, panelRef, onDismiss]);
}
