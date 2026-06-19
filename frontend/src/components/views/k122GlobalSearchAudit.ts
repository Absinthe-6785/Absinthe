/**
 * K-122 — Remove always-visible global search from note header.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function auditGlobalSearchEntryPoints(): Record<string, boolean> {
  const editor = readFileSync(join(ROOT, 'components/views/noteview/NoteViewEditorArea.tsx'), 'utf8');
  const sidebar = readFileSync(join(ROOT, 'components/views/noteview/NoteViewSidebar.tsx'), 'utf8');
  const app = readFileSync(join(ROOT, 'components/AppContent.tsx'), 'utf8');
  const globalHost = readFileSync(join(ROOT, 'components/views/features/search/GlobalSearchHost.tsx'), 'utf8');
  const palette = readFileSync(join(ROOT, 'components/views/features/search/components/SearchWorkspacePalette.tsx'), 'utf8');
  return {
    noHeaderSearchBar: !editor.includes('data-k121-notes-search') && !editor.includes('k81WorkspaceSearchHint'),
    k122Header: editor.includes('data-k122-notes-header'),
    sidebarTrigger: sidebar.includes('openWorkspaceSearch'),
    ctrlShiftF: app.includes("e.key.toLowerCase() === 'f'") && app.includes('openWorkspaceSearch'),
    modalHostOnly: palette.includes('if (!open) return null'),
    registerOpener: globalHost.includes('registerWorkspaceSearchOpener'),
  };
}

export function auditGlobalSearchRc(): boolean {
  return Object.values(auditGlobalSearchEntryPoints()).every(Boolean);
}
