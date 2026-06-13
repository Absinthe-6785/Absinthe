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
  return (
    <div className="be-academic-insights" aria-label="학술 인사이트">
      <Section c={c} title="주제별 진행">
        <SubjectProgressPanel colors={c} data={data.subjectProgress} />
      </Section>
      <Section c={c} title="프로젝트 상태">
        <ProjectHealthPanel colors={c} data={data.projectHealth} onNavigateToNote={onNavigateToNote} />
      </Section>
      <Section c={c} title="약점 주제">
        <WeakTopicInsightsPanel colors={c} data={data.weakTopicInsights} onNavigateToNote={onNavigateToNote} />
      </Section>
      <Section c={c} title="최근 활동">
        <LearningActivityPanel colors={c} data={data.learningActivity} onNavigateToNote={onNavigateToNote} />
      </Section>
    </div>
  );
}
