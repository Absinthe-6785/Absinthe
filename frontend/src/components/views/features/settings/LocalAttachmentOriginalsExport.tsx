import { useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from '../../../../lib/i18n';
import { observePublishedNotesHydration, useNotesStore } from '../../../../store/useNotesStore';
import { createLocalOriginalsExport, localOriginalsCoverageText, type LocalOriginalsExport, type OriginalExportReport } from '../../../../lib/localAttachmentOriginalsExport';

export function LocalAttachmentOriginalsExport({ accountId }: { accountId: string | null }) {
  const { t } = useTranslation();
  const notes = useNotesStore(state => state.notes);
  const account = useRef(accountId);
  account.current = accountId;
  const session = useRef<LocalOriginalsExport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [result, setResult] = useState<{ owner: LocalOriginalsExport; report: OriginalExportReport } | null>(null);
  useLayoutEffect(() => {
    session.current?.cancel(); session.current = null;
    setResult(null); setError(false); setBusy(false); setDownloaded(false);
    return () => { session.current?.cancel(); session.current = null; };
  }, [accountId, notes]);
  const observation = observePublishedNotesHydration();
  const ready = !!accountId && observation.status === 'CURRENT' && observation.request.accountId === accountId;
  const visible = result?.owner === session.current && result?.owner.isCurrent() ? result : null;

  const check = async () => {
    if (busy) return;
    session.current?.cancel();
    setResult(null); setError(false); setDownloaded(false);
    let owner: LocalOriginalsExport | null = null;
    try {
      owner = createLocalOriginalsExport(accountId, () => account.current === accountId);
      session.current = owner; setBusy(true);
      const report = await owner.preflight();
      if (session.current === owner && owner.isCurrent()) setResult({ owner, report });
    } catch {
      if (account.current === accountId && (!owner || session.current === owner)) setError(true);
    } finally { if (!owner || session.current === owner) setBusy(false); }
  };
  const download = async () => {
    if (!visible || busy) return;
    const owner = visible.owner;
    setBusy(true); setError(false);
    try {
      // This button is a separate explicit decision after partial coverage is shown.
      await owner.download(visible.report.coverage === 'partial');
      if (session.current === owner && account.current === accountId) setDownloaded(true);
    } catch { if (session.current === owner) setError(true); }
    finally { if (session.current === owner) { setBusy(false); setResult(null); } }
  };
  const cancel = () => { session.current?.cancel(); session.current = null; setResult(null); setBusy(false); };
  const button = 'border rounded-xl px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
  return <section className="border border-border rounded-2xl bg-surface p-4 mt-4 space-y-3" aria-labelledby="local-originals-heading">
    <h3 id="local-originals-heading" className="font-bold">{t('localOriginalsTitle')}</h3>
    <p className="text-sm text-muted-foreground">{t('localOriginalsScope')}</p>
    <button type="button" className={button} disabled={!ready || busy} onClick={() => { void check(); }}>
      {t(busy ? 'localOriginalsChecking' : 'localOriginalsCheck')}
    </button>
    {busy || visible ? <button type="button" className={`${button} ml-2`} onClick={cancel}>{t('cancel')}</button> : null}
    {visible ? <div role="status" className="space-y-2">
      <p>{t(visible.report.coverage === 'partial' ? 'localOriginalsPartial' : 'localOriginalsComplete')}</p>
      <p>{t('localOriginalsCoverage').replace('{included}', String(visible.report.included)).replace('{excluded}', String(visible.report.excluded))}</p>
      <details><summary className="cursor-pointer">{t('localOriginalsDetails')}</summary>
        <pre className="text-xs whitespace-pre-wrap break-words max-h-64 overflow-auto">{localOriginalsCoverageText(visible.report)}</pre>
      </details>
      <button type="button" className={button} disabled={busy || !visible.report.included} onClick={() => { void download(); }}>
        {t(visible.report.coverage === 'partial' ? 'localOriginalsDownloadPartial' : 'localOriginalsDownload')}
      </button>
    </div> : null}
    {error ? <p role="alert">{t('localOriginalsError')}</p> : null}
    {downloaded ? <p role="status">{t('localOriginalsDownloaded')}</p> : null}
  </section>;
}
