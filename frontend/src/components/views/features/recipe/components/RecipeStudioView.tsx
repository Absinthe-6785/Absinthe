import { useMemo, useState } from 'react';
import { Search, X, Plus, BookMarked, Star } from 'lucide-react';
import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import { WorkspaceLayout } from '../../../../common/workspaceLayout';
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
  onMarkCooked: (id: string) => void;
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
  onMarkCooked,
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

  const headingClass = dark ? 'text-white' : 'text-gray-900';

  return (
    <div
      className="flex-1 overflow-hidden flex flex-col h-full rounded-none lg:rounded-[32px] lg:ml-3 bg-background px-3 lg:px-5 pt-3 lg:pt-5 pb-3 lg:pb-5"
      data-k110-recipe-studio
      data-recipe-empty={projection.empty.isEmpty ? 'true' : 'false'}
    >
      <WorkspaceLayout
        workspace="recipe"
        split
        header={(
          <header className="flex items-center justify-between gap-3 shrink-0" data-k110-recipe-header>
            <div>
              <h1 className={`font-heading text-xl lg:text-2xl font-black tracking-tight flex items-center gap-2 ${headingClass}`}>
                <BookMarked size={20} className="text-primary" />
                {t('k110StudioTitle')}
              </h1>
              <p className={`text-xs font-medium ${theme.textMuted}`}>{t('k110StudioSubtitle')}</p>
            </div>
            <button
              type="button"
              onClick={onNewRecipe}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 rounded-2xl text-sm font-bold shadow-sm hover:scale-105 transition-transform active:scale-95 min-h-[44px]"
              data-k110-new-recipe
            >
              <Plus size={15} />
              {t('newRecipe')}
            </button>
          </header>
        )}
        secondary={(
          <div className="flex flex-col gap-2 lg:gap-3 min-h-0 overflow-y-auto" data-k110-recipe-sidebar>
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
          <div className="flex flex-col gap-2 lg:gap-3 min-h-0 flex-1" data-k110-recipe-primary>
            {/* Recipes list */}
            <section className={`rounded-[16px] lg:rounded-[20px] shadow-sm p-3 lg:p-4 flex flex-col min-h-0 flex-1 ${theme.card}`} data-k110-recipe-section="recipes">
              <h2 className="font-heading text-sm font-bold mb-2 shrink-0">{t('k110SectionRecipes')}</h2>

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
                      className={`shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all min-h-[36px] ${
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
                    className={`shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold min-h-[36px] ${
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
                  <div className={`text-center py-8 text-sm ${theme.textMuted}`}>{t('recipeLoading')}</div>
                )}
                {!loading && visible.length === 0 && (
                  <ProductEmptyState
                    icon={BookMarked}
                    title={t('k110EmptyNoRecipes')}
                    description={t('k110EmptyNoRecipesHint')}
                    primaryAction={{ label: t('newRecipe'), onClick: onNewRecipe }}
                    dataHook="k110-empty-recipes-list"
                    theme={theme}
                  />
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
                  />
                )}
              </div>
            </section>

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
