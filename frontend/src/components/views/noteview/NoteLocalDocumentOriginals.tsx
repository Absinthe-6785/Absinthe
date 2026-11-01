import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, FileText, X } from 'lucide-react';
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
import { useModalA11y } from '../../../hooks/useModalA11y';
import {
  clearDocxPreviewDocument,
  DOCX_PREVIEW_IFRAME_SANDBOX,
  DOCX_PREVIEW_SRC_DOC,
  isDocxArchiveWithinLimits,
  renderVerifiedDocxPreview,
} from './docxPreviewIsolation';

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

interface PdfDocumentPreview {
  readonly kind: 'pdf';
  readonly owner: DocumentSession;
  readonly candidate: PublishedLocalDocumentOriginal;
  readonly url: string;
}

interface DocxDocumentPreview {
  readonly kind: 'docx';
  readonly owner: DocumentSession;
  readonly candidate: PublishedLocalDocumentOriginal;
  readonly token: number;
  readonly status: 'loading' | 'ready' | 'failed';
}

type ActiveDocumentPreview = PdfDocumentPreview | DocxDocumentPreview;

interface DocxRenderJob {
  readonly preview: DocxDocumentPreview;
  file: File | null;
  started: boolean;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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

function revokeSessionUrl(session: DocumentSession, url: string): void {
  const timer = session.revokeTimers.get(url);
  if (timer !== undefined) window.clearTimeout(timer);
  session.revokeTimers.delete(url);
  if (session.urls.delete(url) && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
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
  const previewRef = useRef<ActiveDocumentPreview | null>(null);
  const docxRenderJobRef = useRef<DocxRenderJob | null>(null);
  const docxFrameRef = useRef<HTMLIFrameElement | null>(null);
  const previewTokenRef = useRef(0);
  const [view, setView] = useState<DocumentView>({
    owner: null, documents: [], unavailable: false, busyId: null, message: '',
  });
  const [preview, setPreview] = useState<ActiveDocumentPreview | null>(null);
  const previewPanelRef = useRef<HTMLDivElement>(null);
  const previewCloseRef = useRef<HTMLButtonElement>(null);
  const owns = (session: DocumentSession) => sessionRef.current === session && isCurrent(session);
  const publishPreview = (next: ActiveDocumentPreview | null) => {
    previewRef.current = next;
    setPreview(next);
  };
  const previewVisible = !!preview && previewRef.current === preview && owns(preview.owner)
    && (preview.kind === 'docx' || preview.owner.urls.has(preview.url));
  const closePreview = () => {
    const active = previewRef.current;
    if (!active) return;
    publishPreview(null);
    if (active.kind === 'pdf') {
      revokeSessionUrl(active.owner, active.url);
    } else {
      const cancellingRender = docxRenderJobRef.current?.preview === active;
      if (cancellingRender) {
        docxRenderJobRef.current!.file = null;
        docxRenderJobRef.current = null;
      }
      clearDocxPreviewDocument(docxFrameRef.current?.contentDocument);
      docxFrameRef.current = null;
      if (cancellingRender && active.owner.busyId === active.candidate.attachmentId) {
        active.owner.busyId = null;
        if (owns(active.owner)) setView(previous => ({ ...previous, busyId: null }));
      }
    }
  };
  useModalA11y({
    open: previewVisible,
    onClose: closePreview,
    containerRef: previewPanelRef,
    initialFocusRef: previewCloseRef,
  });

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
      if (previewRef.current?.owner === session) {
        previewRef.current = null;
        if (docxRenderJobRef.current) docxRenderJobRef.current.file = null;
        docxRenderJobRef.current = null;
        clearDocxPreviewDocument(docxFrameRef.current?.contentDocument);
        docxFrameRef.current = null;
      }
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

  const previewPdf = async (session: DocumentSession, candidate: PublishedLocalDocumentOriginal) => {
    if (!owns(session) || session.busyId || candidate.format !== 'pdf' || candidate.mimeType !== 'application/pdf') return;
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
        setView(previous => ({ ...previous, message: t('noteLocalDocumentPreviewUnavailable') }));
        return;
      }

      const url = URL.createObjectURL(result.file);
      pendingUrl = url;
      session.urls.add(url);
      if (!owns(session)) {
        revokeSessionUrl(session, url);
        pendingUrl = null;
        return;
      }
      publishPreview({ kind: 'pdf', owner: session, candidate, url });
      pendingUrl = null;
    } catch {
      if (owns(session)) setView(previous => ({ ...previous, message: t('noteLocalDocumentPreviewUnavailable') }));
    } finally {
      if (pendingUrl) revokeSessionUrl(session, pendingUrl);
      if (owns(session)) {
        session.busyId = null;
        setView(previous => ({ ...previous, busyId: null }));
      }
    }
  };

