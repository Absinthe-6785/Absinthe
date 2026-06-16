import { useSyncExternalStore, type KeyboardEvent, type RefObject } from 'react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { TocItem } from '../noteUtils';
import { OutlinePanel } from '../features/knowledge/components/OutlinePanel';
import {
  getTocScrollActiveIdx,
  subscribeTocScrollActiveIdx,
} from './tocScrollStore';
import { useRenderDiagnostic } from './renderDiagnostics';

export interface NoteContextTocOutlineProps {
  colors: NoteChromeColors;
  panelRef: RefObject<HTMLDivElement | null>;
  visibleToc: (TocItem & { idx: number; hasChildren: boolean })[];
  tocKeyboardIdx: number | null;
  tocCollapsed: Record<number, boolean>;
  onKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  onToggleCollapse: (idx: number) => void;
  onNavigate: (headingIdx: number) => void;
}

/** TOC outline — scroll highlight via external store (no NoteView rerender). */
export function NoteContextTocOutline({
  colors,
  panelRef,
  visibleToc,
  tocKeyboardIdx,
  tocCollapsed,
  onKeyDown,
  onToggleCollapse,
  onNavigate,
}: NoteContextTocOutlineProps) {
  useRenderDiagnostic('NoteContextTocOutline');

  const scrollActiveIdx = useSyncExternalStore(
    subscribeTocScrollActiveIdx,
    getTocScrollActiveIdx,
    getTocScrollActiveIdx,
  );

  const highlightedIdx = tocKeyboardIdx ?? scrollActiveIdx;

  return (
    <OutlinePanel
      colors={colors}
      panelRef={panelRef}
      items={visibleToc}
      highlightedIdx={highlightedIdx}
      collapsed={tocCollapsed}
      onKeyDown={onKeyDown}
      onToggleCollapse={onToggleCollapse}
      onNavigate={onNavigate}
    />
  );
}
