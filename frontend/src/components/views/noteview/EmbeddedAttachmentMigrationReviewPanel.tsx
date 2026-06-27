import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type {
  EmbeddedAttachmentAuditReport,
  EmbeddedAttachmentAuditNoteInput,
} from '../../../lib/embeddedAttachmentAudit';
import { auditEmbeddedAttachments } from '../../../lib/embeddedAttachmentAudit';
import {
  buildAttachmentCleanupReview,
  type AttachmentCleanupReviewCandidate,
  type AttachmentCleanupReviewReport,
} from '../../../lib/attachmentCleanupReview';
import {
  attachmentCleanupCandidateId,
  createAttachmentCleanupConfirmationToken,
  executeAttachmentCleanup,
  hashAttachmentCleanupReviewReport,
  type AttachmentCleanupExecutorReport,
} from '../../../lib/attachmentCleanupExecutor';
import { createLocalAttachmentBlobAdapter } from '../../../lib/attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from '../../../lib/attachmentMetadataIndexedDb';
import {
  migrateEmbeddedDataUrlsToAttachments,
  hashEmbeddedAttachmentMigrationText,
  type EmbeddedAttachmentMigrationReport,
} from '../../../lib/embeddedAttachmentMigration';
import {
  createLocalEmbeddedAttachmentMigrationBackupReader,
  listEmbeddedAttachmentMigrationBackups,
  restoreEmbeddedAttachmentMigrationBackup,
  type EmbeddedAttachmentMigrationBackupSummary,
  type EmbeddedAttachmentMigrationRestoreReport,
} from '../../../lib/embeddedAttachmentMigrationRestore';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';

type MigrationReviewState = 'idle' | 'scanning' | 'ready' | 'migrating' | 'complete' | 'error';
type CleanupReviewState = 'idle' | 'reviewing' | 'complete' | 'error';
type CleanupExecutionState = 'idle' | 'running' | 'complete' | 'error';
type BackupInspectionState = 'idle' | 'loading' | 'ready' | 'error';
type BackupRestoreState = 'idle' | 'running' | 'complete' | 'error';

export interface EmbeddedAttachmentMigrationReviewPanelProps {
  notes: readonly Note[];
  colors: NoteChromeColors;
  updateNote: (id: string, patch: Partial<Note>) => void;
  auditFn?: (notes: readonly EmbeddedAttachmentAuditNoteInput[]) => EmbeddedAttachmentAuditReport;
  migrateFn?: typeof migrateEmbeddedDataUrlsToAttachments;
  cleanupReviewFn?: typeof buildAttachmentCleanupReview;
  cleanupExecutorFn?: typeof executeAttachmentCleanup;
  listBackupsFn?: typeof listEmbeddedAttachmentMigrationBackups;
  restoreBackupFn?: typeof restoreEmbeddedAttachmentMigrationBackup;
}

