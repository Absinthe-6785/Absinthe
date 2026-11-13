import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from '../../lib/i18n';
import { isComparableRemoteNoteContent } from '../../lib/notesBootstrapAuthority';
import { fetchCompleteNotesFoldersSnapshot, type DbNoteRow } from '../../lib/notesSyncClient';

const SNAPSHOT_LIMIT = 500;
const SEARCH_LIMIT = 120;
const LIST_PREVIEW_LIMIT = 30;
const TEXT_PREVIEW_LIMIT = 12_000;

type AuthOwner = Readonly<{ accountId: string | null; generation: number }>;
type SnapshotState = Readonly<{
  ownerKey: string;
  status: 'idle' | 'loading' | 'loaded' | 'unavailable';
  notes: readonly DbNoteRow[];
  totalRows: number;
}>;
type TextPreview = Readonly<{ id: string; title: string; body: string; partial: boolean; ownerKey: string }>;

function boundedText(value: string, limit: number): { text: string; partial: boolean } {
  let text = value.slice(0, limit);
  const partial = value.length > limit;
  if (partial && /[\uD800-\uDBFF]$/.test(text)) text = text.slice(0, -1);
  return { text, partial };
}

function normalAppHref(): string {
  if (typeof window === 'undefined') return '/';
  const url = new URL(window.location.href);
  url.searchParams.delete('notesReadOnly');
  return `${url.pathname}${url.search}${url.hash}`;
}

