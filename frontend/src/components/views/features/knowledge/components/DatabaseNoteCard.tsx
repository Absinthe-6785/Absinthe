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
  coverImageUrl?: string;
  showCoverPlaceholder?: boolean;
}

export function DatabaseNoteCard({
  note,
  colors: c,
  service,
  isActive,
  onSelect,
  size = 'default',
  extraFields,
  coverImageUrl,
  showCoverPlaceholder = false,
}: DatabaseNoteCardProps) {
  const title = getDatabaseFieldValue(note, 'title', service);
  const tags = getDatabaseFieldValue(note, 'tags', service);
  const compact = size === 'compact';
  const hasCover = Boolean(coverImageUrl) || showCoverPlaceholder;

  const cardBody = (
    <>
      {hasCover && (
        coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt=""
            style={{
              display: 'block',
              width: '100%',
              height: compact ? 72 : 96,
              objectFit: 'cover',
              borderRadius: compact ? '4px 4px 0 0' : '6px 6px 0 0',
              marginBottom: compact ? 4 : 6,
            }}
          />
        ) : (
          <div style={{
            width: '100%',
            height: compact ? 72 : 96,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: c.toolbar,
            color: c.textFaint,
            fontSize: compact ? 8 : 9,
            borderRadius: compact ? '4px 4px 0 0' : '6px 6px 0 0',
            marginBottom: compact ? 4 : 6,
            borderBottom: `1px solid ${c.sideBdr}`,
          }}>
            No cover
          </div>
        )
      )}
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
    </>
  );

  const cardStyle = {
    display: 'block' as const,
    width: '100%',
    textAlign: 'left' as const,
    background: isActive ? `${c.accent}15` : c.card,
    border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
    borderRadius: compact ? 4 : 6,
    padding: hasCover ? (compact ? '0 0 4px' : '0 0 6px') : (compact ? '3px 4px' : '6px 8px'),
    marginBottom: compact ? 3 : 6,
    cursor: 'pointer' as const,
    color: c.text,
    overflow: 'hidden' as const,
  };

  if (hasCover) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onSelect}
        onKeyDown={event => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelect();
          }
        }}
        style={cardStyle}
      >
        {cardBody}
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      style={cardStyle}
    >
      {cardBody}
    </button>
  );
}
