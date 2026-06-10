import {
  defaultDatabaseViewColumns,
  DEFAULT_DATABASE_VIEW_SORT,
  normalizeDatabaseViewColumns,
  normalizeDatabaseViewSort,
} from './databaseViewConfig';
import { normalizeFormulaColumns } from '../formulas/formulaModels';
import { normalizeRollupColumns } from '../rollups/rollupModels';
import type {
  DatabaseBoardConfig,
  DatabaseCalendarConfig,
  DatabaseGalleryCardSize,
  DatabaseGalleryConfig,
  DatabasePresentationConfig,
  DatabaseTableConfig,
  DatabaseTimelineConfig,
  DatabaseTimelineSortBy,
} from './databasePresentationModels';
import type { DatabaseView, DatabaseViewPresentation } from './databaseViewModels';

export const DEFAULT_BOARD_GROUP_BY = 'status';
export const DEFAULT_CALENDAR_DATE_PROPERTY = 'updatedAt';
export const DEFAULT_TIMELINE_START_PROPERTY = 'startDate';
export const DEFAULT_TIMELINE_END_PROPERTY = 'endDate';
export const DEFAULT_GALLERY_COVER_PROPERTY = 'coverImage';
export const DEFAULT_GALLERY_CARD_FIELDS = ['status', 'priority', 'reviewDate'] as const;
export const UNASSIGNED_LANE_KEY = '__unassigned__';
export const UNASSIGNED_LANE_LABEL = 'No value';

export function defaultTablePresentationConfig(): DatabaseTableConfig {
  return {
    type: 'table',
    columns: defaultDatabaseViewColumns(),
    sort: { ...DEFAULT_DATABASE_VIEW_SORT },
    rollupColumns: [],
    formulaColumns: [],
  };
}

export function defaultBoardPresentationConfig(
  groupBy = DEFAULT_BOARD_GROUP_BY,
): DatabaseBoardConfig {
  return {
    type: 'board',
    groupBy,
  };
}

export function defaultCalendarPresentationConfig(
  dateProperty = DEFAULT_CALENDAR_DATE_PROPERTY,
): DatabaseCalendarConfig {
  return {
    type: 'calendar',
    dateProperty,
  };
}

export function defaultTimelinePresentationConfig(
  startDateProperty = DEFAULT_TIMELINE_START_PROPERTY,
  endDateProperty = DEFAULT_TIMELINE_END_PROPERTY,
): DatabaseTimelineConfig {
  return {
    type: 'timeline',
    startDateProperty,
    endDateProperty,
  };
}

export function defaultGalleryPresentationConfig(
  coverProperty = DEFAULT_GALLERY_COVER_PROPERTY,
  cardFields: readonly string[] = DEFAULT_GALLERY_CARD_FIELDS,
): DatabaseGalleryConfig {
  return {
    type: 'gallery',
    coverProperty,
    cardFields: [...cardFields],
  };
}

export function defaultPresentationConfig(
  presentation: DatabaseViewPresentation,
): DatabasePresentationConfig {
  switch (presentation) {
    case 'board':
      return defaultBoardPresentationConfig();
    case 'calendar':
      return defaultCalendarPresentationConfig();
    case 'timeline':
      return defaultTimelinePresentationConfig();
    case 'gallery':
      return defaultGalleryPresentationConfig();
    default:
      return defaultTablePresentationConfig();
  }
}

/** Lift legacy root columns/sort into a table presentation config */
export function liftLegacyTableConfig(view: Partial<DatabaseView>): DatabaseTableConfig {
  return {
    type: 'table',
    columns: normalizeDatabaseViewColumns(view.columns ?? defaultDatabaseViewColumns()),
    sort: normalizeDatabaseViewSort(view.sort ?? DEFAULT_DATABASE_VIEW_SORT),
    rollupColumns: [],
    formulaColumns: [],
  };
}

