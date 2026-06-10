import {
  DEFAULT_DATABASE_VIEW_SORT,
  normalizeDatabaseViewColumns,
} from './databaseViewConfig';
import {
  defaultBoardPresentationConfig,
  defaultCalendarPresentationConfig,
  defaultGalleryPresentationConfig,
  defaultTablePresentationConfig,
  defaultTimelinePresentationConfig,
  syncLegacyTableFields,
  withPresentationDefaults,
} from './databasePresentationConfig';
import type {
  DatabaseTableConfig,
  DatabaseViewSortRule,
} from './databasePresentationModels';
import type { DatabaseView, DatabaseViewPresentation } from './databaseViewModels';
import {
  migrateLegacySortToSortRules,
  primarySortRule,
} from './databaseSortFutureModels';
import type { VisualFilterModel } from '../query/visualFilterModels';
import { mergeQueryWithVisualFilter } from '../query/visualFilterModels';
import { isValidDatabaseViewQuery } from './databaseViews';

export interface DatabaseTemplateDefinition {
  id: string;
  name: string;
  description: string;
  presentation: DatabaseViewPresentation;
  createView: () => DatabaseView;
}

export interface CreateDatabaseViewFromTemplateOptions {
  id?: string;
  name?: string;
}

interface TemplateBuildParams {
  id?: string;
  name: string;
  query: string;
  presentation: DatabaseViewPresentation;
  propertyColumns: readonly string[];
  sortRules?: readonly DatabaseViewSortRule[];
  visualFilters?: VisualFilterModel;
  boardGroupBy?: string;
  calendarDateProperty?: string;
  timelineStartDateProperty?: string;
  timelineEndDateProperty?: string;
  galleryCoverProperty?: string;
  galleryCardFields?: readonly string[];
}

function buildTableConfig(
  propertyColumns: readonly string[],
  options: {
    sortRules?: readonly DatabaseViewSortRule[];
    visualFilters?: VisualFilterModel;
  } = {},
): DatabaseTableConfig {
  const sortRules = options.sortRules
    ? [...options.sortRules]
    : migrateLegacySortToSortRules(DEFAULT_DATABASE_VIEW_SORT);
  return {
    type: 'table',
    columns: normalizeDatabaseViewColumns(
      propertyColumns.map(key => ({ key, visible: true })),
    ),
    sort: primarySortRule(sortRules),
    sortRules,
    rollupColumns: [],
    formulaColumns: [],
    ...(options.visualFilters ? { visualFilters: options.visualFilters } : {}),
  };
}

function effectiveQuery(baseQuery: string, visualFilters?: VisualFilterModel): string {
  if (!visualFilters) return baseQuery;
  return mergeQueryWithVisualFilter(baseQuery, visualFilters);
}

function buildTemplateDatabaseView(params: TemplateBuildParams): DatabaseView {
  const tableConfig = buildTableConfig(params.propertyColumns, {
    sortRules: params.sortRules,
    visualFilters: params.presentation === 'table' ? params.visualFilters : undefined,
  });

  const query = effectiveQuery(
    params.query,
    params.presentation === 'table' ? undefined : params.visualFilters,
  );

  const presentationConfig = params.presentation === 'board'
    ? defaultBoardPresentationConfig(params.boardGroupBy ?? 'status')
    : params.presentation === 'calendar'
      ? defaultCalendarPresentationConfig(params.calendarDateProperty ?? 'reviewDate')
      : params.presentation === 'timeline'
        ? defaultTimelinePresentationConfig(
          params.timelineStartDateProperty ?? 'startDate',
          params.timelineEndDateProperty ?? 'endDate',
        )
        : params.presentation === 'gallery'
          ? defaultGalleryPresentationConfig(
            params.galleryCoverProperty ?? 'coverImage',
            params.galleryCardFields,
          )
          : tableConfig;

  const tableFields = syncLegacyTableFields(
    {} as DatabaseView,
    params.presentation === 'table' ? tableConfig : tableConfig,
  );

  return withPresentationDefaults({
    id: params.id ?? `database-${Date.now()}`,
    name: params.name,
    query,
    presentation: params.presentation,
    presentationConfig,
    ...tableFields,
  });
}

const statusActiveFilter: VisualFilterModel = {
  groups: [{
    logic: 'and',
    conditions: [{ kind: 'property', field: 'status', operator: '=', value: 'active' }],
  }],
};

