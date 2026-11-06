import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation, type TranslationKey } from '../../../../lib/i18n';
import { isCompleteLocalNote, type NotesSupportedContentDifferenceField } from '../../../../lib/notesBootstrapAuthority';
import { openNote } from '../../../../lib/noteNavigation';
import { observePublishedNotesHydration, useNotesStore } from '../../../../store/useNotesStore';
import { createNotesCloudComparison, type NotesCloudComparison, type NotesCloudComparisonReport } from '../../../../lib/notesCloudComparison';
import { NotesBootstrapDiagnosticError } from '../../../../lib/notesBootstrapDiagnostics';
import { createNotesCloudCopy, notesCloudCopyUiEnabled, prepareNotesCloudCopy, readNotesCloudCopyStatus, type NotesCloudCopyReadbackStatus } from '../../../../lib/notesCloudCopy';
import type { NotesCloudCopyLocalPreflightResult } from '../../../../lib/notesCloudCopyLocalPreflight';

const DETAIL_PREVIEW_LIMIT = 30;
const REMOTE_NOTE_PREVIEW_LIMIT = 12_000;
const DIVERGENT_TITLE_PREVIEW_LIMIT = 512;
const detailSections = [
  { key: 'localOnly', label: 'notesCloudLocalOnly', canOpenLocal: true },
  { key: 'remoteOnly', label: 'notesCloudRemoteOnly', canOpenLocal: false },
  { key: 'divergent', label: 'notesCloudDivergent', canOpenLocal: true },
  { key: 'incomparable', label: 'notesCloudIncomparable', canOpenLocal: true },
  { key: 'deleted', label: 'notesCloudDeleted', canOpenLocal: false },
] as const;
const statusLabels: Record<NotesCloudCopyReadbackStatus, TranslationKey> = {
  RESERVED: 'notesCloudCopyStatusReserved',
  LIVE: 'notesCloudCopyStatusLive',
  RETIRED: 'notesCloudCopyStatusRetired',
  INDETERMINATE: 'notesCloudCopyStatusIndeterminate',
  UNAVAILABLE: 'notesCloudCopyStatusUnavailable',
};
const divergentFieldLabels: Record<NotesSupportedContentDifferenceField, TranslationKey> = {
  title: 'notesCloudDifferenceTitle',
  body: 'notesCloudDifferenceBody',
  folder: 'notesCloudDifferenceFolder',
  starred: 'notesCloudDifferenceStarred',
  properties: 'notesCloudDifferenceProperties',
  relations: 'notesCloudDifferenceRelations',
};

