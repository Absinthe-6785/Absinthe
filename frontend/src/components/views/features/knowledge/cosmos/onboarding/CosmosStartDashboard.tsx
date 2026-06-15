import { useTranslation } from '@/lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import { touchMinSize } from '@/lib/responsiveLayout';
import { CosmosTermTooltip } from './CosmosTermTooltip';

export interface CosmosStartDashboardProps {
  colors: NoteChromeColors;
  onCreateNote: () => void;
  onOpenCosmos: () => void;
  compact?: boolean;
}

/** Empty dashboard onboarding — 0 notes vault. */
export function CosmosStartDashboard({
  colors: c,
  onCreateNote,
  onOpenCosmos,
  compact,
}: CosmosStartDashboardProps) {
  const { t } = useTranslation();
  const touch = touchMinSize(!!compact);
  const steps = [
    t('k41StartStep1'),
    t('k41StartStep2'),
    t('k41StartStep3'),
    t('k41StartStep4'),
  ];

  return (
    <div
      style={{
        marginBottom: compact ? 10 : 14,
        padding: compact ? '12px 12px' : '16px 16px',
        borderRadius: 10,
        border: `1px solid ${c.sideBdr}`,
        background: `linear-gradient(160deg, ${c.accentBg} 0%, ${c.cardHov} 100%)`,
      }}
    >
      <div style={{ fontSize: compact ? 13 : 14, fontWeight: 800, color: c.text, marginBottom: 6 }}>
        {t('k41StartCosmosTitle')}
      </div>
      <div style={{ fontSize: 10, color: c.textMuted, marginBottom: 10, lineHeight: 1.5 }}>
        {t('k41StartCosmosIntro')}{' '}
        <CosmosTermTooltip term="cosmos" /> · <CosmosTermTooltip term="discovery" />
      </div>
      <ol style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 11, color: c.text, lineHeight: 1.6 }}>
        {steps.map(step => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          onClick={onCreateNote}
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '8px 12px',
            minHeight: touch,
            borderRadius: 6,
            border: 'none',
            background: c.accent,
            color: c.card,
            cursor: 'pointer',
          }}
        >
          {t('k41CreateNote')}
        </button>
        <button
          type="button"
          onClick={onOpenCosmos}
          style={{
            fontSize: 11,
            fontWeight: 600,
            padding: '8px 12px',
            minHeight: touch,
            borderRadius: 6,
            border: `1px solid ${c.accent}`,
            background: 'transparent',
            color: c.accent,
            cursor: 'pointer',
          }}
        >
          {t('wsOpenCosmos')}
        </button>
      </div>
    </div>
  );
}
