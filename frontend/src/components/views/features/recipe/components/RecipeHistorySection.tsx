import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import type { RecipeHistoryGroup } from '../recipeProjectionModels';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';
import { History } from 'lucide-react';
import { RecipeCollapsibleSection } from './RecipeCollapsibleSection';

export interface RecipeHistorySectionProps {
  historyItems: readonly RecipeHistoryGroup[];
  theme: Theme;
  appSettings: AppSettings;
  collapsed: boolean;
  onToggle: () => void;
  onRecipeClick: (recipeId: string) => void;
}

const BUCKET_LABEL_KEYS = {
  today: 'k110HistoryToday',
  yesterday: 'k110HistoryYesterday',
  earlier: 'k110HistoryEarlier',
} as const;

export function RecipeHistorySection({
  historyItems,
  theme,
  appSettings,
  collapsed,
  onToggle,
  onRecipeClick,
}: RecipeHistorySectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const isEmpty = historyItems.every(g => g.items.length === 0);

  return (
    <RecipeCollapsibleSection
      sectionId="history"
      title={t('k110SectionHistory')}
      collapsed={collapsed}
      onToggle={onToggle}
      theme={theme}
      dark={appSettings.darkMode}
      lazy
      isEmpty={isEmpty}
      emptyHint={t('k110EmptyNoHistory')}
    >
      {isEmpty ? (
        <ProductEmptyState
          icon={History}
          title={t('k110EmptyNoHistory')}
          description={t('k110EmptyNoHistoryHint')}
          dataHook="k110-empty-history"
          theme={theme}
        />
      ) : (
        <div className="space-y-3" data-k110-history-list>
          {historyItems.map(group => {
            if (group.items.length === 0) return null;
            return (
              <div key={group.bucket} data-k110-history-group={group.bucket}>
                <p className={`text-[10px] font-bold uppercase tracking-wide mb-1.5 ${theme.textMuted}`}>
                  {t(BUCKET_LABEL_KEYS[group.bucket])}
                </p>
                <ul className="space-y-1">
                  {group.items.map(row => (
                    <li key={row.recipeId}>
                      <button
                        type="button"
                        className={`w-full text-left rounded-lg px-2 py-2 min-h-[44px] ${appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'}`}
                        onClick={() => onRecipeClick(row.recipeId)}
                        data-k110-history-row
                      >
                        <span className="text-xs font-medium block truncate">{row.title}</span>
                        <span className={`text-[10px] flex flex-wrap gap-x-3 gap-y-0.5 ${theme.textMuted}`}>
                          <span>{t('k110HistoryLastCooked')}: {row.lastCookedLabel}</span>
                          <span>{t('k110HistoryFrequency')}: {row.frequency}</span>
                          <span>{t('k110HistoryLastEdit')}: {row.lastEditLabel}</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </RecipeCollapsibleSection>
  );
}
