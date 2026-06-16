import { useCallback, useState, type CSSProperties } from 'react';
import { useTranslation } from '../../../../../lib/i18n';
import { Plus, Trash2 } from 'lucide-react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import type { NoteBase } from '../../../noteUtils';
import {
  listUserProperties,
  removeProperty,
  setProperty,
} from '../properties';
import { groupUserProperties, type PropertyGroupId } from '../properties/propertyGroups';
import { listTags } from '../tags';
import { CosmosEmptyHint } from './CosmosEmptyHint';
import { KnowledgePanelSection } from './KnowledgePanelSection';
import { NoteTagsEditor } from './NoteTagsEditor';

export interface NotePropertiesPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  onUpdateProperties: (properties: Record<string, string> | undefined) => void;
  activeTag?: string | null;
  onSelectTag?: (tag: string | null) => void;
}

const GROUP_TITLE_KEYS: Record<PropertyGroupId, 'k35PropGroupStudy' | 'k35PropGroupSource' | 'k35PropGroupGeneral'> = {
  study: 'k35PropGroupStudy',
  source: 'k35PropGroupSource',
  general: 'k35PropGroupGeneral',
};

const GROUP_HINT_KEYS: Record<PropertyGroupId, 'k35PropHintStudy' | 'k35PropHintSource' | 'k35PropHintGeneral'> = {
  study: 'k35PropHintStudy',
  source: 'k35PropHintSource',
  general: 'k35PropHintGeneral',
};

const GROUP_ORDER: PropertyGroupId[] = ['study', 'source', 'general'];

