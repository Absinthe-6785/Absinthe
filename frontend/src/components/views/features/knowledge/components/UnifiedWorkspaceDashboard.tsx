import { useState } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { touchMinSize } from '../../../../lib/responsiveLayout';
import type { UnifiedWorkspaceDashboardData } from '../workspace/buildUnifiedWorkspaceDashboard';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import { AcademicInsightsPanel } from './AcademicInsightsPanel';
import { KnowledgeReviewPanel } from './KnowledgeReviewPanel';
import { ResearchDashboardPanel } from './ResearchDashboardPanel';
import { StudyDashboardPanel } from './StudyDashboardPanel';
import { SubjectMapsDashboardPanel } from './SubjectMapsDashboardPanel';
import { KnowledgeClusterPanel } from './KnowledgeClusterPanel';
import { ProjectDashboardPanel } from './ProjectDashboardPanel';
import { ProjectQuickActions, type ProjectQuickActionsProps } from './ProjectQuickActions';
import { LearningPathOverviewPanel } from './LearningPathOverviewPanel';
import { LearningPathEditorPanel, type LearningPathEditorPanelProps } from './LearningPathEditorPanel';

export type UnifiedDashboardSection = 'overview' | 'learning' | 'research' | 'projects';

export interface UnifiedWorkspaceDashboardProps {
  colors: NoteChromeColors;
  data: UnifiedWorkspaceDashboardData;
  onNavigateToNote: (noteId: string) => void;
  onActivateSubjectWorkspace?: (collectionId: SmartCollectionId) => void;
  projectQuickActions?: Omit<ProjectQuickActionsProps, 'colors'>;
  learningPathOverview?: React.ComponentProps<typeof LearningPathOverviewPanel>;
  learningPathEditor?: Omit<LearningPathEditorPanelProps, 'colors' | 'onNavigateToNote'>;
  compact?: boolean;
}

const SECTION_LABELS: Record<UnifiedDashboardSection, string> = {
  overview: '개요',
  learning: '학습',
  research: '연구',
  projects: '프로젝트',
};

function TabBar({
  c,
  active,
  onChange,
  compact,
}: {
  c: NoteChromeColors;
  active: UnifiedDashboardSection;
  onChange: (section: UnifiedDashboardSection) => void;
  compact?: boolean;
}) {
  const touch = touchMinSize(!!compact);
  const sections: UnifiedDashboardSection[] = ['overview', 'learning', 'research', 'projects'];
  return (
    <div style={{ display: 'flex', gap: compact ? 6 : 4, flexWrap: 'wrap', marginBottom: compact ? 12 : 10 }}>
      {sections.map(section => {
        const isActive = section === active;
        return (
          <button
            key={section}
            type="button"
            onClick={() => onChange(section)}
            style={{
              padding: compact ? '8px 12px' : '4px 10px',
              fontSize: compact ? 11 : 10,
              fontWeight: isActive ? 700 : 500,
              borderRadius: 6,
              border: `1px solid ${isActive ? c.accent : c.sideBdr}`,
              background: isActive ? c.accentBg : c.cardHov,
              color: isActive ? c.accent : c.textMuted,
              cursor: 'pointer',
              minHeight: touch,
              flex: compact ? '1 1 45%' : undefined,
            }}
          >
            {SECTION_LABELS[section]}
          </button>
        );
      })}
    </div>
  );
}

/** Single primary dashboard — consolidates fragmented workspace cards. */
export function UnifiedWorkspaceDashboard({
  colors: c,
  data,
  onNavigateToNote,
  onActivateSubjectWorkspace,
  projectQuickActions,
  learningPathOverview,
  learningPathEditor,
  compact,
}: UnifiedWorkspaceDashboardProps) {
  const [section, setSection] = useState<UnifiedDashboardSection>('overview');

  return (
    <div className="be-unified-workspace-dashboard" aria-label="통합 워크스페이스 대시보드" style={{ overflowX: 'hidden' }}>
      <TabBar c={c} active={section} onChange={setSection} compact={compact} />

      {section === 'overview' && (
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, marginBottom: 6 }}>최근 활동 · 인사이트</div>
          <AcademicInsightsPanel colors={c} data={data.insights} onNavigateToNote={onNavigateToNote} />
          <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, margin: '12px 0 6px' }}>검토 대기열</div>
          <KnowledgeReviewPanel
            colors={c}
            lists={data.review}
            onNavigateToNote={onNavigateToNote}
            compact
          />
        </div>
      )}

      {section === 'learning' && (
        <div>
          <StudyDashboardPanel colors={c} data={data.study} onNavigateToNote={onNavigateToNote} />
          <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, margin: '12px 0 6px' }}>주제</div>
          <SubjectMapsDashboardPanel
            colors={c}
            subjects={data.subjects}
            onNavigateToNote={onNavigateToNote}
            onActivateSubjectWorkspace={onActivateSubjectWorkspace}
          />
          {data.clusters.clusterCount > 0 && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, margin: '12px 0 6px' }}>지식 클러스터</div>
              <KnowledgeClusterPanel colors={c} data={data.clusters} onNavigateToNote={onNavigateToNote} />
            </>
          )}
          {learningPathOverview && (
            <>
              <div style={{ fontSize: 10, fontWeight: 700, color: c.textMuted, margin: '12px 0 6px' }}>학습 경로</div>
              <LearningPathOverviewPanel colors={c} {...learningPathOverview} />
              {learningPathEditor && (
                <LearningPathEditorPanel
                  colors={c}
                  {...learningPathEditor}
                  onNavigateToNote={onNavigateToNote}
                />
              )}
            </>
          )}
        </div>
      )}

      {section === 'research' && (
        <ResearchDashboardPanel colors={c} data={data.research} onNavigateToNote={onNavigateToNote} />
      )}

      {section === 'projects' && (
        <div>
          {projectQuickActions && (
            <ProjectQuickActions colors={c} {...projectQuickActions} compact={compact} />
          )}
          <ProjectDashboardPanel colors={c} data={data.projects} onNavigateToNote={onNavigateToNote} />
        </div>
      )}
    </div>
  );
}
