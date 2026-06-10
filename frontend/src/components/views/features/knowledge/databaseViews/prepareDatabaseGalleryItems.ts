import type { NoteBase } from '../../../noteUtils';
import {
  getDatabaseFormulaCellValue,
  getDatabaseRollupCellValue,
} from '../components/DatabaseTableView';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { columnLabelForKey } from './databaseViewConfig';
import { getDatabaseFieldValue } from './databaseFieldValues';
import { getGalleryConfig, getTableConfig, withPresentationDefaults } from './databasePresentationConfig';
import { filterByDatabaseView } from './filterByDatabaseView';
import type { DatabaseViewFilterOptions } from './resolveDatabaseViewQuery';
import { isValidCoverImageUrl, type GalleryField, type GalleryItem } from './galleryModels';
import type { DatabaseView } from './databaseViewModels';

function resolveGalleryFieldValue(
  note: NoteBase,
  key: string,
  service: KnowledgeIndexService,
  view: DatabaseView,
  notesById: ReadonlyMap<string, NoteBase>,
): string {
  const propertyValue = getDatabaseFieldValue(note, key, service);
  if (propertyValue) return propertyValue;

  const table = getTableConfig(view);
  const rollup = table.rollupColumns?.find(
    column => column.key.toLowerCase() === key.toLowerCase(),
  );
  if (rollup) {
    return getDatabaseRollupCellValue(note, rollup, service, notesById);
  }

  const formula = table.formulaColumns?.find(
    column => column.key.toLowerCase() === key.toLowerCase(),
  );
  if (formula && table.formulaColumns) {
    return getDatabaseFormulaCellValue(
      note,
      formula,
      service,
      notesById,
      table.formulaColumns,
    );
  }

  return '';
}

function resolveCoverImage(
  note: NoteBase,
  coverProperty: string | undefined,
  service: KnowledgeIndexService,
): string | undefined {
  if (!coverProperty?.trim()) return undefined;
  const raw = getDatabaseFieldValue(note, coverProperty.trim(), service);
  if (!raw || !isValidCoverImageUrl(raw)) return undefined;
  return raw.trim();
}

function resolveGalleryItem(
  note: NoteBase,
  view: DatabaseView,
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase>,
  coverProperty: string | undefined,
  cardFields: readonly string[] | undefined,
): GalleryItem {
  const fields: GalleryField[] = [];
  for (const key of cardFields ?? []) {
    const value = resolveGalleryFieldValue(note, key, service, view, notesById);
    if (!value) continue;
    fields.push({
      key,
      label: columnLabelForKey(key),
      value,
    });
  }

  const tags = getDatabaseFieldValue(note, 'tags', service);

  return {
    noteId: note.id,
    note,
    title: getDatabaseFieldValue(note, 'title', service),
    coverImage: resolveCoverImage(note, coverProperty, service),
    ...(tags ? { tags } : {}),
    fields,
  };
}

/**
 * Full database view gallery pipeline: filter via query engine, then resolve card items.
 * Query semantics are unchanged — gallery shaping is post-filter only.
 */
export function prepareDatabaseGalleryItems(
  view: DatabaseView,
  notes: readonly NoteBase[],
  service: KnowledgeIndexService,
  filterOptions: DatabaseViewFilterOptions = {},
): GalleryItem[] {
  const configured = withPresentationDefaults(view);
  const galleryConfig = getGalleryConfig(configured);
  const filtered = filterByDatabaseView(
    notes.filter(note => !note.deletedAt),
    service,
    configured,
    filterOptions,
  ).notes;
  const notesById = new Map(filtered.map(note => [note.id, note]));

  return filtered.map(note => resolveGalleryItem(
    note,
    configured,
    service,
    notesById,
    galleryConfig.coverProperty,
    galleryConfig.cardFields,
  ));
}

export type { GalleryField, GalleryItem };
