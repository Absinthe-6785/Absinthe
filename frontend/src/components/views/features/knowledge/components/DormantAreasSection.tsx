import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { DormantAreaInsight } from '../history/DormantAreaAnalyzer';

export interface DormantAreasSectionProps {
  colors: NoteChromeColors;
  areas: readonly DormantAreaInsight[];
  onSelectArea?: (areaLabel: string) => void;
}

/** Dormant area warnings derived from history analysis. */
export function DormantAreasSection({ colors: c, areas, onSelectArea }: DormantAreasSectionProps) {
  const { t } = useTranslation();

  if (areas.length === 0) return null;

  return (
    <div style={{ padding: '0 8px 8px' }}>
      {areas.slice(0, 4).map(area => (
        <button
          key={area.areaLabel}
          type="button"
          disabled={!onSelectArea}
          onClick={() => onSelectArea?.(area.areaLabel)}
          style={{
            width: '100%',
            textAlign: 'left',
            margin: '0 0 4px',
            padding: '7px 9px',
            borderRadius: 7,
            border: `1px solid ${c.sideBdr}`,
            background: c.cardHov,
            cursor: onSelectArea ? 'pointer' : 'default',
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: c.text }}>
            {area.areaLabel}
            <span style={{ fontSize: 9, color: '#9CA3AF', marginLeft: 6 }}>{t('k47DormantLabel')}</span>
          </div>
          <div style={{ fontSize: 9, color: c.textMuted, marginTop: 2 }}>
            {t('k47DormantLastActivity').replace('{days}', String(area.daysSinceActivity))}
          </div>
        </button>
      ))}
    </div>
  );
}