function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function safeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.replace(/\bdata:([^;,\s)"']+)(?:;[^,\s)"']*)*;base64,[A-Za-z0-9+/=]+/gi, 'data:$1;base64,[omitted]');
}

function noteTitle(note: Note | undefined, id: string): string {
  const title = note?.title?.trim();
  return title || id;
}

function shortValue(value: string | undefined): string {
  if (!value) return '';
  return value.length <= 28 ? value : `${value.slice(0, 12)}...${value.slice(-10)}`;
}

type CleanupReviewNumericKey = {
  [Key in keyof AttachmentCleanupReviewReport]: AttachmentCleanupReviewReport[Key] extends number ? Key : never
}[keyof AttachmentCleanupReviewReport];

const cleanupSummaryRows: Array<[string, CleanupReviewNumericKey]> = [
  ['Notes scanned', 'notesScanned'],
  ['Attachments scanned', 'attachmentsScanned'],
  ['Blobs scanned', 'blobsScanned'],
  ['Backups scanned', 'backupsScanned'],
  ['Referenced attachments', 'referencedAttachmentCount'],
  ['Unreferenced metadata', 'unreferencedAttachmentMetadataCount'],
  ['Unreferenced blobs', 'unreferencedBlobCount'],
  ['Partial migration artifacts', 'partialMigrationArtifactCount'],
  ['Restored migration artifacts', 'restoredMigrationArtifactCount'],
  ['Missing blobs', 'missingBlobCount'],
  ['Missing metadata', 'missingMetadataCount'],
  ['Duplicate candidates', 'duplicateCandidateCount'],
  ['Backup records', 'backupRecordCount'],
];

const cleanupTypeLabels: Record<string, string> = {
  referencedAttachment: 'Referenced attachments',
  unreferencedAttachmentMetadata: 'Unreferenced attachment metadata',
  unreferencedBlob: 'Unreferenced blobs',
  partialMigrationArtifact: 'Partial migration artifacts',
  restoredMigrationArtifact: 'Restored migration artifacts',
  backupRecord: 'Backup records',
  missingBlob: 'Missing blob',
  missingMetadata: 'Missing metadata',
  duplicateCandidate: 'Duplicate candidates',
};

const cleanupStatusLabels: Record<string, string> = {
  referencedAttachment: 'in use',
  unreferencedAttachmentMetadata: 'review candidate',
  unreferencedBlob: 'review candidate',
  partialMigrationArtifact: 'warning',
  restoredMigrationArtifact: 'preserved',
  backupRecord: 'preserved',
  missingBlob: 'data integrity warning',
  missingMetadata: 'data integrity warning',
  duplicateCandidate: 'review required',
};

const cleanupResultLabels: Record<string, string> = {
  deleted: 'Deleted',
  skipped: 'Skipped',
  blocked: 'Blocked',
  failed: 'Failed',
};

function isSelectableCleanupCandidate(candidate: AttachmentCleanupReviewCandidate): boolean {
  return candidate.type === 'unreferencedBlob' || candidate.type === 'unreferencedAttachmentMetadata';
}

function cleanupBlockedReason(candidate: AttachmentCleanupReviewCandidate): string {
  if (isSelectableCleanupCandidate(candidate)) return 'Selectable after review.';
  if (candidate.type === 'referencedAttachment') return 'In use by note content.';
  if (candidate.type === 'backupRecord') return 'Backup records are preserved.';
  if (candidate.type === 'restoredMigrationArtifact') return 'Restored migration traces are preserved.';
  if (candidate.type === 'missingBlob' || candidate.type === 'missingMetadata') return 'Integrity warning; manual restore or repair may be needed.';
  if (candidate.type === 'partialMigrationArtifact') return 'Partial migration artifact; inspect the migration result first.';
  if (candidate.type === 'duplicateCandidate') return 'Duplicate candidate; resolve manually before cleanup.';
  return 'Not eligible for explicit cleanup.';
}

type BackupEligibilityStatus =
  | 'restorable'
  | 'current-note-changed'
  | 'missing-note'
  | 'missing-hash'
  | 'restore-unavailable';

interface BackupEligibility {
  status: BackupEligibilityStatus;
  label: string;
  safe: boolean;
  reason: string;
  expectedBodyHash?: string;
  expectedContentHash?: string;
}

function backupConfirmationPhrase(summary: EmbeddedAttachmentMigrationBackupSummary): string {
  return `RESTORE ${summary.backupKey.slice(0, 18)}`;
}

function backupEligibility(input: {
  summary: EmbeddedAttachmentMigrationBackupSummary;
  notesById: Map<string, Note>;
  migrationReport: EmbeddedAttachmentMigrationReport | null;
}): BackupEligibility {
  const note = input.notesById.get(input.summary.noteId);
  if (!note || note.deletedAt) {
    return {
      status: 'missing-note',
      label: 'Missing note',
      safe: false,
      reason: 'The note for this backup is missing or deleted.',
    };
  }

  const migrationResult = input.migrationReport?.noteResults.find(result => (
    result.backupKey === input.summary.backupKey && result.noteId === input.summary.noteId
  ));
  if (!migrationResult) {
    return {
      status: 'restore-unavailable',
      label: 'Restore unavailable',
      safe: false,
      reason: 'Safe restore requires the current migration report so the migrated note hash can be verified.',
    };
  }

  if (!migrationResult.rewrittenBodyHash) {
    return {
      status: 'missing-hash',
      label: 'Restore unavailable',
      safe: false,
      reason: 'This backup has no migrated body hash to verify against the current note.',
    };
  }

  const currentBodyHash = hashEmbeddedAttachmentMigrationText(note.body ?? '');
  const currentContentHash = hashEmbeddedAttachmentMigrationText('');
  if (
    migrationResult.rewrittenBodyHash !== currentBodyHash
    || (migrationResult.rewrittenContentHash && migrationResult.rewrittenContentHash !== currentContentHash)
  ) {
    return {
      status: 'current-note-changed',
      label: 'Current note changed',
      safe: false,
      reason: 'The current note no longer matches the migrated backup checkpoint. Normal restore is blocked.',
      expectedBodyHash: migrationResult.rewrittenBodyHash,
      expectedContentHash: migrationResult.rewrittenContentHash,
    };
  }

  return {
    status: 'restorable',
    label: 'Restorable',
    safe: true,
    reason: 'Current note matches the migrated checkpoint. Restore can replace it with the preserved original body.',
    expectedBodyHash: migrationResult.rewrittenBodyHash,
    expectedContentHash: migrationResult.rewrittenContentHash,
  };
}

export function EmbeddedAttachmentMigrationReviewPanel({
  notes,
  colors: c,
  updateNote,
  auditFn = auditEmbeddedAttachments,
  migrateFn = migrateEmbeddedDataUrlsToAttachments,
  cleanupReviewFn = buildAttachmentCleanupReview,
  cleanupExecutorFn = executeAttachmentCleanup,
  listBackupsFn = listEmbeddedAttachmentMigrationBackups,
  restoreBackupFn = restoreEmbeddedAttachmentMigrationBackup,
}: EmbeddedAttachmentMigrationReviewPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<MigrationReviewState>('idle');
  const [cleanupStatus, setCleanupStatus] = useState<CleanupReviewState>('idle');
  const [auditReport, setAuditReport] = useState<EmbeddedAttachmentAuditReport | null>(null);
  const [migrationReport, setMigrationReport] = useState<EmbeddedAttachmentMigrationReport | null>(null);
  const [cleanupReport, setCleanupReport] = useState<AttachmentCleanupReviewReport | null>(null);
  const [cleanupExecutionReport, setCleanupExecutionReport] = useState<AttachmentCleanupExecutorReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cleanupError, setCleanupError] = useState<string | null>(null);
  const [cleanupExecutionError, setCleanupExecutionError] = useState<string | null>(null);
  const [cleanupExecutionStatus, setCleanupExecutionStatus] = useState<CleanupExecutionState>('idle');
  const [selectedCleanupCandidateIds, setSelectedCleanupCandidateIds] = useState<ReadonlySet<string>>(() => new Set());
  const [cleanupConfirmation, setCleanupConfirmation] = useState('');
  const [backupStatus, setBackupStatus] = useState<BackupInspectionState>('idle');
  const [restoreStatus, setRestoreStatus] = useState<BackupRestoreState>('idle');
  const [backupSummaries, setBackupSummaries] = useState<EmbeddedAttachmentMigrationBackupSummary[]>([]);
  const [selectedBackupKey, setSelectedBackupKey] = useState<string | null>(null);
  const [restoreConfirmation, setRestoreConfirmation] = useState('');
  const [restoreReport, setRestoreReport] = useState<EmbeddedAttachmentMigrationRestoreReport | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const activeNotes = useMemo(() => notes.filter(note => !note.deletedAt), [notes]);
  const notesById = useMemo(() => new Map(notes.map(note => [note.id, note])), [notes]);
  const hasCandidates = (auditReport?.summary.totalEmbeddedPayloads ?? 0) > 0;
  const busy = status === 'scanning' || status === 'migrating';
  const cleanupBusy = cleanupStatus === 'reviewing';
  const cleanupExecuting = cleanupExecutionStatus === 'running';
  const canMigrate = Boolean(auditReport && hasCandidates && !busy);
  const cleanupReportHash = cleanupReport ? hashAttachmentCleanupReviewReport(cleanupReport) : '';
  const cleanupConfirmationPhrase = cleanupReport ? `CLEANUP ${cleanupReportHash.slice(0, 12)}` : '';
  const cleanupCandidateEntries = cleanupReport?.candidates.map((candidate, index) => ({
    candidate,
    candidateId: attachmentCleanupCandidateId(candidate, index),
    selectable: isSelectableCleanupCandidate(candidate),
  })) ?? [];
  const selectedCleanupCandidateCount = selectedCleanupCandidateIds.size;
  const selectableCleanupCandidateIds = new Set(cleanupCandidateEntries.filter(entry => entry.selectable).map(entry => entry.candidateId));
  const cleanupCanExecute = Boolean(
    cleanupReport
      && selectedCleanupCandidateCount > 0
      && cleanupConfirmation === cleanupConfirmationPhrase
      && !cleanupExecuting,
  );
  const backupBusy = backupStatus === 'loading';
  const restoreBusy = restoreStatus === 'running';
  const selectedBackup = backupSummaries.find(summary => summary.backupKey === selectedBackupKey) ?? null;
  const selectedBackupEligibility = selectedBackup ? backupEligibility({
    summary: selectedBackup,
    notesById,
    migrationReport,
  }) : null;
  const selectedRestorePhrase = selectedBackup ? backupConfirmationPhrase(selectedBackup) : '';
  const restoreCanRun = Boolean(
    selectedBackup
      && selectedBackupEligibility?.safe
      && restoreConfirmation === selectedRestorePhrase
      && !restoreBusy,
  );

  const scan = async () => {
    if (busy) return;
    setStatus('scanning');
    setError(null);
    setMigrationReport(null);
    setConfirming(false);
    try {
      const report = auditFn(activeNotes.map(note => ({
        id: note.id,
        title: note.title,
        body: note.body,
        updatedAt: String(note.updatedAt),
      })));
      setAuditReport(report);
      setStatus('ready');
    } catch (err) {
      setError(safeError(err));
      setStatus('error');
    }
  };

  const reviewCleanup = async () => {
    if (cleanupBusy) return;
    setCleanupStatus('reviewing');
    setCleanupError(null);
    setCleanupExecutionError(null);
    setCleanupExecutionReport(null);
    setCleanupExecutionStatus('idle');
    setSelectedCleanupCandidateIds(new Set());
    setCleanupConfirmation('');
    try {
      const report = await cleanupReviewFn({
        notes: activeNotes.map(note => ({
          id: note.id,
          title: note.title,
          body: note.body,
          updatedAt: String(note.updatedAt),
        })),
        backupReader: createLocalEmbeddedAttachmentMigrationBackupReader(),
        migrationReports: migrationReport ? [migrationReport] : [],
      });
      setCleanupReport(report);
      setCleanupStatus('complete');
    } catch (err) {
      setCleanupError(safeError(err));
      setCleanupStatus('error');
    }
  };

  const toggleCleanupCandidate = (candidateId: string, checked: boolean) => {
    if (!selectableCleanupCandidateIds.has(candidateId) || cleanupExecuting) return;
    setSelectedCleanupCandidateIds(previous => {
      const next = new Set(previous);
      if (checked) next.add(candidateId);
      else next.delete(candidateId);
      return next;
    });
    setCleanupExecutionReport(null);
    setCleanupExecutionError(null);
  };

  const runCleanup = async () => {
    if (!cleanupReport || !cleanupCanExecute) return;
    const selectedCandidateIds = Array.from(selectedCleanupCandidateIds).filter(candidateId => selectableCleanupCandidateIds.has(candidateId));
    if (selectedCandidateIds.length !== selectedCleanupCandidateIds.size) {
      setCleanupExecutionStatus('error');
      setCleanupExecutionError('Cleanup review is stale. Re-run cleanup review before cleanup.');
      return;
    }

    setCleanupExecutionStatus('running');
    setCleanupExecutionError(null);
    setCleanupExecutionReport(null);
    try {
      const report = await cleanupExecutorFn({
        reviewReport: cleanupReport,
        confirmationToken: createAttachmentCleanupConfirmationToken(cleanupReport),
        selectedCandidateIds,
        notes: activeNotes.map(note => ({
          id: note.id,
          title: note.title,
          body: note.body,
          updatedAt: String(note.updatedAt),
        })),
        repository: createLocalAttachmentMetadataRepository(),
        blobAdapter: createLocalAttachmentBlobAdapter(),
      });
      setCleanupExecutionReport(report);
      setCleanupExecutionStatus('complete');
      setSelectedCleanupCandidateIds(new Set());
      setCleanupConfirmation('');
    } catch (err) {
      setCleanupExecutionError(safeError(err));
      setCleanupExecutionStatus('error');
    }
  };

  const migrate = async () => {
    if (!canMigrate) return;
    if (!confirming) {
      setConfirming(true);
      return;
    }
    setStatus('migrating');
    setError(null);
    try {
      const report = await migrateFn({
        notes: activeNotes.map(note => ({
          id: note.id,
          title: note.title,
          body: note.body,
          updatedAt: String(note.updatedAt),
        })),
        updateNote: async (noteId, patch) => {
          const body = typeof patch.body === 'string' ? patch.body : undefined;
          if (body !== undefined) updateNote(noteId, { body });
        },
      });
      setMigrationReport(report);
      setStatus('complete');
      setConfirming(false);
    } catch (err) {
      setError(safeError(err));
      setStatus('error');
    }
  };

  const loadBackups = async () => {
    if (backupBusy) return;
    setBackupStatus('loading');
    setBackupError(null);
    setRestoreError(null);
    setRestoreReport(null);
    setSelectedBackupKey(null);
    setRestoreConfirmation('');
    try {
      const summaries = await listBackupsFn(createLocalEmbeddedAttachmentMigrationBackupReader());
      setBackupSummaries(summaries);
      setBackupStatus('ready');
    } catch (err) {
      setBackupError(safeError(err));
      setBackupStatus('error');
    }
  };

  const selectBackup = (backupKey: string) => {
    setSelectedBackupKey(backupKey);
    setRestoreConfirmation('');
    setRestoreReport(null);
    setRestoreError(null);
  };

  const runRestore = async () => {
    if (!selectedBackup || !selectedBackupEligibility || !restoreCanRun) return;
    setRestoreStatus('running');
    setRestoreError(null);
    setRestoreReport(null);
    try {
      const report = await restoreBackupFn({
        noteId: selectedBackup.noteId,
        backupKey: selectedBackup.backupKey,
        backupReader: createLocalEmbeddedAttachmentMigrationBackupReader(),
        expectedCurrentBodyHash: selectedBackupEligibility.expectedBodyHash,
        expectedCurrentContentHash: selectedBackupEligibility.expectedContentHash,
        readCurrentNote: async noteId => {
          const note = activeNotes.find(item => item.id === noteId);
          return note ? { id: note.id, title: note.title, body: note.body, updatedAt: String(note.updatedAt) } : null;
        },
        updateNote: async (noteId, patch) => {
          updateNote(noteId, { body: patch.body ?? '' });
        },
      });
      setRestoreReport(report);
      setRestoreStatus('complete');
      setRestoreConfirmation('');
    } catch (err) {
      setRestoreError(safeError(err));
      setRestoreStatus('error');
    }
  };

  const failedResults = migrationReport?.noteResults.filter(result => result.failedCount > 0 || result.errors.length > 0) ?? [];
  const orphanResults = migrationReport?.noteResults.filter(
    result => result.orphanedAttachmentIds.length > 0 || result.orphanedBlobKeys.length > 0,
  ) ?? [];

  return (
    <section
      data-embedded-attachment-migration-review
      style={{
        margin: '8px 8px 10px',
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 8,
        background: c.card,
        color: c.text,
        overflow: 'hidden',
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        className="btbtn"
        onClick={() => setExpanded(value => !value)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '8px 10px',
          fontSize: 11,
          fontWeight: 700,
          color: c.text,
        }}
      >
        <span>Attachment storage maintenance</span>
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {expanded ? (
        <div style={{ borderTop: `1px solid ${c.sideBdr}`, padding: 10, display: 'flex', flexDirection: 'column', gap: 9 }}>
          <p style={{ margin: 0, fontSize: 10.5, lineHeight: 1.45, color: c.textMuted }}>
            Review embedded data URLs before converting them into local attachment records. Nothing runs automatically.
          </p>

          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btbtn"
              onClick={scan}
              disabled={busy}
              style={{ padding: '6px 9px', fontSize: 11, fontWeight: 700 }}
            >
              {status === 'scanning' ? 'Scanning...' : 'Scan embedded attachments'}
            </button>
            <button
              type="button"
              className="btbtn"
              onClick={migrate}
              disabled={!canMigrate}
              style={{
                padding: '6px 9px',
                fontSize: 11,
                fontWeight: 700,
                color: canMigrate ? c.accent : c.textFaint,
                borderColor: canMigrate ? `${c.accent}66` : c.sideBdr,
              }}
            >
              {status === 'migrating'
                ? 'Migrating...'
                : confirming
                  ? 'Confirm migration'
                  : 'Migrate embedded attachments'}
            </button>
          </div>

          {confirming ? (
            <div style={{ fontSize: 10.5, lineHeight: 1.45, color: c.textMuted, border: `1px solid ${c.accent}44`, borderRadius: 6, padding: 8 }}>
              This will create local attachment records and backups before replacing embedded data URLs with attachment references.
            </div>
          ) : null}

          {auditReport ? (
            <div data-embedded-attachment-audit-summary style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {[
                  ['Notes scanned', auditReport.summary.totalNotesScanned],
                  ['Affected notes', auditReport.summary.notesWithEmbeddedPayloads],
                  ['Payloads', auditReport.summary.totalEmbeddedPayloads],
                  ['Decoded size', formatBytes(auditReport.summary.totalEstimatedDecodedBytes)],
                  ['Images', auditReport.summary.imagePayloadCount],
                  ['PDF', auditReport.summary.pdfPayloadCount],
                  ['Other', auditReport.summary.otherDataPayloadCount],
                  ['Base64 size', formatBytes(auditReport.summary.totalEstimatedBase64Bytes)],
                ].map(([label, value]) => (
                  <div key={label} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                    <div style={{ fontSize: 9.5, color: c.textFaint }}>{label}</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{value}</div>
                  </div>
                ))}
              </div>
              {auditReport.candidates.length === 0 ? (
                <div style={{ fontSize: 10.5, color: c.textMuted }}>No embedded data URLs found.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {auditReport.candidates.slice(0, 8).map(candidate => {
                    const imageCount = candidate.payloads.filter(payload => payload.kind === 'image').length;
                    const pdfCount = candidate.payloads.filter(payload => payload.kind === 'pdf').length;
                    const otherCount = candidate.payloads.filter(payload => payload.kind === 'other').length;
                    return (
                      <div key={candidate.noteId} data-embedded-attachment-candidate style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 7 }}>
                        <div style={{ fontSize: 11, fontWeight: 700 }}>{noteTitle(notesById.get(candidate.noteId), candidate.noteId)}</div>
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 2 }}>
                          {candidate.payloadCount} payloads · {formatBytes(candidate.estimatedDecodedBytes)} · image {imageCount} · pdf {pdfCount} · other {otherCount}
                        </div>
                        <div style={{ fontSize: 9.5, color: c.textFaint, marginTop: 4 }}>
                          {candidate.payloads.map(payload => payload.previewLabel).join(' · ')}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {migrationReport ? (
            <div data-embedded-attachment-migration-report style={{ border: `1px solid ${failedResults.length ? c.danger : c.sideBdr}`, borderRadius: 6, padding: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                {failedResults.length ? 'Migration completed with warnings' : 'Migration completed'}
              </div>
              <div style={{ fontSize: 10.5, lineHeight: 1.6, color: c.textMuted }}>
                <div>Migration ID: {migrationReport.migrationId}</div>
                <div>Notes scanned: {migrationReport.notesScanned}</div>
                <div>Notes migrated: {migrationReport.notesMigrated}</div>
                <div>Payloads migrated: {migrationReport.payloadsMigrated}</div>
                <div>Payloads skipped: {migrationReport.payloadsSkipped}</div>
                <div>Payloads failed: {migrationReport.payloadsFailed}</div>
                <div>Backups created: {migrationReport.backupsCreated}</div>
                <div>Attachments created: {migrationReport.attachmentsCreated}</div>
                <div>Blobs written: {migrationReport.blobsWritten}</div>
                <div>Estimated decoded bytes: {formatBytes(migrationReport.totalEstimatedDecodedBytes)}</div>
              </div>
              {failedResults.length ? (
                <div style={{ marginTop: 7, display: 'flex', gap: 6, color: c.danger, fontSize: 10.5, lineHeight: 1.45 }}>
                  <AlertTriangle size={13} />
                  <span>Some items failed. Original note bodies were preserved for failed items.</span>
                </div>
              ) : (
                <div style={{ marginTop: 7, fontSize: 10.5, color: c.textMuted }}>
                  Original note bodies were backed up before conversion.
                </div>
              )}
              {orphanResults.length ? (
                <div style={{ marginTop: 6, fontSize: 10.5, color: c.textMuted }}>
                  Cleanup is deferred. Review orphaned local resources in a future cleanup pass.
                </div>
              ) : null}
              {failedResults.flatMap(result => result.errors).slice(0, 4).map((failure, index) => (
                <div key={`${failure}-${index}`} style={{ marginTop: 4, fontSize: 10, color: c.danger }}>
                  {failure}
                </div>
              ))}
            </div>
          ) : null}

          <div data-attachment-cleanup-review-section style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>Cleanup review</div>
              <p style={{ margin: '3px 0 0', fontSize: 10.5, lineHeight: 1.45, color: c.textMuted }}>
                This review only identifies possible cleanup candidates. Nothing is deleted automatically.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btbtn"
                onClick={reviewCleanup}
                disabled={cleanupBusy}
                style={{ padding: '6px 9px', fontSize: 11, fontWeight: 700 }}
              >
                {cleanupBusy ? 'Reviewing...' : cleanupReport ? 'Re-run orphan review' : 'Run orphan review'}
              </button>
              <span style={{ fontSize: 10, color: c.textFaint }}>Review required before any future cleanup.</span>
            </div>

            {cleanupReport ? (
              <div data-attachment-cleanup-review-report style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  {cleanupSummaryRows.map(([label, key]) => (
                    <div key={label} style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                      <div style={{ fontSize: 9.5, color: c.textFaint }}>{label}</div>
                      <div style={{ fontSize: 12, fontWeight: 700 }}>{cleanupReport[key]}</div>
                    </div>
                  ))}
                  <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: '6px 7px' }}>
                    <div style={{ fontSize: 9.5, color: c.textFaint }}>Estimated recoverable</div>
                    <div style={{ fontSize: 12, fontWeight: 700 }}>{formatBytes(cleanupReport.estimatedRecoverableBytes)}</div>
                  </div>
                </div>

                {cleanupReport.warnings.map((warning, index) => (
                  <div key={`${warning}-${index}`} style={{ display: 'flex', gap: 6, color: c.textMuted, fontSize: 10.5, lineHeight: 1.45 }}>
                    <AlertTriangle size={13} />
                    <span>{warning}</span>
                  </div>
                ))}
                {cleanupReport.errors.map((failure, index) => (
                  <div key={`${failure}-${index}`} style={{ fontSize: 10.5, color: c.danger }}>{failure}</div>
                ))}
                {cleanupReport.backupRecordCount > 0 ? (
                  <div style={{ fontSize: 10.5, color: c.textMuted }}>
                    Migration backups are preserved. Backup deletion is not part of this review.
                  </div>
                ) : null}
                <div style={{ fontSize: 10.5, color: c.textMuted }}>
                  Blob inventory: {cleanupReport.inventoryAvailable ? (cleanupReport.inventoryPartial ? 'partial' : 'available') : 'unavailable'}.
                </div>
                {cleanupReport.candidates.length === 0 ? (
                  <div style={{ fontSize: 10.5, color: c.textMuted }}>No cleanup candidates found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {cleanupCandidateEntries.slice(0, 10).map(({ candidate, candidateId, selectable }) => (
                      <div key={candidateId} style={{ border: `1px solid ${candidate.severity === 'danger' ? c.danger : c.sideBdr}`, borderRadius: 6, padding: 7 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                            {selectable ? (
                              <input
                                type="checkbox"
                                checked={selectedCleanupCandidateIds.has(candidateId)}
                                disabled={cleanupExecuting}
                                onChange={event => toggleCleanupCandidate(candidateId, event.currentTarget.checked)}
                                aria-label={`Select ${cleanupTypeLabels[candidate.type] ?? candidate.type}`}
                              />
                            ) : null}
                            <span style={{ fontSize: 10.5, fontWeight: 800 }}>{cleanupTypeLabels[candidate.type] ?? candidate.type}</span>
                          </label>
                          <span style={{ fontSize: 9.5, color: candidate.severity === 'warning' ? c.danger : c.textFaint }}>
                            {selectable ? 'selectable' : (cleanupStatusLabels[candidate.type] ?? candidate.severity)}
                          </span>
                        </div>
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                          {candidate.noteId ? <span>note {shortValue(candidate.noteId)} </span> : null}
                          {candidate.attachmentId ? <span>attachment {shortValue(candidate.attachmentId)} </span> : null}
                          {candidate.localBlobKey ? <span>blob {shortValue(candidate.localBlobKey)} </span> : null}
                          {candidate.backupKey ? <span>backup {shortValue(candidate.backupKey)} </span> : null}
                        </div>
                        <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}>{candidate.reason}</div>
                        <div style={{ fontSize: 9.5, color: c.textFaint, marginTop: 3, lineHeight: 1.45 }}>{candidate.safeActionRecommendation}</div>
                        <div style={{ fontSize: 9.5, color: selectable ? c.accent : c.textFaint, marginTop: 3, lineHeight: 1.45 }}>
                          {selectable ? 'Eligible for selected local cleanup.' : cleanupBlockedReason(candidate)}
                        </div>
                      </div>
                    ))}
                    {cleanupReport.candidates.length > 10 ? (
                      <div style={{ fontSize: 10, color: c.textFaint }}>
                        {cleanupReport.candidates.length - 10} more candidates hidden in this compact review.
                      </div>
                    ) : null}
                  </div>
                )}
                <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                  <div style={{ fontSize: 11, fontWeight: 800 }}>Explicit cleanup</div>
                  <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                    Select individual unreferenced local candidates, then type <strong>{cleanupConfirmationPhrase}</strong> to confirm this exact review.
                    Default selection is zero. Backup records and warnings are not selectable.
                  </div>
                  <input
                    value={cleanupConfirmation}
                    onChange={event => setCleanupConfirmation(event.currentTarget.value)}
                    placeholder={cleanupConfirmationPhrase}
                    disabled={!cleanupReport || cleanupExecuting}
                    aria-label="Cleanup confirmation phrase"
                    style={{
                      border: `1px solid ${c.sideBdr}`,
                      borderRadius: 6,
                      padding: '6px 8px',
                      background: c.input,
                      color: c.text,
                      fontSize: 11,
                    }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <button
                      type="button"
                      className="btbtn"
                      onClick={runCleanup}
                      disabled={!cleanupCanExecute}
                      style={{
                        padding: '6px 9px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: cleanupCanExecute ? c.danger : c.textFaint,
                        borderColor: cleanupCanExecute ? `${c.danger}66` : c.sideBdr,
                      }}
                    >
                      {cleanupExecuting ? 'Cleaning selected...' : 'Clean selected local items'}
                    </button>
                    <span style={{ fontSize: 10, color: c.textFaint }}>
                      {selectedCleanupCandidateCount} selected
                    </span>
                  </div>
                  {cleanupExecutionReport ? (
                    <div data-attachment-cleanup-executor-report style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 800 }}>Cleanup result</div>
                      <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
                        <div>Cleanup ID: {cleanupExecutionReport.cleanupId}</div>
                        <div>Source review: {cleanupExecutionReport.sourceReviewReportId}</div>
                        <div>Confirmation verified: {cleanupExecutionReport.confirmationVerified ? 'yes' : 'no'}</div>
                        <div>Requested: {cleanupExecutionReport.requestedCandidateCount}</div>
                        <div>Eligible: {cleanupExecutionReport.eligibleCandidateCount}</div>
                        <div>Blobs deleted: {cleanupExecutionReport.deletedBlobCount}</div>
                        <div>Metadata deleted: {cleanupExecutionReport.deletedAttachmentMetadataCount}</div>
                        <div>Skipped: {cleanupExecutionReport.skippedCandidateCount}</div>
                        <div>Blocked: {cleanupExecutionReport.blockedCandidateCount}</div>
                        <div>Failed: {cleanupExecutionReport.failedCandidateCount}</div>
                        <div>Recovered estimate: {formatBytes(cleanupExecutionReport.bytesRecoveredEstimate)}</div>
                      </div>
                      {cleanupExecutionReport.results.map(result => (
                        <div key={result.candidateId} style={{ border: `1px solid ${result.status === 'failed' ? c.danger : c.sideBdr}`, borderRadius: 6, padding: 6 }}>
                          <div style={{ fontSize: 10.5, fontWeight: 800 }}>
                            {cleanupResultLabels[result.status] ?? result.status} - {cleanupTypeLabels[result.candidateType] ?? result.candidateType}
                          </div>
                          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                            {result.attachmentId ? <span>attachment {shortValue(result.attachmentId)} </span> : null}
                            {result.localBlobKey ? <span>blob {shortValue(result.localBlobKey)} </span> : null}
                            {result.estimatedBytes ? <span>{formatBytes(result.estimatedBytes)} </span> : null}
                          </div>
                          <div style={{ fontSize: 9.5, color: c.textFaint, marginTop: 3, lineHeight: 1.45 }}>{result.reason}</div>
                        </div>
                      ))}
                      {cleanupExecutionReport.warnings.map((warning, index) => (
                        <div key={`${warning}-${index}`} style={{ fontSize: 10, color: c.textMuted }}>{warning}</div>
                      ))}
                      {cleanupExecutionReport.errors.map((failure, index) => (
                        <div key={`${failure}-${index}`} style={{ fontSize: 10, color: c.danger }}>{failure}</div>
                      ))}
                      <div style={{ fontSize: 10.5, color: c.textMuted }}>Re-run cleanup review after cleanup to refresh local inventory.</div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div data-attachment-backup-restore-section style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 9, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 800 }}>Migration backups</div>
              <p style={{ margin: '3px 0 0', fontSize: 10.5, lineHeight: 1.45, color: c.textMuted }}>
                Migration backups preserve original note bodies before embedded attachment conversion. This section shows safe summaries only; original content and base64 payloads are not displayed.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                type="button"
                className="btbtn"
                onClick={loadBackups}
                disabled={backupBusy}
                style={{ padding: '6px 9px', fontSize: 11, fontWeight: 700 }}
              >
                {backupBusy ? 'Loading backups...' : backupSummaries.length ? 'Reload migration backups' : 'Load migration backups'}
              </button>
              <span style={{ fontSize: 10, color: c.textFaint }}>Backup inspection is explicit. Restore never runs automatically.</span>
            </div>

            {backupStatus === 'ready' ? (
              <div data-attachment-backup-inspection-report style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 10.5, color: c.textMuted }}>
                  {backupSummaries.length} migration backup{backupSummaries.length === 1 ? '' : 's'} found.
                </div>
                {backupSummaries.length === 0 ? (
                  <div style={{ fontSize: 10.5, color: c.textMuted }}>No migration backups found.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {backupSummaries.slice(0, 10).map(summary => {
                      const eligibility = backupEligibility({ summary, notesById, migrationReport });
                      const selected = selectedBackupKey === summary.backupKey;
                      return (
                        <button
                          key={summary.backupKey}
                          type="button"
                          className="btbtn"
                          onClick={() => selectBackup(summary.backupKey)}
                          style={{
                            display: 'block',
                            textAlign: 'left',
                            border: `1px solid ${selected ? c.accent : c.sideBdr}`,
                            borderRadius: 6,
                            padding: 8,
                            color: c.text,
                            background: selected ? c.accentBg : 'transparent',
                            height: 'auto',
                            width: '100%',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 10.5, fontWeight: 800 }}>{noteTitle(notesById.get(summary.noteId), summary.noteId)}</span>
                            <span style={{ fontSize: 9.5, color: eligibility.safe ? c.accent : c.textFaint }}>{eligibility.label}</span>
                          </div>
                          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 4, lineHeight: 1.45 }}>
                            backup {shortValue(summary.backupKey)} · migration {shortValue(summary.migrationId)} · note {shortValue(summary.noteId)}
                          </div>
                          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                            created {summary.createdAt} · original body {formatBytes(summary.originalBodyBytes)} · content {formatBytes(summary.originalContentBytes)}
                          </div>
                          <div style={{ fontSize: 10, color: c.textMuted, marginTop: 3, lineHeight: 1.45 }}>
                            candidates {summary.candidateCount} · decoded {formatBytes(summary.estimatedDecodedBytes)} · types {summary.mimeTypes.join(', ') || 'none'}
                          </div>
                          <div style={{ fontSize: 9.5, color: eligibility.safe ? c.accent : c.textFaint, marginTop: 3, lineHeight: 1.45 }}>{eligibility.reason}</div>
                        </button>
                      );
                    })}
                    {backupSummaries.length > 10 ? (
                      <div style={{ fontSize: 10, color: c.textFaint }}>{backupSummaries.length - 10} more backups hidden in this compact review.</div>
                    ) : null}
                  </div>
                )}

                {selectedBackup && selectedBackupEligibility ? (
                  <div style={{ border: `1px solid ${c.sideBdr}`, borderRadius: 6, padding: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
                    <div style={{ fontSize: 11, fontWeight: 800 }}>Explicit restore</div>
                    <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                      Status: <strong>{selectedBackupEligibility.label}</strong>. {selectedBackupEligibility.reason}
                    </div>
                    <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.45 }}>
                      Type <strong>{selectedRestorePhrase}</strong> to restore this backup. Created attachments, blobs, metadata, and backups are preserved.
                    </div>
                    <input
                      value={restoreConfirmation}
                      onChange={event => setRestoreConfirmation(event.currentTarget.value)}
                      placeholder={selectedRestorePhrase}
                      disabled={!selectedBackupEligibility.safe || restoreBusy}
                      aria-label="Restore confirmation phrase"
                      style={{
                        border: `1px solid ${c.sideBdr}`,
                        borderRadius: 6,
                        padding: '6px 8px',
                        background: c.input,
                        color: c.text,
                        fontSize: 11,
                      }}
                    />
                    <button
                      type="button"
                      className="btbtn"
                      onClick={runRestore}
                      disabled={!restoreCanRun}
                      style={{
                        padding: '6px 9px',
                        fontSize: 11,
                        fontWeight: 800,
                        color: restoreCanRun ? c.accent : c.textFaint,
                        borderColor: restoreCanRun ? `${c.accent}66` : c.sideBdr,
                        alignSelf: 'flex-start',
                      }}
                    >
                      {restoreBusy ? 'Restoring backup...' : 'Restore selected backup'}
                    </button>
                    {restoreReport ? (
                      <div data-attachment-restore-report style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 7, display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 800 }}>Restore result</div>
                        <div style={{ fontSize: 10.5, color: c.textMuted, lineHeight: 1.55 }}>
                          <div>Note: {shortValue(restoreReport.noteId)}</div>
                          <div>Backup: {shortValue(restoreReport.backupKey)}</div>
                          <div>Restored: {restoreReport.restored ? 'yes' : 'no'}</div>
                          <div>Forced: {restoreReport.forced ? 'yes' : 'no'}</div>
                          {restoreReport.previousBodyHash ? <div>Previous body hash: {restoreReport.previousBodyHash}</div> : null}
                          {restoreReport.restoredBodyHash ? <div>Restored body hash: {restoreReport.restoredBodyHash}</div> : null}
                        </div>
                        {restoreReport.warnings.map((warning, index) => (
                          <div key={`${warning}-${index}`} style={{ fontSize: 10, color: c.textMuted }}>{warning}</div>
                        ))}
                        {restoreReport.errors.map((failure, index) => (
                          <div key={`${failure}-${index}`} style={{ fontSize: 10, color: c.danger }}>{failure}</div>
                        ))}
                        <div style={{ fontSize: 10.5, color: c.textMuted }}>Re-run migration scan or cleanup review if you need updated maintenance counts.</div>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {error ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{error}</div>
          ) : null}
          {cleanupError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{cleanupError}</div>
          ) : null}
          {cleanupExecutionError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{cleanupExecutionError}</div>
          ) : null}
          {backupError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{backupError}</div>
          ) : null}
          {restoreError ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{restoreError}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
