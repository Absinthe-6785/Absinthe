import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { KnowledgeJourney } from '../history/historyJourneyQueries';

export interface KnowledgeJourneyPanelProps {
  colors: NoteChromeColors;
  journey: KnowledgeJourney;
  onNavigateToNote?: (noteId: string) => void;
}

function formatDate(ts: number | null, lang: string): string {
  if (!ts) return '';
  return new Date(ts).toLocaleDateString(
    lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  );
}

/** Global Cosmos progression path from milestones and events. */
export function KnowledgeJourneyPanel({
  colors: c,
  journey,
  onNavigateToNote,
}: KnowledgeJourneyPanelProps) {
  const { t, lang } = useTranslation();

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
              <div>{step.achieved ? '✓ ' : '○ '}{t(step.titleKey)}</div>
              {step.achieved && step.achievedAt && (
                <div style={{ fontSize: 9, fontWeight: 500, color: c.textMuted, marginTop: 3 }}>
                  {formatDate(step.achievedAt, lang)}
                </div>
              )}
              {step.achieved && step.daysSincePrevious != null && step.daysSincePrevious > 0 && (
                <div style={{ fontSize: 8, color: c.textFaint, marginTop: 2 }}>
                  {t('k47JourneyDaysSince').replace('{days}', String(step.daysSincePrevious))}
                </div>
              )}
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
