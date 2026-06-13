import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import { switchToNotesTab } from '../../../../../lib/noteNavigation';
import type { ArchiveBrowseProjection } from '../../knowledge/archive';
import {
  listArchiveBrowseLinkItems,
  type ArchiveBrowseDestination,
} from './archiveBrowsePresentation';

export interface ArchiveBrowseLinksProps {
  browse: ArchiveBrowseProjection;
  theme: Theme;
  appSettings: AppSettings;
  onBrowseClick?: (destination: ArchiveBrowseDestination) => void;
}

export function ArchiveBrowseLinks({
  browse,
  theme,
  appSettings,
  onBrowseClick,
}: ArchiveBrowseLinksProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  const links = listArchiveBrowseLinkItems(browse);
  const isEmpty = links.length === 0;

  return (
    <section
      className={`rounded-[24px] lg:rounded-[32px] shadow-sm p-5 lg:p-6 flex flex-col transition-colors ${theme.card}`}
      data-archive-browse
      data-archive-browse-empty={isEmpty ? 'true' : 'false'}
      aria-label={t('archiveBrowseTitle')}
    >
      <h2 className="font-heading text-base font-bold mb-4">
        {t('archiveBrowseTitle')}
      </h2>

      {isEmpty ? (
        <div className="flex flex-col items-start gap-2" data-archive-browse-empty-message>
          <p className={`text-sm ${theme.textMuted}`}>
            {t('archiveBrowseEmpty')}
          </p>
          <p className={`text-xs ${theme.textMuted}`}>
            {t('archiveBrowseEmptyHint')}
          </p>
          <button
            type="button"
            className="text-sm font-semibold text-primary hover:underline"
            onClick={() => switchToNotesTab()}
          >
            {t('archiveEmptyCta')}
          </button>
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5" data-archive-browse-list>
          {links.map(link => (
            <li key={link.id}>
              <button
                type="button"
                className={`w-full text-left rounded-xl px-2 py-2 flex items-center gap-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                  appSettings.darkMode
                    ? 'hover:bg-white/5 text-white'
                    : 'hover:bg-black/[0.03] text-gray-900'
                }`}
                data-archive-browse-link={link.id}
                data-archive-browse-label={link.label}
                data-archive-browse-destination-type={link.destination.type}
                aria-label={link.label}
                onClick={() => onBrowseClick?.(link.destination)}
              >
                <span className={`text-xs ${theme.textMuted}`} aria-hidden="true">→</span>
                <span data-archive-browse-link-label>{link.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
