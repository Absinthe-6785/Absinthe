import { useTranslation } from '../../../../../lib/i18n';
import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { getDatabaseEmptyMessage } from '../databaseViews/databasePresentationMeta';
import type { BoardLane } from '../databaseViews/groupNotesByProperty';
import { DatabaseNoteCard } from './DatabaseNoteCard';

export interface DatabaseBoardViewProps {
  colors: NoteChromeColors;
  lanes: readonly BoardLane[];
  service: KnowledgeIndexService;
  activeNoteId: string | null;
  cardFields?: readonly string[];
  onSelectNote: (noteId: string) => void;
}

export function DatabaseBoardView({
  colors: c,
  lanes,
  service,
  activeNoteId,
  cardFields,
  onSelectNote,
}: DatabaseBoardViewProps) {
  const { lang } = useTranslation();
  const emptyMessage = getDatabaseEmptyMessage(lang);
  const hasNotes = lanes.some(lane => lane.notes.length > 0);

  return (
    <div style={{ flex: 1, overflow: 'auto', background: c.notelist, padding: 8 }}>
      {!hasNotes && lanes.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: c.textFaint, fontSize: 12 }}>
          {emptyMessage}
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
                <DatabaseNoteCard
                  key={note.id}
                  note={note}
                  colors={c}
                  service={service}
                  extraFields={cardFields}
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
