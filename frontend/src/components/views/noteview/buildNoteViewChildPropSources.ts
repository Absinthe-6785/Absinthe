import type { NoteViewChildPropsSources } from './useNoteViewChildProps';
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

export interface NoteViewChildPropBuildParams {
  sidebarLayout: NoteViewSidebarLayout;
  sidebarData: NoteViewSidebarData;
  sidebarHandlers: NoteViewSidebarHandlers;
  editorLayout: NoteViewEditorLayout;
  editorData: NoteViewEditorData;
  editorHandlers: NoteViewEditorHandlers;
  contextColors: NoteChromeColors;
  contextRightPanel: KnowledgeContextTab;
  contextActiveNote: Note | null;
  contextPanelData: NoteContextPanelData;
  contextPanelHandlers: NoteContextPanelHandlers;
  contextEditorContext: NoteContextEditorContext;
  contextDashboardContext: NoteContextDashboardContext;
}

export function buildNoteViewChildPropSources(params: NoteViewChildPropBuildParams): NoteViewChildPropsSources {
  return {
    sidebarLayout: params.sidebarLayout,
    sidebarData: params.sidebarData,
    sidebarHandlers: params.sidebarHandlers,
    editorLayout: params.editorLayout,
    editorData: params.editorData,
    editorHandlers: params.editorHandlers,
    context: {
      colors: params.contextColors,
      rightPanel: params.contextRightPanel,
      activeNote: params.contextActiveNote,
      panelData: params.contextPanelData,
      panelHandlers: params.contextPanelHandlers,
      editorContext: params.contextEditorContext,
      dashboardContext: params.contextDashboardContext,
    },
  };
}
