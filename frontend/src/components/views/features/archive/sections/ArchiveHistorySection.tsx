import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import type { ArchiveHistoryProjection } from '../../knowledge/archive';
import { ArchiveCollapsibleSection } from './ArchiveCollapsibleSection';
import { openNote } from '../../../../../lib/noteNavigation';

export interface ArchiveHistorySectionProps {
  history: ArchiveHistoryProjection;
  theme: Theme;
  appSettings: AppSettings;
  collapsed: boolean;
  onToggle: () => void;
}

const BUCKET_LABEL_KEYS = {
  today: 'k109HistoryToday',
  yesterday: 'k109HistoryYesterday',
  earlier: 'k109HistoryEarlier',
} as const;

const KIND_LABEL_KEYS = {
  opened: 'k109HistoryOpened',
  edited: 'k109HistoryEdited',
  restored: 'k109HistoryRestored',
} as const;

export function ArchiveHistorySection({
  history,
  theme,
  appSettings,
  collapsed,
  onToggle,
}: ArchiveHistorySectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));

  return (
    <ArchiveCollapsibleSection
      sectionId="history"
      title={t('k109SectionHistory')}
      collapsed={collapsed}
      onToggle={onToggle}
      theme={theme}
      dark={appSettings.darkMode}
      isEmpty={history.isEmpty}
      emptyHint={t('k109EmptyHistory')}
      tone="primary"
    >
      <div className="space-y-3.5" data-k109-history-list>
        {history.groups.map(group => {
          const hasAny = group.opened.length + group.edited.length + group.restored.length > 0;
          if (!hasAny) return null;
          return (
            <div key={group.bucket} data-k109-history-group={group.bucket}>
              <p className={`text-[10px] font-bold uppercase tracking-wide mb-1 ${theme.textMuted}`}>
                {t(BUCKET_LABEL_KEYS[group.bucket])}
              </p>
              <div className="space-y-2">
                {(['opened', 'edited', 'restored'] as const).map(kind => {
                  const items = kind === 'opened' ? group.opened
                    : kind === 'edited' ? group.edited
                      : group.restored;
                  if (items.length === 0) return null;
                  return (
                    <div key={kind} data-k109-history-kind={kind}>
                      <p className={`text-[10px] font-semibold mb-1 ${theme.textMuted}`}>
                        {t(KIND_LABEL_KEYS[kind])}
                      </p>
                      <ul className="space-y-0.5">
                        {items.map(item => (
                          <li key={`${kind}-${item.noteId}`}>
                            <button
                              type="button"
                              className={`w-full flex items-center justify-between gap-2 text-left text-xs py-2 px-1 min-h-[44px] lg:min-h-[36px] rounded-lg hover:opacity-90 ${appSettings.darkMode ? 'hover:bg-white/5' : 'hover:bg-black/[0.03]'}`}
                              onClick={() => openNote(item.noteId, {
                                returnTab: 'analytics',
                                breadcrumb: [{ type: 'key', key: 'k109SectionHistory' }],
                              })}
                              data-k109-history-row
                              data-k113-open-in-notes
                            >
                              <span className="truncate font-medium flex flex-col min-w-0">
                                <span className="truncate">{item.title}</span>
                                <span className={`text-[9px] font-semibold ${theme.textMuted}`}>{t('k113OpenInNotes')}</span>
                              </span>
                              <span className={`shrink-0 text-[10px] ${theme.textMuted}`}>{item.relativeLabel}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </ArchiveCollapsibleSection>
  );
}
