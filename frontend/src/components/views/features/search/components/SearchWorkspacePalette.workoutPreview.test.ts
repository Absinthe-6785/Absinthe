// @vitest-environment happy-dom
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { SearchWorkspacePalette } from './SearchWorkspacePalette';
import type { SearchProjection, SearchResultItem } from '../searchProjectionModels';
import type { SearchWorkoutPreviewEvidence } from '../searchWorkoutCompositeProjection';
import type { NoteChromeColors } from '../../../noteEditorTheme';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const h = vi.hoisted(() => ({ recent: vi.fn(), tab: vi.fn(), note: vi.fn(), planner: vi.fn(), health: vi.fn(), recipe: vi.fn() }));
vi.mock('../searchRecentStorage', () => ({ pushSearchRecent: h.recent, loadSearchRecent: () => [], clearSearchRecentHistory: vi.fn() }));
vi.mock('../../../../../lib/noteNavigation', () => ({ switchToTab: h.tab }));
vi.mock('../searchNavigation', () => ({ getSearchNoteHandlers: () => ({ onSelectNote: h.note }) }));
vi.mock('../searchDomainNavigation', () => ({ getSearchDomainHandlers: () => ({ onOpenPlannerItem: h.planner,
  onOpenHealthDay: h.health, onSelectRecipe: h.recipe }) }));
vi.mock('../hooks/useSearchSectionPrefs', () => ({ useSearchSectionPrefs: () => ({
  prefs: { notesCollapsed: false, plannerCollapsed: false, healthCollapsed: false, recipeCollapsed: false, archiveCollapsed: false }, toggle: vi.fn(),
}) }));
vi.mock('./SearchVirtualList', () => ({ SearchVirtualList: ({ results, onSelect }: { results: SearchResultItem[]; onSelect: (row: SearchResultItem) => void }) =>
  createElement('div', null, ...results.map(row => createElement('button', { key: row.id, 'data-result': row.id, onClick: () => onSelect(row) }, row.title))) }));

const colors = { card: '#fff', sideBdr: '#ddd', text: '#111', textMuted: '#666', textFaint: '#999', accent: '#00f' } as NoteChromeColors;
function projection(row: SearchResultItem): SearchProjection {
  return { query: 'Bench', results: [row], groupedResults: [{ domain: row.domain, labelKey: 'k111DomainHealth', results: [row], count: 1 }],
    counts: { notes: 0, planner: 0, health: 1, recipe: 0, archive: 0, total: 1 }, highlights: new Map(),
    recentSearches: { today: [], earlier: [] }, groupStates: {}, empty: { noQuery: false, noRecent: true, noResults: false }, generatedAt: 'now' };
}
const proof: SearchWorkoutPreviewEvidence = { accountId: 'a', localDate: '2026-09-30', source: 'canonical',
  namespaceKey: 'ns', generationId: 'g', sessionId: 'session', entryId: 'entry', capability: 'read_only',
  read: { scope: { localDate: '2026-09-30', lifetime: {}, isCurrent: () => true }, phase: 'settled', view: null,
    publication: {}, isolationError: false, isCurrent: () => true } };
const preview: SearchResultItem = { id: 'preview', title: 'Bench', domain: 'health', kind: 'workout-observation',
  subtitle: '2026-09-30 · canonical', score: 0, workoutPreview: proof };
let root: Root; let container: HTMLDivElement;
beforeEach(() => {
  for (const mock of Object.values(h)) mock.mockClear(); localStorage.clear();
  container = document.createElement('div'); document.body.appendChild(container); root = createRoot(container);
});
afterEach(() => { act(() => root.unmount()); container.remove(); });
async function render(row: SearchResultItem, onOpenWorkoutPreview = vi.fn(() => true)) {
  const close = vi.fn(); const recentRevision = vi.fn();
  await act(async () => root.render(createElement(SearchWorkspacePalette, { colors, projection: projection(row), open: true,
    query: 'Bench', onQueryChange: vi.fn(), onClose: close, onRecentRevision: recentRevision, onOpenWorkoutPreview })));
  return { close, recentRevision, onOpenWorkoutPreview };
}

describe('D1 dedicated palette dispatch', () => {
  it.each(['mouse', 'Enter'])('%s preview navigates only through proof callback, never Notes/recent', async method => {
    const result = await render(preview);
    await act(async () => method === 'mouse'
      ? container.querySelector<HTMLButtonElement>('[data-result="preview"]')!.click()
      : window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })));
    expect(result.onOpenWorkoutPreview).toHaveBeenCalledWith(proof);
    expect(result.close).toHaveBeenCalledTimes(1);
    expect(result.recentRevision).not.toHaveBeenCalled();
    expect(h.recent).not.toHaveBeenCalled(); expect(h.tab).not.toHaveBeenCalled();
    expect(h.health).not.toHaveBeenCalled(); expect(h.note).not.toHaveBeenCalled();
  });
  it('rejected stale preview has zero generic navigation/close/recent effects', async () => {
    const result = await render(preview, vi.fn(() => false));
    await act(async () => container.querySelector<HTMLButtonElement>('[data-result="preview"]')!.click());
    expect(result.close).not.toHaveBeenCalled(); expect(result.recentRevision).not.toHaveBeenCalled();
    expect(h.recent).not.toHaveBeenCalled(); expect(h.tab).not.toHaveBeenCalled();
  });
  it.each([
    ['note', 'notes', 'noteId', 'note', 'note'], ['schedule', 'planner', 'plannerItemId', 's', 'planner'],
    ['todo', 'planner', 'plannerItemId', 't', 'planner'], ['routine', 'planner', 'plannerItemId', 'r', 'planner'],
    ['recipe', 'recipe', 'recipeId', 'recipe', 'recipe'], ['exercise-block', 'health', 'plannerItemId', 'block', 'health'],
    ['deleted-note', 'archive', 'noteId', 'deleted', 'note'],
  ])('ordinary %s retains generic navigation and recent behavior', async (kind, domain, idKey, id, destination) => {
    const row = { id: 'ordinary', title: 'Bench', subtitle: '2026-09-30 · ordinary', score: 0, kind, domain, [idKey]: id } as SearchResultItem;
    const result = await render(row);
    await act(async () => container.querySelector<HTMLButtonElement>('[data-result="ordinary"]')!.click());
    expect(h.recent).toHaveBeenCalledTimes(1); expect(h.tab).toHaveBeenCalledTimes(1);
    expect(h[destination as 'note' | 'planner' | 'recipe' | 'health']).toHaveBeenCalledTimes(1);
    expect(result.recentRevision).toHaveBeenCalledTimes(1); expect(result.close).toHaveBeenCalledTimes(1);
    expect(result.onOpenWorkoutPreview).not.toHaveBeenCalled();
  });
});
