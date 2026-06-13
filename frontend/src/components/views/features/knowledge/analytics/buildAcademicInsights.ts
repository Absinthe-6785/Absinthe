import type { NoteBase } from '../../../noteUtils';
import { buildSubjectProgress, type SubjectProgressData } from './buildSubjectProgress';
import { buildProjectHealth, type ProjectHealthData } from './buildProjectHealth';
import { buildLearningActivity, type LearningActivityData } from './buildLearningActivity';
import { buildWeakTopicInsights, type WeakTopicInsightsData } from './buildWeakTopicInsights';

export interface AcademicInsightsData {
  subjectProgress: SubjectProgressData;
  projectHealth: ProjectHealthData;
  weakTopicInsights: WeakTopicInsightsData;
  learningActivity: LearningActivityData;
}

export interface BuildAcademicInsightsOptions {
  limit?: number;
}

/** Combined learning analytics — informational only, no scoring. */
export function buildAcademicInsights(
  notes: readonly NoteBase[],
  opts: BuildAcademicInsightsOptions = {},
): AcademicInsightsData {
  const limit = opts.limit ?? 6;
  return {
    subjectProgress: buildSubjectProgress(notes, { includeEmpty: true }),
    projectHealth: buildProjectHealth(notes, { limit }),
    weakTopicInsights: buildWeakTopicInsights(notes, { limit }),
    learningActivity: buildLearningActivity(notes, { limit: limit * 2 }),
  };
}
