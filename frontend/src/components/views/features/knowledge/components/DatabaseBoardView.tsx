import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { columnLabelForKey } from '../databaseViews/databaseViewConfig';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';
import type { BoardLane } from '../databaseViews/groupNotesByProperty';

export interface DatabaseBoardViewProps {
  colors: NoteChromeColors;
  lanes: readonly BoardLane[];
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  cardFields?: readonly string[];
  onSelectNote: (noteId: string) => void;
}

function BoardCard({
  note,
  colors: c,
  service,
  cardFields,
  isActive,
  onSelect,
}: {
  note: NoteBase;
  colors: NoteChromeColors;
  service: KnowledgeIndexService;
  cardFields?: readonly string[];
  isActive: boolean;
  onSelect: () => void;
}) {
  const title = getDatabaseFieldValue(note, 'title', service);
  const tags = getDatabaseFieldValue(note, 'tags', service);

  return (
    <button
      type="button"
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        background: isActive ? `${c.accent}15` : c.card,
        border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
        borderRadius: 6,
        padding: '6px 8px',
        marginBottom: 6,
        cursor: 'pointer',
        color: c.text,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 600, marginBottom: 2 }}>{title}</div>
      {tags && (
        <div style={{ fontSize: 9, color: c.textMuted, marginBottom: cardFields?.length ? 4 : 0 }}>
          {tags}
        </div>
      )}
      {cardFields?.map(field => {
        const value = getDatabaseFieldValue(note, field, service);
        if (!value) return null;
        return (
          <div key={field} style={{ fontSize: 9, color: c.textMuted }}>
            {columnLabelForKey(field)}: {value}
          </div>
        );
      })}
    </button>
  );
}

export function DatabaseBoardView({
  colors: c,
  lanes,
  service,
  activeNoteId,
  cardFields,
  onSelectNote,
}: DatabaseBoardViewProps) {
  const hasNotes = lanes.some(lane => lane.notes.length > 0);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.notelist, padding: 8 }}>
      {!hasNotes && lanes.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: c.textFaint, fontSize: 12 }}>
          No matching notes
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', minHeight: '100%' }}>
          {lanes.map(lane => (
            <div
              key={lane.key}
              style={{
                flex: '0 0 180px',
                minWidth: 160,
                background: c.toolbar,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 8,
                padding: 8,
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 8,
                fontSize: 10,
                fontWeight: 700,
                color: c.textMuted,
              }}>
                <span>{lane.label}</span>
                <span style={{ fontSize: 9 }}>{lane.notes.length}</span>
              </div>
              {lane.notes.length === 0 ? (
                <div style={{ fontSize: 9, color: c.textFaint, fontStyle: 'italic' }}>
                  Empty
                </div>
              ) : lane.notes.map(note => (
                <BoardCard
                  key={note.id}
                  note={note}
                  colors={c}
                  service={service}
                  cardFields={cardFields}
                  isActive={note.id === activeNoteId}
                  onSelect={() => onSelectNote(note.id)}
                />
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
