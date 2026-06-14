import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { CosmosEvolutionSummary } from '../history/historyEvolutionQueries';

export interface KnowledgeEvolutionSummaryProps {
  colors: NoteChromeColors;
  summary: CosmosEvolutionSummary;
  onNavigateToNote?: (noteId: string) => void;
}

function formatDate(ts: number | null, lang: string): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString(
    lang === 'ko' ? 'ko-KR' : lang === 'ja' ? 'ja-JP' : undefined,
    { year: 'numeric', month: 'short', day: 'numeric' },
  );
}

function MilestoneLine({
  c,
  label,
  date,
  noteId,
  onNavigate,
}: {
  c: NoteChromeColors;
  label: string;
  date: string;
  noteId: string | null;
  onNavigate?: (id: string) => void;
}) {
  const interactive = Boolean(noteId && onNavigate);
  return (
    <button
      type="button"
      disabled={!interactive}
      onClick={() => noteId && onNavigate?.(noteId)}
      style={{
        width: '100%',
        textAlign: 'left',
        border: 'none',
        background: 'transparent',
        padding: 0,
        margin: '0 0 4px',
        cursor: interactive ? 'pointer' : 'default',
        fontSize: 10,
        color: c.textMuted,
        lineHeight: 1.55,
      }}
    >
      <span style={{ color: c.textFaint }}>{label}:</span>{' '}
      <span style={{ color: interactive ? c.accent : c.text }}>{date}</span>
    </button>
  );
}

/** Compact cosmos age + milestone anchors + current scale. */
export function KnowledgeEvolutionSummary({
  colors: c,
  summary,
  onNavigateToNote,
}: KnowledgeEvolutionSummaryProps) {
  const { t, lang } = useTranslation();

  return (
    <div
      style={{
        margin: '0 8px 10px',
        padding: '10px 11px',
        borderRadius: 8,
        border: `1px solid ${c.sideBdr}`,
        background: c.cardHov,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 700, color: c.text, marginBottom: 6 }}>
        {t('k45EvolutionTitle')}
      </div>
      {summary.importedOnly && (
        <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 6, lineHeight: 1.4 }}>
          {t('k45ImportedHint')}
        </div>
      )}
      <MilestoneLine
        c={c}
        label={t('k45FirstNote')}
        date={formatDate(summary.firstNoteAt, lang)}
        noteId={summary.firstNoteId}
        onNavigate={onNavigateToNote}
      />
      <MilestoneLine
        c={c}
        label={t('k45FirstLink')}
        date={formatDate(summary.firstLinkAt, lang)}
        noteId={summary.firstLinkNoteId}
        onNavigate={onNavigateToNote}
      />
      <MilestoneLine
        c={c}
        label={t('k45FirstHub')}
        date={formatDate(summary.firstHubAt, lang)}
        noteId={summary.firstHubNoteId}
        onNavigate={onNavigateToNote}
      />
      <div style={{ fontSize: 9, fontWeight: 700, color: c.textMuted, margin: '8px 0 4px', textTransform: 'uppercase' }}>
        {t('k45CurrentScale')}
      </div>
      <div style={{ fontSize: 10, color: c.textMuted, lineHeight: 1.55 }}>
        <div>{t('k45CurrentNotes').replace('{count}', String(summary.currentNotes))}</div>
        <div>{t('k45CurrentLinks').replace('{count}', String(summary.currentLinks))}</div>
        <div>{t('k45CurrentHubs').replace('{count}', String(summary.currentHubs))}</div>
      </div>
    </div>
  );
}
