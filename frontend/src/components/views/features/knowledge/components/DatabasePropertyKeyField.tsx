import type { CSSProperties } from 'react';
import {
  SUGGESTED_PROPERTY_KEYS,
  type DatabasePropertyFieldPreset,
} from '../databaseViews/databasePresentationMeta';

export interface DatabasePropertyKeyFieldProps {
  preset: DatabasePropertyFieldPreset;
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  inputClassName?: string;
  labelStyle?: CSSProperties;
  inputStyle?: CSSProperties;
  listId?: string;
}

export function DatabasePropertyKeyField({
  preset,
  value,
  onChange,
  onSubmit,
  inputClassName = 'bwi',
  labelStyle,
  inputStyle,
  listId = 'database-property-key-suggestions',
}: DatabasePropertyKeyFieldProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ color: 'inherit', fontWeight: 700, fontSize: 10, ...labelStyle }}>
        {preset.label}
      </span>
      <input
        className={inputClassName}
        style={{ flex: 1, minWidth: 120, fontSize: 10, ...inputStyle }}
        placeholder={preset.placeholder}
        value={value}
        list={listId}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') onSubmit?.();
        }}
      />
      <datalist id={listId}>
        {SUGGESTED_PROPERTY_KEYS.map(key => (
          <option key={key} value={key} />
        ))}
      </datalist>
    </div>
  );
}
