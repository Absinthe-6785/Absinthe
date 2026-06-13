import type { Language } from '../../../../../lib/i18n';
import type { NoteBase } from '../../../noteUtils';
import type { KnowledgeIndexService } from '../KnowledgeIndexService';
import type { KnowledgeReviewLists } from '../review/buildKnowledgeReview';
import { buildKnowledgeReviewLists } from '../review/buildKnowledgeReview';
import { buildResearchDashboard, type ResearchDashboardData } from '../research/buildResearchDashboard';
import { buildStudyDashboard, type StudyDashboardData } from '../study/buildStudyDashboard';
import { buildProjectDashboard, type ProjectDashboardData } from '../academic/buildProjectDashboard';
import { buildAcademicInsights, type AcademicInsightsData } from '../analytics/buildAcademicInsights';
import {
  SUBJECT_DASHBOARDS,
  buildSubjectDashboard,
  type SubjectDashboardData,
} from '../maps/subjectDashboards';
import { buildKnowledgeClusters, type KnowledgeClusterData } from '../maps/buildKnowledgeClusters';

export interface UnifiedWorkspaceDashboardData {
  review: KnowledgeReviewLists;
  insights: AcademicInsightsData;
  research: ResearchDashboardData;
  study: StudyDashboardData;
  subjects: readonly SubjectDashboardData[];
  clusters: KnowledgeClusterData;
  projects: ProjectDashboardData;
}

export interface BuildUnifiedWorkspaceDashboardOptions {
  limit?: number;
  service?: KnowledgeIndexService;
  language?: Language;
}

/** Composes existing dashboard builders — no new scoring or workflow logic. */
export function buildUnifiedWorkspaceDashboard(
  notes: readonly NoteBase[],
  opts: BuildUnifiedWorkspaceDashboardOptions = {},
): UnifiedWorkspaceDashboardData {
  const limit = opts.limit ?? 6;
  const language = opts.language;
  const service = opts.service;
  const subjects = SUBJECT_DASHBOARDS
    .map(s => buildSubjectDashboard(notes, s.id, { limit }))
    .filter((d): d is SubjectDashboardData => d !== null);

  return {
    review: buildKnowledgeReviewLists(notes, { limit }),
    insights: buildAcademicInsights(notes, { limit }),
    research: buildResearchDashboard(notes, { limit, language }),
    study: buildStudyDashboard(notes, { limit }),
    subjects,
    clusters: service
      ? buildKnowledgeClusters(notes, service, { limit: limit + 2 })
      : { highlyConnected: [], tagClusters: [], conceptCount: 0, clusterCount: 0 },
    projects: buildProjectDashboard(notes, { limit }),
  };
}
