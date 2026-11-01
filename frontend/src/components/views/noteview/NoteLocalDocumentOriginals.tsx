import { useLayoutEffect, useRef, useState } from 'react';
import { Download, FileText } from 'lucide-react';
import type { NoteBase as Note } from '../noteUtils';
import type { NoteChromeColors } from '../noteEditorTheme';
import type { NotesAuthorityRequest } from '../../../lib/notesAccountAuthority';
import {
  listPublishedLocalDocumentOriginals,
  readPublishedLocalDocumentOriginal,
  type PublishedLocalDocumentOriginal,
} from '../../../lib/localDocumentAttachments';
import { isCompleteLocalNote } from '../../../lib/notesBootstrapAuthority';
import { observePublishedNotesHydration, useNotesStore } from '../../../store/useNotesStore';
import { createLocalAttachmentMetadataRepository } from '../../../lib/attachmentMetadataIndexedDb';
import { createLocalAttachmentBlobAdapter } from '../../../lib/attachmentBlobIndexedDb';
import { useTranslation } from '../../../lib/i18n';

const metadataRepository = createLocalAttachmentMetadataRepository();
const blobAdapter = createLocalAttachmentBlobAdapter();

interface DocumentSession {
  readonly request: NotesAuthorityRequest;
  readonly note: Note;
  live: boolean;
  busyId: string | null;
  readonly urls: Set<string>;
  readonly revokeTimers: Map<string, number>;
}

interface DocumentView {
  readonly owner: DocumentSession | null;
  readonly documents: readonly PublishedLocalDocumentOriginal[];
  readonly unavailable: boolean;
  readonly busyId: string | null;
  readonly message: string;
}

export interface NoteLocalDocumentOriginalsProps {
  note: Note;
  colors: NoteChromeColors;
}

function isCurrent(session: DocumentSession): boolean {
  const observation = observePublishedNotesHydration();
  const state = useNotesStore.getState();
  return session.live && observation.status === 'CURRENT' && observation.request === session.request
    && state.activeAccountId === session.request.accountId && state.activeNoteId === session.note.id
    && state.notes.filter(item => item.id === session.note.id).length === 1
    && state.notes.find(item => item.id === session.note.id) === session.note
    && session.note.deletedAt === null && isCompleteLocalNote(session.note);
}

