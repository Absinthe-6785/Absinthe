/**
 * EditorDiscoverabilityHints.tsx — Lightweight selection / empty-doc hints (UX-5C)
 */
import React from 'react';
import type { BlockEditorColors } from '../../../editorTypes';
import { EMPTY_DOC_HINT_LINES, multiSelectHintText } from '../utils/editorDiscoverability';

export interface MultiSelectHintProps {
  count: number;
  colors: BlockEditorColors;
}

export function MultiSelectHint({ count, colors: c }: MultiSelectHintProps) {
  if (count <= 1) return null;
  return (
    <div
      className="be-multi-select-hint"
      role="status"
      aria-live="polite"
      style={{
        position: 'sticky',
        bottom: 12,
        zIndex: 20,
        display: 'flex',
        justifyContent: 'center',
        pointerEvents: 'none',
        marginTop: 8,
      }}
    >
      <div style={{
        background: c.card,
        border: `1px solid ${c.border}`,
        borderRadius: c.radiusCard ?? 12,
        padding: '6px 14px',
        fontSize: 12,
        color: c.textMuted,
        boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
        maxWidth: 'min(100%, 520px)',
        textAlign: 'center',
        lineHeight: 1.45,
      }}>
        {multiSelectHintText(count)}
      </div>
    </div>
  );
}

export interface EmptyDocumentHintProps {
  visible: boolean;
  colors: BlockEditorColors;
}

export function EmptyDocumentHint({ visible, colors: c }: EmptyDocumentHintProps) {
  if (!visible) return null;
  return (
    <div
      className="be-empty-doc-hint"
      aria-hidden
      style={{
        margin: '4px 0 12px 0',
        padding: '10px 14px',
        borderRadius: c.radiusCard ?? 12,
        border: `1px dashed ${c.border}`,
        background: c.toolbar ?? c.card,
        color: c.textMuted,
        fontSize: 12,
        lineHeight: 1.6,
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px 12px',
        alignItems: 'center',
      }}
    >
      {EMPTY_DOC_HINT_LINES.map((line, i) => (
        <React.Fragment key={line}>
          {i > 0 && <span style={{ opacity: 0.35 }}>·</span>}
          <span>{line}</span>
        </React.Fragment>
      ))}
    </div>
  );
}
