import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation, type TranslationKey } from '../../../../lib/i18n';
import { observePublishedNotesHydration, useNotesStore } from '../../../../store/useNotesStore';
import { createNotesCloudComparison, type NotesCloudComparison, type NotesCloudComparisonReport } from '../../../../lib/notesCloudComparison';
import { NotesBootstrapDiagnosticError } from '../../../../lib/notesBootstrapDiagnostics';

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
    </div> : null}
    {error ? <p role="alert">{t(error)}</p> : null}
  </section>;
}
