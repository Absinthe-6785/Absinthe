import { useLayoutEffect, useRef, useState, type ChangeEvent } from 'react';
import { Image as ImageIcon, X } from 'lucide-react';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NoteBase as Note } from '../noteUtils';
import { attachmentMetadataAccountId, isAttachmentReference, type AccountScopedAttachmentMetadata } from '../../../lib/attachmentRepository';
import { createLocalAttachmentBlobAdapter } from '../../../lib/attachmentBlobIndexedDb';
import { createLocalAttachmentMetadataRepository } from '../../../lib/attachmentMetadataIndexedDb';
import { localAttachmentBlobKey } from '../../../lib/localImageAttachments';
import type { NotesAuthorityRequest } from '../../../lib/notesAccountAuthority';
import { observePublishedNotesHydration, useNotesStore } from '../../../store/useNotesStore';
import {
  isReturnToUseAttachmentIsolationEnabled,
  RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE,
} from '../../../lib/returnToUseAttachmentIsolation';

const metadataRepository = createLocalAttachmentMetadataRepository();
const blobAdapter = createLocalAttachmentBlobAdapter();

interface AttachmentPreview {
  metadata: AccountScopedAttachmentMetadata;
  objectUrl: string | null;
  unavailable: boolean;
}

interface AttachmentSession {
  request: NotesAuthorityRequest;
  note: Note;
  live: boolean;
  urls: Set<string>;
  busy: boolean;
  uncertain: boolean;
}

const UPLOAD_UNAVAILABLE = 'Image upload is unavailable until account-scoped write safety is verified.';

function isCurrent(session: AttachmentSession): boolean {
  const observation = observePublishedNotesHydration();
  return session.live && observation.status === 'CURRENT' && observation.request === session.request
    && !session.note.deletedAt && useNotesStore.getState().notes.includes(session.note);
}

function isScopedLocalImage(item: AccountScopedAttachmentMetadata, session: AttachmentSession): boolean {
  return attachmentMetadataAccountId(item) === session.request.accountId && item.accountId === session.request.accountId
    && item.noteId === session.note.id && !item.deletedAt && item.mimeType.startsWith('image/')
    && item.source === 'local' && isAttachmentReference(`attachment://${item.id}`)
    && item.localBlobKey === localAttachmentBlobKey(session.request.accountId, item.id);
}

function revokeSessionUrls(session: AttachmentSession): void {
  for (const url of session.urls) blobAdapter.revokeObjectUrl?.(url);
  session.urls.clear();
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

export function NoteImageAttachments({ note, colors: c, readOnly }: NoteImageAttachmentsProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const sessionRef = useRef<AttachmentSession | null>(null);
  const [reload, setReload] = useState(0);
  const [view, setView] = useState<{ owner: AttachmentSession | null; previews: AttachmentPreview[]; error: string }>({
    owner: null, previews: [], error: '',
  });
  // A Store publication, not a matching noteId, owns this exact displayed Note.
  const store = useNotesStore();
  const observation = observePublishedNotesHydration();
  const request = observation.status === 'CURRENT' && store.notes.includes(note) && !note.deletedAt
    ? observation.request : null;
  const attachmentIsolationEnabled = isReturnToUseAttachmentIsolationEnabled();
  const owns = (owner: AttachmentSession): boolean => sessionRef.current === owner && isCurrent(owner);

  useLayoutEffect(() => {
    if (!request) return;
    const owner: AttachmentSession = { request, note, live: true, urls: new Set(), busy: false, uncertain: false };
    sessionRef.current = owner;
    let loading = true;
    const current = () => loading && sessionRef.current === owner && isCurrent(owner);
    setView({ owner, previews: [], error: '' });
    void (async () => {
      try {
        if (!current() || !metadataRepository.listAttachmentsForAccountNote) return;
        const records = await metadataRepository.listAttachmentsForAccountNote(request.accountId, note.id);
        if (!current()) return;
        const metadata = records.filter(item => isScopedLocalImage(item, owner));
        const previews = await Promise.all(metadata.map(async item => {
          if (!current()) return null;
          const objectUrl = await blobAdapter.getObjectUrl(item.localBlobKey!);
          if (!current()) {
            if (objectUrl) blobAdapter.revokeObjectUrl?.(objectUrl);
            return null;
          }
          if (objectUrl) owner.urls.add(objectUrl);
          return { metadata: item, objectUrl, unavailable: !objectUrl };
        }));
        if (current()) setView({ owner, previews: previews.filter((item): item is AttachmentPreview => item !== null), error: '' });
        else revokeSessionUrls(owner);
      } catch {
        revokeSessionUrls(owner);
        if (current()) {
          setView({ owner, previews: [], error: 'Image attachments could not be loaded.' });
        }
      } finally { loading = false; }
    })();
    return () => {
      loading = false;
      owner.live = false;
      if (sessionRef.current === owner) sessionRef.current = null;
      revokeSessionUrls(owner);
    };
  }, [note, request, reload]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    event.target.value = '';
    const owner = sessionRef.current;
    // The existing upload helper has unguarded async writes. Never invoke it here.
    if (!readOnly && owner && owns(owner)) setView(previous => ({ ...previous, owner,
      error: isReturnToUseAttachmentIsolationEnabled() ? RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE : UPLOAD_UNAVAILABLE,
    }));
  };

  const handleRemove = async (owner: AttachmentSession, metadata: AccountScopedAttachmentMetadata) => {
    if (readOnly || !owns(owner) || owner.busy || owner.uncertain || !isScopedLocalImage(metadata, owner)) return;
    if (isReturnToUseAttachmentIsolationEnabled()) {
      setView(previous => ({ ...previous, error: RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE }));
      return;
    }
    if (!metadataRepository.tombstoneAttachmentForAccountNote) return;
    owner.busy = true;
    setView(previous => ({ ...previous, error: '' }));
    try {
      const result = await metadataRepository.tombstoneAttachmentForAccountNote({
        accountId: owner.request.accountId, noteId: owner.note.id, request: owner.request, expected: metadata,
        isCurrent: () => owns(owner) && !isReturnToUseAttachmentIsolationEnabled(),
      });
      if (!owns(owner)) return;
      owner.busy = false;
      if (result.status === 'TOMBSTONED') {
        revokeSessionUrls(owner);
        setView({ owner, previews: [], error: '' });
        setReload(value => value + 1);
      } else {
        owner.uncertain = result.status === 'INDETERMINATE';
        setView(previous => ({ ...previous, error: owner.uncertain
          ? 'Image removal outcome is uncertain. Do not retry automatically.' : 'Image removal was not completed.' }));
      }
    } catch {
      if (!owns(owner)) return;
      owner.busy = false;
      owner.uncertain = true;
      setView(previous => ({ ...previous, error: 'Image removal outcome is uncertain. Do not retry automatically.' }));
    }
  };

  const visible = view.owner !== null && view.owner.note === note && view.owner.request === request && owns(view.owner);
  const attachments = visible ? view.previews : [];
  const error = visible ? view.error : '';
  const busy = visible && view.owner?.busy;
  if (!request) return null;

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
            disabled
            title={attachmentIsolationEnabled ? RETURN_TO_USE_ATTACHMENT_ISOLATION_MESSAGE : UPLOAD_UNAVAILABLE}
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
        <div className="be-attachment-isolation-sr" aria-live="polite">
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
                    onClick={() => { if (view.owner) void handleRemove(view.owner, metadata); }}
                    disabled={attachmentIsolationEnabled || !!busy || !!view.owner?.uncertain}
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