export const DATABASE_TEMPLATES: readonly DatabaseTemplateDefinition[] = [
  {
    id: 'study-tracker',
    name: 'Study Tracker',
    description: 'Board view grouped by status for study tasks with subject and review dates.',
    presentation: 'board',
    createView: () => buildTemplateDatabaseView({
      name: 'Study Tracker',
      query: 'tag:study',
      presentation: 'board',
      propertyColumns: ['status', 'subject', 'reviewDate'],
      boardGroupBy: 'status',
      sortRules: [{ key: 'reviewDate', direction: 'asc' }],
      visualFilters: statusActiveFilter,
    }),
  },
  {
    id: 'reading-tracker',
    name: 'Reading Tracker',
    description: 'Table view for books and articles sorted by rating with author and status.',
    presentation: 'table',
    createView: () => buildTemplateDatabaseView({
      name: 'Reading Tracker',
      query: 'tag:reading',
      presentation: 'table',
      propertyColumns: ['status', 'author', 'rating'],
      sortRules: [
        { key: 'rating', direction: 'desc' },
        { key: 'updatedAt', direction: 'desc' },
      ],
      visualFilters: statusActiveFilter,
    }),
  },
  {
    id: 'project-tracker',
    name: 'Project Tracker',
    description: 'Board view for projects grouped by status with priority and due dates.',
    presentation: 'board',
    createView: () => buildTemplateDatabaseView({
      name: 'Project Tracker',
      query: 'tag:project',
      presentation: 'board',
      propertyColumns: ['status', 'priority', 'dueDate'],
      boardGroupBy: 'status',
      sortRules: [
        { key: 'priority', direction: 'desc' },
        { key: 'dueDate', direction: 'asc' },
      ],
    }),
  },
  {
    id: 'language-learning',
    name: 'Language Learning',
    description: 'Calendar view scheduling reviews by language level and review date.',
    presentation: 'calendar',
    createView: () => buildTemplateDatabaseView({
      name: 'Language Learning',
      query: 'tag:language',
      presentation: 'calendar',
      propertyColumns: ['language', 'level', 'reviewDate'],
      calendarDateProperty: 'reviewDate',
      sortRules: [{ key: 'reviewDate', direction: 'asc' }],
    }),
  },
  {
    id: 'exam-planner',
    name: 'Exam Planner',
    description: 'Timeline view for exam preparation with subject progress tracking.',
    presentation: 'timeline',
    createView: () => buildTemplateDatabaseView({
      name: 'Exam Planner',
      query: 'tag:exam',
      presentation: 'timeline',
      propertyColumns: ['examDate', 'subject', 'progress'],
      timelineStartDateProperty: 'examDate',
      timelineEndDateProperty: 'examDate',
      sortRules: [{ key: 'examDate', direction: 'asc' }],
    }),
  },
  {
    id: 'knowledge-library',
    name: 'Knowledge Library',
    description: 'Gallery view for curated knowledge with category, source, and rating cards.',
    presentation: 'gallery',
    createView: () => buildTemplateDatabaseView({
      name: 'Knowledge Library',
      query: 'tag:knowledge',
      presentation: 'gallery',
      propertyColumns: ['category', 'source', 'rating'],
      galleryCoverProperty: 'source',
      galleryCardFields: ['category', 'source', 'rating'],
      sortRules: [{ key: 'rating', direction: 'desc' }],
    }),
  },
];

export function findDatabaseTemplate(templateId: string): DatabaseTemplateDefinition | undefined {
  const trimmed = templateId.trim();
  return DATABASE_TEMPLATES.find(template => template.id === trimmed);
}

export function createDatabaseViewFromTemplate(
  views: readonly DatabaseView[],
  templateId: string,
  options: CreateDatabaseViewFromTemplateOptions = {},
): DatabaseView[] {
  const template = findDatabaseTemplate(templateId);
  if (!template) return [...views];

  const id = options.id ?? `database-${template.id}-${Date.now()}`;
  const name = options.name?.trim() || template.name;

  let view = template.createView();
  view = withPresentationDefaults({
    ...view,
    id,
    name,
  });

  if (!isValidDatabaseViewQuery(view.query)) return [...views];

  return [...views, view].sort((a, b) => a.name.localeCompare(b.name));
}

/** @internal Exposed for tests */
export { buildTemplateDatabaseView, buildTableConfig };