  const previewDocx = async (session: DocumentSession, candidate: PublishedLocalDocumentOriginal) => {
    if (!owns(session) || session.busyId || candidate.format !== 'docx' || candidate.mimeType !== DOCX_MIME) return;
    session.busyId = candidate.attachmentId;
    setView(previous => ({ ...previous, busyId: candidate.attachmentId, message: '' }));
    let rendering = false;
    try {
      const result = await readPublishedLocalDocumentOriginal({
        accountId: session.request.accountId, noteId: session.note.id, candidate,
        repository: metadataRepository, blobAdapter,
      });
      if (!owns(session)) return;
      if (result.status !== 'VERIFIED' || result.file.type !== DOCX_MIME) {
        setView(previous => ({ ...previous, message: t('noteLocalDocumentDocxPreviewUnavailable') }));
        return;
      }
      const archiveWithinLimits = await isDocxArchiveWithinLimits(result.file, () => owns(session));
      if (!owns(session)) return;
      if (!archiveWithinLimits) {
        setView(previous => ({ ...previous, message: t('noteLocalDocumentDocxPreviewUnavailable') }));
        return;
      }

      const next: DocxDocumentPreview = {
        kind: 'docx', owner: session, candidate, token: ++previewTokenRef.current, status: 'loading',
      };
      docxRenderJobRef.current = { preview: next, file: result.file, started: false };
      publishPreview(next);
      rendering = true;
    } catch {
      if (owns(session)) setView(previous => ({ ...previous, message: t('noteLocalDocumentDocxPreviewUnavailable') }));
    } finally {
      if (!rendering && owns(session)) {
        session.busyId = null;
        setView(previous => ({ ...previous, busyId: null }));
      }
    }
  };

  const renderDocxFrame = async (target: DocxDocumentPreview) => {
    const job = docxRenderJobRef.current;
    const frame = docxFrameRef.current;
    if (!job || job.preview !== target || job.started || !job.file || !frame
      || previewRef.current !== target || !owns(target.owner)) return;
    const doc = frame.contentDocument;
    if (!doc) {
      job.file = null;
      docxRenderJobRef.current = null;
      setView(previous => ({ ...previous, message: t('noteLocalDocumentDocxPreviewUnavailable') }));
      publishPreview({ ...target, status: 'failed' });
      target.owner.busyId = null;
      if (owns(target.owner)) setView(previous => ({ ...previous, busyId: null }));
      return;
    }
    job.started = true;
    const isRenderCurrent = () => docxRenderJobRef.current === job
      && previewRef.current === target && owns(target.owner);
    try {
      const rendered = await renderVerifiedDocxPreview(job.file, doc, isRenderCurrent);
      if (!rendered || !isRenderCurrent()) return;
      job.file = null;
      docxRenderJobRef.current = null;
      publishPreview({ ...target, status: 'ready' });
    } catch {
      clearDocxPreviewDocument(doc);
      if (isRenderCurrent()) {
        job.file = null;
        docxRenderJobRef.current = null;
        setView(previous => ({ ...previous, message: t('noteLocalDocumentDocxPreviewUnavailable') }));
        publishPreview({ ...target, status: 'failed' });
      }
    } finally {
      const currentPreview = previewRef.current;
      if (currentPreview?.kind === 'docx' && currentPreview.token === target.token
        && target.owner.busyId === target.candidate.attachmentId) {
        target.owner.busyId = null;
        if (owns(target.owner)) setView(previous => ({ ...previous, busyId: null }));
      }
    }
  };

  const owner = view.owner;
  const visible = !!request && owner !== null && sessionRef.current === owner
    && owner.request === request && owner.note === note && owns(owner);
  const documents = visible ? view.documents : [];
  if (!visible || (documents.length === 0 && !view.unavailable)) return null;

