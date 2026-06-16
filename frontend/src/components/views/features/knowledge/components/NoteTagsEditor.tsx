import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { addTag, listTags, removeTag, renameTag } from '../tags';
import { TagChip, TagChipRow } from './TagChip';

export interface NoteTagsEditorProps {
  colors: NoteChromeColors;
  note: NoteBase;
  onUpdateTags: (properties: Record<string, string> | undefined) => void;
  activeTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
}

/**
 * Shared tag CRUD UI — canonical editor in Properties (K-90A1).
 * Business logic lives in `tags/noteTags.ts`.
 */
export function NoteTagsEditor({
  colors: c,
  note,
  onUpdateTags,
  activeTag = null,
  onSelectTag,
}: NoteTagsEditorProps) {
  const { t } = useTranslation();
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
        onSelectTag?.(null);
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

  const toggleFilter = useCallback(
    (tag: string) => {
      if (!onSelectTag) return;
      onSelectTag(activeTag?.toLowerCase() === tag.toLowerCase() ? null : tag);
    },
    [activeTag, onSelectTag],
  );

  return (
    <>
      {tags.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '4px 0 10px', margin: 0 }}>
          {t('tagNone')}
        </p>
      ) : (
        <TagChipRow style={{ marginBottom: 10 }}>
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
                  maxWidth: '100%',
                }}
              />
            ) : (
              <TagChip
                key={tag}
                colors={c}
                tag={tag}
                wrap
                selected={activeTag?.toLowerCase() === tag.toLowerCase()}
                title={onSelectTag ? t('tagClickFilterHint') : undefined}
                onClick={onSelectTag ? () => toggleFilter(tag) : undefined}
                onDoubleClick={() => startRename(tag)}
                onRemove={() => handleRemove(tag)}
              />
            )
          ))}
        </TagChipRow>
      )}

      <div style={{ display: 'flex', gap: 4 }}>
        <input
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          placeholder={t('tagAddPlaceholder')}
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
    </>
  );
}
