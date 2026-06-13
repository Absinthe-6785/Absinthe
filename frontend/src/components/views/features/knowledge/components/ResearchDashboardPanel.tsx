import type { NoteChromeColors } from '../../../noteEditorTheme';
import { useTranslation } from '../../../../../lib/i18n';
import type { ResearchDashboardData, ResearchNoteEntry } from '../research/buildResearchDashboard';
import { useViewportLayout } from '../../../../../hooks/useViewportLayout';
import { responsiveMetricGridColumns } from '../../../../../lib/responsiveLayout';

export interface ResearchDashboardPanelProps {
  colors: NoteChromeColors;
  data: ResearchDashboardData;
  onNavigateToNote: (noteId: string) => void;
  onOpenResearchCollection?: () => void;
}

function Section({
  c,
  title,
  count,
  items,
  onNavigate,
  emptyAction,
}: {
  c: NoteChromeColors;
  title: string;
  count?: number;
  items: readonly ResearchNoteEntry[];
  onNavigate: (id: string) => void;
  emptyAction?: { label: string; onClick: () => void };
}) {
  const { t } = useTranslation();
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {title}
        {count !== undefined && count > 0 && (
          <span style={{ color: c.accent, marginLeft: 4 }}>({count})</span>
        )}
      </div>
      {items.length === 0 ? (
        emptyAction ? (
          <div>
            <div style={{ fontSize: 10, color: c.textFaint, marginBottom: 6 }}>{t('emptyResearchSources')}</div>
            <button
              type="button"
              onClick={emptyAction.onClick}
              style={{
                fontSize: 10,
                padding: '5px 8px',
                borderRadius: 6,
                border: `1px solid ${c.sideBdr}`,
                background: c.accentBg,
                color: c.accent,
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              {emptyAction.label}
            </button>
          </div>
        ) : (
          <div style={{ fontSize: 10, color: c.textFaint }}>{t('emptySectionNone')}</div>
        )
      ) : (
        items.map(item => (
          <button
            key={`${title}-${item.noteId}`}
            type="button"
            onClick={() => onNavigate(item.noteId)}
            style={{
              width: '100%',
              textAlign: 'left',
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '5px 8px',
              marginBottom: 3,
              cursor: 'pointer',
              color: c.text,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {item.noteTitle}
            </div>
            <div style={{ fontSize: 9, color: c.textMuted, marginTop: 1 }}>{item.meta}</div>
          </button>
        ))
      )}
    </div>
  );
}

function PipelineOverview({ c, data, isMobile }: { c: NoteChromeColors; data: ResearchDashboardData['sourcePipeline']; isMobile: boolean }) {
  const { t } = useTranslation();
  const total = data.source + data.literature + data.permanent + data.unclassified;
  const rows = [
    { label: t('researchPipelineSource'), count: data.source, color: c.accent },
    { label: t('researchPipelineLiterature'), count: data.literature, color: c.text },
    { label: t('researchPipelinePermanent'), count: data.permanent, color: c.green },
    { label: t('researchPipelineUnclassified'), count: data.unclassified, color: c.textFaint },
  ];
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>
        {t('researchPipelineTitle')}
        {total > 0 && <span style={{ color: c.accent, marginLeft: 4 }}>({total})</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: responsiveMetricGridColumns(isMobile), gap: 4 }}>
        {rows.map(row => (
          <div
            key={row.label}
            style={{
              background: c.cardHov,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '6px 4px',
              textAlign: 'center',
            }}
          >
            <div style={{ fontSize: 14, fontWeight: 700, color: row.color }}>{row.count}</div>
            <div style={{ fontSize: 9, color: c.textMuted }}>{row.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Informational research dashboard — no AI, no external APIs. */
export function ResearchDashboardPanel({ colors: c, data, onNavigateToNote, onOpenResearchCollection }: ResearchDashboardPanelProps) {
  const { isMobile } = useViewportLayout();
  const { t } = useTranslation();
  const researchEmptyAction = onOpenResearchCollection
    ? { label: t('emptyResearchAction'), onClick: onOpenResearchCollection }
    : undefined;
  return (
    <div className="be-research-dashboard" aria-label={t('researchDashboardAria')} style={{ overflowX: 'hidden' }}>
      <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 8 }}>
        {t('researchCitationSummary').replace('{count}', String(data.citationCount))}
      </div>
      <PipelineOverview c={c} data={data.sourcePipeline} isMobile={isMobile} />
      <Section c={c} title={t('researchCitationActivity')} count={data.citationActivity.length} items={data.citationActivity} onNavigate={onNavigateToNote} />
      <Section c={c} title={t('researchPromotionActivity')} count={data.promotionActivity.length} items={data.promotionActivity} onNavigate={onNavigateToNote} />
      <Section c={c} title={t('researchRecentSources')} items={data.recentSources} onNavigate={onNavigateToNote} emptyAction={researchEmptyAction} />
      <Section c={c} title={t('researchReadingNotes')} items={data.readingNotes} onNavigate={onNavigateToNote} />
      <Section c={c} title={t('researchLiteratureNotes')} items={data.literatureNotes} onNavigate={onNavigateToNote} />
      <Section c={c} title={t('researchPermanentNotes')} items={data.permanentNotes} onNavigate={onNavigateToNote} />
    </div>
  );
}
