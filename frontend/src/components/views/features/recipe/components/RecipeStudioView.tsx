import { useMemo, useState } from 'react';
import { Search, X, Plus, BookMarked, Star, Trash2, RotateCcw } from 'lucide-react';
import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import { WorkspaceLayout } from '../../../../common/workspaceLayout';
import { WorkspaceToolbar, WorkspaceToolbarPrimary } from '../../../../common/WorkspaceToolbar';
import { WorkspacePageHeader } from '../../../../common/WorkspacePageHeader';
import { WorkspaceCardSkeleton } from '../../../../common/WorkspaceCardSkeleton';
import {
  WORKSPACE_CARD_RADIUS_CLASS,
  WORKSPACE_CARD_SURFACE,
  WORKSPACE_SECTION_TITLE_CLASS,
} from '../../../../common/workspaceCardSizes';
import { UI_INTERACTION } from '../../../../../lib/uiInteractionTokens';
import { UI_SPACING, WORKSPACE_GAP_CLASS } from '../../../../../lib/uiSpacingTokens';
import type { RecipeProjection } from '../recipeProjectionModels';
import type { Recipe, RecipeCategory } from '../recipeTypes';
import { RECIPE_CATEGORIES } from '../recipeTypes';
import { useRecipeSectionPrefs } from '../hooks/useRecipeSectionPrefs';
import { RecipeHomeSection } from './RecipeHomeSection';
import { RecipeIngredientsSection } from './RecipeIngredientsSection';
import { RecipeHistorySection } from './RecipeHistorySection';
import { RecipeCollectionsSection } from './RecipeCollectionsSection';
import { RecipeVirtualList } from './RecipeListParts';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';

export interface RecipeStudioViewProps {
  projection: RecipeProjection;
  recipes: readonly Recipe[];
  theme: Theme;
  appSettings: AppSettings;
  loading: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
  onToggleStar: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string, title: string) => void;
  deletedRecipes: readonly Recipe[];
  deletedLoading: boolean;
  onRestore: (id: string) => void;
  onMarkCooked: (id: string) => void;
  onOpenCookingNote?: (recipe: Recipe) => void;
  onNewRecipe: () => void;
  onScrollToRecipe: (id: string) => void;
}

