import { useRef, useEffect } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X, Check, Star, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
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
  onDiscard: () => void;
  onUseLocal?: () => void;
  saving: boolean;
  conflict: 'remote-changed' | 'remote-unavailable' | 'remote-missing' | null;
  storageWarning: boolean;
  authorityReady: boolean;
  authorityUnavailable: boolean;
  authorityValidating: boolean;
  onRetryAuthority: () => void;
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
  onDiscard,
  onUseLocal,
  saving,
  conflict,
  storageWarning,
  authorityReady,
  authorityUnavailable,
  authorityValidating,
  onRetryAuthority,
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

        {storageWarning && (
          <div className="mb-4 flex items-start gap-2 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-600" role="status" data-recipe-draft-storage-warning>
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{t('recipeDraftStorageWarning')}</span>
          </div>
        )}

        {conflict && (
          <div className="mb-4 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3" data-recipe-draft-conflict={conflict}>
            <div className="flex items-start gap-2 text-sm text-amber-600">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{t(
                conflict === 'remote-changed'
                  ? 'recipeDraftConflict'
                  : conflict === 'remote-missing'
                    ? 'recipeDraftUnavailable'
                    : 'recipeDraftRemoteUnavailable',
              )}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {conflict === 'remote-changed' && onUseLocal && (
                <button type="button" onClick={onUseLocal} className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground">
                  {t('recipeDraftUseLocal')}
                </button>
              )}
              {conflict === 'remote-unavailable' && (
                <button
                  type="button"
                  onClick={onRetryAuthority}
                  disabled={authorityValidating}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
                  data-recipe-draft-retry
                >
                  <RefreshCw size={13} className={authorityValidating ? 'animate-spin' : ''} />
                  {t('startupRetry')}
                </button>
              )}
              <button type="button" onClick={onDiscard} className="rounded-xl border border-amber-500/30 px-3 py-2 text-xs font-bold text-amber-600">
                {t('recipeDraftDiscard')}
              </button>
            </div>
          </div>
        )}

        {!conflict && authorityUnavailable && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm text-amber-600" role="status" data-recipe-draft-authority-unavailable>
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              {t('recipeDraftRemoteUnavailable')}
            </span>
            <button type="button" onClick={onRetryAuthority} disabled={authorityValidating} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-500/30 px-3 py-2 text-xs font-bold disabled:opacity-60">
              <RefreshCw size={13} className={authorityValidating ? 'animate-spin' : ''} />
              {t('startupRetry')}
            </button>
          </div>
        )}

        <fieldset className="space-y-4" disabled={saving} aria-disabled={conflict || !authorityReady ? true : undefined}>
          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>{t('title')} *</label>
            <input
              ref={titleRef}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              readOnly={Boolean(conflict) || (Boolean(editingId) && !authorityReady)}
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
                  disabled={Boolean(conflict) || saving || (Boolean(editingId) && !authorityReady)}
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
              readOnly={Boolean(conflict) || (Boolean(editingId) && !authorityReady)}
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
              readOnly={Boolean(conflict) || (Boolean(editingId) && !authorityReady)}
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
              readOnly={Boolean(conflict) || (Boolean(editingId) && !authorityReady)}
              placeholder={t('recipeTips')}
              rows={2}
              className={`w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none focus:ring-2 focus:ring-primary ${theme.input}`}
            />
          </div>

          <button
            type="button"
            disabled={Boolean(conflict) || saving || (Boolean(editingId) && !authorityReady)}
            onClick={() => setForm(f => ({ ...f, starred: !f.starred }))}
            className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all ${
              form.starred ? 'bg-yellow-400/20 text-yellow-500' : `${dark ? 'bg-surface' : 'bg-gray-100'} ${theme.textMuted}`
            }`}
          >
            <Star size={14} fill={form.starred ? '#8B5CF6' : 'none'} color={form.starred ? '#8B5CF6' : undefined} />
            {form.starred ? t('recipeStarred') : t('addStarred')}
          </button>
        </fieldset>

        {!conflict && (
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={onDiscard}
              disabled={saving || !authorityReady}
              className={`flex items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-sm font-bold ${theme.textMuted} ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
            >
              <Trash2 size={15} /> {t('recipeDraftDiscard')}
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Check size={16} /> {editingId ? t('updateRecipe') : t('saveRecipe')}
            </button>
          </div>
        )}
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
  onOpenCookingNote?: (recipe: Recipe) => void;
  mutationsDisabled?: boolean;
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
  onOpenCookingNote,
  mutationsDisabled = false,
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
      onOpenCookingNote={onOpenCookingNote ? () => onOpenCookingNote(recipe) : undefined}
      mutationsDisabled={mutationsDisabled}
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
