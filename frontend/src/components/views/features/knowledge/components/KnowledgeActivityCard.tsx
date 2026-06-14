import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeActivitySummary } from '../history';

export interface KnowledgeActivityCardProps {
  colors: NoteChromeColors;
  summary: KnowledgeActivitySummary;
  compact?: boolean;
}

/** Dashboard card — last 30 days of recorded knowledge activity. */
export function KnowledgeActivityCard({
  colors: c,
  summary,
  compact,
}: KnowledgeActivityCardProps) {
  const { t } = useTranslation();
  const hasActivity =
    summary.notesCreated > 0
    || summary.linksCreated > 0
    || summary.hubsCreated > 0
    || summary.discoveriesResolved > 0;

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
      <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
        {t('k44ActivityPeriod').replace('{days}', String(summary.periodDays))}
      </div>
      {summary.notesCreated > 0 && (
        <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
          {t('k44ActivityNotes').replace('{count}', String(summary.notesCreated))}
        </div>
      )}
      {summary.linksCreated > 0 && (
        <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
          {t('k44ActivityLinks').replace('{count}', String(summary.linksCreated))}
        </div>
      )}
      {summary.hubsCreated > 0 && (
        <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
          {t('k44ActivityHubs').replace('{count}', String(summary.hubsCreated))}
        </div>
      )}
      {summary.discoveriesResolved > 0 && (
        <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
          {t('k44ActivityDiscoveries').replace('{count}', String(summary.discoveriesResolved))}
        </div>
      )}
    </div>
  );
}