export function normalizeBoardConfig(raw: unknown): DatabaseBoardConfig {
  if (raw && typeof raw === 'object') {
    const record = raw as Partial<DatabaseBoardConfig>;
    if (record.type === 'board' && typeof record.groupBy === 'string' && record.groupBy.trim()) {
      const config: DatabaseBoardConfig = {
        type: 'board',
        groupBy: record.groupBy.trim(),
      };
      if (Array.isArray(record.lanes)) {
        const lanes = record.lanes
          .filter(lane => typeof lane === 'string' && lane.trim())
          .map(lane => lane.trim());
        if (lanes.length > 0) config.lanes = lanes;
      }
      if (Array.isArray(record.cardFields)) {
        const cardFields = record.cardFields
          .filter(field => typeof field === 'string' && field.trim())
          .map(field => field.trim());
        if (cardFields.length > 0) config.cardFields = cardFields;
      }
      return config;
    }
  }
  return defaultBoardPresentationConfig();
}

export function normalizeCalendarConfig(raw: unknown): DatabaseCalendarConfig {
  if (raw && typeof raw === 'object') {
    const record = raw as Partial<DatabaseCalendarConfig>;
    if (record.type === 'calendar' && typeof record.dateProperty === 'string' && record.dateProperty.trim()) {
      const config: DatabaseCalendarConfig = {
        type: 'calendar',
        dateProperty: record.dateProperty.trim(),
      };
      if (typeof record.unscheduledLabel === 'string' && record.unscheduledLabel.trim()) {
        config.unscheduledLabel = record.unscheduledLabel.trim();
      }
      return config;
    }
  }
  return defaultCalendarPresentationConfig();
}

const TIMELINE_SORT_KEYS: readonly DatabaseTimelineSortBy[] = ['start', 'end', 'title'];

export function normalizeTimelineConfig(raw: unknown): DatabaseTimelineConfig {
  if (raw && typeof raw === 'object') {
    const record = raw as Partial<DatabaseTimelineConfig>;
    if (record.type === 'timeline' && typeof record.startDateProperty === 'string' && record.startDateProperty.trim()) {
      const config: DatabaseTimelineConfig = {
        type: 'timeline',
        startDateProperty: record.startDateProperty.trim(),
      };
      if (typeof record.endDateProperty === 'string' && record.endDateProperty.trim()) {
        config.endDateProperty = record.endDateProperty.trim();
      }
      if (record.sortBy && (TIMELINE_SORT_KEYS as readonly string[]).includes(record.sortBy)) {
        config.sortBy = record.sortBy;
      }
      if (typeof record.unscheduledLabel === 'string' && record.unscheduledLabel.trim()) {
        config.unscheduledLabel = record.unscheduledLabel.trim();
      }
      return config;
    }
  }
  return defaultTimelinePresentationConfig();
}

const GALLERY_CARD_SIZES: readonly DatabaseGalleryCardSize[] = ['compact', 'medium', 'large'];

export function normalizeGalleryConfig(raw: unknown): DatabaseGalleryConfig {
  if (raw && typeof raw === 'object') {
    const record = raw as Partial<DatabaseGalleryConfig>;
    if (record.type === 'gallery') {
      const config = defaultGalleryPresentationConfig();
      if (typeof record.coverProperty === 'string' && record.coverProperty.trim()) {
        config.coverProperty = record.coverProperty.trim();
      }
      if (Array.isArray(record.cardFields)) {
        const cardFields = record.cardFields
          .filter(field => typeof field === 'string' && field.trim())
          .map(field => field.trim());
        if (cardFields.length > 0) config.cardFields = cardFields;
      }
      if (record.cardSize && (GALLERY_CARD_SIZES as readonly string[]).includes(record.cardSize)) {
        config.cardSize = record.cardSize;
      }
      return config;
    }
  }
  return defaultGalleryPresentationConfig();
}