  return (
    <>
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
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flex: '0 0 auto' }}>
                    {candidate.format === 'pdf' ? (
                      <button
                        type="button"
                        aria-label={`${t('noteLocalDocumentPreview')} ${candidate.fileName}`}
                        disabled={view.busyId !== null}
                        onClick={() => void previewPdf(owner, candidate)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.text, background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6, padding: '5px 8px', cursor: view.busyId ? 'wait' : 'pointer' }}
                      >
                        {t('noteLocalDocumentPreview')}
                      </button>
                    ) : candidate.format === 'docx' && candidate.mimeType === DOCX_MIME ? (
                      <button
                        type="button"
                        aria-label={`${t('noteLocalDocumentDocxPreview')} ${candidate.fileName}`}
                        disabled={view.busyId !== null}
                        onClick={() => void previewDocx(owner, candidate)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.text, background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6, padding: '5px 8px', cursor: view.busyId ? 'wait' : 'pointer' }}
                      >
                        {t('noteLocalDocumentDocxPreview')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      aria-label={`${t('noteLocalDocumentDownload')} ${candidate.fileName}`}
                      disabled={view.busyId !== null}
                      onClick={() => void download(owner, candidate)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.text, background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6, padding: '5px 8px', cursor: view.busyId ? 'wait' : 'pointer' }}
                    >
                      <Download size={13} aria-hidden="true" />
                      {view.busyId === candidate.attachmentId ? t('noteLocalDocumentVerifying') : t('noteLocalDocumentDownload')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
        {view.unavailable ? <p role="status" aria-live="polite" style={{ color: c.textMuted, margin: documents.length ? '8px 0 0' : 0 }}>{t('noteLocalDocumentsUnavailable')}</p> : null}
        {view.message ? <p role="status" aria-live="polite" style={{ color: c.textMuted, margin: '8px 0 0' }}>{view.message}</p> : null}
      </section>
      {previewVisible && preview && typeof document !== 'undefined' ? createPortal(
        <div
          role="presentation"
          {...(preview.kind === 'pdf' ? { 'data-pdf-preview-overlay': '' } : { 'data-docx-preview-overlay': '' })}
          onClick={event => { if (event.target === event.currentTarget) closePreview(); }}
          style={{ position: 'fixed', inset: 0, zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, background: 'var(--color-overlay, rgba(0, 0, 0, 0.68))' }}
        >
          <div
            ref={previewPanelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={preview.kind === 'pdf' ? 'note-local-document-preview-title' : 'note-local-document-docx-preview-title'}
            tabIndex={-1}
            {...(preview.kind === 'pdf' ? { 'data-pdf-preview-dialog': '' } : { 'data-docx-preview-dialog': '' })}
            style={{ display: 'flex', flexDirection: 'column', width: 'min(1100px, 100%)', height: 'min(900px, 94vh)', overflow: 'hidden', border: `1px solid ${c.sideBdr}`, borderRadius: 12, background: c.card, color: c.text, boxShadow: '0 20px 70px rgba(0,0,0,.4)' }}
            onClick={event => event.stopPropagation()}
          >
            <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, padding: '8px 12px', borderBottom: `1px solid ${c.sideBdr}` }}>
              <h2
                id={preview.kind === 'pdf' ? 'note-local-document-preview-title' : 'note-local-document-docx-preview-title'}
                style={{ margin: 0, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}
              >
                {preview.kind === 'pdf'
                  ? t('noteLocalDocumentPreviewTitle').replace('{name}', preview.candidate.fileName)
                  : t('noteLocalDocumentDocxPreviewTitle').replace('{name}', preview.candidate.fileName)}
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: '0 0 auto' }}>
                <button
                  type="button"
                  aria-label={`${t('noteLocalDocumentDownload')} ${preview.candidate.fileName}`}
                  disabled={view.busyId !== null}
                  onClick={() => void download(preview.owner, preview.candidate)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: c.text, background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6, padding: '6px 9px', cursor: view.busyId ? 'wait' : 'pointer' }}
                >
                  <Download size={13} aria-hidden="true" />{t('noteLocalDocumentDownload')}
                </button>
              </div>
            </header>
            {preview.kind === 'pdf' ? (
              <iframe
                data-pdf-preview-frame
                src={preview.url}
                title={t('noteLocalDocumentPreviewTitle').replace('{name}', preview.candidate.fileName)}
                tabIndex={0}
                style={{ display: 'block', flex: '1 1 auto', width: '100%', minHeight: 0, border: 0, background: '#444' }}
                onBlur={event => {
                  const nextTarget = event.relatedTarget;
                  if (!(nextTarget instanceof Node) || !previewPanelRef.current?.contains(nextTarget)) {
                    previewCloseRef.current?.focus();
                  }
                }}
              />
            ) : (
              <iframe
                key={preview.token}
                ref={docxFrameRef}
                data-docx-preview-frame
                sandbox={DOCX_PREVIEW_IFRAME_SANDBOX}
                srcDoc={DOCX_PREVIEW_SRC_DOC}
                title={t('noteLocalDocumentDocxPreviewTitle').replace('{name}', preview.candidate.fileName)}
                tabIndex={0}
                style={{ display: 'block', flex: '1 1 auto', width: '100%', minHeight: 0, border: 0, background: '#fff' }}
                onLoad={() => { void renderDocxFrame(preview); }}
                onBlur={event => {
                  const nextTarget = event.relatedTarget;
                  if (!(nextTarget instanceof Node) || !previewPanelRef.current?.contains(nextTarget)) {
                    previewCloseRef.current?.focus();
                  }
                }}
              />
            )}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '7px 12px', borderTop: `1px solid ${c.sideBdr}` }}>
              <div>
                <p style={{ margin: 0, color: c.textMuted, fontSize: 12 }}>
                  {preview.kind === 'pdf' ? t('noteLocalDocumentPreviewFallback') : t('noteLocalDocumentDocxPreviewFallback')}
                </p>
                {preview.kind === 'docx' && preview.status === 'loading' ? (
                  <p role="status" aria-live="polite" style={{ margin: '4px 0 0', color: c.textMuted, fontSize: 12 }}>
                    {t('noteLocalDocumentDocxPreviewRendering')}
                  </p>
                ) : null}
                {view.message ? <p role="status" aria-live="polite" style={{ margin: '4px 0 0', color: c.textMuted, fontSize: 12 }}>{view.message}</p> : null}
              </div>
              <button
                ref={previewCloseRef}
                type="button"
                aria-label={t('close')}
                onClick={closePreview}
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 34, height: 32, flex: '0 0 auto', color: c.text, background: c.input, border: `1px solid ${c.inputBdr}`, borderRadius: 6, cursor: 'pointer' }}
              >
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>, document.body,
      ) : null}
    </>
  );
}
