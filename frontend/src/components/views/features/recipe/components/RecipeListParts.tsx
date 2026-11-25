import { memo, useCallback, useRef, useEffect, useId, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { X, Check, Star, AlertTriangle, Trash2, RefreshCw } from 'lucide-react';
import type { Theme } from '../../../../../types';
import type { TranslationKey } from '../../../../../lib/i18n';
import type { Recipe } from '../recipeTypes';
import { RECIPE_CATEGORIES, EMPTY_RECIPE_FORM } from '../recipeTypes';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import { UI_INTERACTION } from '../../../../../lib/uiInteractionTokens';
import { useModalA11y } from '../../../../../hooks/useModalA11y';
import { RecipeCard, type RecipeCardProps } from './RecipeCard';
import type { RecipeCopyMode, RecipeCopyResult } from '../recipeCopyContent';

const VIRTUALIZE_THRESHOLD = 40;
const ROW_HEIGHT = 72;

interface RecipeCardRowProps extends Omit<RecipeCardProps, 'onToggleExpand' | 'onToggleStar' | 'onEdit' | 'onDelete' | 'compact'> {
  onToggleExpand: (id: string) => void;
  onToggleStar: (recipe: Recipe) => void;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string, title: string) => void;
}

const RecipeCardRow = memo(function RecipeCardRow({
  recipe,
  theme,
  dark,
  expanded,
  t,
  onToggleExpand,
  onToggleStar,
  onEdit,
  onDelete,
  onCopyRecipe,
  copyContextKey,
  mutationsDisabled,
  starPending,
}: RecipeCardRowProps) {
  const handleToggleExpand = useCallback(() => onToggleExpand(recipe.id), [onToggleExpand, recipe.id]);
  const handleToggleStar = useCallback(() => onToggleStar(recipe), [onToggleStar, recipe]);
  const handleEdit = useCallback(() => onEdit(recipe), [onEdit, recipe]);
  const handleDelete = useCallback(() => onDelete(recipe.id, recipe.title), [onDelete, recipe.id, recipe.title]);

  return (
    <RecipeCard
      recipe={recipe}
      theme={theme}
      dark={dark}
      expanded={expanded}
      t={t}
      compact
      onToggleExpand={handleToggleExpand}
      onToggleStar={handleToggleStar}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onCopyRecipe={onCopyRecipe}
      copyContextKey={copyContextKey}
      mutationsDisabled={mutationsDisabled}
      starPending={starPending}
    />
  );
});

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
  confirmationOpen?: boolean;
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
  confirmationOpen = false,
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogTitleId = useId();
  const [visibleViewport, setVisibleViewport] = useState({ top: 0, height: 0 });

  useEffect(() => {
    if (!show) return;

    const viewport = window.visualViewport;
    const updateVisibleViewport = () => {
      const next = {
        top: Math.max(0, viewport?.offsetTop ?? 0),
        height: Math.max(0, viewport?.height ?? window.innerHeight),
      };
      setVisibleViewport(current => current.top === next.top && current.height === next.height ? current : next);
    };

    updateVisibleViewport();
    window.addEventListener('resize', updateVisibleViewport);
    viewport?.addEventListener('resize', updateVisibleViewport);
    viewport?.addEventListener('scroll', updateVisibleViewport);
    return () => {
      window.removeEventListener('resize', updateVisibleViewport);
      viewport?.removeEventListener('resize', updateVisibleViewport);
      viewport?.removeEventListener('scroll', updateVisibleViewport);
    };
  }, [show]);

  useModalA11y({
    open: show && !confirmationOpen,
    onClose,
    containerRef: dialogRef,
    initialFocusRef: closeButtonRef,
  });

  if (!show) return null;

  return (
    <div
      className="fixed inset-x-0 z-[100] flex items-end justify-center bg-black/60 backdrop-blur-sm lg:items-center"
      style={{ top: visibleViewport.top, height: visibleViewport.height ? `${visibleViewport.height}px` : '100dvh' }}
      onClick={onClose}
      aria-hidden={confirmationOpen || undefined}
      data-recipe-form-backdrop
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={dialogTitleId}
        tabIndex={-1}
        className="abs-cosmos-recipe-form flex h-full max-h-full w-full flex-col overflow-hidden rounded-t-[32px] bg-surface shadow-2xl lg:block lg:h-auto lg:max-h-[90vh] lg:max-w-lg lg:overflow-y-auto lg:rounded-[32px] lg:p-6"
        onClick={e => e.stopPropagation()}
        data-k110-recipe-form
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-3 pt-5 lg:mb-5 lg:p-0">
          <h2 id={dialogTitleId} className="font-heading text-xl font-bold">{editingId ? t('editRecipe') : t('newRecipe')}</h2>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label={t('close')} className={`${UI_INTERACTION.focusRingClass} min-h-11 min-w-11 rounded-full p-2 ${theme.textMuted} ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}>
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 pb-4 lg:contents" data-recipe-form-scroll-region>
        {storageWarning && (
          <div className="abs-recipe-warning-panel mb-4 flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm" role="status" data-recipe-draft-storage-warning>
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>{t('recipeDraftStorageWarning')}</span>
          </div>
        )}

        {conflict && (
          <div className="abs-recipe-warning-panel mb-4 rounded-2xl border px-4 py-3" data-recipe-draft-conflict={conflict}>
            <div className="flex items-start gap-2 text-sm" role="status">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>{t(
                conflict === 'remote-changed'
                  ? 'recipeDraftReplaceEntireConflict'
                  : conflict === 'remote-missing'
                    ? 'recipeDraftUnavailable'
                    : 'recipeDraftRemoteUnavailable',
              )}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {conflict === 'remote-changed' && onUseLocal && (
                <button type="button" onClick={onUseLocal} className={`${UI_INTERACTION.focusRingClass} rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground`}>
                  {t('recipeDraftUseLocal')}
                </button>
              )}
              {conflict === 'remote-unavailable' && (
                <button
                  type="button"
                  onClick={onRetryAuthority}
                  disabled={authorityValidating}
                  className={`${UI_INTERACTION.focusRingClass} inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:bg-surface-muted disabled:text-disabled disabled:opacity-60`}
                  data-recipe-draft-retry
                >
                  <RefreshCw size={13} className={authorityValidating ? 'animate-spin' : ''} />
                  {t('startupRetry')}
                </button>
              )}
            </div>
          </div>
        )}

        {!conflict && authorityUnavailable && (
          <div className="abs-recipe-warning-panel mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm" role="status" data-recipe-draft-authority-unavailable>
            <span className="flex items-center gap-2">
              <AlertTriangle size={16} className="shrink-0" />
              {t('recipeDraftRemoteUnavailable')}
            </span>
            <button type="button" onClick={onRetryAuthority} disabled={authorityValidating} className={`abs-recipe-warning-action ${UI_INTERACTION.focusRingClass} inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-bold disabled:text-disabled disabled:opacity-60`}>
              <RefreshCw size={13} className={authorityValidating ? 'animate-spin' : ''} />
              {t('startupRetry')}
            </button>
          </div>
        )}

        <fieldset className="space-y-4" disabled={saving} aria-disabled={conflict || !authorityReady ? true : undefined}>
          <div>
            <label htmlFor={`${dialogTitleId}-title`} className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>{t('title')} *</label>
            <input
              id={`${dialogTitleId}-title`}
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              readOnly={Boolean(conflict) || (Boolean(editingId) && !authorityReady)}
              placeholder={t('recipeName')}
              className={`abs-recipe-field w-full rounded-2xl px-4 py-3 text-sm font-semibold outline-none ${UI_INTERACTION.focusRingClass} ${theme.input}`}
            />
          </div>

          <div>
            <label className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>{t('category')}</label>
            <div className="flex flex-wrap gap-2" role="group" aria-label={t('category')}>
              {RECIPE_CATEGORIES.filter(c => c !== 'All').map(cat => (
                <button
                  key={cat}
                  type="button"
                  disabled={Boolean(conflict) || saving || (Boolean(editingId) && !authorityReady)}
                  onClick={() => setForm(f => ({ ...f, category: cat }))}
                  className={`abs-recipe-filter ${UI_INTERACTION.focusRingClass} px-3 py-1.5 rounded-xl text-xs font-bold transition-all disabled:text-disabled ${
                    form.category === cat
                      ? 'abs-recipe-selected-control text-primary-foreground'
                      : `${dark ? 'bg-surface text-gray-400' : 'bg-gray-100 text-gray-500'}`
                  }`}
                  data-selected={form.category === cat ? 'true' : 'false'}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor={`${dialogTitleId}-ingredients`} className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>
              {t('ingredients')} <span className={`font-normal ${theme.textMuted}`}>({t('onePerLine')})</span>
            </label>
            <textarea
              id={`${dialogTitleId}-ingredients`}
              value={form.ingredients}
              onChange={e => setForm(f => ({ ...f, ingredients: e.target.value }))}
              readOnly={Boolean(conflict) || (Boolean(editingId) && !authorityReady)}
              placeholder={'200g chicken breast\n1 tbsp olive oil\n2 cloves garlic'}
              rows={4}
              className={`abs-recipe-field w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none ${UI_INTERACTION.focusRingClass} ${theme.input}`}
            />
          </div>

          <div>
            <label htmlFor={`${dialogTitleId}-steps`} className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>
              {t('steps')} <span className={`font-normal ${theme.textMuted}`}>({t('onePerLine')})</span>
            </label>
            <textarea
              id={`${dialogTitleId}-steps`}
              value={form.steps}
              onChange={e => setForm(f => ({ ...f, steps: e.target.value }))}
              readOnly={Boolean(conflict) || (Boolean(editingId) && !authorityReady)}
              placeholder={'Preheat oven to 200°C\nSeason chicken with salt and pepper\nBake for 25 minutes'}
              rows={5}
              className={`abs-recipe-field w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none ${UI_INTERACTION.focusRingClass} ${theme.input}`}
            />
          </div>

          <div>
            <label htmlFor={`${dialogTitleId}-memo`} className={`block text-xs font-semibold mb-1.5 ${theme.textMuted}`}>{t('recipeMemo')}</label>
            <textarea
              id={`${dialogTitleId}-memo`}
              value={form.memo}
              onChange={e => setForm(f => ({ ...f, memo: e.target.value }))}
              readOnly={Boolean(conflict) || (Boolean(editingId) && !authorityReady)}
              placeholder={t('recipeTips')}
              rows={2}
              className={`abs-recipe-field w-full rounded-2xl px-4 py-3 text-sm outline-none resize-none ${UI_INTERACTION.focusRingClass} ${theme.input}`}
            />
          </div>

          <button
            type="button"
            disabled={Boolean(conflict) || saving || (Boolean(editingId) && !authorityReady)}
            onClick={() => setForm(f => ({ ...f, starred: !f.starred }))}
            className={`abs-recipe-favorite-toggle ${UI_INTERACTION.focusRingClass} flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:text-disabled ${dark ? 'bg-surface' : 'bg-gray-100'} ${theme.textMuted}`}
            data-starred={form.starred ? 'true' : 'false'}
          >
            <Star size={14} fill={form.starred ? 'currentColor' : 'none'} />
            {form.starred ? t('recipeStarred') : t('addStarred')}
          </button>
        </fieldset>
        </div>

        <div className={`${conflict ? 'grid-cols-1' : 'grid-cols-2'} grid shrink-0 gap-2 border-t px-6 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:mt-6 lg:flex lg:border-0 lg:p-0`}>
          <button
            type="button"
            onClick={onDiscard}
            disabled={!conflict && (saving || !authorityReady)}
            data-recipe-draft-discard
            className={`abs-recipe-danger-action ${UI_INTERACTION.focusRingClass} flex min-h-12 items-center justify-center gap-2 rounded-2xl px-3 py-3 text-sm font-bold disabled:cursor-not-allowed disabled:text-disabled lg:px-4 lg:py-3.5 ${dark ? 'bg-white/5' : 'bg-gray-100'}`}
          >
            <Trash2 size={15} /> {t('recipeDraftDiscard')}
          </button>
          {!conflict && (
            <button
              type="button"
              onClick={onSave}
              disabled={saving || !authorityReady}
              className={`${UI_INTERACTION.focusRingClass} flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-sm font-bold text-primary-foreground transition-transform enabled:hover:scale-[1.02] enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-disabled disabled:opacity-60`}
              data-recipe-save
            >
              <Check size={16} /> {editingId ? t('updateRecipe') : t('saveRecipe')}
            </button>
          )}
        </div>
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
  pendingStarRecipeIds?: ReadonlySet<string>;
  onEdit: (recipe: Recipe) => void;
  onDelete: (id: string, title: string) => void;
  onCopyRecipe: (recipeId: string, mode: RecipeCopyMode, expectedContextKey: object) => Promise<RecipeCopyResult>;
  copyContextKey: object;
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
  pendingStarRecipeIds = new Set(),
  onEdit,
  onDelete,
  onCopyRecipe,
  copyContextKey,
  mutationsDisabled = false,
}: RecipeVirtualListProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const { isNarrow } = useViewportLayout();
  const useVirtual = !isNarrow && recipes.length >= VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: recipes.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 6,
    enabled: useVirtual,
  });
  const expandedIndex = expandedId === null
    ? -1
    : recipes.findIndex(recipe => recipe.id === expandedId);

  useEffect(() => {
    if (useVirtual && expandedIndex >= 0) {
      virtualizer.scrollToIndex(expandedIndex, { align: 'auto' });
    }
  }, [expandedIndex, useVirtual, virtualizer]);

  const renderCard = (recipe: Recipe) => (
    <RecipeCardRow
      key={recipe.id}
      recipe={recipe}
      theme={theme}
      dark={dark}
      expanded={expandedId === recipe.id}
      t={t}
      onToggleExpand={onToggleExpand}
      onToggleStar={onToggleStar}
      onEdit={onEdit}
      onDelete={onDelete}
      onCopyRecipe={onCopyRecipe}
      copyContextKey={copyContextKey}
      mutationsDisabled={mutationsDisabled}
      starPending={pendingStarRecipeIds.has(recipe.id)}
    />
  );

  if (!useVirtual) {
    return (
      <div
        className="space-y-2 xl:h-full xl:min-h-0 xl:overflow-y-auto xl:overscroll-contain"
        data-k110-recipe-list
        data-recipe-list-tail-reachable
        data-recipe-scroll-owner-wide="list"
      >
        {recipes.map(renderCard)}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      className="h-full min-h-0 overflow-y-auto overscroll-contain"
      data-k110-recipe-virtual-list
      data-recipe-list-tail-reachable
      data-recipe-scroll-owner-wide="list"
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map(vRow => {
          const recipe = recipes[vRow.index];
          return (
            <div
              key={recipe.id}
              ref={virtualizer.measureElement}
              data-index={vRow.index}
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