export function NotesReadOnlyCloudView({
  accountId,
  authGeneration,
  getCurrentAuthOwner,
}: {
  accountId: string;
  authGeneration: number;
  getCurrentAuthOwner: () => AuthOwner;
}) {
  const { t } = useTranslation();
  const ownerKey = `${accountId}:${authGeneration}`;
  const currentAuthOwner = useRef(getCurrentAuthOwner);
  currentAuthOwner.current = getCurrentAuthOwner;
  const requestGeneration = useRef(0);
  const mounted = useRef(true);
  const [snapshot, setSnapshot] = useState<SnapshotState>({ ownerKey, status: 'idle', notes: [], totalRows: 0 });
  const [query, setQuery] = useState('');
  const [visibleLimit, setVisibleLimit] = useState(LIST_PREVIEW_LIMIT);
  const [preview, setPreview] = useState<TextPreview | null>(null);

  const isOwnerCurrent = () => {
    const owner = currentAuthOwner.current();
    return owner.accountId === accountId && owner.generation === authGeneration;
  };

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      requestGeneration.current += 1;
    };
  }, []);

  useEffect(() => {
    requestGeneration.current += 1;
    setSnapshot({ ownerKey, status: 'idle', notes: [], totalRows: 0 });
    setQuery('');
    setVisibleLimit(LIST_PREVIEW_LIMIT);
    setPreview(null);
  }, [ownerKey]);

  const visibleSnapshot = snapshot.ownerKey === ownerKey && isOwnerCurrent()
    ? snapshot : { ownerKey, status: 'idle' as const, notes: [], totalRows: 0 };

  const load = async () => {
    if (!isOwnerCurrent() || visibleSnapshot.status === 'loading') return;
    const generation = ++requestGeneration.current;
    const isCurrent = () => mounted.current && requestGeneration.current === generation && isOwnerCurrent();
    setSnapshot({ ownerKey, status: 'loading', notes: [], totalRows: 0 });
    setQuery('');
    setVisibleLimit(LIST_PREVIEW_LIMIT);
    setPreview(null);
    try {
      const remote = await fetchCompleteNotesFoldersSnapshot(accountId, {
        singlePageLimit: SNAPSHOT_LIMIT,
        isCurrent,
      });
      if (!isCurrent()) return;
      const eligible = remote.notes.filter(row => row.user_id === accountId
        && row.deleted_at === null && isComparableRemoteNoteContent(accountId, row));
      setSnapshot({ ownerKey, status: 'loaded', notes: eligible, totalRows: remote.notes.length });
    } catch {
      if (!isCurrent()) return;
      setSnapshot({ ownerKey, status: 'unavailable', notes: [], totalRows: 0 });
    }
  };

  const normalizedQuery = query.trim().normalize('NFKC').toLowerCase();
  const matchingNotes = useMemo(() => {
    if (!normalizedQuery) return visibleSnapshot.notes;
    return visibleSnapshot.notes.filter(note => note.id === query.trim()
      || note.title.normalize('NFKC').toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery, query, visibleSnapshot.notes]);
  const shownNotes = matchingNotes.slice(0, visibleLimit);
  const visiblePreview = preview?.ownerKey === ownerKey && isOwnerCurrent() ? preview : null;
  const exitHref = normalAppHref();

  const showPreview = (noteId: string) => {
    if (!isOwnerCurrent() || visibleSnapshot.status !== 'loaded') return;
    const note = visibleSnapshot.notes.find(candidate => candidate.id === noteId);
    if (!note || note.user_id !== accountId || note.deleted_at !== null
      || !isComparableRemoteNoteContent(accountId, note) || !isOwnerCurrent()) return;
    const bounded = boundedText(note.body, TEXT_PREVIEW_LIMIT);
    setPreview({ id: note.id, title: note.title, body: bounded.text, partial: bounded.partial, ownerKey });
  };

  return <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-4 px-4 py-6 text-foreground sm:px-6">
    <header className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold">{t('notesCloudReadOnlyTitle')}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t('notesCloudReadOnlyScope')}</p>
      </div>
      <a href={exitHref} className="shrink-0 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
        {t('notesCloudReadOnlyExit')}
      </a>
    </header>

    <button type="button" className="min-h-11 w-full rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary disabled:opacity-60"
      disabled={!isOwnerCurrent() || visibleSnapshot.status === 'loading'} onClick={() => { void load(); }}>
      {t(visibleSnapshot.status === 'loading' ? 'notesCloudChecking' : 'notesCloudCheck')}
    </button>

    {visibleSnapshot.status === 'loading' ? <p role="status" aria-live="polite">{t('notesCloudChecking')}</p> : null}
    {visibleSnapshot.status === 'unavailable' ? <p role="alert">{t('notesCloudUnavailable')}</p> : null}

    {visibleSnapshot.status === 'loaded' ? <section aria-label={t('notesCloudReadOnlyTitle')} className="flex min-w-0 flex-col gap-3">
      <p role="status" aria-live="polite">
        {t('notesCloudReadOnlySnapshotCount')
          .replace('{eligible}', String(visibleSnapshot.notes.length))
          .replace('{total}', String(visibleSnapshot.totalRows))}
      </p>
      {visibleSnapshot.totalRows === 0
        ? <p>{t('notesCloudReadOnlyEmpty')}</p>
        : visibleSnapshot.notes.length === 0
          ? <p>{t('notesCloudReadOnlyNoEligible')}</p>
          : <>
            <div className="flex flex-col gap-1">
              <label htmlFor="notes-cloud-readonly-search" className="text-sm font-medium">{t('notesCloudReadOnlySearchLabel')}</label>
              <input id="notes-cloud-readonly-search" type="search" maxLength={SEARCH_LIMIT} value={query}
                onChange={event => { setQuery(event.target.value); setPreview(null); setVisibleLimit(LIST_PREVIEW_LIMIT); }}
                className="min-h-11 w-full rounded-md border border-border bg-surface px-3 py-2 text-base"
                aria-describedby="notes-cloud-readonly-search-help" />
              <p id="notes-cloud-readonly-search-help" className="text-xs text-muted-foreground">{t('notesCloudReadOnlySearchHelp')}</p>
            </div>
            {matchingNotes.length === 0
              ? <p role="status">{t('notesCloudReadOnlyNoMatches')}</p>
              : <ul className="max-h-80 space-y-2 overflow-y-auto rounded-md border border-border p-2">
                {shownNotes.map(note => <li key={note.id} className="flex min-w-0 items-start justify-between gap-3 rounded-md border-b border-border p-2 last:border-b-0">
                  <div className="min-w-0">
                    {note.title.trim() ? <p className="break-words font-medium">{note.title}</p> : null}
                    <code className="block break-all text-xs text-muted-foreground">{note.id}</code>
                  </div>
                  <button type="button" className="min-h-10 shrink-0 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    aria-label={`${t('notesCloudPreviewAction')} ${note.title || note.id} ${note.id}`}
                    onClick={() => showPreview(note.id)}>{t('notesCloudPreviewAction')}</button>
                </li>)}
              </ul>}
            {matchingNotes.length > shownNotes.length ? <button type="button" className="min-h-10 self-start rounded-md border border-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => setVisibleLimit(limit => Math.min(limit + LIST_PREVIEW_LIMIT, matchingNotes.length))}>
              {t('notesCloudShowMore').replace('{count}', String(matchingNotes.length - shownNotes.length))}
            </button> : null}
          </>}
    </section> : null}

    {visiblePreview ? <section className="min-w-0 space-y-3 rounded-lg border border-border p-3" aria-labelledby="notes-cloud-readonly-preview-heading">
      <h2 id="notes-cloud-readonly-preview-heading" className="font-semibold">{t('notesCloudReadOnlyPreviewHeading')}</h2>
      <p className="text-sm text-muted-foreground">{t('notesCloudReadOnlyPreviewSource')}</p>
      <code className="block break-all text-xs">{visiblePreview.id}</code>
      {visiblePreview.title.trim() ? <p className="break-words">{visiblePreview.title}</p> : null}
      {visiblePreview.partial ? <p role="status" aria-live="polite">{t('notesCloudPreviewPartial')}</p> : null}
      <pre dir="auto" className="max-h-96 overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-sm">{visiblePreview.body}</pre>
      <button type="button" className="min-h-10 rounded-md border border-border px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        onClick={() => setPreview(null)}>{t('cancel')}</button>
    </section> : null}
  </main>;
}
