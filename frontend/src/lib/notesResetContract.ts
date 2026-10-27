/** Completion evidence for the existing, explicitly confirmed local Notes reset. */
export const NOTES_RESET_STAGES = [
  'local_metadata_clear', 'notes_clear', 'welcome_note', 'folders', 'active_note', 'readback',
] as const;

export type NotesResetStage = typeof NOTES_RESET_STAGES[number] | 'health_routines' | 'folder_remote_intents';
export type NotesResetStatus = 'completed' | 'blocked' | 'stale' | 'incomplete';

export interface NotesResetResult {
  readonly status: NotesResetStatus;
  readonly completedStages: readonly NotesResetStage[];
  readonly unresolvedStages: readonly NotesResetStage[];
  /** Failure/staleness never implies rollback or that earlier stages did not mutate data. */
  readonly reason?: string;
}

export function notesResetResult(
  status: NotesResetStatus,
  completedStages: readonly NotesResetStage[],
  reason?: string,
  requiredStages: readonly NotesResetStage[] = NOTES_RESET_STAGES,
): NotesResetResult {
  return {
    status,
    completedStages: [...new Set(completedStages)],
    unresolvedStages: [...new Set(requiredStages)].filter(stage => !completedStages.includes(stage)),
    ...(reason ? { reason } : {}),
  };
}
