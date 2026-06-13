import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { SubjectProgressData } from '../analytics/buildSubjectProgress';

export interface SubjectProgressPanelProps {
  colors: NoteChromeColors;
  data: SubjectProgressData;
}

/** Informational subject-level progress metrics. */
export function SubjectProgressPanel({ colors: c, data }: SubjectProgressPanelProps) {
  const { t } = useTranslation();
  const visible = data.subjects.filter(
    s => s.noteCount > 0 || s.projectCount > 0,
  );
  if (visible.length === 0) {
    return <div style={{ fontSize: 10, color: c.textFaint }}>{t('knNoSubjectTaggedNotes')}</div>;
  }
  return (
    <div className="be-subject-progress" aria-label={t('knSubjectProgressAria')}>
      {visible.map(s => (
        <div
          key={s.subjectId}
          style={{
            marginBottom: 8,
            padding: '6px 8px',
            background: c.cardHov,
            border: `1px solid ${c.sideBdr}`,
            borderRadius: 6,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 700, color: c.text }}>{s.subjectName}</div>
          <div style={{ fontSize: 9, color: c.textMuted, marginTop: 3 }}>
            {t('knSubjectProgressMeta')
              .replace('{notes}', String(s.noteCount))
              .replace('{study}', String(s.studyNoteCount))
              .replace('{weak}', String(s.weakTopicCount))
              .replace('{concepts}', String(s.conceptCount))
              .replace('{projects}', String(s.projectCount))}
          </div>
        </div>
      ))}
    </div>
  );
}
