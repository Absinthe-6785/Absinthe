import type { NoteBase } from '../../../noteUtils';
import { buildResearchDashboard, type ResearchNoteEntry } from '../research/buildResearchDashboard';
import { buildStudyDashboard, type StudyNoteEntry } from '../study/buildStudyDashboard';
import { buildProjectDashboard, type ProjectDashboardEntry } from './buildProjectDashboard';
import { buildUpcomingMilestones, type ProjectMilestoneEntry } from './projectMilestoneModels';

export interface AcademicDashboardData {
  activeProjects: ProjectDashboardEntry[];
  upcomingMilestones: ProjectMilestoneEntry[];
  studyNotes: StudyNoteEntry[];
  researchNotes: ResearchNoteEntry[];
  weakTopics: StudyNoteEntry[];
}

export interface BuildAcademicDashboardOptions {
  limit?: number;
}

/** Composes existing study/research/project surfaces — informational only. */
export function buildAcademicDashboard(
  notes: readonly NoteBase[],
  opts: BuildAcademicDashboardOptions = {},
): AcademicDashboardData {
  const limit = opts.limit ?? 6;
  const projectData = buildProjectDashboard(notes, { limit });
  const studyData = buildStudyDashboard(notes, { limit });
  const researchData = buildResearchDashboard(notes, { limit });

  const researchNotes = [
    ...researchData.recentSources,
    ...researchData.literatureNotes,
    ...researchData.permanentNotes,
  ]
    .slice(0, limit);

  return {
    activeProjects: projectData.activeProjects,
    upcomingMilestones: buildUpcomingMilestones(notes, { limit }),
    studyNotes: studyData.recentStudyNotes,
    researchNotes,
    weakTopics: studyData.weakTopics,
  };
}
