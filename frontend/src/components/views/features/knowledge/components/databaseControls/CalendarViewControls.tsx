import { useTranslation } from '@/lib/i18n';
import { getDatabasePropertyFieldPreset } from '../../databaseViews/databasePresentationMeta';
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
  const { lang } = useTranslation();
  return (
    <DatabasePropertyKeyField
      preset={getDatabasePropertyFieldPreset('calendarDate', lang)}
      value={calendarConfig.dateProperty}
      onChange={onDatePropertyChange}
      listId="database-calendar-date-suggestions"
    />
  );
}
