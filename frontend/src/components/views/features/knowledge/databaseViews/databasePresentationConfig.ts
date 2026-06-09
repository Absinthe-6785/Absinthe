import {
  defaultDatabaseViewColumns,
  DEFAULT_DATABASE_VIEW_SORT,
  normalizeDatabaseViewColumns,
  normalizeDatabaseViewSort,
} from './databaseViewConfig';
import type {
  DatabaseBoardConfig,
  DatabasePresentationConfig,
  DatabaseTableConfig,
} from './databasePresentationModels';
import type { DatabaseView, DatabaseViewPresentation } from './databaseViewModels';

export const DEFAULT_BOARD_GROUP_BY = 'status';
export const UNASSIGNED_LANE_KEY = '__unassigned__';
export const UNASSIGNED_LANE_LABEL = 'No value';

export function defaultTablePresentationConfig(): DatabaseTableConfig {
  return {
    type: 'table',
    columns: defaultDatabaseViewColumns(),
    sort: { ...DEFAULT_DATABASE_VIEW_SORT },
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

export function defaultPresentationConfig(
  presentation: DatabaseViewPresentation,
): DatabasePresentationConfig {
  switch (presentation) {
    case 'board':
      return defaultBoardPresentationConfig();
    case 'calendar':
      return { type: 'calendar', dateProperty: 'updatedAt' };
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
      };
    }
    if (record.type === 'board') {
      return normalizeBoardConfig(raw);
    }
  }

  if (presentation === 'board') {
    return defaultBoardPresentationConfig();
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
