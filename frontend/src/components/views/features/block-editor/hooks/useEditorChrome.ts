import { useCallback, useEffect, useRef, useState } from 'react';
import type { TurnIntoMenuState } from '../../../editorTypes';
import { CHROME_LEAVE_DELAY_MS } from '../constants/blockEditorConstants';
import { isControlsVisible } from '../utils/controlsVisibility';

export interface UseEditorChromeOptions {
  onPinSelection: (id: string) => void;
}

export interface UseEditorChromeResult {
  handleMenu: TurnIntoMenuState | null;
  setHandleMenu: React.Dispatch<React.SetStateAction<TurnIntoMenuState | null>>;
  pinnedControlsId: string | null;
  setPinnedControlsId: React.Dispatch<React.SetStateAction<string | null>>;
  chromeHoverId: string | null;
  handleChromeEnter: (id: string) => void;
  handleChromeLeave: () => void;
  handleToggleControlsPin: (id: string) => void;
  controlsVisibleFor: (blockId: string) => boolean;
}

export function useEditorChrome({
  onPinSelection,
}: UseEditorChromeOptions): UseEditorChromeResult {
  const [handleMenu, setHandleMenu] = useState<TurnIntoMenuState | null>(null);
  const [pinnedControlsId, setPinnedControlsId] = useState<string | null>(null);
  const [chromeHoverId, setChromeHoverId] = useState<string | null>(null);
  const chromeLeaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleToggleControlsPin = useCallback((id: string) => {
    setPinnedControlsId(prev => {
      if (prev !== id) {
        onPinSelection(id);
      }
      return prev === id ? null : id;
    });
  }, [onPinSelection]);

  const handleChromeEnter = useCallback((id: string) => {
    if (chromeLeaveTimer.current) {
      clearTimeout(chromeLeaveTimer.current);
      chromeLeaveTimer.current = null;
    }
    setChromeHoverId(id);
  }, []);

  const handleChromeLeave = useCallback(() => {
    if (chromeLeaveTimer.current) clearTimeout(chromeLeaveTimer.current);
    chromeLeaveTimer.current = setTimeout(() => {
      setChromeHoverId(null);
      chromeLeaveTimer.current = null;
    }, CHROME_LEAVE_DELAY_MS);
  }, []);

  useEffect(() => () => {
    if (chromeLeaveTimer.current) clearTimeout(chromeLeaveTimer.current);
  }, []);

  const controlsVisibleFor = useCallback((blockId: string) =>
    isControlsVisible(blockId, pinnedControlsId, handleMenu, chromeHoverId),
  [pinnedControlsId, handleMenu, chromeHoverId]);

  useEffect(() => {
    if (!pinnedControlsId && !handleMenu) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest('.be-handles, .be-block-handle-menu')) return;
      setPinnedControlsId(null);
      setHandleMenu(null);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [pinnedControlsId, handleMenu]);

  return {
    handleMenu,
    setHandleMenu,
    pinnedControlsId,
    setPinnedControlsId,
    chromeHoverId,
    handleChromeEnter,
    handleChromeLeave,
    handleToggleControlsPin,
    controlsVisibleFor,
  };
}
