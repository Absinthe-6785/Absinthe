import { useMemo } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { DiscoveryProgressSummary } from '../history/historyEvolutionQueries';
import { presentHistoryEvent } from '../history/historyEventPresentation';

export interface DiscoveryProgressSectionProps {
  colors: NoteChromeColors;
  progress: DiscoveryProgressSummary;
  notes: readonly NoteBase[];
  onNavigateToNote?: (noteId: string) => void;
}

/** Discovery resolution history derived from recorded events. */
export function DiscoveryProgressSection({
  colors: c,
  progress,
  notes,
  onNavigateToNote,
}: DiscoveryProgressSectionProps) {
  const { t } = useTranslation();

  const recentRows = useMemo(
    () => progress.recentResolved.map(e => presentHistoryEvent(e, notes)),
    [progress.recentResolved, notes],
  );

  if (progress.resolvedCount === 0) return null;

  return (
    <div style={{ padding: '0 8px 8px' }}>
      <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.6, marginBottom: 6 }}>
        <div>{t('k45DiscResolvedTotal').replace('{count}', String(progress.resolvedCount))}</div>
        {progress.mostImprovedArea && (
          <div>{t('k45DiscMostImproved').replace('{area}', progress.mostImprovedArea)}</div>
        )}
        {progress.momentumScore > 0 && (
          <div>{t('k45DiscMomentum').replace('{count}', String(progress.momentumScore))}</div>
        )}
      </div>
      {recentRows.map(row => (
        <button
          key={row.event.id}
          type="button"
          onClick={() => onNavigateToNote?.(row.noteId)}
          disabled={!onNavigateToNote}
          style={{
            width: '100%',
            textAlign: 'left',
            margin: '0 0 4px',
            padding: '6px 8px',
            borderRadius: 6,
            border: `1px solid ${c.sideBdr}`,
            background: c.cardHov,
            cursor: onNavigateToNote ? 'pointer' : 'default',
            fontSize: 10,
            color: c.text,
          }}
        >
          {t(row.actionKey)} — {row.detail}
        </button>
      ))}
    </div>
  );
}
