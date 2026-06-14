import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { ConceptHubData } from '../maps/buildConceptHub';
import { CONCEPT_RELATION_TYPES } from '../maps/conceptRelations';
import { conceptRelationLabel } from '../knowledgeLabels';
import { CosmosEmptyHint } from './CosmosEmptyHint';

export interface ConceptHubPanelProps {
  colors: NoteChromeColors;
  data: ConceptHubData;
  onNavigateToNote: (noteId: string) => void;
}

/** Explore a concept from one place — reuses relations, backlinks, and wiki refs. */
export function ConceptHubPanel({ colors: c, data, onNavigateToNote }: ConceptHubPanelProps) {
  const { t, lang } = useTranslation();

  return (
    <section className="be-concept-hub" style={{ padding: '0 0 8px' }} aria-label={t('knConceptHub')}>
      <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 700, borderTop: `1px solid ${c.sideBdr}` }}>
        {t('knConceptHub')} · {data.centralTitle}
        {data.isConcept && <span style={{ color: c.accent, marginLeft: 6 }}>{t('knConceptBadge')}</span>}
      </div>
      <div style={{ padding: '4px 10px', fontSize: 9, color: c.textFaint, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <span>{t('knBacklinks')} {data.backlinkCount}</span>
        <span>{t('knOutgoingLinks')} {data.outgoingLinkCount}</span>
        <span>{t('knIncomingRelations')} {data.incomingRelationCount}</span>
      </div>
      <div style={{ padding: '4px 10px 6px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {CONCEPT_RELATION_TYPES.map(type => (
          data.relationCounts[type] > 0 && (
            <span key={type} style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: c.cardHov, border: `1px solid ${c.sideBdr}`, color: c.textMuted }}>
              {conceptRelationLabel(type, lang)} {data.relationCounts[type]}
            </span>
          )
        ))}
      </div>
      {data.relatedConcepts.length === 0 ? (
        <>
          <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 8px 0' }}>
            {t('knNoRelatedConcepts')}
          </p>
          <CosmosEmptyHint colors={c}>{t('knCosmosHintConcepts')}</CosmosEmptyHint>
        </>
      ) : (
        <div style={{ padding: '0 8px' }}>
          {data.relatedConcepts.map(entry => (
            <button
              key={`${entry.direction}-${entry.noteId}-${entry.relationType}`}
              type="button"
              onClick={() => onNavigateToNote(entry.noteId)}
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
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 600 }}>{entry.noteTitle}</div>
              <div style={{ fontSize: 9, color: c.textMuted }}>
                {conceptRelationLabel(entry.relationType, lang)} · {entry.direction === 'incoming' ? '←' : '→'}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
