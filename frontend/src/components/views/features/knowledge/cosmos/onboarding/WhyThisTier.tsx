import { useState } from 'react';
import { useTranslation } from '../../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../../noteEditorTheme';
import type {
  ImportanceClassification,
  KnowledgeImportanceInput,
  KnowledgeImportanceResult,
} from '../intelligence/knowledgeImportance';
import { importanceClassificationLabel } from '../../knowledgeLabels';
import { buildTierExplanationLines, tierExplanationForClassification } from './tierExplanation';

export interface WhyThisTierProps {
  colors: NoteChromeColors;
  classification: ImportanceClassification;
  input: KnowledgeImportanceInput;
  result: KnowledgeImportanceResult;
  compact?: boolean;
}

/** Expandable classification explainer — Insights, Discovery, Search. */
export function WhyThisTier({
  colors: c,
  classification,
  input,
  result,
  compact,
}: WhyThisTierProps) {
  const { t, lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = importanceClassificationLabel(classification, lang);
  const lines = buildTierExplanationLines(input, result);

  return (
    <div style={{ marginTop: compact ? 4 : 6 }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        style={{
          border: 'none',
          background: 'transparent',
          padding: 0,
          cursor: 'pointer',
          fontSize: compact ? 9 : 10,
          fontWeight: 600,
          color: c.accent,
          textDecoration: 'underline',
          textUnderlineOffset: 2,
        }}
      >
        {t('k41WhyThisTier')}
      </button>
      {open && (
        <div
          style={{
            marginTop: 6,
            padding: '6px 8px',
            borderRadius: 6,
            border: `1px solid ${c.sideBdr}`,
            background: c.sidebar,
            fontSize: compact ? 9 : 10,
            color: c.textMuted,
            lineHeight: 1.5,
          }}
        >
          <div style={{ fontWeight: 700, color: c.text, marginBottom: 4 }}>{label}</div>
          <div style={{ marginBottom: 6 }}>{t(tierExplanationForClassification(classification))}</div>
          <ul style={{ margin: 0, paddingLeft: 16 }}>
            {lines.map(line => (
              <li key={line.key}>
                {line.values
                  ? Object.entries(line.values).reduce(
                    (text, [key, value]) => text.replace(`{${key}}`, value),
                    t(line.key),
                  )
                  : t(line.key)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
