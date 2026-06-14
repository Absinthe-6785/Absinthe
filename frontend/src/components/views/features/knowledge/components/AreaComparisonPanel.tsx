import { useMemo, useState } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeHistoryEvent } from '../history/eventTypes';
import type { AreaComparisonResult } from '../history/historyAreaComparisonQueries';
import {
  buildAreaComparison,
  defaultComparisonLabels,
} from '../history/historyAreaComparisonQueries';
import type { KnowledgeMomentumSnapshot } from '../history/knowledgeMomentum';
import type { AreaEvolutionRow } from '../timeline';

export interface AreaComparisonPanelProps {
  colors: NoteChromeColors;
  notes: readonly NoteBase[];
  events: readonly KnowledgeHistoryEvent[];
  areaRows: readonly AreaEvolutionRow[];
  momentum: KnowledgeMomentumSnapshot;
  onBack: () => void;
  onSelectArea?: (areaLabel: string) => void;
}

function trendSymbol(trend: 'growing' | 'stable' | 'dormant'): string {
  if (trend === 'growing') return '↑';
  if (trend === 'dormant') return '○';
  return '→';
}

/** Side-by-side comparison of knowledge areas from recorded history. */
export function AreaComparisonPanel({
  colors: c,
  notes,
  events,
  areaRows,
  momentum,
  onBack,
  onSelectArea,
}: AreaComparisonPanelProps) {
  const { t } = useTranslation();
  const [selectedLabels, setSelectedLabels] = useState<string[]>(
    () => defaultComparisonLabels(areaRows, 2),
  );

  const comparison: AreaComparisonResult = useMemo(
    () => buildAreaComparison(selectedLabels, notes, events, areaRows, momentum),
    [selectedLabels, notes, events, areaRows, momentum],
  );

  const toggleLabel = (label: string) => {
    setSelectedLabels(prev => {
      if (prev.includes(label)) return prev.filter(l => l !== label);
      if (prev.length >= 4) return prev;
      return [...prev, label];
    });
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 10px' }}>
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
        ← {t('k47CompareBack')}
      </button>

      <div style={{ padding: '0 8px 8px', fontSize: 9, color: c.textFaint }}>
        {t('k47CompareHint')}
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '0 8px 10px' }}>
        {areaRows.map(row => {
          const active = selectedLabels.includes(row.areaLabel);
          return (
            <button
              key={row.areaLabel}
              type="button"
              onClick={() => toggleLabel(row.areaLabel)}
              style={{
                fontSize: 9,
                padding: '3px 8px',
                borderRadius: 999,
                border: `1px solid ${active ? c.accent : c.sideBdr}`,
                background: active ? c.accentBg : c.cardHov,
                color: active ? c.accent : c.textMuted,
                cursor: 'pointer',
              }}
            >
              {row.areaLabel}
            </button>
          );
        })}
      </div>

      {comparison.entries.map((entry, index) => (
        <div key={entry.areaLabel}>
          {index > 0 && (
            <div style={{ textAlign: 'center', color: c.textFaint, fontSize: 10, margin: '6px 0' }}>
              ────────────
            </div>
          )}
          <button
            type="button"
            disabled={!onSelectArea}
            onClick={() => onSelectArea?.(entry.areaLabel)}
            style={{
              width: 'calc(100% - 16px)',
              margin: '0 8px',
              padding: '10px 11px',
              borderRadius: 8,
              border: `1px solid ${c.sideBdr}`,
              background: c.cardHov,
              textAlign: 'left',
              cursor: onSelectArea ? 'pointer' : 'default',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: c.text, marginBottom: 6 }}>
              {entry.areaLabel}{' '}
              <span style={{ fontSize: 9, color: c.textFaint }}>{trendSymbol(entry.trend)}</span>
            </div>
            <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
              <div>{t('k46AreaNotes').replace('{count}', String(entry.noteCount))}</div>
              <div>{t('k46AreaLinks').replace('{count}', String(entry.linkCount))}</div>
              <div>{t('k47CompareGrowth').replace('{count}', String(entry.noteGrowth))}</div>
              <div>{t('k47CompareLinkGrowth').replace('{count}', String(entry.linkGrowth))}</div>
              <div>{t('k47CompareMomentum').replace('{count}', String(entry.momentumScore))}</div>
            </div>
          </button>
        </div>
      ))}
    </div>
  );
}
