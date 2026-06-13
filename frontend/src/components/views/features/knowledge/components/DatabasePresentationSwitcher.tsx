import type { CSSProperties } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';
import {
  getDatabasePresentationOptions,
  type DatabasePresentationOption,
} from '../databaseViews/databasePresentationMeta';
import type { DatabaseViewPresentation } from '../databaseViews/databaseViewModels';
import { useTranslation } from '../../../../../lib/i18n';

export interface DatabasePresentationSwitcherProps {
  colors?: NoteChromeColors;
  value: DatabaseViewPresentation;
  onChange: (presentation: DatabaseViewPresentation) => void;
  label?: string;
  showLabel?: boolean;
  style?: CSSProperties;
  className?: string;
  options?: readonly DatabasePresentationOption[];
}

export function DatabasePresentationSwitcher({
  value,
  onChange,
  label,
  showLabel = true,
  style,
  className = 'bwi',
  options,
}: DatabasePresentationSwitcherProps) {
  const { t, lang } = useTranslation();
  const resolvedLabel = label ?? t('dbViewLabel');
  const resolvedOptions = options ?? getDatabasePresentationOptions(lang);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', ...style }}>
      {showLabel && (
        <span style={{ color: 'inherit', fontWeight: 700, fontSize: 10 }}>{resolvedLabel}</span>
      )}
      <select
        className={className}
        style={{ fontSize: 10, padding: '2px 4px', flex: style?.width ? 1 : undefined }}
        value={value}
        onChange={e => onChange(e.target.value as DatabaseViewPresentation)}
      >
        {resolvedOptions.map(option => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </div>
  );
}
