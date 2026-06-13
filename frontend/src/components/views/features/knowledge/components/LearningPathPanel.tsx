import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { LearningPath } from '../maps/subjectDashboards';

export interface LearningPathPanelProps {
  colors: NoteChromeColors;
  path: LearningPath | null;
  onNavigateToNote: (noteId: string) => void;
}

/** Manual learning path — ordered steps only, no recommendations. */
export function LearningPathPanel({ colors: c, path, onNavigateToNote }: LearningPathPanelProps) {
  const { t } = useTranslation();
  if (!path || path.steps.length === 0) return null;

  return (
    <section className="be-learning-path" style={{ padding: '0 0 8px' }} aria-label={t('knLearningPath')}>
      <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 700, borderTop: `1px solid ${c.sideBdr}` }}>
        {t('knLearningPath')} · {path.label}
      </div>
      <ol style={{ margin: '4px 8px', paddingLeft: 18, listStyle: 'none' }}>
        {path.steps.map((step, idx) => (
          <li key={step.noteId} style={{ marginBottom: 6, position: 'relative' }}>
            {idx > 0 && (
              <div style={{ position: 'absolute', left: -14, top: -8, fontSize: 10, color: c.textFaint }}>↓</div>
            )}
            <button
              type="button"
              onClick={() => onNavigateToNote(step.noteId)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: c.cardHov,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                padding: '6px 8px',
                cursor: 'pointer',
                color: c.text,
              }}
            >
              <div style={{ fontSize: 9, color: c.accent, marginBottom: 2 }}>
                {t('knLearningPathStep').replace('{n}', String(step.step))}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600 }}>{step.noteTitle}</div>
            </button>
          </li>
        ))}
      </ol>
    </section>
  );
}
