import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { addTag, listTags, removeTag, renameTag } from '../tags';
import { TagChip, TagChipRow } from './TagChip';

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

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 8 }}>
        {t('tagPageTags')}
      </div>

      {tags.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 0 12px' }}>
          {t('tagNone')}
        </p>
      ) : (
        <TagChipRow style={{ marginBottom: 12 }}>
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
                title={t('tagClickFilterHint')}
                onClick={() => onSelectTag(activeTag?.toLowerCase() === tag.toLowerCase() ? null : tag)}
                onDoubleClick={() => startRename(tag)}
                onRemove={() => handleRemove(tag)}
              />
            )
          ))}
        </TagChipRow>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
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
            {t('knAllTags')}
          </div>
          <TagChipRow>
            {allTags.map(({ tag, count }) => (
              <TagChip
                key={tag}
                colors={c}
                tag={tag}
                size="sm"
                selected={activeTag?.toLowerCase() === tag.toLowerCase()}
                suffix={<span style={{ color: c.textMuted, fontSize: 9, flexShrink: 0 }}>{count}</span>}
                onClick={() => onSelectTag(activeTag?.toLowerCase() === tag.toLowerCase() ? null : tag)}
              />
            ))}
          </TagChipRow>
        </>
      )}
    </div>
  );
}
