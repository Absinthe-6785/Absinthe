import { useCallback, useState, type CSSProperties } from 'react';
import { Plus, X } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { addTag, listTags, removeTag, renameTag } from '../tags';

export interface NoteTagsPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  allTags: { tag: string; count: number }[];
  activeTag: string | null;
  onUpdateTags: (properties: Record<string, string> | undefined) => void;
  onSelectTag: (tag: string | null) => void;
}

export function NoteTagsPanel({
  colors: c,
  note,
  allTags,
  activeTag,
  onUpdateTags,
  onSelectTag,
}: NoteTagsPanelProps) {
  const tags = listTags(note);
  const [newTag, setNewTag] = useState('');
  const [renamingTag, setRenamingTag] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const commitNote = useCallback(
    (next: NoteBase) => {
      onUpdateTags(next.properties);
    },
    [onUpdateTags],
  );

  const handleAdd = useCallback(() => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    commitNote(addTag(note, trimmed));
    setNewTag('');
  }, [commitNote, newTag, note]);

  const handleRemove = useCallback(
    (tag: string) => {
      commitNote(removeTag(note, tag));
      if (activeTag && activeTag.toLowerCase() === tag.toLowerCase()) {
        onSelectTag(null);
      }
    },
    [activeTag, commitNote, note, onSelectTag],
  );

  const startRename = useCallback((tag: string) => {
    setRenamingTag(tag);
    setRenameValue(tag);
  }, []);

  const saveRename = useCallback(() => {
    if (!renamingTag) return;
    commitNote(renameTag(note, renamingTag, renameValue));
    setRenamingTag(null);
    setRenameValue('');
  }, [commitNote, note, renameValue, renamingTag]);

  const pillStyle = (selected: boolean): CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 10,
    color: selected ? c.accent : c.tagTxt,
    background: selected ? c.cardAct : c.tag,
    border: `1px solid ${selected ? c.cardActBdr : 'transparent'}`,
    borderRadius: 999,
    padding: '2px 8px',
    cursor: 'pointer',
  });

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 8 }}>
        페이지 태그
      </div>

      {tags.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 0 12px' }}>
          태그 없음
        </p>
      ) : (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
          {tags.map(tag => (
            renamingTag === tag ? (
              <input
                key={tag}
                value={renameValue}
                onChange={e => setRenameValue(e.target.value)}
                onBlur={saveRename}
                onKeyDown={e => {
                  if (e.key === 'Enter') saveRename();
                  if (e.key === 'Escape') setRenamingTag(null);
                }}
                autoFocus
                style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 999,
                  border: `1px solid ${c.inputBdr}`,
                  background: c.input,
                  color: c.text,
                  minWidth: 60,
                }}
              />
            ) : (
              <span
                key={tag}
                style={pillStyle(activeTag?.toLowerCase() === tag.toLowerCase())}
                onClick={() => onSelectTag(activeTag?.toLowerCase() === tag.toLowerCase() ? null : tag)}
                onDoubleClick={() => startRename(tag)}
                title="Click to filter · double-click to rename"
              >
                #{tag}
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleRemove(tag);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    display: 'flex',
                    color: c.textMuted,
                    cursor: 'pointer',
                  }}
                >
                  <X size={10} />
                </button>
              </span>
            )
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        <input
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          placeholder="Add tag"
          onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
          style={{
            flex: 1,
            minWidth: 0,
            background: c.input,
            border: `1px solid ${c.inputBdr}`,
            borderRadius: 5,
            padding: '4px 6px',
            fontSize: 10,
            color: c.text,
            outline: 'none',
          }}
        />
        <button
          type="button"
          onClick={handleAdd}
          disabled={!newTag.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            background: c.accentBg,
            border: `1px solid ${c.sideBdr}`,
            borderRadius: 5,
            padding: '4px 8px',
            fontSize: 10,
            color: c.accent,
            cursor: 'pointer',
            opacity: !newTag.trim() ? 0.5 : 1,
          }}
        >
          <Plus size={11} />
        </button>
      </div>

      {allTags.length > 0 && (
        <>
          <div
            style={{
              fontSize: 10,
              color: c.textMuted,
              fontWeight: 600,
              marginBottom: 8,
              borderTop: `1px solid ${c.sideBdr}`,
              paddingTop: 10,
            }}
          >
            All Tags
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {allTags.map(({ tag, count }) => (
              <span
                key={tag}
                style={pillStyle(activeTag?.toLowerCase() === tag.toLowerCase())}
                onClick={() => onSelectTag(activeTag?.toLowerCase() === tag.toLowerCase() ? null : tag)}
              >
                #{tag}{' '}
                <span style={{ color: c.textMuted }}>{count}</span>
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
