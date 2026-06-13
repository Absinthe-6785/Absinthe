import type { CSSProperties } from 'react';
import type { NoteChromeColors } from '../../../noteEditorTheme';

export interface CosmosEmptyHintProps {
  colors: NoteChromeColors;
  children: string;
  style?: CSSProperties;
}

/** Secondary onboarding line beneath empty panel states — Cosmos mental model. */
export function CosmosEmptyHint({ colors: c, children, style }: CosmosEmptyHintProps) {
  return (
    <p
      style={{
        fontSize: 10,
        color: c.textFaint,
        textAlign: 'center',
        padding: '0 10px 8px',
        lineHeight: 1.45,
        margin: 0,
        ...style,
      }}
    >
      {children}
    </p>
  );
}
