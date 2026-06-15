import { useMemo } from 'react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';
import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import type {
  NoteContextPanelBodyProps,
  NoteContextPanelData,
  NoteContextPanelHandlers,
  NoteContextEditorContext,
  NoteContextDashboardContext,
} from './NoteContextPanelBody';

export interface UseNoteContextPanelPropsInput {
  colors: NoteChromeColors;
  rightPanel: KnowledgeContextTab;
  activeNote: Note | null;
  panelData: NoteContextPanelData;
  panelHandlers: NoteContextPanelHandlers;
  editorContext: NoteContextEditorContext;
  dashboardContext: NoteContextDashboardContext;
}

export function useNoteContextPanelProps(input: UseNoteContextPanelPropsInput): Omit<NoteContextPanelBodyProps, never> {
  const {
    colors,
    rightPanel,
    activeNote,
    panelData,
    panelHandlers,
    editorContext,
    dashboardContext,
  } = input;

  return useMemo(() => ({
    colors,
    rightPanel,
    activeNote,
    panelData,
    panelHandlers,
    editorContext,
    dashboardContext,
  }), [
    colors,
    rightPanel,
    activeNote,
    panelData,
    panelHandlers,
    editorContext,
    dashboardContext,
  ]);
}
