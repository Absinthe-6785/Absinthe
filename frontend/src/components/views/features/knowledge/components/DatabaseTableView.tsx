import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';
import { DATABASE_EMPTY_MESSAGE } from '../databaseViews/databasePresentationMeta';
import type { DatabaseColumn, DatabaseViewSort } from '../databaseViews/databaseViewModels';
import { DEFAULT_TABLE_COLUMNS } from '../databaseViews/databaseColumns';

export interface DatabaseTableViewProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  columns?: readonly DatabaseColumn[];
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

function sortIndicator(sort: DatabaseViewSort | undefined, columnKey: string): string {
  if (!sort || sort.key !== columnKey) return '';
  return sort.direction === 'asc' ? ' ↑' : ' ↓';
}

export function DatabaseTableView({
  colors: c,
  notes,
  columns = DEFAULT_TABLE_COLUMNS,
  sort,
  service,
  activeNoteId,
  onSelectNote,
}: DatabaseTableViewProps) {
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
          </tr>
        </thead>
        <tbody>
          {notes.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 16, textAlign: 'center', color: c.textFaint }}>
                {DATABASE_EMPTY_MESSAGE}
              </td>
            </tr>
          ) : notes.map(note => (
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
