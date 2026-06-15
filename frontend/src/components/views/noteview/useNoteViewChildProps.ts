import { useMemo } from 'react';
import type { NoteViewSidebarLayout, NoteViewSidebarData, NoteViewSidebarHandlers } from './NoteViewSidebar';
import type { NoteViewEditorLayout, NoteViewEditorData, NoteViewEditorHandlers } from './NoteViewEditorArea';
import type {
  NoteContextPanelData,
  NoteContextPanelHandlers,
  NoteContextEditorContext,
  NoteContextDashboardContext,
} from './NoteContextPanelBody';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';
import type { KnowledgeContextTab } from '../features/knowledge/components/KnowledgeContextPanel';
import { useNoteViewSidebarProps } from './useNoteViewSidebarProps';
import { useNoteViewEditorAreaProps } from './useNoteViewEditorAreaProps';
import { useNoteContextPanelProps } from './useNoteContextPanelProps';

export interface NoteViewChildPropsSources {
  sidebarLayout: NoteViewSidebarLayout;
  sidebarData: NoteViewSidebarData;
  sidebarHandlers: NoteViewSidebarHandlers;
  editorLayout: NoteViewEditorLayout;
  editorData: NoteViewEditorData;
  editorHandlers: NoteViewEditorHandlers;
  context: {
    colors: NoteChromeColors;
    rightPanel: KnowledgeContextTab;
    activeNote: Note | null;
    panelData: NoteContextPanelData;
    panelHandlers: NoteContextPanelHandlers;
    editorContext: NoteContextEditorContext;
    dashboardContext: NoteContextDashboardContext;
  };
}

export function useNoteViewChildProps(sources: NoteViewChildPropsSources) {
  const sidebarProps = useNoteViewSidebarProps({
    ...sources.sidebarLayout,
    ...sources.sidebarData,
    ...sources.sidebarHandlers,
  });

  const editorAreaProps = useNoteViewEditorAreaProps({
    ...sources.editorLayout,
    ...sources.editorData,
    ...sources.editorHandlers,
  });

  const contextPanelProps = useNoteContextPanelProps({
    colors: sources.context.colors,
    rightPanel: sources.context.rightPanel,
    activeNote: sources.context.activeNote,
    panelData: sources.context.panelData,
    panelHandlers: sources.context.panelHandlers,
    editorContext: sources.context.editorContext,
    dashboardContext: sources.context.dashboardContext,
  });

  return useMemo(
    () => ({ sidebarProps, editorAreaProps, contextPanelProps }),
    [sidebarProps, editorAreaProps, contextPanelProps],
  );
}
