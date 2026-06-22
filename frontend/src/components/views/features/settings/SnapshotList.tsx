import type { VaultSnapshotSummary } from '@/lib/vaultSnapshotStore';
import type { VaultSnapshotValidationReport } from '@/lib/vaultSnapshotValidate';
import { SnapshotCard } from './SnapshotCard';

export interface SnapshotListProps {
  snapshots: VaultSnapshotSummary[];
  schemaVersions: Record<string, number | null>;
  validationReports: Record<string, VaultSnapshotValidationReport | null>;
  validatingId: string | null;
  restoringId: string | null;
  onVerify: (snapshot: VaultSnapshotSummary) => void;
  onPreview: (snapshot: VaultSnapshotSummary) => void;
  onRestore: (snapshot: VaultSnapshotSummary) => void;
}

export function SnapshotList({
  snapshots,
  schemaVersions,
  validationReports,
  validatingId,
  restoringId,
  onVerify,
  onPreview,
  onRestore,
}: SnapshotListProps) {
  if (snapshots.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-1.5" data-k125e-snapshot-list>
      {snapshots.map((snapshot) => (
        <SnapshotCard
          key={snapshot.snapshotId}
          snapshot={snapshot}
          schemaVersion={schemaVersions[snapshot.snapshotId] ?? null}
          validationReport={validationReports[snapshot.snapshotId] ?? null}
          isValidating={validatingId === snapshot.snapshotId}
          isRestoring={restoringId === snapshot.snapshotId}
          onVerify={() => onVerify(snapshot)}
          onPreview={() => onPreview(snapshot)}
          onRestore={() => onRestore(snapshot)}
        />
      ))}
    </div>
  );
}