function boundedPreviewText(value: string, limit: number) {
  let text = value.slice(0, limit);
  const partial = value.length > limit;
  if (partial && /[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
  return { text, partial };
}

function eligibleLocalNote(notes: ReturnType<typeof useNotesStore.getState>['notes'], noteId: string) {
  const note = notes.find(candidate => candidate.id === noteId);
  return note && note.id === noteId && note.deletedAt === null && isCompleteLocalNote(note) ? note : null;
}

export function NotesCloudComparisonPanel({ accountId }: { accountId: string | null }) {
  const { t } = useTranslation();
  // Publication-only invalidation may leave both array identities unchanged.
  const { notes, folders } = useNotesStore(state => state);
  const account = useRef({ id: accountId, generation: 0 });
  if (account.current.id !== accountId) account.current = { id: accountId, generation: account.current.generation + 1 };
  const active = useRef<NotesCloudComparison | null>(null);
  const [busy, setBusy] = useState(false);
  const [copyBusy, setCopyBusy] = useState(false);
  const [statusBusy, setStatusBusy] = useState<{ owner: NotesCloudComparison; localNoteId: string } | null>(null);
  const [statusResult, setStatusResult] = useState<{ owner: NotesCloudComparison; localNoteId: string; status: NotesCloudCopyReadbackStatus } | null>(null);
  const statusRequest = useRef<symbol | null>(null);
  const [error, setError] = useState<TranslationKey | null>(null);
  const [copyFeedback, setCopyFeedback] = useState<TranslationKey | null>(null);
  const [copyCandidate, setCopyCandidate] = useState<{
    owner: NotesCloudComparison;
    localNoteId: string;
    preview: Extract<NotesCloudCopyLocalPreflightResult, { status: 'ELIGIBLE_PREVIEW_ONLY' }>;
  } | null>(null);
  const [result, setResult] = useState<{ owner: NotesCloudComparison; report: NotesCloudComparisonReport } | null>(null);
  const [remotePreview, setRemotePreview] = useState<{
    owner: NotesCloudComparison;
    id: string;
    title?: string;
    body: string;
    partial: boolean;
  } | null>(null);
  const [divergentPreview, setDivergentPreview] = useState<{
    owner: NotesCloudComparison;
    id: string;
    localTitle: string;
    localTitlePartial: boolean;
    localBody: string;
    localPartial: boolean;
    cloudTitle: string;
    cloudTitlePartial: boolean;
    cloudBody: string;
    cloudPartial: boolean;
    differingFields: readonly NotesSupportedContentDifferenceField[];
  } | null>(null);
  const [remotePreviewFeedback, setRemotePreviewFeedback] = useState<TranslationKey | null>(null);
  const observation = observePublishedNotesHydration();
  const ready = !!accountId && observation.status === 'CURRENT' && observation.request.accountId === accountId;
  useLayoutEffect(() => {
    active.current?.cancel(); active.current = null;
    statusRequest.current = null;
    setBusy(false); setCopyBusy(false); setStatusBusy(null); setStatusResult(null);
    setResult(null); setError(null); setCopyFeedback(null); setCopyCandidate(null);
    setRemotePreview(null); setDivergentPreview(null); setRemotePreviewFeedback(null);
    return () => { active.current?.cancel(); active.current = null; };
  }, [accountId, notes, folders, ready]);
  const visible = result && result.owner === active.current && result.owner.isCurrent() ? result.report : null;
  const visibleRemotePreview = remotePreview && visible && result?.owner === remotePreview.owner
    && active.current === remotePreview.owner && remotePreview.owner.isCurrent() ? remotePreview : null;
  const visibleDivergentPreview = divergentPreview && visible && result?.owner === divergentPreview.owner
    && active.current === divergentPreview.owner && divergentPreview.owner.isCurrent() ? divergentPreview : null;
  useLayoutEffect(() => {
    if (remotePreview && (!visible || result?.owner !== remotePreview.owner || active.current !== remotePreview.owner)) {
      const staleOwner = result?.owner === remotePreview.owner && active.current === remotePreview.owner;
      remotePreview.owner.cancel();
      setRemotePreview(null);
      if (staleOwner) setRemotePreviewFeedback('notesCloudPreviewStale');
    }
  }, [remotePreview, result, visible]);
  useLayoutEffect(() => {
    if (divergentPreview && (!visible || result?.owner !== divergentPreview.owner || active.current !== divergentPreview.owner)) {
      const staleOwner = result?.owner === divergentPreview.owner && active.current === divergentPreview.owner;
      divergentPreview.owner.cancel();
      setDivergentPreview(null);
      if (staleOwner) setRemotePreviewFeedback('notesCloudPreviewStale');
    }
  }, [divergentPreview, result, visible]);
  const check = async () => {
    if (busy) return;
    statusRequest.current = null; setStatusBusy(null); setStatusResult(null);
    active.current?.cancel(); setResult(null); setError(null); setRemotePreview(null); setDivergentPreview(null); setRemotePreviewFeedback(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setError('notesCloudOffline'); return; }
    const context = account.current;
    let owner: NotesCloudComparison | null = null;
    try {
      owner = createNotesCloudComparison(accountId, () => account.current === context);
      active.current = owner;
      owner.subscribeInvalidation(() => {
        if (active.current !== owner) return;
        active.current = null;
        setBusy(false); setResult(null); setRemotePreview(null); setDivergentPreview(null); setRemotePreviewFeedback(null);
        setError('notesCloudStale');
      });
      setBusy(true);
      const report = await owner.compare();
      if (active.current === owner && owner.isCurrent()) setResult({ owner, report });
    } catch (failure) {
      if (account.current === context && (!owner || active.current === owner)) {
        const incomplete = failure instanceof NotesBootstrapDiagnosticError && failure.reasonCode.startsWith('SNAPSHOT_');
        const limited = failure instanceof Error && failure.message === 'notes_comparison_limit';
        setError(owner && !owner.isCurrent() ? 'notesCloudStale' : incomplete || limited ? 'notesCloudIncomplete' : owner ? 'notesCloudUnavailable' : 'notesCloudSourceUnavailable');
      }
    } finally { if (!owner || active.current === owner) setBusy(false); }
  };
  const cancel = () => {
    statusRequest.current = null;
    active.current?.cancel(); active.current = null; setBusy(false); setCopyBusy(false);
    setStatusBusy(null); setStatusResult(null); setResult(null); setCopyCandidate(null); setCopyFeedback(null); setError('notesCloudStale');
    setRemotePreview(null); setDivergentPreview(null); setRemotePreviewFeedback(null);
  };
  const previewCloudOnlyNote = (owner: NotesCloudComparison, noteId: string) => {
    setRemotePreview(null); setDivergentPreview(null); setRemotePreviewFeedback(null);
    const currentPublication = observePublishedNotesHydration();
    const currentState = useNotesStore.getState();
    const current = result?.owner === owner && active.current === owner && account.current.id === accountId
      && currentState.activeAccountId === accountId && currentPublication.status === 'CURRENT'
      && currentPublication.request.accountId === accountId && owner.isCurrent();
    if (!current) { setRemotePreviewFeedback('notesCloudPreviewStale'); return; }
    const remoteNote = owner.getRemoteOnlyNote(noteId);
    if (!remoteNote) {
      setRemotePreviewFeedback(owner.isCurrent() ? 'notesCloudPreviewUnavailable' : 'notesCloudPreviewStale');
      return;
    }
    const body = boundedPreviewText(remoteNote.body, REMOTE_NOTE_PREVIEW_LIMIT);
    setRemotePreview({ owner, id: remoteNote.id, title: remoteNote.title, body: body.text, partial: body.partial });
  };
  const previewDivergentNote = (owner: NotesCloudComparison, noteId: string) => {
    setDivergentPreview(null); setRemotePreviewFeedback(null);
    const currentPublication = observePublishedNotesHydration();
    const currentState = useNotesStore.getState();
    const current = result?.owner === owner && active.current === owner && account.current.id === accountId
      && currentState.activeAccountId === accountId && currentPublication.status === 'CURRENT'
      && currentPublication.request.accountId === accountId && owner.isCurrent();
    if (!current) { setRemotePreviewFeedback('notesCloudPreviewStale'); return; }
    const pair = owner.getDivergentNotePair(noteId);
    if (!pair) {
      setRemotePreviewFeedback(owner.isCurrent() ? 'notesCloudDivergentUnavailable' : 'notesCloudPreviewStale');
      return;
    }
    const localTitle = boundedPreviewText(pair.local.title, DIVERGENT_TITLE_PREVIEW_LIMIT);
    const localBody = boundedPreviewText(pair.local.body, REMOTE_NOTE_PREVIEW_LIMIT);
    const cloudTitle = boundedPreviewText(pair.cloud.title, DIVERGENT_TITLE_PREVIEW_LIMIT);
    const cloudBody = boundedPreviewText(pair.cloud.body, REMOTE_NOTE_PREVIEW_LIMIT);
    setDivergentPreview({
      owner,
      id: pair.id,
      localTitle: localTitle.text,
      localTitlePartial: localTitle.partial,
      localBody: localBody.text,
      localPartial: localBody.partial,
      cloudTitle: cloudTitle.text,
      cloudTitlePartial: cloudTitle.partial,
      cloudBody: cloudBody.text,
      cloudPartial: cloudBody.partial,
      differingFields: pair.differingFields,
    });
  };
  const button = 'border rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
  const copyOwnerIsCurrent = (owner: NotesCloudComparison, localNoteId: string): boolean => {
    const currentPublication = observePublishedNotesHydration();
    const currentState = useNotesStore.getState();
    return result?.owner === owner && active.current === owner && account.current.id === accountId
      && currentState.activeAccountId === accountId && currentPublication.status === 'CURRENT'
      && currentPublication.request.accountId === accountId && owner.isCurrent()
      && !!eligibleLocalNote(currentState.notes, localNoteId);
  };
  const statusOwnerIsCurrent = (owner: NotesCloudComparison, localNoteId: string): boolean => {
    const currentPublication = observePublishedNotesHydration();
    const currentState = useNotesStore.getState();
    const report = result?.owner === owner ? result.report : null;
    const localSideHasIdentity = report && (['localOnly', 'divergent', 'incomparable', 'deleted'] as const)
      .some(key => report.details[key].some(detail => detail.id === localNoteId));
    return !!localSideHasIdentity && result?.owner === owner && active.current === owner
      && account.current.id === accountId && currentState.activeAccountId === accountId
      && currentPublication.status === 'CURRENT' && currentPublication.request.accountId === accountId
      && owner.isCurrent() && currentState.notes.some(note => note.id === localNoteId);
  };
  const checkCloudCopyStatus = async (owner: NotesCloudComparison, localNoteId: string) => {
    if (statusRequest.current || !statusOwnerIsCurrent(owner, localNoteId)) return;
    const requestId = Symbol('cloud-copy-status');
    statusRequest.current = requestId;
    setStatusResult(null); setStatusBusy({ owner, localNoteId });
    try {
      const outcome = await readNotesCloudCopyStatus(
        localNoteId, accountId ?? '', () => statusOwnerIsCurrent(owner, localNoteId),
      );
      if (statusRequest.current !== requestId || outcome.status === 'STALE_RESULT'
        || !statusOwnerIsCurrent(owner, localNoteId)) return;
      setStatusResult({ owner, localNoteId, status: outcome.status });
    } catch {
      if (statusRequest.current === requestId && statusOwnerIsCurrent(owner, localNoteId)) {
        setStatusResult({ owner, localNoteId, status: 'UNAVAILABLE' });
      }
    } finally {
      if (statusRequest.current === requestId) {
        statusRequest.current = null;
        setStatusBusy(null);
      }
    }
  };
  const beginCloudCopy = async (owner: NotesCloudComparison, localNoteId: string) => {
    if (copyBusy || !copyOwnerIsCurrent(owner, localNoteId)) { setCopyFeedback('notesCloudCopySourceChanged'); return; }
    setCopyFeedback(null); setCopyCandidate(null);
    try {
      const preview = await prepareNotesCloudCopy(localNoteId);
      if (!copyOwnerIsCurrent(owner, localNoteId)) { setCopyFeedback('notesCloudCopySourceChanged'); return; }
      if (preview.status !== 'ELIGIBLE_PREVIEW_ONLY' || !await preview.isCurrent()) {
        setCopyFeedback('notesCloudCopyIneligible'); return;
      }
      setCopyCandidate({ owner, localNoteId, preview });
    } catch { setCopyFeedback('notesCloudCopyIneligible'); }
  };
  const confirmCloudCopy = async (candidate: NonNullable<typeof copyCandidate>) => {
    if (copyBusy || !copyOwnerIsCurrent(candidate.owner, candidate.localNoteId)) {
      setCopyCandidate(null); setCopyFeedback('notesCloudCopySourceChanged'); return;
    }
    setCopyBusy(true); setCopyFeedback(null);
    try {
      const outcome = await createNotesCloudCopy(
        candidate.localNoteId, accountId ?? '', candidate.preview,
        () => copyOwnerIsCurrent(candidate.owner, candidate.localNoteId),
      );
      if (outcome.status === 'STALE_RESULT') { setCopyCandidate(null); return; }
      const feedback: Partial<Record<typeof outcome.status, TranslationKey>> = {
        CREATED: 'notesCloudCopyCreated', ALREADY_COPIED: 'notesCloudCopyAlready',
        DISABLED: 'notesCloudCopyDisabled', SOURCE_CHANGED: 'notesCloudCopySourceChanged',
        INELIGIBLE: 'notesCloudCopyIneligible', CONFLICT: 'notesCloudCopyConflict',
        INDETERMINATE: 'notesCloudCopyIndeterminate', UNAVAILABLE: 'notesCloudCopyUnavailable',
      };
      setCopyFeedback(feedback[outcome.status] ?? 'notesCloudCopyUnavailable');
      setCopyCandidate(null);
      if (outcome.status === 'CREATED' || outcome.status === 'ALREADY_COPIED') {
        candidate.owner.cancel();
        if (active.current === candidate.owner) active.current = null;
        setResult(null); // The comparison predates the explicit remote write.
      }
    } catch { setCopyCandidate(null); setCopyFeedback('notesCloudCopyUnavailable'); }
    finally { setCopyBusy(false); }
  };
  return <section className="border border-border rounded-2xl bg-surface p-4 mt-4 space-y-3" aria-labelledby="notes-cloud-comparison-heading">
    <h3 id="notes-cloud-comparison-heading" className="font-bold">{t('notesCloudTitle')}</h3>
    <p className="text-sm text-muted-foreground">{t('notesCloudScope')}</p>
    <p className="text-sm text-muted-foreground">{t('notesCloudLimit')}</p>
    {!ready ? <p role="status">{t(accountId ? 'notesCloudSourceUnavailable' : 'notesCloudSignIn')}</p> : null}
    <button type="button" className={button} disabled={!ready || busy} onClick={() => { void check(); }}>{t(busy ? 'notesCloudChecking' : 'notesCloudCheck')}</button>
    {busy || visible ? <button type="button" className={`${button} ml-2`} onClick={cancel}>{t('cancel')}</button> : null}
    {visible ? <div role="status" className="space-y-2 text-sm">
      <p>{t('notesCloudObserved')}</p>
      <dl className="grid grid-cols-2 gap-2">
        {(['localOnly', 'remoteOnly', 'matching', 'divergent', 'incomparable', 'deleted'] as const).map(key => <div key={key}><dt>{t(({ localOnly: 'notesCloudLocalOnly', remoteOnly: 'notesCloudRemoteOnly', matching: 'notesCloudMatching', divergent: 'notesCloudDivergent', incomparable: 'notesCloudIncomparable', deleted: 'notesCloudDeleted' } as const)[key])}</dt><dd className="font-semibold">{visible[key]}</dd></div>)}
      </dl>
      <p>{t('notesCloudFolders').replace('{local}', String(visible.localFoldersOnly)).replace('{remote}', String(visible.remoteFoldersOnly)).replace('{different}', String(visible.folderDifferences)).replace('{unresolved}', String(visible.unresolvedFolders))}</p>
      <div className="space-y-2">
        {detailSections.map(({ key, label, canOpenLocal }) => {
          const details = visible.details[key];
          if (details.length === 0) return null;
          const renderRows = (rows: typeof details) => <ul className="mt-2 list-disc space-y-2 pl-5">
            {rows.map(detail => <li key={detail.id} className="break-words">
              <code className="break-all">{detail.id}</code>
              {detail.localTitle ? <p><span className="text-muted-foreground">{t('notesCloudLocalTitle')}: </span>{detail.localTitle}</p> : null}
              {detail.remoteTitle ? <p><span className="text-muted-foreground">{t('notesCloudRemoteTitle')}: </span>{detail.remoteTitle}</p> : null}
              {key === 'remoteOnly' && result?.owner === active.current ? <button
                type="button"
                className={`${button} mt-1 px-3 py-1`}
                aria-label={`${t('notesCloudPreviewAction')} ${detail.id}`}
                onClick={() => previewCloudOnlyNote(result.owner, detail.id)}
              >{t('notesCloudPreviewAction')}</button> : null}
              {key === 'divergent' && result?.owner === active.current ? <button
                type="button"
                className={`${button} mt-1 px-3 py-1`}
                aria-label={`${t('notesCloudDivergentAction')} ${detail.id}`}
                onClick={() => previewDivergentNote(result.owner, detail.id)}
              >{t('notesCloudDivergentAction')}</button> : null}
              {canOpenLocal && eligibleLocalNote(notes, detail.id) ? <button
                type="button"
                className={`${button} mt-1 px-3 py-1`}
                onClick={() => {
                  const currentOwner = result?.owner;
                  const currentPublication = observePublishedNotesHydration();
                  const currentState = useNotesStore.getState();
                  if (!currentOwner || currentOwner !== active.current || account.current.id !== accountId
                    || !currentOwner.isCurrent() || currentPublication.status !== 'CURRENT'
                    || currentPublication.request.accountId !== accountId || currentState.activeAccountId !== accountId) return;
                  const localNote = eligibleLocalNote(currentState.notes, detail.id);
                  if (!localNote || !currentOwner.isCurrent()) return;
                  openNote(localNote.id, { returnTab: 'settings' });
                }}
              >{t('cosmosPreviewOpenNote')}</button> : null}
              {key === 'localOnly' && notesCloudCopyUiEnabled(accountId) && eligibleLocalNote(notes, detail.id) && result?.owner === active.current ? <div className="mt-2 space-y-2">
                {copyCandidate?.owner === result.owner && copyCandidate.localNoteId === detail.id ? <div role="group" aria-label={t('notesCloudCopyConfirmAction')} className="space-y-2">
                  <p className="text-sm text-muted-foreground">{t('notesCloudCopyPrompt')}</p>
                  <button type="button" className={`${button} px-3 py-1`} disabled={copyBusy}
                    onClick={() => { void confirmCloudCopy(copyCandidate); }}>{t(copyBusy ? 'notesCloudCopyWorking' : 'notesCloudCopyConfirmAction')}</button>
                  <button type="button" className={`${button} ml-2 px-3 py-1`} disabled={copyBusy}
                    onClick={() => { setCopyCandidate(null); setCopyFeedback(null); }}>{t('cancel')}</button>
                </div> : <button type="button" className={`${button} mt-1 px-3 py-1`}
                  disabled={copyBusy} onClick={() => { void beginCloudCopy(result.owner, detail.id); }}>
                  {t(copyBusy ? 'notesCloudCopyWorking' : 'notesCloudCopyAction')}
                </button>}
              </div> : null}
              {key !== 'remoteOnly' && notesCloudCopyUiEnabled(accountId)
                && notes.some(note => note.id === detail.id) && result?.owner === active.current ? <div className="mt-2 space-y-1">
                  <button type="button" className={`${button} px-3 py-1`}
                    disabled={!!statusBusy}
                    onClick={() => { void checkCloudCopyStatus(result.owner, detail.id); }}>
                    {statusBusy?.owner === result.owner && statusBusy.localNoteId === detail.id
                      ? t('notesCloudCopyStatusWorking') : t('notesCloudCopyStatusAction')}
                  </button>
                  {statusResult?.owner === result.owner && statusResult.localNoteId === detail.id
                    ? <p role="status" aria-live="polite">{t(statusLabels[statusResult.status])}</p> : null}
                </div> : null}
            </li>)}
          </ul>;
          return <details key={key} className="rounded-lg border border-border px-3 py-2">
            <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t(label)} ({details.length})</summary>
            {renderRows(details.slice(0, DETAIL_PREVIEW_LIMIT))}
            {details.length > DETAIL_PREVIEW_LIMIT ? <details className="ml-4 mt-2 rounded-lg border border-border px-3 py-2">
              <summary className="cursor-pointer rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">{t('notesCloudShowMore').replace('{count}', String(details.length - DETAIL_PREVIEW_LIMIT))}</summary>
              {renderRows(details.slice(DETAIL_PREVIEW_LIMIT))}
            </details> : null}
          </details>;
        })}
      </div>
      {visibleRemotePreview ? <section data-remote-note-preview aria-labelledby="notes-cloud-remote-preview-heading" className="rounded-lg border border-border p-3 space-y-2">
        <h4 id="notes-cloud-remote-preview-heading" className="font-semibold">{t('notesCloudPreviewHeading')}</h4>
        <p className="text-sm text-muted-foreground">{t('notesCloudPreviewSource')}</p>
        <code className="break-all">{visibleRemotePreview.id}</code>
        {visibleRemotePreview.title ? <p><span className="text-muted-foreground">{t('notesCloudRemoteTitle')}: </span>{visibleRemotePreview.title}</p> : null}
        <p className="text-sm text-muted-foreground">{t('notesCloudPreviewAttachmentWarning')}</p>
        {visibleRemotePreview.partial ? <p role="status" aria-live="polite" data-remote-note-preview-partial="true">{t('notesCloudPreviewPartial')}</p> : null}
        <pre dir="auto" className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">{visibleRemotePreview.body}</pre>
        <button type="button" className={`${button} px-3 py-1`} onClick={() => setRemotePreview(null)}>{t('cancel')}</button>
      </section> : null}
      {visibleDivergentPreview ? <section data-divergent-note-preview aria-labelledby="notes-cloud-divergent-preview-heading" className="rounded-lg border border-border p-3 space-y-3">
        <h4 id="notes-cloud-divergent-preview-heading" className="font-semibold">{t('notesCloudDivergentHeading')}</h4>
        <p className="text-sm text-muted-foreground">{t('notesCloudDivergentSource')}</p>
        <p className="text-sm text-muted-foreground">{t('notesCloudDivergentScope')}</p>
        <code className="break-all">{visibleDivergentPreview.id}</code>
        <div>
          <p className="text-sm font-semibold">{t('notesCloudDivergentFields')}</p>
          <ul className="list-disc pl-5 text-sm">
            {visibleDivergentPreview.differingFields.map(field => <li key={field}>{t(divergentFieldLabels[field])}</li>)}
          </ul>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <article aria-labelledby="notes-cloud-divergent-local-heading" className="min-w-0 rounded-md border border-border p-3 space-y-2">
            <h5 id="notes-cloud-divergent-local-heading" className="font-semibold">{t('notesCloudDivergentLocal')}</h5>
            <p className="break-words"><span className="text-muted-foreground">{t('notesCloudLocalTitle')}: </span>{visibleDivergentPreview.localTitle}</p>
            {visibleDivergentPreview.localTitlePartial ? <p role="status" aria-live="polite">{t('notesCloudPreviewPartial')}</p> : null}
            {visibleDivergentPreview.localPartial ? <p role="status" aria-live="polite">{t('notesCloudPreviewPartial')}</p> : null}
            <pre dir="auto" className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">{visibleDivergentPreview.localBody}</pre>
          </article>
          <article aria-labelledby="notes-cloud-divergent-cloud-heading" className="min-w-0 rounded-md border border-border p-3 space-y-2">
            <h5 id="notes-cloud-divergent-cloud-heading" className="font-semibold">{t('notesCloudDivergentCloud')}</h5>
            <p className="break-words"><span className="text-muted-foreground">{t('notesCloudRemoteTitle')}: </span>{visibleDivergentPreview.cloudTitle}</p>
            {visibleDivergentPreview.cloudTitlePartial ? <p role="status" aria-live="polite">{t('notesCloudPreviewPartial')}</p> : null}
            {visibleDivergentPreview.cloudPartial ? <p role="status" aria-live="polite">{t('notesCloudPreviewPartial')}</p> : null}
            <pre dir="auto" className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">{visibleDivergentPreview.cloudBody}</pre>
          </article>
        </div>
        <button type="button" className={`${button} px-3 py-1`} onClick={() => setDivergentPreview(null)}>{t('cancel')}</button>
      </section> : null}
    </div> : null}
    {error ? <p role="alert">{t(error)}</p> : null}
    {copyFeedback ? <p role="status" aria-live="polite">{t(copyFeedback)}</p> : null}
    {remotePreviewFeedback ? <p role="status" aria-live="polite">{t(remotePreviewFeedback)}</p> : null}
  </section>;
}
