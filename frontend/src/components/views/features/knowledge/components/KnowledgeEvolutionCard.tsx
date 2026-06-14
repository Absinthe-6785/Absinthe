import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { EvolutionDashboardSummary } from '../history/historyAreaEvolutionQueries';

export interface KnowledgeEvolutionCardProps {
  colors: NoteChromeColors;
  summary: EvolutionDashboardSummary;
  compact?: boolean;
  onOpenEvolution?: () => void;
  onNavigateToNote?: (noteId: string) => void;
}

/** Dashboard card — evolution highlights with Open Evolution action. */
export function KnowledgeEvolutionCard({
  colors: c,
  summary,
  compact,
  onOpenEvolution,
  onNavigateToNote,
}: KnowledgeEvolutionCardProps) {
  const { t } = useTranslation();

  const hasContent = summary.fastestGrowingArea
    || summary.mostActiveArea
    || summary.latestMilestoneTitleKey
    || summary.momentumScore > 0;

  if (!hasContent) return null;

  return (
    <div
      style={{
        marginBottom: compact ? 10 : 12,
        padding: compact ? '10px 12px' : '12px 14px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: c.text, marginBottom: 6 }}>
        {t('k46EvolutionCardTitle')}
      </div>
      <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
        {summary.fastestGrowingArea && (
          <div>{t('k46FastestGrowing').replace('{area}', summary.fastestGrowingArea)}</div>
        )}
        {summary.mostActiveArea && (
          <div>{t('k46MostActive').replace('{area}', summary.mostActiveArea)}</div>
        )}
        {summary.latestMilestoneTitleKey && (
          <button
            type="button"
            disabled={!summary.latestMilestoneNoteId || !onNavigateToNote}
            onClick={() => summary.latestMilestoneNoteId && onNavigateToNote?.(summary.latestMilestoneNoteId)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: summary.latestMilestoneNoteId && onNavigateToNote ? 'pointer' : 'default',
              fontSize: 10,
              color: summary.latestMilestoneNoteId && onNavigateToNote ? c.accent : c.textMuted,
              textAlign: 'left',
            }}
          >
            {t('k46LatestMilestone')}: {t(summary.latestMilestoneTitleKey)}
          </button>
        )}
        {summary.momentumScore > 0 && (
          <div>{t('k46RecentMomentum').replace('{count}', String(summary.momentumScore))}</div>
        )}
      </div>
      {onOpenEvolution && (
        <button
          type="button"
          onClick={onOpenEvolution}
          style={{
            marginTop: 8,
            width: '100%',
            padding: '6px 10px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 6,
            border: `1px solid ${c.accent}`,
            background: c.accentBg,
            color: c.accent,
            cursor: 'pointer',
          }}
        >
          {t('k46OpenEvolution')}
        </button>
      )}
    </div>
  );
}
