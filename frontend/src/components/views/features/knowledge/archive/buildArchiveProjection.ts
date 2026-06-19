import { enumerateVaultSnapshots } from '@/lib/vaultSnapshotStore';
import { buildArchiveHomeProjection } from './buildArchiveHomeProjection';
import { buildArchiveHistoryItems } from './buildArchiveHistoryItems';
import { buildArchiveDeletedItems } from './buildArchiveDeletedItems';
import { buildArchiveSnapshotItems } from './buildArchiveSnapshotItems';
import { buildArchiveTimelineItems } from './buildArchiveTimelineItems';
import { buildArchiveRestoreTools } from './buildArchiveRestoreTools';
import { readArchiveRestoreRecents } from './archiveRestoreRecents';
import type {
  ArchiveCohesionEmptyFlags,
  ArchiveProjection,
  ArchiveProjectionInput,
} from './archiveProjectionModels';

function buildEmptyFlags(
  historyEmpty: boolean,
  deletedEmpty: boolean,
  snapshotsEmpty: boolean,
  timelineEmpty: boolean,
): ArchiveCohesionEmptyFlags {
  return {
    noHistory: historyEmpty,
    noDeleted: deletedEmpty,
    noSnapshots: snapshotsEmpty,
    noTimeline: timelineEmpty,
    isEmpty: historyEmpty && deletedEmpty && snapshotsEmpty && timelineEmpty,
  };
}

/**
 * K-109 — single-pass Archive projection for history workspace cohesion.
 * Composes home read model plus history, trash, snapshots, timeline, restore tools.
 */
export function buildArchiveProjection(input: ArchiveProjectionInput): ArchiveProjection {
  const domainMarks = input.domainMarks ?? [];
  const locale = input.options?.locale;
  const now = input.now;

  const home = buildArchiveHomeProjection({
    notes: input.notes,
    now,
    domainMarks,
    options: input.options,
  });

  const historyItems = buildArchiveHistoryItems(
    input.notes,
    input.restoreRecents,
    { now, locale, limitPerKind: input.options?.historyLimit },
  );

  const deletedItems = buildArchiveDeletedItems(input.notes, {
    now,
    locale,
    limit: input.options?.deletedLimit,
  });

  const snapshotItems = buildArchiveSnapshotItems(input.snapshots);

  const timelineItems = buildArchiveTimelineItems(input.notes, domainMarks, {
    now,
    locale,
    milestoneLimit: input.options?.timelineMilestoneLimit,
  });

  const restoreTools = buildArchiveRestoreTools(input.snapshots, {
    canUndoRestore: input.canUndoRestore ?? false,
  });

  const empty = buildEmptyFlags(
    historyItems.isEmpty,
    deletedItems.isEmpty,
    snapshotItems.isEmpty,
    timelineItems.isEmpty,
  );

  return {
    home,
    historyItems,
    deletedItems,
    snapshotItems,
    timelineItems,
    restoreTools,
    empty,
    generatedAt: now.toISOString(),
  };
}

/** Convenience for hooks — reads restore recents from UI storage. */
export function buildArchiveProjectionFromVault(
  input: Omit<ArchiveProjectionInput, 'restoreRecents' | 'snapshots'> & {
    snapshots?: ArchiveProjectionInput['snapshots'];
  },
): ArchiveProjection {
  return buildArchiveProjection({
    ...input,
    snapshots: input.snapshots ?? enumerateVaultSnapshots(),
    restoreRecents: readArchiveRestoreRecents(),
  });
}

export const ARCHIVE_PROJECTION_SLICES = [
  'historyItems',
  'deletedItems',
  'snapshotItems',
  'timelineItems',
  'restoreTools',
] as const;
