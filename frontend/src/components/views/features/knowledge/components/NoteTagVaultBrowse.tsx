import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import { listTags } from '../tags';
import { TagChip, TagChipRow } from './TagChip';

export interface NoteTagVaultBrowseProps {
  colors: NoteChromeColors;
  allTags: { tag: string; count: number }[];
  activeTag: string | null;
  onSelectTag: (tag: string | null) => void;
}

/** Vault-wide tag list with counts — filter navigation only (K-90A2). */
export function NoteTagVaultBrowse({
  colors: c,
  allTags,
  activeTag,
  onSelectTag,
}: NoteTagVaultBrowseProps) {
  const { t } = useTranslation();
  if (allTags.length === 0) return null;

  return (
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
      <p style={{ fontSize: 9, color: c.textFaint, margin: '0 0 8px', lineHeight: 1.45 }}>
        {t('k90a2VaultBrowseHint')}
      </p>
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
  );
}
