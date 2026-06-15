import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'absinthe-knowledge-panel-width';
const DEFAULT_WIDTH = 230;
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;

export function useResizablePanelWidth(compact?: boolean, tablet?: boolean) {
  const [width, setWidth] = useState(() => {
    if (compact) return DEFAULT_WIDTH;
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed) && parsed >= MIN_WIDTH && parsed <= MAX_WIDTH) return parsed;
    } catch { /* ignore */ }
    return tablet ? 210 : DEFAULT_WIDTH;
  });

  useEffect(() => {
    if (compact) return;
    try {
      localStorage.setItem(STORAGE_KEY, String(width));
    } catch { /* ignore */ }
  }, [width, compact]);

  const onResizeDrag = useCallback((clientX: number, containerRight: number) => {
    const next = Math.round(containerRight - clientX);
    setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, next)));
  }, []);

  return { width, onResizeDrag, minWidth: MIN_WIDTH, maxWidth: MAX_WIDTH };
}
