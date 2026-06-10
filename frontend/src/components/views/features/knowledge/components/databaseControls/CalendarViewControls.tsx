import { CALENDAR_DATE_PROPERTY_FIELD } from '../../databaseViews/databasePresentationMeta';
import type { DatabaseCalendarConfig } from '../../databaseViews/databasePresentationModels';
import { DatabasePropertyKeyField } from '../DatabasePropertyKeyField';

export interface CalendarViewControlsProps {
  calendarConfig: DatabaseCalendarConfig;
  onDatePropertyChange: (dateProperty: string) => void;
}

export function CalendarViewControls({
  calendarConfig,
  onDatePropertyChange,
}: CalendarViewControlsProps) {
  return (
    <DatabasePropertyKeyField
      preset={CALENDAR_DATE_PROPERTY_FIELD}
      value={calendarConfig.dateProperty}
      onChange={onDatePropertyChange}
      listId="database-calendar-date-suggestions"
    />
  );
}