function PropertyRow({
  c,
  propertyKey,
  value,
  editing,
  editValue,
  inputStyle,
  onStartEdit,
  onEditChange,
  onSave,
  onCancel,
  onDelete,
  deleteLabel,
}: {
  c: NoteChromeColors;
  propertyKey: string;
  value: string;
  editing: boolean;
  editValue: string;
  inputStyle: CSSProperties;
  onStartEdit: () => void;
  onEditChange: (v: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  deleteLabel: string;
}) {
  return (
    <div
      style={{
        border: `1px solid ${c.sideBdr}`,
        borderRadius: 6,
        background: c.cardHov,
        padding: '6px 8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: c.accent, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {propertyKey}
        </span>
        <button
          type="button"
          onClick={onDelete}
          title={deleteLabel}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textFaint, padding: 2, display: 'flex' }}
        >
          <Trash2 size={11} />
        </button>
      </div>
      {editing ? (
        <input
          value={editValue}
          onChange={e => onEditChange(e.target.value)}
          onBlur={onSave}
          onKeyDown={e => {
            if (e.key === 'Enter') onSave();
            if (e.key === 'Escape') onCancel();
          }}
          autoFocus
          style={{ ...inputStyle, width: '100%' }}
        />
      ) : (
        <div
          onClick={onStartEdit}
          style={{ fontSize: 11, color: c.text, cursor: 'text', wordBreak: 'break-word' }}
        >
          {value}
        </div>
      )}
    </div>
  );
}

export function NotePropertiesPanel({
  colors: c,
  note,
  onUpdateProperties,
  activeTag = null,
  onSelectTag,
}: NotePropertiesPanelProps) {
  const { t } = useTranslation();
  const tags = listTags(note);
  const properties = listUserProperties(note);
  const grouped = groupUserProperties(properties);
  const [newKey, setNewKey] = useState('');
  const [newValue, setNewValue] = useState('');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const commitProperties = useCallback(
    (next: NoteBase) => {
      onUpdateProperties(next.properties);
    },
    [onUpdateProperties],
  );

  const handleAdd = useCallback(() => {
    const key = newKey.trim();
    const value = newValue.trim();
    if (!key || !value) return;
    commitProperties(setProperty(note, key, value));
    setNewKey('');
    setNewValue('');
  }, [commitProperties, newKey, newValue, note]);

  const handleDelete = useCallback(
    (key: string) => {
      commitProperties(removeProperty(note, key));
      if (editingKey === key) setEditingKey(null);
    },
    [commitProperties, editingKey, note],
  );

  const saveEdit = useCallback(
    (key: string) => {
      const value = editValue.trim();
      if (!value) {
        handleDelete(key);
        return;
      }
      commitProperties(setProperty(note, key, value));
      setEditingKey(null);
      setEditValue('');
    },
    [commitProperties, editValue, handleDelete, note],
  );

  const inputStyle: CSSProperties = {
    flex: 1,
    minWidth: 0,
    background: c.input,
    border: `1px solid ${c.inputBdr}`,
    borderRadius: 5,
    padding: '4px 6px',
    fontSize: 10,
    color: c.text,
    outline: 'none',
  };

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '8px 10px 12px' }}>
      <KnowledgePanelSection
        colors={c}
        first
        title={t('tagPageTags')}
        count={tags.length}
        hint={t('k90a1PropertiesTagsHint')}
      >
        <div style={{ padding: '0 0 4px' }}>
          <NoteTagsEditor
            colors={c}
            note={note}
            onUpdateTags={onUpdateProperties}
            activeTag={activeTag}
            onSelectTag={onSelectTag}
          />
        </div>
      </KnowledgePanelSection>

      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 700, letterSpacing: 0.3, textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
        {t('propPageProperties')}
      </div>

      {properties.length === 0 ? (
        <>
          <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 0 4px', margin: 0 }}>
            {t('propNone')}
          </p>
          <CosmosEmptyHint colors={c}>{t('propCosmosOnboarding')}</CosmosEmptyHint>
          <p style={{ fontSize: 10, color: c.textFaint, textAlign: 'center', padding: '4px 10px 12px', margin: 0, lineHeight: 1.5 }}>
            {t('k35PropEmptyHint')}
          </p>
        </>
      ) : (
        GROUP_ORDER.map(groupId => {
          const rows = grouped[groupId];
          if (rows.length === 0) return null;
          return (
            <KnowledgePanelSection
              key={groupId}
              colors={c}
              first={false}
              title={t(GROUP_TITLE_KEYS[groupId])}
              count={rows.length}
              hint={t(GROUP_HINT_KEYS[groupId])}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 0 8px' }}>
                {rows.map(({ key, value }) => (
                  <PropertyRow
                    key={key}
                    c={c}
                    propertyKey={key}
                    value={value}
                    editing={editingKey === key}
                    editValue={editValue}
                    inputStyle={inputStyle}
                    onStartEdit={() => { setEditingKey(key); setEditValue(value); }}
                    onEditChange={setEditValue}
                    onSave={() => saveEdit(key)}
                    onCancel={() => setEditingKey(null)}
                    onDelete={() => handleDelete(key)}
                    deleteLabel={t('propDeleteProperty')}
                  />
                ))}
              </div>
            </KnowledgePanelSection>
          );
        })
      )}

      <div style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 10, marginTop: 4 }}>
        <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 6 }}>
          {t('propAddProperty')}
        </div>
        <p style={{ fontSize: 9, color: c.textFaint, margin: '0 0 8px', lineHeight: 1.45 }}>
          {t('k35PropAddHint')}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <input
            value={newKey}
            onChange={e => setNewKey(e.target.value)}
            placeholder={t('propKey')}
            style={inputStyle}
          />
          <input
            value={newValue}
            onChange={e => setNewValue(e.target.value)}
            placeholder={t('propValue')}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            style={inputStyle}
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newKey.trim() || !newValue.trim()}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              background: c.accentBg,
              border: `1px solid ${c.sideBdr}`,
              borderRadius: 6,
              padding: '5px 8px',
              fontSize: 10,
              color: c.accent,
              cursor: 'pointer',
              opacity: !newKey.trim() || !newValue.trim() ? 0.5 : 1,
            }}
          >
            <Plus size={11} /> {t('add')}
          </button>
        </div>
      </div>
    </div>
  );
}
