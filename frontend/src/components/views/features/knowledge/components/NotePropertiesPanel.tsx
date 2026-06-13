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

export interface NotePropertiesPanelProps {
  colors: NoteChromeColors;
  note: NoteBase;
  onUpdateProperties: (properties: Record<string, string> | undefined) => void;
}

export function NotePropertiesPanel({
  colors: c,
  note,
  onUpdateProperties,
}: NotePropertiesPanelProps) {
  const { t } = useTranslation();
  const properties = listUserProperties(note);
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

  const startEdit = useCallback((key: string, value: string) => {
    setEditingKey(key);
    setEditValue(value);
  }, []);

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
    <div style={{ flex: 1, overflowY: 'auto', padding: '10px' }}>
      <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 8 }}>
        {t('propPageProperties')}
      </div>

      {properties.length === 0 ? (
        <p style={{ fontSize: 11, color: c.textFaint, textAlign: 'center', padding: '8px 0 12px' }}>
          {t('propNone')}
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
          {properties.map(({ key, value }) => (
            <div
              key={key}
              style={{
                border: `1px solid ${c.sideBdr}`,
                borderRadius: 6,
                background: c.cardHov,
                padding: '6px 8px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                <span style={{ fontSize: 10, fontWeight: 600, color: c.accent, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {key}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(key)}
                  title={t('propDeleteProperty')}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: c.textFaint, padding: 2, display: 'flex' }}
                >
                  <Trash2 size={11} />
                </button>
              </div>
              {editingKey === key ? (
                <input
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  onBlur={() => saveEdit(key)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveEdit(key);
                    if (e.key === 'Escape') setEditingKey(null);
                  }}
                  autoFocus
                  style={{ ...inputStyle, width: '100%' }}
                />
              ) : (
                <div
                  onClick={() => startEdit(key, value)}
                  style={{ fontSize: 11, color: c.text, cursor: 'text', wordBreak: 'break-word' }}
                >
                  {value}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: `1px solid ${c.sideBdr}`, paddingTop: 10 }}>
        <div style={{ fontSize: 10, color: c.textMuted, fontWeight: 600, marginBottom: 6 }}>
          {t('propAddProperty')}
        </div>
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
