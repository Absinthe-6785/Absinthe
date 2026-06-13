import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import {
  getLinkedReadingNoteIds,
  getLinkedSourceNoteId,
  isReadingNote,
  isSourceNote,
} from '../research/readingSourceLink';

export interface ReadingSourceLinkPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  notes: readonly NoteBase[];
  sourceNoteCandidates: readonly NoteBase[];
  onNavigateToNote: (noteId: string) => void;
  onLinkSource: (sourceNoteId: string) => void;
  onUnlinkSource: () => void;
}

function noteTitleById(notes: readonly NoteBase[], id: string): string {
  return displayNoteTitle(notes.find(n => n.id === id)?.title);
}

/** Bidirectional reading ↔ source navigation and linking. */
export function ReadingSourceLinkPanel({
  colors: c,
  note,
  notes,
  sourceNoteCandidates,
  onNavigateToNote,
  onLinkSource,
  onUnlinkSource,
}: ReadingSourceLinkPanelProps) {
  const { t } = useTranslation();
  const linkedSourceId = getLinkedSourceNoteId(note);
  const linkedReadingIds = getLinkedReadingNoteIds(note);
  const showReadingLink = isReadingNote(note) || linkedSourceId;
  const showSourceReadings = isSourceNote(note) || linkedReadingIds.length > 0;

  if (!showReadingLink && !showSourceReadings) return null;

  return (
    <section className="be-reading-source-link" style={{ padding: '0 0 8px' }} aria-label={t('knReadingSourceLink')}>
      <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 700, borderTop: `1px solid ${c.sideBdr}` }}>
        {t('knReadingSourceLink')}
      </div>

      {showReadingLink && (
        <div style={{ padding: '4px 10px 8px' }}>
          <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 4 }}>{t('knLinkedSource')}</div>
          {linkedSourceId ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <button
                type="button"
                onClick={() => onNavigateToNote(linkedSourceId)}
                style={{
                  flex: 1,
                  textAlign: 'left',
                  background: c.cardHov,
                  border: `1px solid ${c.sideBdr}`,
                  borderRadius: 6,
                  padding: '6px 8px',
                  cursor: 'pointer',
                  color: c.text,
                  fontSize: 11,
                }}
              >
                {noteTitleById(notes, linkedSourceId)}
              </button>
              <button type="button" className="btbtn" style={{ fontSize: 9 }} onClick={onUnlinkSource}>
                {t('knUnlink')}
              </button>
            </div>
          ) : (
            <select
              className="bwi"
              defaultValue=""
              onChange={e => {
                const id = e.target.value;
                if (id) onLinkSource(id);
                e.target.value = '';
              }}
              style={{ width: '100%', fontSize: 11 }}
            >
              <option value="">{t('knSelectSourceNote')}</option>
              {sourceNoteCandidates.map(candidate => (
                <option key={candidate.id} value={candidate.id}>
                  {displayNoteTitle(candidate.title)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {showSourceReadings && linkedReadingIds.length > 0 && (
        <div style={{ padding: '4px 10px 8px' }}>
          <div style={{ fontSize: 9, color: c.textFaint, marginBottom: 4 }}>{t('knLinkedReadingNotes')}</div>
          {linkedReadingIds.map(readingId => (
            <button
              key={readingId}
              type="button"
              onClick={() => onNavigateToNote(readingId)}
              style={{
                width: '100%',
                textAlign: 'left',
                background: c.cardHov,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                padding: '6px 8px',
                marginBottom: 4,
                cursor: 'pointer',
                color: c.text,
                fontSize: 11,
              }}
            >
              {noteTitleById(notes, readingId)}
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
