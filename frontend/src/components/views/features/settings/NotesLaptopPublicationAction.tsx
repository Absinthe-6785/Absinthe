import { useId, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation, type TranslationKey } from '../../../../lib/i18n';
import { preflightLocalNoteForCloudCopy, type NotesCloudCopyPreflightReason } from '../../../../lib/notesCloudCopyLocalPreflight';
import { requestLaptopPublication, requestInitialLaptopPublication, INITIAL_PUBLICATION_POLICY, sameLaptopPublicationSnapshot, type LaptopPublicationPayload,
  type LaptopPublicationPreview, type LaptopPublicationStatus } from '../../../../lib/notesLaptopPublication';
import { subscribeNotesAuthorityRequestChange } from '../../../../lib/notesAccountAuthority';

const feedbackKeys: Record<Exclude<LaptopPublicationStatus, 'STALE_RESULT'>, TranslationKey> = {
  VERIFIED: 'notesLaptopPublishVerified', DISABLED: 'notesLaptopPublishDisabled',
  CONFLICT: 'notesLaptopPublishConflict', BAD_REQUEST: 'notesLaptopPublishBadRequest',
  INDETERMINATE: 'notesLaptopPublishIndeterminate', UNAVAILABLE: 'notesLaptopPublishUnavailable',
  SOURCE_CHANGED: 'notesLaptopPublishSourceChanged', REPEAT_BLOCKED: 'notesLaptopPublishRepeatBlocked',
};

const preflightDiagnosticKeys: Record<NotesCloudCopyPreflightReason, TranslationKey> = {
  INVALID_LOCAL_NOTE_ID: 'notesInitialPublishBlockedEligibility',
  NOTES_AUTHORITY_UNAVAILABLE: 'notesInitialPublishBlockedAuthority',
  NOTE_NOT_FOUND: 'notesInitialPublishBlockedEligibility',
  NOTE_ID_AMBIGUOUS: 'notesInitialPublishBlockedEligibility',
  NOTE_INCOMPLETE: 'notesInitialPublishBlockedEligibility',
  NOTE_NOT_ACTIVE: 'notesInitialPublishBlockedEligibility',
  FOLDER_UNSUPPORTED: 'notesInitialPublishBlockedEligibility',
  PROPERTIES_UNSUPPORTED: 'notesInitialPublishBlockedEligibility',
  RELATIONS_UNSUPPORTED: 'notesInitialPublishBlockedEligibility',
  ATTACHMENT_CONTENT_UNSUPPORTED: 'notesInitialPublishBlockedEligibility',
  ATTACHMENT_METADATA_INCOMPLETE: 'notesInitialPublishBlockedAttachments',
  ATTACHMENT_ORIGINALS_PRESENT: 'notesInitialPublishBlockedAttachments',
  LOCAL_PERSISTENCE_UNVERIFIED: 'notesInitialPublishBlockedDurability',
  SOURCE_CHANGED: 'notesInitialPublishBlockedSource',
};

function diagnosticsForPreflight(reasons: readonly NotesCloudCopyPreflightReason[]): TranslationKey[] {
  return [...new Set(reasons.map(reason => preflightDiagnosticKeys[reason]))];
}

