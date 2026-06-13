import { useTranslation } from '../../../../../../lib/i18n';
import { getDatabasePropertyFieldPreset } from '../../databaseViews/databasePresentationMeta';
import type { DatabaseTimelineConfig } from '../../databaseViews/databasePresentationModels';
import { DatabasePropertyKeyField } from '../DatabasePropertyKeyField';

export interface TimelineViewControlsProps {
  timelineConfig: DatabaseTimelineConfig;
  onTimelineStartChange: (startDateProperty: string) => void;
  onTimelineEndChange: (endDateProperty: string) => void;
}

export function TimelineViewControls({
  timelineConfig,
  onTimelineStartChange,
  onTimelineEndChange,
}: TimelineViewControlsProps) {
  const { lang } = useTranslation();
  return (
    <>
      <DatabasePropertyKeyField
        preset={getDatabasePropertyFieldPreset('timelineStart', lang)}
        value={timelineConfig.startDateProperty}
        onChange={onTimelineStartChange}
        listId="database-timeline-start-suggestions"
      />
      <DatabasePropertyKeyField
        preset={getDatabasePropertyFieldPreset('timelineEnd', lang)}
        value={timelineConfig.endDateProperty ?? ''}
        onChange={onTimelineEndChange}
        listId="database-timeline-end-suggestions"
      />
    </>
  );
}
