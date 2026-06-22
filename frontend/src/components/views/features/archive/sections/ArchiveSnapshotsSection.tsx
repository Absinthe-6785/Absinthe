import { Eye } from 'lucide-react';
import type { AppSettings, Theme } from '../../../../../types';
import { resolveAppLanguage, getTranslator } from '../../../../../lib/i18n';
import type { ArchiveSnapshotProjection } from '../../knowledge/archive';
import { ArchiveCollapsibleSection } from './ArchiveCollapsibleSection';

export interface ArchiveSnapshotsSectionProps {
  snapshots: ArchiveSnapshotProjection;
  theme: Theme;
  appSettings: AppSettings;
  collapsed: boolean;
  onToggle: () => void;
  onRestoreSnapshot: (snapshotId: string) => void;
}

function SnapshotCard({
  label,
  item,
  theme,
  appSettings,
  onRestore,
}: {
  label: string;
  item: NonNullable<ArchiveSnapshotProjection['latest']>;
  theme: Theme;
  appSettings: AppSettings;
  onRestore: () => void;
}) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));
  return (
    <div
      className={`rounded-xl border p-2.5 flex flex-col gap-1.5 ${theme.border} ${theme.input}`}
      data-k109-snapshot-card
      data-k109-snapshot-slot={item.slot}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold">{label}</p>
          <p className={`text-[10px] ${theme.textMuted}`}>{item.relativeLabel}</p>
        </div>
        <span className={`text-[10px] font-semibold ${theme.textMuted}`}>
          {t('k109SnapshotNoteCount').replace('{count}', String(item.noteCount))}
        </span>
      </div>
      <button
        type="button"
        onClick={onRestore}
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] text-xs font-bold text-primary"
        data-k109-snapshot-restore
      >
        <Eye size={14} />
        {t('k109SnapshotRestore')}
      </button>
    </div>
  );
}

export function ArchiveSnapshotsSection({
  snapshots,
  theme,
  appSettings,
  collapsed,
  onToggle,
  onRestoreSnapshot,
}: ArchiveSnapshotsSectionProps) {
  const t = getTranslator(resolveAppLanguage(appSettings.language));

  const cards = [
    { key: 'latest', label: t('k109SnapshotLatest'), item: snapshots.latest },
    { key: 'daily', label: t('k109SnapshotDaily'), item: snapshots.daily },
    { key: 'weekly', label: t('k109SnapshotWeekly'), item: snapshots.weekly },
    { key: 'monthly', label: t('k109SnapshotMonthly'), item: snapshots.monthly },
  ].filter((c): c is typeof c & { item: NonNullable<typeof c.item> } => c.item != null);

  return (
    <ArchiveCollapsibleSection
      sectionId="snapshots"
      title={t('k109SectionSnapshots')}
      collapsed={collapsed}
      onToggle={onToggle}
      theme={theme}
      dark={appSettings.darkMode}
      isEmpty={snapshots.isEmpty}
      emptyHint={t('k109EmptySnapshots')}
      major
    >
      {!snapshots.isEmpty && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" data-k109-snapshots-grid>
          {cards.map(({ key, label, item }) => (
            <SnapshotCard
              key={key}
              label={label}
              item={item}
              theme={theme}
              appSettings={appSettings}
              onRestore={() => onRestoreSnapshot(item.snapshotId)}
            />
          ))}
        </div>
      )}
    </ArchiveCollapsibleSection>
  );
}
