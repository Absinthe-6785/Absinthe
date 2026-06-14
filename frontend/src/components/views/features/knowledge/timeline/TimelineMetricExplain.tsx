import { useState } from 'react';
import { useTranslation, type TranslationKey } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { CosmosReasonBlock } from '../cosmos/cosmosPanelUi';

export interface TimelineMetricExplainProps {
  colors: NoteChromeColors;
  metricKey: TranslationKey;
  explainKey: TranslationKey;
  compact?: boolean;
}

/** K-41-style explainability for timeline metrics. */
export function TimelineMetricExplain({
  colors: c,
  metricKey,
  explainKey,
  compact,
}: TimelineMetricExplainProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <div style={{ marginTop: compact ? 2 : 4 }}>
      <div style={{ fontSize: compact ? 10 : 11, fontWeight: 600, color: c.text }}>
        {t(metricKey)}
      </div>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          marginTop: 2,
          cursor: 'pointer',
          fontSize: 9,
          fontWeight: 600,
          color: c.accent,
          textDecoration: 'underline',
          textUnderlineOffset: 2,
        }}
      >
        {t('k42HowCalculated')}
      </button>
      {open && (
        <CosmosReasonBlock c={c}>
          <div style={{ fontSize: 9, lineHeight: 1.5 }}>{t(explainKey)}</div>
        </CosmosReasonBlock>
      )}
    </div>
  );
}
