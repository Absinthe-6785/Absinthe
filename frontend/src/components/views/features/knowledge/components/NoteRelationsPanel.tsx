import { useCallback, useMemo, useState, type CSSProperties } from 'react';
import { ArrowRight, Plus, X } from 'lucide-react';
import { filterWikiTargets } from '../../block-editor/features/menus/utils/wikiSearch';
import { displayNoteTitle } from '../../../noteDisplayTitle';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import type { RelationEdge, ResolvedRelationTarget } from '../relations/relationModels';
import { addRelationTarget, listRelationKeys, removeRelationTarget } from '../relations/noteRelations';

const SUGGESTED_RELATION_KEYS = ['course', 'project', 'book', 'person', 'chapter'] as const;

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
}: NoteRelationsPanelProps) {
  const [propertyKey, setPropertyKey] = useState('course');
  const [targetQuery, setTargetQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const outgoingGroups = useMemo(() => groupOutgoing(outgoing), [outgoing]);
  const existingKeys = useMemo(() => listRelationKeys(note), [note]);

  const suggestions = useMemo(
    () => filterWikiTargets(targetQuery, wikiTargets.filter(title => title !== (note.title ?? ''))),
    [note.title, targetQuery, wikiTargets],
  );

  const commitNote = useCallback(
    (next: NoteBase) => {
      onUpdateRelations(next.relations);
    },
    [onUpdateRelations],
  );

  const handleAdd = useCallback(() => {
    const trimmedKey = propertyKey.trim();
    const trimmedTarget = targetQuery.trim();
    if (!trimmedKey || !trimmedTarget) return;

    const targetId = onResolveTargetId(trimmedTarget);
    if (!targetId) return;
    if (targetId === note.id) return;

    commitNote(addRelationTarget(note, trimmedKey, targetId));
    setTargetQuery('');
    setShowSuggestions(false);
  }, [commitNote, note, onResolveTargetId, propertyKey, targetQuery]);

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

  const renderTargetRow = (item: ResolvedRelationTarget) => {
    const label = item.missing ? '대상 없음' : displayNoteTitle(item.targetTitle);
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
          title="관계 제거"
        >
          <X size={11} />
        </button>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0', minHeight: 0 }}>
      <div style={{ padding: '0 10px 6px', fontSize: 10, color: c.textMuted, fontWeight: 600 }}>
        나가는 관계
      </div>

      {outgoingGroups.size === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 10px 12px' }}>
          나가는 관계 없음
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
        참조하는 노트
      </div>

      {incoming.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 10px 12px' }}>
          들어오는 관계 없음
        </p>
      ) : (
        incoming.map(item => {
          const label = item.missing ? '출처 없음' : displayNoteTitle(item.sourceTitle);
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
                {item.edge.propertyKey} → this note
              </div>
            </div>
          );
        })
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
        관계 추가
      </div>

      <div style={{ padding: '0 10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={propertyKey}
          onChange={e => setPropertyKey(e.target.value)}
          placeholder="속성 키"
          list="relation-key-suggestions"
          style={{
            background: c.input,
            border: `1px solid ${c.inputBdr}`,
            borderRadius: 5,
            padding: '4px 6px',
            fontSize: 10,
            color: c.text,
            outline: 'none',
          }}
        />
        <datalist id="relation-key-suggestions">
          {[...SUGGESTED_RELATION_KEYS, ...existingKeys].map(key => (
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
            placeholder="대상 노트 제목"
            onKeyDown={e => {
              if (e.key === 'Enter') handleAdd();
            }}
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: c.input,
              border: `1px solid ${c.inputBdr}`,
              borderRadius: 5,
              padding: '4px 6px',
              fontSize: 10,
              color: c.text,
              outline: 'none',
            }}
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
          disabled={!propertyKey.trim() || !targetQuery.trim() || !onResolveTargetId(targetQuery.trim())}
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
            cursor: 'pointer',
            opacity: !propertyKey.trim() || !targetQuery.trim() ? 0.5 : 1,
          }}
        >
          <Plus size={11} />
          관계 추가
        </button>
      </div>
    </div>
  );
}
