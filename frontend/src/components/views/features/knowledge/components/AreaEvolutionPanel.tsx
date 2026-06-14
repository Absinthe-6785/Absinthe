import { useMemo } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import type { AreaEvolutionDetail } from '../history/historyAreaEvolutionQueries';
import { buildAreaEvolutionDetail } from '../history/historyAreaEvolutionQueries';
import type { AreaEvolutionRow } from '../timeline';
import { presentHistoryEvent } from '../history/historyEventPresentation';
import { KnowledgePanelSection } from './KnowledgePanelSection';

export interface AreaEvolutionPanelProps {
  colors: NoteChromeColors;
  areaLabel: string;
  row?: AreaEvolutionRow;
  notes: readonly NoteBase[];
  events: readonly KnowledgeHistoryEvent[];
  onBack: () => void;
  onNavigateToNote?: (noteId: string) => void;
}

function TrendIndicator({ trend }: { trend: 'growing' | 'stable' | 'dormant' }) {
  const symbol = trend === 'growing' ? '↑' : trend === 'dormant' ? '○' : '→';
  const color = trend === 'growing' ? '#10B981' : trend === 'dormant' ? '#9CA3AF' : '#6B7280';
  return <span style={{ color, fontWeight: 700, marginRight: 4 }} aria-hidden>{symbol}</span>;
}

function trendKey(trend: 'growing' | 'stable' | 'dormant'): 'k45TrendGrowing' | 'k45TrendStable' | 'k45TrendDormant' {
  if (trend === 'growing') return 'k45TrendGrowing';
  if (trend === 'dormant') return 'k45TrendDormant';
  return 'k45TrendStable';
}

/** Dedicated area evolution drill-through view. */
export function AreaEvolutionPanel({
  colors: c,
  areaLabel,
  row,
  notes,
  events,
  onBack,
  onNavigateToNote,
}: AreaEvolutionPanelProps) {
  const { t, lang } = useTranslation();

  const detail: AreaEvolutionDetail = useMemo(
    () => buildAreaEvolutionDetail(areaLabel, notes, events, row, lang),
    [areaLabel, notes, events, row, lang],
  );

  const recentRows = useMemo(
    () => detail.recentActivity.map(e => presentHistoryEvent(e, notes)),
    [detail.recentActivity, notes],
  );

  return (
    <div style={{ flex: 1, overflowY: 'auto' }}>
      <button
        type="button"
        onClick={onBack}
        style={{
          margin: '8px 8px 4px',
          padding: '4px 8px',
          fontSize: 9,
          borderRadius: 6,
          border: `1px solid ${c.sideBdr}`,
          background: c.cardHov,
          color: c.textMuted,
          cursor: 'pointer',
        }}
      >
        ← {t('k46AreaBack')}
      </button>

      <div
        style={{
          margin: '0 8px 10px',
          padding: '10px 11px',
          borderRadius: 8,
          border: `1px solid ${c.sideBdr}`,
          background: c.cardHov,
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 6 }}>
          {detail.areaLabel}
        </div>
        <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.6 }}>
          <div>{t('k46AreaAge').replace('{months}', String(detail.ageMonths))}</div>
          <div>{t('k46AreaNotes').replace('{count}', String(detail.noteCount))}</div>
          <div>{t('k46AreaLinks').replace('{count}', String(detail.linkCount))}</div>
          <div>
            {t('k46AreaGrowth')}: <TrendIndicator trend={detail.trend} />
            {t(trendKey(detail.trend))}
          </div>
        </div>
      </div>

      <KnowledgePanelSection colors={c} title={t('k46AreaTimeline')}>
        {detail.journeyPeriods.map(period => (
          <div
            key={period.periodKey}
            style={{
              margin: '0 8px 6px',
              padding: '7px 9px',
              borderRadius: 7,
              border: `1px solid ${c.sideBdr}`,
              background: c.cardHov,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 600, color: c.accent, marginBottom: 4 }}>
              {period.periodLabel}
            </div>
            {period.noteDelta > 0 && (
              <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 4 }}>
                {t('k46AreaPeriodNotes').replace('{count}', String(period.noteDelta))}
              </div>
            )}
            {period.highlights.map(h => (
              <button
                key={`${period.periodKey}-${h.timestamp}-${h.detail}`}
                type="button"
                disabled={!onNavigateToNote}
                onClick={() => onNavigateToNote?.(h.noteId)}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 'none',
                  background: 'transparent',
                  padding: '2px 0',
                  cursor: onNavigateToNote ? 'pointer' : 'default',
                  fontSize: 10,
                  color: onNavigateToNote ? c.text : c.textMuted,
                }}
              >
                {t(h.actionKey)} — {h.detail}
              </button>
            ))}
          </div>
        ))}
      </KnowledgePanelSection>

      {detail.milestones.length > 0 && (
        <KnowledgePanelSection colors={c} title={t('k46AreaMilestones')}>
          {detail.milestones.map(m => (
            <button
              key={`${m.timestamp}-${m.detail}`}
              type="button"
              disabled={!onNavigateToNote}
              onClick={() => onNavigateToNote?.(m.noteId)}
              style={{
                width: 'calc(100% - 16px)',
                margin: '0 8px 4px',
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${c.sideBdr}`,
                background: c.accentBg,
                textAlign: 'left',
                cursor: onNavigateToNote ? 'pointer' : 'default',
                fontSize: 10,
                color: c.text,
              }}
            >
              {t(m.actionKey)} — {m.detail}
            </button>
          ))}
        </KnowledgePanelSection>
      )}

      {recentRows.length > 0 && (
        <KnowledgePanelSection colors={c} title={t('k46AreaRecentActivity')}>
          {recentRows.map(row => (
            <button
              key={row.event.id}
              type="button"
              disabled={!onNavigateToNote}
              onClick={() => onNavigateToNote?.(row.noteId)}
              style={{
                width: 'calc(100% - 16px)',
                margin: '0 8px 4px',
                padding: '6px 8px',
                borderRadius: 6,
                border: `1px solid ${c.sideBdr}`,
                background: c.cardHov,
                textAlign: 'left',
                cursor: onNavigateToNote ? 'pointer' : 'default',
                fontSize: 10,
                color: c.text,
              }}
            >
              {t(row.actionKey)} — {row.detail}
            </button>
          ))}
        </KnowledgePanelSection>
      )}
    </div>
  );
}
