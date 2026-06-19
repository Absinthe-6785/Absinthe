import type { VaultSnapshotSummary } from '@/lib/vaultSnapshotStore';
import type { VaultSnapshotSlot } from '@/lib/vaultSnapshotConstants';
import type { ArchiveSnapshotItem, ArchiveSnapshotProjection } from './archiveProjectionModels';

function pickLatest(
  snapshots: readonly VaultSnapshotSummary[],
  slot: VaultSnapshotSlot,
): VaultSnapshotSummary | null {
  return snapshots.find(s => s.slot === slot) ?? null;
}

function toItem(summary: VaultSnapshotSummary, relativeLabel: string): ArchiveSnapshotItem {
  return {
    snapshotId: summary.snapshotId,
    slot: summary.slot,
    createdAt: summary.createdAt,
    noteCount: summary.noteCount,
    folderCount: summary.folderCount,
    relativeLabel,
  };
}

function formatSnapshotRelative(iso: string): string {
  try {
    const ms = new Date(iso).getTime();
    const diff = Date.now() - ms;
    const mins = Math.floor(diff / 60_000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  } catch {
    return iso;
  }
}

export function buildArchiveSnapshotItems(
  snapshots: readonly VaultSnapshotSummary[],
): ArchiveSnapshotProjection {
  const latestRaw = pickLatest(snapshots, 'last') ?? snapshots[0] ?? null;
  const dailyRaw = pickLatest(snapshots, 'daily');
  const weeklyRaw = pickLatest(snapshots, 'weekly');
  const monthlyRaw = pickLatest(snapshots, 'monthly');

  const latest = latestRaw ? toItem(latestRaw, formatSnapshotRelative(latestRaw.createdAt)) : null;
  const daily = dailyRaw ? toItem(dailyRaw, formatSnapshotRelative(dailyRaw.createdAt)) : null;
  const weekly = weeklyRaw ? toItem(weeklyRaw, formatSnapshotRelative(weeklyRaw.createdAt)) : null;
  const monthly = monthlyRaw ? toItem(monthlyRaw, formatSnapshotRelative(monthlyRaw.createdAt)) : null;

  const isEmpty = !latest && !daily && !weekly && !monthly;

  return { latest, daily, weekly, monthly, isEmpty };
}
