import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useTranslation, type Language } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import {
  groupEventsByDate,
  presentHistoryEvent,
} from '../history/historyEventPresentation';
import { KnowledgePanelEmpty } from './KnowledgePanelSection';

const ROW_HEIGHT_DATE = 28;
const ROW_HEIGHT_EVENT = 52;

type FeedRow =
  | { type: 'date'; key: string; label: string }
  | { type: 'event'; key: string; event: KnowledgeHistoryEvent };

export interface TimelineActivityFeedProps {
  colors: NoteChromeColors;
  events: readonly KnowledgeHistoryEvent[];
  notes: readonly NoteBase[];
  onNavigateToNote?: (noteId: string) => void;
  compact?: boolean;
}

function buildFeedRows(
  events: readonly KnowledgeHistoryEvent[],
  lang: Language,
): FeedRow[] {
  const sorted = [...events].sort((a, b) => b.timestamp - a.timestamp);
  const groups = groupEventsByDate(sorted, lang);
  const rows: FeedRow[] = [];
  for (const group of groups) {
    rows.push({ type: 'date', key: `d-${group.dateKey}`, label: group.label });
    for (const event of group.events) {
      rows.push({ type: 'event', key: event.id, event });
    }
  }
  return rows;
}

/** Virtualized chronological activity feed from recorded K-44 events. */
export function TimelineActivityFeed({
  colors: c,
  events,
  notes,
  onNavigateToNote,
  compact,
}: TimelineActivityFeedProps) {
  const { t, lang } = useTranslation();
  const parentRef = useRef<HTMLDivElement>(null);

  const rows = useMemo(() => buildFeedRows(events, lang), [events, lang]);

  const useInnerScroll = compact;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: index => (rows[index]?.type === 'date' ? ROW_HEIGHT_DATE : ROW_HEIGHT_EVENT),
    overscan: 12,
    enabled: useInnerScroll && rows.length > 30,
  });

  if (events.length === 0) {
    return <KnowledgePanelEmpty colors={c}>{t('k45ActivityEmpty')}</KnowledgePanelEmpty>;
  }

  if (!useInnerScroll) {
    return (
      <div style={{ padding: compact ? '0 6px 8px' : '0 8px 8px' }}>
        {rows.map(row => {
          if (row.type === 'date') {
            return (
              <div key={row.key} style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, padding: '8px 4px 4px' }}>
                {row.label}
              </div>
            );
          }
          const presented = presentHistoryEvent(row.event, notes);
          const interactive = Boolean(onNavigateToNote);
          return (
            <button
              key={row.key}
              type="button"
              disabled={!interactive}
              onClick={() => onNavigateToNote?.(presented.noteId)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                margin: '0 0 4px',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${c.sideBdr}`,
                background: c.cardHov,
                cursor: interactive ? 'pointer' : 'default',
              }}
            >
              <div style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, marginBottom: 2 }}>
                {t(presented.actionKey)}
              </div>
              <div style={{ fontSize: 10, color: c.text }}>{presented.detail}</div>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      ref={parentRef}
      style={{
        padding: compact ? '0 6px 8px' : '0 8px 8px',
        maxHeight: compact ? 320 : undefined,
        overflowY: 'auto',
        overscrollBehavior: 'contain',
      }}
    >
      <div style={{ height: virtualizer.getTotalSize(), position: 'relative', width: '100%' }}>
        {virtualizer.getVirtualItems().map(vRow => {
          const row = rows[vRow.index];
          if (!row) return null;

          if (row.type === 'date') {
            return (
              <div
                key={row.key}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: vRow.size,
                  transform: `translateY(${vRow.start}px)`,
                  fontSize: 10,
                  fontWeight: 700,
                  color: c.accent,
                  padding: '4px 4px 2px',
                  letterSpacing: 0.2,
                }}
              >
                {row.label}
              </div>
            );
          }

          const presented = presentHistoryEvent(row.event, notes);
          const interactive = Boolean(onNavigateToNote);

          return (
            <div
              key={row.key}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${vRow.start}px)`,
                paddingBottom: 4,
              }}
            >
              <button
                type="button"
                disabled={!interactive}
                onClick={() => onNavigateToNote?.(presented.noteId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 9px',
                  borderRadius: 7,
                  border: `1px solid ${c.sideBdr}`,
                  background: c.cardHov,
                  cursor: interactive ? 'pointer' : 'default',
                  display: 'block',
                }}
              >
                <div style={{ fontSize: 9, fontWeight: 600, color: c.textMuted, marginBottom: 2 }}>
                  {t(presented.actionKey)}
                  {presented.imported && (
                    <span style={{ marginLeft: 6, color: c.textFaint, fontWeight: 500 }}>
                      · {t('k45ImportedBadge')}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 10, color: c.text, lineHeight: 1.45 }}>{presented.detail}</div>
              </button>
            </div>
          );
        })}
      </div>
      <div style={{ fontSize: 9, color: c.textFaint, textAlign: 'center', padding: '6px 0 2px' }}>
        {t('k46ActivityTotal').replace('{count}', String(events.length))}
      </div>
    </div>
  );
}
