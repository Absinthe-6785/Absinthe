import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator, type TranslationKey } from '../../../../../lib/i18n';
import type { CollectionGroup } from '../recipeProjectionModels';
import { ProductEmptyState } from '../../../../common/ProductEmptyState';
import { Library } from 'lucide-react';
import { RecipeCollapsibleSection } from './RecipeCollapsibleSection';

export interface RecipeCollectionsSectionProps {
  collectionGroups: readonly CollectionGroup[];
  emptyAuthoritative: boolean;
  theme: Theme;
  appSettings: AppSettings;
  collapsed: boolean;
  onToggle: () => void;
  onRecipeClick: (recipeId: string) => void;
}

export function RecipeCollectionsSection({
  collectionGroups,
  emptyAuthoritative,
  theme,
  appSettings,
  collapsed,
  onToggle,
  onRecipeClick,
}: RecipeCollectionsSectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));

  return (
    <RecipeCollapsibleSection
      sectionId="collections"
      title={t('k110SectionCollections')}
      collapsed={collapsed}
      onToggle={onToggle}
      theme={theme}
      dark={appSettings.darkMode}
      lazy
      isEmpty={emptyAuthoritative && collectionGroups.length === 0}
      emptyHint={t('k110EmptyNoCollections')}
    >
      {collectionGroups.length === 0 && emptyAuthoritative ? (
        <ProductEmptyState
          icon={Library}
          title={t('k110EmptyNoCollections')}
          description={t('k110EmptyNoCollectionsHint')}
          dataHook="k110-empty-collections"
          theme={theme}
        />
      ) : collectionGroups.length > 0 ? (
        <div className="space-y-3" data-k110-collection-list>
          {collectionGroups.map(group => (
            <details
              key={group.id}
              className={`rounded-xl border ${theme.border} overflow-hidden`}
              data-k110-collection={group.id}
              open
            >
              <summary className={`cursor-pointer text-xs font-bold px-3 py-2.5 min-h-[44px] flex items-center ${appSettings.darkMode ? 'bg-surface' : 'bg-white'}`}>
                {t(group.labelKey as TranslationKey)} ({group.recipes.length})
              </summary>
              <ul className={`px-2 pb-2 ${appSettings.darkMode ? 'bg-surface/50' : 'bg-gray-50/50'}`}>
                {group.recipes.map(r => (
                  <li key={r.id}>
                    <button
                      type="button"
                      className={`w-full text-left text-xs font-medium py-2 px-2 min-h-[44px] rounded-lg ${appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'}`}
                      onClick={() => onRecipeClick(r.id)}
                      data-k110-collection-row={r.id}
                    >
                      {r.title}
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      ) : null}
    </RecipeCollapsibleSection>
  );
}