export function NotesLaptopPublicationAction({ accountId, noteId, ledger, isOwnerCurrent, onVerified, initialAdoption = false, knownDeletedIds = [] }: {
  accountId: string;
  noteId: string;
  ledger: Map<string, LaptopPublicationPayload>;
  isOwnerCurrent: () => boolean;
  onVerified: () => void;
  initialAdoption?: boolean;
  knownDeletedIds?: readonly string[];
}) {
  const { t } = useTranslation();
  const id = useId();
  const key = JSON.stringify([accountId, noteId]);
  const [approvalOperationId, setApprovalOperationId] = useState(initialAdoption ? INITIAL_PUBLICATION_POLICY : '');
  const [acknowledged, setAcknowledged] = useState(false);
  const [candidate, setCandidate] = useState<LaptopPublicationPreview | null>(null);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<readonly TranslationKey[] | null>(null);
  const [dispatched, setDispatched] = useState(() => ledger.has(key));
  const lifetime = useRef<object | null>(null);
  const pending = useRef<symbol | null>(null);
  useLayoutEffect(() => {
    const token = {};
    lifetime.current = token;
    const unsubscribe = subscribeNotesAuthorityRequestChange(() => {
      // A-B-A cannot revive an in-flight preparation or confirmation.
      lifetime.current = null; pending.current = null;
      setCandidate(null); setBusy(false); setFeedback(['notesLaptopPublishSourceChanged']);
    });
    return () => { lifetime.current = null; pending.current = null; unsubscribe(); };
  }, []);
  const current = (token: object | null) => !!token && lifetime.current === token && isOwnerCurrent();
  const run = async (mode: 'prepare' | 'publish' | 'status') => {
    if (pending.current || !lifetime.current || !isOwnerCurrent()) return;
    if (initialAdoption && mode !== 'status' && (!acknowledged || knownDeletedIds.includes(noteId))) return;
    if (mode !== 'status' && ledger.has(key)) { setDispatched(true); setCandidate(null); return; }
    const prior = ledger.get(key);
    if (mode === 'status' && !prior) return;
    if (mode !== 'status' && (!approvalOperationId.trim() || approvalOperationId !== approvalOperationId.trim())) return;
    if (mode === 'publish' && !candidate) return;
    const token = lifetime.current;
    const request = Symbol('laptop-publication');
    pending.current = request; setBusy(true); setFeedback(null);
    const owned = () => pending.current === request && current(token);
    try {
      const preview = mode === 'publish' ? candidate! : await preflightLocalNoteForCloudCopy(noteId);
      if (!owned()) return;
      if (preview.status !== 'ELIGIBLE_PREVIEW_ONLY') {
        if (owned()) { setCandidate(null); setFeedback(diagnosticsForPreflight(preview.reasons)); }
        return;
      }
      const currentIssue = preview.localNoteId === noteId
        ? await preview.checkCurrent()
        : 'SOURCE_CHANGED';
      if (currentIssue || !owned()) {
        if (owned()) { setCandidate(null); setFeedback(diagnosticsForPreflight([currentIssue ?? 'SOURCE_CHANGED'])); }
        return;
      }
      if (mode === 'prepare') { setCandidate(preview); return; }
      if (prior && !sameLaptopPublicationSnapshot(prior.snapshot, preview.snapshot)) {
        setFeedback(['notesLaptopPublishSourceChanged']); return;
      }
      const payload = prior ?? Object.freeze({ noteId, approvalOperationId, snapshot: preview.snapshot,
        ...(initialAdoption ? { knownDeletedIds } : {}) });
      const requestPublication = initialAdoption ? requestInitialLaptopPublication : requestLaptopPublication;
      const outcome = await requestPublication(mode, payload, accountId, preview, owned, () => {
        if (!owned()) return false;
        if (mode === 'publish') {
          if (ledger.has(key)) return false;
          ledger.set(key, payload); // Never clear this ledger on cancellation, source change, or account switch.
          setDispatched(true); setCandidate(null);
        }
        return true;
      });
      if (!owned() || outcome === 'STALE_RESULT') return;
      setCandidate(null); setFeedback([feedbackKeys[outcome]]);
      if (outcome === 'VERIFIED') onVerified();
    } catch {
      if (owned()) { setCandidate(null); setFeedback([ledger.has(key) ? 'notesLaptopPublishIndeterminate' : 'notesLaptopPublishUnavailable']); }
    } finally {
      if (pending.current === request && current(token)) { pending.current = null; setBusy(false); }
    }
  };
  const button = 'border rounded-xl px-3 py-1 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50';
  return <div data-laptop-publication className="mt-2 space-y-2" role="group" aria-label={`${t('notesLaptopPublishAction')} ${noteId}`}>
    <p className="text-sm text-muted-foreground" id={`${id}-scope`}>{t(initialAdoption ? 'notesInitialPublishScope' : 'notesLaptopPublishScope')}</p>
    {dispatched || ledger.has(key) ? <>
      <p>{t('notesLaptopPublishRepeatBlocked')}</p>
      <button type="button" className={button} disabled={busy} onClick={() => { void run('status'); }}>
        {t(busy ? 'notesLaptopPublishWorking' : 'notesLaptopPublishReadback')}
      </button>
    </> : <>
      {initialAdoption ? <label className="block"><input type="checkbox" checked={acknowledged}
        disabled={busy || !!candidate} onChange={event => setAcknowledged(event.currentTarget.checked)} /> {t('notesInitialPublishAcknowledge')}</label> : <>
      <label htmlFor={`${id}-approval`} className="block">{t('notesLaptopPublishApprovalId')}</label>
      <input id={`${id}-approval`} type="text" maxLength={512} autoComplete="off" spellCheck={false}
        className="w-full rounded-lg border border-border bg-surface px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        aria-describedby={`${id}-scope`} value={approvalOperationId} disabled={busy || !!candidate}
        onChange={event => { setApprovalOperationId(event.currentTarget.value); setCandidate(null); }} /></>}
      {candidate ? <div role="group" aria-label={t('notesLaptopPublishConfirm')}>
        <p>{t(initialAdoption ? 'notesInitialPublishAcknowledge' : 'notesLaptopPublishPrompt')}</p>
        <code className="break-all">{noteId}</code>
        <button type="button" className={button} disabled={busy} onClick={() => { void run('publish'); }}>
          {t(busy ? 'notesLaptopPublishWorking' : 'notesLaptopPublishConfirm')}
        </button>
        <button type="button" className={`${button} ml-2`} disabled={busy} onClick={() => { setCandidate(null); setFeedback(null); }}>{t('cancel')}</button>
      </div> : <button type="button" className={button} disabled={busy || (initialAdoption && !acknowledged) || !approvalOperationId.trim() || approvalOperationId !== approvalOperationId.trim()}
        onClick={() => { void run('prepare'); }}>{t(busy ? 'notesLaptopPublishWorking' : initialAdoption ? 'notesInitialPublishAction' : 'notesLaptopPublishAction')}</button>}
    </>}
    {feedback ? <div role="status" aria-live="polite">
      {feedback.length === 1 ? <p>{t(feedback[0])}</p> : <ul>{feedback.map(key => <li key={key}>{t(key)}</li>)}</ul>}
    </div> : null}
  </div>;
}
