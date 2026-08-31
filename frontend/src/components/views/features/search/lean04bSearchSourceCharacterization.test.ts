import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(relativePath: string): string {
  return readFileSync(join(process.cwd(), 'src', relativePath), 'utf8');
}

describe('LEAN_04B Search source characterization', () => {
  it('pins the continuously mounted host and the existing global keyboard opener', () => {
    const app = source('components/AppContent.tsx');
    const host = source('components/views/features/search/GlobalSearchHost.tsx');
    expect(app).toContain("import { registerNotesTabSwitcher, registerAppTabSwitcher, openWorkspaceSearch } from '../lib/noteNavigation';");
    expect(app).toContain("if (mod && e.shiftKey && e.key.toLowerCase() === 'f')");
    expect(app).toContain('openWorkspaceSearch();');
    expect(app).toContain('<GlobalSearchHost');
    expect(host).toContain('const [open, setOpen] = useState(false);');
    expect(host).toContain('registerWorkspaceSearchOpener(() => setOpen(true))');
    expect(host).toContain('<SearchWorkspacePalette');
  });

  it('pins that closed Search still builds discovery and projection work while the palette subtree returns null', () => {
    const host = source('components/views/features/search/GlobalSearchHost.tsx');
    const palette = source('components/views/features/search/components/SearchWorkspacePalette.tsx');
    expect(host).toContain('buildDiscoveryFeed(notes, knowledgeIndexService)');
    expect(host).toContain('const projection = useSearchProjection({');
    expect(host).not.toContain('if (!open) return null');
    expect(palette).toContain('if (!open) return null;');
    expect(palette).toContain('isSearching ?');
    expect(palette).toContain('projection.empty.noResults');
  });

  it('pins current dataset ownership and the only open-driven Search fetch', () => {
    const app = source('components/AppContent.tsx');
    const host = source('components/views/features/search/GlobalSearchHost.tsx');
    const projection = source('components/views/features/search/buildSearchProjection.ts');
    expect(app).toContain('schedules={schedules}');
    expect(app).toContain('todos={todos}');
    expect(app).toContain('routines={routines}');
    expect(app).toContain('workouts={workouts}');
    expect(app).toContain('healthBlocks={healthBlocks}');
    expect(app).toContain('weeklySchedules={weeklySchedules}');
    expect(app.indexOf('<GlobalSearchHost')).toBeGreaterThan(app.indexOf('</Suspense>'));
    expect(host).not.toContain('inbody');
    expect(host).toContain('accountBoundRemoteKey(`${API_URL}/api/recipes`, accountId, open)');
    expect(host).toContain('recipes,');
    expect(source('components/views/RecipeView.tsx')).toContain('accountBoundRemoteKey(`${API_URL}/api/recipes`, accountId)');
    expect(projection).toContain('const plannerResults = trimmed');
    expect(projection).toContain('const healthResults = trimmed');
    expect(projection).toContain('const recipeResults = trimmed');
    expect(projection).toContain('const empty = {');
  });

  it('pins the account and local-mode source boundaries without changing them', () => {
    const daily = source('hooks/useDaily.ts');
    const statics = source('hooks/useStatic.ts');
    const host = source('components/views/features/search/GlobalSearchHost.tsx');
    expect(daily).toContain('remoteSWRKey(`${base}/todos?date=${dateStr}`)');
    expect(daily).toContain("localMode && accountId && healthReady ? ['local-health-daily', accountId, dateStr]");
    expect(statics).toContain("['health-static', accountId, remoteKey]");
    expect(statics).toContain('const localHealthKey = localHealthCacheKey && healthReady && (healthBlocksEnabled || healthRoutinesEnabled)');
    expect(statics).toContain('readLocalHealthStatic(ownerId)');
    expect(host).toContain('accountId?: string');
  });

  it('pins that Search has no dataset readiness or account-generation state today', () => {
    const host = source('components/views/features/search/GlobalSearchHost.tsx');
    const projection = source('components/views/features/search/buildSearchProjection.ts');
    expect(host).not.toContain('isLoading');
    expect(host).not.toContain('error:');
    expect(host).toContain('accountId');
    expect(projection).not.toContain('loading');
    expect(projection).not.toContain('accountGeneration');
    expect(projection).toContain('noResults: trimmed.length > 0 && results.length === 0');
  });
});
