import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';
import { DATABASE_EMPTY_MESSAGE } from '../databaseViews/databasePresentationMeta';
import type { DatabaseColumn, DatabaseViewSort } from '../databaseViews/databaseViewModels';
import { DEFAULT_TABLE_COLUMNS } from '../databaseViews/databaseColumns';
import {
  computeFormulasForNote,
  createFormulaComputeMemo,
  getFormulaColumnValue,
  type FormulaComputeMemo,
} from '../formulas/computeFormulas';
import { formulaColumnLabel, type FormulaColumnDefinition } from '../formulas/formulaModels';
import { computeRollup } from '../rollups/computeRollup';
import { rollupColumnLabel, type RollupColumnDefinition } from '../rollups/rollupModels';

export interface DatabaseTableViewProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  columns?: readonly DatabaseColumn[];
  rollupColumns?: readonly RollupColumnDefinition[];
  formulaColumns?: readonly FormulaColumnDefinition[];
  sort?: DatabaseViewSort;
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

export function getDatabaseCellValue(
  note: NoteBase,
  column: DatabaseColumn,
  service: KnowledgeIndexService,
): string {
  const value = getDatabaseFieldValue(note, column.key, service);
  if (value) return value;
  return column.key === 'title' ? 'Untitled' : '—';
}

export function getDatabaseRollupCellValue(
  note: NoteBase,
  column: RollupColumnDefinition,
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase>,
): string {
  return computeRollup(note, column.rollup, service, notesById).display;
}

export function getDatabaseFormulaCellValue(
  note: NoteBase,
  column: FormulaColumnDefinition,
  service: KnowledgeIndexService,
  notesById: ReadonlyMap<string, NoteBase>,
  formulaColumns: readonly FormulaColumnDefinition[],
  memo?: FormulaComputeMemo,
  precomputed?: ReadonlyMap<string, import('../formulas/formulaModels').FormulaValue>,
): string {
  const values = precomputed ?? computeFormulasForNote(
    note,
    formulaColumns,
    service,
    notesById,
    memo,
  );
  return getFormulaColumnValue(column.key, values).display;
}

function sortIndicator(sort: DatabaseViewSort | undefined, columnKey: string): string {
  if (!sort || sort.key !== columnKey) return '';
  return sort.direction === 'asc' ? ' ↑' : ' ↓';
}

export function DatabaseTableView({
  colors: c,
  notes,
  columns = DEFAULT_TABLE_COLUMNS,
  rollupColumns = [],
  formulaColumns = [],
  sort,
  service,
  activeNoteId,
  onSelectNote,
}: DatabaseTableViewProps) {
  const notesById = new Map(notes.map(note => [note.id, note]));
  const formulaMemo = createFormulaComputeMemo();
  const totalColumns = columns.length + rollupColumns.length + formulaColumns.length;

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.notelist }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${c.sideBdr}`, background: c.toolbar }}>
            {columns.map(column => (
              <th
                key={column.id}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  color: c.textMuted,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {column.label}{sortIndicator(sort, column.key)}
              </th>
            ))}
            {rollupColumns.map(column => (
              <th
                key={`rollup-${column.key}`}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  color: c.accent,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                }}
              >
                {rollupColumnLabel(column)}
              </th>
            ))}
            {formulaColumns.map(column => (
              <th
                key={`formula-${column.key}`}
                style={{
                  textAlign: 'left',
                  padding: '6px 8px',
                  color: c.accent,
                  fontWeight: 700,
                  whiteSpace: 'nowrap',
                  fontStyle: 'italic',
                }}
              >
                {formulaColumnLabel(column)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {notes.length === 0 ? (
            <tr>
              <td colSpan={totalColumns} style={{ padding: 16, textAlign: 'center', color: c.textFaint }}>
                {DATABASE_EMPTY_MESSAGE}
              </td>
            </tr>
          ) : notes.map(note => {
            const rowFormulaValues = formulaColumns.length > 0
              ? computeFormulasForNote(note, formulaColumns, service, notesById, formulaMemo)
              : undefined;

            return (
              <tr
                key={note.id}
                onClick={() => onSelectNote(note.id)}
                style={{
                  borderBottom: `1px solid ${c.sideBdr}`,
                  cursor: 'pointer',
                  background: note.id === activeNoteId ? `${c.accent}15` : 'transparent',
                }}
              >
                {columns.map(column => (
                  <td
                    key={column.id}
                    style={{
                      padding: '6px 8px',
                      color: note.id === activeNoteId ? c.accent : c.text,
                      maxWidth: column.key === 'title' ? 240 : 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getDatabaseCellValue(note, column, service)}
                  </td>
                ))}
                {rollupColumns.map(column => (
                  <td
                    key={`rollup-${column.key}-${note.id}`}
                    style={{
                      padding: '6px 8px',
                      color: note.id === activeNoteId ? c.accent : c.textMuted,
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getDatabaseRollupCellValue(note, column, service, notesById)}
                  </td>
                ))}
                {formulaColumns.map(column => (
                  <td
                    key={`formula-${column.key}-${note.id}`}
                    style={{
                      padding: '6px 8px',
                      color: note.id === activeNoteId ? c.accent : c.textMuted,
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {getDatabaseFormulaCellValue(
                      note,
                      column,
                      service,
                      notesById,
                      formulaColumns,
                      formulaMemo,
                      rowFormulaValues,
                    )}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
