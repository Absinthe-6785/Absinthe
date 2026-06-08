import type { Block } from './blockUtils';
import type { BlockEditorColors } from './editorTypes';

export interface UnsupportedBlockProps {
  block: Block;
  colors: BlockEditorColors;
  error?: Error | null;
}

export function UnsupportedBlock({ block, colors: c, error }: UnsupportedBlockProps) {
  const typeLabel = String(block.type ?? 'unknown');
  return (
    <div
      className="be-unsupported-block"
      style={{
        margin: '6px 0',
        padding: '10px 12px',
        borderRadius: 8,
        border: `1px dashed ${c.danger}88`,
        background: `${c.danger}0d`,
        color: c.text,
        fontSize: 13,
        lineHeight: 1.5,
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 4, color: c.danger }}>
        Unsupported block
      </div>
      <div style={{ color: c.textMuted, fontSize: 12 }}>
        Type: <code style={{ color: c.text }}>{typeLabel}</code>
      </div>
      <div style={{ color: c.textFaint, fontSize: 11, marginTop: 6 }}>
        This block could not be rendered. The rest of the document remains editable.
      </div>
      {error && import.meta.env.DEV && (
        <pre style={{
          marginTop: 8, fontSize: 10, color: c.textMuted, overflow: 'auto',
          whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        }}>
          {error.message}
        </pre>
      )}
    </div>
  );
}
