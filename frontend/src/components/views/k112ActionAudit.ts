/** K-112 — Action duplication audit and subtraction record. */
export const K112_CANONICAL_ACTIONS = {
  newNote: 'data-noteview-new-note-btn',
  globalSearch: 'openWorkspaceSearch',
  settings: 'Sidebar-settings',
  shortcuts: 'sidebar-keyboard-button',
} as const;

export const K112_REMOVED_DUPLICATE_ACTIONS = [
  { id: 'dashboard-new-note', location: 'WorkspaceDashboardView.tsx', reason: 'sidebar + Ctrl+N cover creation' },
  { id: 'dashboard-open-search', location: 'WorkspaceDashboardView.tsx', reason: 'sidebar search trigger + shortcuts' },
  { id: 'sidebar-vault-export', location: 'NoteViewSidebar.tsx toolbar', reason: 'Settings → Export/Recovery canonical' },
  { id: 'sidebar-vault-restore', location: 'NoteViewSidebar.tsx toolbar', reason: 'Settings → Recovery canonical' },
  { id: 'mobile-list-settings', location: 'NoteViewSidebar mobile More', reason: 'Sidebar Settings tab' },
  { id: 'editor-mobile-settings', location: 'NoteEditorHeaderActions mobile More', reason: 'Sidebar Settings tab' },
  { id: 'mobile-list-export-all', location: 'NoteViewSidebar mobile More', reason: 'Settings → Export' },
  { id: 'legacy-workspace-search-palette', location: 'WorkspaceSearchPalette.tsx', reason: 'K-111 GlobalSearchHost' },
  { id: 'dead-workspaceSearchOpen-state', location: 'useNoteViewState.ts', reason: 'unused after K-111 lift' },
] as const;

export const K112_SEARCH_ENTRY_POINTS = [
  { id: 'global', hook: 'data-k111-search-modal', shortcut: 'Ctrl+Shift+F' },
  { id: 'sidebar-trigger', hook: 'openWorkspaceSearch', shortcut: 'Ctrl+K' },
  { id: 'note-list-filter', hook: 'sidebarSearchQuery', shortcut: null },
  { id: 'document-search', hook: 'data-document-search', shortcut: 'Ctrl+F' },
] as const;

export function auditActionDuplication(): readonly string[] {
  return [
    ...Object.values(K112_CANONICAL_ACTIONS),
    ...K112_REMOVED_DUPLICATE_ACTIONS.map(a => a.id),
    ...K112_SEARCH_ENTRY_POINTS.map(s => s.id),
  ];
}

export function auditRemovedActionCount(): number {
  return K112_REMOVED_DUPLICATE_ACTIONS.length;
}
