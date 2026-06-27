import { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type {
  EmbeddedAttachmentAuditReport,
  EmbeddedAttachmentAuditNoteInput,
} from '../../../lib/embeddedAttachmentAudit';
import { auditEmbeddedAttachments } from '../../../lib/embeddedAttachmentAudit';
import {
  migrateEmbeddedDataUrlsToAttachments,
  type EmbeddedAttachmentMigrationReport,
} from '../../../lib/embeddedAttachmentMigration';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';

type MigrationReviewState = 'idle' | 'scanning' | 'ready' | 'migrating' | 'complete' | 'error';

export interface EmbeddedAttachmentMigrationReviewPanelProps {
  notes: readonly Note[];
  colors: NoteChromeColors;
  updateNote: (id: string, patch: Partial<Note>) => void;
  auditFn?: (notes: readonly EmbeddedAttachmentAuditNoteInput[]) => EmbeddedAttachmentAuditReport;
  migrateFn?: typeof migrateEmbeddedDataUrlsToAttachments;
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

export function EmbeddedAttachmentMigrationReviewPanel({
  notes,
  colors: c,
  updateNote,
  auditFn = auditEmbeddedAttachments,
  migrateFn = migrateEmbeddedDataUrlsToAttachments,
}: EmbeddedAttachmentMigrationReviewPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [status, setStatus] = useState<MigrationReviewState>('idle');
  const [auditReport, setAuditReport] = useState<EmbeddedAttachmentAuditReport | null>(null);
  const [migrationReport, setMigrationReport] = useState<EmbeddedAttachmentMigrationReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  const activeNotes = useMemo(() => notes.filter(note => !note.deletedAt), [notes]);
  const notesById = useMemo(() => new Map(notes.map(note => [note.id, note])), [notes]);
  const hasCandidates = (auditReport?.summary.totalEmbeddedPayloads ?? 0) > 0;
  const busy = status === 'scanning' || status === 'migrating';
  const canMigrate = Boolean(auditReport && hasCandidates && !busy);

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

          {error ? (
            <div style={{ fontSize: 10.5, color: c.danger }}>{error}</div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
