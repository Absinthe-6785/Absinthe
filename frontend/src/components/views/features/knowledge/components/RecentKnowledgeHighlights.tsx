import { useMemo } from 'react';
import { useTranslation, type TranslationKey } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import { knowledgeIndexService } from '../KnowledgeIndexService';
import {
  buildRecentKnowledgeHighlights,
  type KnowledgeHighlightKind,
} from '../timeline/recentKnowledgeHighlights';

const HIGHLIGHT_KEYS: Record<KnowledgeHighlightKind, TranslationKey> = {
  'note-created': 'k70HighlightNoteCreated',
  'link-created': 'k70HighlightLinkCreated',
  'relation-resolved': 'k70HighlightRelationCreated',
  'major-change': 'k70HighlightMajorChange',
};

export interface RecentKnowledgeHighlightsProps {
  colors: NoteChromeColors;
  events: readonly KnowledgeHistoryEvent[];
  notes: readonly NoteBase[];
  onNavigateToNote?: (noteId: string) => void;
  compact?: boolean;
}

/** Compact recent knowledge changes above the activity feed. */
export function RecentKnowledgeHighlights({
  colors: c,
  events,
  notes,
  onNavigateToNote,
  compact,
}: RecentKnowledgeHighlightsProps) {
  const { t } = useTranslation();
  const highlights = useMemo(
    () => buildRecentKnowledgeHighlights(events, notes, knowledgeIndexService, 5),
    [events, notes],
  );

  if (highlights.length === 0) return null;

  return (
    <div style={{ padding: compact ? '0 6px 8px' : '0 8px 10px' }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, marginBottom: 6, letterSpacing: 0.3, textTransform: 'uppercase' }}>
        {t('k70RecentKnowledgeChanges')}
      </div>
      {highlights.map(item => (
        <button
          key={item.id}
          type="button"
          disabled={!onNavigateToNote}
          onClick={() => onNavigateToNote?.(item.noteId)}
          style={{
            width: '100%',
            marginBottom: 4,
            padding: '6px 8px',
            borderRadius: 6,
            border: `1px solid ${c.sideBdr}`,
            background: c.cardHov,
            textAlign: 'left',
            cursor: onNavigateToNote ? 'pointer' : 'default',
          }}
        >
          <div style={{ fontSize: 9, fontWeight: 700, color: c.accent, marginBottom: 2 }}>
            {t(HIGHLIGHT_KEYS[item.kind])}
          </div>
          <div style={{ fontSize: 10, color: c.text, lineHeight: 1.4 }}>{item.detail}</div>
        </button>
      ))}
    </div>
  );
}
