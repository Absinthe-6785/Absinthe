import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation, type TranslationKey } from '../../../../lib/i18n';
import { isCompleteLocalNote } from '../../../../lib/notesBootstrapAuthority';
import { openNote } from '../../../../lib/noteNavigation';
import { observePublishedNotesHydration, useNotesStore } from '../../../../store/useNotesStore';
import { createNotesCloudComparison, type NotesCloudComparison, type NotesCloudComparisonReport } from '../../../../lib/notesCloudComparison';
import { NotesBootstrapDiagnosticError } from '../../../../lib/notesBootstrapDiagnostics';

const DETAIL_PREVIEW_LIMIT = 30;
const detailSections = [
  { key: 'localOnly', label: 'notesCloudLocalOnly', canOpenLocal: true },
  { key: 'remoteOnly', label: 'notesCloudRemoteOnly', canOpenLocal: false },
  { key: 'divergent', label: 'notesCloudDivergent', canOpenLocal: true },
  { key: 'incomparable', label: 'notesCloudIncomparable', canOpenLocal: true },
  { key: 'deleted', label: 'notesCloudDeleted', canOpenLocal: false },
] as const;

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
  const [error, setError] = useState<TranslationKey | null>(null);
  const [result, setResult] = useState<{ owner: NotesCloudComparison; report: NotesCloudComparisonReport } | null>(null);
  const observation = observePublishedNotesHydration();
  const ready = !!accountId && observation.status === 'CURRENT' && observation.request.accountId === accountId;
  useLayoutEffect(() => {
    active.current?.cancel(); active.current = null;
    setBusy(false); setResult(null); setError(null);
    return () => { active.current?.cancel(); active.current = null; };
  }, [accountId, notes, folders, ready]);
  const visible = result && result.owner === active.current && result.owner.isCurrent() ? result.report : null;
  const check = async () => {
    if (busy) return;
    active.current?.cancel(); setResult(null); setError(null);
    if (typeof navigator !== 'undefined' && navigator.onLine === false) { setError('notesCloudOffline'); return; }
    const context = account.current;
    let owner: NotesCloudComparison | null = null;
    try {
      owner = createNotesCloudComparison(accountId, () => account.current === context);
      active.current = owner; setBusy(true);
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
  const cancel = () => { active.current?.cancel(); active.current = null; setBusy(false); setResult(null); setError('notesCloudStale'); };
  const button = 'border rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
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
    </div> : null}
    {error ? <p role="alert">{t(error)}</p> : null}
  </section>;
}
