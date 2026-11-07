import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Star, Pencil, Trash2, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import type { Theme } from '../../../../../types';
import type { TranslationKey } from '../../../../../lib/i18n';
import type { Recipe } from '../recipeTypes';
import { RECIPE_CATEGORY_COLORS } from '../recipeTypes';
import { UI_INTERACTION } from '../../../../../lib/uiInteractionTokens';
import type { RecipeCopyMode, RecipeCopyResult } from '../recipeCopyContent';

export interface RecipeCardProps {
  recipe: Recipe;
  theme: Theme;
  dark: boolean;
  expanded: boolean;
  t: (key: TranslationKey) => string;
  onToggleExpand: () => void;
  onToggleStar: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onCopyRecipe: (recipeId: string, mode: RecipeCopyMode, expectedContextKey: object) => Promise<RecipeCopyResult>;
  copyContextKey: object;
  compact?: boolean;
  mutationsDisabled?: boolean;
  starPending?: boolean;
}

export function RecipeCard({
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
  compact = false,
  mutationsDisabled = false,
  starPending = false,
}: RecipeCardProps) {
  const [copyFeedbackState, setCopyFeedbackState] = useState<{
    mode: RecipeCopyMode;
    result: RecipeCopyResult;
    recipeId: string;
    copyContextKey: object;
    requestSequence: number;
  } | null>(null);
  const [copyPendingState, setCopyPendingState] = useState<{
    recipeId: string;
    copyContextKey: object;
    requestSequence: number;
  } | null>(null);
  const mountedRef = useRef(false);
  const requestSequenceRef = useRef(0);
  const contextRef = useRef({ recipeId: recipe.id, copyContextKey, expanded });
  useLayoutEffect(() => {
    const previous = contextRef.current;
    if (previous.recipeId !== recipe.id || previous.copyContextKey !== copyContextKey || previous.expanded !== expanded) {
      requestSequenceRef.current += 1;
    }
    contextRef.current = { recipeId: recipe.id, copyContextKey, expanded };
  }, [copyContextKey, expanded, recipe.id]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  const copyPending = Boolean(copyPendingState
    && copyPendingState.requestSequence === requestSequenceRef.current
    && copyPendingState.recipeId === recipe.id
    && copyPendingState.copyContextKey === copyContextKey
    && expanded);
  const copyFeedback = copyFeedbackState
    && copyFeedbackState.requestSequence === requestSequenceRef.current
    && copyFeedbackState.recipeId === recipe.id
    && copyFeedbackState.copyContextKey === copyContextKey
    && expanded
    ? copyFeedbackState
    : null;

  const requestCopy = async (mode: RecipeCopyMode) => {
    const context = contextRef.current;
    const requestSequence = ++requestSequenceRef.current;
    setCopyFeedbackState(null);
    setCopyPendingState({ ...context, requestSequence });
    let result: RecipeCopyResult;
    try {
      result = await onCopyRecipe(recipe.id, mode, copyContextKey);
    } catch {
      result = 'failed';
    }
    const current = contextRef.current;
    if (!mountedRef.current
      || requestSequenceRef.current !== requestSequence
      || !current.expanded
      || current.recipeId !== context.recipeId
      || current.copyContextKey !== context.copyContextKey) return;
    setCopyPendingState(null);
    setCopyFeedbackState({ mode, result, ...context, requestSequence });
  };

  const feedbackKey = copyFeedback?.result === 'copied'
    ? 'recipeCopySuccess'
    : copyFeedback?.result === 'unsupported'
      ? 'recipeCopyUnsupported'
      : copyFeedback?.result === 'failed'
        ? 'recipeCopyFailed'
        : copyFeedback
          ? 'recipeCopyUnavailable'
          : null;
  const ingredients = (recipe.ingredients ?? '').split('\n').filter(Boolean);
  const steps = (recipe.steps ?? '').split('\n').filter(Boolean);
  const pad = compact ? 'p-2.5' : 'p-3 lg:p-3.5';
  const radius = compact ? 'rounded-2xl' : 'rounded-2xl lg:rounded-[18px]';

  return (
    <div
      className={`${radius} abs-cosmos-recipe-card border shadow-sm overflow-hidden transition-all ${theme.border} ${dark ? 'bg-surface' : 'bg-white'}`}
      data-k110-recipe-card={recipe.id}
      data-expanded={expanded ? 'true' : 'false'}
    >
      <div className={`flex items-center gap-2.5 ${pad} cursor-pointer`} onClick={onToggleExpand}>
        <div className={`w-2 h-2 rounded-full shrink-0 ${RECIPE_CATEGORY_COLORS[recipe.category] ?? 'bg-gray-400'}`} />
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm truncate">{recipe.title}</p>
          <p className={`text-[11px] ${theme.textMuted}`}>
            {recipe.category}
            {ingredients.length > 0 && ` · ${ingredients.length}`}
            {steps.length > 0 && ` · ${steps.length}`}
          </p>
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            disabled={mutationsDisabled || starPending}
            onClick={e => { e.stopPropagation(); onToggleStar(); }}
            className={`abs-recipe-favorite-action ${UI_INTERACTION.focusRingClass} p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center disabled:cursor-not-allowed disabled:text-disabled`}
            aria-label={t('recipeStarred')}
            aria-busy={starPending}
            data-starred={recipe.starred ? 'true' : 'false'}
          >
            <Star size={13} fill={recipe.starred ? 'currentColor' : 'none'} className={recipe.starred ? '' : theme.textMuted} />
          </button>
          <button
            type="button"
            disabled={mutationsDisabled || starPending}
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className={`${UI_INTERACTION.focusRingClass} p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center disabled:cursor-not-allowed disabled:text-disabled ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <Pencil size={12} className={theme.textMuted} />
          </button>
          <button
            type="button"
            disabled={mutationsDisabled}
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className={`abs-recipe-danger-action ${UI_INTERACTION.focusRingClass} p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center disabled:cursor-not-allowed disabled:text-disabled`}
          >
            <Trash2 size={12} />
          </button>
          {expanded ? <ChevronUp size={14} className={theme.textMuted} /> : <ChevronDown size={14} className={theme.textMuted} />}
        </div>
      </div>

      {expanded && (
        <div className={`abs-cosmos-recipe-expanded px-3 pb-3 lg:px-3.5 lg:pb-3.5 border-t ${theme.border} space-y-3 pt-3`}>
          <div className="flex flex-wrap gap-2" data-recipe-copy-actions>
            <button
              type="button"
              disabled={copyPending || !(recipe.ingredients ?? '').length}
              onClick={event => { event.stopPropagation(); void requestCopy('ingredients'); }}
              className={`${UI_INTERACTION.focusRingClass} inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:text-disabled ${theme.border} ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              data-recipe-copy-ingredients
              aria-busy={copyPending}
            >
              <Copy size={13} /> {t('recipeCopyIngredients')}
            </button>
            <button
              type="button"
              disabled={copyPending}
              onClick={event => { event.stopPropagation(); void requestCopy('full'); }}
              className={`${UI_INTERACTION.focusRingClass} inline-flex min-h-[40px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:text-disabled ${theme.border} ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
              data-recipe-copy-full
              aria-busy={copyPending}
            >
              <Copy size={13} /> {t('recipeCopyFull')}
            </button>
          </div>
          {feedbackKey && (
            <p className={`text-xs ${theme.textMuted}`} role="status" aria-live="polite" data-recipe-copy-feedback={copyFeedback?.result}>
              {t(feedbackKey)}
            </p>
          )}
          {ingredients.length > 0 && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${theme.textMuted}`}>{t('ingredients')}</p>
              <ul className="space-y-0.5">
                {ingredients.map((ing, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-primary font-bold shrink-0">·</span>
                    <span>{ing}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {steps.length > 0 && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1.5 ${theme.textMuted}`}>{t('steps')}</p>
              <ol className="space-y-1.5">
                {steps.map((step, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm">
                    <span className="abs-recipe-step-index shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold">{i + 1}</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
          {recipe.memo?.trim() && (
            <div>
              <p className={`text-[10px] font-bold uppercase tracking-wider mb-1 ${theme.textMuted}`}>{t('recipeMemo')}</p>
              <p className={`text-sm leading-relaxed ${theme.textMuted}`}>{recipe.memo}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