function safeDownloadFilename(fileName: string, format: PublishedLocalDocumentOriginal['format']): string {
  const rawStem = fileName.replace(/\.(?:pdf|docx)$/i, '');
  const safeStem = Array.from(rawStem.replace(/[<>:"/\\|?*\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/gu, '_')
    .trim().replace(/[. ]+$/g, '')).slice(0, 120).join('') || 'note-original';
  const portableStem = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safeStem) ? `note-${safeStem}` : safeStem;
  return `${portableStem}.${format}`;
}

function revokeSessionUrls(session: DocumentSession): void {
  for (const timer of session.revokeTimers.values()) window.clearTimeout(timer);
  session.revokeTimers.clear();
  for (const url of session.urls) URL.revokeObjectURL(url);
  session.urls.clear();
}

function formatSize(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${Math.round(size / 102.4) / 10} KB`;
  return `${Math.round(size / 1024 / 102.4) / 10} MB`;
}

export function NoteLocalDocumentOriginals({ note, colors: c }: NoteLocalDocumentOriginalsProps) {
  const { t } = useTranslation();
  const store = useNotesStore();
  const observation = observePublishedNotesHydration();
  const request = observation.status === 'CURRENT' && observation.request.accountId === store.activeAccountId
    && store.activeNoteId === note.id && store.notes.filter(item => item.id === note.id).length === 1
    && store.notes.find(item => item.id === note.id) === note && note.deletedAt === null && isCompleteLocalNote(note)
    ? observation.request : null;
  const sessionRef = useRef<DocumentSession | null>(null);
  const [view, setView] = useState<DocumentView>({
    owner: null, documents: [], unavailable: false, busyId: null, message: '',
  });
  const owns = (session: DocumentSession) => sessionRef.current === session && isCurrent(session);

  useLayoutEffect(() => {
    if (!request) return;
    const session: DocumentSession = { request, note, live: true, busyId: null, urls: new Set(), revokeTimers: new Map() };
    sessionRef.current = session;
    let loading = true;
    const current = () => loading && owns(session);
    setView({ owner: session, documents: [], unavailable: false, busyId: null, message: '' });
    void (async () => {
      try {
        const listed = await listPublishedLocalDocumentOriginals({
          accountId: request.accountId, noteId: note.id, repository: metadataRepository,
        });
        if (!current()) return;
        if (listed.status === 'VERIFIED') {
          if (listed.documents.some(candidate => candidate.request !== request)) {
            setView({ owner: session, documents: [], unavailable: true, busyId: null, message: '' });
          } else {
            setView({ owner: session, documents: listed.documents, unavailable: false, busyId: null, message: '' });
          }
        } else if (listed.status === 'UNAVAILABLE') {
          setView({ owner: session, documents: [], unavailable: true, busyId: null, message: '' });
        }
      } catch {
        if (current()) setView({ owner: session, documents: [], unavailable: true, busyId: null, message: '' });
      } finally { loading = false; }
    })();
    return () => {
      loading = false;
      session.live = false;
      if (sessionRef.current === session) sessionRef.current = null;
      revokeSessionUrls(session);
    };
  }, [note, request]);

  const download = async (session: DocumentSession, candidate: PublishedLocalDocumentOriginal) => {
    if (!owns(session) || session.busyId) return;
    session.busyId = candidate.attachmentId;
    setView(previous => ({ ...previous, busyId: candidate.attachmentId, message: '' }));
    let pendingUrl: string | null = null;
    try {
      const result = await readPublishedLocalDocumentOriginal({
        accountId: session.request.accountId, noteId: session.note.id, candidate,
        repository: metadataRepository, blobAdapter,
      });
      if (!owns(session)) return;
      if (result.status !== 'VERIFIED' || typeof URL.createObjectURL !== 'function') {
        setView(previous => ({ ...previous, message: t('noteLocalDocumentDownloadUnavailable') }));
        return;
      }

      const url = URL.createObjectURL(result.file);
      pendingUrl = url;
      session.urls.add(url);
      if (!owns(session)) {
        session.urls.delete(url);
        URL.revokeObjectURL(url);
        pendingUrl = null;
        return;
      }
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = safeDownloadFilename(result.file.name, candidate.format);
      anchor.rel = 'noopener';
      anchor.style.display = 'none';
      document.body.append(anchor);
      try {
        if (!owns(session)) {
          anchor.remove();
          session.urls.delete(url);
          URL.revokeObjectURL(url);
          return;
        }
        anchor.click();
      } finally { anchor.remove(); }
      const timer = window.setTimeout(() => {
        session.revokeTimers.delete(url);
        session.urls.delete(url);
        URL.revokeObjectURL(url);
      }, 30_000);
      session.revokeTimers.set(url, timer);
      pendingUrl = null;
      if (owns(session)) setView(previous => ({ ...previous, message: t('noteLocalDocumentDownloadStarted') }));
    } catch {
      if (owns(session)) setView(previous => ({ ...previous, message: t('noteLocalDocumentDownloadUnavailable') }));
    } finally {
      if (pendingUrl) {
        session.urls.delete(pendingUrl);
        URL.revokeObjectURL(pendingUrl);
      }
      if (owns(session)) {
        session.busyId = null;
        setView(previous => ({ ...previous, busyId: null }));
      }
    }
  };

  const owner = view.owner;
  const visible = !!request && owner !== null && sessionRef.current === owner
    && owner.request === request && owner.note === note && owns(owner);
  const documents = visible ? view.documents : [];
  if (!visible || (documents.length === 0 && !view.unavailable)) return null;

  return (
    <section
      data-local-document-originals
      aria-label={t('noteLocalDocumentsTitle')}
      style={{ maxWidth: 720, margin: '0 auto 12px', border: `1px solid ${c.sideBdr}`, background: c.card, borderRadius: 10, padding: 10 }}
    >
      {documents.length > 0 ? (
        <details>
          <summary style={{ color: c.text, cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            <FileText size={14} aria-hidden="true" style={{ verticalAlign: 'middle', marginRight: 6 }} />
            {t('noteLocalDocumentsTitle')} ({documents.length})
          </summary>
          <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'grid', gap: 6 }}>
            {documents.map(candidate => (
              <li key={candidate.attachmentId} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span title={candidate.fileName} style={{ color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: '1 1 auto', minWidth: 0 }}>
                  {candidate.fileName}
                </span>
                <span style={{ color: c.textMuted, fontSize: 11, flex: '0 0 auto' }}>{candidate.format.toUpperCase()} · {formatSize(candidate.size)}</span>
                <button
                  type="button"
                  aria-label={`${t('noteLocalDocumentDownload')} ${candidate.fileName}`}
                  disabled={view.busyId !== null}
                  onClick={() => void download(owner, candidate)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: '0 0 auto', color: c.text, background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6, padding: '5px 8px', cursor: view.busyId ? 'wait' : 'pointer' }}
                >
                  <Download size={13} aria-hidden="true" />
                  {view.busyId === candidate.attachmentId ? t('noteLocalDocumentVerifying') : t('noteLocalDocumentDownload')}
                </button>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {view.unavailable ? <p role="status" aria-live="polite" style={{ color: c.textMuted, margin: documents.length ? '8px 0 0' : 0 }}>{t('noteLocalDocumentsUnavailable')}</p> : null}
      {view.message ? <p role="status" aria-live="polite" style={{ color: c.textMuted, margin: '8px 0 0' }}>{view.message}</p> : null}
    </section>
  );
}