export function normalizePresentationConfig(
  raw: unknown,
  presentation: DatabaseViewPresentation,
  legacyView?: Partial<DatabaseView>,
): DatabasePresentationConfig {
  if (raw && typeof raw === 'object') {
    const record = raw as { type?: string };
    if (record.type === 'table') {
      const table = raw as Partial<DatabaseTableConfig>;
      return {
        type: 'table',
        columns: normalizeDatabaseViewColumns(
          table.columns ?? legacyView?.columns ?? defaultDatabaseViewColumns(),
        ),
        sort: normalizeDatabaseViewSort(
          table.sort ?? legacyView?.sort ?? DEFAULT_DATABASE_VIEW_SORT,
        ),
        rollupColumns: normalizeRollupColumns(table.rollupColumns),
        formulaColumns: normalizeFormulaColumns(table.formulaColumns),
      };
    }
    if (record.type === 'board') {
      return normalizeBoardConfig(raw);
    }
    if (record.type === 'calendar') {
      return normalizeCalendarConfig(raw);
    }
    if (record.type === 'timeline') {
      return normalizeTimelineConfig(raw);
    }
    if (record.type === 'gallery') {
      return normalizeGalleryConfig(raw);
    }
  }

  if (presentation === 'board') {
    return defaultBoardPresentationConfig();
  }
  if (presentation === 'calendar') {
    return defaultCalendarPresentationConfig();
  }
  if (presentation === 'timeline') {
    return defaultTimelinePresentationConfig();
  }
  if (presentation === 'gallery') {
    return defaultGalleryPresentationConfig();
  }
  return liftLegacyTableConfig(legacyView ?? {});
}

export function getTableConfig(view: DatabaseView): DatabaseTableConfig {
  const normalized = withPresentationDefaults(view);
  if (normalized.presentationConfig.type === 'table') {
    return normalized.presentationConfig;
  }
  return liftLegacyTableConfig(view);
}

export function getBoardConfig(view: DatabaseView): DatabaseBoardConfig {
  const normalized = withPresentationDefaults(view);
  if (normalized.presentationConfig.type === 'board') {
    return normalized.presentationConfig;
  }
  return defaultBoardPresentationConfig();
}

export function getCalendarConfig(view: DatabaseView): DatabaseCalendarConfig {
  const normalized = withPresentationDefaults(view);
  if (normalized.presentationConfig.type === 'calendar') {
    return normalized.presentationConfig;
  }
  return defaultCalendarPresentationConfig();
}

export function getTimelineConfig(view: DatabaseView): DatabaseTimelineConfig {
  const normalized = withPresentationDefaults(view);
  if (normalized.presentationConfig.type === 'timeline') {
    return normalized.presentationConfig;
  }
  return defaultTimelinePresentationConfig();
}

export function getGalleryConfig(view: DatabaseView): DatabaseGalleryConfig {
  const normalized = withPresentationDefaults(view);
  if (normalized.presentationConfig.type === 'gallery') {
    return normalized.presentationConfig;
  }
  return defaultGalleryPresentationConfig();
}

/** Sync legacy root columns/sort from table config for backward-compatible persistence */
export function syncLegacyTableFields(
  view: DatabaseView,
  table: DatabaseTableConfig,
): Pick<DatabaseView, 'columns' | 'sort'> {
  return {
    columns: table.columns,
    sort: table.sort,
  };
}

