import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeTimeline } from '../timeline';
import { DashboardCardHeader } from './DashboardCardHeader';
import { History } from 'lucide-react';

export interface TimelineDashboardCardProps {
  colors: NoteChromeColors;
  timeline: KnowledgeTimeline;
  onOpenTimeline: () => void;
  compact?: boolean;
}

/** Dashboard widget — recent knowledge growth with link to Timeline panel. */
export function TimelineDashboardCard({
  colors: c,
  timeline,
  onOpenTimeline,
  compact,
}: TimelineDashboardCardProps) {
  const { t } = useTranslation();
  const { growth, recentEvolution } = timeline;

  if (timeline.snapshots.length === 0) return null;

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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <DashboardCardHeader colors={c} icon={History} title={t('k42DashboardTitle')} compact={compact} />
          <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.5 }}>
            {t('k42DashboardPeriod').replace('{period}', growth.periodLabel || t('k42ViewMonth'))}
          </div>
          <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.5 }}>
            {t('k42DashboardNotes').replace('{count}', String(growth.vault.notesCreated))}
          </div>
          <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.5 }}>
            {t('k42DashboardLinks').replace('{count}', String(growth.vault.linksCreated))}
          </div>
          <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.5 }}>
            {t('k42DashboardHubs').replace('{count}', String(growth.vault.areasCreated))}
          </div>
          {recentEvolution.fastestGrowingArea && (
            <div style={{ fontSize: 9, color: c.textFaint, marginTop: 4 }}>
              {t('k42FastestArea').replace('{area}', recentEvolution.fastestGrowingArea)}
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={onOpenTimeline}
          style={{
            fontSize: 9,
            fontWeight: 700,
            padding: '4px 8px',
            borderRadius: 5,
            border: `1px solid ${c.accent}`,
            background: c.accentBg,
            color: c.accent,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {t('k42OpenTimeline')}
        </button>
      </div>
    </div>
  );
}
