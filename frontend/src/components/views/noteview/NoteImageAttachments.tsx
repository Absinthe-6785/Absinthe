import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';
import type { AttachmentMetadata } from '../../../lib/attachmentRepository';
import { createLocalAttachmentBlobAdapter } from '../../../lib/attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from '../../../lib/attachmentMetadataIndexedDb';
import { attachLocalImageToNote } from '../../../lib/localImageAttachments';
import { getActiveNotesAuthorityAccountId } from '../../../lib/notesAccountAuthority';
import {
  isReturnToUseAttachmentIsolationEnabled,
  RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE,
} from '../../../lib/returnToUseAttachmentIsolation';

const metadataRepository = createLocalAttachmentMetadataRepository();
const blobAdapter = createLocalAttachmentBlobAdapter();

interface AttachmentPreview {
  metadata: AttachmentMetadata;
  objectUrl: string | null;
  unavailable: boolean;
}

export interface NoteImageAttachmentsProps {
  note: Note;
  colors: NoteChromeColors;
  readOnly: boolean;
  onUpdateBody: (body: string) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 102.4) / 10} KB`;
  return `${Math.round(bytes / 1024 / 102.4) / 10} MB`;
}

export function NoteImageAttachments({ note, colors: c, readOnly, onUpdateBody }: NoteImageAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const objectUrlsRef = useRef<string[]>([]);
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const attachmentIsolationEnabled = isReturnToUseAttachmentIsolationEnabled();

  const revokeLoadedUrls = useCallback(() => {
    for (const url of objectUrlsRef.current) {
      blobAdapter.revokeObjectUrl?.(url);
    }
    objectUrlsRef.current = [];
  }, []);

  const loadAttachments = useCallback(async () => {
    revokeLoadedUrls();
    const metadata = (await metadataRepository.listAttachmentsForNote(note.id))
      .filter(item => !item.deletedAt && item.mimeType.startsWith('image/'));
    const previews = await Promise.all(metadata.map(async item => {
      const objectUrl = item.localBlobKey ? await blobAdapter.getObjectUrl(item.localBlobKey) : null;
      if (objectUrl) objectUrlsRef.current.push(objectUrl);
      return { metadata: item, objectUrl, unavailable: !objectUrl };
    }));
    setAttachments(previews);
  }, [note.body, note.id, revokeLoadedUrls]);

  useEffect(() => {
    void loadAttachments();
    return revokeLoadedUrls;
  }, [loadAttachments, revokeLoadedUrls]);

  const attachFile = useCallback(async (file: File) => {
    if (isReturnToUseAttachmentIsolationEnabled()) {
      setError(RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE);
      return;
    }
    setBusy(true);
    setError('');
    try {
      const result = await attachLocalImageToNote({
        accountId: getActiveNotesAuthorityAccountId() ?? '',
        noteId: note.id,
        file,
        currentBody: note.body,
        repository: metadataRepository,
        blobAdapter,
      });
      onUpdateBody(result.body);
      await loadAttachments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image attachment failed');
    } finally {
      setBusy(false);
    }
  }, [loadAttachments, note.body, note.id, onUpdateBody]);

  const handleFileChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) void attachFile(file);
  }, [attachFile]);

  const handleRemove = useCallback(async (id: string) => {
    if (isReturnToUseAttachmentIsolationEnabled()) {
      setError(RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE);
      return;
    }
    const deletedAt = new Date().toISOString();
    await metadataRepository.tombstoneAttachment(id, deletedAt);
    await loadAttachments();
  }, [loadAttachments]);

  if (readOnly && attachments.length === 0) return null;

  return (
    <section
      data-local-image-attachments
      style={{
        maxWidth: 720,
        margin: '0 auto 12px',
        border: `1px solid ${c.sideBdr}`,
        background: c.card,
        borderRadius: 10,
        padding: 10,
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: attachments.length > 0 || error ? 8 : 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.textMuted, fontSize: 11, fontWeight: 700 }}>
          <ImageIcon size={13} />
          Images
        </div>
        {!readOnly ? (
          <button
            type="button"
            className="btbtn"
            onClick={() => inputRef.current?.click()}
            disabled={busy || attachmentIsolationEnabled}
            title={attachmentIsolationEnabled ? RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE : 'Attach image'}
            style={{
              minHeight: 30,
              padding: '0 10px',
              border: `1px solid ${c.inputBdr}`,
              borderRadius: 8,
              background: c.input,
              color: c.text,
              fontSize: 11,
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <ImageIcon size={13} />
            {busy ? 'Attaching' : attachmentIsolationEnabled ? 'Attachments disabled' : 'Attach image'}
          </button>
        ) : null}
      </div>
      {!readOnly && attachmentIsolationEnabled ? (
        <div data-return-to-use-attachment-isolation style={{ color: c.textMuted, fontSize: 10.5, lineHeight: 1.45, marginBottom: 8 }}>
          {RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE}
        </div>
      ) : null}
      {error ? (
        <div style={{ color: c.danger, fontSize: 11, marginBottom: 8 }}>{error}</div>
      ) : null}
      {attachments.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
          {attachments.map(({ metadata, objectUrl, unavailable }) => (
            <div
              key={metadata.id}
              style={{
                border: `1px solid ${c.inputBdr}`,
                borderRadius: 8,
                background: c.editor,
                overflow: 'hidden',
                minWidth: 0,
              }}
            >
              {objectUrl ? (
                <img
                  src={objectUrl}
                  alt={metadata.alt ?? metadata.fileName}
                  style={{ display: 'block', width: '100%', height: 120, objectFit: 'cover', background: c.input }}
                />
              ) : (
                <div style={{ height: 120, display: 'grid', placeItems: 'center', color: c.textMuted, fontSize: 11, background: c.input }}>
                  {unavailable ? 'Image unavailable locally' : 'Loading image'}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px' }}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ color: c.text, fontSize: 11, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {metadata.fileName}
                  </div>
                  <div style={{ color: c.textFaint, fontSize: 10 }}>{formatBytes(metadata.size)}</div>
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    className="btbtn"
                    onClick={() => void handleRemove(metadata.id)}
                    disabled={attachmentIsolationEnabled}
                    title={attachmentIsolationEnabled ? RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE : 'Remove image'}
                    style={{ width: 28, height: 28, color: c.textMuted, flexShrink: 0 }}
                  >
                    <X size={13} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </section>
  );
}
