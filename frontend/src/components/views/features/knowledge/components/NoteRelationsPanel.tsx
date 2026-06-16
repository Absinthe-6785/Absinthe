import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, Plus, X } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import type { TranslationKey } from '../../../../../lib/i18n';
import { filterWikiTargets } from '../../block-editor/features/menus/utils/wikiSearch';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { RelationEdge, ResolvedRelationTarget } from '../relations/relationModels';
import { addRelationTarget, listRelationKeys, removeRelationTarget } from '../relations/noteRelations';
import { KnowledgePanelEmpty } from './KnowledgePanelSection';

const PRESET_RELATION_KEYS = [
  { value: 'course', labelKey: null },
  { value: 'prerequisite', labelKey: 'knRelationPrerequisite' as TranslationKey },
  { value: 'reference', labelKey: 'knRelationReference' as TranslationKey },
  { value: 'related', labelKey: 'knRelationRelated' as TranslationKey },
  { value: 'project', labelKey: null },
] as const;

const CUSTOM_RELATION_VALUE = '__custom__';

export interface IncomingRelationDisplay {
  edge: RelationEdge;
  sourceTitle: string;
  missing: boolean;
}

export interface NoteRelationsPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  wikiTargets: string[];
  outgoing: readonly ResolvedRelationTarget[];
  incoming: readonly IncomingRelationDisplay[];
  onUpdateRelations: (relations: Record<string, string[]> | undefined) => void;
  onNavigateToNote: (noteId: string) => void;
  onResolveTargetId: (title: string) => string | undefined;
  onStartWikiLink?: () => void;
}

function groupOutgoing(relations: readonly ResolvedRelationTarget[]): Map<string, ResolvedRelationTarget[]> {
  const groups = new Map<string, ResolvedRelationTarget[]>();
  for (const item of relations) {
    const bucket = groups.get(item.propertyKey) ?? [];
    bucket.push(item);
    groups.set(item.propertyKey, bucket);
  }
  return groups;
}

