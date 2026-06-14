import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ExportKind } from '../history/knowledgeHistoryExport';

export interface TimelineExportMenuProps {
  colors: NoteChromeColors;
  onExport: (kind: ExportKind, mode: 'copy' | 'download') => void;
}

const EXPORT_KINDS: ExportKind[] = ['report', 'evolution', 'activity', 'journey'];

const KIND_LABELS: Record<ExportKind, 'k47ExportReport' | 'k47ExportEvolution' | 'k47ExportActivity' | 'k47ExportJourney'> = {
  report: 'k47ExportReport',
  evolution: 'k47ExportEvolution',
  activity: 'k47ExportActivity',
  journey: 'k47ExportJourney',
};

/** Compact export actions — copy or download markdown. */
export function TimelineExportMenu({ colors: c, onExport }: TimelineExportMenuProps) {
  const { t } = useTranslation();

  return (
    <div style={{ padding: '0 8px 8px' }}>
      <div style={{ fontSize: 9, fontWeight: 600, color: c.textFaint, marginBottom: 4 }}>
        {t('k47ExportTitle')}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {EXPORT_KINDS.map(kind => (
          <span key={kind} style={{ display: 'inline-flex', gap: 2 }}>
            <button
              type="button"
              onClick={() => onExport(kind, 'copy')}
              style={{
                fontSize: 8,
                padding: '3px 6px',
                borderRadius: 4,
                border: `1px solid ${c.sideBdr}`,
                background: c.cardHov,
                color: c.textMuted,
                cursor: 'pointer',
              }}
            >
              {t(KIND_LABELS[kind])} ↗
            </button>
            <button
              type="button"
              onClick={() => onExport(kind, 'download')}
              style={{
                fontSize: 8,
                padding: '3px 6px',
                borderRadius: 4,
                border: `1px solid ${c.sideBdr}`,
                background: c.cardHov,
                color: c.textMuted,
                cursor: 'pointer',
              }}
              title={t('k47ExportDownload')}
            >
              ↓
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}
