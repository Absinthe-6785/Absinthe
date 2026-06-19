import type { VaultSnapshotSlot } from '@/lib/vaultSnapshotConstants';
import type { RecoveryProtectionStatus } from '@/lib/vaultRestorePipeline';
import type { ArchiveHomeProjection } from './archiveHomeModels';

export type ArchiveHistoryBucket = 'today' | 'yesterday' | 'earlier';
export type ArchiveHistoryKind = 'opened' | 'edited' | 'restored';
export type ArchiveTimelineBucket = 'today' | 'thisWeek' | 'thisMonth' | 'earlier';
export type ArchiveDeletedSort = 'newest' | 'oldest' | 'title';

export interface ArchiveHistoryItem {
  noteId: string;
  title: string;
  timestamp: number;
  kind: ArchiveHistoryKind;
  bucket: ArchiveHistoryBucket;
  relativeLabel: string;
}

export interface ArchiveHistoryGroup {
  bucket: ArchiveHistoryBucket;
  opened: ArchiveHistoryItem[];
  edited: ArchiveHistoryItem[];
  restored: ArchiveHistoryItem[];
}

export interface ArchiveHistoryProjection {
  groups: readonly ArchiveHistoryGroup[];
  isEmpty: boolean;
}

export interface ArchiveDeletedItem {
  noteId: string;
  title: string;
  deletedAt: number;
  relativeLabel: string;
}

export interface ArchiveDeletedProjection {
  items: readonly ArchiveDeletedItem[];
  totalCount: number;
  isEmpty: boolean;
}

export interface ArchiveSnapshotItem {
  snapshotId: string;
  slot: VaultSnapshotSlot;
  createdAt: string;
  noteCount: number;
  folderCount: number;
  relativeLabel: string;
}

export interface ArchiveSnapshotProjection {
  latest: ArchiveSnapshotItem | null;
  daily: ArchiveSnapshotItem | null;
  weekly: ArchiveSnapshotItem | null;
  monthly: ArchiveSnapshotItem | null;
  isEmpty: boolean;
}

export interface ArchiveTimelineEntry {
  id: string;
  label: string;
  dateKey: string;
  kind: 'milestone' | 'mark-day';
  noteId?: string;
}

export interface ArchiveTimelineGroup {
  bucket: ArchiveTimelineBucket;
  entries: readonly ArchiveTimelineEntry[];
}

export interface ArchiveTimelineProjection {
  groups: readonly ArchiveTimelineGroup[];
  isEmpty: boolean;
}

export interface ArchiveRestoreToolsProjection {
  snapshotCount: number;
  lastSnapshotAt: string | null;
  lastExportAt: string | null;
  protectionStatus: RecoveryProtectionStatus;
  canUndoRestore: boolean;
}

export interface ArchiveCohesionEmptyFlags {
  noHistory: boolean;
  noDeleted: boolean;
  noSnapshots: boolean;
  noTimeline: boolean;
  isEmpty: boolean;
}

/** K-109 unified Archive read model — single-pass projection slices. */
export interface ArchiveProjection {
  home: ArchiveHomeProjection;
  historyItems: ArchiveHistoryProjection;
  deletedItems: ArchiveDeletedProjection;
  snapshotItems: ArchiveSnapshotProjection;
  timelineItems: ArchiveTimelineProjection;
  restoreTools: ArchiveRestoreToolsProjection;
  empty: ArchiveCohesionEmptyFlags;
  generatedAt: string;
}

export interface ArchiveRestoreRecentEntry {
  noteId: string;
  restoredAt: number;
}

export interface ArchiveProjectionInput {
  notes: readonly import('../../../noteUtils').NoteBase[];
  now: Date;
  domainMarks?: readonly import('./archiveHomeModels').ArchiveDomainMarkDay[];
  snapshots: readonly import('@/lib/vaultSnapshotStore').VaultSnapshotSummary[];
  restoreRecents: readonly ArchiveRestoreRecentEntry[];
  canUndoRestore?: boolean;
  options?: import('./archiveHomeModels').ArchiveHomeProjectionOptions & {
    historyLimit?: number;
    deletedLimit?: number;
    timelineMilestoneLimit?: number;
  };
}
