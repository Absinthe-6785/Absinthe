import type { NoteChromeColors } from '../../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../../KnowledgeIndexService';
import {
  resolveVisibleColumns,
  resolveVisibleFormulaColumns,
  resolveVisibleRollupColumns,
} from '../../databaseViews/databaseViewConfig';
import {
  getBoardConfig,
  getGalleryConfig,
  getTableConfig,
} from '../../databaseViews/databasePresentationConfig';
import type { DatabaseView } from '../../databaseViews/databaseViewModels';
import type { DatabaseViewPresentationData } from '../../databaseViews/prepareDatabaseViewPresentation';
import { resolveDatabaseViewSortRules } from '../../databaseViews/sortDatabaseViewRows';
import { withDatabaseViewDefaults } from '../../databaseViews/prepareDatabaseViewRows';
import { DatabaseBoardView } from '../DatabaseBoardView';
import { DatabaseCalendarView } from '../DatabaseCalendarView';
import { DatabaseGalleryView } from '../DatabaseGalleryView';
import { DatabaseTimelineView } from '../DatabaseTimelineView';
import { DatabaseTableView } from '../DatabaseTableView';

export interface DatabasePresentationRendererProps {
  colors: NoteChromeColors;
  view: DatabaseView;
  presentationData: DatabaseViewPresentationData;
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

export function DatabasePresentationRenderer({
  colors: c,
  view,
  presentationData,
  service,
  activeNoteId,
  onSelectNote,
}: DatabasePresentationRendererProps) {
  const configured = withDatabaseViewDefaults(view);
  const tableConfig = getTableConfig(configured);
  const boardConfig = getBoardConfig(configured);
  const galleryConfig = getGalleryConfig(configured);
  const visibleColumns = resolveVisibleColumns(tableConfig.columns);
  const visibleRollupColumns = resolveVisibleRollupColumns(tableConfig.rollupColumns);
  const visibleFormulaColumns = resolveVisibleFormulaColumns(tableConfig.formulaColumns);

  switch (presentationData.type) {
    case 'board':
      return (
        <DatabaseBoardView
          colors={c}
          lanes={presentationData.lanes}
          service={service}
          activeNoteId={activeNoteId}
          cardFields={boardConfig.cardFields}
          onSelectNote={onSelectNote}
        />
      );
    case 'calendar':
      return (
        <DatabaseCalendarView
          colors={c}
          buckets={presentationData.buckets}
          service={service}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
        />
      );
    case 'timeline':
      return (
        <DatabaseTimelineView
          colors={c}
          items={presentationData.items}
          service={service}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
        />
      );
    case 'gallery':
      return (
        <DatabaseGalleryView
          colors={c}
          items={presentationData.items}
          service={service}
          activeNoteId={activeNoteId}
          cardSize={galleryConfig.cardSize}
          showCoverPlaceholder={Boolean(galleryConfig.coverProperty)}
          onSelectNote={onSelectNote}
        />
      );
    default:
      return (
        <DatabaseTableView
          colors={c}
          notes={presentationData.notes}
          columns={visibleColumns}
          rollupColumns={visibleRollupColumns}
          formulaColumns={visibleFormulaColumns}
          sort={tableConfig.sort}
          sortRules={resolveDatabaseViewSortRules(tableConfig)}
          service={service}
          activeNoteId={activeNoteId}
          onSelectNote={onSelectNote}
        />
      );
  }
}
