import { useTranslation } from '../../../../../lib/i18n';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import { NoteTagsEditor } from './NoteTagsEditor';

export interface NoteTagsPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  allTags: { tag: string; count: number }[];
  activeTag: string | null;
  onUpdateTags: (properties: Record<string, string> | undefined) => void;
  onSelectTag: (tag: string | null) => void;
}

/** Legacy Tags tab — delegates CRUD to shared NoteTagsEditor (K-90A1). */
export function NoteTagsPanel({
  colors: c,
  note,
  allTags,
  activeTag,
  onUpdateTags,
  onSelectTag,
}: NoteTagsPanelProps) {
  const { t } = useTranslation();

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 8 }}>
        {t('tagPageTags')}
      </div>
      <NoteTagsEditor
        colors={c}
        note={note}
        onUpdateTags={onUpdateTags}
        activeTag={activeTag}
        onSelectTag={onSelectTag}
        showVaultBrowse
        allTags={allTags}
      />
    </div>
  );
}
