import { useTranslation, type TranslationKey } from '../../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import type { DiscoveryConfidence } from '../../discovery/discoveryScoring';
import { CosmosConfidenceBadge, CosmosReasonBlock } from '../cosmosPanelUi';

export interface WhyThisRecommendationProps {
  colors: NoteChromeColors;
  reasons: readonly string[];
  confidence?: DiscoveryConfidence;
  score?: number;
  compact?: boolean;
}

/** Reusable “why?” block for Discovery and Insights recommendations. */
export function WhyThisRecommendation({
  colors: c,
  reasons,
  confidence,
  score,
  compact,
}: WhyThisRecommendationProps) {
  const { t } = useTranslation();
  if (reasons.length === 0 && confidence == null && score == null) return null;

  return (
    <CosmosReasonBlock c={c}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        marginBottom: reasons.length > 0 ? 4 : 0,
      }}
      >
        <div style={{
          fontSize: 8,
          fontWeight: 700,
          color: c.textFaint,
          textTransform: 'uppercase',
        }}
        >
          {t('k41WhyRecommendation')}
        </div>
        {confidence && <CosmosConfidenceBadge c={c} tier={confidence} t={t} />}
      </div>
      {reasons.map(line => (
        <div key={line} style={{ fontSize: compact ? 9 : 10 }}>{line}</div>
      ))}
      {score != null && (
        <div style={{ fontSize: 8, color: c.textFaint, marginTop: reasons.length > 0 ? 4 : 0 }}>
          {t('k40ConfidenceLabel')}: {t(
            confidence === 'high' ? 'k40ConfidenceShortHigh'
            : confidence === 'medium' ? 'k40ConfidenceShortMedium'
              : 'k40ConfidenceShortLow',
          )}
          {' · '}
          {t('k40DiscoveryScore').replace('{score}', String(score))}
        </div>
      )}
    </CosmosReasonBlock>
  );
}

export function buildSignalReasonLines(
  signals: readonly string[],
  labelForSignal: (signal: string) => string,
): string[] {
  return signals.map(signal => `• ${labelForSignal(signal)}`);
}

export function buildTierReasonLine(
  tierLabel: string,
  days?: number,
  t?: (key: TranslationKey) => string,
): string[] {
  if (days != null && t) {
    return [`• ${tierLabel}`, `• ${t('k41ReasonNotOpened').replace('{days}', String(days))}`];
  }
  return tierLabel ? [`• ${tierLabel}`] : [];
}
