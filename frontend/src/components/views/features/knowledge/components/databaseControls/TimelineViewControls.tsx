import {
  TIMELINE_END_DATE_FIELD,
  TIMELINE_START_DATE_FIELD,
} from '../../databaseViews/databasePresentationMeta';
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
  return (
    <>
      <DatabasePropertyKeyField
        preset={TIMELINE_START_DATE_FIELD}
        value={timelineConfig.startDateProperty}
        onChange={onTimelineStartChange}
        listId="database-timeline-start-suggestions"
      />
      <DatabasePropertyKeyField
        preset={TIMELINE_END_DATE_FIELD}
        value={timelineConfig.endDateProperty ?? ''}
        onChange={onTimelineEndChange}
        listId="database-timeline-end-suggestions"
      />
    </>
  );
}
