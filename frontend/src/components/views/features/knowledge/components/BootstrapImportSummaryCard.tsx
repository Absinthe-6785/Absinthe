import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { BootstrapImportSummary } from '../history/bootstrapSummaryStorage';

export interface BootstrapImportSummaryCardProps {
  colors: NoteChromeColors;
  summary: BootstrapImportSummary;
  onDismiss: () => void;
}

/** One-time dismissible card after historical import bootstrap. */
export function BootstrapImportSummaryCard({
  colors: c,
  summary,
  onDismiss,
}: BootstrapImportSummaryCardProps) {
  const { t } = useTranslation();

  return (
    <div
      style={{
        margin: '0 8px 10px',
        padding: '10px 11px',
        borderRadius: 8,
        border: `1px solid ${c.accent}`,
        background: c.accentBg,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: c.text, marginBottom: 4 }}>
        {t('k46BootstrapTitle')}
      </div>
      <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 6 }}>
        {t('k46BootstrapSubtitle')}
      </div>
      <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55, marginBottom: 8 }}>
        <div>{t('k46BootstrapNotes').replace('{count}', String(summary.notesImported))}</div>
        <div>{t('k46BootstrapLinks').replace('{count}', String(summary.linksImported))}</div>
        <div>{t('k46BootstrapAreas').replace('{count}', String(summary.areasImported))}</div>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          width: '100%',
          padding: '5px 10px',
          fontSize: 9,
          fontWeight: 600,
          borderRadius: 6,
          border: `1px solid ${c.sideBdr}`,
          background: c.cardHov,
          color: c.textMuted,
          cursor: 'pointer',
        }}
      >
        {t('k46BootstrapDismiss')}
      </button>
    </div>
  );
}
