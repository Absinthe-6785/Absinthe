import { Star, Pencil, Trash2, ChevronDown, ChevronUp, ChefHat, FileText } from 'lucide-react';
import type { Theme } from '../../../../../types';
import type { TranslationKey } from '../../../../../lib/i18n';
import type { Recipe } from '../recipeTypes';
import { RECIPE_CATEGORY_COLORS } from '../recipeTypes';

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
  onMarkCooked?: () => void;
  onOpenCookingNote?: () => void;
  compact?: boolean;
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
  onMarkCooked,
  onOpenCookingNote,
  compact = false,
}: RecipeCardProps) {
  const ingredients = (recipe.ingredients ?? '').split('\n').filter(Boolean);
  const steps = (recipe.steps ?? '').split('\n').filter(Boolean);
  const pad = compact ? 'p-2.5' : 'p-3 lg:p-3.5';
  const radius = compact ? 'rounded-2xl' : 'rounded-2xl lg:rounded-[18px]';

  return (
    <div
      className={`${radius} border shadow-sm overflow-hidden transition-all ${theme.border} ${dark ? 'bg-surface' : 'bg-white'}`}
      data-k110-recipe-card={recipe.id}
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
            onClick={e => { e.stopPropagation(); onToggleStar(); }}
            className="p-1.5 rounded-lg hover:bg-yellow-400/20 transition-colors min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center"
            aria-label={t('recipeStarred')}
          >
            <Star size={13} fill={recipe.starred ? '#8B5CF6' : 'none'} color={recipe.starred ? '#8B5CF6' : undefined} className={recipe.starred ? '' : theme.textMuted} />
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onEdit(); }}
            className={`p-1.5 rounded-lg transition-colors min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center ${dark ? 'hover:bg-white/10' : 'hover:bg-gray-100'}`}
          >
            <Pencil size={12} className={theme.textMuted} />
          </button>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg hover:bg-red-500/20 transition-colors min-h-[44px] min-w-[44px] lg:min-h-0 lg:min-w-0 flex items-center justify-center"
          >
            <Trash2 size={12} className={`${theme.textMuted} hover:text-red-500`} />
          </button>
          {expanded ? <ChevronUp size={14} className={theme.textMuted} /> : <ChevronDown size={14} className={theme.textMuted} />}
        </div>
      </div>

      {expanded && (
        <div className={`px-3 pb-3 lg:px-3.5 lg:pb-3.5 border-t ${theme.border} space-y-3 pt-3`}>
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
                    <span className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${dark ? 'bg-surface-alt text-primary' : 'bg-[#F0EDE5] text-primary-foreground'}`}>{i + 1}</span>
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
          {onOpenCookingNote ? (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onOpenCookingNote(); }}
              className="flex items-center gap-1.5 text-xs font-bold text-primary min-h-[44px] px-2 rounded-xl hover:bg-primary/10"
              data-k113-cross-ref="recipe"
              data-k113-open-cooking-note={recipe.id}
            >
              <FileText size={14} />
              {t('k113OpenCookingNote')}
            </button>
          ) : null}
          {onMarkCooked && (
            <button
              type="button"
              onClick={onMarkCooked}
              className="flex items-center gap-1.5 text-xs font-bold text-primary min-h-[44px] px-2 rounded-xl hover:bg-primary/10"
              data-k110-mark-cooked={recipe.id}
            >
              <ChefHat size={14} />
              {t('k110MarkCooked')}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