export function RecipeStudioView({
  projection,
  recipes,
  theme,
  appSettings,
  loading,
  expandedId,
  onToggleExpand,
  onToggleStar,
  onEdit,
  onDelete,
  deletedRecipes,
  deletedLoading,
  onRestore,
  onMarkCooked,
  onOpenCookingNote,
  onNewRecipe,
  onScrollToRecipe,
}: RecipeStudioViewProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const dark = appSettings.darkMode;
  const { prefs, toggle } = useRecipeSectionPrefs();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<RecipeCategory>('All');
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'title'>('newest');
  const [showTrash, setShowTrash] = useState(false);

  const visible = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = recipes.filter(r => {
      if (showStarredOnly && !r.starred) return false;
      if (activeCategory !== 'All' && r.category !== activeCategory) return false;
      if (q && !(r.title ?? '').toLowerCase().includes(q) && !(r.ingredients ?? '').toLowerCase().includes(q)) return false;
      return true;
    });
    return [...filtered].sort((a, b) => {
      if (sortOrder === 'title') return (a.title ?? '').localeCompare(b.title ?? '');
      if (sortOrder === 'oldest') return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [recipes, searchQuery, activeCategory, showStarredOnly, sortOrder]);

  const handleRecipeNav = (id: string) => {
    onScrollToRecipe(id);
    onToggleExpand(id);
  };

  return (
    <div
      className={`flex-1 overflow-hidden flex flex-col h-full rounded-none ${WORKSPACE_CARD_RADIUS_CLASS} lg:ml-3 bg-background px-3 lg:px-5 pt-3 lg:pt-5 pb-3 lg:pb-5`}
      data-k110-recipe-studio
      data-recipe-empty={projection.empty.isEmpty ? 'true' : 'false'}
    >
      <WorkspaceLayout
        workspace="recipe"
        split
        header={(
          <WorkspaceToolbar workspace="recipe" className="!mb-0 !pb-0 bg-transparent" legacyDataHook="data-k110-recipe-header">
            <WorkspacePageHeader
              workspace="recipe"
              title={t('k110StudioTitle')}
              subtitle={t('k110StudioSubtitle')}
              icon={BookMarked}
              theme={theme}
              dark={dark}
              trailing={(
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowTrash(value => !value)}
                    className={`inline-flex items-center gap-1.5 min-h-[40px] shrink-0 rounded-xl border px-3 text-xs font-bold transition-colors ${theme.border} ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
                    data-k110-recipe-trash-toggle
                    aria-expanded={showTrash}
                  >
                    <Trash2 size={14} />
                    {t('deletedRecipes')} {deletedRecipes.length > 0 ? `(${deletedRecipes.length})` : ''}
                  </button>
                  <WorkspaceToolbarPrimary
                    label={t('newRecipe')}
                    icon={<Plus size={UI_INTERACTION.toolbarIconSizePx} />}
                    onClick={onNewRecipe}
                    className="w-auto shrink-0 px-4"
                    dataHook="data-k110-new-recipe"
                  />
                </div>
              )}
            />
          </WorkspaceToolbar>
        )}
        secondary={(
          <div className={`flex flex-col ${WORKSPACE_GAP_CLASS} min-h-0 overflow-y-auto ${UI_SPACING.scrollOverscroll}`} data-k110-recipe-sidebar data-k120-scroll-recipe>
            <RecipeHomeSection
              projection={projection}
              theme={theme}
              appSettings={appSettings}
              onRecipeClick={handleRecipeNav}
              onNewRecipe={onNewRecipe}
            />
          </div>
        )}
        primary={(
          <div className={`flex flex-col ${WORKSPACE_GAP_CLASS} min-h-0 flex-1`} data-k110-recipe-primary>
            <section className={`${WORKSPACE_CARD_SURFACE} flex flex-col min-h-0 flex-1 ${theme.card}`} data-k110-recipe-section="recipes">
              <h2 className={WORKSPACE_SECTION_TITLE_CLASS}>{t('k110SectionRecipes')}</h2>

              <div className="space-y-2 shrink-0 mb-2">
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${theme.border} ${theme.input}`}>
                  <Search size={14} className={theme.textMuted} />
                  <input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={t('searchRecipe')}
                    className="flex-1 bg-transparent outline-none text-sm"
                    data-k110-recipe-search
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery('')}>
                      <X size={14} className={theme.textMuted} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-hide" data-k110-recipe-filters>
                  {RECIPE_CATEGORIES.map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setActiveCategory(cat)}
                      className={`shrink-0 px-2.5 py-1 ${UI_INTERACTION.sectionChipRadiusClass} text-[11px] font-bold transition-all min-h-[44px] ${
                        activeCategory === cat
                          ? 'bg-primary text-primary-foreground'
                          : `${dark ? 'bg-surface text-gray-400' : 'bg-white text-gray-500'}`
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowStarredOnly(p => !p)}
                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 ${UI_INTERACTION.sectionChipRadiusClass} text-[11px] font-bold min-h-[44px] ${
                      showStarredOnly ? 'bg-yellow-400 text-primary-foreground' : `${dark ? 'bg-surface text-gray-400' : 'bg-white text-gray-500'}`
                    }`}
                  >
                    <Star size={10} fill={showStarredOnly ? '#1C1C1E' : 'none'} />
                    {t('recipeStarred')}
                  </button>
                  <div className={`shrink-0 flex items-center gap-0.5 p-0.5 rounded-lg ${dark ? 'bg-surface' : 'bg-white'}`}>
                    {(['newest', 'oldest', 'title'] as const).map(s => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSortOrder(s)}
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          sortOrder === s ? 'bg-primary text-primary-foreground' : `${dark ? 'text-gray-500' : 'text-gray-400'}`
                        }`}
                      >
                        {s === 'newest' ? '↓' : s === 'oldest' ? '↑' : 'A-Z'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto">
                {loading && (
                  <WorkspaceCardSkeleton theme={theme} minHeight="min-h-[200px]" bars={2} />
                )}
                {!loading && visible.length === 0 && (
                  <div data-k121-empty-state="recipe-list">
                  <ProductEmptyState
                    icon={BookMarked}
                    title={t('k110EmptyNoRecipes')}
                    description={t('k110EmptyNoRecipesHint')}
                    primaryAction={{ label: t('newRecipe'), onClick: onNewRecipe }}
                    dataHook="k110-empty-recipes-list"
                    theme={theme}
                  />
                  </div>
                )}
                {!loading && visible.length > 0 && (
                  <RecipeVirtualList
                    recipes={visible}
                    theme={theme}
                    dark={dark}
                    expandedId={expandedId}
                    t={t}
                    onToggleExpand={onToggleExpand}
                    onToggleStar={onToggleStar}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onMarkCooked={onMarkCooked}
                    onOpenCookingNote={onOpenCookingNote}
                  />
                )}
              </div>
            </section>

            {showTrash && (
              <section className={`${WORKSPACE_CARD_SURFACE} ${theme.card}`} data-k110-recipe-trash>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className={WORKSPACE_SECTION_TITLE_CLASS}>{t('deletedRecipes')}</h2>
                    <p className={`text-xs ${theme.textMuted}`}>{t('noDeletedRecipes')}</p>
                  </div>
                  <Trash2 size={16} className={theme.textMuted} aria-hidden="true" />
                </div>
                {deletedLoading && (
                  <p className={`mt-3 text-sm ${theme.textMuted}`}>{t('loading')}</p>
                )}
                {!deletedLoading && deletedRecipes.length === 0 && (
                  <p className={`mt-3 text-sm ${theme.textMuted}`} data-k110-recipe-trash-empty>
                    {t('noDeletedRecipes')}
                  </p>
                )}
                {!deletedLoading && deletedRecipes.length > 0 && (
                  <div className="mt-3 space-y-2" data-k110-recipe-trash-list>
                    {deletedRecipes.map(recipe => (
                      <div
                        key={recipe.id}
                        className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${theme.border} ${dark ? 'bg-surface' : 'bg-white'}`}
                        data-k110-recipe-trash-row={recipe.id}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold">{recipe.title}</p>
                          <p className={`text-[11px] ${theme.textMuted}`}>{recipe.category}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onRestore(recipe.id)}
                          className="inline-flex min-h-[40px] shrink-0 items-center gap-1.5 rounded-xl px-3 text-xs font-bold text-primary hover:bg-primary/10"
                          data-k110-recipe-restore={recipe.id}
                        >
                          <RotateCcw size={14} />
                          {t('restoreRecipe')}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            <RecipeIngredientsSection
              ingredientGroups={projection.ingredientGroups}
              theme={theme}
              appSettings={appSettings}
              collapsed={prefs.ingredientsCollapsed}
              onToggle={() => toggle('ingredientsCollapsed')}
              onRecipeClick={handleRecipeNav}
            />

            <RecipeHistorySection
              historyItems={projection.historyItems}
              theme={theme}
              appSettings={appSettings}
              collapsed={prefs.historyCollapsed}
              onToggle={() => toggle('historyCollapsed')}
              onRecipeClick={handleRecipeNav}
            />

            <RecipeCollectionsSection
              collectionGroups={projection.collectionGroups}
              theme={theme}
              appSettings={appSettings}
              collapsed={prefs.collectionsCollapsed}
              onToggle={() => toggle('collectionsCollapsed')}
              onRecipeClick={handleRecipeNav}
            />
          </div>
        )}
      />
    </div>
  );
}
