import type { CSSProperties } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export function databaseControlsContainerStyle(c: NoteChromeColors): CSSProperties {
  return {
    padding: '6px 8px',
    borderBottom: `1px solid ${c.sideBdr}`,
    background: c.toolbar,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 10,
    color: c.textMuted,
  };
}