export function withPresentationDefaults(view: DatabaseView): DatabaseView {
  const presentation = view.presentation ?? 'table';
  const presentationConfig = normalizePresentationConfig(
    view.presentationConfig,
    presentation,
    view,
  );

  if (presentation === 'table' && presentationConfig.type === 'table') {
    return {
      ...view,
      presentation,
      presentationConfig,
      ...syncLegacyTableFields(view, presentationConfig),
    };
  }

  if (presentation === 'board' && presentationConfig.type === 'board') {
    const tableCache = view.presentationConfig?.type === 'table'
      ? view.presentationConfig
      : liftLegacyTableConfig(view);
    return {
      ...view,
      presentation,
      presentationConfig,
      ...syncLegacyTableFields(view, tableCache),
    };
  }

  if (presentation === 'calendar' && presentationConfig.type === 'calendar') {
    const tableCache = view.presentationConfig?.type === 'table'
      ? view.presentationConfig
      : liftLegacyTableConfig(view);
    return {
      ...view,
      presentation,
      presentationConfig,
      ...syncLegacyTableFields(view, tableCache),
    };
  }

  if (presentation === 'timeline' && presentationConfig.type === 'timeline') {
    const tableCache = view.presentationConfig?.type === 'table'
      ? view.presentationConfig
      : liftLegacyTableConfig(view);
    return {
      ...view,
      presentation,
      presentationConfig,
      ...syncLegacyTableFields(view, tableCache),
    };
  }

  if (presentation === 'gallery' && presentationConfig.type === 'gallery') {
    const tableCache = view.presentationConfig?.type === 'table'
      ? view.presentationConfig
      : liftLegacyTableConfig(view);
    return {
      ...view,
      presentation,
      presentationConfig,
      ...syncLegacyTableFields(view, tableCache),
    };
  }

  return {
    ...view,
    presentation,
    presentationConfig: defaultPresentationConfig(presentation),
    ...(presentation === 'table'
      ? syncLegacyTableFields(view, defaultTablePresentationConfig())
      : syncLegacyTableFields(view, liftLegacyTableConfig(view))),
  };
}

export function setViewPresentation(
  view: DatabaseView,
  presentation: DatabaseViewPresentation,
): DatabaseView {
  if (presentation === view.presentation) {
    return withPresentationDefaults(view);
  }

  const current = withPresentationDefaults(view);
  let presentationConfig: DatabasePresentationConfig;

  if (presentation === 'table') {
    presentationConfig = current.presentationConfig.type === 'table'
      ? current.presentationConfig
      : liftLegacyTableConfig(current);
  } else if (presentation === 'board') {
    presentationConfig = current.presentationConfig.type === 'board'
      ? current.presentationConfig
      : defaultBoardPresentationConfig();
  } else if (presentation === 'calendar') {
    presentationConfig = current.presentationConfig.type === 'calendar'
      ? current.presentationConfig
      : defaultCalendarPresentationConfig();
  } else if (presentation === 'timeline') {
    presentationConfig = current.presentationConfig.type === 'timeline'
      ? current.presentationConfig
      : defaultTimelinePresentationConfig();
  } else if (presentation === 'gallery') {
    presentationConfig = current.presentationConfig.type === 'gallery'
      ? current.presentationConfig
      : defaultGalleryPresentationConfig();
  } else {
    presentationConfig = defaultPresentationConfig(presentation);
  }

  return withPresentationDefaults({
    ...current,
    presentation,
    presentationConfig,
  });
}

export function setBoardGroupBy(view: DatabaseView, groupBy: string): DatabaseView {
  const trimmed = groupBy.trim();
  if (!trimmed) return view;

  const current = withPresentationDefaults(view);
  const boardConfig: DatabaseBoardConfig = {
    type: 'board',
    groupBy: trimmed,
    ...(current.presentationConfig.type === 'board' && current.presentationConfig.lanes
      ? { lanes: current.presentationConfig.lanes }
      : {}),
    ...(current.presentationConfig.type === 'board' && current.presentationConfig.cardFields
      ? { cardFields: current.presentationConfig.cardFields }
      : {}),
  };

  return withPresentationDefaults({
    ...current,
    presentation: 'board',
    presentationConfig: boardConfig,
  });
}

export function setCalendarDateProperty(view: DatabaseView, dateProperty: string): DatabaseView {
  const trimmed = dateProperty.trim();
  if (!trimmed) return view;

  const current = withPresentationDefaults(view);
  const calendarConfig: DatabaseCalendarConfig = {
    type: 'calendar',
    dateProperty: trimmed,
    ...(current.presentationConfig.type === 'calendar' && current.presentationConfig.unscheduledLabel
      ? { unscheduledLabel: current.presentationConfig.unscheduledLabel }
      : {}),
  };

  return withPresentationDefaults({
    ...current,
    presentation: 'calendar',
    presentationConfig: calendarConfig,
  });
}

