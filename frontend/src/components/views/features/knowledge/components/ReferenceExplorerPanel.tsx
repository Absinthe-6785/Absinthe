import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteReferenceSummary } from '../references/extractNoteReferenceSummary';
import type { PageReference } from '../backlinks';
import { CosmosEmptyHint } from './CosmosEmptyHint';

export interface ReferenceExplorerPanelProps {
  colors: NoteChromeColors;
  summary: NoteReferenceSummary;
  mentioning: readonly PageReference[];
  onNavigateToNote: (noteId: string) => void;
  onNavigateToWiki: (title: string) => void;
}

function SectionHeader({ c, title, count }: { c: NoteChromeColors; title: string; count: number }) {
  return (
    <div
      style={{
        padding: '8px 10px 4px',
        fontSize: 10,
        color: c.textMuted,
        fontWeight: 700,
        borderTop: `1px solid ${c.sideBdr}`,
      }}
    >
      {title}{' '}
      <span style={{ color: count > 0 ? c.accent : c.textFaint }}>({count})</span>
    </div>
  );
}

/** Read-only note-level reference explorer — links, footnotes, citations. */
export function ReferenceExplorerPanel({
  colors: c,
  summary,
  mentioning,
  onNavigateToNote,
  onNavigateToWiki,
}: ReferenceExplorerPanelProps) {
  const { t } = useTranslation();
  const resolvedOutgoing = summary.outgoing.filter(o => o.targetNoteId);
  const brokenOutgoing = summary.outgoing.filter(o => !o.targetNoteId);

  return (
    <section className="be-reference-explorer" style={{ paddingBottom: 4 }}>
      <div style={{ padding: '0 10px 6px', fontSize: 10, color: c.textFaint }}>
        {t('knReferenceExplorer')} · {t('knCitationCount').replace('{count}', String(summary.citationCount))}
      </div>

      <SectionHeader c={c} title={t('knOutgoingLinksSection')} count={summary.outgoing.length} />
      {summary.outgoing.length === 0 ? (
        <>
          <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '6px 8px' }}>{t('knNone')}</p>
          <CosmosEmptyHint colors={c}>{t('knCosmosHintReferences')}</CosmosEmptyHint>
        </>
      ) : (
        summary.outgoing.map(link => (
          <ReferenceRow
            key={link.title}
            c={c}
            label={link.title}
            prefix="→"
            color={link.targetNoteId ? c.green : c.textMuted}
            italic={!link.targetNoteId}
            suffix={!link.targetNoteId ? t('knCreateNote') : undefined}
            onClick={() => (
              link.targetNoteId
                ? onNavigateToNote(link.targetNoteId)
                : onNavigateToWiki(link.title)
            )}
          />
        ))
      )}

      <SectionHeader c={c} title={t('knIncomingLinksSection')} count={summary.incoming.length} />
      {summary.incoming.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '6px 8px' }}>{t('knNone')}</p>
      ) : (
        summary.incoming.map(ref => (
          <ReferenceRow
            key={ref.noteId}
            c={c}
            label={ref.noteTitle}
            prefix="←"
            color={c.accent}
            onClick={() => onNavigateToNote(ref.noteId)}
          />
        ))
      )}

      <SectionHeader c={c} title={t('knFootnotes')} count={summary.footnotes.length} />
      {summary.footnotes.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '6px 8px' }}>{t('knNone')}</p>
      ) : (
        summary.footnotes.map(fn => (
          <div
            key={fn.id}
            style={{
              margin: '0 8px 4px',
              padding: '5px 9px',
              borderRadius: 6,
              border: `1px solid ${c.sideBdr}`,
              background: c.cardHov,
              fontSize: 10,
              lineHeight: 1.5,
              color: c.textMuted,
            }}
          >
            <span style={{ fontWeight: 700, color: c.accent, marginRight: 6 }}>[^{fn.id}]</span>
            {fn.content}
          </div>
        ))
      )}

      {summary.inlineFootnoteRefs.length > 0 && (
        <div style={{ padding: '4px 10px 0', fontSize: 10, color: c.textFaint }}>
          {t('knBodyFootnoteRefs')}: {summary.inlineFootnoteRefs.map(id => `[^${id}]`).join(', ')}
        </div>
      )}

      <SectionHeader c={c} title={t('knMentionsUnlinked')} count={mentioning.length} />
      {mentioning.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '6px 8px' }}>{t('knNone')}</p>
      ) : (
        mentioning.map(ref => (
          <ReferenceRow
            key={`mention-${ref.noteId}`}
            c={c}
            label={ref.noteTitle}
            prefix="↗"
            color={c.textMuted}
            onClick={() => onNavigateToNote(ref.noteId)}
          />
        ))
      )}

      {(resolvedOutgoing.length > 0 || brokenOutgoing.length > 0) && (
        <div style={{ padding: '6px 10px 0', fontSize: 9, color: c.textFaint }}>
          {t('knResolvedUnresolved')
            .replace('{resolved}', String(resolvedOutgoing.length))
            .replace('{unresolved}', String(brokenOutgoing.length))}
        </div>
      )}
    </section>
  );
}

function ReferenceRow({
  c,
  label,
  prefix,
  color,
  italic,
  suffix,
  onClick,
}: {
  c: NoteChromeColors;
  label: string;
  prefix: string;
  color: string;
  italic?: boolean;
  suffix?: string;
  onClick: () => void;
}) {
  return (
    <div
      className="bbl"
      style={{ color, fontStyle: italic ? 'italic' : undefined }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={e => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
    >
      {prefix} {label}
      {suffix && <span style={{ fontSize: 9, color: c.accent, marginLeft: 4 }}>{suffix}</span>}
    </div>
  );
}
