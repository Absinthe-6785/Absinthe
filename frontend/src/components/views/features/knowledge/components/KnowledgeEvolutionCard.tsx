import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { EvolutionInsightsSummary } from '../history/evolutionInsightsQueries';
import { DashboardCardHeader } from './DashboardCardHeader';
import { TrendingUp } from 'lucide-react';

export interface KnowledgeEvolutionCardProps {
  colors: NoteChromeColors;
  insights: EvolutionInsightsSummary;
  compact?: boolean;
  onOpenEvolution?: () => void;
  onNavigateToNote?: (noteId: string) => void;
  onNavigateToArea?: (areaLabel: string) => void;
}

function AreaLink({
  c,
  label,
  area,
  onNavigate,
}: {
  c: NoteChromeColors;
  label: string;
  area: string;
  onNavigate?: (area: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={!onNavigate}
      onClick={() => onNavigate?.(area)}
      style={{
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: onNavigate ? 'pointer' : 'default',
        fontSize: 10,
        color: onNavigate ? c.accent : c.textMuted,
        textAlign: 'left',
        width: '100%',
      }}
    >
      {label.replace('{area}', area)}
    </button>
  );
}

/** Dashboard card — evolution insights with momentum and dormant warnings. */
export function KnowledgeEvolutionCard({
  colors: c,
  insights,
  compact,
  onOpenEvolution,
  onNavigateToNote,
  onNavigateToArea,
}: KnowledgeEvolutionCardProps) {
  const { t } = useTranslation();
  const { momentum, dormantAreas } = insights;

  const hasContent = momentum.fastestGrowingArea
    || momentum.mostActiveArea
    || insights.latestMilestoneTitleKey
    || momentum.cosmosMomentumScore > 0
    || dormantAreas.length > 0;

  if (!hasContent) return null;

  const topDormant = dormantAreas[0];

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
      <DashboardCardHeader colors={c} icon={TrendingUp} title={t('k46EvolutionCardTitle')} compact={compact} />
      <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
        {momentum.periodNotesAdded > 0 && (
          <div>{t('k47PeriodNotes').replace('{count}', String(momentum.periodNotesAdded))}</div>
        )}
        {momentum.periodLinksAdded > 0 && (
          <div>{t('k47PeriodLinks').replace('{count}', String(momentum.periodLinksAdded))}</div>
        )}
        {momentum.fastestGrowingArea && (
          <AreaLink
            c={c}
            label={t('k46FastestGrowing')}
            area={momentum.fastestGrowingArea}
            onNavigate={onNavigateToArea}
          />
        )}
        {momentum.mostActiveArea && momentum.mostActiveArea !== momentum.fastestGrowingArea && (
          <AreaLink
            c={c}
            label={t('k46MostActive')}
            area={momentum.mostActiveArea}
            onNavigate={onNavigateToArea}
          />
        )}
        {insights.latestMilestoneTitleKey && (
          <button
            type="button"
            disabled={!insights.latestMilestoneNoteId || !onNavigateToNote}
            onClick={() => insights.latestMilestoneNoteId && onNavigateToNote?.(insights.latestMilestoneNoteId)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: insights.latestMilestoneNoteId && onNavigateToNote ? 'pointer' : 'default',
              fontSize: 10,
              color: insights.latestMilestoneNoteId && onNavigateToNote ? c.accent : c.textMuted,
              textAlign: 'left',
            }}
          >
            {t('k46LatestMilestone')}: {t(insights.latestMilestoneTitleKey)}
          </button>
        )}
        {momentum.cosmosMomentumScore > 0 && (
          <div>{t('k47CosmosMomentum').replace('{count}', String(momentum.cosmosMomentumScore))}</div>
        )}
        {topDormant && (
          <button
            type="button"
            disabled={!onNavigateToArea}
            onClick={() => onNavigateToArea?.(topDormant.areaLabel)}
            style={{
              border: 'none',
              background: 'transparent',
              padding: 0,
              marginTop: 4,
              cursor: onNavigateToArea ? 'pointer' : 'default',
              fontSize: 10,
              color: onNavigateToArea ? '#9CA3AF' : c.textMuted,
              textAlign: 'left',
            }}
          >
            {t('k47DormantWarning').replace('{area}', topDormant.areaLabel).replace('{days}', String(topDormant.daysSinceActivity))}
          </button>
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
