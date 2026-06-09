import type { NoteBase } from '../../../noteUtils';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import { columnLabelForKey } from '../databaseViews/databaseViewConfig';
import { getDatabaseFieldValue } from '../databaseViews/databaseFieldValues';

export type DatabaseNoteCardSize = 'compact' | 'default';

export interface DatabaseNoteCardProps {
  note: NoteBase;
  colors: NoteChromeColors;
  service: KnowledgeIndexService;
  isActive: boolean;
  onSelect: () => void;
  size?: DatabaseNoteCardSize;
  extraFields?: readonly string[];
}

export function DatabaseNoteCard({
  note,
  colors: c,
  service,
  isActive,
  onSelect,
  size = 'default',
  extraFields,
}: DatabaseNoteCardProps) {
  const title = getDatabaseFieldValue(note, 'title', service);
  const tags = getDatabaseFieldValue(note, 'tags', service);
  const compact = size === 'compact';

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
        borderRadius: compact ? 4 : 6,
        padding: compact ? '3px 4px' : '6px 8px',
        marginBottom: compact ? 3 : 6,
        cursor: 'pointer',
        color: c.text,
      }}
    >
      <div style={{
        fontSize: compact ? 9 : 11,
        fontWeight: 600,
        marginBottom: tags || extraFields?.length ? (compact ? 1 : 2) : 0,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {title}
      </div>
      {tags && (
        <div style={{
          fontSize: compact ? 8 : 9,
          color: c.textMuted,
          marginBottom: extraFields?.length ? (compact ? 2 : 4) : 0,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {tags}
        </div>
      )}
      {extraFields?.map(field => {
        const value = getDatabaseFieldValue(note, field, service);
        if (!value) return null;
        return (
          <div key={field} style={{ fontSize: compact ? 8 : 9, color: c.textMuted }}>
            {columnLabelForKey(field)}: {value}
          </div>
        );
      })}
    </button>
  );
}
