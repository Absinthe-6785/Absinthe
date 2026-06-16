import { useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { listConceptRelations, type ConceptRelationType } from '../maps/conceptRelations';
import { conceptRelationLabel } from '../knowledgeLabels';

export interface ConceptRelationsBrowseProps {
  colors: NoteChromeColors;
  note: NoteBase;
  notes: readonly NoteBase[];
  onNavigateToNote: (noteId: string) => void;
  onOpenRelations: () => void;
}

/**
 * Links → Structure — read-only concept relation list. CRUD lives in Relations tab (K-90A3).
 */
export function ConceptRelationsBrowse({
  colors: c,
  note,
  notes,
  onNavigateToNote,
  onOpenRelations,
}: ConceptRelationsBrowseProps) {
  const { t, lang } = useTranslation();
  const relations = useMemo(() => listConceptRelations(note), [note]);

  return (
    <section className="be-concept-relations" style={{ padding: '0 0 8px' }} aria-label={t('knConceptRelations')}>
      <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 700, borderTop: `1px solid ${c.sideBdr}` }}>
        {t('knConceptRelations')}
      </div>
      <p style={{ fontSize: 9, color: c.textFaint, margin: '0 10px 6px', lineHeight: 1.45 }}>
        {t('k90a3ConceptRelationsBrowseHint')}
      </p>

      {relations.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '6px 8px' }}>{t('knNoRelations')}</p>
      ) : (
        relations.map(rel => {
          const target = notes.find(n => n.id === rel.targetId);
          const label = displayNoteTitle(target?.title) || t('knTargetMissing');
          return (
            <div
              key={`${rel.propertyKey}-${rel.targetId}`}
              style={{
                margin: '0 8px 4px',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 8px',
                background: c.cardHov,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
              }}
            >
              <span style={{ fontSize: 9, color: c.accent, minWidth: 48 }}>
                {conceptRelationLabel(rel.propertyKey as ConceptRelationType, lang) ?? rel.propertyKey}
              </span>
              <button
                type="button"
                className="btbtn"
                style={{ flex: 1, textAlign: 'left', fontSize: 11 }}
                onClick={() => target && onNavigateToNote(target.id)}
              >
                <ArrowRight size={10} style={{ marginRight: 4 }} />
                {label}
              </button>
            </div>
          );
        })
      )}

      <div style={{ padding: '6px 10px' }}>
        <button
          type="button"
          onClick={onOpenRelations}
          style={{
            width: '100%',
            padding: '6px 10px',
            fontSize: 10,
            fontWeight: 600,
            borderRadius: 6,
            border: `1px solid ${c.accent}`,
            background: c.accentBg,
            color: c.accent,
            cursor: 'pointer',
          }}
        >
          {t('k90a3ConceptRelationsEditInRelations')}
        </button>
      </div>
    </section>
  );
}