export function setTimelineStartDateProperty(view: DatabaseView, startDateProperty: string): DatabaseView {
  const trimmed = startDateProperty.trim();
  if (!trimmed) return view;

  const current = withPresentationDefaults(view);
  const timelineConfig: DatabaseTimelineConfig = {
    type: 'timeline',
    startDateProperty: trimmed,
    ...(current.presentationConfig.type === 'timeline' && current.presentationConfig.endDateProperty
      ? { endDateProperty: current.presentationConfig.endDateProperty }
      : { endDateProperty: DEFAULT_TIMELINE_END_PROPERTY }),
    ...(current.presentationConfig.type === 'timeline' && current.presentationConfig.sortBy
      ? { sortBy: current.presentationConfig.sortBy }
      : {}),
    ...(current.presentationConfig.type === 'timeline' && current.presentationConfig.unscheduledLabel
      ? { unscheduledLabel: current.presentationConfig.unscheduledLabel }
      : {}),
  };

  return withPresentationDefaults({
    ...current,
    presentation: 'timeline',
    presentationConfig: timelineConfig,
  });
}

export function setTimelineEndDateProperty(view: DatabaseView, endDateProperty: string): DatabaseView {
  const trimmed = endDateProperty.trim();
  if (!trimmed) return view;

  const current = withPresentationDefaults(view);
  const timelineConfig: DatabaseTimelineConfig = {
    type: 'timeline',
    startDateProperty: current.presentationConfig.type === 'timeline'
      ? current.presentationConfig.startDateProperty
      : DEFAULT_TIMELINE_START_PROPERTY,
    endDateProperty: trimmed,
    ...(current.presentationConfig.type === 'timeline' && current.presentationConfig.sortBy
      ? { sortBy: current.presentationConfig.sortBy }
      : {}),
    ...(current.presentationConfig.type === 'timeline' && current.presentationConfig.unscheduledLabel
      ? { unscheduledLabel: current.presentationConfig.unscheduledLabel }
      : {}),
  };

  return withPresentationDefaults({
    ...current,
    presentation: 'timeline',
    presentationConfig: timelineConfig,
  });
}

export function setGalleryCoverProperty(view: DatabaseView, coverProperty: string): DatabaseView {
  const trimmed = coverProperty.trim();
  if (!trimmed) return view;

  const current = withPresentationDefaults(view);
  const galleryConfig: DatabaseGalleryConfig = {
    type: 'gallery',
    coverProperty: trimmed,
    ...(current.presentationConfig.type === 'gallery' && current.presentationConfig.cardFields
      ? { cardFields: current.presentationConfig.cardFields }
      : { cardFields: [...DEFAULT_GALLERY_CARD_FIELDS] }),
    ...(current.presentationConfig.type === 'gallery' && current.presentationConfig.cardSize
      ? { cardSize: current.presentationConfig.cardSize }
      : {}),
  };

  return withPresentationDefaults({
    ...current,
    presentation: 'gallery',
    presentationConfig: galleryConfig,
  });
}

export function setGalleryCardFields(view: DatabaseView, cardFields: readonly string[]): DatabaseView {
  const normalizedFields = cardFields
    .map(field => field.trim())
    .filter(Boolean);
  if (normalizedFields.length === 0) return view;

  const current = withPresentationDefaults(view);
  const galleryConfig: DatabaseGalleryConfig = {
    type: 'gallery',
    ...(current.presentationConfig.type === 'gallery' && current.presentationConfig.coverProperty
      ? { coverProperty: current.presentationConfig.coverProperty }
      : { coverProperty: DEFAULT_GALLERY_COVER_PROPERTY }),
    cardFields: normalizedFields,
    ...(current.presentationConfig.type === 'gallery' && current.presentationConfig.cardSize
      ? { cardSize: current.presentationConfig.cardSize }
      : {}),
  };

  return withPresentationDefaults({
    ...current,
    presentation: 'gallery',
    presentationConfig: galleryConfig,
  });
}
