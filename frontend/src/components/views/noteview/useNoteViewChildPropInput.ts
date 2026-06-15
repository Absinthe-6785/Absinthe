import { useMemo } from 'react';
import { buildNoteViewChildPropSources, type NoteViewChildPropBuildParams } from './buildNoteViewChildPropSources';
import type { NoteViewChildPropsSources } from './useNoteViewChildProps';

export function useNoteViewChildPropInput(params: NoteViewChildPropBuildParams): NoteViewChildPropsSources {
  const {
    sidebarLayout,
    sidebarData,
    sidebarHandlers,
    editorLayout,
    editorData,
    editorHandlers,
    contextColors,
    contextRightPanel,
    contextActiveNote,
    contextPanelData,
    contextPanelHandlers,
    contextEditorContext,
    contextDashboardContext,
  } = params;

  return useMemo(
    () => buildNoteViewChildPropSources(params),
    [
      sidebarLayout,
      sidebarData,
      sidebarHandlers,
      editorLayout,
      editorData,
      editorHandlers,
      contextColors,
      contextRightPanel,
      contextActiveNote,
      contextPanelData,
      contextPanelHandlers,
      contextEditorContext,
      contextDashboardContext,
    ],
  );
}
