import { useCallback, useMemo, useState } from 'react';
import { ArrowRight, Plus, X } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import { filterWikiTargets } from '../../block-editor/features/menus/utils/wikiSearch';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { addRelationTarget, removeRelationTarget } from '../relations/noteRelations';
import {
  CONCEPT_RELATION_TYPES,
  listConceptRelations,
  type ConceptRelationType,
} from '../maps/conceptRelations';
import { conceptRelationLabel } from '../knowledgeLabels';

export interface ConceptRelationsPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  notes: readonly NoteBase[];
  wikiTargets: string[];
  onUpdateRelations: (relations: Record<string, string[]> | undefined) => void;
  onNavigateToNote: (noteId: string) => void;
  onResolveTargetId: (title: string) => string | undefined;
}

export function ConceptRelationsPanel({
  colors: c,
  note,
  notes,
  wikiTargets,
  onUpdateRelations,
  onNavigateToNote,
  onResolveTargetId,
}: ConceptRelationsPanelProps) {
  const { t, lang } = useTranslation();
  const [relationType, setRelationType] = useState<ConceptRelationType>('related-to');
  const [targetQuery, setTargetQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const relations = useMemo(() => listConceptRelations(note), [note]);
  const suggestions = useMemo(
    () => filterWikiTargets(targetQuery, wikiTargets.filter(t => t !== (note.title ?? ''))),
    [note.title, targetQuery, wikiTargets],
  );

  const commit = useCallback(
    (next: NoteBase) => onUpdateRelations(next.relations),
    [onUpdateRelations],
  );

  const handleAdd = () => {
    const trimmed = targetQuery.trim();
    if (!trimmed) return;
    const targetId = onResolveTargetId(trimmed);
    if (!targetId || targetId === note.id) return;
    commit(addRelationTarget(note, relationType, targetId));
    setTargetQuery('');
    setShowSuggestions(false);
  };

  return (
    <section className="be-concept-relations" style={{ padding: '0 0 8px' }} aria-label={t('knConceptRelations')}>
      <div style={{ padding: '8px 10px 4px', fontSize: 10, color: c.textMuted, fontWeight: 700, borderTop: `1px solid ${c.sideBdr}` }}>
        {t('knConceptRelations')}
      </div>
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
              <button type="button" className="btbtn" style={{ flex: 1, textAlign: 'left', fontSize: 11 }} onClick={() => target && onNavigateToNote(target.id)}>
                <ArrowRight size={10} style={{ marginRight: 4 }} />{label}
              </button>
              <button type="button" className="btbtn" onClick={() => commit(removeRelationTarget(note, rel.propertyKey, rel.targetId))}>
                <X size={11} color={c.textMuted} />
              </button>
            </div>
          );
        })
      )}
      <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <select className="bwi" style={{ fontSize: 11 }} value={relationType} onChange={e => setRelationType(e.target.value as ConceptRelationType)}>
          {CONCEPT_RELATION_TYPES.map(type => (
            <option key={type} value={type}>{conceptRelationLabel(type, lang)}</option>
          ))}
        </select>
        <input
          className="bwi"
          style={{ fontSize: 11 }}
          placeholder={t('knTargetConceptTitle')}
          value={targetQuery}
          onChange={e => { setTargetQuery(e.target.value); setShowSuggestions(true); }}
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
        />
        {showSuggestions && suggestions.length > 0 && (
          <div style={{ background: c.card, border: `1px solid ${c.sideBdr}`, borderRadius: 6, maxHeight: 100, overflowY: 'auto' }}>
            {suggestions.slice(0, 5).map(title => (
              <button key={title} type="button" className="btbtn" style={{ width: '100%', textAlign: 'left', padding: '4px 8px', fontSize: 11 }} onClick={() => { setTargetQuery(title); setShowSuggestions(false); }}>
                {title}
              </button>
            ))}
          </div>
        )}
        <button type="button" className="bwbg" style={{ padding: '6px', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }} onClick={handleAdd}>
          <Plus size={12} /> {t('knAddRelation')}
        </button>
      </div>
    </section>
  );
}
