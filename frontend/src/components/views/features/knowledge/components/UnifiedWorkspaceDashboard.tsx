import { useState } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import { DashboardSectionTitle } from '@/components/common/dashboard';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { touchMinSize } from '../../../../../lib/responsiveLayout';
import type { UnifiedWorkspaceDashboardData } from '../workspace/buildUnifiedWorkspaceDashboard';
import type { SmartCollectionId } from '../collections/smartCollectionModels';
import { DiscoveryDashboardCard } from './DiscoveryDashboardCard';
import { TimelineDashboardCard } from './TimelineDashboardCard';
import { KnowledgeActivityCard } from './KnowledgeActivityCard';
import { KnowledgeEvolutionCard } from './KnowledgeEvolutionCard';
import type { KnowledgeActivitySummary } from '../history';
import type { EvolutionInsightsSummary } from '../history/evolutionInsightsQueries';
import type { RecentEvolutionSummary } from '../timeline';
import type { TranslationKey } from '../../../../../lib/i18n';
import { CosmosProductTour, CosmosStartDashboard } from '../cosmos/onboarding';
import type { KnowledgeTimeline } from '../timeline';
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
  onOpenStudyCollection?: () => void;
  onOpenResearchCollection?: () => void;
  projectQuickActions?: Omit<ProjectQuickActionsProps, 'colors'>;
  learningPathOverview?: Omit<React.ComponentProps<typeof LearningPathOverviewPanel>, 'colors'>;
  learningPathEditor?: Omit<LearningPathEditorPanelProps, 'colors' | 'onNavigateToNote'>;
  compact?: boolean;
  onOpenDiscover?: () => void;
  onOpenTimeline?: () => void;
  timeline?: KnowledgeTimeline;
  activitySummary?: KnowledgeActivitySummary;
  activityRecent?: { actionKey: TranslationKey; detail: string; noteId: string } | null;
  activityLatestMilestone?: { titleKey: TranslationKey; noteId: string | null } | null;
  activityGrowthTrend?: RecentEvolutionSummary | null;
  evolutionInsights?: EvolutionInsightsSummary | null;
  onOpenEvolution?: () => void;
  onNavigateToArea?: (areaLabel: string) => void;
  activeNoteCount?: number;
  onCreateNote?: () => void;
  onOpenCosmos?: () => void;
}

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
  const { t } = useTranslation();
  const touch = touchMinSize(!!compact);
  const sections: UnifiedDashboardSection[] = ['overview', 'learning', 'research', 'projects'];
  const sectionLabels: Record<UnifiedDashboardSection, string> = {
    overview: t('wsTabOverview'),
    learning: t('wsTabLearning'),
    research: t('wsTabResearch'),
    projects: t('wsTabProjects'),
  };
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
            {sectionLabels[section]}
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
  onOpenStudyCollection,
  onOpenResearchCollection,
  projectQuickActions,
  learningPathOverview,
  learningPathEditor,
  compact,
  onOpenDiscover,
  onOpenTimeline,
  timeline,
  activitySummary,
  activityRecent,
  activityLatestMilestone,
  activityGrowthTrend,
  evolutionInsights,
  onOpenEvolution,
  onNavigateToArea,
  activeNoteCount = 0,
  onCreateNote,
  onOpenCosmos,
}: UnifiedWorkspaceDashboardProps) {
  const { t } = useTranslation();
  const [section, setSection] = useState<UnifiedDashboardSection>('overview');

  return (
    <div className="be-unified-workspace-dashboard" aria-label={t('wsUnifiedDashboardAria')} style={{ overflowX: 'hidden' }}>
      <TabBar c={c} active={section} onChange={setSection} compact={compact} />

      {section === 'overview' && (
        <div>
          <CosmosProductTour colors={c} compact={compact} />
          {activeNoteCount === 0 && onCreateNote && onOpenCosmos && (
            <CosmosStartDashboard
              colors={c}
              compact={compact}
              onCreateNote={onCreateNote}
              onOpenCosmos={onOpenCosmos}
            />
          )}
          {evolutionInsights && onOpenEvolution && (
            <KnowledgeEvolutionCard
              colors={c}
              insights={evolutionInsights}
              compact={compact}
              onOpenEvolution={onOpenEvolution}
              onNavigateToNote={onNavigateToNote}
              onNavigateToArea={onNavigateToArea}
            />
          )}
          {activitySummary && (
            <KnowledgeActivityCard
              colors={c}
              summary={activitySummary}
              compact={compact}
              recentActivity={activityRecent ?? undefined}
              latestMilestone={activityLatestMilestone ?? undefined}
              growthTrend={activityGrowthTrend ?? undefined}
              onNavigateToNote={onNavigateToNote}
            />
          )}
          {timeline && onOpenTimeline && timeline.snapshots.length > 0 && (
            <TimelineDashboardCard
              colors={c}
              timeline={timeline}
              onOpenTimeline={onOpenTimeline}
              compact={compact}
            />
          )}
          {onOpenDiscover && data.discovery.summary.totalCount > 0 && (
            <DiscoveryDashboardCard
              colors={c}
              summary={data.discovery.summary}
              onOpenDiscover={onOpenDiscover}
              compact={compact}
            />
          )}
          <DashboardSectionTitle colors={c} first>{t('wsRecentActivityInsights')}</DashboardSectionTitle>
          <AcademicInsightsPanel colors={c} data={data.insights} onNavigateToNote={onNavigateToNote} />
          <DashboardSectionTitle colors={c}>{t('wsKnowledgeReview')}</DashboardSectionTitle>
          <KnowledgeReviewPanel
            colors={c}
            lists={data.review}
            onNavigateToNote={onNavigateToNote}
            compact
          />
          {learningPathOverview && (
            <>
              <DashboardSectionTitle colors={c}>{t('wsLearningPaths')}</DashboardSectionTitle>
              <LearningPathOverviewPanel colors={c} {...learningPathOverview} onNavigateToNote={onNavigateToNote} />
            </>
          )}
        </div>
      )}

      {section === 'learning' && (
        <div>
          <StudyDashboardPanel
            colors={c}
            data={data.study}
            onNavigateToNote={onNavigateToNote}
            onOpenStudyCollection={onOpenStudyCollection}
          />
          <DashboardSectionTitle colors={c}>{t('searchGroupSubjects')}</DashboardSectionTitle>
          <SubjectMapsDashboardPanel
            colors={c}
            subjects={data.subjects}
            onNavigateToNote={onNavigateToNote}
            onActivateSubjectWorkspace={onActivateSubjectWorkspace}
          />
          {data.clusters.clusterCount > 0 && (
            <>
              <DashboardSectionTitle colors={c}>{t('wsKnowledgeClusters')}</DashboardSectionTitle>
              <KnowledgeClusterPanel colors={c} data={data.clusters} onNavigateToNote={onNavigateToNote} />
            </>
          )}
          {learningPathOverview && (
            <>
              <DashboardSectionTitle colors={c}>{t('wsLearningPaths')}</DashboardSectionTitle>
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
        <ResearchDashboardPanel
          colors={c}
          data={data.research}
          onNavigateToNote={onNavigateToNote}
          onOpenResearchCollection={onOpenResearchCollection}
        />
      )}

      {section === 'projects' && (
        <div>
          {projectQuickActions && (
            <ProjectQuickActions colors={c} {...projectQuickActions} compact={compact} />
          )}
          <ProjectDashboardPanel
            colors={c}
            data={data.projects}
            onNavigateToNote={onNavigateToNote}
            onCreateProject={projectQuickActions?.onCreateProject}
          />
        </div>
      )}
    </div>
  );
}
