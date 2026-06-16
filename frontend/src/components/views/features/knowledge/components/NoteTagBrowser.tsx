import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { listTags } from '../tags';
import { TagChip, TagChipRow } from './TagChip';
import { NoteTagVaultBrowse } from './NoteTagVaultBrowse';

export interface NoteTagBrowserProps {
  colors: NoteChromeColors;
  note: NoteBase;
  allTags: { tag: string; count: number }[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
  onOpenProperties: () => void;
}

/**
 * Tags tab — vault browse + read-only note tags. CRUD lives in Properties (K-90A2).
 */
export function NoteTagBrowser({
  colors: c,
  note,
  allTags,
  activeTag,
  onSelectTag,
  onOpenProperties,
}: NoteTagBrowserProps) {
  const { t } = useTranslation();
  const tags = listTags(note);

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 4 }}>
        {t('k90a2TagsBrowserTitle')}
      </div>
      <p style={{ fontSize: 9, color: c.textFaint, margin: '0 0 10px', lineHeight: 1.45 }}>
        {t('k90a2TagsBrowserHint')}
      </p>

      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 6 }}>
        {t('k90a2TagsOnThisNote')}
        {tags.length > 0 && (
          <span style={{ color: c.textFaint, fontWeight: 500 }}> ({tags.length})</span>
        )}
      </div>

      {tags.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '4px 0 10px', margin: 0 }}>
          {t('tagNone')}
        </p>
      ) : (
        <TagChipRow style={{ marginBottom: 10 }}>
          {tags.map(tag => (
            <TagChip
              key={tag}
              colors={c}
              tag={tag}
              wrap
              selected={activeTag?.toLowerCase() === tag.toLowerCase()}
              title={t('tagClickFilterHint')}
              onClick={() => onSelectTag(activeTag?.toLowerCase() === tag.toLowerCase() ? null : tag)}
            />
          ))}
        </TagChipRow>
      )}

      <button
        type="button"
        onClick={onOpenProperties}
        style={{
          width: '100%',
          marginBottom: 12,
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
        {t('k90a2TagsEditInProperties')}
      </button>

      <NoteTagVaultBrowse
        colors={c}
        allTags={allTags}
        activeTag={activeTag}
        onSelectTag={onSelectTag}
      />
    </div>
  );
}
