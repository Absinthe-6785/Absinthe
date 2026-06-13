import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { AcademicInsightsData } from '../analytics/buildAcademicInsights';
import { SubjectProgressPanel } from './SubjectProgressPanel';
import { ProjectHealthPanel } from './ProjectHealthPanel';
import { LearningActivityPanel } from './LearningActivityPanel';
import { WeakTopicInsightsPanel } from './WeakTopicInsightsPanel';

export interface AcademicInsightsPanelProps {
  colors: NoteChromeColors;
  data: AcademicInsightsData;
  onNavigateToNote: (noteId: string) => void;
}

function Section({ c, title, children }: { c: NoteChromeColors; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>{title}</div>
      {children}
    </div>
  );
}

/** Combined academic insights — visibility only, no scoring. */
export function AcademicInsightsPanel({ colors: c, data, onNavigateToNote }: AcademicInsightsPanelProps) {
  const { t } = useTranslation();
  return (
    <div className="be-academic-insights" aria-label={t('knAcademicInsightsAria')}>
      <Section c={c} title={t('knSubjectProgressAria')}>
        <SubjectProgressPanel colors={c} data={data.subjectProgress} />
      </Section>
      <Section c={c} title={t('knProjectStatusSection')}>
        <ProjectHealthPanel colors={c} data={data.projectHealth} onNavigateToNote={onNavigateToNote} />
      </Section>
      <Section c={c} title={t('studyWeakTopics')}>
        <WeakTopicInsightsPanel colors={c} data={data.weakTopicInsights} onNavigateToNote={onNavigateToNote} />
      </Section>
      <Section c={c} title={t('knRecentActivity')}>
        <LearningActivityPanel colors={c} data={data.learningActivity} onNavigateToNote={onNavigateToNote} />
      </Section>
    </div>
  );
}
