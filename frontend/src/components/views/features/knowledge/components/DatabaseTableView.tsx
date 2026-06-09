import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { listTags } from '../tags/noteTags';
import type { DatabaseColumn } from '../databaseViews/databaseViewModels';
import { DEFAULT_TABLE_COLUMNS } from '../databaseViews/databaseColumns';

export interface DatabaseTableViewProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  columns?: readonly DatabaseColumn[];
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  onSelectNote: (noteId: string) => void;
}

function formatUpdatedAt(timestamp: number): string {
  if (!timestamp) return '—';
  return new Date(timestamp).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getCellValue(
  note: NoteBase,
  column: DatabaseColumn,
  service: KnowledgeIndexService,
): string {
  switch (column.key) {
    case 'title':
      return note.title || 'Untitled';
    case 'updatedAt':
      return formatUpdatedAt(note.updatedAt);
    case 'tags':
      return listTags(note).join(', ') || '—';
    default: {
      const props = service.getProperties(note.id);
      const match = Object.entries(props).find(
        ([key]) => key.toLowerCase() === column.key.toLowerCase(),
      );
      return match?.[1]?.trim() || '—';
    }
  }
}

export function DatabaseTableView({
  colors: c,
  notes,
  columns = DEFAULT_TABLE_COLUMNS,
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
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {notes.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={{ padding: 16, textAlign: 'center', color: c.textFaint }}>
                No matching notes
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
                  {getCellValue(note, column, service)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
