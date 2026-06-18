/**
 * K-99 — Empty state coverage audit.
 */
import type { TranslationKey } from '@/lib/i18n';

export const K99_EMPTY_VIEWS = [
  'notes',
  'search',
  'planner',
  'health',
  'discovery',
  'trash',
  'cosmos',
] as const;

export type K99EmptyView = (typeof K99_EMPTY_VIEWS)[number];

export interface K99EmptyStateRow {
  view: K99EmptyView;
  scenario: string;
  dataHook: string;
  titleKey: TranslationKey;
  descriptionKey?: TranslationKey;
  hasPrimaryCta: boolean;
  hasSecondaryCta: boolean;
}

export const K99_EMPTY_STATE_CATALOG: readonly K99EmptyStateRow[] = [
  {
    view: 'notes',
    scenario: 'no-notes',
    dataHook: 'notes-empty',
    titleKey: 'nvNoNotes',
    descriptionKey: 'k99EmptyNotesDesc',
    hasPrimaryCta: true,
    hasSecondaryCta: false,
  },
  {
    view: 'search',
    scenario: 'no-results',
    dataHook: 'search-empty',
    titleKey: 'nvSearchNoResults',
    descriptionKey: 'k99EmptySearchDesc',
    hasPrimaryCta: true,
    hasSecondaryCta: false,
  },
  {
    view: 'trash',
    scenario: 'empty-trash',
    dataHook: 'trash-empty',
    titleKey: 'nvTrashEmpty',
    descriptionKey: 'k99EmptyTrashDesc',
    hasPrimaryCta: false,
    hasSecondaryCta: false,
  },
  {
    view: 'planner',
    scenario: 'no-timetable',
    dataHook: 'planner-timetable-empty',
    titleKey: 'k99EmptyPlannerTitle',
    descriptionKey: 'k99EmptyPlannerDesc',
    hasPrimaryCta: true,
    hasSecondaryCta: false,
  },
  {
    view: 'health',
    scenario: 'no-blocks',
    dataHook: 'health-blocks-empty',
    titleKey: 'noBlocksEmpty',
    descriptionKey: 'k99EmptyHealthBlocksDesc',
    hasPrimaryCta: true,
    hasSecondaryCta: false,
  },
  {
    view: 'health',
    scenario: 'no-workouts',
    dataHook: 'health-workouts-empty',
    titleKey: 'noWorkoutsEmpty',
    descriptionKey: 'k99EmptyHealthWorkoutsDesc',
    hasPrimaryCta: false,
    hasSecondaryCta: false,
  },
  {
    view: 'discovery',
    scenario: 'no-suggestions',
    dataHook: 'discovery-empty',
    titleKey: 'k99EmptyDiscoveryTitle',
    descriptionKey: 'k99EmptyDiscoveryDesc',
    hasPrimaryCta: false,
    hasSecondaryCta: false,
  },
  {
    view: 'cosmos',
    scenario: 'no-universe',
    dataHook: 'cosmos-empty',
    titleKey: 'k41EmptyCosmosWelcome',
    descriptionKey: 'k41EmptyCosmosNoNotes',
    hasPrimaryCta: true,
    hasSecondaryCta: false,
  },
];

export function auditEmptyStateCatalog(): K99EmptyStateRow[] {
  return [...K99_EMPTY_STATE_CATALOG];
}

export function formatK99EmptyStateReport(rows: readonly K99EmptyStateRow[]): string {
  const lines = ['K-99 empty state audit', ''];
  for (const row of rows) {
    lines.push(
      `${row.view}/${row.scenario}: hook=data-${row.dataHook} title=${row.titleKey} `
      + `primary=${row.hasPrimaryCta} secondary=${row.hasSecondaryCta}`,
    );
  }
  return lines.join('\n');
}
