import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X, Check, Star } from 'lucide-react';
import type { Theme } from '../../../../../types';
import type { TranslationKey } from '../../../../../lib/i18n';
import type { Recipe } from '../recipeTypes';
import { RECIPE_CATEGORIES, EMPTY_RECIPE_FORM } from '../recipeTypes';
import { RecipeCard } from './RecipeCard';

const VIRTUALIZE_THRESHOLD = 40;
const ROW_HEIGHT = 72;

export interface RecipeFormState {
  title: string;
  category: string;
  ingredients: string;
  steps: string;
  memo: string;
  starred: boolean;
}

export interface RecipeFormModalProps {
  show: boolean;
  editingId: string | null;
  form: RecipeFormState;
  setForm: React.Dispatch<React.SetStateAction<RecipeFormState>>;
  theme: Theme;
  dark: boolean;
  t: (key: TranslationKey) => string;
  onClose: () => void;
  onSave: () => void;
}

export function RecipeFormModal({
  show,
  editingId,
  form,
  setForm,
  theme,
  dark,
  t,
  onClose,
  onSave,
}: RecipeFormModalProps) {
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (show) setTimeout(() => titleRef.current?.focus(), 50);
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-end lg:items-center justify-center z-[100] backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full lg:max-w-lg rounded-t-[32px] lg:rounded-[32px] p-6 shadow-2xl max-h-[90vh] overflow-y-auto bg-surface"
        onClick={e => e.stopPropagation()}
        data-k110-recipe-form
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-heading text-xl font-bold">{editingId ? t('editRecipe') : t('newRecipe')}</h2>
          <button type="button" onClick={onClose} className={`p-2 rounded-full ${theme.textMuted} ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>{t('title')} *</label>
            <input
              ref={titleRef}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder={t('recipeName')}
              className={`w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary ${theme.input}`}
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>{t('category')}</label>
            <div className="flex flex-wrap gap-2">
              {RECIPE_CATEGORIES.filter(c => c !== 'All').map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, category: cat }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
                    form.category === cat
                      ? 'bg-primary text-primary-foreground'
                      : `${dark ? 'bg-surface text-gray-400' : 'bg-gray-100 text-gray-500'}`
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>
              {t('ingredients')} <span className={`font-normal ${theme.textMuted}`}>({t('onePerLine')})</span>
            </label>
            <textarea
              value={form.ingredients}
              onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
              placeholder={'200g chicken breast\n1 tbsp olive oil\n2 cloves garlic'}
              rows={4}
              className={`w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary ${theme.input}`}
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>
              {t('steps')} <span className={`font-normal ${theme.textMuted}`}>({t('onePerLine')})</span>
            </label>
            <textarea
              value={form.steps}
              onChange={e => setForm(f => ({ ...f, steps: e.target.value }))}
              placeholder={'Preheat oven to 200°C\nSeason chicken with salt and pepper\nBake for 25 minutes'}
              rows={5}
              className={`w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary ${theme.input}`}
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>{t('recipeMemo')}</label>
            <textarea
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              placeholder={t('recipeTips')}
              rows={2}
              className={`w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary ${theme.input}`}
            />
          </div>

          <button
            type="button"
            onClick={() => setForm(f => ({ ...f, starred: !f.starred }))}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${
              form.starred ? 'bg-yellow-400/20 text-yellow-500' : `${dark ? 'bg-surface' : 'bg-gray-100'} ${theme.textMuted}`
            }`}
          >
            <Star size={14} fill={form.starred ? '#8B5CF6' : 'none'} color={form.starred ? '#8B5CF6' : undefined} />
            {form.starred ? t('recipeStarred') : t('addStarred')}
          </button>
        </div>

        <button
          type="button"
          onClick={onSave}
          className="w-full mt-6 py-3.5 rounded-2xl font-bold text-sm bg-primary text-primary-foreground hover:scale-[1.02] transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
        >
          <Check size={16} /> {editingId ? t('updateRecipe') : t('saveRecipe')}
        </button>
      </div>
    </div>
  );
}

export interface RecipeVirtualListProps {
  recipes: readonly Recipe[];
  theme: Theme;
  dark: boolean;
  expandedId: string | null;
  t: (key: TranslationKey) => string;
  onToggleExpand: (id: string) => void;
  onToggleStar: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string, title: string) => void;
  onMarkCooked?: (id: string) => void;
}

export function RecipeVirtualList({
  recipes,
  theme,
  dark,
  expandedId,
  t,
  onToggleExpand,
  onToggleStar,
  onEdit,
  onDelete,
  onMarkCooked,
}: RecipeVirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = recipes.length >= VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: recipes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
    enabled: useVirtual,
  });

  const renderCard = (recipe: Recipe) => (
    <RecipeCard
      key={recipe.id}
      recipe={recipe}
      theme={theme}
      dark={dark}
      expanded={expandedId === recipe.id}
      t={t}
      compact
      onToggleExpand={() => onToggleExpand(recipe.id)}
      onToggleStar={() => onToggleStar(recipe)}
      onEdit={() => onEdit(recipe)}
      onDelete={() => onDelete(recipe.id, recipe.title)}
      onMarkCooked={onMarkCooked ? () => onMarkCooked(recipe.id) : undefined}
    />
  );

  if (!useVirtual) {
    return (
      <div className="space-y-2" data-k110-recipe-list>
        {recipes.map(renderCard)}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="overflow-y-auto min-h-0 flex-1"
      data-k110-recipe-virtual-list
      style={{ maxHeight: '70vh' }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map(vRow => {
          const recipe = recipes[vRow.index];
          return (
            <div
              key={recipe.id}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
              }}
              className="pb-2"
            >
              {renderCard(recipe)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { EMPTY_RECIPE_FORM };
