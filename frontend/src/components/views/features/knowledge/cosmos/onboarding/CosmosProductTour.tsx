import { useCallback, useEffect, useState } from 'react';
import { useTranslation, type TranslationKey } from '../../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import { touchMinSize } from '../../../../../../lib/responsiveLayout';
import {
  advanceProductTour,
  completeProductTour,
  loadCosmosOnboardingState,
  shouldShowProductTour,
} from './cosmosOnboardingStorage';

const TOUR_STEPS: TranslationKey[] = [
  'k41TourStepNotes',
  'k41TourStepLinks',
  'k41TourStepCosmos',
  'k41TourStepDiscovery',
];

export interface CosmosProductTourProps {
  colors: NoteChromeColors;
  compact?: boolean;
}

/** Skippable first-run tour — Notes → Links → Cosmos → Discovery. */
export function CosmosProductTour({ colors: c, compact }: CosmosProductTourProps) {
  const { t } = useTranslation();
  const [step, setStep] = useState(() => loadCosmosOnboardingState().productTourStep);
  const [visible, setVisible] = useState(() => shouldShowProductTour());

  useEffect(() => {
    if (visible) advanceProductTour(step);
  }, [step, visible]);

  const finish = useCallback(() => {
    completeProductTour();
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (step >= TOUR_STEPS.length - 1) {
      finish();
      return;
    }
    setStep(s => s + 1);
  }, [finish, step]);

  if (!visible) return null;

  const touch = touchMinSize(!!compact);

  return (
    <div
      role="region"
      aria-label={t('k41TourAria')}
      style={{
        margin: compact ? '8px' : '10px 12px',
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 4 }}>
        {t('k41TourTitle')} · {step + 1}/{TOUR_STEPS.length}
      </div>
      <div style={{ fontSize: 11, color: c.text, lineHeight: 1.5, marginBottom: 10 }}>
        {t(TOUR_STEPS[step])}
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button
          type="button"
          onClick={finish}
          style={{
            fontSize: 10,
            padding: '6px 10px',
            minHeight: touch,
            borderRadius: 6,
            border: `1px solid ${c.sideBdr}`,
            background: 'transparent',
            color: c.textMuted,
            cursor: 'pointer',
          }}
        >
          {t('k41TourSkip')}
        </button>
        <button
          type="button"
          onClick={next}
          style={{
            fontSize: 10,
            fontWeight: 700,
            padding: '6px 12px',
            minHeight: touch,
            borderRadius: 6,
            border: `1px solid ${c.accent}`,
            background: c.accentBg,
            color: c.accent,
            cursor: 'pointer',
          }}
        >
          {step >= TOUR_STEPS.length - 1 ? t('k41TourDone') : t('k41TourNext')}
        </button>
      </div>
    </div>
  );
}