export function NoteRelationsPanel({
  colors: c,
  note,
  wikiTargets,
  outgoing,
  incoming,
  onUpdateRelations,
  onNavigateToNote,
  onResolveTargetId,
  onStartWikiLink,
}: NoteRelationsPanelProps) {
  const { t } = useTranslation();
  const [relationType, setRelationType] = useState('');
  const [customKey, setCustomKey] = useState('');
  const [targetQuery, setTargetQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const outgoingGroups = useMemo(() => groupOutgoing(outgoing), [outgoing]);
  const existingKeys = useMemo(() => listRelationKeys(note), [note]);

  const isCustomType = relationType === CUSTOM_RELATION_VALUE;
  const effectiveKey = isCustomType ? customKey.trim() : relationType.trim();

  const suggestions = useMemo(
    () => filterWikiTargets(targetQuery, wikiTargets.filter(title => title !== (note.title ?? ''))),
    [note.title, targetQuery, wikiTargets],
  );

  const canAdd = Boolean(
    effectiveKey && targetQuery.trim() && onResolveTargetId(targetQuery.trim()),
  );

  const commitNote = useCallback(
    (next: NoteBase) => {
      onUpdateRelations(next.relations);
    },
    [onUpdateRelations],
  );

  const handleAdd = useCallback(() => {
    const trimmedKey = effectiveKey;
    const trimmedTarget = targetQuery.trim();
    if (!trimmedKey || !trimmedTarget) return;

    const targetId = onResolveTargetId(trimmedTarget);
    if (!targetId) return;
    if (targetId === note.id) return;

    commitNote(addRelationTarget(note, trimmedKey, targetId));
    setTargetQuery('');
    setShowSuggestions(false);
  }, [commitNote, note, onResolveTargetId, effectiveKey, targetQuery]);

  const handleRemove = useCallback(
    (key: string, targetId: string) => {
      commitNote(removeRelationTarget(note, key, targetId));
    },
    [commitNote, note],
  );

  const rowStyle: CSSProperties = {
    margin: '0 8px 6px',
    borderRadius: 7,
    border: `1px solid ${c.sideBdr}`,
    background: c.cardHov,
    overflow: 'hidden',
  };

  const inputStyle: CSSProperties = {
    background: c.input,
    border: `1px solid ${c.inputBdr}`,
    borderRadius: 5,
    padding: '4px 6px',
    fontSize: 10,
    color: c.text,
    outline: 'none',
  };

  const renderTargetRow = (item: ResolvedRelationTarget) => {
    const label = item.missing ? t('knTargetMissing') : displayNoteTitle(item.targetTitle);
    const clickable = !item.missing;

    return (
      <div
        key={`${item.propertyKey}-${item.targetId}`}
        style={{
          ...rowStyle,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '6px 9px',
          cursor: clickable ? 'pointer' : 'default',
          opacity: item.missing ? 0.7 : 1,
        }}
        onClick={() => {
          if (clickable) onNavigateToNote(item.targetId);
        }}
      >
        <ArrowRight size={11} color={item.missing ? c.danger : c.accent} />
        <span
          style={{
            flex: 1,
            fontSize: 11,
            color: item.missing ? c.danger : c.text,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {label}
        </span>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            handleRemove(item.propertyKey, item.targetId);
          }}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            display: 'flex',
            color: c.textMuted,
            cursor: 'pointer',
          }}
          title={t('knRemoveRelation')}
        >
          <X size={11} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', minHeight: 0 }}>
      <p style={{ fontSize: 9, color: c.textFaint, margin: '0 10px 8px', lineHeight: 1.45 }}>
        {t('k90a3RelationsPanelHint')}
      </p>
      <div style={{ padding: '0 10px 6px', fontSize: 10, color: c.textMuted, fontWeight: 600 }}>
        {t('knOutgoingRelations')}
      </div>

      {outgoingGroups.size === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 10px 12px' }}>
          {t('knNoOutgoingRelations')}
        </p>
      ) : (
        [...outgoingGroups.entries()].map(([key, items]) => (
          <div key={key} style={{ marginBottom: 10 }}>
            <div style={{ padding: '0 10px 4px', fontSize: 10, color: c.accent, fontWeight: 600 }}>
              {key}
            </div>
            {items.map(renderTargetRow)}
          </div>
        ))
      )}

      <div
        style={{
          padding: '10px 10px 6px',
          fontSize: 10,
          color: c.textMuted,
          fontWeight: 600,
          borderTop: `1px solid ${c.sideBdr}`,
          marginTop: 4,
        }}
      >
        {t('knReferencedBy')}
      </div>

      {incoming.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 10px 12px' }}>
          {t('knNoIncomingRelations')}
        </p>
      ) : (
        incoming.map(item => {
          const label = item.missing ? t('knSourceMissing') : displayNoteTitle(item.sourceTitle);
          const clickable = !item.missing;

          return (
            <div
              key={`${item.edge.sourceId}-${item.edge.propertyKey}`}
              style={{
                ...rowStyle,
                cursor: clickable ? 'pointer' : 'default',
                opacity: item.missing ? 0.7 : 1,
              }}
              onClick={() => {
                if (clickable) onNavigateToNote(item.edge.sourceId);
              }}
            >
              <div style={{ padding: '5px 9px 4px', fontSize: 11, fontWeight: 600, color: c.text }}>
                {label}
              </div>
              <div style={{ padding: '0 9px 6px', fontSize: 10, color: c.textMuted }}>
                {t('knRelationToThisNote').replace('{key}', item.edge.propertyKey)}
              </div>
            </div>
          );
        })
      )}

      {outgoingGroups.size === 0 && incoming.length === 0 ? (
        <KnowledgePanelEmpty
          colors={c}
          actionLabel={onStartWikiLink ? t('k53ContextCreateWikiLink') : undefined}
          onAction={onStartWikiLink}
        >
          {t('relationsDiscoverHint')}
        </KnowledgePanelEmpty>
      ) : null}

      <div
        style={{
          padding: '10px 10px 6px',
          fontSize: 10,
          color: c.textMuted,
          fontWeight: 600,
          borderTop: `1px solid ${c.sideBdr}`,
          marginTop: 4,
        }}
      >
        {t('knAddRelation')}
      </div>

      <div style={{ padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <select
          value={relationType}
          onChange={e => {
            setRelationType(e.target.value);
            if (e.target.value !== CUSTOM_RELATION_VALUE) setCustomKey('');
          }}
          style={{ ...inputStyle, width: '100%' }}
        >
          <option value="">{t('knSelectRelationType')}</option>
          {PRESET_RELATION_KEYS.map(({ value, labelKey }) => (
            <option key={value} value={value}>
              {labelKey ? t(labelKey) : value}
            </option>
          ))}
          {existingKeys
            .filter(key => !PRESET_RELATION_KEYS.some(p => p.value === key))
            .map(key => (
              <option key={key} value={key}>{key}</option>
            ))}
          <option value={CUSTOM_RELATION_VALUE}>{t('knPropertyKey')}…</option>
        </select>

        {isCustomType && (
          <input
            value={customKey}
            onChange={e => setCustomKey(e.target.value)}
            placeholder={t('knPropertyKey')}
            list="relation-key-suggestions"
            style={inputStyle}
          />
        )}

        <datalist id="relation-key-suggestions">
          {[...PRESET_RELATION_KEYS.map(p => p.value), ...existingKeys].map(key => (
            <option key={key} value={key} />
          ))}
        </datalist>

        <div style={{ position: 'relative' }}>
          <input
            value={targetQuery}
            onChange={e => {
              setTargetQuery(e.target.value);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
            placeholder={t('knTargetNoteTitle')}
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
            }}
            style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }}
          />
          {showSuggestions && suggestions.length > 0 && (
            <div
              style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: '100%',
                marginTop: 2,
                background: c.card,
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                zIndex: 5,
                overflow: 'hidden',
              }}
            >
              {suggestions.map(title => (
                <button
                  key={title}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    setTargetQuery(title);
                    setShowSuggestions(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    background: 'none',
                    border: 'none',
                    padding: '6px 8px',
                    fontSize: 10,
                    color: c.text,
                    cursor: 'pointer',
                  }}
                >
                  {title}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={handleAdd}
          disabled={!canAdd}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            background: c.accentBg,
            border: `1px solid ${c.sideBdr}`,
            borderRadius: 5,
            padding: '6px 8px',
            fontSize: 10,
            color: c.accent,
            cursor: canAdd ? 'pointer' : 'not-allowed',
            opacity: canAdd ? 1 : 0.5,
          }}
        >
          <Plus size={11} />
          {t('knAddRelation')}
        </button>
      </div>
    </div>
  );
}
