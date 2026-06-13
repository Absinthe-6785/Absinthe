import type { NoteBase } from '../../../noteUtils';
import {
  buildLearningPath,
  listLearningPathIds,
  type LearningPathStep,
} from './subjectDashboards';

export interface LearningPathOverviewEntry {
  pathId: string;
  label: string;
  stepCount: number;
  maxStep: number;
  currentStep: LearningPathStep | null;
  steps: readonly LearningPathStep[];
  relatedNoteCount: number;
}

export interface LearningPathOverviewData {
  paths: readonly LearningPathOverviewEntry[];
  totalPathCount: number;
}

export interface BuildLearningPathOverviewOptions {
  stepPreviewLimit?: number;
}

/** Vault-wide learning path visibility — display only, no editor. */
export function buildLearningPathOverview(
  notes: readonly NoteBase[],
  opts: BuildLearningPathOverviewOptions = {},
): LearningPathOverviewData {
  const stepPreviewLimit = opts.stepPreviewLimit ?? 4;
  const pathIds = listLearningPathIds(notes);

  const paths = pathIds
    .map(pathId => {
      const path = buildLearningPath(notes, pathId);
      if (!path) return null;
      const maxStep = path.steps.reduce((max, s) => Math.max(max, s.step), 0);
      const currentStep = path.steps
        .filter(s => s.step !== Number.MAX_SAFE_INTEGER)
        .sort((a, b) => b.step - a.step)[0] ?? path.steps[0] ?? null;
      return {
        pathId: path.pathId,
        label: path.label,
        stepCount: path.steps.length,
        maxStep,
        currentStep,
        steps: path.steps.slice(0, stepPreviewLimit),
        relatedNoteCount: path.steps.length,
      } satisfies LearningPathOverviewEntry;
    })
    .filter((entry): entry is LearningPathOverviewEntry => entry !== null);

  return {
    paths,
    totalPathCount: paths.length,
  };
}
