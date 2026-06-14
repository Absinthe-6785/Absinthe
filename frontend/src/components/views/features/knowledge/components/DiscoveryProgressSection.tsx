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

function trendSymbol(trend: DiscoveryProgressSummary['resolvedTrend']): string {
  if (trend === 'up') return '↑';
  if (trend === 'down') return '↓';
  if (trend === 'stable') return '→';
  return '○';
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

      <div
        style={{
          marginBottom: 8,
          padding: '7px 9px',
          borderRadius: 7,
          border: `1px solid ${c.sideBdr}`,
          background: c.cardHov,
        }}
      >
        <div style={{ fontSize: 9, fontWeight: 700, color: c.textFaint, marginBottom: 4 }}>
          {t('k46DiscLastPeriod').replace('{days}', String(progress.periodDays))}
        </div>
        <div style={{ fontSize: 10, color: c.text, lineHeight: 1.55 }}>
          <div>
            {t('k46DiscRecentResolved').replace('{count}', String(progress.recentResolvedCount))}
            {' '}
            <span style={{ color: progress.resolvedTrend === 'up' ? '#10B981' : c.textMuted }}>
              {trendSymbol(progress.resolvedTrend)}
            </span>
          </div>
          {progress.recentConnectCount > 0 && (
            <div>{t('k46DiscConnectionsAdded').replace('{count}', String(progress.recentConnectCount))}</div>
          )}
          {progress.recentHubCount > 0 && (
            <div>{t('k46DiscHubsCreated').replace('{count}', String(progress.recentHubCount))}</div>
          )}
          {progress.recentAreaCount > 0 && (
            <div>{t('k46DiscAreasImproved').replace('{count}', String(progress.recentAreaCount))}</div>
          )}
        </div>
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
