/**
 * K-120 — Workspace error boundary audit.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export const K120_BOUNDARY_WORKSPACES = [
  'image-gallery',
  'recipe',
  'search',
  'archive',
  'health',
] as const;

export function auditErrorBoundaries(): Record<string, boolean> {
  const boundary = readFileSync(join(ROOT, 'components/common/WorkspaceErrorBoundary.tsx'), 'utf8');
  const gallery = readFileSync(join(ROOT, 'components/views/ImageGalleryViewer.tsx'), 'utf8');
  const recipe = readFileSync(join(ROOT, 'components/views/RecipeView.tsx'), 'utf8');
  const search = readFileSync(join(ROOT, 'components/views/features/search/components/SearchWorkspacePalette.tsx'), 'utf8');
  const archive = readFileSync(join(ROOT, 'components/views/features/archive/ArchiveShell.tsx'), 'utf8');
  const health = readFileSync(join(ROOT, 'components/views/HealthView.tsx'), 'utf8');
  return {
    boundaryComponent: boundary.includes('WorkspaceErrorBoundary') && boundary.includes('getDerivedStateFromError'),
    boundaryHook: boundary.includes('data-k120-workspace-boundary'),
    galleryWrapped: gallery.includes('WorkspaceErrorBoundary'),
    recipeWrapped: recipe.includes('WorkspaceErrorBoundary'),
    searchWrapped: search.includes('WorkspaceErrorBoundary'),
    archiveWrapped: archive.includes('WorkspaceErrorBoundary'),
    healthWrapped: health.includes('WorkspaceErrorBoundary'),
    blockBoundaryRetained: readFileSync(join(ROOT, 'components/views/SafeBlockRenderer.tsx'), 'utf8').includes('getDerivedStateFromError'),
  };
}

export function auditErrorBoundaryRc(): boolean {
  const r = auditErrorBoundaries();
  return r.boundaryComponent && r.galleryWrapped && r.recipeWrapped && r.searchWrapped && r.archiveWrapped && r.healthWrapped;
}
