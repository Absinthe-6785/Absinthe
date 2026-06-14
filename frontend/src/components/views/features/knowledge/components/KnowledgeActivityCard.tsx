import { useTranslation, type TranslationKey } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeActivitySummary } from '../history';
import type { RecentEvolutionSummary } from '../timeline';

export interface KnowledgeActivityCardProps {
  colors: NoteChromeColors;
  summary: KnowledgeActivitySummary;
  compact?: boolean;
  recentActivity?: { actionKey: TranslationKey; detail: string; noteId: string } | null;
  latestMilestone?: { titleKey: TranslationKey; noteId: string | null } | null;
  growthTrend?: RecentEvolutionSummary | null;
  onNavigateToNote?: (noteId: string) => void;
}

/** Dashboard card — recent activity, milestones, and growth trend. */
export function KnowledgeActivityCard({
  colors: c,
  summary,
  compact,
  recentActivity,
  latestMilestone,
  growthTrend,
  onNavigateToNote,
}: KnowledgeActivityCardProps) {
  const { t } = useTranslation();
  const hasActivity =
    summary.notesCreated > 0
    || summary.linksCreated > 0
    || summary.hubsCreated > 0
    || summary.discoveriesResolved > 0
    || recentActivity
    || latestMilestone
    || (growthTrend && (growthTrend.notesAdded > 0 || growthTrend.linksAdded > 0));

  if (!hasActivity) return null;

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
        {t('k44ActivityTitle')}
      </div>

      {recentActivity && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: c.textFaint, marginBottom: 2 }}>
            {t('k45RecentActivity')}
          </div>
          <button
            type="button"
            disabled={!onNavigateToNote}
            onClick={() => onNavigateToNote?.(recentActivity.noteId)}
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: onNavigateToNote ? 'pointer' : 'default',
              fontSize: 10,
              color: onNavigateToNote ? c.accent : c.textMuted,
              lineHeight: 1.45,
            }}
          >
            {t(recentActivity.actionKey)} — {recentActivity.detail}
          </button>
        </div>
      )}

      {latestMilestone && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: c.textFaint, marginBottom: 2 }}>
            {t('k45LatestMilestone')}
          </div>
          <button
            type="button"
            disabled={!latestMilestone.noteId || !onNavigateToNote}
            onClick={() => latestMilestone.noteId && onNavigateToNote?.(latestMilestone.noteId)}
            style={{
              width: '100%',
              textAlign: 'left',
              border: 'none',
              background: 'transparent',
              padding: 0,
              cursor: latestMilestone.noteId && onNavigateToNote ? 'pointer' : 'default',
              fontSize: 10,
              color: latestMilestone.noteId && onNavigateToNote ? c.accent : c.textMuted,
            }}
          >
            {t(latestMilestone.titleKey)}
          </button>
        </div>
      )}

      {growthTrend && (growthTrend.notesAdded > 0 || growthTrend.linksAdded > 0) && (
        <div style={{ marginBottom: 6 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: c.textFaint, marginBottom: 2 }}>
            {t('k45GrowthTrend')}
          </div>
          <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
            {growthTrend.notesAdded > 0 && (
              <div>{t('k44ActivityNotes').replace('{count}', String(growthTrend.notesAdded))}</div>
            )}
            {growthTrend.linksAdded > 0 && (
              <div>{t('k44ActivityLinks').replace('{count}', String(growthTrend.linksAdded))}</div>
            )}
            {growthTrend.fastestGrowingArea && (
              <div>{t('k45FastestArea').replace('{area}', growthTrend.fastestGrowingArea)}</div>
            )}
          </div>
        </div>
      )}

      {hasActivity && (
        <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55, marginTop: 4 }}>
          <div style={{ fontSize: 9, fontWeight: 600, color: c.textFaint, marginBottom: 2 }}>
            {t('k44ActivityPeriod').replace('{days}', String(summary.periodDays))}
          </div>
          {summary.notesCreated > 0 && (
            <div>{t('k44ActivityNotes').replace('{count}', String(summary.notesCreated))}</div>
          )}
          {summary.linksCreated > 0 && (
            <div>{t('k44ActivityLinks').replace('{count}', String(summary.linksCreated))}</div>
          )}
          {summary.hubsCreated > 0 && (
            <div>{t('k44ActivityHubs').replace('{count}', String(summary.hubsCreated))}</div>
          )}
          {summary.discoveriesResolved > 0 && (
            <div>{t('k44ActivityDiscoveries').replace('{count}', String(summary.discoveriesResolved))}</div>
          )}
        </div>
      )}
    </div>
  );
}
