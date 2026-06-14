import { useMemo } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import {
  groupEventsByDate,
  presentHistoryEvent,
} from '../history/historyEventPresentation';
import { KnowledgePanelEmpty } from './KnowledgePanelSection';

const MAX_FEED_EVENTS = 120;

export interface TimelineActivityFeedProps {
  colors: NoteChromeColors;
  events: readonly KnowledgeHistoryEvent[];
  notes: readonly NoteBase[];
  onNavigateToNote?: (noteId: string) => void;
  compact?: boolean;
}

/** Chronological activity feed from recorded K-44 events. */
export function TimelineActivityFeed({
  colors: c,
  events,
  notes,
  onNavigateToNote,
  compact,
}: TimelineActivityFeedProps) {
  const { t, lang } = useTranslation();

  const groups = useMemo(() => {
    const limited = [...events]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, MAX_FEED_EVENTS);
    return groupEventsByDate(limited, lang);
  }, [events, lang]);

  if (events.length === 0) {
    return <KnowledgePanelEmpty colors={c}>{t('k45ActivityEmpty')}</KnowledgePanelEmpty>;
  }

  return (
    <div style={{ padding: compact ? '0 6px 8px' : '0 8px 8px' }}>
      {groups.map(group => (
        <section key={group.dateKey} style={{ marginBottom: 10 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: c.accent,
              margin: '4px 4px 6px',
              letterSpacing: 0.2,
            }}
          >
            {group.label}
          </div>
          {group.events.map(event => {
            const row = presentHistoryEvent(event, notes);
            const interactive = Boolean(onNavigateToNote);
            return (
              <button
                key={event.id}
                type="button"
                disabled={!interactive}
                onClick={() => onNavigateToNote?.(row.noteId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  margin: '0 0 4px',
                  padding: '7px 9px',
                  borderRadius: 7,
                  border: `1px solid ${c.sideBdr}`,
                  background: c.cardHov,
                  cursor: interactive ? 'pointer' : 'default',
                  display: 'block',
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, marginBottom: 2 }}>
                  {t(row.actionKey)}
                  {row.imported && (
                    <span style={{ marginLeft: 6, color: c.textFaint, fontWeight: 500 }}>
                      · {t('k45ImportedBadge')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: c.text, lineHeight: 1.45 }}>{row.detail}</div>
              </button>
            );
          })}
        </section>
      ))}
      {events.length > MAX_FEED_EVENTS && (
        <div style={{ fontSize: 9, color: c.textFaint, textAlign: 'center', padding: '4px 0' }}>
          {t('k45ActivityTruncated').replace('{count}', String(MAX_FEED_EVENTS))}
        </div>
      )}
    </div>
  );
}
