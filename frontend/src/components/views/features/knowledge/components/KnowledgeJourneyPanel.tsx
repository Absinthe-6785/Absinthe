import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeJourney } from '../history/historyJourneyQueries';

export interface KnowledgeJourneyPanelProps {
  colors: NoteChromeColors;
  journey: KnowledgeJourney;
  onNavigateToNote?: (noteId: string) => void;
}

/** Global Cosmos progression path from milestones and events. */
export function KnowledgeJourneyPanel({
  colors: c,
  journey,
  onNavigateToNote,
}: KnowledgeJourneyPanelProps) {
  const { t } = useTranslation();

  if (journey.steps.length === 0) return null;

  return (
    <div style={{ padding: '0 8px 10px' }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: c.text, margin: '4px 4px 8px' }}>
        {t('k46JourneyTitle')}
      </div>
      {journey.steps.map((step, index) => {
        const interactive = Boolean(step.achieved && step.noteId && onNavigateToNote);
        return (
          <div key={step.milestoneId}>
            <button
              type="button"
              disabled={!interactive}
              onClick={() => step.noteId && onNavigateToNote?.(step.noteId)}
              style={{
                width: '100%',
                textAlign: 'center',
                margin: '0 0 2px',
                padding: '8px 10px',
                borderRadius: 8,
                border: `1px solid ${step.achieved ? c.accent : c.sideBdr}`,
                background: step.achieved ? c.accentBg : c.cardHov,
                opacity: step.achieved ? 1 : 0.55,
                cursor: interactive ? 'pointer' : 'default',
                fontSize: 10,
                fontWeight: step.achieved ? 700 : 500,
                color: step.achieved ? c.text : c.textMuted,
              }}
            >
              {step.achieved ? '✓ ' : '○ '}{t(step.titleKey)}
            </button>
            {index < journey.steps.length - 1 && (
              <div style={{ textAlign: 'center', color: c.textFaint, fontSize: 12, margin: '2px 0 6px' }}>↓</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
